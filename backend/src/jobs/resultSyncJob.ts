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

// NOTE: startResultSyncJob/stopResultSyncJob/triggerManualSync were removed
// as dead code. This job is a legacy fallback — SmartSync + liveScoresJob
// are the primary sync mechanisms. Only getJobStatus() remains for admin UI.

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
