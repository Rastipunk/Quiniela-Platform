/**
 * Knockout extra-time scoring config (v2) — pure helpers.
 *
 * Domain: for SCORE predictions ("marcadores") in knockout phases, a pool
 * either grades on the minute-90 result (`includeExtraTime=false`, default —
 * 90' + stoppage, `goals90`) or the end-of-extra-time result
 * (`includeExtraTime=true`). Penalties NEVER count toward a scoreline (ADR-068).
 *
 * The host may flip `includeExtraTime` per knockout phase, but only DURING an
 * open window that closes the moment the group stage is fully decided — which
 * is BEFORE any knockout match is played, so the flip is always forward-looking
 * and can never retroactively re-grade an already-scored knockout match.
 *
 * These helpers are deliberately pure (no Prisma) so they're trivially testable;
 * the caller supplies phases/matches and the set of FINALIZED match ids.
 */

import type { FixturePhase, FixtureMatch } from "./fixture";
import type { PhasePickConfig } from "../types/pickConfig";
import { isMatchBasedScoring } from "./scoringAdvanced";

/**
 * Goal-based match-pick keys. A knockout phase "grades marcadores" when it is
 * match-based AND enables at least one of these (a goalless MATCH_OUTCOME_90MIN
 * pick is about the winner, not the scoreline, so it does not qualify).
 */
export const SCORELINE_PICK_KEYS: ReadonlySet<string> = new Set([
  "EXACT_SCORE",
  "GOAL_DIFFERENCE",
  "PARTIAL_SCORE",
  "TOTAL_GOALS",
  "HOME_GOALS",
  "AWAY_GOALS",
]);

/** A phase is "knockout" iff its type is anything other than GROUP. */
export function isKnockoutPhaseType(type: string | undefined): boolean {
  return type !== undefined && type !== "GROUP";
}

/**
 * The knockout phases of a pool that grade scoreline predictions, with their
 * current `includeExtraTime` value resolved. Empty array ⇒ this pool is NOT a
 * knockout-marcadores pool (e.g. SIMPLE/estratega), so the feature doesn't apply.
 */
export interface KnockoutScorePhase {
  phaseId: string;
  phaseName: string;
  includeExtraTime: boolean;
}

export function getKnockoutScorePhases(
  phases: FixturePhase[],
  pickTypesConfig: PhasePickConfig[] | null | undefined,
): KnockoutScorePhase[] {
  if (!Array.isArray(pickTypesConfig) || pickTypesConfig.length === 0) return [];
  const knockoutById = new Map(
    phases.filter((p) => isKnockoutPhaseType(p.type)).map((p) => [p.id, p]),
  );

  const out: KnockoutScorePhase[] = [];
  for (const pc of pickTypesConfig) {
    const phase = knockoutById.get(pc.phaseId);
    if (!phase) continue; // group phase or unknown
    if (!isMatchBasedScoring(pc)) continue; // structural / estratega
    const gradesScoreline = !!pc.matchPicks?.types.some(
      (t) => t.enabled && SCORELINE_PICK_KEYS.has(t.key),
    );
    if (!gradesScoreline) continue;
    out.push({
      phaseId: pc.phaseId,
      phaseName: pc.phaseName || phase.name,
      includeExtraTime: pc.includeExtraTime ?? false,
    });
  }
  // Stable, fixture order (so the UI lists R32 → final).
  const orderById = new Map(phases.map((p) => [p.id, p.order]));
  out.sort((a, b) => (orderById.get(a.phaseId) ?? 0) - (orderById.get(b.phaseId) ?? 0));
  return out;
}

/** True iff the pool grades scoreline predictions in at least one knockout phase. */
export function isKnockoutScorePool(
  phases: FixturePhase[],
  pickTypesConfig: PhasePickConfig[] | null | undefined,
): boolean {
  return getKnockoutScorePhases(phases, pickTypesConfig).length > 0;
}

export type ExtraTimeWindowReason =
  | "OPEN"
  | "GROUP_STAGE_FINALIZED" // every group match has a FINAL result (group stage decided)
  | "KNOCKOUT_STARTED" // a knockout match has already kicked off (hard safety backstop)
  | "NO_GROUP_MATCHES"; // pool has no group-stage matches — nothing to gate on (treat as closed)

export interface ExtraTimeWindow {
  open: boolean;
  reason: ExtraTimeWindowReason;
}

/**
 * Whether the per-phase extra-time toggle is still editable.
 *
 * Window CLOSES at the earlier of:
 *   1. The group stage being fully decided — EVERY group-stage match has a
 *      FINAL result (the owner-intended "until the last group match finishes").
 *   2. The first knockout kickoff — a hard backstop guaranteeing no knockout
 *      result can ever exist while the window is open (so flips never
 *      retroactively re-grade a played knockout match), even if a group result
 *      is stuck un-finalized.
 *
 * @param finalizedMatchIds match ids whose current result source is FINAL
 *        (API_CONFIRMED / HOST_OVERRIDE / HOST_MANUAL — see FINAL_RESULT_SOURCES).
 */
export function computeExtraTimeWindow(args: {
  phases: FixturePhase[];
  matches: FixtureMatch[];
  finalizedMatchIds: ReadonlySet<string>;
  now: number;
}): ExtraTimeWindow {
  const { phases, matches, finalizedMatchIds, now } = args;
  const groupPhaseIds = new Set(
    phases.filter((p) => p.type === "GROUP").map((p) => p.id),
  );

  const groupMatches = matches.filter((m) => groupPhaseIds.has(m.phaseId));
  if (groupMatches.length === 0) {
    return { open: false, reason: "NO_GROUP_MATCHES" };
  }

  // Backstop: has any knockout match already kicked off?
  const koKickoffs = matches
    .filter((m) => !groupPhaseIds.has(m.phaseId) && m.kickoffUtc)
    .map((m) => new Date(m.kickoffUtc).getTime())
    .filter((t) => Number.isFinite(t));
  const firstKoKickoff = koKickoffs.length > 0 ? Math.min(...koKickoffs) : Infinity;
  if (now >= firstKoKickoff) {
    return { open: false, reason: "KNOCKOUT_STARTED" };
  }

  // Owner deadline: every group match declared FINAL ⇒ group stage decided.
  const allGroupFinalized = groupMatches.every((m) => finalizedMatchIds.has(m.id));
  if (allGroupFinalized) {
    return { open: false, reason: "GROUP_STAGE_FINALIZED" };
  }

  return { open: true, reason: "OPEN" };
}
