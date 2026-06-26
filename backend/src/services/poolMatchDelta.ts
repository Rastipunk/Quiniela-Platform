/**
 * "Last match" delta for the leaderboard (pure).
 *
 * Finds the most recent finalized + scoring-enabled match(es) — a single kickoff
 * instant, so simultaneous matches group together — so the standings can show
 * each player's points gained and positions climbed/dropped since then. The
 * caller already has the per-(player, match) increments from the leaderboard
 * loop, so this only resolves WHICH match(es) form the latest period and a label
 * for them.
 */

import type { FixtureMatch, FixtureTeam } from "../lib/fixture";

export interface LastStep {
  matchIds: string[];
  /** e.g. "JPN vs SWE" or "JPN vs SWE, BRA vs CRO". */
  label: string;
}

function teamToken(team: FixtureTeam | undefined, fallbackId: string): string {
  return team?.code || team?.shortName || team?.name || fallbackId;
}

export function computeLastStep(args: {
  matches: FixtureMatch[];
  teamById: Map<string, FixtureTeam>;
  finalizedMatchIds: Set<string>;
  scoringDisabledMatchIds: Set<string>;
}): LastStep | null {
  const { matches, teamById, finalizedMatchIds, scoringDisabledMatchIds } = args;
  const eligible = matches.filter(
    (m) => finalizedMatchIds.has(m.id) && !scoringDisabledMatchIds.has(m.id),
  );
  if (eligible.length === 0) return null;

  let maxT = -Infinity;
  for (const m of eligible) maxT = Math.max(maxT, Date.parse(m.kickoffUtc));
  const group = eligible.filter((m) => Date.parse(m.kickoffUtc) === maxT);

  const label = group
    .map(
      (m) =>
        `${teamToken(teamById.get(m.homeTeamId), m.homeTeamId)} vs ${teamToken(teamById.get(m.awayTeamId), m.awayTeamId)}`,
    )
    .join(", ");

  return { matchIds: group.map((m) => m.id), label };
}
