// Lógica de scoring avanzado para picks
// Sprint 2 - Advanced Pick Types System

import type {
  PhasePickConfig,
  MatchPicksConfig,
  MatchPickTypeKey,
  PickEvaluationResult,
  MatchScoringResult,
} from "../types/pickConfig";

// ==================== TIPOS PARA SCORING ====================

type MatchScore = {
  homeGoals: number;
  awayGoals: number;
};

type MatchPick = {
  homeGoals: number;
  awayGoals: number;
};

// ==================== SCORING ENGINE ====================

/**
 * Detecta si la configuración usa el sistema acumulativo (nuevos tipos HOME_GOALS, AWAY_GOALS)
 * o el sistema legacy (EXACT_SCORE que termina la evaluación)
 */
function isCumulativeScoring(enabledTypes: { key: string }[]): boolean {
  // Si tiene HOME_GOALS o AWAY_GOALS habilitados, es sistema acumulativo
  return enabledTypes.some((t) => t.key === "HOME_GOALS" || t.key === "AWAY_GOALS");
}

/**
 * Evalúa un pick de partido contra el resultado oficial
 * y calcula puntos según la configuración de la fase
 *
 * SOPORTA DOS SISTEMAS:
 * 1. ACUMULATIVO (nuevo): Los puntos se suman por cada criterio cumplido
 *    - Usa HOME_GOALS, AWAY_GOALS, GOAL_DIFFERENCE, MATCH_OUTCOME_90MIN
 *    - El marcador exacto = suma de todos los criterios
 * 2. LEGACY: EXACT_SCORE termina la evaluación inmediatamente
 *
 * @param pick - Predicción del usuario
 * @param result - Resultado oficial del partido
 * @param config - Configuración de la fase
 * @returns Resultado de scoring con puntos totales y evaluaciones
 */
export function scoreMatchPick(
  pick: MatchPick,
  result: MatchScore,
  config: PhasePickConfig
): MatchScoringResult {
  if (!config.requiresScore || !config.matchPicks) {
    throw new Error("scoreMatchPick solo se usa para fases con requiresScore=true");
  }

  const evaluations: PickEvaluationResult[] = [];
  let totalPoints = 0;

  const matchConfig = config.matchPicks;
  const enabledTypes = matchConfig.types.filter((t) => t.enabled);

  // Detectar qué sistema usar
  if (isCumulativeScoring(enabledTypes)) {
    // ==================== SISTEMA ACUMULATIVO ====================
    // Evalúa TODOS los criterios y suma puntos de cada uno que cumpla

    // 1. MATCH_OUTCOME_90MIN (Resultado: ganador/empate)
    const outcomeType = enabledTypes.find((t) => t.key === "MATCH_OUTCOME_90MIN");
    if (outcomeType) {
      const matched = evaluateMatchOutcome(pick, result);
      evaluations.push({
        matchPickType: "MATCH_OUTCOME_90MIN",
        points: matched ? outcomeType.points : 0,
        matched,
      });
      if (matched) totalPoints += outcomeType.points;
    }

    // 2. HOME_GOALS (Goles del local exactos)
    const homeGoalsType = enabledTypes.find((t) => t.key === "HOME_GOALS");
    if (homeGoalsType) {
      const matched = pick.homeGoals === result.homeGoals;
      evaluations.push({
        matchPickType: "HOME_GOALS",
        points: matched ? homeGoalsType.points : 0,
        matched,
      });
      if (matched) totalPoints += homeGoalsType.points;
    }

    // 3. AWAY_GOALS (Goles del visitante exactos)
    const awayGoalsType = enabledTypes.find((t) => t.key === "AWAY_GOALS");
    if (awayGoalsType) {
      const matched = pick.awayGoals === result.awayGoals;
      evaluations.push({
        matchPickType: "AWAY_GOALS",
        points: matched ? awayGoalsType.points : 0,
        matched,
      });
      if (matched) totalPoints += awayGoalsType.points;
    }

    // 4. GOAL_DIFFERENCE (Diferencia de goles exacta)
    const goalDiffType = enabledTypes.find((t) => t.key === "GOAL_DIFFERENCE");
    if (goalDiffType) {
      const matched = evaluateGoalDifference(pick, result);
      evaluations.push({
        matchPickType: "GOAL_DIFFERENCE",
        points: matched ? goalDiffType.points : 0,
        matched,
      });
      if (matched) totalPoints += goalDiffType.points;
    }

    // 5. TOTAL_GOALS (si está habilitado en modo acumulativo)
    const totalGoalsType = enabledTypes.find((t) => t.key === "TOTAL_GOALS");
    if (totalGoalsType) {
      const matched = evaluateTotalGoals(pick, result);
      evaluations.push({
        matchPickType: "TOTAL_GOALS",
        points: matched ? totalGoalsType.points : 0,
        matched,
      });
      if (matched) totalPoints += totalGoalsType.points;
    }

    return {
      matchId: "", // Se llena desde el llamador
      totalPoints,
      evaluations,
    };
  }

  // ==================== SISTEMA LEGACY ====================
  // EXACT_SCORE termina la evaluación si acierta

  // 1. EXACT_SCORE (termina si acierta)
  const exactScoreType = enabledTypes.find((t) => t.key === "EXACT_SCORE");
  if (exactScoreType) {
    const matched = evaluateExactScore(pick, result);
    if (matched) {
      evaluations.push({
        matchPickType: "EXACT_SCORE",
        points: exactScoreType.points,
        matched: true,
      });
      totalPoints += exactScoreType.points;

      // TERMINA: si acertó exacto, no evalúa otros tipos
      return {
        matchId: "", // Se llena desde el llamador
        totalPoints,
        evaluations,
      };
    } else {
      evaluations.push({
        matchPickType: "EXACT_SCORE",
        points: 0,
        matched: false,
      });
    }
  }

  // 2. GOAL_DIFFERENCE (solo si no acertó exacto)
  const goalDiffType = enabledTypes.find((t) => t.key === "GOAL_DIFFERENCE");
  if (goalDiffType) {
    const matched = evaluateGoalDifference(pick, result);
    if (matched) {
      evaluations.push({
        matchPickType: "GOAL_DIFFERENCE",
        points: goalDiffType.points,
        matched: true,
      });
      totalPoints += goalDiffType.points;
    } else {
      evaluations.push({
        matchPickType: "GOAL_DIFFERENCE",
        points: 0,
        matched: false,
      });
    }
  }

  // 3. PARTIAL_SCORE (solo si no acertó exacto)
  const partialScoreType = enabledTypes.find((t) => t.key === "PARTIAL_SCORE");
  if (partialScoreType) {
    const matched = evaluatePartialScore(pick, result);
    if (matched) {
      evaluations.push({
        matchPickType: "PARTIAL_SCORE",
        points: partialScoreType.points,
        matched: true,
      });
      totalPoints += partialScoreType.points;
    } else {
      evaluations.push({
        matchPickType: "PARTIAL_SCORE",
        points: 0,
        matched: false,
      });
    }
  }

  // 4. TOTAL_GOALS
  const totalGoalsType = enabledTypes.find((t) => t.key === "TOTAL_GOALS");
  if (totalGoalsType) {
    const matched = evaluateTotalGoals(pick, result);
    if (matched) {
      evaluations.push({
        matchPickType: "TOTAL_GOALS",
        points: totalGoalsType.points,
        matched: true,
      });
      totalPoints += totalGoalsType.points;
    } else {
      evaluations.push({
        matchPickType: "TOTAL_GOALS",
        points: 0,
        matched: false,
      });
    }
  }

  // 5. MATCH_OUTCOME_90MIN (sistema legacy también puede tenerlo)
  const outcomeType = enabledTypes.find((t) => t.key === "MATCH_OUTCOME_90MIN");
  if (outcomeType) {
    const matched = evaluateMatchOutcome(pick, result);
    if (matched) {
      evaluations.push({
        matchPickType: "MATCH_OUTCOME_90MIN",
        points: outcomeType.points,
        matched: true,
      });
      totalPoints += outcomeType.points;
    } else {
      evaluations.push({
        matchPickType: "MATCH_OUTCOME_90MIN",
        points: 0,
        matched: false,
      });
    }
  }

  return {
    matchId: "", // Se llena desde el llamador
    totalPoints,
    evaluations,
  };
}

// ==================== EVALUADORES POR TIPO ====================

/**
 * Evalúa EXACT_SCORE: el marcador debe ser exactamente igual
 */
function evaluateExactScore(pick: MatchPick, result: MatchScore): boolean {
  return pick.homeGoals === result.homeGoals && pick.awayGoals === result.awayGoals;
}

/**
 * Evalúa GOAL_DIFFERENCE: la diferencia de goles debe ser igual
 * Ejemplo: Predicción 2-0 (+2), Resultado 3-1 (+2) = acierto
 */
function evaluateGoalDifference(pick: MatchPick, result: MatchScore): boolean {
  const pickDiff = pick.homeGoals - pick.awayGoals;
  const resultDiff = result.homeGoals - result.awayGoals;
  return pickDiff === resultDiff;
}

/**
 * Evalúa PARTIAL_SCORE: acierta goles del local O visitante (no ambos)
 * Si acierta ambos, NO cuenta (eso es EXACT_SCORE)
 */
function evaluatePartialScore(pick: MatchPick, result: MatchScore): boolean {
  const homeMatch = pick.homeGoals === result.homeGoals;
  const awayMatch = pick.awayGoals === result.awayGoals;

  // Solo uno debe coincidir (XOR lógico)
  return homeMatch !== awayMatch;
}

/**
 * Evalúa TOTAL_GOALS: el total de goles debe ser igual
 * Ejemplo: Predicción 2-1 (3 goles), Resultado 3-0 (3 goles) = acierto
 */
function evaluateTotalGoals(pick: MatchPick, result: MatchScore): boolean {
  const pickTotal = pick.homeGoals + pick.awayGoals;
  const resultTotal = result.homeGoals + result.awayGoals;
  return pickTotal === resultTotal;
}

/**
 * Evalúa MATCH_OUTCOME_90MIN: el resultado (ganador o empate) debe ser igual
 * Ejemplo: Predicción 2-1 (HOME wins), Resultado 3-0 (HOME wins) = acierto
 */
function evaluateMatchOutcome(pick: MatchPick, result: MatchScore): boolean {
  const pickOutcome = pick.homeGoals > pick.awayGoals ? "HOME" : pick.homeGoals < pick.awayGoals ? "AWAY" : "DRAW";
  const resultOutcome = result.homeGoals > result.awayGoals ? "HOME" : result.homeGoals < result.awayGoals ? "AWAY" : "DRAW";
  return pickOutcome === resultOutcome;
}

// ==================== AUTO-SCALING ====================

/**
 * Aplica auto-scaling a los puntos según la configuración
 * Multiplica puntos base por el multiplicador de la fase
 *
 * @param basePoints - Puntos base configurados
 * @param phaseId - ID de la fase actual
 * @param config - Configuración de match picks (con autoScaling)
 * @returns Puntos escalados
 */
export function applyAutoScaling(
  basePoints: number,
  phaseId: string,
  config: MatchPicksConfig
): number {
  if (!config.autoScaling || !config.autoScaling.enabled) {
    return basePoints;
  }

  const multiplier = config.autoScaling.multipliers[phaseId];
  if (!multiplier) {
    // Si no hay multiplicador para esta fase, usar puntos base
    return basePoints;
  }

  return Math.round(basePoints * multiplier);
}

/**
 * Aplica auto-scaling a todos los tipos de pick de una configuración
 * Útil para pre-procesar la config antes de scoring
 *
 * @param config - Configuración de fase
 * @param phaseId - ID de la fase actual
 * @returns Configuración con puntos escalados
 */
export function applyAutoScalingToConfig(
  config: PhasePickConfig,
  phaseId: string
): PhasePickConfig {
  if (!config.requiresScore || !config.matchPicks) {
    return config;
  }

  if (!config.matchPicks.autoScaling || !config.matchPicks.autoScaling.enabled) {
    return config;
  }

  return {
    ...config,
    matchPicks: {
      ...config.matchPicks,
      types: config.matchPicks.types.map((type) => ({
        ...type,
        points: applyAutoScaling(type.points, phaseId, config.matchPicks!),
      })),
    },
  };
}

// ==================== PUNTOS MÁXIMOS CALCULABLES ====================

/**
 * Calcula puntos máximos teóricos para una fase con match picks
 *
 * SOPORTA DOS SISTEMAS:
 * 1. ACUMULATIVO: Máximo = suma de todos los tipos habilitados
 * 2. LEGACY: Máximo = el tipo con más puntos (EXACT_SCORE)
 *
 * @param config - Configuración de la fase
 * @param matchCount - Número de partidos en la fase
 * @param phaseId - ID de la fase (para auto-scaling)
 * @returns Puntos máximos posibles
 */
export function calculateMaxPointsForPhase(
  config: PhasePickConfig,
  matchCount: number,
  phaseId?: string
): number {
  if (!config.requiresScore || !config.matchPicks) {
    // Para structural picks, se calcula de forma diferente
    // (depende del número de grupos, equipos, etc.)
    // TODO: implementar cuando se agreguen structural picks al scoring
    return 0;
  }

  // Aplicar auto-scaling si está configurado
  const scaledConfig = phaseId
    ? applyAutoScalingToConfig(config, phaseId)
    : config;

  const enabledTypes = scaledConfig.matchPicks!.types.filter((t) => t.enabled);

  // Detectar si es sistema acumulativo
  const isCumulative = enabledTypes.some((t) => t.key === "HOME_GOALS" || t.key === "AWAY_GOALS");

  let maxPerMatch: number;
  if (isCumulative) {
    // ACUMULATIVO: Máximo = suma de todos los tipos habilitados
    maxPerMatch = enabledTypes.reduce((sum, t) => sum + t.points, 0);
  } else {
    // LEGACY: Máximo = el tipo con más puntos
    maxPerMatch = Math.max(...enabledTypes.map((t) => t.points), 0);
  }

  return maxPerMatch * matchCount;
}

/**
 * Calcula puntos máximos teóricos para toda la pool
 *
 * @param phases - Array de configuraciones de fase
 * @param matchCountByPhase - Map de phaseId → número de partidos
 * @returns Puntos máximos totales
 */
export function calculateMaxPointsForPool(
  phases: PhasePickConfig[],
  matchCountByPhase: Map<string, number>
): number {
  let total = 0;

  for (const phase of phases) {
    const matchCount = matchCountByPhase.get(phase.phaseId) || 0;
    total += calculateMaxPointsForPhase(phase, matchCount, phase.phaseId);
  }

  return total;
}

// ==================== HELPERS ====================

/**
 * Obtiene la configuración de una fase específica
 *
 * @param phases - Array de configuraciones
 * @param phaseId - ID de la fase buscada
 * @returns Configuración de la fase o null si no existe
 */
export function getPhaseConfig(
  phases: PhasePickConfig[],
  phaseId: string
): PhasePickConfig | null {
  return phases.find((p) => p.phaseId === phaseId) || null;
}

/**
 * Verifica si una fase tiene scoring basado en marcadores
 *
 * @param config - Configuración de la fase
 * @returns true si requiere marcadores
 */
export function isMatchBasedScoring(config: PhasePickConfig): boolean {
  return config.requiresScore && !!config.matchPicks;
}

/**
 * Verifica si una fase tiene scoring estructural
 *
 * @param config - Configuración de la fase
 * @returns true si es estructural (sin marcadores)
 */
export function isStructuralScoring(config: PhasePickConfig): boolean {
  return !config.requiresScore && !!config.structuralPicks;
}
