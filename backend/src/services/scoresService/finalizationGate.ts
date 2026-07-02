/**
 * Finalization gate — pure decision logic (ADR-086).
 *
 * Post-incident redesign (Argentina–Argelia 2026-06-17, Inglaterra–Congo
 * 2026-07-01): the backend NEVER counts sources or judges the scoreline —
 * that is the scraper's job (its terminal gate guarantees ≥2 sources,
 * plausible minute and hysteresis since picks4all-scores a9c85d2). Here we
 * trust the consensus `confidence` plus our own plausibility floor:
 *
 *   FAST  — terminal status + plausible minute + confidence HIGH/VERY_HIGH
 *           → arm grace period → finalize.
 *   SLOW  — terminal + plausible + confidence ≥ MEDIUM + the match started
 *           long ago (anti-deadlock, SLOW_PATH_AFTER_MS) → finalize + R9
 *           one-time admin alert (a human should glance at it).
 *   WAIT  — anything else. The stale detector (R12) remains the backstop.
 *
 * The old `terminalConfirmationCount` max(confirmedBy, sourcesAgreeing)
 * counting is gone: it counted SCORE agreement as FINISH confirmation,
 * which is what auto-finalized the false Argentina FT.
 */

import type { LiveScore, TimelineEvent } from "./client";
import { SCORES } from "../../lib/constants";

/** Terminal API-Football status codes (match is over and won't resume). */
export const TERMINAL_STATUSES = new Set(["FT", "AET", "PEN", "ABD"]);

/** Statuses that mean the ball is (or is about to be) rolling. NS excluded:
 *  a completed match re-appearing as NS is a re-registration artifact, not
 *  a "match came back to life" signal. */
const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);

const CONFIDENCE_RANK: Record<LiveScore["confidence"], number> = {
  VERY_HIGH: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  NONE: 0,
};

export type GateDecision = "FAST" | "SLOW" | "WAIT";

/**
 * Decide whether a terminal-status score may finalize.
 * Caller guarantees `status` is terminal (FT/AET/PEN/ABD).
 */
export function decideFinalization(args: {
  status: string;
  elapsed: number | null;
  /** Wall-clock minutes since the SCHEDULED kickoff (unspoofable by feeds). */
  minutesSinceKickoff: number;
  confidence: LiveScore["confidence"];
}): GateDecision {
  const { status, elapsed, minutesSinceKickoff, confidence } = args;

  // Plausibility floor (R1, kept from the emergency guard): a real FT/AET/PEN
  // only happens late. ABD is exempt — legitimate early abandonment.
  const elapsedPlausible =
    status === "ABD" ||
    (elapsed != null
      ? elapsed >= SCORES.MIN_ELAPSED_FOR_TERMINAL
      : minutesSinceKickoff >= SCORES.MIN_ELAPSED_FOR_TERMINAL);
  if (!elapsedPlausible) return "WAIT";

  const rank = CONFIDENCE_RANK[confidence] ?? 0;
  if (rank >= CONFIDENCE_RANK.HIGH) return "FAST";
  if (
    rank >= CONFIDENCE_RANK.MEDIUM &&
    minutesSinceKickoff * 60_000 >= SCORES.SLOW_PATH_AFTER_MS
  ) {
    return "SLOW";
  }
  return "WAIT";
}

/**
 * R11 predicate: our lifecycle says COMPLETED but the feed reports the match
 * live again — the exact class of both false-terminal incidents.
 */
export function isFinalizedButFeedLive(
  syncStatus: string | null | undefined,
  feedStatus: string,
): boolean {
  return syncStatus === "COMPLETED" && LIVE_STATUSES.has(feedStatus);
}

/** Incoherence classes (R2–R6 family). ALERT-ONLY — some (VAR-disallowed
 *  goals) are legitimate, which is exactly why they alert instead of act. */
export type Incoherence =
  | "SCORE_REGRESSION"
  | "PENALTIES_ON_NON_TIED"
  | "GOALS90_EXCEEDS_FULL";

/**
 * Detect feed incoherences between the previous payload and the current one.
 * Pure — caller supplies the previously stored payload (may be null).
 */
export function detectIncoherences(args: {
  prev: { homeGoals: number; awayGoals: number } | null;
  score: Pick<LiveScore, "homeGoals" | "awayGoals" | "penaltyHome" | "penaltyAway">;
  goals90: { homeGoals90: number | null; awayGoals90: number | null };
}): Incoherence[] {
  const { prev, score, goals90 } = args;
  const found: Incoherence[] = [];

  if (prev && (score.homeGoals < prev.homeGoals || score.awayGoals < prev.awayGoals)) {
    found.push("SCORE_REGRESSION");
  }
  const hasPens = score.penaltyHome != null && score.penaltyAway != null;
  if (hasPens && score.homeGoals !== score.awayGoals) {
    found.push("PENALTIES_ON_NON_TIED");
  }
  if (
    goals90.homeGoals90 != null &&
    goals90.awayGoals90 != null &&
    (goals90.homeGoals90 > score.homeGoals || goals90.awayGoals90 > score.awayGoals)
  ) {
    found.push("GOALS90_EXCEEDS_FULL");
  }
  return found;
}

/** Narrow helper reused by alerts: last terminal milestone of a timeline. */
export function lastTerminalMilestone(
  timeline: TimelineEvent[] | undefined,
): TimelineEvent | null {
  if (!timeline?.length) return null;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const entry = timeline[i];
    if (entry && TERMINAL_STATUSES.has(entry.status)) return entry;
  }
  return null;
}
