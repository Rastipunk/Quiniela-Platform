/**
 * Group Standings Service — Pure business logic for group standings picks and results.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Audit context (ip, userAgent) passed as a separate object.
 *   - Side effects (audit) are fire-and-forget but logged on failure.
 */

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { canMakePicks } from "./poolStateMachine";
import { advanceToRoundOf32, validateCanAutoAdvance } from "./instanceAdvancement";
import { requirePoolAdmin } from "../lib/roles";
import { extractMatches, parseFixtureData } from "../lib/fixture";
import { fireAndForget } from "../lib/asyncHelpers";
import { ServiceError, type AuditContext } from "./authService";

// ─── Helpers ─────────────────────────────────────────────────

async function requireActivePoolMember(userId: string, poolId: string): Promise<boolean> {
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  return member != null;
}

// ─── Player Picks ────────────────────────────────────────────

/** Save/update a group standings pick for a specific group. */
export async function upsertGroupStandingsPick(
  userId: string,
  poolId: string,
  phaseId: string,
  groupId: string,
  teamIds: string[],
  ctx: AuditContext,
) {
  const isMember = await requireActivePoolMember(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  if (!canMakePicks(pool.status)) {
    throw new ServiceError("CONFLICT", 409, { message: "Cannot make picks in this pool status" });
  }

  if (pool.tournamentInstance.status === "ARCHIVED") {
    throw new ServiceError("CONFLICT", 409, { message: "TournamentInstance is ARCHIVED" });
  }

  // Host can manually freeze a phase to prepare errata results.
  // Take precedence over the kickoff deadline below.
  const lockedPhases = (pool.lockedPhases as string[] | null) ?? [];
  if (lockedPhases.includes(phaseId)) {
    throw new ServiceError("PHASE_LOCKED", 409, {
      message: "Phase is locked by the host",
      phaseId,
    });
  }

  // Group standings predictions lock when the group's first match
  // hits its pool-level deadline window — once the first match
  // starts, the standings begin to be revealed and predictions can
  // no longer be edited honestly. Read from fixtureSnapshot first
  // (CLAUDE.md §6 invariant 6).
  const fixtureData = pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson;
  const allMatches = extractMatches(fixtureData);
  const groupMatches = allMatches.filter((m) => m.groupId === groupId);
  if (groupMatches.length === 0) {
    throw new ServiceError("NOT_FOUND", 404, {
      message: "Group not found in pool fixture",
      groupId,
    });
  }
  const earliestKickoff = Math.min(
    ...groupMatches.map((m) => new Date(m.kickoffUtc).getTime()),
  );
  const lockTime =
    earliestKickoff - pool.deadlineMinutesBeforeKickoff * 60_000;
  if (Date.now() >= lockTime) {
    throw new ServiceError("DEADLINE_PASSED", 409, {
      message: "Group standings prediction is locked",
      groupId,
      lockTimeUtc: new Date(lockTime).toISOString(),
      nowUtc: new Date().toISOString(),
    });
  }

  const prediction = await prisma.groupStandingsPrediction.upsert({
    where: {
      poolId_userId_phaseId_groupId: { poolId, userId, phaseId, groupId },
    },
    update: { teamIds },
    create: { poolId, userId, phaseId, groupId, teamIds },
  });

  fireAndForget("audit:group-pick-upsert", writeAuditEvent({
    actorUserId: userId,
    action: "GROUP_STANDINGS_PREDICTION_UPSERTED",
    entityType: "GroupStandingsPrediction",
    entityId: prediction.id,
    dataJson: { poolId, phaseId, groupId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return prediction;
}

/** Get a specific group standings pick for the current user. */
export async function getGroupStandingsPick(
  userId: string,
  poolId: string,
  phaseId: string,
  groupId: string,
) {
  const isMember = await requireActivePoolMember(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const prediction = await prisma.groupStandingsPrediction.findUnique({
    where: {
      poolId_userId_phaseId_groupId: { poolId, userId, phaseId, groupId },
    },
  });

  return { prediction };
}

/** Get all group standings picks for a phase for the current user. */
export async function getGroupStandingsPicksByPhase(
  userId: string,
  poolId: string,
  phaseId: string,
) {
  const isMember = await requireActivePoolMember(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const predictions = await prisma.groupStandingsPrediction.findMany({
    where: { poolId, userId, phaseId },
  });

  return { predictions };
}

// ─── Host Results ────────────────────────────────────────────

/** Publish official result for a specific group. */
export async function publishGroupStandingsResult(
  userId: string,
  poolId: string,
  phaseId: string,
  groupId: string,
  teamIds: string[],
  reason: string | undefined,
  ctx: AuditContext,
) {
  const isHostOrCoAdmin = await requirePoolAdmin(userId, poolId);
  if (!isHostOrCoAdmin) {
    throw new ServiceError("FORBIDDEN", 403, { message: "Only HOST or CO_ADMIN can publish results" });
  }

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  const existingResult = await prisma.groupStandingsResult.findUnique({
    where: { poolId_phaseId_groupId: { poolId, phaseId, groupId } },
  });

  const isErrata = existingResult !== null;

  if (isErrata && !reason?.trim()) {
    throw new ServiceError("VALIDATION_ERROR", 400, { reason: "ERRATA_REASON_REQUIRED" });
  }

  const result = await prisma.groupStandingsResult.upsert({
    where: { poolId_phaseId_groupId: { poolId, phaseId, groupId } },
    update: {
      teamIds,
      createdByUserId: userId,
      publishedAtUtc: new Date(),
      version: { increment: 1 },
      reason,
    },
    create: {
      poolId, phaseId, groupId, teamIds,
      createdByUserId: userId,
      version: 1,
    },
  });

  fireAndForget("audit:group-result", writeAuditEvent({
    actorUserId: userId,
    action: isErrata ? "GROUP_STANDINGS_RESULT_ERRATA" : "GROUP_STANDINGS_RESULT_PUBLISHED",
    entityType: "GroupStandingsResult",
    entityId: result.id,
    dataJson: { poolId, phaseId, groupId, version: result.version, reason },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return {
    result,
    isErrata,
    previousTeamIds: (existingResult?.teamIds as string[] | undefined) ?? null,
  };
}

/** Get official result for a specific group. */
export async function getGroupStandingsResult(
  userId: string,
  poolId: string,
  phaseId: string,
  groupId: string,
) {
  const isMember = await requireActivePoolMember(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const result = await prisma.groupStandingsResult.findUnique({
    where: { poolId_phaseId_groupId: { poolId, phaseId, groupId } },
  });

  return { result };
}

/** Get all official results for a phase. */
export async function getGroupStandingsResultsByPhase(
  userId: string,
  poolId: string,
  phaseId: string,
) {
  const isMember = await requireActivePoolMember(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const results = await prisma.groupStandingsResult.findMany({
    where: { poolId, phaseId },
  });

  return { results };
}

// ─── Generate Standings from Match Results ───────────────────

/** Calculate and save group standings from match results. */
export async function generateGroupStandings(
  userId: string,
  poolId: string,
  phaseId: string,
  groupId: string,
  ctx: AuditContext,
) {
  const isHostOrCoAdmin = await requirePoolAdmin(userId, poolId);
  if (!isHostOrCoAdmin) {
    throw new ServiceError("FORBIDDEN", 403, { message: "Only HOST or CO_ADMIN can generate standings" });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  const data = parseFixtureData(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
  if (!data?.matches || !data?.teams) {
    throw new ServiceError("INVALID_DATA", 400, { message: "No tournament data found" });
  }

  const groupMatches = data.matches.filter((m) => m.groupId === groupId);
  if (groupMatches.length === 0) {
    throw new ServiceError("NOT_FOUND", 404, { message: "No matches found for group" });
  }

  const matchIds = groupMatches.map((m) => m.id);
  const results = await prisma.poolMatchResult.findMany({
    where: { poolId, matchId: { in: matchIds } },
    include: { currentVersion: true },
  });

  const resultsWithVersion = results.filter((r) => r.currentVersion !== null);
  if (resultsWithVersion.length !== groupMatches.length) {
    throw new ServiceError("INCOMPLETE", 400, {
      message: `Only ${resultsWithVersion.length}/${groupMatches.length} matches have results`,
    });
  }

  // Collect team IDs
  const teamIds = new Set<string>();
  groupMatches.forEach((m) => {
    teamIds.add(m.homeTeamId);
    teamIds.add(m.awayTeamId);
  });

  // Calculate standings
  const standingsMap = new Map<string, any>();
  teamIds.forEach((teamId) => {
    standingsMap.set(teamId, {
      teamId, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    });
  });

  for (const result of resultsWithVersion) {
    const match = groupMatches.find((m) => m.id === result.matchId);
    if (!match || !result.currentVersion) continue;

    const home = standingsMap.get(match.homeTeamId);
    const away = standingsMap.get(match.awayTeamId);
    if (!home || !away) continue;

    const homeGoals = result.currentVersion.homeGoals;
    const awayGoals = result.currentVersion.awayGoals;

    home.played++;
    away.played++;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      home.won++; home.points += 3; away.lost++;
    } else if (homeGoals < awayGoals) {
      away.won++; away.points += 3; home.lost++;
    } else {
      home.drawn++; away.drawn++; home.points += 1; away.points += 1;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  // Sort by FIFA criteria
  const standingsArray = Array.from(standingsMap.values());
  standingsArray.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return 0;
  });

  const orderedTeamIds = standingsArray.map((s) => s.teamId);

  const existingResult = await prisma.groupStandingsResult.findUnique({
    where: { poolId_phaseId_groupId: { poolId, phaseId, groupId } },
  });

  const savedResult = await prisma.groupStandingsResult.upsert({
    where: { poolId_phaseId_groupId: { poolId, phaseId, groupId } },
    update: {
      teamIds: orderedTeamIds,
      createdByUserId: userId,
      publishedAtUtc: new Date(),
      version: existingResult ? { increment: 1 } : 1,
      reason: existingResult ? "Regenerado desde resultados de partidos" : null,
    },
    create: {
      poolId, phaseId, groupId, teamIds: orderedTeamIds,
      createdByUserId: userId, version: 1,
    },
  });

  fireAndForget("audit:group-generated", writeAuditEvent({
    actorUserId: userId,
    action: "GROUP_STANDINGS_GENERATED",
    entityType: "GroupStandingsResult",
    entityId: savedResult.id,
    dataJson: { poolId, phaseId, groupId, standings: standingsArray },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  // Auto-advance check
  let autoAdvanceResult = null;
  try {
    const allGroups = new Set<string>();
    data.matches?.forEach((m) => {
      if (m.groupId && (!m.phaseId || m.phaseId === phaseId)) allGroups.add(m.groupId);
    });

    const allGroupResults = await prisma.groupStandingsResult.findMany({
      where: { poolId, phaseId },
    });

    console.log(`[AUTO-ADVANCE CHECK] Groups in phase: ${allGroups.size}, Results: ${allGroupResults.length}`);

    if (allGroupResults.length === allGroups.size && allGroups.size > 0) {
      const validation = await validateCanAutoAdvance(pool.tournamentInstance.id, phaseId, poolId);

      if (validation.canAdvance) {
        console.log(`[AUTO-ADVANCE] All groups complete. Advancing to Round of 32...`);

        const advResult = await advanceToRoundOf32(pool.tournamentInstance.id, poolId);
        autoAdvanceResult = {
          advanced: true,
          phase: "round_of_32",
          winnersCount: advResult.winners.size,
          runnersUpCount: advResult.runnersUp.size,
          bestThirdsCount: advResult.bestThirds.length,
        };

        fireAndForget("audit:auto-advance-r32", writeAuditEvent({
          actorUserId: userId,
          action: "TOURNAMENT_AUTO_ADVANCED_TO_R32",
          entityType: "TournamentInstance",
          entityId: pool.tournamentInstance.id,
          dataJson: {
            triggeredBy: "GROUP_STANDINGS_GENERATE",
            groupId,
            ...autoAdvanceResult,
          },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        }));

        console.log(`[AUTO-ADVANCE SUCCESS] Advanced to Round of 32`);
      } else {
        console.log(`[AUTO-ADVANCE BLOCKED] Reason: ${validation.reason}`);
      }
    }
  } catch (autoAdvanceError: any) {
    console.error("[AUTO-ADVANCE ERROR]", autoAdvanceError.message);
  }

  return {
    result: savedResult,
    standings: standingsArray,
    autoAdvance: autoAdvanceResult,
  };
}

// ─── Group Match Results ─────────────────────────────────────

/** Get match results for a specific group. */
export async function getGroupMatchResults(
  userId: string,
  poolId: string,
  groupId: string,
) {
  const isMember = await requireActivePoolMember(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  const data = parseFixtureData(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
  const groupMatches = data.matches?.filter((m) => m.groupId === groupId) || [];
  const matchIds = groupMatches.map((m) => m.id);

  const results = await prisma.poolMatchResult.findMany({
    where: { poolId, matchId: { in: matchIds } },
    include: { currentVersion: true },
  });

  const resultsByMatch = new Map<string, any>();
  for (const r of results) {
    if (r.currentVersion) {
      resultsByMatch.set(r.matchId, {
        matchId: r.matchId,
        homeGoals: r.currentVersion.homeGoals,
        awayGoals: r.currentVersion.awayGoals,
      });
    }
  }

  return {
    matches: groupMatches,
    results: Object.fromEntries(resultsByMatch),
    completedCount: resultsByMatch.size,
    totalCount: groupMatches.length,
  };
}
