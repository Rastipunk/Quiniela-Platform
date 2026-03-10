/**
 * Deadline Reminder Job
 *
 * Cron job diario que se ejecuta a las 7:00 AM Colombia (12:00 UTC).
 * Revisa si hay partidos con deadline en las próximas 24 horas y envía
 * recordatorios a usuarios que aún no han hecho sus picks.
 *
 * El servicio usa DeadlineReminderLog para no enviar duplicados.
 */

import * as cron from "node-cron";
import { processDeadlineReminders } from "../services/deadlineReminderService";

// ============================================================================
// Configuration
// ============================================================================

// 7:00 AM Colombia (UTC-5) = 12:00 UTC
const DEADLINE_REMINDER_CRON = process.env.DEADLINE_REMINDER_CRON || "0 12 * * *";

// ============================================================================
// Job State
// ============================================================================

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;
let lastRunAt: Date | null = null;

// ============================================================================
// Job Implementation
// ============================================================================

async function runDeadlineReminders(): Promise<void> {
  if (isRunning) {
    console.log("[DeadlineReminderJob] Skipping - previous run still in progress");
    return;
  }

  isRunning = true;
  lastRunAt = new Date();

  try {
    console.log("[DeadlineReminderJob] Running daily deadline reminder check...");
    const result = await processDeadlineReminders(24, false);

    if (result.success) {
      console.log(
        `[DeadlineReminderJob] Done — ` +
          `${result.emailsSent} sent, ${result.emailsSkipped} skipped, ${result.emailsFailed} failed`
      );
    } else {
      console.log(
        `[DeadlineReminderJob] Skipped — ${result.errors.join(", ")}`
      );
    }
  } catch (error) {
    console.error("[DeadlineReminderJob] Error:", error);
  } finally {
    isRunning = false;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start the deadline reminder job
 */
export function startDeadlineReminderJob(): void {
  if (scheduledTask) {
    console.log("[DeadlineReminderJob] Job already running");
    return;
  }

  console.log(
    `[DeadlineReminderJob] Starting with cron: ${DEADLINE_REMINDER_CRON} (7:00 AM COT / 12:00 UTC)`
  );

  scheduledTask = cron.schedule(DEADLINE_REMINDER_CRON, async () => {
    await runDeadlineReminders();
  });

  console.log("[DeadlineReminderJob] Scheduled — runs daily at 7:00 AM Colombia");
}

/**
 * Stop the deadline reminder job
 */
export function stopDeadlineReminderJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[DeadlineReminderJob] Job stopped");
  }
}
