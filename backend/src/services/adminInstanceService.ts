/**
 * Admin Instance Service — Pure business logic for tournament instance management.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Audit context (ip, userAgent) passed as a separate object.
 *   - Side effects (audit) are fire-and-forget but logged on failure.
 */

import { Prisma, ResultSourceMode, TournamentInstanceStatus } from "@prisma/client";
import { prisma } from "../db";
import { MATCH_SYNC } from "../lib/constants";
import { writeAuditEvent } from "../lib/audit";
import {
  advanceToRoundOf32,
  advanceKnockoutPhase,
  advanceTwoLeggedPhase,
  validateGroupStageComplete,
} from "./instanceAdvancement";
import { getResultSyncService } from "./resultSync";
import { getJobStatus } from "../jobs/resultSyncJob";
import { fireAndForget } from "../lib/asyncHelpers";
import { ServiceError, type AuditContext } from "./authService";

// ─── Helpers ─────────────────────────────────────────────────

function ensureTransition(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    DRAFT: ["ACTIVE", "ARCHIVED"],
    ACTIVE: ["COMPLETED"],
    COMPLETED: ["ARCHIVED"],
    ARCHIVED: [],
  };
  return (allowed[from] ?? []).includes(to);
}

// ─── Create Instance ─────────────────────────────────────────

export async function createInstance(
  userId: string,
  templateId: string,
  name: string | undefined,
  templateVersionId: string | undefined,
  ctx: AuditContext,
) {
  const template = await prisma.tournamentTemplate.findUnique({
    where: { id: templateId },
    include: { currentPublishedVersion: true },
  });
  if (!template) throw new ServiceError("NOT_FOUND", 404);

  let sourceVersionId: string | null = null;
  if (templateVersionId) {
    sourceVersionId = templateVersionId;
  } else {
    sourceVersionId = template.currentPublishedVersionId ?? null;
  }

  if (!sourceVersionId) {
    throw new ServiceError("Template has no published version", 409);
  }

  const version = await prisma.tournamentTemplateVersion.findFirst({
    where: { id: sourceVersionId, templateId },
  });
  if (!version) throw new ServiceError("Template version not found for this template", 404);
  if (version.status !== "PUBLISHED") {
    throw new ServiceError("Selected templateVersionId is not PUBLISHED", 409);
  }

  const instanceName = name ?? `${template.name} (Instance)`;

  const instance = await prisma.tournamentInstance.create({
    data: {
      templateId: template.id,
      templateVersionId: version.id,
      name: instanceName,
      status: "DRAFT",
      dataJson: version.dataJson as Prisma.InputJsonValue,
    },
  });

  fireAndForget("audit:instance-created", writeAuditEvent({
    actorUserId: userId,
    action: "TOURNAMENT_INSTANCE_CREATED",
    entityType: "TournamentInstance",
    entityId: instance.id,
    dataJson: { templateId: template.id, templateVersionId: version.id },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { instance };
}

// ─── Instance State Transitions ──────────────────────────────

async function transitionInstance(
  userId: string,
  instanceId: string,
  targetStatus: TournamentInstanceStatus,
  action: string,
  ctx: AuditContext,
) {
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  if (!ensureTransition(instance.status, targetStatus)) {
    throw new ServiceError(`Cannot transition ${instance.status} -> ${targetStatus}`, 409);
  }

  const updated = await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: { status: targetStatus },
  });

  fireAndForget("audit:instance-transition", writeAuditEvent({
    actorUserId: userId,
    action,
    entityType: "TournamentInstance",
    entityId: updated.id,
    dataJson: { from: instance.status, to: targetStatus },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { instance: updated };
}

export async function activateInstance(userId: string, instanceId: string, ctx: AuditContext) {
  return transitionInstance(userId, instanceId, "ACTIVE", "TOURNAMENT_INSTANCE_ACTIVATED", ctx);
}

export async function completeInstance(userId: string, instanceId: string, ctx: AuditContext) {
  return transitionInstance(userId, instanceId, "COMPLETED", "TOURNAMENT_INSTANCE_COMPLETED", ctx);
}

export async function archiveInstance(userId: string, instanceId: string, ctx: AuditContext) {
  return transitionInstance(userId, instanceId, "ARCHIVED", "TOURNAMENT_INSTANCE_ARCHIVED", ctx);
}

// ─── List / Get Instances ────────────────────────────────────

export async function listInstances() {
  const list = await prisma.tournamentInstance.findMany({
    orderBy: { createdAtUtc: "desc" },
  });
  return { instances: list };
}

export async function getInstance(instanceId: string) {
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);
  return { instance };
}

// ─── Tournament Advancement ──────────────────────────────────

export async function advanceInstanceToR32(userId: string, instanceId: string, ctx: AuditContext) {
  const result = await advanceToRoundOf32(instanceId);

  fireAndForget("audit:advance-r32", writeAuditEvent({
    actorUserId: userId,
    action: "TOURNAMENT_ADVANCED_TO_R32",
    entityType: "TournamentInstance",
    entityId: instanceId,
    dataJson: {
      winnersCount: result.winners.size,
      runnersUpCount: result.runnersUp.size,
      bestThirdsCount: result.bestThirds.length,
      resolvedMatchesCount: result.resolvedMatches.length,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return {
    message: "Avance a Round of 32 completado",
    data: {
      standings: Object.fromEntries(result.standings),
      winners: Object.fromEntries(result.winners),
      runnersUp: Object.fromEntries(result.runnersUp),
      bestThirds: result.bestThirds,
      resolvedMatches: result.resolvedMatches,
    },
  };
}

export async function advanceInstanceKnockout(
  userId: string,
  instanceId: string,
  currentPhaseId: string,
  nextPhaseId: string,
  ctx: AuditContext,
) {
  const result = await advanceKnockoutPhase(instanceId, currentPhaseId, nextPhaseId);

  fireAndForget("audit:advance-knockout", writeAuditEvent({
    actorUserId: userId,
    action: "TOURNAMENT_ADVANCED_KNOCKOUT",
    entityType: "TournamentInstance",
    entityId: instanceId,
    dataJson: {
      from: currentPhaseId,
      to: nextPhaseId,
      resolvedMatchesCount: result.resolvedMatches.length,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return {
    message: `Avance de ${currentPhaseId} a ${nextPhaseId} completado`,
    data: { resolvedMatches: result.resolvedMatches },
  };
}

export async function advanceInstanceTwoLegged(
  userId: string,
  instanceId: string,
  currentRound: string,
  nextRound: string,
  poolId: string | undefined,
  ctx: AuditContext,
) {
  let poolIds: string[];

  if (poolId) {
    poolIds = [poolId];
  } else {
    const pools = await prisma.pool.findMany({
      where: { tournamentInstanceId: instanceId },
      select: { id: true },
    });
    poolIds = pools.map((p) => p.id);
  }

  if (poolIds.length === 0) throw new ServiceError("No pools found for this instance", 404);

  const allResults = [];
  for (const pid of poolIds) {
    const result = await advanceTwoLeggedPhase(instanceId, currentRound, nextRound, pid);
    allResults.push({ poolId: pid, ...result });
  }

  fireAndForget("audit:advance-two-legged", writeAuditEvent({
    actorUserId: userId,
    action: "TOURNAMENT_ADVANCED_TWO_LEGGED",
    entityType: "TournamentInstance",
    entityId: instanceId,
    dataJson: {
      from: currentRound,
      to: nextRound,
      poolsAdvanced: poolIds.length,
      winnersPerPool: allResults.map((r) => ({
        poolId: r.poolId,
        winners: r.winners.map((w: any) => ({
          tieNumber: w.tieNumber,
          winnerId: w.winnerId,
          decidedBy: w.decidedBy,
        })),
      })),
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return {
    message: `Avance de ${currentRound} a ${nextRound} completado para ${poolIds.length} pool(s)`,
    data: allResults,
  };
}

export async function getGroupStageStatus(instanceId: string) {
  const validation = await validateGroupStageComplete(instanceId);
  return {
    isComplete: validation.isComplete,
    missingMatches: validation.missingMatches,
    missingCount: validation.missingMatches.length,
  };
}

// ─── Result Source Configuration ─────────────────────────────

export async function configureResultSource(
  userId: string,
  instanceId: string,
  resultSourceMode: "MANUAL" | "AUTO",
  apiFootballLeagueId: number | undefined,
  apiFootballSeasonId: number | undefined,
  syncEnabled: boolean | undefined,
  ctx: AuditContext,
) {
  if (resultSourceMode === "AUTO") {
    if (!apiFootballLeagueId || !apiFootballSeasonId) {
      throw new ServiceError("apiFootballLeagueId and apiFootballSeasonId are required when resultSourceMode is AUTO", 400);
    }
  }

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  const updated = await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: {
      resultSourceMode: resultSourceMode as ResultSourceMode,
      apiFootballLeagueId: resultSourceMode === "AUTO" ? apiFootballLeagueId : null,
      apiFootballSeasonId: resultSourceMode === "AUTO" ? apiFootballSeasonId : null,
      syncEnabled: syncEnabled ?? (resultSourceMode === "AUTO"),
    },
  });

  fireAndForget("audit:result-source-config", writeAuditEvent({
    actorUserId: userId,
    action: "INSTANCE_RESULT_SOURCE_CONFIGURED",
    entityType: "TournamentInstance",
    entityId: instanceId,
    dataJson: { resultSourceMode, apiFootballLeagueId, apiFootballSeasonId, syncEnabled },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { instance: updated };
}

// ─── Match Mappings ──────────────────────────────────────────

export async function createMatchMappings(
  userId: string,
  instanceId: string,
  mappings: Array<{ internalMatchId: string; apiFootballFixtureId: number }>,
  ctx: AuditContext,
) {
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  if (instance.resultSourceMode !== "AUTO") {
    throw new ServiceError("Match mappings can only be created for instances in AUTO mode", 409);
  }

  const results = await prisma.$transaction(
    mappings.map((m) =>
      prisma.matchExternalMapping.upsert({
        where: {
          tournamentInstanceId_internalMatchId: {
            tournamentInstanceId: instanceId,
            internalMatchId: m.internalMatchId,
          },
        },
        create: {
          tournamentInstanceId: instanceId,
          internalMatchId: m.internalMatchId,
          apiFootballFixtureId: m.apiFootballFixtureId,
        },
        update: { apiFootballFixtureId: m.apiFootballFixtureId },
      }),
    ),
  );

  fireAndForget("audit:match-mappings-updated", writeAuditEvent({
    actorUserId: userId,
    action: "MATCH_MAPPINGS_UPDATED",
    entityType: "TournamentInstance",
    entityId: instanceId,
    dataJson: { mappingsCount: mappings.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { created: results.length, mappings: results };
}

export async function listMatchMappings(instanceId: string) {
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  const mappings = await prisma.matchExternalMapping.findMany({
    where: { tournamentInstanceId: instanceId },
    orderBy: { createdAtUtc: "asc" },
  });

  return {
    instanceId,
    resultSourceMode: instance.resultSourceMode,
    mappingsCount: mappings.length,
    mappings,
  };
}

export async function deleteMatchMapping(
  userId: string,
  instanceId: string,
  mappingId: string,
  ctx: AuditContext,
) {
  const mapping = await prisma.matchExternalMapping.findFirst({
    where: { id: mappingId, tournamentInstanceId: instanceId },
  });
  if (!mapping) throw new ServiceError("NOT_FOUND", 404);

  await prisma.matchExternalMapping.delete({ where: { id: mappingId } });

  fireAndForget("audit:match-mapping-deleted", writeAuditEvent({
    actorUserId: userId,
    action: "MATCH_MAPPING_DELETED",
    entityType: "MatchExternalMapping",
    entityId: mappingId,
    dataJson: { instanceId, internalMatchId: mapping.internalMatchId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));
}

// ─── Sync ────────────────────────────────────────────────────

export async function syncInstance(userId: string, instanceId: string, ctx: AuditContext) {
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  if (instance.resultSourceMode !== "AUTO") {
    throw new ServiceError("Sync is only available for instances in AUTO mode", 409);
  }

  const syncService = getResultSyncService();
  if (!syncService.isAvailable()) {
    throw new ServiceError("API-Football service is not available", 503);
  }

  const result = await syncService.syncInstance(instanceId);

  fireAndForget("audit:manual-sync", writeAuditEvent({
    actorUserId: userId,
    action: "MANUAL_SYNC_TRIGGERED",
    entityType: "TournamentInstance",
    entityId: instanceId,
    dataJson: {
      fixturesChecked: result.fixturesChecked,
      fixturesUpdated: result.fixturesUpdated,
      status: result.status,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { result };
}

export async function getSyncStatus(instanceId: string) {
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  const syncLogs = await prisma.resultSyncLog.findMany({
    where: { tournamentInstanceId: instanceId },
    orderBy: { startedAtUtc: "desc" },
    take: 20,
  });

  const mappingsCount = await prisma.matchExternalMapping.count({
    where: { tournamentInstanceId: instanceId },
  });

  const jobStatus = getJobStatus();

  return {
    instanceId,
    instanceName: instance.name,
    resultSourceMode: instance.resultSourceMode,
    syncEnabled: instance.syncEnabled,
    apiFootballLeagueId: instance.apiFootballLeagueId,
    apiFootballSeasonId: instance.apiFootballSeasonId,
    lastSyncAtUtc: instance.lastSyncAtUtc,
    mappingsCount,
    jobStatus,
    recentSyncLogs: syncLogs,
  };
}

export async function triggerGlobalSync(userId: string, ctx: AuditContext) {
  const syncService = getResultSyncService();
  if (!syncService.isAvailable()) {
    throw new ServiceError("API-Football service is not available", 503);
  }

  const summary = await syncService.syncAllAutoInstances();

  fireAndForget("audit:global-sync", writeAuditEvent({
    actorUserId: userId,
    action: "GLOBAL_SYNC_TRIGGERED",
    entityType: "System",
    entityId: "result-sync",
    dataJson: {
      instancesChecked: summary.instancesChecked,
      instancesUpdated: summary.instancesUpdated,
      totalFixturesUpdated: summary.totalFixturesUpdated,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { summary };
}

export async function getGlobalSyncStatus() {
  const syncService = getResultSyncService();
  const jobStatus = getJobStatus();

  const autoInstancesCount = await prisma.tournamentInstance.count({
    where: { resultSourceMode: "AUTO" },
  });

  const enabledAutoInstancesCount = await prisma.tournamentInstance.count({
    where: { resultSourceMode: "AUTO", syncEnabled: true },
  });

  const recentLogs = await prisma.resultSyncLog.findMany({
    orderBy: { startedAtUtc: "desc" },
    take: 10,
    include: {
      tournamentInstance: { select: { id: true, name: true } },
    },
  });

  return {
    serviceAvailable: syncService.isAvailable(),
    jobStatus,
    autoInstancesCount,
    enabledAutoInstancesCount,
    recentLogs,
  };
}

// ─── Update R16 Draw ─────────────────────────────────────────

export async function updateR16Draw(userId: string, instanceId: string, ctx: AuditContext) {
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(`[update-r16-draw] ${msg}`); };

  const { ApiFootballClient } = await import("../services/apiFootball/client");

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  const currentData = instance.dataJson as Record<string, any>;

  const apiToInternal: Record<number, string> = {};
  for (const team of currentData.teams || []) {
    if (team.apiFootballId) apiToInternal[team.apiFootballId] = team.id;
  }
  log(`Loaded ${Object.keys(apiToInternal).length} team mappings`);

  const client = new ApiFootballClient();
  const leagueId = instance.apiFootballLeagueId ?? 2;
  const season = instance.apiFootballSeasonId ?? 2025;
  log(`Fetching Round of 16 fixtures (league=${leagueId}, season=${season})...`);

  const r16Fixtures = await client.getFixtures({ league: leagueId, season, round: "Round of 16" });
  log(`Found ${r16Fixtures.length} R16 fixtures from API-Football`);

  if (r16Fixtures.length === 0) {
    return { success: false, message: "No R16 fixtures found in API-Football yet", logs };
  }
  if (r16Fixtures.length !== 16) {
    return { success: false, message: `Expected 16 R16 fixtures, got ${r16Fixtures.length}`, logs };
  }

  const tieMap = new Map<string, any[]>();
  for (const f of r16Fixtures) {
    const homeId = f.teams.home.id;
    const awayId = f.teams.away.id;
    const key = [Math.min(homeId, awayId), Math.max(homeId, awayId)].join("-");
    if (!tieMap.has(key)) tieMap.set(key, []);
    tieMap.get(key)!.push(f);
  }

  interface R16Tie {
    tieNumber: number; teamA: string; teamB: string;
    leg1: { fixtureId: number; kickoffUtc: string };
    leg2: { fixtureId: number; kickoffUtc: string };
  }

  const ties: R16Tie[] = [];
  let tieNum = 1;
  for (const [, legs] of tieMap.entries()) {
    legs.sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
    const leg1 = legs[0]; const leg2 = legs[1];
    const teamA = apiToInternal[leg1.teams.home.id];
    const teamB = apiToInternal[leg1.teams.away.id];
    if (!teamA || !teamB) {
      log(`WARNING: Unknown team mapping for ${leg1.teams.home.name} or ${leg1.teams.away.name}`);
      continue;
    }
    ties.push({
      tieNumber: tieNum++, teamA, teamB,
      leg1: { fixtureId: leg1.fixture.id, kickoffUtc: new Date(leg1.fixture.date).toISOString() },
      leg2: { fixtureId: leg2.fixture.id, kickoffUtc: new Date(leg2.fixture.date).toISOString() },
    });
  }
  log(`Grouped into ${ties.length} ties`);

  for (const tie of ties) {
    const nameA = currentData.teams.find((t: any) => t.id === tie.teamA)?.name ?? tie.teamA;
    const nameB = currentData.teams.find((t: any) => t.id === tie.teamB)?.name ?? tie.teamB;
    log(`  Tie ${tie.tieNumber}: ${nameA} vs ${nameB} | L1:#${tie.leg1.fixtureId} ${tie.leg1.kickoffUtc.slice(0, 16)} | L2:#${tie.leg2.fixtureId} ${tie.leg2.kickoffUtc.slice(0, 16)}`);
  }

  const teamName = (id: string) => currentData.teams.find((t: any) => t.id === id)?.name ?? id;
  let matchesUpdated = 0;

  for (const tie of ties) {
    for (const match of currentData.matches) {
      if (!match.phaseId?.startsWith("r16_")) continue;
      if (match.tieNumber !== tie.tieNumber) continue;
      if (match.phaseId === "r16_leg1") {
        match.homeTeamId = tie.teamA; match.awayTeamId = tie.teamB;
        match.kickoffUtc = tie.leg1.kickoffUtc;
        match.label = `${teamName(tie.teamA)} vs ${teamName(tie.teamB)}`;
        match.status = "SCHEDULED"; matchesUpdated++;
      } else if (match.phaseId === "r16_leg2") {
        match.homeTeamId = tie.teamB; match.awayTeamId = tie.teamA;
        match.kickoffUtc = tie.leg2.kickoffUtc;
        match.label = `${teamName(tie.teamB)} vs ${teamName(tie.teamA)}`;
        match.status = "SCHEDULED"; matchesUpdated++;
      }
    }
  }
  log(`Updated ${matchesUpdated} matches in dataJson`);

  await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: { dataJson: currentData },
  });

  if (instance.templateVersionId) {
    await prisma.tournamentTemplateVersion.update({
      where: { id: instance.templateVersionId },
      data: { dataJson: currentData },
    });
    log("Template version updated");
  }

  let mappingCount = 0;
  for (const tie of ties) {
    for (const leg of [
      { matchId: `r16_${tie.tieNumber}_leg1`, fixtureId: tie.leg1.fixtureId },
      { matchId: `r16_${tie.tieNumber}_leg2`, fixtureId: tie.leg2.fixtureId },
    ]) {
      await prisma.matchExternalMapping.upsert({
        where: { tournamentInstanceId_internalMatchId: { tournamentInstanceId: instanceId, internalMatchId: leg.matchId } },
        create: { tournamentInstanceId: instanceId, internalMatchId: leg.matchId, apiFootballFixtureId: leg.fixtureId },
        update: { apiFootballFixtureId: leg.fixtureId },
      });
      mappingCount++;
    }
  }
  log(`Created/updated ${mappingCount} fixture mappings`);

  let syncCount = 0;
  for (const tie of ties) {
    for (const leg of [
      { matchId: `r16_${tie.tieNumber}_leg1`, kickoff: tie.leg1.kickoffUtc },
      { matchId: `r16_${tie.tieNumber}_leg2`, kickoff: tie.leg2.kickoffUtc },
    ]) {
      const kickoffUtc = new Date(leg.kickoff);
      await prisma.matchSyncState.upsert({
        where: { tournamentInstanceId_internalMatchId: { tournamentInstanceId: instanceId, internalMatchId: leg.matchId } },
        create: {
          tournamentInstanceId: instanceId, internalMatchId: leg.matchId, syncStatus: "PENDING",
          kickoffUtc, firstCheckAtUtc: new Date(kickoffUtc.getTime() + MATCH_SYNC.FIRST_CHECK_MS),
          finishCheckAtUtc: new Date(kickoffUtc.getTime() + MATCH_SYNC.FINISH_CHECK_MS),
        },
        update: {
          kickoffUtc, firstCheckAtUtc: new Date(kickoffUtc.getTime() + MATCH_SYNC.FIRST_CHECK_MS),
          finishCheckAtUtc: new Date(kickoffUtc.getTime() + MATCH_SYNC.FINISH_CHECK_MS),
        },
      });
      syncCount++;
    }
  }
  log(`Created/updated ${syncCount} sync states`);

  const pools = await prisma.pool.findMany({
    where: { tournamentInstanceId: instanceId },
    select: { id: true, name: true, fixtureSnapshot: true },
  });
  for (const pool of pools) {
    const poolData = (pool.fixtureSnapshot ?? currentData) as Record<string, any>;
    for (const tie of ties) {
      for (const match of poolData.matches || []) {
        if (!match.phaseId?.startsWith("r16_")) continue;
        if (match.tieNumber !== tie.tieNumber) continue;
        if (match.status !== "PLACEHOLDER") continue;
        if (match.phaseId === "r16_leg1") {
          match.homeTeamId = tie.teamA; match.awayTeamId = tie.teamB;
          match.kickoffUtc = tie.leg1.kickoffUtc;
          match.label = `${teamName(tie.teamA)} vs ${teamName(tie.teamB)}`;
          match.status = "SCHEDULED";
        } else if (match.phaseId === "r16_leg2") {
          match.homeTeamId = tie.teamB; match.awayTeamId = tie.teamA;
          match.kickoffUtc = tie.leg2.kickoffUtc;
          match.label = `${teamName(tie.teamB)} vs ${teamName(tie.teamA)}`;
          match.status = "SCHEDULED";
        }
      }
    }
    await prisma.pool.update({ where: { id: pool.id }, data: { fixtureSnapshot: poolData } });
    log(`Updated pool: ${pool.name}`);
  }

  fireAndForget("audit:update-r16-draw", writeAuditEvent({
    actorUserId: userId,
    action: "UPDATE_R16_DRAW",
    entityType: "TournamentInstance",
    entityId: instanceId,
    dataJson: { ties: ties.length, mappings: mappingCount, syncStates: syncCount, poolsUpdated: pools.length },
  }));

  log("DONE");
  return {
    summary: { ties: ties.length, matchesUpdated, mappings: mappingCount, syncStates: syncCount, poolsUpdated: pools.length },
    logs,
  };
}

// ─── Phase advancement map ────────────────────────────────────────────────

/** Maps internal phase prefix → API-Football round name */
const PHASE_TO_API_ROUND: Record<string, string> = {
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "Final",
};

/** Maps completed phase → next phase */
const ADVANCEMENT_MAP: Record<string, string> = {
  r32: "r16",
  r16: "qf",
  qf: "sf",
  sf: "final",
};

// ─── syncNextPhaseFromApi ─────────────────────────────────────────────────

/**
 * Fetch next-phase fixtures from API-Football and configure them in the instance
 * and all associated pools. Generalizes updateR16Draw() for any knockout phase.
 *
 * Flow:
 *   1. Query API-Football for fixtures of the target round
 *   2. Group fixtures into ties (two-legged) or single matches (final)
 *   3. Update instance.dataJson with real teams, dates, fixture IDs
 *   4. Create MatchExternalMapping for Smart Sync
 *   5. Create MatchSyncState so Smart Sync monitors them
 *   6. Update fixtureSnapshot of every pool on this instance
 *
 * Returns { success, summary?, logs } — never throws on API unavailability.
 */
export async function syncNextPhaseFromApi(
  instanceId: string,
  nextPhase: string,
  options?: { actorUserId?: string | null }
): Promise<{ success: boolean; message?: string; summary?: Record<string, number>; logs: string[] }> {
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(`[PhaseSync] ${msg}`); };

  const apiRoundName = PHASE_TO_API_ROUND[nextPhase];
  if (!apiRoundName) {
    return { success: false, message: `Unknown phase: ${nextPhase}`, logs };
  }

  const isFinal = nextPhase === "final";

  // 1. Load instance
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) return { success: false, message: "Instance not found", logs };

  const currentData = instance.dataJson as Record<string, any>;
  const leagueId = instance.apiFootballLeagueId ?? 2;
  const season = instance.apiFootballSeasonId ?? 2025;

  // 2. Build team mapping: apiFootballId → internal ID
  const apiToInternal: Record<number, string> = {};
  for (const team of currentData.teams || []) {
    if (team.apiFootballId) apiToInternal[team.apiFootballId] = team.id;
  }
  log(`Loaded ${Object.keys(apiToInternal).length} team mappings`);

  // 3. Fetch fixtures from API-Football
  const { ApiFootballClient } = await import("../services/apiFootball/client");
  const client = new ApiFootballClient();
  log(`Fetching ${apiRoundName} fixtures (league=${leagueId}, season=${season})...`);

  let fixtures;
  try {
    fixtures = await client.getFixtures({ league: leagueId, season, round: apiRoundName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`API error: ${msg}`);
    return { success: false, message: `API-Football error: ${msg}`, logs };
  }

  log(`Found ${fixtures.length} fixtures from API-Football`);

  if (fixtures.length === 0) {
    return { success: false, message: `No ${apiRoundName} fixtures available yet in API-Football`, logs };
  }

  // 4. Validate team mappings
  const missingTeams: string[] = [];
  for (const f of fixtures) {
    if (!apiToInternal[f.teams.home.id]) missingTeams.push(`${f.teams.home.name} (API ID: ${f.teams.home.id})`);
    if (!apiToInternal[f.teams.away.id]) missingTeams.push(`${f.teams.away.name} (API ID: ${f.teams.away.id})`);
  }
  if (missingTeams.length > 0) {
    log(`Missing team mappings: ${missingTeams.join(", ")}`);
    return { success: false, message: `Missing team mappings: ${missingTeams.join(", ")}`, logs };
  }

  const teamName = (id: string) => currentData.teams.find((t: any) => t.id === id)?.name ?? id;

  // 5. Process fixtures
  let matchesUpdated = 0;
  let mappingCount = 0;
  let syncCount = 0;

  if (isFinal) {
    // ── Single-match final ──
    if (fixtures.length !== 1) {
      log(`WARNING: Expected 1 final fixture, got ${fixtures.length}`);
    }
    const f = fixtures[0]!;
    const homeId = apiToInternal[f.teams.home.id]!;
    const awayId = apiToInternal[f.teams.away.id]!;
    const kickoffUtc = new Date(f.fixture.date).toISOString();

    log(`Final: ${teamName(homeId)} vs ${teamName(awayId)} | #${f.fixture.id} ${kickoffUtc.slice(0, 16)}`);

    // Update match in instance dataJson
    for (const match of currentData.matches) {
      if (match.phaseId !== "final") continue;
      match.homeTeamId = homeId;
      match.awayTeamId = awayId;
      match.kickoffUtc = kickoffUtc;
      match.label = `${teamName(homeId)} vs ${teamName(awayId)}`;
      match.status = "SCHEDULED";
      matchesUpdated++;
    }

    // Create mapping + sync state
    const matchId = currentData.matches.find((m: any) => m.phaseId === "final")?.id;
    if (matchId) {
      await prisma.matchExternalMapping.upsert({
        where: { tournamentInstanceId_internalMatchId: { tournamentInstanceId: instanceId, internalMatchId: matchId } },
        create: { tournamentInstanceId: instanceId, internalMatchId: matchId, apiFootballFixtureId: f.fixture.id },
        update: { apiFootballFixtureId: f.fixture.id },
      });
      mappingCount++;

      const kickoff = new Date(kickoffUtc);
      await prisma.matchSyncState.upsert({
        where: { tournamentInstanceId_internalMatchId: { tournamentInstanceId: instanceId, internalMatchId: matchId } },
        create: {
          tournamentInstanceId: instanceId, internalMatchId: matchId, syncStatus: "PENDING",
          kickoffUtc: kickoff,
          firstCheckAtUtc: new Date(kickoff.getTime() + MATCH_SYNC.FIRST_CHECK_MS),
          finishCheckAtUtc: new Date(kickoff.getTime() + 140 * 60_000), // Final can have extra time
        },
        update: {
          syncStatus: "PENDING",
          kickoffUtc: kickoff,
          firstCheckAtUtc: new Date(kickoff.getTime() + MATCH_SYNC.FIRST_CHECK_MS),
          finishCheckAtUtc: new Date(kickoff.getTime() + 140 * 60_000),
        },
      });
      syncCount++;
    }
  } else {
    // ── Two-legged knockout ──
    // Group fixtures into ties (same two teams = same tie)
    const tieMap = new Map<string, any[]>();
    for (const f of fixtures) {
      const homeId = f.teams.home.id;
      const awayId = f.teams.away.id;
      const key = [Math.min(homeId, awayId), Math.max(homeId, awayId)].join("-");
      if (!tieMap.has(key)) tieMap.set(key, []);
      tieMap.get(key)!.push(f);
    }

    interface Tie {
      tieNumber: number; teamA: string; teamB: string;
      leg1: { fixtureId: number; kickoffUtc: string };
      leg2: { fixtureId: number; kickoffUtc: string };
    }

    const ties: Tie[] = [];
    let tieNum = 1;
    for (const [, legs] of tieMap.entries()) {
      legs.sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
      const leg1 = legs[0]; const leg2 = legs[1];
      if (!leg1 || !leg2) {
        log(`WARNING: Incomplete tie — only ${legs.length} leg(s)`);
        continue;
      }
      const teamA = apiToInternal[leg1.teams.home.id]!;
      const teamB = apiToInternal[leg1.teams.away.id]!;
      ties.push({
        tieNumber: tieNum++, teamA, teamB,
        leg1: { fixtureId: leg1.fixture.id, kickoffUtc: new Date(leg1.fixture.date).toISOString() },
        leg2: { fixtureId: leg2.fixture.id, kickoffUtc: new Date(leg2.fixture.date).toISOString() },
      });
    }
    log(`Grouped into ${ties.length} ties`);

    for (const tie of ties) {
      log(`  Tie ${tie.tieNumber}: ${teamName(tie.teamA)} vs ${teamName(tie.teamB)} | L1:#${tie.leg1.fixtureId} ${tie.leg1.kickoffUtc.slice(0, 16)} | L2:#${tie.leg2.fixtureId} ${tie.leg2.kickoffUtc.slice(0, 16)}`);
    }

    // Update matches in instance dataJson
    const leg1Phase = `${nextPhase}_leg1`;
    const leg2Phase = `${nextPhase}_leg2`;

    for (const tie of ties) {
      for (const match of currentData.matches) {
        if (match.tieNumber !== tie.tieNumber) continue;
        if (match.phaseId === leg1Phase) {
          match.homeTeamId = tie.teamA; match.awayTeamId = tie.teamB;
          match.kickoffUtc = tie.leg1.kickoffUtc;
          match.label = `${teamName(tie.teamA)} vs ${teamName(tie.teamB)}`;
          match.status = "SCHEDULED"; matchesUpdated++;
        } else if (match.phaseId === leg2Phase) {
          match.homeTeamId = tie.teamB; match.awayTeamId = tie.teamA;
          match.kickoffUtc = tie.leg2.kickoffUtc;
          match.label = `${teamName(tie.teamB)} vs ${teamName(tie.teamA)}`;
          match.status = "SCHEDULED"; matchesUpdated++;
        }
      }
    }

    // Create mappings + sync states
    for (const tie of ties) {
      for (const leg of [
        { matchId: `${nextPhase}_${tie.tieNumber}_leg1`, fixtureId: tie.leg1.fixtureId, kickoff: tie.leg1.kickoffUtc },
        { matchId: `${nextPhase}_${tie.tieNumber}_leg2`, fixtureId: tie.leg2.fixtureId, kickoff: tie.leg2.kickoffUtc },
      ]) {
        await prisma.matchExternalMapping.upsert({
          where: { tournamentInstanceId_internalMatchId: { tournamentInstanceId: instanceId, internalMatchId: leg.matchId } },
          create: { tournamentInstanceId: instanceId, internalMatchId: leg.matchId, apiFootballFixtureId: leg.fixtureId },
          update: { apiFootballFixtureId: leg.fixtureId },
        });
        mappingCount++;

        const kickoffUtc = new Date(leg.kickoff);
        await prisma.matchSyncState.upsert({
          where: { tournamentInstanceId_internalMatchId: { tournamentInstanceId: instanceId, internalMatchId: leg.matchId } },
          create: {
            tournamentInstanceId: instanceId, internalMatchId: leg.matchId, syncStatus: "PENDING",
            kickoffUtc, firstCheckAtUtc: new Date(kickoffUtc.getTime() + MATCH_SYNC.FIRST_CHECK_MS),
            finishCheckAtUtc: new Date(kickoffUtc.getTime() + MATCH_SYNC.FINISH_CHECK_MS),
          },
          update: {
            syncStatus: "PENDING",
            kickoffUtc, firstCheckAtUtc: new Date(kickoffUtc.getTime() + MATCH_SYNC.FIRST_CHECK_MS),
            finishCheckAtUtc: new Date(kickoffUtc.getTime() + MATCH_SYNC.FINISH_CHECK_MS),
          },
        });
        syncCount++;
      }
    }
  }

  log(`Updated ${matchesUpdated} matches in dataJson`);

  // 6. Persist instance dataJson
  await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: { dataJson: currentData },
  });

  if (instance.templateVersionId) {
    await prisma.tournamentTemplateVersion.update({
      where: { id: instance.templateVersionId },
      data: { dataJson: currentData },
    });
    log("Template version updated");
  }

  log(`Created/updated ${mappingCount} fixture mappings, ${syncCount} sync states`);

  // 7. Update fixtureSnapshot of every pool on this instance
  const pools = await prisma.pool.findMany({
    where: { tournamentInstanceId: instanceId },
    select: { id: true, name: true, fixtureSnapshot: true },
  });

  for (const pool of pools) {
    const poolData = (pool.fixtureSnapshot ?? currentData) as Record<string, any>;

    if (isFinal) {
      const finalMatch = currentData.matches.find((m: any) => m.phaseId === "final");
      if (finalMatch) {
        for (const match of poolData.matches || []) {
          if (match.phaseId !== "final") continue;
          match.homeTeamId = finalMatch.homeTeamId;
          match.awayTeamId = finalMatch.awayTeamId;
          match.kickoffUtc = finalMatch.kickoffUtc;
          match.label = finalMatch.label;
          match.status = "SCHEDULED";
        }
      }
    } else {
      // Copy resolved matches from instance data to pool
      const leg1Phase = `${nextPhase}_leg1`;
      const leg2Phase = `${nextPhase}_leg2`;
      for (const instanceMatch of currentData.matches) {
        if (instanceMatch.phaseId !== leg1Phase && instanceMatch.phaseId !== leg2Phase) continue;
        if (instanceMatch.status !== "SCHEDULED") continue;
        const poolMatch = (poolData.matches || []).find((m: any) => m.id === instanceMatch.id);
        if (poolMatch) {
          poolMatch.homeTeamId = instanceMatch.homeTeamId;
          poolMatch.awayTeamId = instanceMatch.awayTeamId;
          poolMatch.kickoffUtc = instanceMatch.kickoffUtc;
          poolMatch.label = instanceMatch.label;
          poolMatch.status = "SCHEDULED";
        }
      }
    }

    await prisma.pool.update({ where: { id: pool.id }, data: { fixtureSnapshot: poolData } });
    log(`Updated pool: ${pool.name}`);
  }

  // 8. Audit
  fireAndForget("audit:phase-sync", writeAuditEvent({
    actorUserId: options?.actorUserId ?? null,
    action: "PHASE_SYNCED_FROM_API",
    entityType: "TournamentInstance",
    entityId: instanceId,
    dataJson: { nextPhase, apiRoundName, matchesUpdated, mappings: mappingCount, syncStates: syncCount, poolsUpdated: pools.length },
  }));

  log("DONE");
  return {
    success: true,
    summary: { matchesUpdated, mappings: mappingCount, syncStates: syncCount, poolsUpdated: pools.length },
    logs,
  };
}

/**
 * Try to sync the next phase from API, or create a PendingPhaseSync if not available.
 * Called by checkAutoAdvance() when a phase completes.
 */
export async function tryAdvancePhaseFromApi(
  instanceId: string,
  completedPhase: string,
): Promise<void> {
  const nextPhase = ADVANCEMENT_MAP[completedPhase];
  if (!nextPhase) return; // No next phase (final completed = tournament done)

  const apiRoundName = PHASE_TO_API_ROUND[nextPhase];
  if (!apiRoundName) return;

  console.log(`[PhaseSync] Phase ${completedPhase} complete → trying to sync ${nextPhase} (${apiRoundName}) from API`);

  const result = await syncNextPhaseFromApi(instanceId, nextPhase);

  if (result.success) {
    // Mark any existing pending record as resolved
    await prisma.pendingPhaseSync.upsert({
      where: { tournamentInstanceId_nextPhase: { tournamentInstanceId: instanceId, nextPhase } },
      create: {
        tournamentInstanceId: instanceId,
        completedPhase, nextPhase, apiRoundName,
        status: "RESOLVED", attempts: 1,
        lastAttemptAtUtc: new Date(), resolvedAtUtc: new Date(),
      },
      update: {
        status: "RESOLVED",
        attempts: { increment: 1 },
        lastAttemptAtUtc: new Date(), resolvedAtUtc: new Date(),
        errorMessage: null,
      },
    });

    // Send admin notification
    try {
      const { sendAdminNotification } = await import("../lib/email");
      await sendAdminNotification({
        subject: `Phase Sync: ${nextPhase.toUpperCase()} configured`,
        body: `Phase ${completedPhase.toUpperCase()} completed. ${nextPhase.toUpperCase()} (${apiRoundName}) has been automatically configured from API-Football.\n\nMatches updated: ${result.summary?.matchesUpdated}\nPools updated: ${result.summary?.poolsUpdated}`,
        type: "error",
      });
    } catch { /* notification is best-effort */ }
  } else {
    // API doesn't have fixtures yet — create pending record for the 12h job
    await prisma.pendingPhaseSync.upsert({
      where: { tournamentInstanceId_nextPhase: { tournamentInstanceId: instanceId, nextPhase } },
      create: {
        tournamentInstanceId: instanceId,
        completedPhase, nextPhase, apiRoundName,
        status: "PENDING", attempts: 1,
        lastAttemptAtUtc: new Date(),
        errorMessage: result.message,
      },
      update: {
        attempts: { increment: 1 },
        lastAttemptAtUtc: new Date(),
        errorMessage: result.message,
      },
    });

    console.log(`[PhaseSync] ${nextPhase} not available yet: ${result.message}. Queued for 12h retry.`);

    // Notify admin
    try {
      const { sendAdminNotification } = await import("../lib/email");
      await sendAdminNotification({
        subject: `Phase Sync: ${nextPhase.toUpperCase()} pendiente`,
        body: `Phase ${completedPhase.toUpperCase()} completed but ${nextPhase.toUpperCase()} (${apiRoundName}) is not yet available in API-Football.\n\nReason: ${result.message}\n\nThe system will retry every 12 hours automatically.`,
        type: "error",
      });
    } catch { /* notification is best-effort */ }
  }
}
