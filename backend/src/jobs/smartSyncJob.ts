/**
 * Smart Sync Job
 *
 * Optimized cron job that only checks matches at strategic times:
 * - 5 minutes after kickoff (to verify match started)
 * - 110 minutes after kickoff (to check if finished)
 * - Every 5 minutes for matches that should have finished but haven't
 *
 * This runs every minute but only makes API calls for matches that need checking.
 */

import * as cron from "node-cron";
import { getSmartSyncService } from "../services/smartSync";
import { isApiFootballEnabled } from "../services/apiFootball";
import { prisma } from "../db";

// ============================================================================
// Configuration
// ============================================================================

// Run every minute to check if any matches need syncing
const SMART_SYNC_CRON = process.env.SMART_SYNC_CRON || "* * * * *";

// Whether smart sync is enabled
const SMART_SYNC_ENABLED = process.env.SMART_SYNC_ENABLED === "true" ||
                           process.env.RESULT_SYNC_ENABLED === "true";

// ============================================================================
// Job State
// ============================================================================

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;
let lastRunAt: Date | null = null;

// ============================================================================
// Job Implementation
// ============================================================================

async function runSmartSync(): Promise<void> {
  if (isRunning) {
    console.log("[SmartSyncJob] Skipping - previous run still in progress");
    return;
  }

  isRunning = true;
  lastRunAt = new Date();

  try {
    const smartSyncService = getSmartSyncService();

    if (!smartSyncService.isAvailable()) {
      console.log("[SmartSyncJob] API-Football not available, skipping");
      return;
    }

    // Get all AUTO instances with sync enabled
    const instances = await prisma.tournamentInstance.findMany({
      where: {
        resultSourceMode: "AUTO",
        syncEnabled: true,
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      select: { id: true, name: true },
    });

    if (instances.length === 0) {
      return;
    }

    for (const instance of instances) {
      try {
        const result = await smartSyncService.processMatchesNeedingSync(instance.id);

        if (result.matchesProcessed > 0) {
          console.log(
            `[SmartSyncJob] ${instance.name}: processed ${result.matchesProcessed} matches ` +
              `(${result.matchesCompleted} completed, ${result.matchesStillPlaying} still playing)`
          );
        }

        if (result.errors.length > 0) {
          console.warn(
            `[SmartSyncJob] ${instance.name}: ${result.errors.length} errors occurred`
          );
        }
      } catch (error) {
        console.error(`[SmartSyncJob] Error processing instance ${instance.name}:`, error);
      }
    }
  } catch (error) {
    console.error("[SmartSyncJob] Error:", error);
  } finally {
    isRunning = false;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start the smart sync job
 */
export function startSmartSyncJob(): void {
  if (!SMART_SYNC_ENABLED) {
    console.log("[SmartSyncJob] Smart sync disabled (SMART_SYNC_ENABLED/RESULT_SYNC_ENABLED != true)");
    return;
  }

  if (!isApiFootballEnabled()) {
    console.log("[SmartSyncJob] API-Football not enabled, skipping job start");
    return;
  }

  if (scheduledTask) {
    console.log("[SmartSyncJob] Job already running");
    return;
  }

  console.log(`[SmartSyncJob] Starting smart sync job with cron: ${SMART_SYNC_CRON}`);

  scheduledTask = cron.schedule(SMART_SYNC_CRON, async () => {
    await runSmartSync();
  });

  console.log("[SmartSyncJob] Smart sync job started - checking every minute");
}

/**
 * Stop the smart sync job
 */
export function stopSmartSyncJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[SmartSyncJob] Job stopped");
  }
}

/**
 * Trigger a manual sync run
 */
export async function triggerManualSmartSync(): Promise<void> {
  console.log("[SmartSyncJob] Manual sync triggered");
  await runSmartSync();
}

/**
 * Get job status
 */
export function getSmartSyncJobStatus(): {
  enabled: boolean;
  isRunning: boolean;
  lastRunAt: Date | null;
  isScheduled: boolean;
} {
  return {
    enabled: SMART_SYNC_ENABLED && isApiFootballEnabled(),
    isRunning,
    lastRunAt,
    isScheduled: scheduledTask !== null,
  };
}
