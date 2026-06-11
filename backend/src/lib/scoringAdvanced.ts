// Lógica de scoring avanzado para picks
// Sprint 2 - Advanced Pick Types System

import type {
  PhasePickConfig,
  MatchPicksConfig,
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
 * Evalúa un pick de partido contra el resultado oficial
 * y calcula puntos según la configuración de la fase
 *
 * MOTOR ÚNICO ADITIVO (ADR-072): cada criterio habilitado se evalúa de
 * forma independiente y los puntos de los criterios cumplidos se SUMAN.
 * EXACT_SCORE es un bonus aditivo — nunca termina la evaluación ni
 * reemplaza a los demás criterios. La UI (wizard y reglas) siempre lo
 * presentó como "Bonus por acertar ambos marcadores"; el antiguo
 * short-circuit "legacy" podía pagar MENOS al que acertaba el marcador
 * exacto que a quien casi acierta (reporte de soporte 2026-06-11).
 * PARTIAL_SCORE es INCLUSIVO (ADR-073): paga al acertar los goles de AL
 * MENOS un lado — el pick exacto también lo cumple, así que el máximo
 * anunciado (suma de criterios habilitados) es alcanzable. El antiguo
 * XOR hacía ese máximo imposible (2.º reporte de soporte 2026-06-11; la
 * calculadora del wizard siempre fue inclusiva).
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

  // 5. TOTAL_GOALS (Total de goles del partido)
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

  // 6. EXACT_SCORE — bonus aditivo. NO hace short-circuit: el pick que
  // acierta el marcador exacto conserva además los puntos de resultado,
  // diferencia y total (que cumple por implicación). Ver ADR-072.
  const exactScoreType = enabledTypes.find((t) => t.key === "EXACT_SCORE");
  if (exactScoreType) {
    const matched = evaluateExactScore(pick, result);
    evaluations.push({
      matchPickType: "EXACT_SCORE",
      points: matched ? exactScoreType.points : 0,
      matched,
    });
    if (matched) totalPoints += exactScoreType.points;
  }

  // 7. PARTIAL_SCORE — inclusivo (ADR-073): acertar al menos un lado.
  // Un pick exacto también lo cumple y suma este criterio.
  const partialScoreType = enabledTypes.find((t) => t.key === "PARTIAL_SCORE");
  if (partialScoreType) {
    const matched = evaluatePartialScore(pick, result);
    evaluations.push({
      matchPickType: "PARTIAL_SCORE",
      points: matched ? partialScoreType.points : 0,
      matched,
    });
    if (matched) totalPoints += partialScoreType.points;
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
 * Evalúa PARTIAL_SCORE: acierta los goles de AL MENOS un lado (inclusivo —
 * ADR-073). Acertar ambos lados (marcador exacto) también lo cumple: la
 * calculadora del wizard y el máximo anunciado siempre asumieron esta
 * semántica, y el antiguo XOR hacía el máximo inalcanzable.
 */
function evaluatePartialScore(pick: MatchPick, result: MatchScore): boolean {
  const homeMatch = pick.homeGoals === result.homeGoals;
  const awayMatch = pick.awayGoals === result.awayGoals;
  return homeMatch || awayMatch;
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
 * MOTOR ADITIVO (ADR-072): el máximo teórico por partido es la suma de
 * todos los criterios habilitados (cota superior — EXACT_SCORE y
 * PARTIAL_SCORE no pueden cumplirse a la vez por el XOR, pero la suma
 * simple es la misma convención que muestra el desglose al jugador).
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
    return 0;
  }

  // Aplicar auto-scaling si está configurado
  const scaledConfig = phaseId
    ? applyAutoScalingToConfig(config, phaseId)
    : config;

  const enabledTypes = scaledConfig.matchPicks!.types.filter((t) => t.enabled);
  const maxPerMatch = enabledTypes.reduce((sum, t) => sum + t.points, 0);

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
