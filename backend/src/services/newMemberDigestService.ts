/**
 * Daily digests for pool hosts.
 *
 * Two independent flows run on the same cron tick. They are decoupled by
 * design: a host with both new joiners AND pending requests gets two
 * emails (different subject, different action) — Gmail/Outlook treat them
 * as separate threads.
 *
 *   1) processNewMemberDigest()
 *      Finds pools where a PoolMember went ACTIVE in the last 24h and
 *      sends a "X joined your pool" email. Behaviour preserved from the
 *      original implementation; the only change is filtering pools by
 *      status (we now skip COMPLETED + ARCHIVED).
 *
 *   2) processPendingApprovalDigest()
 *      Finds pools that have ANY PoolMember in PENDING_APPROVAL right
 *      now (accumulated, not 24h windowed) and emails the host. Throttled
 *      with a 7-day-streak-with-reset rule:
 *        • If the pending-set CHANGED (new arrival or one resolved) since
 *          the last tick → reset and send.
 *        • If the pending-set is identical and the streak is < 7 days
 *          → keep sending daily.
 *        • If identical and streak ≥ 7 days → stay silent until the set
 *          changes again.
 *      The streak is tracked on Pool.pendingDigestPendingHash and
 *      Pool.pendingDigestStreakStartAt.
 */

import * as crypto from "crypto";
import { prisma } from "../db";
import {
  sendNewMemberDigestEmail,
  sendPendingApprovalDigestEmail,
} from "../lib/email";
import { resolveUserLocale } from "../lib/constants";

// Pools in these states never receive any digest. ARCHIVED hides them
// completely; COMPLETED means picks no longer matter so chasing approvals
// is noise, not signal.
const ELIGIBLE_POOL_STATUSES = ["DRAFT", "ACTIVE"] as const;
const PENDING_STREAK_MAX_DAYS = 7;

export interface DigestResult {
  poolsProcessed: number;
  emailsSent: number;
  emailsSkipped: number;
  emailsFailed: number;
}

// ────────────────────────────────────────────────────────────────────────
// Flow 1 — New active member digest (24h window)
// ────────────────────────────────────────────────────────────────────────

export async function processNewMemberDigest(): Promise<DigestResult> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentMembers = await prisma.poolMember.findMany({
    where: {
      joinedAtUtc: { gte: cutoff },
      status: "ACTIVE",
      role: "PLAYER",
    },
    select: {
      poolId: true,
      user: { select: { displayName: true } },
    },
  });

  if (recentMembers.length === 0) {
    return { poolsProcessed: 0, emailsSent: 0, emailsSkipped: 0, emailsFailed: 0 };
  }

  const byPool = new Map<string, { name: string }[]>();
  for (const member of recentMembers) {
    const list = byPool.get(member.poolId) ?? [];
    list.push({ name: member.user.displayName });
    byPool.set(member.poolId, list);
  }

  let emailsSent = 0;
  let emailsSkipped = 0;
  let emailsFailed = 0;

  for (const [poolId, newMembers] of byPool) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { name: true, status: true, maxParticipants: true },
    });
    if (!pool || !ELIGIBLE_POOL_STATUSES.includes(pool.status as typeof ELIGIBLE_POOL_STATUSES[number])) {
      emailsSkipped++;
      continue;
    }

    const hosts = await prisma.poolMember.findMany({
      where: {
        poolId,
        role: { in: ["HOST", "CORPORATE_HOST"] },
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            country: true,
            emailNotificationsEnabled: true,
            emailNewMemberDigest: true,
          },
        },
      },
    });

    for (const host of hosts) {
      if (!host.user.emailNotificationsEnabled || !host.user.emailNewMemberDigest) {
        emailsSkipped++;
        continue;
      }

      const totalMembers = await prisma.poolMember.count({
        where: { poolId, status: "ACTIVE" },
      });

      const result = await sendNewMemberDigestEmail({
        to: host.user.email,
        hostName: host.user.displayName,
        poolName: pool.name,
        poolId,
        newMembers,
        currentTotal: totalMembers,
        locale: resolveUserLocale(host.user),
      });

      if (result.success) emailsSent++;
      else emailsFailed++;
    }
  }

  return {
    poolsProcessed: byPool.size,
    emailsSent,
    emailsSkipped,
    emailsFailed,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Flow 2 — Pending approval digest (accumulated + 7-day streak throttle)
// ────────────────────────────────────────────────────────────────────────

/**
 * Stable fingerprint of the current PENDING_APPROVAL set on a pool.
 * Sort the IDs so adding/removing a member produces a different hash
 * but ordering noise (insert order, query plan) doesn't.
 */
function hashPendingSet(memberIds: string[]): string {
  const sorted = [...memberIds].sort();
  return crypto.createHash("sha1").update(sorted.join(",")).digest("hex");
}

function streakDaysBetween(start: Date, now: Date): number {
  const ms = now.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export async function processPendingApprovalDigest(): Promise<DigestResult> {
  // Pull every pending member in one go. We'll group by pool below.
  const pending = await prisma.poolMember.findMany({
    where: { status: "PENDING_APPROVAL", role: "PLAYER" },
    select: {
      id: true,
      poolId: true,
      user: { select: { displayName: true } },
    },
  });

  if (pending.length === 0) {
    return { poolsProcessed: 0, emailsSent: 0, emailsSkipped: 0, emailsFailed: 0 };
  }

  type PendingEntry = { memberId: string; name: string };
  const byPool = new Map<string, PendingEntry[]>();
  for (const m of pending) {
    const list = byPool.get(m.poolId) ?? [];
    list.push({ memberId: m.id, name: m.user.displayName });
    byPool.set(m.poolId, list);
  }

  let emailsSent = 0;
  let emailsSkipped = 0;
  let emailsFailed = 0;
  const now = new Date();

  for (const [poolId, entries] of byPool) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: {
        name: true,
        status: true,
        pendingDigestPendingHash: true,
        pendingDigestStreakStartAt: true,
      },
    });
    if (!pool || !ELIGIBLE_POOL_STATUSES.includes(pool.status as typeof ELIGIBLE_POOL_STATUSES[number])) {
      emailsSkipped++;
      continue;
    }

    const currentHash = hashPendingSet(entries.map((e) => e.memberId));
    const sameSet = pool.pendingDigestPendingHash === currentHash;

    // Throttle gate. We ONLY persist the streak fields after we know we're
    // sending or deliberately skipping; that way a transient "skipped because
    // host opted out" doesn't poison the streak window.
    let shouldSend: boolean;
    let nextStreakStart: Date;
    if (!sameSet) {
      // Pending set changed (new arrival, or one was resolved between ticks).
      // Reset the streak and send.
      shouldSend = true;
      nextStreakStart = now;
    } else {
      // Identical to last tick. Send while we're within the 7-day cap.
      const streakStart = pool.pendingDigestStreakStartAt ?? now;
      const days = streakDaysBetween(streakStart, now);
      shouldSend = days < PENDING_STREAK_MAX_DAYS;
      nextStreakStart = streakStart;
    }

    if (!shouldSend) {
      // Stay silent. We deliberately do NOT touch the throttle fields here:
      // streakStart stays anchored to the original first-send so we don't
      // restart the silence window every tick. The host won't be re-emailed
      // until the pending set changes (which will hit the !sameSet branch
      // and reset everything cleanly).
      emailsSkipped++;
      continue;
    }

    // Find the host(s) and email each one (a pool can technically have
    // both HOST and CORPORATE_HOST in edge cases — we email both).
    const hosts = await prisma.poolMember.findMany({
      where: {
        poolId,
        role: { in: ["HOST", "CORPORATE_HOST"] },
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            country: true,
            emailNotificationsEnabled: true,
            emailNewMemberDigest: true,
          },
        },
      },
    });

    let sentForThisPool = false;
    for (const host of hosts) {
      // Reusing the new-member-digest opt-out by design: a host who muted
      // "daily summary about my pool" doesn't want either flavour of it.
      if (!host.user.emailNotificationsEnabled || !host.user.emailNewMemberDigest) {
        emailsSkipped++;
        continue;
      }

      const result = await sendPendingApprovalDigestEmail({
        to: host.user.email,
        hostName: host.user.displayName,
        poolName: pool.name,
        poolId,
        pendingMembers: entries.map((e) => ({ name: e.name })),
        locale: resolveUserLocale(host.user),
      });

      if (result.success) {
        emailsSent++;
        sentForThisPool = true;
      } else {
        emailsFailed++;
      }
    }

    // Persist the throttle state if we made at least one delivery attempt
    // for this pool. We update the hash + streakStart so the next tick can
    // compare against today's set.
    if (sentForThisPool) {
      await prisma.pool.update({
        where: { id: poolId },
        data: {
          pendingDigestPendingHash: currentHash,
          pendingDigestStreakStartAt: nextStreakStart,
        },
      });
    }
  }

  return {
    poolsProcessed: byPool.size,
    emailsSent,
    emailsSkipped,
    emailsFailed,
  };
}
