/**
 * "Capricho San" availability gate (ADR-075).
 *
 * A gifted, per-pool feature: pools listed in the CAPRICHO_SAN_POOL_IDS
 * env var (comma-separated pool IDs) can enable random-score assignment
 * for players who miss the pick deadline. The allowlist lives in the
 * environment — never hardcode pool IDs in code — so gifting the feature
 * to another pool is a Railway variable change, not a deploy.
 */

import { randomInt } from "crypto";

/** Hard bounds for the host-configurable random range. */
export const CAPRICHO_SAN_RANGE = { MIN: 0, MAX: 9 } as const;

function allowedPoolIds(): Set<string> {
  return new Set(
    (process.env.CAPRICHO_SAN_POOL_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Whether the feature can be offered/used for this pool. Read at call
 *  time so a Railway env change applies on restart without code edits. */
export function isCaprichoSanPool(poolId: string): boolean {
  return allowedPoolIds().has(poolId);
}

/** True when at least one pool has the feature — gates the cron job. */
export function caprichoSanConfigured(): boolean {
  return allowedPoolIds().size > 0;
}

/** Uniform random integer in [min, max], both inclusive (crypto-backed). */
export function randomGoals(min: number, max: number): number {
  if (max <= min) return min;
  return randomInt(min, max + 1);
}
