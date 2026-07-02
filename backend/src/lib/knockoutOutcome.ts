/**
 * Instance-level knockout outcome derivation (ADR-087) — pure.
 *
 * The progressive resolver needs ONE canonical winner per finished knockout
 * match, but results live per pool (`PoolMatchResult`) and a pool-specific
 * HOST_OVERRIDE can disagree with the scraper consensus (seen in prod: a test
 * pool overrode Brasil–Japón to 2-2 pens 6-5 while 464 pools had 2-1). A
 * single reference pool could therefore poison the whole bracket. Instead the
 * winner side is decided by STRICT MAJORITY across every ACTIVE pool's FINAL
 * result — one eccentric override can never steer the instance bracket.
 */

import { FINAL_RESULT_SOURCES } from "./constants";

export interface FinalResultRow {
  source: string;
  homeGoals: number;
  awayGoals: number;
  homePenalties: number | null;
  awayPenalties: number | null;
}

export type OutcomeSide = "HOME" | "AWAY";

/** Winner side of one result row; null when undecidable (tie without pens). */
export function outcomeSide(row: {
  homeGoals: number;
  awayGoals: number;
  homePenalties: number | null;
  awayPenalties: number | null;
}): OutcomeSide | null {
  if (row.homeGoals > row.awayGoals) return "HOME";
  if (row.awayGoals > row.homeGoals) return "AWAY";
  if (row.homePenalties != null && row.awayPenalties != null) {
    if (row.homePenalties > row.awayPenalties) return "HOME";
    if (row.awayPenalties > row.homePenalties) return "AWAY";
  }
  return null;
}

/**
 * Majority winner side across pool results. Only FINAL sources vote
 * (API_CONFIRMED / HOST_OVERRIDE / HOST_MANUAL — provisional rows are the
 * live feed, not a verdict). Returns null when there are no FINAL rows or
 * no side reaches a strict majority of the decisive votes.
 */
export function deriveMajorityOutcome(rows: FinalResultRow[]): OutcomeSide | null {
  let home = 0;
  let away = 0;
  for (const row of rows) {
    if (!FINAL_RESULT_SOURCES.has(row.source)) continue;
    const side = outcomeSide(row);
    if (side === "HOME") home++;
    else if (side === "AWAY") away++;
  }
  const decisive = home + away;
  if (decisive === 0) return null;
  if (home * 2 > decisive) return "HOME";
  if (away * 2 > decisive) return "AWAY";
  return null;
}
