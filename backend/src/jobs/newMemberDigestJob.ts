/**
 * Daily host digest job.
 *
 * On each cron tick fires TWO independent flows:
 *
 *   • processNewMemberDigest()         → "X people joined your pool"
 *   • processPendingApprovalDigest()   → "X people are waiting for your
 *                                          approval" (with 7-day-streak
 *                                          throttle, see service file)
 *
 * Default schedule is 18:00 UTC = 1 PM Colombia / 7-8 PM CET. Picked so
 * Colombian hosts (the bulk of the user base) get it during business
 * hours and EU hosts (Vienna, Luxembourg, Madrid) still receive it
 * before the dinner-time inbox dump.
 */

import * as cron from "node-cron";
import {
  processNewMemberDigest,
  processPendingApprovalDigest,
} from "../services/newMemberDigestService";

const DAILY_DIGEST_CRON = process.env.DAILY_DIGEST_CRON
  || process.env.NEW_MEMBER_DIGEST_CRON  // legacy env var name kept for one release
  || "0 18 * * *";

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

async function runDailyDigests(): Promise<void> {
  if (isRunning) {
    console.log("[DailyDigestJob] Skipping - previous run still in progress");
    return;
  }

  isRunning = true;
  try {
    console.log("[DailyDigestJob] Running new-member digest…");
    const newRes = await processNewMemberDigest();
    console.log(
      `[DailyDigestJob] new-member: ${newRes.poolsProcessed} pools, ` +
      `${newRes.emailsSent} sent, ${newRes.emailsSkipped} skipped, ${newRes.emailsFailed} failed`
    );

    console.log("[DailyDigestJob] Running pending-approval digest…");
    const pendRes = await processPendingApprovalDigest();
    console.log(
      `[DailyDigestJob] pending-approval: ${pendRes.poolsProcessed} pools, ` +
      `${pendRes.emailsSent} sent, ${pendRes.emailsSkipped} skipped, ${pendRes.emailsFailed} failed`
    );
  } catch (error) {
    console.error("[DailyDigestJob] Error:", error);
  } finally {
    isRunning = false;
  }
}

export function startNewMemberDigestJob(): void {
  if (scheduledTask) {
    console.log("[DailyDigestJob] Job already running");
    return;
  }

  console.log(
    `[DailyDigestJob] Starting with cron: ${DAILY_DIGEST_CRON} (default 18:00 UTC = 1 PM Colombia)`
  );

  scheduledTask = cron.schedule(DAILY_DIGEST_CRON, async () => {
    await runDailyDigests();
  });

  console.log("[DailyDigestJob] Scheduled");
}

export function stopNewMemberDigestJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[DailyDigestJob] Job stopped");
  }
}
