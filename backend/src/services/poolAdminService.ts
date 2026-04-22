/**
 * Pool Admin Service — Pure business logic for pool administration.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Audit context (ip, userAgent) passed as a separate object.
 *   - Side effects (audit) are fire-and-forget but logged on failure.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { getScoringPreset } from "../lib/scoringPresets";
import { requirePoolAdmin, isPoolOwner, isPoolAdmin } from "../lib/roles";
import {
  advanceToRoundOf32,
  advanceKnockoutPhase,
  validateGroupStageComplete,
} from "./instanceAdvancement";
import { transitionToArchived } from "./poolStateMachine";
import { scoreMatchPick } from "../lib/scoringAdvanced";
import {
  generateMatchPickBreakdown,
  generateGroupStandingsBreakdown,
  generateKnockoutWinnerBreakdown,
} from "../lib/scoringBreakdown";
import { outcomeFromScore } from "../lib/poolHelpers";
import {
  extractMatches,
  extractTeams,
  extractPhases,
  parseFixtureData,
  typed,
  type FixtureMatch,
  type PickJson,
  type StructuralPickJson,
} from "../lib/fixture";
import type { PhasePickConfig } from "../types/pickConfig";
import { fireAndForget } from "../lib/asyncHelpers";
import { ServiceError, type AuditContext } from "./authService";

// ─── Scoring Override ────────────────────────────────────────

export async function setScoringOverride(
  userId: string,
  poolId: string,
  matchId: string,
  scoringEnabled: boolean,
  reason: string | undefined,
  ctx: AuditContext,
) {
  const isHostOrCoAdmin = await requirePoolAdmin(userId, poolId);
  if (!isHostOrCoAdmin) throw new ServiceError("FORBIDDEN", 403);

  if (scoringEnabled) {
    await prisma.poolMatchOverride.deleteMany({ where: { poolId, matchId } });
  } else {
    await prisma.poolMatchOverride.upsert({
      where: { poolId_matchId: { poolId, matchId } },
      create: { poolId, matchId, scoringEnabled: false, reason: reason || null, setByUserId: userId },
      update: { scoringEnabled: false, reason: reason || null, setByUserId: userId, setAtUtc: new Date() },
    });
  }

  fireAndForget("audit:scoring-override", writeAuditEvent({
    actorUserId: userId,
    action: scoringEnabled ? "MATCH_SCORING_ENABLED" : "MATCH_SCORING_DISABLED",
    entityType: "PoolMatchOverride",
    entityId: `${poolId}:${matchId}`,
    poolId,
    dataJson: { matchId, scoringEnabled, reason },
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
  }));

  return { scoringEnabled, matchId };
}

// ─── Advance Phase ───────────────────────────────────────────

export async function advancePhase(
  userId: string,
  poolId: string,
  currentPhaseId: string,
  nextPhaseId: string | undefined,
  ctx: AuditContext,
) {
  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  if (!myMembership || !isPoolOwner(myMembership.role)) {
    throw new ServiceError("OWNER_ONLY", 403);
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  let result: any;
  let actualNextPhaseId: string;

  if (currentPhaseId === "group_stage") {
    const validation = await validateGroupStageComplete(pool.tournamentInstance.id, poolId);
    if (!validation.isComplete) {
      throw new ServiceError(
        `Fase de grupos incompleta. Faltan ${validation.missingMatches.length} partido(s)`,
        400,
      );
    }

    result = await advanceToRoundOf32(pool.tournamentInstance.id, poolId);
    actualNextPhaseId = "round_of_32";

    fireAndForget("audit:manual-advance-r32", writeAuditEvent({
      actorUserId: userId,
      action: "TOURNAMENT_MANUAL_ADVANCED_TO_R32",
      entityType: "TournamentInstance",
      entityId: pool.tournamentInstance.id,
      dataJson: {
        triggeredBy: "MANUAL_HOST_ACTION",
        poolId,
        winnersCount: result.winners.size,
        runnersUpCount: result.runnersUp.size,
        bestThirdsCount: result.bestThirds.length,
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    }));
  } else {
    let derivedNextPhase: string | undefined;
    const instancePhases = extractPhases(pool.tournamentInstance!.dataJson);
    if (instancePhases.length > 0) {
      const sorted = [...instancePhases].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((p) => p.id === currentPhaseId);
      if (idx >= 0 && idx < sorted.length - 1) {
        derivedNextPhase = sorted[idx + 1]?.id;
      }
    }

    if (!derivedNextPhase) {
      const phaseOrderFallback: Record<string, string> = {
        round_of_32: "round_of_16",
        round_of_16: "quarter_finals",
        quarter_finals: "semi_finals",
        semi_finals: "finals",
      };
      derivedNextPhase = phaseOrderFallback[currentPhaseId];
    }

    actualNextPhaseId = nextPhaseId || derivedNextPhase || "";
    if (!actualNextPhaseId) throw new ServiceError("INVALID_PHASE", 400);

    result = await advanceKnockoutPhase(
      pool.tournamentInstance.id,
      currentPhaseId,
      actualNextPhaseId,
      poolId,
    );

    fireAndForget("audit:manual-advance-knockout", writeAuditEvent({
      actorUserId: userId,
      action: "TOURNAMENT_MANUAL_ADVANCED_KNOCKOUT",
      entityType: "TournamentInstance",
      entityId: pool.tournamentInstance.id,
      dataJson: {
        triggeredBy: "MANUAL_HOST_ACTION",
        poolId,
        from: currentPhaseId,
        to: actualNextPhaseId,
        resolvedMatchesCount: result.resolvedMatches.length,
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    }));
  }

  return {
    message: `Avance manual exitoso: ${currentPhaseId} → ${actualNextPhaseId}`,
    data: { currentPhaseId, nextPhaseId: actualNextPhaseId, ...result },
  };
}

// ─── Update Pool Settings ────────────────────────────────────

export async function updatePoolSettings(
  userId: string,
  poolId: string,
  changes: {
    autoAdvanceEnabled?: boolean;
    requireApproval?: boolean;
    extraTimePhases?: string[];
  },
  ctx: AuditContext,
) {
  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  if (!myMembership || !isPoolOwner(myMembership.role)) {
    throw new ServiceError("OWNER_ONLY", 403);
  }

  const { autoAdvanceEnabled, requireApproval, extraTimePhases } = changes;

  let pickTypesConfigUpdate: PhasePickConfig[] | undefined;
  if (extraTimePhases !== undefined) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: {
        pickTypesConfig: true,
        deadlineMinutesBeforeKickoff: true,
        tournamentInstance: { select: { dataJson: true } },
      },
    });
    if (!pool) throw new ServiceError("NOT_FOUND", 404);

    const phaseConfigs = pool.pickTypesConfig as PhasePickConfig[] | null;
    if (!phaseConfigs) throw new ServiceError("Pool has no pick types config", 400);

    const fixtureData = parseFixtureData(pool.tournamentInstance?.dataJson);
    const allMatches = fixtureData.matches;

    const resultsRaw = await prisma.poolMatchResult.findMany({
      where: { poolId },
      include: { currentVersion: true },
    });
    const resultsByPhase = new Map<string, any[]>();
    for (const r of resultsRaw) {
      if (r.currentVersion) {
        const match = allMatches.find((m) => m.id === r.matchId);
        if (match?.phaseId) {
          const arr = resultsByPhase.get(match.phaseId) ?? [];
          arr.push(r.currentVersion);
          resultsByPhase.set(match.phaseId, arr);
        }
      }
    }

    const now = Date.now();
    pickTypesConfigUpdate = phaseConfigs.map((pc) => {
      const wantET = extraTimePhases.includes(pc.phaseId);
      const currentET = pc.includeExtraTime ?? false;
      if (wantET === currentET) return pc;

      const phaseResults = resultsByPhase.get(pc.phaseId) ?? [];
      const hasOldResults = phaseResults.some((r: any) => r.homeGoals90 === null && r.homeGoals !== null);
      if (hasOldResults) return pc;

      const phaseMatches = allMatches.filter((m) => m.phaseId === pc.phaseId);
      const allHaveResults = phaseMatches.length > 0 &&
        phaseMatches.every((m) => resultsRaw.some((r) => r.matchId === m.id && r.currentVersion));
      if (allHaveResults) return pc;

      const deadlineMinutes = pool.deadlineMinutesBeforeKickoff;
      const phaseKickoffs = phaseMatches
        .filter((m: any) => m.kickoffUtc)
        .map((m: any) => new Date(m.kickoffUtc).getTime() - deadlineMinutes * 60_000);
      const firstDeadline = phaseKickoffs.length > 0 ? Math.min(...phaseKickoffs) : Infinity;
      const hoursUntil = (firstDeadline - now) / (1000 * 60 * 60);
      if (hoursUntil < 48) return pc;

      return { ...pc, includeExtraTime: wantET };
    });
  }

  const updatedPool = await prisma.pool.update({
    where: { id: poolId },
    data: {
      ...(autoAdvanceEnabled !== undefined ? { autoAdvanceEnabled } : {}),
      ...(requireApproval !== undefined ? { requireApproval } : {}),
      ...(pickTypesConfigUpdate ? { pickTypesConfig: pickTypesConfigUpdate as Prisma.InputJsonValue } : {}),
    },
  });

  fireAndForget("audit:pool-settings", writeAuditEvent({
    action: "POOL_SETTINGS_UPDATED",
    actorUserId: userId,
    poolId,
    dataJson: { changes },
  }));

  return {
    pool: {
      id: updatedPool.id,
      autoAdvanceEnabled: updatedPool.autoAdvanceEnabled,
      requireApproval: updatedPool.requireApproval,
      pickTypesConfig: updatedPool.pickTypesConfig,
    },
  };
}

// ─── Lock / Unlock Phase ─────────────────────────────────────

export async function setPhaselock(
  userId: string,
  poolId: string,
  phaseId: string,
  locked: boolean,
  _ctx: AuditContext,
) {
  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  if (!myMembership || !isPoolOwner(myMembership.role)) {
    throw new ServiceError("OWNER_ONLY", 403);
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { lockedPhases: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  const currentLocked = (pool.lockedPhases as string[]) || [];
  let updatedLocked: string[];
  if (locked) {
    updatedLocked = currentLocked.includes(phaseId) ? currentLocked : [...currentLocked, phaseId];
  } else {
    updatedLocked = currentLocked.filter((id) => id !== phaseId);
  }

  const updatedPool = await prisma.pool.update({
    where: { id: poolId },
    data: { lockedPhases: updatedLocked },
  });

  fireAndForget("audit:phase-lock", writeAuditEvent({
    action: locked ? "PHASE_LOCKED" : "PHASE_UNLOCKED",
    actorUserId: userId,
    poolId,
    dataJson: { phaseId },
  }));

  return { pool: { id: updatedPool.id, lockedPhases: updatedPool.lockedPhases } };
}

// ─── Archive Pool ────────────────────────────────────────────

export async function archivePool(userId: string, poolId: string) {
  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  if (!myMembership || !isPoolOwner(myMembership.role)) {
    throw new ServiceError("OWNER_ONLY", 403);
  }

  try {
    await transitionToArchived(poolId, userId);
  } catch (e: any) {
    if (e.message === "Pool not found") throw new ServiceError("NOT_FOUND", 404);
    if (e.message === "Pool must be COMPLETED to archive") throw new ServiceError(e.message, 409);
    throw e;
  }
}

// ─── Match Pick Breakdown ────────────────────────────────────

export async function getMatchPickBreakdown(
  userId: string,
  poolId: string,
  matchId: string,
) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      tournamentInstance: true,
      members: { where: { userId, status: "ACTIVE" } },
    },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);
  if (pool.members.length === 0) throw new ServiceError("NOT_A_MEMBER", 403);

  const fixtureData = parseFixtureData(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
  const match = fixtureData.matches.find((m) => m.id === matchId);
  if (!match) throw new ServiceError("NOT_FOUND", 404);

  const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;
  if (!pickTypesConfig) throw new ServiceError("NO_PICK_CONFIG", 400);

  const phaseConfig = pickTypesConfig.find((p) => p.phaseId === match.phaseId);
  if (!phaseConfig) throw new ServiceError("Fase no configurada", 400);
  if (!phaseConfig.requiresScore || !phaseConfig.matchPicks) {
    throw new ServiceError("Esta fase no usa picks de marcador", 400);
  }

  const userPick = await prisma.prediction.findUnique({
    where: { poolId_userId_matchId: { poolId, matchId, userId } },
  });

  const result = await prisma.poolMatchResult.findUnique({
    where: { poolId_matchId: { poolId, matchId } },
    include: { currentVersion: true },
  });

  const pickJson = userPick?.pickJson as { type?: string; homeGoals?: number; awayGoals?: number } | null;
  const pickData = pickJson && typeof pickJson.homeGoals === "number" && typeof pickJson.awayGoals === "number"
    ? { homeGoals: pickJson.homeGoals, awayGoals: pickJson.awayGoals }
    : null;

  const resultData = result?.currentVersion
    ? { homeGoals: result.currentVersion.homeGoals, awayGoals: result.currentVersion.awayGoals }
    : null;

  const breakdown = generateMatchPickBreakdown(pickData, resultData, phaseConfig, matchId);

  const teams = fixtureData?.teams || [];
  const homeTeam = teams.find((t: any) => t.id === match.homeTeamId);
  const awayTeam = teams.find((t: any) => t.id === match.awayTeamId);

  return {
    breakdown,
    match: {
      id: matchId,
      phaseId: match.phaseId,
      homeTeam: { id: match.homeTeamId, name: homeTeam?.name || match.homeTeamId },
      awayTeam: { id: match.awayTeamId, name: awayTeam?.name || match.awayTeamId },
      kickoffUtc: match.kickoffUtc,
    },
  };
}

// ─── Phase Structural Breakdown ──────────────────────────────

export async function getPhaseBreakdown(
  userId: string,
  poolId: string,
  phaseId: string,
) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      tournamentInstance: true,
      members: { where: { userId, status: "ACTIVE" } },
    },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);
  if (pool.members.length === 0) throw new ServiceError("NOT_A_MEMBER", 403);

  const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;
  if (!pickTypesConfig) throw new ServiceError("NO_PICK_CONFIG", 400);

  const phaseConfig = pickTypesConfig.find((p) => p.phaseId === phaseId);
  if (!phaseConfig) throw new ServiceError("Fase no configurada", 400);
  if (phaseConfig.requiresScore || !phaseConfig.structuralPicks) {
    throw new ServiceError("Esta fase no usa picks estructurales", 400);
  }

  const fixtureData = parseFixtureData(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
  const matches = fixtureData.matches;
  const teams = fixtureData.teams;
  const rawJson = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as Record<string, unknown>;
  const groups = (Array.isArray(rawJson.groups) ? rawJson.groups : []) as Array<{ id: string; name?: string; teamCount?: number }>;

  const teamsMap = new Map<string, { id: string; name: string }>();
  teams.forEach((t) => {
    teamsMap.set(t.id, { id: t.id, name: t.name || t.code || t.id });
  });

  const userPick = await prisma.structuralPrediction.findUnique({
    where: { poolId_userId_phaseId: { poolId, phaseId, userId } },
  });

  const result = await prisma.structuralPhaseResult.findFirst({
    where: { poolId, phaseId },
    orderBy: { createdAtUtc: "desc" },
  });

  const structuralType = phaseConfig.structuralPicks.type;

  if (structuralType === "GROUP_STANDINGS") {
    let groupsInfo: Array<{ id: string; name: string; teamCount: number }> = [];

    if (groups && groups.length > 0) {
      groupsInfo = groups.map((g: any) => ({
        id: g.id,
        name: g.name || `Grupo ${g.id}`,
        teamCount: g.teamIds?.length || 4,
      }));
    }

    if (groupsInfo.length === 0) {
      const groupsMap = new Map<string, Set<string>>();
      teams.forEach((t: any) => {
        if (t.groupId) {
          if (!groupsMap.has(t.groupId)) groupsMap.set(t.groupId, new Set());
          groupsMap.get(t.groupId)!.add(t.id);
        }
      });
      groupsMap.forEach((teamIds, groupId) => {
        groupsInfo.push({ id: groupId, name: `Grupo ${groupId}`, teamCount: teamIds.size });
      });
      groupsInfo.sort((a, b) => a.id.localeCompare(b.id));
    }

    if (groupsInfo.length === 0) {
      const groupIds = new Set<string>();
      matches.filter((m) => m.groupId).forEach((m) => groupIds.add(m.groupId!));
      groupIds.forEach((gId) => groupsInfo.push({ id: gId, name: `Grupo ${gId}`, teamCount: 4 }));
    }

    const breakdown = generateGroupStandingsBreakdown(
      userPick?.pickJson as { groups: Array<{ groupId: string; teamIds: string[] }> } | null ?? null,
      result?.resultJson as { groups: Array<{ groupId: string; teamIds: string[] }> } | null ?? null,
      phaseConfig,
      groupsInfo,
      teamsMap,
    );

    return { breakdown };
  } else if (structuralType === "KNOCKOUT_WINNER") {
    const phaseMatches = matches
      .filter((m) => m.phaseId === phaseId)
      .map((m) => ({ id: m.id, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId }));

    const matchResults = await prisma.poolMatchResult.findMany({
      where: { poolId, matchId: { in: phaseMatches.map((m) => m.id) } },
      include: { currentVersion: true },
    });

    const knockoutResultData: { matches: Array<{ matchId: string; winnerId: string }> } = { matches: [] };

    for (const matchResult of matchResults) {
      if (matchResult.currentVersion) {
        const cv = matchResult.currentVersion;
        const matchInfo = phaseMatches.find((m) => m.id === matchResult.matchId);
        if (matchInfo) {
          let winnerId: string;
          if (cv.homeGoals > cv.awayGoals) {
            winnerId = matchInfo.homeTeamId;
          } else if (cv.awayGoals > cv.homeGoals) {
            winnerId = matchInfo.awayTeamId;
          } else {
            if (cv.homePenalties !== null && cv.awayPenalties !== null) {
              winnerId = cv.homePenalties > cv.awayPenalties ? matchInfo.homeTeamId : matchInfo.awayTeamId;
            } else {
              continue;
            }
          }
          knockoutResultData.matches.push({ matchId: matchResult.matchId, winnerId });
        }
      }
    }

    const breakdown = generateKnockoutWinnerBreakdown(
      userPick?.pickJson as { matches: Array<{ matchId: string; winnerId: string }> } | null ?? null,
      knockoutResultData.matches.length > 0 ? knockoutResultData : null,
      phaseConfig,
      phaseMatches,
      teamsMap,
    );

    return { breakdown };
  } else {
    throw new ServiceError(`Tipo estructural no soportado: ${structuralType}`, 400);
  }
}

// ─── Group Breakdown ─────────────────────────────────────────

export async function getGroupBreakdown(
  userId: string,
  poolId: string,
  groupId: string,
) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      tournamentInstance: true,
      members: { where: { userId, status: "ACTIVE" } },
    },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);
  if (pool.members.length === 0) throw new ServiceError("NOT_A_MEMBER", 403);

  const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;
  if (!pickTypesConfig) throw new ServiceError("NO_PICK_CONFIG", 400);

  const phaseConfig = pickTypesConfig.find(
    (p) => !p.requiresScore && p.structuralPicks?.type === "GROUP_STANDINGS",
  );
  if (!phaseConfig) throw new ServiceError("No hay fase de grupos configurada", 400);

  const config = phaseConfig.structuralPicks!.config as {
    pointsPerExactPosition: number;
    bonusPerfectGroup?: number;
  };

  const fixtureData = parseFixtureData(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
  const teams = fixtureData.teams;

  const teamsMap = new Map<string, { id: string; name: string }>();
  teams.forEach((t) => {
    teamsMap.set(t.id, { id: t.id, name: t.name || t.code || t.id });
  });

  const groupTeams = teams.filter((t) => t.groupId === groupId);
  if (groupTeams.length === 0) throw new ServiceError("Grupo no encontrado", 404);

  const userPick = await prisma.groupStandingsPrediction.findUnique({
    where: {
      poolId_userId_phaseId_groupId: {
        poolId, userId, phaseId: phaseConfig.phaseId, groupId,
      },
    },
  });

  const result = await prisma.groupStandingsResult.findFirst({
    where: { poolId, phaseId: phaseConfig.phaseId, groupId },
    orderBy: { createdAtUtc: "desc" },
  });

  const teamCount = groupTeams.length;
  const maxPositionPoints = teamCount * config.pointsPerExactPosition;
  const maxBonusPoints = config.bonusPerfectGroup || 0;
  const totalMax = maxPositionPoints + maxBonusPoints;

  if (!userPick || !userPick.teamIds || userPick.teamIds.length === 0) {
    return {
      breakdown: {
        type: "GROUP_SINGLE",
        groupId,
        groupName: `Grupo ${groupId}`,
        hasPick: false,
        hasResult: !!result,
        totalPointsEarned: 0,
        totalPointsMax: totalMax,
        config,
        positions: [],
        bonusPerfectGroup: {
          enabled: !!config.bonusPerfectGroup,
          achieved: false,
          pointsEarned: 0,
          pointsMax: maxBonusPoints,
        },
      },
    };
  }

  if (!result || !result.teamIds || result.teamIds.length === 0) {
    return {
      breakdown: {
        type: "GROUP_SINGLE",
        groupId,
        groupName: `Grupo ${groupId}`,
        hasPick: true,
        hasResult: false,
        totalPointsEarned: 0,
        totalPointsMax: totalMax,
        config,
        positions: [],
        bonusPerfectGroup: {
          enabled: !!config.bonusPerfectGroup,
          achieved: false,
          pointsEarned: 0,
          pointsMax: maxBonusPoints,
        },
      },
    };
  }

  const pickTeams = userPick.teamIds as string[];
  const resultTeams = result.teamIds as string[];
  let totalEarned = 0;
  let perfectGroup = true;

  const positions = resultTeams.map((teamId, index) => {
    const position = index + 1;
    const predictedIndex = pickTeams.indexOf(teamId);
    const predictedPosition = predictedIndex >= 0 ? predictedIndex + 1 : null;
    const matched = predictedPosition === position;
    if (!matched) perfectGroup = false;
    const pointsEarned = matched ? config.pointsPerExactPosition : 0;
    totalEarned += pointsEarned;
    const team = teamsMap.get(teamId);
    return { position, teamId, teamName: team?.name || teamId, predictedPosition, actualPosition: position, matched, pointsEarned };
  });

  const bonusAchieved = perfectGroup && config.bonusPerfectGroup;
  const bonusPoints = bonusAchieved ? config.bonusPerfectGroup! : 0;
  totalEarned += bonusPoints;

  return {
    breakdown: {
      type: "GROUP_SINGLE",
      groupId,
      groupName: `Grupo ${groupId}`,
      hasPick: true,
      hasResult: true,
      totalPointsEarned: totalEarned,
      totalPointsMax: totalMax,
      config,
      positions,
      bonusPerfectGroup: {
        enabled: !!config.bonusPerfectGroup,
        achieved: !!bonusAchieved,
        pointsEarned: bonusPoints,
        pointsMax: maxBonusPoints,
      },
    },
  };
}

// ─── Player Summary ──────────────────────────────────────────

export async function getPlayerSummary(
  requestingUserId: string,
  poolId: string,
  targetUserId: string,
) {
  const now = new Date();

  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: requestingUserId, status: "ACTIVE" },
  });
  if (!myMembership) throw new ServiceError("NOT_A_MEMBER", 403);

  const targetMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: targetUserId, status: "ACTIVE" },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
  });
  if (!targetMembership) throw new ServiceError("NOT_FOUND", 404);

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool || !pool.tournamentInstance) throw new ServiceError("NOT_FOUND", 404);

  const isViewingSelf = targetUserId === requestingUserId;
  const deadlineMinutes = pool.deadlineMinutesBeforeKickoff;

  const dataJson = pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson;
  const matches = extractMatches(dataJson);
  const teams = extractTeams(dataJson);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const predictions = await prisma.prediction.findMany({
    where: { poolId, userId: targetUserId },
  });
  const pickByMatchId = new Map(predictions.map((p) => [p.matchId, typed<PickJson>(p.pickJson)]));

  const [resultsRaw, playerSummaryOverrides] = await Promise.all([
    prisma.poolMatchResult.findMany({
      where: { poolId },
      include: { currentVersion: true },
    }),
    prisma.poolMatchOverride.findMany({ where: { poolId } }),
  ]);
  const playerSummaryOverrideMap = new Map(playerSummaryOverrides.map((o) => [o.matchId, o]));
  const resultByMatchId = new Map(
    resultsRaw
      .filter((r) => r.currentVersion)
      .map((r) => [
        r.matchId,
        {
          homeGoals: r.currentVersion!.homeGoals,
          awayGoals: r.currentVersion!.awayGoals,
          homeGoals90: r.currentVersion!.homeGoals90,
          awayGoals90: r.currentVersion!.awayGoals90,
        },
      ]),
  );

  const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;

  const phaseGroups = new Map<string, FixtureMatch[]>();
  for (const match of matches) {
    const group = phaseGroups.get(match.phaseId) ?? [];
    group.push(match);
    phaseGroups.set(match.phaseId, group);
  }

  const phases: any[] = [];
  const phasesFromData = extractPhases(dataJson);
  const phaseOrder = new Map<string, number>(phasesFromData.map((p, idx) => [p.id, idx]));

  for (const [phaseId, phaseMatches] of phaseGroups) {
    const phaseConfig = pickTypesConfig?.find((p) => p.phaseId === phaseId);
    const phaseData = phasesFromData.find((p) => p.id === phaseId);
    const phaseName = phaseData?.name ?? phaseId;

    const sortedMatches = [...phaseMatches].sort(
      (a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime(),
    );

    let phaseTotalPoints = 0;
    let phaseMaxPoints = 0;
    let matchCount = 0;
    let scoredCount = 0;
    const matchDetails: any[] = [];

    for (const match of sortedMatches) {
      const kickoff = new Date(match.kickoffUtc);
      const deadlineUtc = new Date(kickoff.getTime() - deadlineMinutes * 60 * 1000);
      const isLocked = now >= deadlineUtc;

      if (!isViewingSelf && !isLocked) continue;

      const pick = pickByMatchId.get(match.id);
      const result = resultByMatchId.get(match.id);
      const homeTeam = teamById.get(match.homeTeamId);
      const awayTeam = teamById.get(match.awayTeamId);

      const pOverride = playerSummaryOverrideMap.get(match.id);
      if (pOverride && !pOverride.scoringEnabled) {
        matchDetails.push({
          matchId: match.id,
          homeTeam: { id: match.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
          awayTeam: { id: match.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
          kickoffUtc: match.kickoffUtc,
          status: "SCORING_DISABLED",
          scoringOverrideReason: pOverride.reason ?? null,
        });
        continue;
      }

      let pointsEarned = 0;
      let pointsMax = 0;
      let status: "SCORED" | "NO_PICK" | "PENDING_RESULT" | "LOCKED" = "LOCKED";
      let breakdown: any[] = [];
      matchCount += 1;

      if (result) {
        if (pick && pick.type === "SCORE" && phaseConfig?.requiresScore && phaseConfig.matchPicks) {
          try {
            const resultForScoring = {
              homeGoals: phaseConfig.includeExtraTime ? result.homeGoals : (result.homeGoals90 ?? result.homeGoals),
              awayGoals: phaseConfig.includeExtraTime ? result.awayGoals : (result.awayGoals90 ?? result.awayGoals),
            };
            const scoring = scoreMatchPick(
              { homeGoals: pick.homeGoals!, awayGoals: pick.awayGoals! },
              resultForScoring,
              phaseConfig,
            );
            pointsEarned = scoring.totalPoints;
            breakdown = scoring.evaluations.map((e: { matchPickType: string; matched: boolean; points: number }) => ({
              type: e.matchPickType, matched: e.matched, points: e.points,
            }));
            status = "SCORED";
            scoredCount += 1;
            const allEnabled = phaseConfig.matchPicks.types.filter((t) => t.enabled);
            const isCumulative = allEnabled.some((t) => t.key === "HOME_GOALS" || t.key === "AWAY_GOALS");
            if (isCumulative) {
              pointsMax = allEnabled.reduce((sum, t) => sum + t.points, 0);
            } else {
              pointsMax = Math.max(...allEnabled.map((t) => t.points), 0);
            }
          } catch (err) {
            console.error(`Error scoring match ${match.id}:`, err);
          }
        } else if (pick) {
          const preset = getScoringPreset(pool.scoringPresetKey ?? "CLASSIC");
          const legacyResult = {
            homeGoals: phaseConfig?.includeExtraTime ? result.homeGoals : (result.homeGoals90 ?? result.homeGoals),
            awayGoals: phaseConfig?.includeExtraTime ? result.awayGoals : (result.awayGoals90 ?? result.awayGoals),
          };
          const actualOutcome = outcomeFromScore(legacyResult.homeGoals, legacyResult.awayGoals);
          const pickOutcome = pick.type === "SCORE" ? outcomeFromScore(pick.homeGoals!, pick.awayGoals!) : pick.outcome;
          const outcomeCorrect = pickOutcome === actualOutcome;
          const exact = pick.type === "SCORE" && pick.homeGoals === legacyResult.homeGoals && pick.awayGoals === legacyResult.awayGoals;

          pointsEarned = (outcomeCorrect ? preset.outcomePoints : 0) + (exact && preset.allowScorePick ? preset.exactScoreBonus : 0);
          pointsMax = preset.outcomePoints + (preset.allowScorePick ? preset.exactScoreBonus : 0);
          status = "SCORED";
          scoredCount += 1;
          breakdown = [
            { type: "OUTCOME", matched: outcomeCorrect, points: outcomeCorrect ? preset.outcomePoints : 0 },
            ...(preset.allowScorePick ? [{ type: "EXACT_SCORE", matched: exact, points: exact ? preset.exactScoreBonus : 0 }] : []),
          ];
        } else {
          status = "NO_PICK";
        }
      } else if (!isLocked) {
        status = "LOCKED";
      } else {
        status = pick ? "PENDING_RESULT" : "NO_PICK";
      }

      phaseTotalPoints += pointsEarned;
      phaseMaxPoints += pointsMax;

      matchDetails.push({
        matchId: match.id,
        homeTeam: homeTeam ? { id: homeTeam.id, name: homeTeam.name ?? homeTeam.id, code: homeTeam.code } : null,
        awayTeam: awayTeam ? { id: awayTeam.id, name: awayTeam.name ?? awayTeam.id, code: awayTeam.code } : null,
        kickoffUtc: match.kickoffUtc,
        groupId: match.groupId ?? null,
        pick: pick ? { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals, type: pick.type } : null,
        result: result ?? null,
        pointsEarned,
        pointsMax,
        status,
        breakdown,
      });
    }

    if (matchDetails.length > 0) {
      phases.push({
        phaseId,
        phaseName,
        phaseOrder: phaseOrder.get(phaseId) ?? 999,
        totalPoints: phaseTotalPoints,
        maxPossiblePoints: phaseMaxPoints,
        matchCount,
        scoredCount,
        matches: matchDetails,
      });
    }
  }

  phases.sort((a, b) => a.phaseOrder - b.phaseOrder);

  // Compute rank
  const allMembers = await prisma.poolMember.findMany({
    where: { poolId, status: "ACTIVE" },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
  });

  const memberPoints: Array<{ userId: string; points: number; joinedAt: Date }> = [];
  for (const member of allMembers) {
    let totalPoints = 0;
    const memberPicks = await prisma.prediction.findMany({
      where: { poolId, userId: member.userId },
    });
    const memberPickByMatch = new Map(memberPicks.map((p) => [p.matchId, typed<PickJson>(p.pickJson)]));

    for (const match of matches) {
      const pick = memberPickByMatch.get(match.id);
      const result = resultByMatchId.get(match.id);
      if (!pick || !result) continue;

      const phaseConfig = pickTypesConfig?.find((p) => p.phaseId === match.phaseId);
      if (pick.type === "SCORE" && phaseConfig?.requiresScore && phaseConfig.matchPicks) {
        try {
          const resultForScoring = {
            homeGoals: phaseConfig.includeExtraTime ? result.homeGoals : (result.homeGoals90 ?? result.homeGoals),
            awayGoals: phaseConfig.includeExtraTime ? result.awayGoals : (result.awayGoals90 ?? result.awayGoals),
          };
          const scoring = scoreMatchPick(
            { homeGoals: pick.homeGoals!, awayGoals: pick.awayGoals! },
            resultForScoring,
            phaseConfig,
          );
          totalPoints += scoring.totalPoints;
        } catch (err) {
          // Do NOT re-throw: we want the loop to keep scoring the rest
          // of this member's picks even if one throws (malformed pick,
          // bad phaseConfig). But DO log with enough context to debug
          // — the previous silent catch hid real scoring bugs.
          console.error(
            `[poolAdminService] scoreMatchPick failed pool=${poolId} user=${member.userId} match=${match.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      } else {
        const preset = getScoringPreset(pool.scoringPresetKey ?? "CLASSIC");
        const scoringResult = {
          homeGoals: phaseConfig?.includeExtraTime ? result.homeGoals : (result.homeGoals90 ?? result.homeGoals),
          awayGoals: phaseConfig?.includeExtraTime ? result.awayGoals : (result.awayGoals90 ?? result.awayGoals),
        };
        const actualOutcome = outcomeFromScore(scoringResult.homeGoals, scoringResult.awayGoals);
        const pickOutcome = pick.type === "SCORE" ? outcomeFromScore(pick.homeGoals!, pick.awayGoals!) : pick.outcome;
        const outcomeCorrect = pickOutcome === actualOutcome;
        const exact = pick.type === "SCORE" && pick.homeGoals === scoringResult.homeGoals && pick.awayGoals === scoringResult.awayGoals;
        totalPoints += (outcomeCorrect ? preset.outcomePoints : 0) + (exact && preset.allowScorePick ? preset.exactScoreBonus : 0);
      }
    }

    memberPoints.push({ userId: member.userId, points: totalPoints, joinedAt: member.joinedAtUtc });
  }

  memberPoints.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.joinedAt.getTime() - b.joinedAt.getTime();
  });

  const targetRank = memberPoints.findIndex((m) => m.userId === targetUserId) + 1;
  const targetPoints = memberPoints.find((m) => m.userId === targetUserId)?.points ?? 0;

  return {
    player: {
      userId: targetUserId,
      displayName: targetMembership.user.displayName,
      role: targetMembership.role,
      rank: targetRank,
      totalPoints: targetPoints,
      joinedAtUtc: targetMembership.joinedAtUtc,
    },
    isViewingSelf,
    phases,
  };
}

// ─── Notifications ───────────────────────────────────────────

export async function getPoolNotifications(
  userId: string,
  poolId: string,
) {
  const membership = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  if (!membership) throw new ServiceError("NOT_A_MEMBER", 403);

  const isHostOrCoAdmin = isPoolAdmin(membership.role);

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  const snapshotData = pool.fixtureSnapshot || pool.tournamentInstance.dataJson;
  const matches = extractMatches(snapshotData);
  const now = new Date();

  const userPicks = await prisma.prediction.findMany({
    where: { poolId, userId },
    select: { matchId: true },
  });
  const pickedMatchIds = new Set(userPicks.map((p) => p.matchId));

  const publishedResults = await prisma.poolMatchResult.findMany({
    where: { poolId },
    select: { matchId: true },
  });
  const resultsMap = new Set(publishedResults.map((r) => r.matchId));

  const deadlineMinutes = pool.deadlineMinutesBeforeKickoff;

  const isPlaceholder = (teamId: string) => {
    return teamId.startsWith("W_") || teamId.startsWith("RU_") || teamId.startsWith("L_") || teamId.startsWith("3rd_");
  };

  const urgentDeadlines: Array<{
    matchId: string;
    phaseId: string;
    deadlineUtc: string;
    homeTeamId: string;
    awayTeamId: string;
    kickoffUtc: string;
  }> = [];

  for (const match of matches) {
    if (isPlaceholder(match.homeTeamId) || isPlaceholder(match.awayTeamId)) continue;

    const kickoff = new Date(match.kickoffUtc);
    const deadline = new Date(kickoff.getTime() - deadlineMinutes * 60 * 1000);

    if (deadline > now) {
      const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDeadline < 24 && !pickedMatchIds.has(match.id)) {
        urgentDeadlines.push({
          matchId: match.id,
          phaseId: match.phaseId,
          deadlineUtc: deadline.toISOString(),
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          kickoffUtc: match.kickoffUtc,
        });
      }
    }
  }

  urgentDeadlines.sort((a, b) => new Date(a.deadlineUtc).getTime() - new Date(b.deadlineUtc).getTime());

  const pendingPicks = urgentDeadlines.length;

  let pendingJoins = 0;
  let pendingResults = 0;
  let phasesReadyToAdvance: string[] = [];

  if (isHostOrCoAdmin) {
    pendingJoins = await prisma.poolMember.count({
      where: { poolId, status: "PENDING_APPROVAL" },
    });

    for (const match of matches) {
      const kickoff = new Date(match.kickoffUtc);
      if (kickoff < now && !resultsMap.has(match.id)) pendingResults++;
    }

    const phaseMatches: Record<string, FixtureMatch[]> = {};
    for (const match of matches) {
      if (!phaseMatches[match.phaseId]) phaseMatches[match.phaseId] = [];
      phaseMatches[match.phaseId]!.push(match);
    }

    const nextPhaseMap: Record<string, string | null> = {
      group_stage: "round_of_32",
      round_of_32: "round_of_16",
      round_of_16: "quarter_finals",
      quarter_finals: "semi_finals",
      semi_finals: "finals",
      third_place: null,
      finals: null,
    };

    const lockedPhases = Array.isArray(pool.lockedPhases) ? pool.lockedPhases as string[] : [];

    for (const [phaseId, phaseMatchList] of Object.entries(phaseMatches)) {
      if (lockedPhases.includes(phaseId)) continue;
      const allHaveResults = phaseMatchList.every((m) => resultsMap.has(m.id));
      if (allHaveResults && phaseMatchList.length > 0) {
        const nextPhaseId = nextPhaseMap[phaseId];
        if (!nextPhaseId) continue;
        const nextPhaseMatches = phaseMatches[nextPhaseId] || [];
        if (nextPhaseMatches.length > 0) {
          const hasPlaceholders = nextPhaseMatches.some(
            (m) => isPlaceholder(m.homeTeamId) || isPlaceholder(m.awayTeamId),
          );
          if (hasPlaceholders) phasesReadyToAdvance.push(phaseId);
        }
      }
    }
  }

  return {
    pendingPicks,
    urgentDeadlines: urgentDeadlines.slice(0, 5),
    pendingJoins: isHostOrCoAdmin ? pendingJoins : 0,
    pendingResults: isHostOrCoAdmin ? pendingResults : 0,
    phasesReadyToAdvance: isHostOrCoAdmin ? phasesReadyToAdvance : [],
    isHostOrCoAdmin,
    updatedAt: now.toISOString(),
  };
}
