import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { fireAndForget } from "./asyncHelpers";
import { writeAuditEvent } from "./audit";
import { sendCapacityWarningEmail, sendPoolFullNotificationEmail } from "./email";
import { CAPACITY, countryToLocale } from "./constants";
import { HOST_NOTIFICATION_ROLES } from "./roles";

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

// ─── Threshold notifications ────────────────────────────────────────────────

export type CapacityThresholdState = "none" | "warning" | "full";

export interface CapacityNotifyResult {
  state: CapacityThresholdState;
  emailSent: boolean;
}

/**
 * Inspects current member count vs capacity and dispatches a one-shot email
 * notification to the host when a threshold is crossed:
 *   - count >= max                    → "pool full" email (deduped via Pool.poolFullNotifiedAt)
 *   - count >= warningThreshold(max,pct) → "near full" email (deduped via Pool.capacityWarningNotifiedAt)
 *   - otherwise                       → no-op
 *
 * Runs OUTSIDE the join transaction (read-then-atomic-claim pattern). The
 * `updateMany WHERE flag IS NULL` predicate guarantees only one process wins
 * the dispatch even under concurrent joins. When the pool reaches "full" we
 * also opportunistically set the warning flag so a stale warning email never
 * fires post-fill (e.g. if a paid expansion later resets only the full flag).
 *
 * Member count includes ACTIVE + PENDING_APPROVAL — same definition used by
 * ensurePoolCapacity, so the trigger and the join-block stay aligned.
 */
export async function checkAndNotifyCapacityThresholds(args: {
  poolId: string;
  /** Optional: who triggered the check (for audit trail). */
  actorUserId?: string | null;
}): Promise<CapacityNotifyResult> {
  const pool = await prisma.pool.findUnique({
    where: { id: args.poolId },
    select: {
      id: true,
      name: true,
      maxParticipants: true,
      capacityWarningThresholdPct: true,
      capacityWarningNotifiedAt: true,
      poolFullNotifiedAt: true,
    },
  });

  if (!pool || !pool.maxParticipants) {
    return { state: "none", emailSent: false };
  }

  const memberCount = await prisma.poolMember.count({
    where: {
      poolId: args.poolId,
      status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
    },
  });

  const max = pool.maxParticipants;
  const thresholdPct = pool.capacityWarningThresholdPct ?? CAPACITY.WARNING_THRESHOLD_PCT_DEFAULT;
  const warningAt = computeWarningThreshold(max, thresholdPct);

  // Full takes precedence over warning.
  if (memberCount >= max) {
    if (pool.poolFullNotifiedAt) return { state: "full", emailSent: false };
    return tryClaimAndNotifyFull({
      poolId: pool.id,
      poolName: pool.name,
      maxParticipants: max,
      warningWasUnsent: pool.capacityWarningNotifiedAt === null,
      actorUserId: args.actorUserId ?? null,
    });
  }

  if (memberCount >= warningAt) {
    if (pool.capacityWarningNotifiedAt) return { state: "warning", emailSent: false };
    return tryClaimAndNotifyWarning({
      poolId: pool.id,
      poolName: pool.name,
      currentMembers: memberCount,
      maxParticipants: max,
      actorUserId: args.actorUserId ?? null,
    });
  }

  return { state: "none", emailSent: false };
}

async function tryClaimAndNotifyFull(args: {
  poolId: string;
  poolName: string;
  maxParticipants: number;
  warningWasUnsent: boolean;
  actorUserId: string | null;
}): Promise<CapacityNotifyResult> {
  const now = new Date();
  const { count: claimed } = await prisma.pool.updateMany({
    where: { id: args.poolId, poolFullNotifiedAt: null },
    data: {
      poolFullNotifiedAt: now,
      // Cover the warning flag in the same write so a stale warning email never
      // fires after fill (e.g. if a partial expansion later only resets full).
      ...(args.warningWasUnsent ? { capacityWarningNotifiedAt: now } : {}),
    },
  });
  if (claimed === 0) return { state: "full", emailSent: false };

  const host = await findHostForNotification(args.poolId);
  let emailSent = false;
  if (host) {
    fireAndForget("capacity:pool-full", sendPoolFullNotificationEmail({
      to: host.email,
      hostName: host.displayName,
      poolName: args.poolName,
      poolId: args.poolId,
      maxParticipants: args.maxParticipants,
      locale: host.locale,
    }));
    emailSent = true;
  }
  fireAndForget("audit:pool-full-notified", writeAuditEvent({
    actorUserId: args.actorUserId ?? undefined,
    action: "POOL_FULL_NOTIFIED",
    entityType: "Pool",
    entityId: args.poolId,
    poolId: args.poolId,
    dataJson: { maxParticipants: args.maxParticipants },
  }));
  return { state: "full", emailSent };
}

async function tryClaimAndNotifyWarning(args: {
  poolId: string;
  poolName: string;
  currentMembers: number;
  maxParticipants: number;
  actorUserId: string | null;
}): Promise<CapacityNotifyResult> {
  const now = new Date();
  // Defensive: if the pool went straight from below-warning to full between the
  // initial read and now, the `poolFullNotifiedAt: null` guard keeps the
  // warning email from firing — full will be notified instead on the next call.
  const { count: claimed } = await prisma.pool.updateMany({
    where: { id: args.poolId, capacityWarningNotifiedAt: null, poolFullNotifiedAt: null },
    data: { capacityWarningNotifiedAt: now },
  });
  if (claimed === 0) return { state: "warning", emailSent: false };

  const host = await findHostForNotification(args.poolId);
  let emailSent = false;
  if (host) {
    fireAndForget("capacity:warning", sendCapacityWarningEmail({
      to: host.email,
      hostName: host.displayName,
      poolName: args.poolName,
      poolId: args.poolId,
      currentMembers: args.currentMembers,
      maxParticipants: args.maxParticipants,
      locale: host.locale,
    }));
    emailSent = true;
  }
  fireAndForget("audit:capacity-warning-notified", writeAuditEvent({
    actorUserId: args.actorUserId ?? undefined,
    action: "CAPACITY_WARNING_NOTIFIED",
    entityType: "Pool",
    entityId: args.poolId,
    poolId: args.poolId,
    dataJson: { currentMembers: args.currentMembers, maxParticipants: args.maxParticipants },
  }));
  return { state: "warning", emailSent };
}

interface HostNotificationTarget {
  email: string;
  displayName: string;
  locale: string;
}

async function findHostForNotification(poolId: string): Promise<HostNotificationTarget | null> {
  const member = await prisma.poolMember.findFirst({
    where: { poolId, role: { in: [...HOST_NOTIFICATION_ROLES] } },
    include: { user: { select: { email: true, displayName: true, country: true } } },
  });
  if (!member?.user?.email) return null;
  return {
    email: member.user.email,
    displayName: member.user.displayName || "Host",
    locale: countryToLocale(member.user.country),
  };
}
