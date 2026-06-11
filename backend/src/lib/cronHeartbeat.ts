/**
 * In-memory heartbeat ledger for cron jobs.
 *
 * Each job calls recordHeartbeat() at the END of every successful run.
 * The platform-health service reads the ledger and flags jobs whose
 * last successful run is older than (intervalMin × overdueMultiplier).
 * In-memory by design: a heartbeat that survives a backend restart
 * isn't a heartbeat, it's stale data — restart resets and the next
 * run repopulates within one interval.
 */

const heartbeats = new Map<string, number>();

export function recordHeartbeat(jobName: string): void {
  heartbeats.set(jobName, Date.now());
}

export function getHeartbeat(jobName: string): number | null {
  return heartbeats.get(jobName) ?? null;
}

/** Snapshot of every known job's last-success timestamp (epoch ms). */
export function getAllHeartbeats(): Record<string, number> {
  return Object.fromEntries(heartbeats.entries());
}

/**
 * The set of jobs the health monitor tracks. Each entry encodes the
 * expected interval so a missed run flags consistently regardless of
 * the cron's own implementation detail.
 *
 * Only critical jobs are listed — a missed analyticsRetry or capiRetry
 * tick isn't worth waking the admin in the middle of the night.
 */
export const MONITORED_JOBS: ReadonlyArray<{
  name: string;
  intervalMin: number;
  /** A job is "overdue" once `now - lastBeat > intervalMin × this`. */
  overdueMultiplier: number;
}> = [
  { name: "FixtureTrackingJob",      intervalMin: 60,  overdueMultiplier: 2.5 },
  { name: "DeadlineReminderJob",     intervalMin: 1440, overdueMultiplier: 1.5 }, // daily at 12 UTC
  { name: "LiveScoresJob",           intervalMin: 1,    overdueMultiplier: 5 },
  { name: "MpPaymentReconcileJob",   intervalMin: 30,   overdueMultiplier: 3 },
  { name: "PaymentReconcileJob",     intervalMin: 30,   overdueMultiplier: 3 },
  { name: "TrackStatusCheckerJob",   intervalMin: 1,    overdueMultiplier: 5 },
];
