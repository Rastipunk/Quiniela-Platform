/**
 * Pool "Evolución" bar-chart-race series (read-only, pure).
 *
 * The cumulative-points series over time used by the animated bar race ("Países
 * por PIB"-style). Built from the per-(player, match) increments the leaderboard
 * loop already computes, so it never diverges and adds no scoring pass.
 *
 *   - Matches ordered by `kickoffUtc`; simultaneous kickoffs collapse into ONE
 *     step. Only finalized, scoring-enabled matches are plotted.
 *   - `buildBarRaceSeries` returns the FULL series (every player) — user-agnostic,
 *     lives in the cached bundle. `curateBarRaceForViewer` trims it for the wire:
 *     anyone who ever reached the top-N at any step, plus the viewer.
 *   - Match-based granularity only (structural/Estratega phases are per-phase).
 */

import type { FixtureMatch, FixtureTeam } from "../lib/fixture";

/** Players shown at once in the race; the wire payload keeps everyone who ever
 *  cracked this top-N (plus the viewer). */
export const BAR_RACE_TOP_N = 15;

export interface BarRaceStep {
  index: number;
  kickoffUtc: string;
  label: string;
}
export interface BarRacePlayer {
  userId: string;
  displayName: string;
  /** Cumulative points after each step. `length === steps.length`. */
  cumulative: number[];
}
export interface BarRaceSeries {
  steps: BarRaceStep[];
  players: BarRacePlayer[];
}

function teamToken(team: FixtureTeam | undefined, fallbackId: string): string {
  return team?.code || team?.shortName || team?.name || fallbackId;
}

const dayMs = (iso: string) => new Date(iso).getTime();

export function buildBarRaceSeries(args: {
  matches: FixtureMatch[];
  teamById: Map<string, FixtureTeam>;
  finalizedMatchIds: Set<string>;
  scoringDisabledMatchIds: Set<string>;
  members: Array<{ userId: string; displayName: string }>;
  pointsByUserMatch: Map<string, Map<string, number>>;
}): BarRaceSeries {
  const { matches, teamById, finalizedMatchIds, scoringDisabledMatchIds, members, pointsByUserMatch } = args;

  const plotted = matches
    .filter((m) => finalizedMatchIds.has(m.id) && !scoringDisabledMatchIds.has(m.id))
    .slice()
    .sort((a, b) => {
      const ta = dayMs(a.kickoffUtc);
      const tb = dayMs(b.kickoffUtc);
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });

  // Collapse equal-kickoff runs into one step each.
  const grouped: Array<{ kickoffUtc: string; matchIds: string[]; label: string }> = [];
  let i = 0;
  while (i < plotted.length) {
    const t0 = dayMs(plotted[i]!.kickoffUtc);
    const group: FixtureMatch[] = [];
    while (i < plotted.length && dayMs(plotted[i]!.kickoffUtc) === t0) {
      group.push(plotted[i]!);
      i++;
    }
    const first = group[0]!;
    const home = teamToken(teamById.get(first.homeTeamId), first.homeTeamId);
    const away = teamToken(teamById.get(first.awayTeamId), first.awayTeamId);
    const label = group.length > 1 ? `${home} vs ${away} +${group.length - 1}` : `${home} vs ${away}`;
    grouped.push({ kickoffUtc: first.kickoffUtc, matchIds: group.map((g) => g.id), label });
  }

  const steps: BarRaceStep[] = grouped.map((g, idx) => ({ index: idx, kickoffUtc: g.kickoffUtc, label: g.label }));

  const players: BarRacePlayer[] = members.map((mem) => {
    const byMatch = pointsByUserMatch.get(mem.userId);
    const cumulative: number[] = [];
    let running = 0;
    for (const g of grouped) {
      let stepPoints = 0;
      for (const mid of g.matchIds) stepPoints += byMatch?.get(mid) ?? 0;
      running += stepPoints;
      cumulative.push(running);
    }
    return { userId: mem.userId, displayName: mem.displayName, cumulative };
  });

  return { steps, players };
}

// ── Per-viewer curation ──────────────────────────────────────────────────────

export interface CuratedBarRacePlayer extends BarRacePlayer {
  isViewer: boolean;
}
export interface CuratedBarRace {
  steps: BarRaceStep[];
  /** Anyone who ever reached the top-N at any step, plus the viewer. */
  players: CuratedBarRacePlayer[];
  topN: number;
  totalPlayers: number;
}

/**
 * Keep only the players worth sending: everyone who appears in the top-N at ANY
 * step (so overtakes are visible) plus the viewer (always, even if they never
 * crack the top-N). The chart picks the top-N to show per frame from this set.
 */
export function curateBarRaceForViewer(args: {
  series: BarRaceSeries;
  viewerUserId: string;
  topN?: number;
}): CuratedBarRace {
  const { series, viewerUserId } = args;
  const topN = args.topN ?? BAR_RACE_TOP_N;
  const keep = new Set<string>([viewerUserId]);

  for (let i = 0; i < series.steps.length; i++) {
    const order = [...series.players].sort((a, b) => (b.cumulative[i] ?? 0) - (a.cumulative[i] ?? 0));
    for (const p of order.slice(0, topN)) keep.add(p.userId);
  }

  const players = series.players
    .filter((p) => keep.has(p.userId))
    .map((p) => ({ ...p, isViewer: p.userId === viewerUserId }));

  return { steps: series.steps, players, topN, totalPlayers: series.players.length };
}
