// Single source of truth for leaderboard ranking + tiebreakers.
//
// Used by BOTH the live leaderboard (poolOverviewService) and the
// pool-completed email (poolStateMachine) so they can never diverge.
//
// Tiebreaker order (TIEBREAKER_PLAN.md §2, decisions D1-D5):
//   1. points            (desc)
//   2. perfectCount      (desc)  — matches/groups/knockouts hit at max
//   3. partialCount      (desc)  — matches/groups hit with >0 but < max
//   4. joinedAtUtc       (asc)   — STABLE ORDER ONLY, not a "visible" criterion
//
// Players equal on (points, perfectCount, partialCount) SHARE the same
// rank ("1-2-2-4" competition ranking, D5). The remaining tie is decided
// by the organization, outside the system.

export interface RankableRow {
  points: number;
  perfectCount: number;
  partialCount: number;
  /** Tiebreaker of last resort — stable ordering within a tied group only. */
  joinedAtUtc: Date | string;
}

export interface RankedRow<T> {
  row: T;
  /** 1-based competition rank; tied rows share it ("1-2-2-4"). */
  rank: number;
  /** How many rows share this exact rank (1 = no tie). */
  tiedGroupSize: number;
}

function toMs(d: Date | string): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

/**
 * True when two rows are tied on every *visible* criterion.
 *
 * A tie at 0 points is NOT a meaningful tie — it's the initial state
 * (tournament not started / nobody scored yet) or the bottom of the table.
 * Surfacing it ("everyone tied for 1st") is noise, so 0-point rows never
 * group: each gets its own sequential rank and isTied=false.
 */
function sameRank(a: RankableRow, b: RankableRow): boolean {
  return (
    a.points > 0 &&
    a.points === b.points &&
    a.perfectCount === b.perfectCount &&
    a.partialCount === b.partialCount
  );
}

/**
 * Sort rows by the tiebreaker order and assign shared (competition) ranks.
 * Does not mutate the input. Stable within a tied group by joinedAtUtc.
 */
export function rankLeaderboardRows<T extends RankableRow>(
  rows: readonly T[],
): RankedRow<T>[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.perfectCount !== a.perfectCount) return b.perfectCount - a.perfectCount;
    if (b.partialCount !== a.partialCount) return b.partialCount - a.partialCount;
    return toMs(a.joinedAtUtc) - toMs(b.joinedAtUtc);
  });

  const out: RankedRow<T>[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    // Extend the tied group while the next row ties on all visible criteria.
    while (j + 1 < sorted.length && sameRank(sorted[j + 1]!, sorted[i]!)) {
      j++;
    }
    const groupSize = j - i + 1;
    const rank = i + 1; // competition ranking: next group jumps past the tie
    for (let k = i; k <= j; k++) {
      out.push({ row: sorted[k]!, rank, tiedGroupSize: groupSize });
    }
    i = j + 1;
  }
  return out;
}
