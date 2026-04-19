/**
 * New Member Digest Job
 *
 * Cron job diario que se ejecuta a las 8:00 AM Colombia (13:00 UTC).
 * Envía un resumen a cada HOST con los nuevos miembros que se unieron
 * a sus pools en las últimas 24 horas.
 */

import * as cron from "node-cron";
import { processNewMemberDigest } from "../services/newMemberDigestService";

// 8:00 AM Colombia (UTC-5) = 13:00 UTC
const NEW_MEMBER_DIGEST_CRON = process.env.NEW_MEMBER_DIGEST_CRON || "0 13 * * *";

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

async function runNewMemberDigest(): Promise<void> {
  if (isRunning) {
    console.log("[NewMemberDigestJob] Skipping - previous run still in progress");
    return;
  }

  isRunning = true;

  try {
    console.log("[NewMemberDigestJob] Running daily new member digest...");
    const result = await processNewMemberDigest();

    console.log(
      `[NewMemberDigestJob] Done — ` +
        `${result.poolsProcessed} pools, ${result.emailsSent} sent, ` +
        `${result.emailsSkipped} skipped, ${result.emailsFailed} failed`
    );
  } catch (error) {
    console.error("[NewMemberDigestJob] Error:", error);
  } finally {
    isRunning = false;
  }
}

export function startNewMemberDigestJob(): void {
  if (scheduledTask) {
    console.log("[NewMemberDigestJob] Job already running");
    return;
  }

  console.log(
    `[NewMemberDigestJob] Starting with cron: ${NEW_MEMBER_DIGEST_CRON} (8:00 AM COT / 13:00 UTC)`
  );

  scheduledTask = cron.schedule(NEW_MEMBER_DIGEST_CRON, async () => {
    await runNewMemberDigest();
  });

  console.log("[NewMemberDigestJob] Scheduled — runs daily at 8:00 AM Colombia");
}

export function stopNewMemberDigestJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[NewMemberDigestJob] Job stopped");
  }
}
