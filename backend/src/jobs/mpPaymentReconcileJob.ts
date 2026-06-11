/**
 * Mercado Pago payment reconciliation job.
 *
 * Mirror of `paymentReconcileJob` (Polar) scoped to PoolPayment rows
 * with `mpPreferenceId IS NOT NULL`. Sweeps INITIATED/PENDING rows
 * past the grace period, queries MP for the canonical state, and
 * transitions the row accordingly via
 * `paymentService.reconcileStaleMpPayment`.
 *
 * Purpose: close the MP success-path observability loop. Before this
 * job landed, an IPN delivery that hit our 5xx during a deploy and
 * fell out of MP's retry budget left the PoolPayment row stuck in
 * PENDING forever — capacity never expanded, receipt never sent,
 * audit row never written. The 7 stuck rows identified in the
 * forensic audit (oldest 23 days, 2 paid for $228,500 COP each) are
 * the symptom.
 *
 * Costs per idle tick:
 *   - 1 cheap SELECT (covered by the compound index
 *     `PoolPayment_status_createdAtUtc_idx`).
 *   - 0 MP API calls when the result set is empty (early exit).
 *
 * Costs per non-idle tick:
 *   - 1 MP getPayment per stuck row (~200ms), plus a
 *     searchPaymentByExternalReference for legacy rows whose
 *     `mpPaymentId` is still NULL.
 *
 * Multi-instance safety: Postgres advisory lock with a key distinct
 * from the Polar reconciler's (82636503) and the CAPI retry job's
 * (82636502) so all three can run in parallel without blocking each
 * other. Releases at transaction end (`pg_try_advisory_xact_lock`).
 *
 * See PAYMENTS_PARITY_AUDIT.md §3 and PAYMENTS_PARITY_IMPLEMENTATION.md
 * commit 5.
 */

import * as cron from "node-cron";
import { prisma } from "../db";
import { recordHeartbeat } from "../lib/cronHeartbeat";
import {
  findStaleMpPayments,
  reconcileStaleMpPayment,
} from "../services/paymentService";

// Every 30 minutes by default. Same cadence as the Polar reconciler so
// the two stay in sync operationally. Configurable via env var so we
// can tighten during high-volume windows or relax in calm periods
// without redeploying.
const MP_RECONCILE_CRON = process.env.MP_RECONCILE_CRON || "*/30 * * * *";

// Cap per tick to limit MP API exposure. Realistic backlog is well
// under 50; the cap is a guardrail against a flood scenario translating
// into a thousand-call burst.
const MP_RECONCILE_BATCH_SIZE = Number(
  process.env.MP_RECONCILE_BATCH_SIZE || "50",
);

// Postgres advisory lock key. Distinct from paymentReconcileJob's
// (82636503) and capiRetryJob's (82636502) so the three jobs can run
// concurrently across replicas without blocking each other.
const ADVISORY_LOCK_KEY = 82636506n;

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

async function runWithClusterLock(action: () => Promise<void>): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ locked: boolean }>>(
      `SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint) AS locked`,
    );
    if (!rows[0]?.locked) {
      // Another replica is reconciling MP; skip quietly.
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
      const stale = await findStaleMpPayments(MP_RECONCILE_BATCH_SIZE);
      if (stale.length === 0) return;

      console.log(
        `[MpReconciler] Found ${stale.length} stale MP payment(s) to check`,
      );

      const outcomes: Record<string, number> = {};
      for (const { id } of stale) {
        try {
          const result = await reconcileStaleMpPayment(id);
          outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
          if (result.outcome !== "NOOP") {
            console.log(
              `[MpReconciler] ${id}: ${result.previousStatus} → ${result.nextStatus ?? "(no transition)"} (${result.outcome})`,
            );
          }
        } catch (err) {
          console.error(
            `[MpReconciler] Error reconciling ${id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      const summary = Object.entries(outcomes)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      console.log(`[MpReconciler] Batch done: ${summary}`);
      recordHeartbeat("MpPaymentReconcileJob");
    });
  } finally {
    isRunning = false;
  }
}

export function startMpPaymentReconcileJob(): void {
  if (scheduledTask) return;
  console.log(`[MpReconciler] Starting with cron: ${MP_RECONCILE_CRON}`);
  scheduledTask = cron.schedule(MP_RECONCILE_CRON, runOnce);
}

export function stopMpPaymentReconcileJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

// Exported for tests + manual one-shot runs (e.g. backfill scripts).
export { runOnce as runMpReconcileOnce };
