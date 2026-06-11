/**
 * Capricho San Job (ADR-075)
 *
 * Every CAPRICHO_SAN_POLL_MS (default 60 s) sweeps the env-allowlisted,
 * host-enabled pools and assigns random score picks to members who let
 * a match's deadline pass without predicting. Does NOT start at all
 * when the allowlist is empty — zero overhead for everyone else.
 */

import { assignRandomPicksForDuePools } from "../services/caprichoSanService";
import { caprichoSanConfigured } from "../lib/caprichoSan";

const POLL_MS = parseInt(process.env.CAPRICHO_SAN_POLL_MS || "60000", 10);

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

export function startCaprichoSanJob(): void {
  if (intervalId) return;
  if (!caprichoSanConfigured()) {
    console.log("[CaprichoSanJob] No allowlisted pools — job not started");
    return;
  }

  intervalId = setInterval(() => {
    if (isRunning) return;
    isRunning = true;
    assignRandomPicksForDuePools()
      .then((s) => {
        if (s.picksAssigned > 0) {
          console.log(
            `[CaprichoSanJob] Assigned ${s.picksAssigned} random pick(s) across ${s.poolsProcessed} pool(s)`,
          );
        }
      })
      .catch((err) =>
        console.error(
          "[CaprichoSanJob] Error:",
          err instanceof Error ? err.message : String(err),
        ),
      )
      .finally(() => {
        isRunning = false;
      });
  }, POLL_MS);

  console.log(`[CaprichoSanJob] Started — polling every ${POLL_MS}ms`);
}

export function stopCaprichoSanJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[CaprichoSanJob] Stopped");
  }
}
