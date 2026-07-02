// backend/src/services/instanceAdvancement.ts
/**
 * Servicio de integración para el avance automático de torneos.
 * Conecta los algoritmos de tournamentAdvancement.ts con la base de datos.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { generateSyntheticFixtureId } from "../lib/syntheticFixtureId";
import { getNextPhaseId } from "../lib/fixture";
import { ensureKnockoutSyncPlumbing } from "./matchSyncInit";
import {
  calculateGroupStandings,
  determineQualifiers,
  resolvePlaceholders,
  resolveKnockoutPlaceholders,
  determineTwoLeggedTieWinner,
  type TeamStanding,
  type TwoLeggedTieResult,
} from "./tournamentAdvancement";

type AutoAdvanceValidationResult = {
  canAdvance: boolean;
  reason?: string;
  blockType?: "ERRATA" | "COMPLEX_TIE" | "INCOMPLETE" | "DISABLED";
  details?: any;
};

type TemplateData = {
  meta: any;
  teams: Array<{ id: string; name: string; code?: string; shortName?: string; groupId?: string; apiFootballId?: number }>;
  phases: Array<{ id: string; name: string; type: string; order: number; config?: any; twoLegged?: boolean; legNumber?: number }>;
  matches: Array<{
    id: string;
    phaseId: string;
    kickoffUtc: string;
    matchNumber: number;
    roundLabel?: string;
    label?: string;
    venue?: string;
    groupId?: string;
    homeTeamId: string;
    awayTeamId: string;
    tieNumber?: number;
    leg?: number;
    status?: "SCHEDULED" | "PLACEHOLDER";
  }>;
  advancement?: any;
};

type MatchResult = {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  publishedAtUtc: string;
  publishedBy: string;
  version: number;
};

/**
 * ADR-084: once the admin has RELEASED a knockout phase (gate enabled), its
 * bracket is admin-authoritative — reviewed + corrected in the Gestor de Fases.
 * Auto-advance must NEVER overwrite a released phase: the automatic best-thirds
 * resolution (`resolvePlaceholders`) can be wrong for the WC R32 allocation, and
 * a post-release advance would clobber the admin's corrected teams. Guards every
 * write path into a released phase.
 */
function isKnockoutPhaseReleased(
  instance: { knockoutReleaseGateEnabled?: boolean; releasedKnockoutPhases?: unknown } | null | undefined,
  phaseId: string,
): boolean {
  if (!instance?.knockoutReleaseGateEnabled) return false;
  const released = (instance.releasedKnockoutPhases as string[] | null) ?? [];
  return released.includes(phaseId);
}

/**
 * Valida que todos los partidos de la fase de grupos tengan resultados publicados.
 */
export async function validateGroupStageComplete(instanceId: string, poolId?: string): Promise<{
  isComplete: boolean;
  missingMatches: string[];
}> {
  // Si poolId está presente, usar fixtureSnapshot del pool; sino usar instance.dataJson
  let data: TemplateData;
  let poolForStructuralCheck: { pickTypesConfig: unknown } | null = null;

  if (poolId) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { tournamentInstance: true },
    });

    if (!pool) {
      throw new Error(`Pool ${poolId} no encontrado`);
    }

    data = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as TemplateData;
    poolForStructuralCheck = pool;
  } else {
    const instance = await prisma.tournamentInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new Error(`Instance ${instanceId} no encontrada`);
    }

    data = instance.dataJson as TemplateData;
  }

  // Obtener todos los partidos de grupos
  const groupMatches = data.matches.filter((m) => m.phaseId === "group_stage");

  // Si no se especifica poolId, obtener la primera pool de la instancia
  let targetPoolId = poolId;
  if (!targetPoolId) {
    const pools = await prisma.pool.findMany({
      where: { tournamentInstanceId: instanceId },
      select: { id: true, pickTypesConfig: true },
    });

    if (pools.length === 0) {
      // Si no hay pools, no hay resultados
      return {
        isComplete: false,
        missingMatches: groupMatches.map((m) => m.id),
      };
    }

    targetPoolId = pools[0]!.id;
    poolForStructuralCheck = pools[0]!;
  }

  // Detect structural-grupos mode (Estratega): the host publishes a
  // GroupStandingsResult per group instead of populating per-match
  // PoolMatchResults. In that mode "complete" = every group has a
  // GroupStandingsResult published.
  const phaseConfigs = (poolForStructuralCheck?.pickTypesConfig ?? []) as Array<{
    phaseId: string;
    requiresScore?: boolean;
    structuralPicks?: { type: string };
  }>;
  const groupPhaseConfig = phaseConfigs.find((p) => p.phaseId === "group_stage");
  const isStructuralGroups =
    groupPhaseConfig?.requiresScore === false &&
    groupPhaseConfig.structuralPicks?.type === "GROUP_STANDINGS";

  if (isStructuralGroups) {
    const groupIds = Array.from(
      new Set(groupMatches.map((m) => m.groupId).filter((g): g is string => !!g)),
    );
    const groupResults = await prisma.groupStandingsResult.findMany({
      where: { poolId: targetPoolId, phaseId: "group_stage", groupId: { in: groupIds } },
      select: { groupId: true },
    });
    const publishedGroupIds = new Set(groupResults.map((r) => r.groupId));
    const missingGroupIds = groupIds.filter((g) => !publishedGroupIds.has(g));
    // For consumer compatibility we report missingMatches as the union
    // of all matches whose group has not been published.
    const missingMatches = groupMatches
      .filter((m) => m.groupId && missingGroupIds.includes(m.groupId))
      .map((m) => m.id);

    return {
      isComplete: missingGroupIds.length === 0,
      missingMatches,
    };
  }

  // Score-based path: keep the original PoolMatchResult check.
  const allResults = await prisma.poolMatchResult.findMany({
    where: {
      poolId: targetPoolId,
      matchId: { in: groupMatches.map((m) => m.id) },
    },
    include: {
      currentVersion: true,
    },
  });

  const matchesWithResults = new Set();
  for (const r of allResults) {
    if (r.currentVersion) {
      matchesWithResults.add(r.matchId);
    }
  }

  const missingMatches = groupMatches
    .filter((m) => !matchesWithResults.has(m.id))
    .map((m) => m.id);

  return {
    isComplete: missingMatches.length === 0,
    missingMatches,
  };
}

/**
 * Calcula las tablas de posiciones de todos los grupos basándose en resultados reales.
 */
export async function calculateAllGroupStandings(
  instanceId: string,
  poolId?: string
): Promise<Map<string, TeamStanding[]>> {
  // Si poolId está presente, usar fixtureSnapshot del pool; sino usar instance.dataJson
  let data: TemplateData;
  let poolForStructuralCheck: { id: string; pickTypesConfig: unknown } | null = null;

  if (poolId) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { tournamentInstance: true },
    });

    if (!pool) {
      throw new Error(`Pool ${poolId} no encontrado`);
    }

    data = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as TemplateData;
    poolForStructuralCheck = pool;
  } else {
    const instance = await prisma.tournamentInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new Error(`Instance ${instanceId} no encontrada`);
    }

    data = instance.dataJson as TemplateData;
  }

  // Obtener todos los grupos únicos
  const groups = [...new Set(data.teams.map((t) => t.groupId).filter(Boolean))];

  // Obtener todos los resultados de la fase de grupos
  const groupMatches = data.matches.filter((m) => m.phaseId === "group_stage");

  // Si no se especifica poolId, obtener la primera pool de la instancia
  let targetPoolId = poolId;
  if (!targetPoolId) {
    const pools = await prisma.pool.findMany({
      where: { tournamentInstanceId: instanceId },
      select: { id: true, pickTypesConfig: true },
    });

    if (pools.length === 0) {
      throw new Error(`No hay pools asociadas a la instancia ${instanceId}`);
    }

    targetPoolId = pools[0]!.id;
    poolForStructuralCheck = pools[0]!;
  }

  // Detect structural-grupos: in Estratega the published
  // GroupStandingsResult.teamIds is the POSITION authority (it may
  // include host overrides for fair-play/drawing-of-lots the calculator
  // can't know). But the underlying matches DO have scraper-published
  // scores, so the per-team stats (points/GD/GF) are computed from them
  // — best-thirds ranking needs real performance (audit F3-8: zeroed
  // stats made rankThirdPlaceTeams fall back to ALPHABETICAL groupId
  // order, resolving the R32 bracket arbitrarily in SIMPLE pools).
  const phaseConfigs = (poolForStructuralCheck?.pickTypesConfig ?? []) as Array<{
    phaseId: string;
    requiresScore?: boolean;
    structuralPicks?: { type: string };
  }>;
  const groupPhaseConfig = phaseConfigs.find((p) => p.phaseId === "group_stage");
  const isStructuralGroups =
    groupPhaseConfig?.requiresScore === false &&
    groupPhaseConfig.structuralPicks?.type === "GROUP_STANDINGS";

  const allStandings = new Map<string, TeamStanding[]>();

  // Match scores are needed by BOTH paths (Estratega for stats,
  // score-based for the full computation). 90' goals govern group
  // tables (consistent with structuralAutoPublish — audit F3-9; in a
  // pure round-robin goals === goals90).
  const results = await prisma.poolMatchResult.findMany({
    where: {
      poolId: targetPoolId,
      matchId: { in: groupMatches.map((m) => m.id) },
    },
    include: {
      currentVersion: true,
    },
  });

  const resultsMap = new Map();
  for (const r of results) {
    if (r.currentVersion) {
      resultsMap.set(r.matchId, {
        matchId: r.matchId,
        homeGoals: r.currentVersion.homeGoals90 ?? r.currentVersion.homeGoals,
        awayGoals: r.currentVersion.awayGoals90 ?? r.currentVersion.awayGoals,
      });
    }
  }

  if (isStructuralGroups) {
    const groupResults = await prisma.groupStandingsResult.findMany({
      where: { poolId: targetPoolId, phaseId: "group_stage" },
      select: { groupId: true, teamIds: true },
    });
    const teamIdsByGroup = new Map<string, string[]>(
      groupResults.map((r) => [r.groupId, r.teamIds as string[]]),
    );

    for (const groupId of groups) {
      if (!groupId) continue;
      const ordered = teamIdsByGroup.get(groupId);
      if (!ordered) {
        throw new Error(`Grupo ${groupId} no tiene tabla publicada (Estratega)`);
      }

      // Real stats from available match scores (best-effort: matches
      // without a result are simply not counted — still strictly
      // better than all-zeros). Order is NOT taken from here.
      const groupTeamIds = data.teams.filter((t) => t.groupId === groupId).map((t) => t.id);
      const scoredMatches = data.matches
        .filter((m) => m.groupId === groupId && resultsMap.has(m.id))
        .map((m) => {
          const result = resultsMap.get(m.id)!;
          return {
            matchId: m.id,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            homeGoals: result.homeGoals,
            awayGoals: result.awayGoals,
          };
        });
      const statsByTeam = new Map<string, TeamStanding>();
      if (scoredMatches.length > 0) {
        for (const s of calculateGroupStandings(groupId, groupTeamIds, scoredMatches)) {
          statsByTeam.set(s.teamId, s);
        }
      }

      // Positions come from the PUBLISHED order (host overrides win);
      // stats come from the real scores.
      const standings: TeamStanding[] = ordered.map((teamId, idx) => {
        const stats = statsByTeam.get(teamId);
        return {
          teamId,
          groupId,
          position: idx + 1,
          played: stats?.played ?? 0,
          won: stats?.won ?? 0,
          drawn: stats?.drawn ?? 0,
          lost: stats?.lost ?? 0,
          goalsFor: stats?.goalsFor ?? 0,
          goalsAgainst: stats?.goalsAgainst ?? 0,
          goalDifference: stats?.goalDifference ?? 0,
          points: stats?.points ?? 0,
        };
      });
      allStandings.set(groupId, standings);
    }

    return allStandings;
  }

  // Score-based path: original computation from match scores.

  for (const groupId of groups) {
    if (!groupId) continue;

    const teamIds = data.teams.filter((t) => t.groupId === groupId).map((t) => t.id);

    const groupMatchesData = data.matches
      .filter((m) => m.groupId === groupId)
      .map((m) => {
        const result = resultsMap.get(m.id);
        if (!result) {
          throw new Error(`Partido ${m.id} del grupo ${groupId} no tiene resultado`);
        }
        return {
          matchId: m.id,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
        };
      });

    const standings = calculateGroupStandings(groupId, teamIds, groupMatchesData);
    allStandings.set(groupId, standings);
  }

  return allStandings;
}

/**
 * After knockout advancement resolves placeholder teams into real ones, this
 * helper makes the resolution visible to the scores tracking pipeline:
 *
 * 1. Upsert a MatchExternalMapping for each resolved match with a synthetic
 *    fixtureId (range 900000+) and the teams' apiFootballIds when available.
 *    This is what fixtureTrackingJob needs to find and register matches.
 * 2. Mirror the resolved matches into instance.dataJson so fixtureTrackingJob
 *    reads the real team names instead of placeholders (W_A, RU_B, 3rd_POOL_*).
 *
 * Both steps are idempotent: the upsert is keyed on (instanceId, internalMatchId)
 * and the dataJson write is deterministic given the same advancement inputs.
 */
async function persistResolvedKnockoutFixtures(
  instanceId: string,
  data: TemplateData,
  updatedMatches: TemplateData["matches"],
  resolvedMatches: Array<{ matchId: string; homeTeamId: string; awayTeamId: string }>,
): Promise<void> {
  for (const rm of resolvedMatches) {
    const homeTeam = data.teams.find((t) => t.id === rm.homeTeamId);
    const awayTeam = data.teams.find((t) => t.id === rm.awayTeamId);
    const syntheticId = generateSyntheticFixtureId(instanceId, rm.matchId);

    await prisma.matchExternalMapping.upsert({
      where: {
        tournamentInstanceId_internalMatchId: {
          tournamentInstanceId: instanceId,
          internalMatchId: rm.matchId,
        },
      },
      create: {
        tournamentInstanceId: instanceId,
        internalMatchId: rm.matchId,
        apiFootballFixtureId: syntheticId,
        apiFootballHomeTeamId: homeTeam?.apiFootballId ?? null,
        apiFootballAwayTeamId: awayTeam?.apiFootballId ?? null,
      },
      update: {
        apiFootballHomeTeamId: homeTeam?.apiFootballId ?? null,
        apiFootballAwayTeamId: awayTeam?.apiFootballId ?? null,
      },
    });
  }

  const updatedData = { ...data, matches: updatedMatches };
  await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: { dataJson: updatedData as Prisma.InputJsonValue },
  });

  // A2/A3 (ADR-086): every resolved fixture must have its MatchSyncState row
  // (track/stale/live-minute plumbing all start from it) and mapping teamIds
  // that mirror the canonical bracket — this was the root of the missing R32
  // sync rows (2026-06-28) and the corrupt predicted-bracket teamIds.
  const plumbing = await ensureKnockoutSyncPlumbing(
    instanceId,
    resolvedMatches.map((rm) => {
      const match = updatedMatches.find((m) => m.id === rm.matchId);
      return {
        internalMatchId: rm.matchId,
        kickoffUtc: match?.kickoffUtc ?? null,
        apiFootballHomeTeamId:
          data.teams.find((t) => t.id === rm.homeTeamId)?.apiFootballId ?? null,
        apiFootballAwayTeamId:
          data.teams.find((t) => t.id === rm.awayTeamId)?.apiFootballId ?? null,
      };
    }),
  );
  if (plumbing.syncRowsCreated > 0 || plumbing.mappingsRepaired > 0) {
    console.log(
      `[persistResolvedKnockoutFixtures] instance=${instanceId} ` +
        `syncRowsCreated=${plumbing.syncRowsCreated} mappingsRepaired=${plumbing.mappingsRepaired}`,
    );
  }
}

/**
 * Avanza el torneo de la fase de grupos al Round of 32.
 *
 * Esta función:
 * 1. Valida que todos los partidos de grupos tengan resultados
 * 2. Calcula las tablas de posiciones de todos los grupos
 * 3. Determina los clasificados (ganadores, segundos, mejores terceros)
 * 4. Resuelve los placeholders del Round of 32 con equipos reales
 * 5. Actualiza el dataJson de la instancia con los partidos resueltos
 *
 * @returns Los equipos clasificados y las tablas de posiciones
 */
export async function advanceToRoundOf32(instanceId: string, poolId?: string): Promise<{
  standings: Map<string, TeamStanding[]>;
  winners: Map<string, string>;
  runnersUp: Map<string, string>;
  bestThirds: Array<TeamStanding & { groupId: string; rankAcrossGroups: number }>;
  resolvedMatches: Array<{ matchId: string; homeTeamId: string; awayTeamId: string }>;
}> {
  // 1. Validar que la fase de grupos esté completa
  const validation = await validateGroupStageComplete(instanceId, poolId);
  if (!validation.isComplete) {
    throw new Error(
      `Fase de grupos incompleta. Faltan resultados: ${validation.missingMatches.join(", ")}`
    );
  }

  // 2. Calcular standings de todos los grupos
  const allStandings = await calculateAllGroupStandings(instanceId, poolId);

  // 3. Determinar clasificados
  const { winners, runnersUp, bestThirds } = determineQualifiers(allStandings);

  // 4. Obtener el POOL (no la instancia) y su fixtureSnapshot
  if (!poolId) {
    throw new Error("poolId es requerido para avanzar fases");
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    throw new Error(`Pool ${poolId} no encontrado`);
  }

  // Usar pool.fixtureSnapshot (copia independiente) o fallback a instance.dataJson
  const data = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as TemplateData;
  const r32Matches = data.matches.filter((m) => m.phaseId === "round_of_32");

  // 5. Resolver placeholders
  const resolvedMatches = resolvePlaceholders(r32Matches, winners, runnersUp, bestThirds);

  // 6. Actualizar dataJson con los partidos resueltos
  const updatedMatches = data.matches.map((match) => {
    const resolved = resolvedMatches.find((rm) => rm.matchId === match.id);
    if (resolved) {
      return {
        ...match,
        homeTeamId: resolved.homeTeamId,
        awayTeamId: resolved.awayTeamId,
      };
    }
    return match;
  });

  const updatedData = {
    ...data,
    matches: updatedMatches,
  };

  // ADR-084 guard: if round_of_32 is already RELEASED, the admin's reviewed
  // bracket is authoritative — do NOT overwrite it (nor its scraper mappings)
  // with the auto-resolution, which can mis-allocate best-thirds.
  if (isKnockoutPhaseReleased(pool.tournamentInstance, "round_of_32")) {
    console.log(
      `[advanceToRoundOf32] round_of_32 RELEASED for instance ${pool.tournamentInstanceId} — ` +
        `pool ${poolId} bracket is admin-authoritative; skipping auto-overwrite.`,
    );
  } else {
    // 7. Persistir cambios SOLO en el fixtureSnapshot del pool (NO en la instance)
    await prisma.pool.update({
      where: { id: poolId },
      data: {
        fixtureSnapshot: updatedData as Prisma.InputJsonValue,
      },
    });

    // 8. Register resolved fixtures with the scraper pipeline (mappings + instance.dataJson).
    //    Idempotent: safe to run across multiple pools of the same instance.
    await persistResolvedKnockoutFixtures(
      pool.tournamentInstanceId,
      data,
      updatedMatches,
      resolvedMatches,
    );
  }

  return {
    standings: allStandings,
    winners,
    runnersUp,
    bestThirds,
    resolvedMatches,
  };
}

/**
 * Avanza una ronda eliminatoria a la siguiente.
 *
 * Por ejemplo: Round of 32 → Round of 16, Round of 16 → Quarter-finals, etc.
 *
 * @param instanceId - ID de la instancia del torneo
 * @param currentPhaseId - ID de la fase actual (ej. "round_of_32")
 * @param nextPhaseId - ID de la siguiente fase (ej. "round_of_16")
 */
export async function advanceKnockoutPhase(
  instanceId: string,
  currentPhaseId: string,
  nextPhaseId: string,
  poolId?: string
): Promise<{
  resolvedMatches: Array<{ matchId: string; homeTeamId: string; awayTeamId: string }>;
}> {
  // CRÍTICO: poolId ahora es requerido
  if (!poolId) {
    throw new Error("poolId es requerido para avanzar fases");
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    throw new Error(`Pool ${poolId} no encontrado`);
  }

  // Usar pool.fixtureSnapshot (copia independiente) o fallback a instance.dataJson
  const data = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as TemplateData;

  // 1. Obtener partidos de la fase actual
  const currentPhaseMatches = data.matches.filter((m) => m.phaseId === currentPhaseId);

  // 2. targetPoolId es el poolId recibido
  const targetPoolId = poolId;

  // 3. Determinar la fuente de winners según el modo de la fase.
  //
  //    Score-based phase (matchPicks): derive winners from
  //    PoolMatchResult.currentVersion (goals + penalties).
  //
  //    Structural KNOCKOUT_WINNER phase (Estratega): read winners
  //    directly from StructuralPhaseResult.resultJson.matches[]. No
  //    PoolMatchResult exists for those matches.
  const phaseConfigs = (pool.pickTypesConfig ?? []) as Array<{
    phaseId: string;
    requiresScore?: boolean;
    structuralPicks?: { type: string };
  }>;
  const currentPhaseConfig = phaseConfigs.find((p) => p.phaseId === currentPhaseId);
  const isStructuralKnockout =
    currentPhaseConfig?.requiresScore === false &&
    currentPhaseConfig.structuralPicks?.type === "KNOCKOUT_WINNER";

  // knockoutResults is what step 6/7 below need: matchId → {winnerId, loserId}.
  const knockoutResults = new Map<string, { winnerId: string; loserId: string }>();

  if (isStructuralKnockout) {
    const sr = await prisma.structuralPhaseResult.findUnique({
      where: { poolId_phaseId: { poolId: targetPoolId, phaseId: currentPhaseId } },
      select: { resultJson: true },
    });
    const winners =
      ((sr?.resultJson as { matches?: Array<{ matchId: string; winnerId: string }> } | null)
        ?.matches) ?? [];
    const winnerByMatch = new Map(winners.map((w) => [w.matchId, w.winnerId]));

    if (winnerByMatch.size !== currentPhaseMatches.length) {
      throw new Error(
        `Fase ${currentPhaseId} estructural incompleta. ${winnerByMatch.size}/${currentPhaseMatches.length} partidos con ganador publicado`,
      );
    }

    for (const match of currentPhaseMatches) {
      const winnerId = winnerByMatch.get(match.id);
      if (!winnerId) continue;
      const loserId = winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
      knockoutResults.set(match.id, { winnerId, loserId });
    }
  } else {
    // Score-based: original path.
    const allResults = await prisma.poolMatchResult.findMany({
      where: {
        poolId: targetPoolId,
        matchId: { in: currentPhaseMatches.map((m) => m.id) },
      },
      include: {
        currentVersion: true,
      },
    });

    const results = allResults
      .filter((r) => r.currentVersion !== null)
      .map((r) => ({
        matchId: r.matchId,
        homeGoals: r.currentVersion!.homeGoals,
        awayGoals: r.currentVersion!.awayGoals,
        homePenalties: r.currentVersion!.homePenalties,
        awayPenalties: r.currentVersion!.awayPenalties,
      }));

    if (results.length !== currentPhaseMatches.length) {
      throw new Error(
        `Fase ${currentPhaseId} incompleta. ${results.length}/${currentPhaseMatches.length} partidos con resultado`,
      );
    }

    for (const result of results) {
      const match = currentPhaseMatches.find((m) => m.id === result.matchId);
      if (!match) continue;

      let winnerId: string;
      let loserId: string;

      if (result.homeGoals > result.awayGoals) {
        winnerId = match.homeTeamId;
        loserId = match.awayTeamId;
      } else if (result.awayGoals > result.homeGoals) {
        winnerId = match.awayTeamId;
        loserId = match.homeTeamId;
      } else {
        // Empate en tiempo regular → usar penalties
        if (
          result.homePenalties !== null &&
          result.homePenalties !== undefined &&
          result.awayPenalties !== null &&
          result.awayPenalties !== undefined
        ) {
          if (result.homePenalties > result.awayPenalties) {
            winnerId = match.homeTeamId;
            loserId = match.awayTeamId;
          } else if (result.awayPenalties > result.homePenalties) {
            winnerId = match.awayTeamId;
            loserId = match.homeTeamId;
          } else {
            throw new Error(
              `Partido ${result.matchId} terminó empatado en penales. Los penalties no pueden ser iguales.`
            );
          }
        } else {
          throw new Error(
            `Partido ${result.matchId} terminó en empate en tiempo regular pero no tiene penalties definidos.`
          );
        }
      }

      knockoutResults.set(match.id, { winnerId, loserId });
    }
  }

  // 6. Obtener partidos de la siguiente fase
  const nextPhaseMatches = data.matches.filter((m) => m.phaseId === nextPhaseId);

  // 7. Resolver placeholders
  const resolvedMatches = resolveKnockoutPlaceholders(nextPhaseMatches, knockoutResults);

  // 8. Actualizar dataJson
  const updatedMatches = data.matches.map((match) => {
    const resolved = resolvedMatches.find((rm) => rm.matchId === match.id);
    if (resolved) {
      return {
        ...match,
        homeTeamId: resolved.homeTeamId,
        awayTeamId: resolved.awayTeamId,
      };
    }
    return match;
  });

  const updatedData = {
    ...data,
    matches: updatedMatches,
  };

  // ADR-084 guard: never overwrite a phase the admin has already RELEASED.
  if (isKnockoutPhaseReleased(pool.tournamentInstance, nextPhaseId)) {
    console.log(
      `[advanceKnockoutPhase] ${nextPhaseId} RELEASED for instance ${pool.tournamentInstanceId} — ` +
        `pool ${poolId} bracket is admin-authoritative; skipping auto-overwrite.`,
    );
  } else {
    // 9. Persistir cambios SOLO en el fixtureSnapshot del pool (NO en la instance)
    await prisma.pool.update({
      where: { id: poolId },
      data: {
        fixtureSnapshot: updatedData as Prisma.InputJsonValue,
      },
    });

    // 10. Register resolved fixtures with the scraper pipeline (mappings + instance.dataJson).
    //     Idempotent: safe to run across multiple pools of the same instance.
    await persistResolvedKnockoutFixtures(
      pool.tournamentInstanceId,
      data,
      updatedMatches,
      resolvedMatches,
    );
  }

  return { resolvedMatches };
}

/**
 * Avanza una ronda eliminatoria a dos partidos (ida + vuelta) a la siguiente ronda.
 *
 * Para torneos con formato two-legged (UCL, Copa Libertadores, etc.):
 * - Toma las dos phases (leg1 + leg2) de la ronda actual
 * - Calcula el aggregate de cada llave (tieNumber)
 * - Determina los ganadores
 * - Resuelve los equipos en la siguiente ronda
 *
 * IMPORTANTE: Solo modifica pool.fixtureSnapshot, NO instance.dataJson.
 * Esto permite que cada pool avance independientemente.
 *
 * @param instanceId - ID de la instancia del torneo
 * @param currentRound - Prefijo de la ronda actual (ej: "r32", "r16", "qf", "sf")
 * @param nextRound - Prefijo de la siguiente ronda (ej: "r16", "qf", "sf", "final")
 * @param poolId - ID de la pool a avanzar
 */
export async function advanceTwoLeggedPhase(
  instanceId: string,
  currentRound: string,
  nextRound: string,
  poolId: string
): Promise<{
  winners: TwoLeggedTieResult[];
  resolvedMatches: Array<{ matchId: string; homeTeamId: string; awayTeamId: string; label: string }>;
}> {
  // 1. Obtener pool y fixture data
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    throw new Error(`Pool ${poolId} no encontrado`);
  }

  const data = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as TemplateData & {
    teams?: Array<{ id: string; name: string; shortName?: string }>;
  };

  // 2. Derivar phase IDs
  const leg1PhaseId = `${currentRound}_leg1`;
  const leg2PhaseId = `${currentRound}_leg2`;

  // Determinar si la siguiente ronda es la final (partido único) o two-legged
  const nextPhases = data.phases?.filter((p) => p.id.startsWith(nextRound));
  const isNextFinal = nextRound === "final";

  // 3. Obtener matches de ambas legs
  const leg1Matches = data.matches.filter((m) => m.phaseId === leg1PhaseId);
  const leg2Matches = data.matches.filter((m) => m.phaseId === leg2PhaseId);

  if (leg1Matches.length === 0 || leg2Matches.length === 0) {
    throw new Error(
      `No se encontraron partidos para ${leg1PhaseId} (${leg1Matches.length}) o ${leg2PhaseId} (${leg2Matches.length})`
    );
  }

  if (leg1Matches.length !== leg2Matches.length) {
    throw new Error(
      `Cantidad desigual de partidos: ${leg1PhaseId}=${leg1Matches.length}, ${leg2PhaseId}=${leg2Matches.length}`
    );
  }

  // 4. Obtener TODOS los resultados de ambas phases
  const allMatchIds = [...leg1Matches, ...leg2Matches].map((m) => m.id);
  const allResults = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: allMatchIds },
    },
    include: { currentVersion: true },
  });

  const resultsMap = new Map<string, {
    homeGoals: number;
    awayGoals: number;
    homePenalties: number | null;
    awayPenalties: number | null;
  }>();

  for (const r of allResults) {
    if (r.currentVersion) {
      resultsMap.set(r.matchId, {
        homeGoals: r.currentVersion.homeGoals,
        awayGoals: r.currentVersion.awayGoals,
        homePenalties: r.currentVersion.homePenalties,
        awayPenalties: r.currentVersion.awayPenalties,
      });
    }
  }

  // 5. Validar que TODOS los partidos tengan resultado
  const missingResults = allMatchIds.filter((id) => !resultsMap.has(id));
  if (missingResults.length > 0) {
    throw new Error(
      `Faltan resultados para ${missingResults.length} partidos: ${missingResults.join(", ")}`
    );
  }

  // 6. Agrupar por tieNumber y calcular aggregate
  const tieNumbers = [...new Set(leg1Matches.map((m) => m.tieNumber!))].sort(
    (a, b) => a - b
  );

  const winners: TwoLeggedTieResult[] = [];

  for (const tieNum of tieNumbers) {
    const leg1Match = leg1Matches.find((m) => m.tieNumber === tieNum);
    const leg2Match = leg2Matches.find((m) => m.tieNumber === tieNum);

    if (!leg1Match || !leg2Match) {
      throw new Error(`No se encontraron ambas legs para llave ${tieNum}`);
    }

    const leg1Result = resultsMap.get(leg1Match.id)!;
    const leg2Result = resultsMap.get(leg2Match.id)!;

    // teamA = home en leg1, away en leg2
    const teamAId = leg1Match.homeTeamId;
    // teamB = away en leg1, home en leg2
    const teamBId = leg1Match.awayTeamId;

    const tieResult = determineTwoLeggedTieWinner(
      {
        matchId: leg1Match.id,
        homeGoals: leg1Result.homeGoals,
        awayGoals: leg1Result.awayGoals,
      },
      {
        matchId: leg2Match.id,
        homeGoals: leg2Result.homeGoals,
        awayGoals: leg2Result.awayGoals,
        homePenalties: leg2Result.homePenalties,
        awayPenalties: leg2Result.awayPenalties,
      },
      teamAId,
      teamBId,
      tieNum
    );

    winners.push(tieResult);
  }

  // 7. Resolver equipos en la siguiente fase
  const teamName = (id: string) =>
    (data.teams ?? []).find((t) => t.id === id)?.name ?? id;

  const resolvedMatches: Array<{ matchId: string; homeTeamId: string; awayTeamId: string; label: string }> = [];

  if (isNextFinal) {
    // Final: partido único. Los ganadores de SF van directo.
    const finalMatch = data.matches.find((m) => m.phaseId === "final");
    if (finalMatch && winners.length >= 2) {
      const homeTeamId = winners[0]!.winnerId;
      const awayTeamId = winners[1]!.winnerId;
      resolvedMatches.push({
        matchId: finalMatch.id,
        homeTeamId,
        awayTeamId,
        label: `${teamName(homeTeamId)} vs ${teamName(awayTeamId)}`,
      });
    }
  } else {
    // Rondas two-legged: los ganadores se asignan a las llaves de la siguiente fase
    const nextLeg1PhaseId = `${nextRound}_leg1`;
    const nextLeg2PhaseId = `${nextRound}_leg2`;

    const nextLeg1Matches = data.matches
      .filter((m) => m.phaseId === nextLeg1PhaseId)
      .sort((a, b) => (a.tieNumber ?? 0) - (b.tieNumber ?? 0));
    const nextLeg2Matches = data.matches
      .filter((m) => m.phaseId === nextLeg2PhaseId)
      .sort((a, b) => (a.tieNumber ?? 0) - (b.tieNumber ?? 0));

    for (let i = 0; i < nextLeg1Matches.length; i++) {
      const nextLeg1 = nextLeg1Matches[i]!;
      const nextLeg2 = nextLeg2Matches[i];

      // Cada llave de la siguiente fase ya tiene sus equipos definidos si el fixture
      // fue actualizado por el sorteo. Si aún son TBD, los rellenamos.
      // Para el avance automático, el nextLeg1 match ya debería tener equipos
      // excepto los que vienen de la ronda anterior.
      const currentHome = nextLeg1.homeTeamId;
      const currentAway = nextLeg1.awayTeamId;

      // Si los equipos ya están asignados (no TBD), no los sobreescribimos
      if (currentHome !== "t_TBD" && currentAway !== "t_TBD") {
        continue;
      }

      // Buscar el ganador correspondiente para esta llave
      // La correspondencia depende de la estructura del bracket
      // Por ahora, usamos orden secuencial: winner[i] va a nextLeg1[i]
      if (i < winners.length) {
        const winner = winners[i]!;
        const homeTeamId = winner.winnerId;
        // El oponente puede estar ya definido (cabeza de serie) o ser otro ganador
        let awayTeamId = currentAway !== "t_TBD" ? currentAway : (
          i + winners.length / 2 < winners.length ? winners[i + winners.length / 2]?.winnerId ?? "t_TBD" : "t_TBD"
        );

        const label = `${teamName(homeTeamId)} vs ${teamName(awayTeamId)}`;

        resolvedMatches.push({
          matchId: nextLeg1.id,
          homeTeamId,
          awayTeamId,
          label,
        });

        if (nextLeg2) {
          resolvedMatches.push({
            matchId: nextLeg2.id,
            homeTeamId: awayTeamId,
            awayTeamId: homeTeamId,
            label: `${teamName(awayTeamId)} vs ${teamName(homeTeamId)}`,
          });
        }
      }
    }
  }

  // 8. Actualizar dataJson con los partidos resueltos
  const updatedMatches = data.matches.map((match) => {
    const resolved = resolvedMatches.find((rm) => rm.matchId === match.id);
    if (resolved) {
      return {
        ...match,
        homeTeamId: resolved.homeTeamId,
        awayTeamId: resolved.awayTeamId,
        label: resolved.label,
        status: match.homeTeamId === "t_TBD" ? "SCHEDULED" : match.status,
      };
    }
    return match;
  });

  const updatedData = { ...data, matches: updatedMatches };

  // 9. Persistir cambios SOLO en el fixtureSnapshot del pool
  await prisma.pool.update({
    where: { id: poolId },
    data: { fixtureSnapshot: updatedData as Prisma.InputJsonValue },
  });

  return { winners, resolvedMatches };
}

/**
 * Valida si una fase puede avanzar automáticamente.
 *
 * Bloquea el avance si:
 * 1. Auto-advance está deshabilitado en la pool
 * 2. Hay erratas recientes (versión > 1 en las últimas 24 horas)
 * 3. La fase no está completa
 * 4. (Futuro) Hay empates complejos sin resolver
 */
export async function validateCanAutoAdvance(
  instanceId: string,
  phaseId: string,
  poolId: string
): Promise<AutoAdvanceValidationResult> {
  // 1. Verificar que auto-advance esté habilitado
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { autoAdvanceEnabled: true },
  });

  if (!pool) {
    return {
      canAdvance: false,
      blockType: "INCOMPLETE",
      reason: "Pool no encontrada",
    };
  }

  if (!pool.autoAdvanceEnabled) {
    return {
      canAdvance: false,
      blockType: "DISABLED",
      reason: "Auto-advance deshabilitado por configuración de la pool",
    };
  }

  // 2. Obtener instance y partidos de la fase
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    return {
      canAdvance: false,
      blockType: "INCOMPLETE",
      reason: `Instance ${instanceId} no encontrada`,
    };
  }

  const data = instance.dataJson as TemplateData;

  // ADR-084: if the phase we'd advance INTO is already RELEASED by the admin,
  // its bracket is authoritative — don't auto-advance (would clobber the
  // admin-reviewed teams). Early-exit so the timer path doesn't even try.
  const nextPhaseId = getNextPhaseId(instance.dataJson, phaseId);
  if (nextPhaseId && isKnockoutPhaseReleased(instance, nextPhaseId)) {
    return {
      canAdvance: false,
      blockType: "DISABLED",
      reason: `La fase ${nextPhaseId} ya fue liberada por el admin (bracket autoritativo)`,
    };
  }

  const phaseMatches = data.matches.filter((m) => m.phaseId === phaseId);

  if (phaseMatches.length === 0) {
    return {
      canAdvance: false,
      blockType: "INCOMPLETE",
      reason: `No hay partidos en la fase ${phaseId}`,
    };
  }

  // 3. Verificar que la fase esté completa.
  //
  // The "complete" signal depends on the scoring mode of THIS phase:
  //
  //   - Score-based (matchPicks): a PoolMatchResult.currentVersion per
  //     match. This is what the score-based presets (Predictor / BASIC
  //     / CUSTOM-marcador) already populate as the host enters scores.
  //
  //   - Structural GROUP_STANDINGS (Estratega-grupos): a
  //     GroupStandingsResult per group in this phase. In Estratega the
  //     host publishes the standings directly via drag-and-drop, no
  //     PoolMatchResult ever exists for those games.
  //
  //   - Structural KNOCKOUT_WINNER (Estratega-knockouts): a single
  //     StructuralPhaseResult for the phase, whose resultJson.matches[]
  //     contains a winnerId for every match.
  //
  // We pick the right check by looking at the phase's pickTypesConfig
  // entry on the pool itself.
  const poolWithConfig = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { pickTypesConfig: true },
  });
  const phaseConfigs = (poolWithConfig?.pickTypesConfig ?? []) as Array<{
    phaseId: string;
    requiresScore?: boolean;
    structuralPicks?: { type: string };
  }>;
  const phaseConfig = phaseConfigs.find((p) => p.phaseId === phaseId);
  const structuralType =
    phaseConfig?.requiresScore === false
      ? phaseConfig.structuralPicks?.type ?? null
      : null;

  // Used by the score-based completion check below AND by the recent-errata
  // check (only score-based phases have erratas — structural results don't
  // have a versions[] history yet, so they bypass the errata rule).
  const results = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: phaseMatches.map((m) => m.id) },
    },
    include: {
      currentVersion: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  });

  if (structuralType === "GROUP_STANDINGS") {
    // Phase completes when every group in the phase has a
    // GroupStandingsResult published.
    const groupIds = Array.from(
      new Set(phaseMatches.map((m) => m.groupId).filter((g): g is string => !!g)),
    );
    if (groupIds.length === 0) {
      return {
        canAdvance: false,
        blockType: "INCOMPLETE",
        reason: `Fase ${phaseId} estructural por grupos pero no hay groupIds en los partidos`,
      };
    }
    const groupResults = await prisma.groupStandingsResult.findMany({
      where: { poolId, phaseId, groupId: { in: groupIds } },
      select: { groupId: true },
    });
    if (groupResults.length < groupIds.length) {
      const missing = groupIds.filter(
        (g) => !groupResults.some((r) => r.groupId === g),
      );
      return {
        canAdvance: false,
        blockType: "INCOMPLETE",
        reason: `Fase ${phaseId} estructural incompleta. ${groupResults.length}/${groupIds.length} grupos con tabla publicada`,
        details: { missingGroups: missing },
      };
    }
  } else if (structuralType === "KNOCKOUT_WINNER") {
    // Phase completes when StructuralPhaseResult.resultJson.matches[]
    // has a winnerId for every match in the phase.
    const sr = await prisma.structuralPhaseResult.findUnique({
      where: { poolId_phaseId: { poolId, phaseId } },
      select: { resultJson: true },
    });
    const winners = ((sr?.resultJson as { matches?: Array<{ matchId: string; winnerId: string }> } | null)
      ?.matches) ?? [];
    const winnerByMatchId = new Map(winners.map((w) => [w.matchId, w.winnerId]));
    const missing = phaseMatches.filter((m) => !winnerByMatchId.get(m.id));
    if (missing.length > 0) {
      return {
        canAdvance: false,
        blockType: "INCOMPLETE",
        reason: `Fase ${phaseId} estructural incompleta. ${phaseMatches.length - missing.length}/${phaseMatches.length} partidos con ganador publicado`,
        details: { missingMatches: missing.map((m) => m.id) },
      };
    }
  } else {
    // Score-based phase — original check on PoolMatchResult.
    const matchesWithResults = results.filter((r) => r.currentVersion !== null);
    if (matchesWithResults.length !== phaseMatches.length) {
      return {
        canAdvance: false,
        blockType: "INCOMPLETE",
        reason: `Fase ${phaseId} incompleta. ${matchesWithResults.length}/${phaseMatches.length} partidos con resultado`,
        details: {
          missingMatches: phaseMatches.filter(
            (m) => !matchesWithResults.some((r) => r.matchId === m.id)
          ).map((m) => m.id),
        },
      };
    }
  }

  // 4. Verificar si hay erratas recientes (versión > 1 en últimas 24h)
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentErratas = results.filter((r) => {
    if (!r.currentVersion) return false;
    return (
      r.currentVersion.versionNumber > 1 &&
      r.currentVersion.publishedAtUtc >= twentyFourHoursAgo
    );
  });

  if (recentErratas.length > 0) {
    return {
      canAdvance: false,
      blockType: "ERRATA",
      reason: `Se detectaron ${recentErratas.length} errata(s) reciente(s) en las últimas 24 horas. El host debe revisar y avanzar manualmente.`,
      details: {
        errataMatches: recentErratas.map((r) => ({
          matchId: r.matchId,
          versionNumber: r.currentVersion!.versionNumber,
          publishedAt: r.currentVersion!.publishedAtUtc,
          reason: r.currentVersion!.reason,
        })),
      },
    };
  }

  return {
    canAdvance: true,
  };
}
