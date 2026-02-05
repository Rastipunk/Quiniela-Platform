/**
 * Result Sync Job
 *
 * Cron job para sincronizar resultados automáticos desde API-Football.
 * Se ejecuta periódicamente para obtener resultados de partidos terminados.
 */

import * as cron from "node-cron";
import { getResultSyncService } from "../services/resultSync";
import { isApiFootballEnabled } from "../services/apiFootball";

// ============================================================================
// Configuration
// ============================================================================

// Cron expression for active sync (every 5 minutes)
const ACTIVE_SYNC_CRON = process.env.RESULT_SYNC_ACTIVE_CRON || "*/5 * * * *";

// Cron expression for idle sync (every 30 minutes)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _IDLE_SYNC_CRON = process.env.RESULT_SYNC_IDLE_CRON || "*/30 * * * *";

// Whether sync is enabled
const SYNC_ENABLED = process.env.RESULT_SYNC_ENABLED === "true";

// ============================================================================
// Job State
// ============================================================================

let isRunning = false;
let lastRunAt: Date | null = null;
let scheduledTask: cron.ScheduledTask | null = null;

// ============================================================================
// Job Functions
// ============================================================================

/**
 * Run the sync job
 */
async function runSyncJob(): Promise<void> {
  if (isRunning) {
    console.log("[ResultSyncJob] Job already running, skipping...");
    return;
  }

  if (!isApiFootballEnabled()) {
    console.log("[ResultSyncJob] API-Football is disabled, skipping...");
    return;
  }

  isRunning = true;
  lastRunAt = new Date();

  console.log(`[ResultSyncJob] Starting sync at ${lastRunAt.toISOString()}`);

  try {
    const syncService = getResultSyncService();

    if (!syncService.isAvailable()) {
      console.log("[ResultSyncJob] Sync service not available");
      return;
    }

    const summary = await syncService.syncAllAutoInstances();

    console.log("[ResultSyncJob] Sync completed:", {
      instancesChecked: summary.instancesChecked,
      instancesUpdated: summary.instancesUpdated,
      fixturesChecked: summary.totalFixturesChecked,
      fixturesUpdated: summary.totalFixturesUpdated,
      errors: summary.errors.length,
    });

    if (summary.errors.length > 0) {
      console.warn("[ResultSyncJob] Errors during sync:", summary.errors);
    }
  } catch (error) {
    console.error("[ResultSyncJob] Fatal error during sync:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the sync job scheduler
 */
export function startResultSyncJob(): void {
  if (!SYNC_ENABLED) {
    console.log("[ResultSyncJob] Sync job is disabled (RESULT_SYNC_ENABLED !== true)");
    return;
  }

  if (!isApiFootballEnabled()) {
    console.log("[ResultSyncJob] API-Football is disabled, not starting sync job");
    return;
  }

  // Use the active cron schedule (5 minutes by default)
  // In a more sophisticated implementation, you could switch between
  // ACTIVE_SYNC_CRON and IDLE_SYNC_CRON based on whether there are
  // matches currently being played
  const cronExpression = ACTIVE_SYNC_CRON;

  console.log(`[ResultSyncJob] Starting with schedule: ${cronExpression}`);

  scheduledTask = cron.schedule(cronExpression, async () => {
    await runSyncJob();
  });

  console.log("[ResultSyncJob] Scheduler started successfully");
}

/**
 * Stop the sync job scheduler
 */
export function stopResultSyncJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[ResultSyncJob] Scheduler stopped");
  }
}

/**
 * Manually trigger a sync (for admin use)
 */
export async function triggerManualSync(): Promise<void> {
  console.log("[ResultSyncJob] Manual sync triggered");
  await runSyncJob();
}

/**
 * Get job status
 */
export function getJobStatus(): {
  enabled: boolean;
  isRunning: boolean;
  lastRunAt: Date | null;
  isScheduled: boolean;
} {
  return {
    enabled: SYNC_ENABLED && isApiFootballEnabled(),
    isRunning,
    lastRunAt,
    isScheduled: scheduledTask !== null,
  };
}
