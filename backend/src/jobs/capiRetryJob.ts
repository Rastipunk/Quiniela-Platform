/**
 * Meta CAPI retry job.
 *
 * Drains the `FailedCapiEvent` dead-letter queue. Events that exhausted
 * their in-process retries inside `sendCapiEvent()` land in this table;
 * this job wakes up periodically, picks the ones whose `nextRetryAt` has
 * passed, and re-attempts delivery with the SAME `event_id` so Meta
 * deduplicates against the original browser pixel emission.
 *
 * Idempotent with respect to the queue: a job instance processes at most
 * one batch at a time, and a single row can be updated by only one job
 * instance because updates go through the unique `id` key.
 */

import * as cron from "node-cron";
import { retryFailedCapiEventsBatch } from "../lib/metaCapi";

// Every 5 minutes by default. Frequent enough that transient failures
// recover quickly; sparse enough that a DLQ full of permanent 4xx doesn't
// hammer the Graph API.
const CAPI_RETRY_CRON = process.env.CAPI_RETRY_CRON || "*/5 * * * *";
const BATCH_SIZE = Number(process.env.CAPI_RETRY_BATCH_SIZE || 20);

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
    const { processed, resolved } = await retryFailedCapiEventsBatch(BATCH_SIZE);
    if (processed > 0) {
      console.log(
        `[CapiRetryJob] processed=${processed} resolved=${resolved} pending=${processed - resolved}`,
      );
    }
  } catch (err) {
    console.error("[CapiRetryJob] error:", err instanceof Error ? err.message : String(err));
  } finally {
    isRunning = false;
  }
}

export function startCapiRetryJob(): void {
  if (scheduledTask) return;
  console.log(`[CapiRetryJob] Starting with cron: ${CAPI_RETRY_CRON}`);
  scheduledTask = cron.schedule(CAPI_RETRY_CRON, runOnce);
}

export function stopCapiRetryJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
