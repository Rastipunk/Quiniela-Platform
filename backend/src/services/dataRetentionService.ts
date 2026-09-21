/**
 * Data retention sweep (ADR-090).
 *
 * Purges operational history once it is past its window so the database
 * stops growing with every tournament. What a player needs to review a
 * finished pool is NEVER touched: Prediction rows, the CURRENT version of
 * every PoolMatchResult, structural/group results.
 *
 * What gets purged:
 *   - AuditEvent older than the audit window — except functional markers
 *     (see FUNCTIONAL_AUDIT_ACTIONS), which the code reads back.
 *   - Superseded PoolMatchResultVersion rows + the write-only
 *     externalDataJson snapshot, only for pools that are no longer ACTIVE.
 *   - DeadlineReminderLog, RECONCILER_NOOP payment events, dead sessions.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { DATA_RETENTION, MS } from "../lib/constants";
import { RECONCILER_EVENT_TYPE } from "../lib/paymentEvents";
import { GOALS90_MISSING_ACTION } from "../jobs/liveScoresJob";
import { PHASE_COMPLETION_RECAP_ACTION } from "./progressiveKnockout";
import { KNOCKOUT_UNDECIDABLE_ACTION } from "./structuralAutoPublish";
import { MATCH_FEED_SILENT_ACTION, MATCH_STALE_ALERT_ACTION } from "./scoresService/staleDetector";
import {
  FINALIZED_BUT_LIVE_ACTION,
  INCOHERENCE_ACTION,
  KICKOFF_DRIFT_ACTION,
  SLOW_PATH_ALERT_ACTION,
} from "./scoresService/gateAlerts";

/**
 * AuditEvent actions that are state, not history — never purge them.
 *   - One-time alert / email idempotency markers, looked up by
 *     (action, entityId). Deleting PHASE_COMPLETION_RECAP_SENT would re-send
 *     the phase recap email to every member.
 *   - POOL_STATUS_CHANGED: transitionFromArchived reads the last one to
 *     decide which status an un-archived pool returns to.
 */
export const FUNCTIONAL_AUDIT_ACTIONS: readonly string[] = [
  GOALS90_MISSING_ACTION,
  PHASE_COMPLETION_RECAP_ACTION,
  KNOCKOUT_UNDECIDABLE_ACTION,
  MATCH_STALE_ALERT_ACTION,
  MATCH_FEED_SILENT_ACTION,
  SLOW_PATH_ALERT_ACTION,
  FINALIZED_BUT_LIVE_ACTION,
  KICKOFF_DRIFT_ACTION,
  INCOHERENCE_ACTION,
  "POOL_STATUS_CHANGED",
];

export type RetentionSweepResult = {
  auditEvents: number;
  resultVersions: number;
  resultSnapshots: number;
  deadlineReminderLogs: number;
  reconcilerNoops: number;
  sessions: number;
};

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * MS.DAY);
}

/**
 * Runs every purge against the given client (the job passes its
 * advisory-locked transaction). Returns the number of rows affected per
 * category.
 */
export async function runDataRetentionSweep(
  db: Prisma.TransactionClient = prisma,
  now: Date = new Date(),
): Promise<RetentionSweepResult> {
  const auditCutoff = daysAgo(now, DATA_RETENTION.AUDIT_EVENT_DAYS);
  const historyCutoff = daysAgo(now, DATA_RETENTION.RESULT_HISTORY_DAYS);
  const reminderCutoff = daysAgo(now, DATA_RETENTION.DEADLINE_REMINDER_LOG_DAYS);
  const noopCutoff = daysAgo(now, DATA_RETENTION.RECONCILER_NOOP_DAYS);
  const sessionCutoff = daysAgo(now, DATA_RETENTION.DEAD_SESSION_GRACE_DAYS);

  const auditEvents = await db.auditEvent.deleteMany({
    where: {
      createdAtUtc: { lt: auditCutoff },
      action: { notIn: [...FUNCTIONAL_AUDIT_ACTIONS] },
    },
  });

  // The current version always carries the highest versionNumber, so
  // dropping superseded rows never disturbs the next-version arithmetic.
  const resultVersions = await db.$executeRaw`
    DELETE FROM "PoolMatchResultVersion" v
    USING "PoolMatchResult" r, "Pool" p
    WHERE v."resultId" = r.id
      AND r."poolId" = p.id
      AND p.status <> 'ACTIVE'
      AND r."currentVersionId" IS DISTINCT FROM v.id
      AND v."createdAtUtc" < ${historyCutoff}`;

  // externalDataJson is write-only (raw scraper payload kept for audit).
  const resultSnapshots = await db.$executeRaw`
    UPDATE "PoolMatchResultVersion" v
    SET "externalDataJson" = NULL
    FROM "PoolMatchResult" r, "Pool" p
    WHERE v."resultId" = r.id
      AND r."poolId" = p.id
      AND p.status <> 'ACTIVE'
      AND v."externalDataJson" IS NOT NULL
      AND v."createdAtUtc" < ${historyCutoff}`;

  const deadlineReminderLogs = await db.deadlineReminderLog.deleteMany({
    where: { sentAt: { lt: reminderCutoff } },
  });

  const reconcilerNoops = await db.paymentEvent.deleteMany({
    where: { eventType: RECONCILER_EVENT_TYPE.NOOP, createdAtUtc: { lt: noopCutoff } },
  });

  // A deleted row behaves exactly like a revoked one: requireAuth and the
  // refresh flow both reject a session they cannot find.
  const sessions = await db.session.deleteMany({
    where: {
      OR: [{ expiresAtUtc: { lt: sessionCutoff } }, { revokedAtUtc: { lt: sessionCutoff } }],
    },
  });

  return {
    auditEvents: auditEvents.count,
    resultVersions,
    resultSnapshots,
    deadlineReminderLogs: deadlineReminderLogs.count,
    reconcilerNoops: reconcilerNoops.count,
    sessions: sessions.count,
  };
}
