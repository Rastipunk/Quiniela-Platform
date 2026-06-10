import crypto from "crypto";
import { CRYPTO_BYTES } from "./constants";
import { isMatchBasedScoring } from "./scoringAdvanced";
import type { PhasePickConfig } from "../types/pickConfig";

export function outcomeFromScore(homeGoals: number, awayGoals: number): "HOME" | "DRAW" | "AWAY" {
  if (homeGoals > awayGoals) return "HOME";
  if (homeGoals < awayGoals) return "AWAY";
  return "DRAW";
}

/**
 * Builds a predicate answering "does this phase take per-match score
 * picks (Prediction rows)?" from a pool's raw `pickTypesConfig` JSON.
 *
 * Structural phases (GROUP_STANDINGS / KNOCKOUT_WINNER — Estratega)
 * never have Prediction rows, so any code that counts "matches without
 * a pick" (notifications, deadline reminder emails) MUST filter through
 * this predicate or it will report missing picks that cannot exist.
 *
 * Fallback rules (deliberately conservative — preserve legacy counting):
 * - Pool without `pickTypesConfig` (predates advanced picks): every
 *   phase counts as match-based.
 * - Match without a `phaseId` (legacy fixture shape): counts as
 *   match-based, since it cannot be classified.
 */
export function buildPhaseTakesMatchPicks(
  pickTypesConfigJson: unknown,
): (phaseId: string | undefined) => boolean {
  const config = Array.isArray(pickTypesConfigJson)
    ? (pickTypesConfigJson as PhasePickConfig[])
    : [];
  const matchPickPhaseIds = new Set(
    config.filter(isMatchBasedScoring).map((pc) => pc.phaseId),
  );
  return (phaseId: string | undefined): boolean => {
    if (config.length === 0) return true;
    if (!phaseId) return true;
    return matchPickPhaseIds.has(phaseId);
  };
}

export function makeInviteCode() {
  // Comentario en español: código corto, suficientemente único para MVP
  return crypto.randomBytes(CRYPTO_BYTES.POOL_INVITE_CODE).toString("hex"); // 12 chars
}
