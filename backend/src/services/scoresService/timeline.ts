// Derive period scores from the picks4all-scores `timeline[]`.
//
// The service no longer fills fulltime/extratime fields (always null);
// the timeline is the source of truth (FOR-PICKS4ALL-INTEGRATION §4-§5).
//
// Minute-90 score = the regulation score with which the match ENTERED
// extra time. In the timeline that is the `ET` milestone's home/away
// goals (e.g. a 1-1 that goes to penalties has an `ET` entry of 1-1).
// If the match never went to extra time, there is no separate 90'
// score — `homeGoals/awayGoals` already are it, so we return null (same
// convention the codebase used before).

import type { TimelineEvent } from "./client";

const ET_STATUSES = new Set(["ET", "BT", "P", "PEN", "AET"]);

/** Terminal API-Football status codes (match is over and won't resume). */
const TERMINAL_STATUSES = new Set(["FT", "AET", "PEN", "ABD"]);

/**
 * How many independent sources confirmed the terminal (match-over)
 * milestone — used to gate finalization (MIN_CONFIRMATIONS_TO_FINALIZE).
 *
 * Takes the STRONGER of two confirmation signals:
 *  - `confirmedBy.length` of the timeline's terminal milestone: the sources
 *    that confirmed the terminal phase AT THE INSTANT it was first reached.
 *    The scraper's timeline is append-only and never rewritten, so this
 *    freezes whichever (possibly few) sources crossed to FT in that exact
 *    consensus cycle — it can badly undercount the real confirmation level.
 *  - `sourcesAgreeing`: sources agreeing on the (terminal) score in the
 *    LATEST live cycle.
 *
 * Why the max: preferring the frozen snapshot alone deadlocked USA–Paraguay
 * on 2026-06-13 — 4 sources agreed live on the FT 4-1, but the frozen FT
 * milestone had only 2 (onefootball, livescore crossed to FINISHED first),
 * so 2 < 3 → grace period never armed → never finalized, sitting as
 * SCRAPER_PROVISIONAL for 17h with no automatic fallback to recover it.
 * Taking the max is safe: this is only consulted once the consensus status
 * is already terminal, so a high live agreement on that terminal score is a
 * legitimate confirmation of the result. When the timeline is absent or has
 * no terminal entry (legacy scraper), it degrades to `sourcesAgreeing`.
 *
 * @param timeline          the match timeline (may be undefined/empty)
 * @param sourcesAgreeing   live consensus count for the terminal score
 */
export function terminalConfirmationCount(
  timeline: TimelineEvent[] | undefined,
  sourcesAgreeing: number,
): number {
  if (timeline && timeline.length > 0) {
    // Last terminal milestone in the (monotonic, oldest→newest) timeline.
    for (let i = timeline.length - 1; i >= 0; i--) {
      const entry = timeline[i];
      if (entry && TERMINAL_STATUSES.has(entry.status)) {
        return Math.max(entry.confirmedBy.length, sourcesAgreeing);
      }
    }
  }
  return sourcesAgreeing;
}

export interface NinetyMinuteScore {
  homeGoals90: number | null;
  awayGoals90: number | null;
}

/**
 * Returns the minute-90 (end of regulation) score, or {null,null} when
 * the match did not go to extra time (in which case the match-level
 * home/away goals already represent regulation).
 *
 * @param timeline  the match timeline (may be undefined/empty on legacy)
 * @param status    the current API-Football status code
 */
export function deriveNinetyMinuteScore(
  timeline: TimelineEvent[] | undefined,
  status: string,
): NinetyMinuteScore {
  const wentToExtraTime =
    status === "AET" ||
    status === "PEN" ||
    status === "P" ||
    status === "ET" ||
    status === "BT" ||
    (timeline?.some((e) => ET_STATUSES.has(e.status)) ?? false);

  if (!wentToExtraTime) {
    return { homeGoals90: null, awayGoals90: null };
  }

  // The `ET` milestone carries the score at the moment ET began = the
  // end-of-90' regulation score. Prefer it.
  const etEntry = timeline?.find((e) => e.status === "ET");
  if (etEntry) {
    return { homeGoals90: etEntry.homeGoals, awayGoals90: etEntry.awayGoals };
  }

  // Went to ET but the timeline lacks the ET milestone (incomplete feed).
  // We cannot derive the 90' score reliably — return null so scoring
  // falls back to the match-level goals rather than inventing a value.
  return { homeGoals90: null, awayGoals90: null };
}
