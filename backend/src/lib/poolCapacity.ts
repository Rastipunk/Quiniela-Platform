import type { Prisma } from "@prisma/client";

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
