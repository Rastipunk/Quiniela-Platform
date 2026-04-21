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
import { retryFailedCapiEventsBatch } from "../lib/metaCapi";
import { retryFailedGa4EventsBatch } from "../lib/ga4";

// Every 5 minutes by default. Frequent enough that transient failures
// recover quickly; sparse enough that a DLQ full of permanent 4xx doesn't
// hammer the downstream APIs.
const RETRY_CRON = process.env.ANALYTICS_RETRY_CRON || process.env.CAPI_RETRY_CRON || "*/5 * * * *";
const BATCH_SIZE = Number(process.env.ANALYTICS_RETRY_BATCH_SIZE || process.env.CAPI_RETRY_BATCH_SIZE || 20);

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

async function runOnce(): Promise<void> {
  if (isRunning) {
    // Skip overlapping runs — better to wait for the next tick than to
    // risk two jobs updating the same row concurrently.
    return;
  }
  isRunning = true;
  try {
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
