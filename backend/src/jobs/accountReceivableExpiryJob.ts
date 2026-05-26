/**
 * Account-Receivable expiry sweep job.
 *
 * Sweeps PENDING AccountReceivable rows whose validUntil is in the past
 * and flips them to EXPIRED. Mirrors paymentReconcileJob.ts shape:
 * cron-driven, advisory-lock-guarded for multi-instance safety, cheap
 * indexed query (the @@index([status, validUntil]) on the model is
 * specifically for this sweep).
 *
 * Why only PENDING:
 *   - REDEEMED rows are owned by an in-flight PoolPayment — its
 *     reconciler decides what happens (release back to PENDING on
 *     expire/abandon, or stay REDEEMED → PAID on completion).
 *   - PAID / EXPIRED / CANCELLED are terminal.
 *
 * Spec: SALES_AUDIT.md §6 (lifecycle), §11.* (locked decisions).
 * SALES_IMPLEMENTATION.md commit 8.
 */

import * as cron from "node-cron";
import { prisma } from "../db";

// Default once an hour. validUntil has day-granularity (@db.Date), so
// sub-hour ticks would be wasted; tighter cadence buys nothing.
const EXPIRY_CRON = process.env.CC_EXPIRY_CRON || "5 * * * *";

// Cap per tick. Even on a busy month the realistic backlog is tiny;
// the cap exists so a future bug that floods the table doesn't trigger
// an unbounded transaction.
const BATCH_SIZE = Number(process.env.CC_EXPIRY_BATCH_SIZE || "100");

// Distinct from paymentReconcileJob (82636503) and capiRetryJob
// (82636502) so the three jobs can run concurrently on the same
// replica without blocking each other.
const ADVISORY_LOCK_KEY = 82636504n;

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

async function runWithClusterLock(action: () => Promise<void>): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ locked: boolean }>>(
      `SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint) AS locked`,
    );
    if (!rows[0]?.locked) return;
    await action();
  });
}

// validUntil is stored as @db.Date (no time). A row is expired once
// the calendar day after validUntil has begun (UTC). Cutoff = start of
// today UTC; rows with validUntil < cutoff are past.
function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function runOnce(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    await runWithClusterLock(async () => {
      const cutoff = startOfTodayUtc();
      const stale = await prisma.accountReceivable.findMany({
        where: { status: "PENDING", validUntil: { lt: cutoff } },
        select: { id: true, consecutive: true },
        orderBy: { validUntil: "asc" },
        take: BATCH_SIZE,
      });
      if (stale.length === 0) return;

      console.log(`[CcExpiry] Found ${stale.length} PENDING CC(s) past validUntil`);

      // updateMany scoped to the batch ids + status=PENDING so we
      // don't race a concurrent manual mark-paid: if the admin
      // flipped a row to PAID between the SELECT and the UPDATE, the
      // updateMany skips it harmlessly (count reflects the diff).
      const result = await prisma.accountReceivable.updateMany({
        where: {
          id: { in: stale.map((r) => r.id) },
          status: "PENDING",
        },
        data: { status: "EXPIRED" },
      });

      console.log(`[CcExpiry] Batch done: ${result.count} transitioned to EXPIRED`);
    });
  } catch (err) {
    console.error(
      "[CcExpiry] Tick failed:",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    isRunning = false;
  }
}

export function startAccountReceivableExpiryJob(): void {
  if (scheduledTask) return;
  console.log(`[CcExpiry] Starting with cron: ${EXPIRY_CRON}`);
  scheduledTask = cron.schedule(EXPIRY_CRON, runOnce);
}

export function stopAccountReceivableExpiryJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

// Exported for tests + manual one-shot runs.
export { runOnce as runCcExpirySweepOnce };
