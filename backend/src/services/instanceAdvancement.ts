// backend/src/services/instanceAdvancement.ts
/**
 * Servicio de integración para el avance automático de torneos.
 * Conecta los algoritmos de tournamentAdvancement.ts con la base de datos.
 */

import { prisma } from "../db";
import {
  calculateGroupStandings,
  determineQualifiers,
  resolvePlaceholders,
  resolveKnockoutPlaceholders,
  type TeamStanding,
} from "./tournamentAdvancement";

type AutoAdvanceValidationResult = {
  canAdvance: boolean;
  reason?: string;
  blockType?: "ERRATA" | "COMPLEX_TIE" | "INCOMPLETE" | "DISABLED";
  details?: any;
};

type TemplateData = {
  meta: any;
  teams: Array<{ id: string; name: string; code?: string; groupId?: string }>;
  phases: Array<{ id: string; name: string; type: string; order: number; config: any }>;
  matches: Array<{
    id: string;
    phaseId: string;
    kickoffUtc: string;
    matchNumber: number;
    roundLabel: string;
    venue: string;
    groupId?: string;
    homeTeamId: string;
    awayTeamId: string;
  }>;
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
 * Valida que todos los partidos de la fase de grupos tengan resultados publicados.
 */
export async function validateGroupStageComplete(instanceId: string, poolId?: string): Promise<{
  isComplete: boolean;
  missingMatches: string[];
}> {
  // Si poolId está presente, usar fixtureSnapshot del pool; sino usar instance.dataJson
  let data: TemplateData;

  if (poolId) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { tournamentInstance: true },
    });

    if (!pool) {
      throw new Error(`Pool ${poolId} no encontrado`);
    }

    data = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as TemplateData;
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
      select: { id: true },
    });

    if (pools.length === 0) {
      // Si no hay pools, no hay resultados
      return {
        isComplete: false,
        missingMatches: groupMatches.map((m) => m.id),
      };
    }

    targetPoolId = pools[0]!.id;
  }

  // Obtener resultados publicados (usando poolMatchResult + currentVersion)
  const allResults = await prisma.poolMatchResult.findMany({
    where: {
      poolId: targetPoolId,
      matchId: { in: groupMatches.map((m) => m.id) },
    },
    include: {
      currentVersion: true,
    },
  });

  // Verificar que todos los resultados tengan currentVersion
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

  if (poolId) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { tournamentInstance: true },
    });

    if (!pool) {
      throw new Error(`Pool ${poolId} no encontrado`);
    }

    data = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as TemplateData;
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
      select: { id: true },
    });

    if (pools.length === 0) {
      throw new Error(`No hay pools asociadas a la instancia ${instanceId}`);
    }

    targetPoolId = pools[0]!.id;
  }

  const results = await prisma.poolMatchResult.findMany({
    where: {
      poolId: targetPoolId,
      matchId: { in: groupMatches.map((m) => m.id) },
    },
    include: {
      currentVersion: true,
    },
  });

  // Construir mapa de resultados usando currentVersion
  const resultsMap = new Map();
  for (const r of results) {
    if (r.currentVersion) {
      resultsMap.set(r.matchId, {
        matchId: r.matchId,
        homeGoals: r.currentVersion.homeGoals,
        awayGoals: r.currentVersion.awayGoals,
      });
    }
  }

  // Calcular standings por grupo
  const allStandings = new Map<string, TeamStanding[]>();

  for (const groupId of groups) {
    if (!groupId) continue;

    // Equipos del grupo
    const teamIds = data.teams.filter((t) => t.groupId === groupId).map((t) => t.id);

    // Partidos del grupo con resultados
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

    // Calcular standings
    const standings = calculateGroupStandings(groupId, teamIds, groupMatchesData);
    allStandings.set(groupId, standings);
  }

  return allStandings;
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

  // 7. Persistir cambios SOLO en el fixtureSnapshot del pool (NO en la instance)
  await prisma.pool.update({
    where: { id: poolId },
    data: {
      fixtureSnapshot: updatedData as any,
    },
  });

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

  // 3. Obtener resultados de la fase actual
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

  // 4. Validar que todos los partidos tengan resultado
  if (results.length !== currentPhaseMatches.length) {
    throw new Error(
      `Fase ${currentPhaseId} incompleta. ${results.length}/${currentPhaseMatches.length} partidos con resultado`
    );
  }

  // 5. Determinar ganadores y perdedores
  const knockoutResults = new Map<string, { winnerId: string; loserId: string }>();

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

  // 9. Persistir cambios SOLO en el fixtureSnapshot del pool (NO en la instance)
  await prisma.pool.update({
    where: { id: poolId },
    data: {
      fixtureSnapshot: updatedData as any,
    },
  });

  return { resolvedMatches };
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
  const phaseMatches = data.matches.filter((m) => m.phaseId === phaseId);

  if (phaseMatches.length === 0) {
    return {
      canAdvance: false,
      blockType: "INCOMPLETE",
      reason: `No hay partidos en la fase ${phaseId}`,
    };
  }

  // 3. Verificar que todos los partidos tengan resultado
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

  // 3a. Verificar que todos los partidos tengan currentVersion
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

  // TODO: 5. Verificar empates complejos (implementar cuando tengamos H2H)
  // Por ahora, asumimos que los criterios FIFA estándar son suficientes

  return {
    canAdvance: true,
  };
}
