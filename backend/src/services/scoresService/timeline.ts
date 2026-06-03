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
 * milestone. Looks at the timeline's terminal entry's confirmedBy[]. If
 * the timeline is absent or has no terminal entry (legacy scraper), falls
 * back to the live consensus count `sourcesAgreeing`.
 *
 * @param timeline          the match timeline (may be undefined/empty)
 * @param sourcesAgreeing   live consensus count, used as legacy fallback
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
        return entry.confirmedBy.length;
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
