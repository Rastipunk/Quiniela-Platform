/**
 * Payment reconciliation job (F-14).
 *
 * Sweeps PoolPayment rows in `INITIATED` or `PENDING` that have been
 * outstanding past the grace period, queries Polar for the actual
 * checkout state, and transitions our row accordingly. See
 * `paymentService.reconcileStalePayment` for the per-row decision tree.
 *
 * Purpose: close the funnel-observability loop. Pre-F-14, a user that
 * abandoned Polar's checkout page left a PENDING row that lived
 * forever. The 8 stuck rows we saw in the funnel-analysis script
 * (some +28 days old) are the symptom — this job sweeps them.
 *
 * Costs:
 *   - 1 cheap SELECT per tick (index scan on `status`). 99% of ticks
 *     are empty when the platform is idle (current rhythm ~1
 *     attempt/week).
 *   - Per stale row found, 1 HTTP call to Polar (~200ms).
 *
 * Multi-instance safety: Postgres advisory lock keyed to a constant
 * 64-bit integer so only one Railway replica per tick runs the batch.
 * Releases automatically at transaction end (advisory_xact_lock).
 *
 * See `POLAR_AUDIT.md` F-14 and ADR-060.
 */

import * as cron from "node-cron";
import { prisma } from "../db";
import {
  findStalePayments,
  reconcileStalePayment,
} from "../services/paymentService";

// Every 30 minutes by default. Configurable via env var so we can tighten
// during high-volume windows (World Cup) and relax in calm periods,
// without redeploying. Same pattern as ANALYTICS_RETRY_CRON.
const RECONCILE_CRON = process.env.RECONCILE_CRON || "*/30 * * * *";

// Cap per tick to limit Polar API exposure. Even on a busy day this is
// way more than the realistic backlog — we just want a bound so a
// massive incident doesn't translate into a thousand-call burst.
const BATCH_SIZE = Number(process.env.RECONCILE_BATCH_SIZE || "50");

// Postgres advisory lock key. Distinct from capiRetryJob's
// (82636502) so the two jobs can run in parallel.
const ADVISORY_LOCK_KEY = 82636503n;

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

async function runWithClusterLock(action: () => Promise<void>): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ locked: boolean }>>(
      `SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint) AS locked`,
    );
    if (!rows[0]?.locked) {
      // Another replica is reconciling; skip quietly.
      return;
    }
    await action();
  });
}

async function runOnce(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    await runWithClusterLock(async () => {
      // Early exit when nothing is pending — keeps the average tick
      // close to zero work when the platform is idle.
      const stale = await findStalePayments(BATCH_SIZE);
      if (stale.length === 0) return;

      console.log(`[PaymentReconciler] Found ${stale.length} stale payment(s) to check`);

      const outcomes: Record<string, number> = {};
      for (const { id } of stale) {
        try {
          const result = await reconcileStalePayment(id);
          outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
          if (result.outcome !== "NOOP") {
            console.log(
              `[PaymentReconciler] ${id}: ${result.previousStatus} → ${result.nextStatus ?? "(no transition)"} (${result.outcome})`,
            );
          }
        } catch (err) {
          // Individual row failures must not abort the whole tick.
          console.error(
            `[PaymentReconciler] Error reconciling ${id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      const summary = Object.entries(outcomes)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      console.log(`[PaymentReconciler] Batch done: ${summary}`);
    });
  } finally {
    isRunning = false;
  }
}

export function startPaymentReconcileJob(): void {
  if (scheduledTask) return;
  console.log(`[PaymentReconciler] Starting with cron: ${RECONCILE_CRON}`);
  scheduledTask = cron.schedule(RECONCILE_CRON, runOnce);
}

export function stopPaymentReconcileJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

// Exported for tests + manual one-shot runs (e.g. backfill scripts).
export { runOnce as runReconcileOnce };
