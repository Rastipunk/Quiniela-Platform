/**
 * Admin knockout-bracket preview (phase-release panel).
 *
 * Computes the CANONICAL knockout bracket of a tournament instance from the
 * real group results, using the same FIFA logic that powers per-pool
 * auto-advance — but at instance level (no pool). This is what the admin
 * reviews/edits before "publishing" (releasing) a knockout round to players.
 *
 * round_of_32 placeholders (W_<group> / RU_<group> / 3rd_POOL_<n>) resolve to
 * real teams from current group standings (provisional until the group stage is
 * fully finalized). Later rounds (round_of_16+) feed off knockout WINNERS
 * (W_<matchId>), which aren't known until the prior round is played — those
 * stay as placeholders here.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ServiceError } from "./authService";
import { calculateAllGroupStandings } from "./instanceAdvancement";
import { determineQualifiers, resolvePlaceholders } from "./tournamentAdvancement";
import { extractPhases, extractMatches, extractTeams } from "../lib/fixture";
import { PLACEHOLDER_TEAM_PREFIXES, FINAL_RESULT_SOURCES } from "../lib/constants";
import { getPoolOverview } from "./poolOverviewService";
import { calculateMaxPointsForPool } from "../lib/scoringAdvanced";
import { sendPhaseSummaryEmail, sendPhaseReleaseEmail } from "../lib/email";
import type { PhasePickConfig } from "../types/pickConfig";

function isPlaceholderTeamId(id: string): boolean {
  return PLACEHOLDER_TEAM_PREFIXES.some((p) => id === p || id.startsWith(p));
}

export interface BracketMatch {
  matchId: string;
  phaseId: string;
  kickoffUtc: string | null;
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  homePending: boolean; // still a placeholder (teams not yet decided)
  awayPending: boolean;
}

export interface BracketPhase {
  phaseId: string;
  name: string;
  order: number;
  /** Group stage fully finalized → round_of_32 teams are final, not provisional. */
  groupStageFinalized: boolean;
  /** Admin has released this phase for predictions. */
  released: boolean;
  matches: BracketMatch[];
}

type BracketOverride = { homeTeamId?: string; awayTeamId?: string; kickoffUtc?: string };

export interface KnockoutBracketPreview {
  instanceId: string;
  instanceName: string;
  /** Master opt-in: is the admin knockout-release gate active for this instance. */
  gateEnabled: boolean;
  phases: BracketPhase[];
  /** All teams (for the admin edit dropdowns). */
  teams: Array<{ id: string; name: string; groupId?: string }>;
  /** Group matches finalized vs total (so the UI can warn "provisional"). */
  groupProgress: { finalized: number; total: number };
}

export async function getKnockoutBracketPreview(instanceId: string): Promise<KnockoutBracketPreview> {
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true, name: true, dataJson: true,
      knockoutReleaseGateEnabled: true, releasedKnockoutPhases: true, knockoutBracketOverrides: true,
    },
  });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  const data = instance.dataJson;
  const releasedPhases = new Set((instance.releasedKnockoutPhases as string[] | null) ?? []);
  const overrides = (instance.knockoutBracketOverrides as Record<string, BracketOverride> | null) ?? {};
  const phases = extractPhases(data);
  const matches = extractMatches(data);
  const teams = extractTeams(data);
  const nameById = new Map(teams.map((t) => [t.id, t.name ?? t.id]));

  // Reference pool for canonical results: an ACTIVE pool (the scraper scores are
  // identical across pools). pools[0] could be a DRAFT/test pool with no results.
  const refPool = await prisma.pool.findFirst({
    where: { tournamentInstanceId: instanceId, status: "ACTIVE" },
    select: { id: true },
  });

  // Canonical group standings → R32 qualifiers via FIFA rules. This reuses the
  // production advancement logic, which REQUIRES a fully-finalized group stage
  // (it throws on any missing result). Before the group stage ends we leave the
  // qualifiers empty so resolvePlaceholders keeps the placeholder labels
  // (teams shown as "por definir"); the real teams appear once groups finish.
  let winners = new Map<string, string>();
  let runnersUp = new Map<string, string>();
  let bestThirds: ReturnType<typeof determineQualifiers>["bestThirds"] = [];
  if (refPool) {
    try {
      const standings = await calculateAllGroupStandings(instanceId, refPool.id);
      const q = determineQualifiers(standings);
      winners = q.winners;
      runnersUp = q.runnersUp;
      bestThirds = q.bestThirds;
    } catch {
      // Group stage not yet fully finalized (or reference pool missing results).
    }
  }

  const groupMatchIds = new Set(matches.filter((m) => m.phaseId === "group_stage").map((m) => m.id));
  let groupFinalized = 0;
  if (refPool) {
    const results = await prisma.poolMatchResult.findMany({
      where: { poolId: refPool.id },
      select: { matchId: true, currentVersion: { select: { source: true } } },
    });
    for (const r of results) {
      if (groupMatchIds.has(r.matchId) && r.currentVersion && FINAL_RESULT_SOURCES.has(r.currentVersion.source)) {
        groupFinalized++;
      }
    }
  }
  const groupStageFinalized = groupMatchIds.size > 0 && groupFinalized === groupMatchIds.size;

  const koPhases = phases
    .filter((p) => p.type !== "GROUP")
    .sort((a, b) => a.order - b.order);

  const bracketPhases: BracketPhase[] = koPhases.map((phase) => {
    const phaseMatches = matches.filter((m) => m.phaseId === phase.id);
    const resolved = resolvePlaceholders(
      phaseMatches.map((m) => ({ id: m.id, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId })),
      winners,
      runnersUp,
      bestThirds,
    );
    const resolvedById = new Map(resolved.map((r) => [r.matchId, r]));

    return {
      phaseId: phase.id,
      name: phase.name,
      order: phase.order,
      groupStageFinalized,
      released: releasedPhases.has(phase.id),
      matches: phaseMatches.map((m) => {
        const r = resolvedById.get(m.id) ?? { homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId };
        // Admin overrides win over the FIFA-computed values.
        const ov = overrides[m.id] ?? {};
        const homeId = ov.homeTeamId ?? r.homeTeamId;
        const awayId = ov.awayTeamId ?? r.awayTeamId;
        const kickoffUtc = ov.kickoffUtc ?? m.kickoffUtc ?? null;
        return {
          matchId: m.id,
          phaseId: m.phaseId,
          kickoffUtc,
          homeId,
          awayId,
          homeName: nameById.get(homeId) ?? homeId,
          awayName: nameById.get(awayId) ?? awayId,
          homePending: isPlaceholderTeamId(homeId),
          awayPending: isPlaceholderTeamId(awayId),
        };
      }),
    };
  });

  return {
    instanceId: instance.id,
    instanceName: instance.name,
    gateEnabled: instance.knockoutReleaseGateEnabled,
    phases: bracketPhases,
    teams: teams.map((t) => ({ id: t.id, name: t.name ?? t.id, groupId: t.groupId })),
    groupProgress: { finalized: groupFinalized, total: groupMatchIds.size },
  };
}

/**
 * Persist admin edits to the computed bracket (team/date/time per match). The
 * `overrides` map is keyed by matchId; an empty object for a match clears it.
 * Validates team ids exist in the instance and kickoff is a valid ISO string.
 */
export async function saveKnockoutBracketOverrides(
  instanceId: string,
  overrides: Record<string, BracketOverride>,
): Promise<{ saved: number }> {
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: instanceId },
    select: { dataJson: true, knockoutBracketOverrides: true },
  });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  const teams = extractTeams(instance.dataJson);
  const matches = extractMatches(instance.dataJson);
  const teamIds = new Set(teams.map((t) => t.id));
  const matchIds = new Set(matches.map((m) => m.id));

  const clean: Record<string, BracketOverride> = {};
  for (const [matchId, ov] of Object.entries(overrides ?? {})) {
    if (!matchIds.has(matchId)) throw new ServiceError("INVALID_MATCH", 400, { matchId });
    const next: BracketOverride = {};
    if (ov.homeTeamId !== undefined) {
      if (!teamIds.has(ov.homeTeamId)) throw new ServiceError("INVALID_TEAM", 400, { teamId: ov.homeTeamId });
      next.homeTeamId = ov.homeTeamId;
    }
    if (ov.awayTeamId !== undefined) {
      if (!teamIds.has(ov.awayTeamId)) throw new ServiceError("INVALID_TEAM", 400, { teamId: ov.awayTeamId });
      next.awayTeamId = ov.awayTeamId;
    }
    if (ov.kickoffUtc !== undefined) {
      if (Number.isNaN(new Date(ov.kickoffUtc).getTime())) throw new ServiceError("INVALID_KICKOFF", 400, { matchId });
      next.kickoffUtc = ov.kickoffUtc;
    }
    if (Object.keys(next).length > 0) clean[matchId] = next;
  }

  // Merge into the existing overrides so the panel only needs to send the
  // matches it touched this session (not the full map).
  const existing = (instance.knockoutBracketOverrides as Record<string, BracketOverride> | null) ?? {};
  const merged: Record<string, BracketOverride> = { ...existing };
  for (const [matchId, ov] of Object.entries(clean)) {
    merged[matchId] = { ...existing[matchId], ...ov };
  }

  await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: { knockoutBracketOverrides: merged as Prisma.InputJsonValue },
  });
  return { saved: Object.keys(merged).length };
}

/**
 * Send a PREVIEW of the phase-summary email to the requesting admin (their own
 * email), computed from a pool they belong to. Lets the admin see the real email
 * before the broadcast. Adapts to the pool's scoring mode (score vs structural).
 */
export async function sendPhaseSummaryTestToSelf(userId: string): Promise<{ sent: boolean; poolName?: string; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true, locale: true } });
  if (!user) throw new ServiceError("NOT_FOUND", 404);

  const membership = await prisma.poolMember.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { poolId: true },
    orderBy: { joinedAtUtc: "asc" },
  });
  if (!membership) throw new ServiceError("NO_POOL", 400, { message: "No eres miembro activo de ninguna pool" });

  const ov = (await getPoolOverview(userId, membership.poolId, false)) as unknown as {
    pool: { name: string; pickTypesConfig: unknown };
    matches: Array<{ phaseId: string; result: unknown }>;
    tournamentInstance: { dataJson: unknown };
    leaderboard: {
      presetMode: string;
      rows: Array<{ userId: string; rank: number; displayName: string; points: number; perfectCount?: number; partialCount?: number; structuralStats?: unknown }>;
    };
  };
  // Next phase after the group stage (for the "we'll open X in 15 min" line).
  const orderedPhases = extractPhases(ov.tournamentInstance.dataJson).sort((a, b) => a.order - b.order);
  const groupIdx = orderedPhases.findIndex((p) => p.id === "group_stage");
  const nextPhaseName = groupIdx >= 0 && orderedPhases[groupIdx + 1] ? orderedPhases[groupIdx + 1]!.name : null;
  const rows = ov.leaderboard.rows;
  const mine = rows.find((r) => r.userId === userId) ?? rows[0];
  if (!mine) throw new ServiceError("NO_DATA", 400, { message: "La pool aún no tiene leaderboard" });
  const leader = rows.find((r) => r.rank === 1) ?? rows[0]!;
  const podium = rows.slice(0, 3).map((r) => ({ name: r.displayName, points: r.points, isViewer: r.userId === userId }));

  const countByPhase = new Map<string, number>();
  for (const m of ov.matches) if (m.result) countByPhase.set(m.phaseId, (countByPhase.get(m.phaseId) ?? 0) + 1);
  const totalPossible = calculateMaxPointsForPool((ov.pool.pickTypesConfig ?? []) as PhasePickConfig[], countByPhase);
  const mode = ov.leaderboard.presetMode === "STRUCTURAL" ? "structural" : "score";

  const res = await sendPhaseSummaryEmail({
    to: user.email,
    userId,
    memberName: user.displayName ?? "Jugador",
    poolName: ov.pool.name,
    poolId: membership.poolId,
    phaseName: "la fase de grupos",
    nextPhaseName,
    rank: mine.rank,
    totalMembers: rows.length,
    points: mine.points,
    pointsBehindLeader: Math.max(0, leader.points - mine.points),
    totalPossible,
    podium,
    mode,
    score: { perfect: mine.perfectCount ?? 0, partial: mine.partialCount ?? 0 },
    structural: mine.structuralStats as { positionsCorrect: number; positionsTotal: number; perfectGroups: number; totalGroups: number } | undefined,
    locale: user.locale ?? "es",
  });

  // Also send the "phase open" email (#2) so both designs can be validated.
  let releaseOk = true;
  let releaseErr: string | undefined;
  if (nextPhaseName) {
    const rel = await sendPhaseReleaseEmail({
      to: user.email,
      userId,
      memberName: user.displayName ?? "Jugador",
      poolName: ov.pool.name,
      poolId: membership.poolId,
      phaseName: nextPhaseName,
      locale: user.locale ?? "es",
    });
    releaseOk = rel.success;
    releaseErr = rel.error;
  }

  return { sent: res.success && releaseOk, poolName: ov.pool.name, error: res.error ?? releaseErr };
}

/** Turn the admin knockout-release gate on/off for an instance (opt-in). */
export async function setKnockoutReleaseGate(
  instanceId: string,
  enabled: boolean,
): Promise<{ gateEnabled: boolean }> {
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId }, select: { id: true } });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);
  await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: { knockoutReleaseGateEnabled: enabled },
  });
  return { gateEnabled: enabled };
}

/** Release (or re-lock) a knockout phase for predictions. */
export async function setKnockoutPhaseReleased(
  instanceId: string,
  phaseId: string,
  released: boolean,
): Promise<{ phaseId: string; released: boolean }> {
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: instanceId },
    select: { dataJson: true, releasedKnockoutPhases: true },
  });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  const phases = extractPhases(instance.dataJson);
  const phase = phases.find((p) => p.id === phaseId);
  if (!phase || phase.type === "GROUP") throw new ServiceError("INVALID_PHASE", 400, { phaseId });

  const current = new Set((instance.releasedKnockoutPhases as string[] | null) ?? []);
  if (released) current.add(phaseId);
  else current.delete(phaseId);

  await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: { releasedKnockoutPhases: [...current] as Prisma.InputJsonValue },
  });
  return { phaseId, released };
}
