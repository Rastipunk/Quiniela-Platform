/**
 * Data retention job (ADR-090).
 *
 * Daily sweep that purges operational history past its retention window —
 * see services/dataRetentionService.ts for exactly what is (and is never)
 * deleted. Same shape as accountReceivableExpiryJob: cron-driven,
 * advisory-lock-guarded for multi-instance safety.
 */

import * as cron from "node-cron";
import { prisma } from "../db";
import { DATA_RETENTION } from "../lib/constants";
import { runDataRetentionSweep } from "../services/dataRetentionService";

// Default once a day at 08:15 UTC (03:15 Bogotá) — outside any match window.
const RETENTION_CRON = process.env.DATA_RETENTION_CRON || "15 8 * * *";

// Distinct from the other cluster-locked jobs (82636502–82636506).
const ADVISORY_LOCK_KEY = 82636507n;

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

async function runOnce(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRawUnsafe<Array<{ locked: boolean }>>(
          `SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint) AS locked`,
        );
        if (!rows[0]?.locked) return;

        const result = await runDataRetentionSweep(tx);
        const total = Object.values(result).reduce((sum, n) => sum + n, 0);
        if (total > 0) {
          console.log(`[DataRetention] Sweep done: ${JSON.stringify(result)}`);
        }
      },
      { timeout: DATA_RETENTION.SWEEP_TX_TIMEOUT_MS },
    );
  } catch (err) {
    console.error(
      "[DataRetention] Sweep failed:",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    isRunning = false;
  }
}

export function startDataRetentionJob(): void {
  if (scheduledTask) return;
  console.log(`[DataRetention] Starting with cron: ${RETENTION_CRON}`);
  scheduledTask = cron.schedule(RETENTION_CRON, runOnce);
}

export function stopDataRetentionJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

// Exported for tests + manual one-shot runs.
export { runOnce as runDataRetentionOnce };
