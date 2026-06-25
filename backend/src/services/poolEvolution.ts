/**
 * Pool "Evolución" series builder (read-only, pure — ADR-079 lineage).
 *
 * Turns the per-(player, match) point increments — captured for free while the
 * leaderboard is computed in `poolOverviewService` — into a chronological
 * cumulative-points series for the Evolución chart.
 *
 *   - Matches are ordered by `kickoffUtc`; **simultaneous kickoffs collapse
 *     into ONE step** (the cumulative jump bundles all same-instant results).
 *   - Only **finalized, scoring-enabled** matches are plotted.
 *   - **Match-based granularity only.** Structural (per-phase) pools — Estratega
 *     group standings / knockout-winner — are flagged via `hasStructuralPhases`
 *     and get a per-phase series in a later iteration; their per-match
 *     increments are not captured, so their lines would read flat here.
 *
 * No DB / no IO: receives plain data, returns plain data — so the series lives
 * inside the cached leaderboard bundle and viewers only ever READ it (the calc
 * runs once per input change, never per view).
 */

import type { FixtureMatch, FixtureTeam } from "../lib/fixture";

export interface EvolutionStep {
  /** 0-based chronological position on the X axis. */
  index: number;
  /** Phase the step belongs to (for the phase bands under the chart). */
  phaseId: string;
  /** ISO kickoff of the step (all matches in the step share this instant). */
  kickoffUtc: string;
  /** Matches resolved at this step (>1 when kickoffs are simultaneous). */
  matchIds: string[];
  /** Best-effort short label, e.g. "BRA vs CRO" or "BRA vs CRO +2". */
  label: string;
}

export interface EvolutionPlayer {
  userId: string;
  displayName: string;
  /** Cumulative points after each step. `length === steps.length`. */
  cumulative: number[];
}

/** The "pack" spread at a step — drawn as a shaded band for big pools so the
 *  bulk of players is represented without drawing every line. */
export interface EvolutionBandPoint {
  index: number;
  min: number;
  max: number;
  median: number;
}

export interface EvolutionSeries {
  granularity: "match";
  /** True when the pool has structural phases (series is then incomplete). */
  hasStructuralPhases: boolean;
  steps: EvolutionStep[];
  /** Every player's full cumulative series (user-agnostic; curated per viewer). */
  players: EvolutionPlayer[];
  /** Per-step min/max/median across ALL players. `length === steps.length`. */
  band: EvolutionBandPoint[];
}

// ── Curation thresholds (large pools) ────────────────────────────────────────
/** Pools with ≤ this many players draw EVERY line (no curation, no band). */
export const EVOLUTION_FULL_LINES = 15;
/** Leaders always drawn as individual lines (top of the standings). */
export const EVOLUTION_TOP_K = 5;
/** Neighbours drawn around the viewer's rank (± this many positions). */
export const EVOLUTION_NEIGHBORS = 3;

/** Shortest stable display token for a team (code → shortName → name → id). */
function teamToken(team: FixtureTeam | undefined, fallbackId: string): string {
  return team?.code || team?.shortName || team?.name || fallbackId;
}

function stepLabel(group: FixtureMatch[], teamById: Map<string, FixtureTeam>): string {
  const first = group[0]!;
  const home = teamToken(teamById.get(first.homeTeamId), first.homeTeamId);
  const away = teamToken(teamById.get(first.awayTeamId), first.awayTeamId);
  const base = `${home} vs ${away}`;
  return group.length > 1 ? `${base} +${group.length - 1}` : base;
}

export function buildEvolutionSeries(args: {
  matches: FixtureMatch[];
  teamById: Map<string, FixtureTeam>;
  /** Matches that have a finalized result (a step exists only for these). */
  finalizedMatchIds: Set<string>;
  /** Matches whose scoring is disabled by a host override (excluded). */
  scoringDisabledMatchIds: Set<string>;
  members: Array<{ userId: string; displayName: string }>;
  /** userId → (matchId → points), captured during the leaderboard loop. */
  pointsByUserMatch: Map<string, Map<string, number>>;
  hasStructuralPhases: boolean;
}): EvolutionSeries {
  const {
    matches,
    teamById,
    finalizedMatchIds,
    scoringDisabledMatchIds,
    members,
    pointsByUserMatch,
    hasStructuralPhases,
  } = args;

  // Plot only finalized, scoring-enabled matches, in kickoff order (stable by
  // id so simultaneous matches keep a deterministic sequence).
  const plotted = matches
    .filter((m) => finalizedMatchIds.has(m.id) && !scoringDisabledMatchIds.has(m.id))
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.kickoffUtc).getTime();
      const tb = new Date(b.kickoffUtc).getTime();
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });

  // Collapse equal-kickoff runs into one step each.
  const steps: EvolutionStep[] = [];
  let i = 0;
  while (i < plotted.length) {
    const t0 = new Date(plotted[i]!.kickoffUtc).getTime();
    const group: FixtureMatch[] = [];
    while (i < plotted.length && new Date(plotted[i]!.kickoffUtc).getTime() === t0) {
      group.push(plotted[i]!);
      i++;
    }
    const first = group[0]!;
    steps.push({
      index: steps.length,
      phaseId: first.phaseId,
      kickoffUtc: first.kickoffUtc,
      matchIds: group.map((g) => g.id),
      label: stepLabel(group, teamById),
    });
  }

  // Cumulative points per player across the steps. A player who didn't pick a
  // match (or scored 0) simply adds 0 at that step — their line still has a
  // point there, so every line spans the full X axis.
  const players: EvolutionPlayer[] = members.map((mem) => {
    const byMatch = pointsByUserMatch.get(mem.userId);
    const cumulative: number[] = [];
    let running = 0;
    for (const step of steps) {
      let stepPoints = 0;
      for (const mid of step.matchIds) stepPoints += byMatch?.get(mid) ?? 0;
      running += stepPoints;
      cumulative.push(running);
    }
    return { userId: mem.userId, displayName: mem.displayName, cumulative };
  });

  // Pack band: the min/max/median across ALL players at each step. User-agnostic
  // (lives in the cached bundle); the chart shades it for big pools so the bulk
  // of the field shows without a line per player.
  const band: EvolutionBandPoint[] = steps.map((_step, i) => {
    const vals = players.map((p) => p.cumulative[i] ?? 0).sort((a, b) => a - b);
    const n = vals.length;
    const median = n === 0 ? 0 : n % 2 === 1 ? vals[(n - 1) / 2]! : (vals[n / 2 - 1]! + vals[n / 2]!) / 2;
    return { index: i, min: vals[0] ?? 0, max: vals[n - 1] ?? 0, median };
  });

  return { granularity: "match", hasStructuralPhases, steps, players, band };
}

// ── Per-viewer curation (large pools) ────────────────────────────────────────

export interface CuratedEvolutionPlayer extends EvolutionPlayer {
  isViewer: boolean;
  rank: number | null;
}

export interface CuratedEvolution {
  granularity: "match";
  hasStructuralPhases: boolean;
  steps: EvolutionStep[];
  /** The lines actually drawn (all players for small pools; a subset for big). */
  players: CuratedEvolutionPlayer[];
  /** Shaded pack band — present only when curated (big pool); null otherwise. */
  band: EvolutionBandPoint[] | null;
  /** True when only a subset of lines is drawn. */
  curated: boolean;
  /** Total players in the pool (so the UI can say "+N en el pelotón"). */
  totalPlayers: number;
}

/**
 * Pick the lines worth drawing for THIS viewer and tag them. Small pools draw
 * everyone (no band); big pools draw the viewer + top-K leaders + ±neighbours by
 * rank, with the rest represented by the pack band. Pure — the caller passes the
 * (cached, user-agnostic) full series + the standings ranks.
 */
export function curateEvolutionForViewer(args: {
  series: EvolutionSeries;
  rankByUserId: Map<string, number>;
  viewerUserId: string;
}): CuratedEvolution {
  const { series, rankByUserId, viewerUserId } = args;
  const totalPlayers = series.players.length;

  const withMeta = (p: EvolutionPlayer): CuratedEvolutionPlayer => ({
    ...p,
    isViewer: p.userId === viewerUserId,
    rank: rankByUserId.get(p.userId) ?? null,
  });

  const base = {
    granularity: series.granularity,
    hasStructuralPhases: series.hasStructuralPhases,
    steps: series.steps,
    totalPlayers,
  } as const;

  // Small pool → draw everyone, no band needed.
  if (totalPlayers <= EVOLUTION_FULL_LINES) {
    return { ...base, players: series.players.map(withMeta), band: null, curated: false };
  }

  // Big pool → viewer + top-K leaders + ±neighbours by rank.
  const viewerRank = rankByUserId.get(viewerUserId) ?? Number.POSITIVE_INFINITY;
  const keep = new Set<string>([viewerUserId]);
  for (const [uid, rank] of rankByUserId) {
    if (rank <= EVOLUTION_TOP_K) keep.add(uid);
    if (Math.abs(rank - viewerRank) <= EVOLUTION_NEIGHBORS) keep.add(uid);
  }

  const players = series.players
    .filter((p) => keep.has(p.userId))
    .map(withMeta)
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

  return { ...base, players, band: series.band, curated: true };
}
