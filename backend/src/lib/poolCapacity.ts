import type { Prisma } from "@prisma/client";

/**
 * Returns the member count at which the "near full" warning email fires for
 * a pool of `maxParticipants` capacity, given a `thresholdPct` (1..99).
 *
 * The naive formula `floor(max * pct / 100)` collapses to "fires only when full"
 * for very small pools (e.g. max=3 at 95% would round to 3). To guarantee the
 * warning lands at least one slot before the cap, this function reserves a
 * margin of `max(1, floor(max * (100-pct) / 100))` slots, then subtracts it
 * from `max`. Examples for pct=95:
 *   max=100 → 95   max=20 → 19   max=10 → 9   max=3 → 2   max=1 → 0
 */
export function computeWarningThreshold(maxParticipants: number, thresholdPct: number): number {
  if (maxParticipants <= 0) return 0;
  const clampedPct = Math.min(99, Math.max(1, thresholdPct));
  const margin = Math.max(1, Math.floor((maxParticipants * (100 - clampedPct)) / 100));
  return Math.max(0, maxParticipants - margin);
}

/**
 * Ensures a pool has not exceeded its maxParticipants limit.
 *
 * MUST be called inside a Prisma interactive transaction (`tx`).
 * Acquires a row-level lock on the Pool row (`SELECT ... FOR UPDATE`)
 * to serialize concurrent join attempts and prevent race conditions.
 *
 * @throws Error("POOL_FULL") if the pool is at or over capacity.
 */
export async function ensurePoolCapacity(
  tx: Prisma.TransactionClient,
  poolId: string,
  maxParticipants: number | null,
): Promise<void> {
  if (!maxParticipants) return;

  // Lock the Pool row to serialize concurrent joins for this pool.
  // Any concurrent transaction attempting to join the same pool will
  // wait here until this transaction commits or rolls back.
  await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${poolId} FOR UPDATE`;

  const memberCount = await tx.poolMember.count({
    where: { poolId, status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
  });

  if (memberCount >= maxParticipants) {
    throw new Error("POOL_FULL");
  }
}
