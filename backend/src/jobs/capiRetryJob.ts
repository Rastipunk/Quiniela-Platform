/**
 * Analytics DLQ drain job.
 *
 * Processes failed deliveries queued in `FailedAnalyticsEvent` for every
 * configured sink (Meta CAPI, GA4 Measurement Protocol). Each sink
 * exposes its own retry function that filters the queue by `provider`
 * and updates rows idempotently.
 *
 * Runs a single batch per tick for each sink. If both sinks are configured
 * (typical in production) the worker fans out but serialises per-sink so
 * a slow Meta endpoint can't stall GA4 retries, and vice versa.
 */

import * as cron from "node-cron";
import { prisma } from "../db";
import { retryFailedCapiEventsBatch } from "../lib/metaCapi";
import { retryFailedGa4EventsBatch } from "../lib/ga4";

// Every 5 minutes by default. Frequent enough that transient failures
// recover quickly; sparse enough that a DLQ full of permanent 4xx doesn't
// hammer the downstream APIs.
const RETRY_CRON = process.env.ANALYTICS_RETRY_CRON || process.env.CAPI_RETRY_CRON || "*/5 * * * *";
const BATCH_SIZE = Number(process.env.ANALYTICS_RETRY_BATCH_SIZE || process.env.CAPI_RETRY_BATCH_SIZE || 20);

// Postgres advisory lock key. Arbitrary 64-bit integer; any number works
// as long as it's consistent across all instances of this codebase so
// that only ONE Railway replica drains the queue per tick.
// `pg_try_advisory_lock` is session-scoped — released automatically when
// the connection closes, which matches the life of the query in Prisma.
const ADVISORY_LOCK_KEY = 82636502n;

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

/**
 * Acquire a cluster-wide lock for the duration of a single drain.
 * Returns false when another replica already holds it so this tick
 * no-ops. We use `pg_try_advisory_xact_lock` inside a transaction so
 * the lock releases automatically at COMMIT / ROLLBACK with no
 * explicit cleanup needed.
 */
async function runWithClusterLock(action: () => Promise<void>): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ locked: boolean }>>(
      `SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint) AS locked`,
    );
    if (!rows[0]?.locked) {
      // Another replica is draining; skip quietly.
      return;
    }
    await action();
  });
}

/**
 * Reclaim DLQ storage: delete rows that resolved (or permanently
 * failed) more than 30 days ago. Forensics rarely need older entries,
 * and an unbounded table slows every retry query once volume grows.
 */
const DLQ_RETENTION_DAYS = 30;
async function purgeOldResolvedRows(): Promise<void> {
  const cutoff = new Date(Date.now() - DLQ_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.failedAnalyticsEvent.deleteMany({
    where: { resolvedAt: { lte: cutoff } },
  });
  if (count > 0) {
    console.log(`[AnalyticsRetryJob] purged ${count} resolved DLQ rows older than ${DLQ_RETENTION_DAYS}d`);
  }
}

async function runOnce(): Promise<void> {
  if (isRunning) {
    // Skip overlapping runs — better to wait for the next tick than to
    // risk two jobs updating the same row concurrently.
    return;
  }
  isRunning = true;
  try {
    await runWithClusterLock(async () => {
      // Opportunistic housekeeping. Runs inside the same lock so we
      // never delete rows another replica is trying to retry.
      try {
        await purgeOldResolvedRows();
      } catch (err) {
        console.error("[AnalyticsRetryJob] purge error:", err instanceof Error ? err.message : String(err));
      }
      // Run sinks in parallel; each has its own provider filter so there is
      // no contention on the same rows.
      const [capi, ga4] = await Promise.allSettled([
        retryFailedCapiEventsBatch(BATCH_SIZE),
        retryFailedGa4EventsBatch(BATCH_SIZE),
      ]);
      const capiResult = capi.status === "fulfilled" ? capi.value : { processed: 0, resolved: 0 };
      const ga4Result = ga4.status === "fulfilled" ? ga4.value : { processed: 0, resolved: 0 };
      const total = capiResult.processed + ga4Result.processed;
      if (total > 0) {
        console.log(
          `[AnalyticsRetryJob] capi(processed=${capiResult.processed} resolved=${capiResult.resolved}) ` +
            `ga4(processed=${ga4Result.processed} resolved=${ga4Result.resolved})`,
        );
      }
      if (capi.status === "rejected") {
        console.error("[AnalyticsRetryJob] capi error:", capi.reason);
      }
      if (ga4.status === "rejected") {
        console.error("[AnalyticsRetryJob] ga4 error:", ga4.reason);
      }
    });
  } finally {
    isRunning = false;
  }
}

export function startCapiRetryJob(): void {
  if (scheduledTask) return;
  console.log(`[AnalyticsRetryJob] Starting with cron: ${RETRY_CRON}`);
  scheduledTask = cron.schedule(RETRY_CRON, runOnce);
}

export function stopCapiRetryJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
