/**
 * Platform health cron — runs every 5 min, collects the snapshot,
 * evaluates thresholds, and fires/resolves admin alerts.
 *
 * Single-instance: keeps a reentrancy guard like every other job, no
 * advisory lock needed (the only persisted state is PlatformHealthAlert
 * which the service mutates idempotently under per-row constraints).
 */

import * as cron from "node-cron";
import {
  collectSnapshot,
  evaluateSnapshot,
  processSnapshotAlerts,
} from "../services/platformHealthService";

const PLATFORM_HEALTH_CRON = process.env.PLATFORM_HEALTH_CRON || "*/5 * * * *";

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

async function runOnce(): Promise<void> {
  if (isRunning) {
    console.log("[PlatformHealth] Skipping — previous run still active");
    return;
  }
  isRunning = true;
  const startedAt = Date.now();
  try {
    const snapshot = evaluateSnapshot(await collectSnapshot());
    const result = await processSnapshotAlerts(snapshot);
    const durationMs = Date.now() - startedAt;
    const offenders = snapshot.metrics
      .filter((m) => m.severity && m.severity !== "OK")
      .map((m) => `${m.key}=${m.severity}`)
      .join(" ");
    console.log(
      `[PlatformHealth] ${durationMs}ms — ${result.fired} fired, ${result.resolved} resolved, ${result.suppressedByCooldown} suppressed${
        offenders ? ` | offenders: ${offenders}` : ""
      }`,
    );
  } catch (err) {
    console.error(
      "[PlatformHealth] Error:",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    isRunning = false;
  }
}

export function startPlatformHealthJob(): void {
  if (scheduledTask) {
    console.log("[PlatformHealth] Job already running");
    return;
  }
  console.log(`[PlatformHealth] Starting with cron: ${PLATFORM_HEALTH_CRON}`);
  scheduledTask = cron.schedule(PLATFORM_HEALTH_CRON, () => {
    runOnce().catch((err) =>
      console.error(
        "[PlatformHealth] Unhandled run error:",
        err instanceof Error ? err.message : String(err),
      ),
    );
  });

  // Also run once on startup, after a short delay so the boot's other
  // queries don't compete with the health snapshot for connections.
  setTimeout(() => {
    runOnce().catch((err) =>
      console.error(
        "[PlatformHealth] Startup run error:",
        err instanceof Error ? err.message : String(err),
      ),
    );
  }, 30_000).unref();
}

export function stopPlatformHealthJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[PlatformHealth] Job stopped");
  }
}
