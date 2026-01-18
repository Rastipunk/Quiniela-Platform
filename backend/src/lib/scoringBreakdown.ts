/**
 * Scoring Breakdown System
 * Sprint 2 - Transparencia y Auditoria de Puntuacion
 *
 * Genera desgloses detallados de puntuacion para cada pick,
 * mostrando que reglas se evaluaron, cuales se cumplieron,
 * y los puntos obtenidos vs maximos posibles.
 */

import type {
  PhasePickConfig,
  MatchPickTypeKey,
  MatchPickType,
} from "../types/pickConfig";

// ==================== TIPOS PARA BREAKDOWN ====================

/**
 * Evaluacion de una regla individual
 */
export type RuleEvaluation = {
  ruleKey: string;           // Identificador de la regla
  ruleName: string;          // Nombre legible (ej: "Marcador exacto")
  enabled: boolean;          // Si la regla esta habilitada en el pool
  matched: boolean;          // Si el pick cumplio la regla
  pointsEarned: number;      // Puntos ganados por esta regla
  pointsMax: number;         // Puntos maximos de esta regla
  details?: string;          // Explicacion adicional (opcional)
};

/**
 * Breakdown completo de un pick de partido
 */
export type MatchPickBreakdown = {
  type: "MATCH";
  matchId: string;
  hasPick: boolean;          // Si el usuario hizo pick
  hasResult: boolean;        // Si hay resultado publicado
  pick?: {
    homeGoals: number;
    awayGoals: number;
  };
  result?: {
    homeGoals: number;
    awayGoals: number;
  };
  totalPointsEarned: number;
  totalPointsMax: number;
  rules: RuleEvaluation[];
  summary: string;           // Resumen legible (ej: "5 / 20 pts")
};

/**
 * Evaluacion de un grupo en GROUP_STANDINGS
 */
export type GroupEvaluation = {
  groupId: string;
  groupName: string;
  hasPick: boolean;
  hasResult: boolean;
  positions: Array<{
    position: number;        // 1, 2, 3, 4
    teamId: string;
    teamName?: string;
    predictedPosition: number | null;
    actualPosition: number | null;
    matched: boolean;
    pointsEarned: number;
  }>;
  bonusPerfectGroup: {
    enabled: boolean;
    achieved: boolean;
    pointsEarned: number;
    pointsMax: number;
  };
  totalPointsEarned: number;
  totalPointsMax: number;
};

/**
 * Breakdown completo de GROUP_STANDINGS
 */
export type GroupStandingsBreakdown = {
  type: "GROUP_STANDINGS";
  phaseId: string;
  hasPick: boolean;
  hasResult: boolean;
  groups: GroupEvaluation[];
  totalPointsEarned: number;
  totalPointsMax: number;
  config: {
    pointsPerExactPosition: number;
    bonusPerfectGroup?: number;
  };
  summary: string;
};

/**
 * Evaluacion de un partido en KNOCKOUT_WINNER
 */
export type KnockoutMatchEvaluation = {
  matchId: string;
  hasPick: boolean;
  hasResult: boolean;
  predictedWinnerId: string | null;
  actualWinnerId: string | null;
  predictedWinnerName?: string;
  actualWinnerName?: string;
  matched: boolean;
  pointsEarned: number;
  pointsMax: number;
};

/**
 * Breakdown completo de KNOCKOUT_WINNER
 */
export type KnockoutWinnerBreakdown = {
  type: "KNOCKOUT_WINNER";
  phaseId: string;
  hasPick: boolean;
  hasResult: boolean;
  matches: KnockoutMatchEvaluation[];
  totalPointsEarned: number;
  totalPointsMax: number;
  config: {
    pointsPerCorrectAdvance: number;
  };
  summary: string;
};

/**
 * Breakdown cuando no hay pick
 */
export type NoPickBreakdown = {
  type: "NO_PICK";
  reason: string;            // "No hiciste pick" o "Deadline pasado sin pick"
  totalPointsEarned: 0;
  totalPointsMax: number;
  summary: string;
};

/**
 * Union de todos los tipos de breakdown
 */
export type ScoringBreakdown =
  | MatchPickBreakdown
  | GroupStandingsBreakdown
  | KnockoutWinnerBreakdown
  | NoPickBreakdown;

// ==================== NOMBRES DE REGLAS ====================

const MATCH_PICK_TYPE_NAMES: Record<MatchPickTypeKey, string> = {
  EXACT_SCORE: "Marcador exacto",
  GOAL_DIFFERENCE: "Diferencia de goles",
  PARTIAL_SCORE: "Marcador parcial",
  TOTAL_GOALS: "Total de goles",
  MATCH_OUTCOME_90MIN: "Resultado",
  HOME_GOALS: "Goles local",
  AWAY_GOALS: "Goles visitante",
};

// ==================== BREAKDOWN PARA MATCH PICKS ====================

/**
 * Detecta si la configuración usa el sistema acumulativo (nuevos tipos HOME_GOALS, AWAY_GOALS)
 */
function isCumulativeScoring(enabledTypes: { key: string }[]): boolean {
  return enabledTypes.some((t) => t.key === "HOME_GOALS" || t.key === "AWAY_GOALS");
}

/**
 * Genera breakdown detallado para un pick de partido
 *
 * SOPORTA DOS SISTEMAS:
 * 1. ACUMULATIVO: Máximo = suma de todos los tipos habilitados
 * 2. LEGACY: Máximo = el tipo con más puntos (EXACT_SCORE)
 */
export function generateMatchPickBreakdown(
  pick: { homeGoals: number; awayGoals: number } | null,
  result: { homeGoals: number; awayGoals: number } | null,
  phaseConfig: PhasePickConfig,
  matchId: string
): MatchPickBreakdown | NoPickBreakdown {
  // Verificar que la fase requiere score
  if (!phaseConfig.requiresScore || !phaseConfig.matchPicks) {
    throw new Error("generateMatchPickBreakdown solo aplica para fases con requiresScore=true");
  }

  const enabledTypes = phaseConfig.matchPicks.types.filter(t => t.enabled);
  const isCumulative = isCumulativeScoring(enabledTypes);

  // Calcular maximo teorico según el sistema
  const maxPoints = isCumulative
    ? enabledTypes.reduce((sum, t) => sum + t.points, 0)  // ACUMULATIVO: suma de todos
    : Math.max(...enabledTypes.map(t => t.points), 0);   // LEGACY: el máximo

  // Caso: No hay pick
  if (!pick) {
    return {
      type: "NO_PICK",
      reason: "No hiciste pick para este partido",
      totalPointsEarned: 0,
      totalPointsMax: maxPoints,
      summary: `0 / ${maxPoints} pts`,
    };
  }

  // Caso: No hay resultado aun
  if (!result) {
    const rules: RuleEvaluation[] = enabledTypes.map(t => ({
      ruleKey: t.key,
      ruleName: MATCH_PICK_TYPE_NAMES[t.key],
      enabled: true,
      matched: false,
      pointsEarned: 0,
      pointsMax: t.points,
      details: "Pendiente de resultado",
    }));

    return {
      type: "MATCH",
      matchId,
      hasPick: true,
      hasResult: false,
      pick,
      totalPointsEarned: 0,
      totalPointsMax: maxPoints,
      rules,
      summary: "Pendiente de resultado",
    };
  }

  // Caso: Hay pick y resultado - evaluar cada regla
  const rules: RuleEvaluation[] = [];
  let totalEarned = 0;

  // ==================== SISTEMA ACUMULATIVO ====================
  if (isCumulative) {
    // En sistema acumulativo, evaluamos TODOS los criterios y sumamos

    // 1. MATCH_OUTCOME_90MIN (Resultado: ganador/empate)
    const outcomeType = enabledTypes.find(t => t.key === "MATCH_OUTCOME_90MIN");
    if (outcomeType) {
      const pickOutcome = pick.homeGoals > pick.awayGoals ? "HOME" : pick.homeGoals < pick.awayGoals ? "AWAY" : "DRAW";
      const resultOutcome = result.homeGoals > result.awayGoals ? "HOME" : result.homeGoals < result.awayGoals ? "AWAY" : "DRAW";
      const matched = pickOutcome === resultOutcome;

      const outcomeNames: Record<string, string> = {
        HOME: "Victoria Local",
        AWAY: "Victoria Visitante",
        DRAW: "Empate",
      };

      rules.push({
        ruleKey: "MATCH_OUTCOME_90MIN",
        ruleName: MATCH_PICK_TYPE_NAMES.MATCH_OUTCOME_90MIN,
        enabled: true,
        matched,
        pointsEarned: matched ? outcomeType.points : 0,
        pointsMax: outcomeType.points,
        details: matched
          ? `Resultado correcto: ${outcomeNames[pickOutcome]}`
          : `Predijiste ${outcomeNames[pickOutcome]}, fue ${outcomeNames[resultOutcome]}`,
      });

      if (matched) totalEarned += outcomeType.points;
    }

    // 2. HOME_GOALS (Goles del local exactos)
    const homeGoalsType = enabledTypes.find(t => t.key === "HOME_GOALS");
    if (homeGoalsType) {
      const matched = pick.homeGoals === result.homeGoals;

      rules.push({
        ruleKey: "HOME_GOALS",
        ruleName: MATCH_PICK_TYPE_NAMES.HOME_GOALS,
        enabled: true,
        matched,
        pointsEarned: matched ? homeGoalsType.points : 0,
        pointsMax: homeGoalsType.points,
        details: matched
          ? `Acertaste: ${pick.homeGoals} goles`
          : `Predijiste ${pick.homeGoals}, fueron ${result.homeGoals}`,
      });

      if (matched) totalEarned += homeGoalsType.points;
    }

    // 3. AWAY_GOALS (Goles del visitante exactos)
    const awayGoalsType = enabledTypes.find(t => t.key === "AWAY_GOALS");
    if (awayGoalsType) {
      const matched = pick.awayGoals === result.awayGoals;

      rules.push({
        ruleKey: "AWAY_GOALS",
        ruleName: MATCH_PICK_TYPE_NAMES.AWAY_GOALS,
        enabled: true,
        matched,
        pointsEarned: matched ? awayGoalsType.points : 0,
        pointsMax: awayGoalsType.points,
        details: matched
          ? `Acertaste: ${pick.awayGoals} goles`
          : `Predijiste ${pick.awayGoals}, fueron ${result.awayGoals}`,
      });

      if (matched) totalEarned += awayGoalsType.points;
    }

    // 4. GOAL_DIFFERENCE (Diferencia de goles exacta)
    const goalDiffType = enabledTypes.find(t => t.key === "GOAL_DIFFERENCE");
    if (goalDiffType) {
      const pickDiff = pick.homeGoals - pick.awayGoals;
      const resultDiff = result.homeGoals - result.awayGoals;
      const matched = pickDiff === resultDiff;

      rules.push({
        ruleKey: "GOAL_DIFFERENCE",
        ruleName: MATCH_PICK_TYPE_NAMES.GOAL_DIFFERENCE,
        enabled: true,
        matched,
        pointsEarned: matched ? goalDiffType.points : 0,
        pointsMax: goalDiffType.points,
        details: matched
          ? `Diferencia correcta: ${pickDiff >= 0 ? "+" : ""}${pickDiff}`
          : `Predijiste ${pickDiff >= 0 ? "+" : ""}${pickDiff}, fue ${resultDiff >= 0 ? "+" : ""}${resultDiff}`,
      });

      if (matched) totalEarned += goalDiffType.points;
    }

    // 5. TOTAL_GOALS (si está habilitado)
    const totalGoalsType = enabledTypes.find(t => t.key === "TOTAL_GOALS");
    if (totalGoalsType) {
      const pickTotal = pick.homeGoals + pick.awayGoals;
      const resultTotal = result.homeGoals + result.awayGoals;
      const matched = pickTotal === resultTotal;

      rules.push({
        ruleKey: "TOTAL_GOALS",
        ruleName: MATCH_PICK_TYPE_NAMES.TOTAL_GOALS,
        enabled: true,
        matched,
        pointsEarned: matched ? totalGoalsType.points : 0,
        pointsMax: totalGoalsType.points,
        details: matched
          ? `Total correcto: ${pickTotal} goles`
          : `Predijiste ${pickTotal} goles, fueron ${resultTotal}`,
      });

      if (matched) totalEarned += totalGoalsType.points;
    }

    return {
      type: "MATCH",
      matchId,
      hasPick: true,
      hasResult: true,
      pick,
      result,
      totalPointsEarned: totalEarned,
      totalPointsMax: maxPoints,
      rules,
      summary: `${totalEarned} / ${maxPoints} pts`,
    };
  }

  // ==================== SISTEMA LEGACY ====================
  // EXACT_SCORE termina la evaluación si acierta

  // Evaluar EXACT_SCORE primero (si esta habilitado)
  const exactScoreType = enabledTypes.find(t => t.key === "EXACT_SCORE");
  if (exactScoreType) {
    const matched = pick.homeGoals === result.homeGoals && pick.awayGoals === result.awayGoals;

    rules.push({
      ruleKey: "EXACT_SCORE",
      ruleName: MATCH_PICK_TYPE_NAMES.EXACT_SCORE,
      enabled: true,
      matched,
      pointsEarned: matched ? exactScoreType.points : 0,
      pointsMax: exactScoreType.points,
      details: matched
        ? `Acertaste ${pick.homeGoals}-${pick.awayGoals}`
        : `Predijiste ${pick.homeGoals}-${pick.awayGoals}, fue ${result.homeGoals}-${result.awayGoals}`,
    });

    if (matched) {
      totalEarned = exactScoreType.points;
      // Si acerto exacto, las demas reglas no aplican pero las mostramos como N/A
      const otherTypes = enabledTypes.filter(t => t.key !== "EXACT_SCORE");
      for (const t of otherTypes) {
        rules.push({
          ruleKey: t.key,
          ruleName: MATCH_PICK_TYPE_NAMES[t.key],
          enabled: true,
          matched: false,
          pointsEarned: 0,
          pointsMax: 0, // No aplica porque ya gano el maximo
          details: "No aplica (acertaste exacto)",
        });
      }

      return {
        type: "MATCH",
        matchId,
        hasPick: true,
        hasResult: true,
        pick,
        result,
        totalPointsEarned: totalEarned,
        totalPointsMax: maxPoints,
        rules,
        summary: `${totalEarned} / ${maxPoints} pts`,
      };
    }
  }

  // Si no acerto exacto, evaluar otras reglas
  // GOAL_DIFFERENCE
  const goalDiffType = enabledTypes.find(t => t.key === "GOAL_DIFFERENCE");
  if (goalDiffType) {
    const pickDiff = pick.homeGoals - pick.awayGoals;
    const resultDiff = result.homeGoals - result.awayGoals;
    const matched = pickDiff === resultDiff;

    rules.push({
      ruleKey: "GOAL_DIFFERENCE",
      ruleName: MATCH_PICK_TYPE_NAMES.GOAL_DIFFERENCE,
      enabled: true,
      matched,
      pointsEarned: matched ? goalDiffType.points : 0,
      pointsMax: goalDiffType.points,
      details: matched
        ? `Diferencia correcta: ${pickDiff >= 0 ? "+" : ""}${pickDiff}`
        : `Predijiste ${pickDiff >= 0 ? "+" : ""}${pickDiff}, fue ${resultDiff >= 0 ? "+" : ""}${resultDiff}`,
    });

    if (matched) totalEarned += goalDiffType.points;
  }

  // PARTIAL_SCORE
  const partialType = enabledTypes.find(t => t.key === "PARTIAL_SCORE");
  if (partialType) {
    const homeMatch = pick.homeGoals === result.homeGoals;
    const awayMatch = pick.awayGoals === result.awayGoals;
    const matched = homeMatch !== awayMatch; // XOR: solo uno coincide

    let details = "";
    if (matched) {
      if (homeMatch) {
        details = `Acertaste goles del local (${pick.homeGoals})`;
      } else {
        details = `Acertaste goles del visitante (${pick.awayGoals})`;
      }
    } else if (homeMatch && awayMatch) {
      details = "Ambos correctos = marcador exacto";
    } else {
      details = "Ninguno de los dos marcadores parciales";
    }

    rules.push({
      ruleKey: "PARTIAL_SCORE",
      ruleName: MATCH_PICK_TYPE_NAMES.PARTIAL_SCORE,
      enabled: true,
      matched,
      pointsEarned: matched ? partialType.points : 0,
      pointsMax: partialType.points,
      details,
    });

    if (matched) totalEarned += partialType.points;
  }

  // TOTAL_GOALS
  const totalGoalsType = enabledTypes.find(t => t.key === "TOTAL_GOALS");
  if (totalGoalsType) {
    const pickTotal = pick.homeGoals + pick.awayGoals;
    const resultTotal = result.homeGoals + result.awayGoals;
    const matched = pickTotal === resultTotal;

    rules.push({
      ruleKey: "TOTAL_GOALS",
      ruleName: MATCH_PICK_TYPE_NAMES.TOTAL_GOALS,
      enabled: true,
      matched,
      pointsEarned: matched ? totalGoalsType.points : 0,
      pointsMax: totalGoalsType.points,
      details: matched
        ? `Total correcto: ${pickTotal} goles`
        : `Predijiste ${pickTotal} goles, fueron ${resultTotal}`,
    });

    if (matched) totalEarned += totalGoalsType.points;
  }

  // MATCH_OUTCOME_90MIN
  const outcomeType = enabledTypes.find(t => t.key === "MATCH_OUTCOME_90MIN");
  if (outcomeType) {
    const pickOutcome = pick.homeGoals > pick.awayGoals ? "HOME" : pick.homeGoals < pick.awayGoals ? "AWAY" : "DRAW";
    const resultOutcome = result.homeGoals > result.awayGoals ? "HOME" : result.homeGoals < result.awayGoals ? "AWAY" : "DRAW";
    const matched = pickOutcome === resultOutcome;

    const outcomeNames: Record<string, string> = {
      HOME: "Victoria Local",
      AWAY: "Victoria Visitante",
      DRAW: "Empate",
    };

    rules.push({
      ruleKey: "MATCH_OUTCOME_90MIN",
      ruleName: MATCH_PICK_TYPE_NAMES.MATCH_OUTCOME_90MIN,
      enabled: true,
      matched,
      pointsEarned: matched ? outcomeType.points : 0,
      pointsMax: outcomeType.points,
      details: matched
        ? `Resultado correcto: ${outcomeNames[pickOutcome]}`
        : `Predijiste ${outcomeNames[pickOutcome]}, fue ${outcomeNames[resultOutcome]}`,
    });

    if (matched) totalEarned += outcomeType.points;
  }

  return {
    type: "MATCH",
    matchId,
    hasPick: true,
    hasResult: true,
    pick,
    result,
    totalPointsEarned: totalEarned,
    totalPointsMax: maxPoints,
    rules,
    summary: `${totalEarned} / ${maxPoints} pts`,
  };
}

// ==================== BREAKDOWN PARA GROUP_STANDINGS ====================

/**
 * Configuración de GROUP_STANDINGS (soporta nuevo formato y legacy)
 */
type GroupStandingsConfigBreakdown = {
  // Nuevo formato: puntos por posición
  pointsPosition1?: number;
  pointsPosition2?: number;
  pointsPosition3?: number;
  pointsPosition4?: number;
  // Legacy: mismo para todas
  pointsPerExactPosition?: number;
  // Bonus
  bonusPerfectGroupEnabled?: boolean;
  bonusPerfectGroup?: number;
};

/**
 * Helper para obtener puntos por posición (soporta ambos formatos)
 */
function getPointsForPosition(config: GroupStandingsConfigBreakdown, position: number): number {
  // Nuevo formato: puntos individuales por posición
  if (config.pointsPosition1 !== undefined) {
    switch (position) {
      case 0: return config.pointsPosition1 ?? 10;
      case 1: return config.pointsPosition2 ?? 10;
      case 2: return config.pointsPosition3 ?? 10;
      case 3: return config.pointsPosition4 ?? 10;
      default: return 10;
    }
  }
  // Legacy: mismo valor para todas
  return config.pointsPerExactPosition ?? 10;
}

/**
 * Helper para calcular máximo de puntos por posición en un grupo
 */
function getMaxPositionPointsForGroup(config: GroupStandingsConfigBreakdown, teamCount: number): number {
  if (config.pointsPosition1 !== undefined) {
    // Nuevo formato: sumar todos los puntos posibles
    let sum = 0;
    for (let i = 0; i < teamCount; i++) {
      sum += getPointsForPosition(config, i);
    }
    return sum;
  }
  // Legacy
  return teamCount * (config.pointsPerExactPosition ?? 10);
}

/**
 * Helper para verificar si bonus está habilitado
 */
function isBonusEnabled(config: GroupStandingsConfigBreakdown): boolean {
  return config.bonusPerfectGroupEnabled ?? (config.bonusPerfectGroup !== undefined && config.bonusPerfectGroup > 0);
}

/**
 * Genera breakdown detallado para GROUP_STANDINGS
 */
export function generateGroupStandingsBreakdown(
  pickData: { groups: Array<{ groupId: string; teamIds: string[] }> } | null,
  resultData: { groups: Array<{ groupId: string; teamIds: string[] }> } | null,
  phaseConfig: PhasePickConfig,
  groupsInfo: Array<{ id: string; name: string; teamCount: number }>,
  teamsMap: Map<string, { id: string; name: string }>
): GroupStandingsBreakdown | NoPickBreakdown {
  if (!phaseConfig.structuralPicks || phaseConfig.structuralPicks.type !== "GROUP_STANDINGS") {
    throw new Error("generateGroupStandingsBreakdown solo aplica para fases GROUP_STANDINGS");
  }

  const config = phaseConfig.structuralPicks.config as GroupStandingsConfigBreakdown;
  const bonusEnabled = isBonusEnabled(config);

  // Calcular máximo teórico
  let maxPositionPoints = 0;
  groupsInfo.forEach(g => {
    maxPositionPoints += getMaxPositionPointsForGroup(config, g.teamCount);
  });
  const maxBonusPoints = bonusEnabled && config.bonusPerfectGroup ? groupsInfo.length * config.bonusPerfectGroup : 0;
  const totalMax = maxPositionPoints + maxBonusPoints;

  // Normalizar config para el response (agregar pointsPerExactPosition para compatibilidad)
  const normalizedConfig = {
    pointsPerExactPosition: config.pointsPerExactPosition ?? config.pointsPosition1 ?? 10,
    bonusPerfectGroup: bonusEnabled ? config.bonusPerfectGroup : undefined,
    // Incluir nuevo formato si está presente
    ...(config.pointsPosition1 !== undefined && {
      pointsPosition1: config.pointsPosition1,
      pointsPosition2: config.pointsPosition2,
      pointsPosition3: config.pointsPosition3,
      pointsPosition4: config.pointsPosition4,
      bonusPerfectGroupEnabled: config.bonusPerfectGroupEnabled,
    }),
  };

  // Caso: No hay pick
  if (!pickData || !pickData.groups || pickData.groups.length === 0) {
    return {
      type: "NO_PICK",
      reason: "No hiciste prediccion para esta fase",
      totalPointsEarned: 0,
      totalPointsMax: totalMax,
      summary: `0 / ${totalMax} pts`,
    };
  }

  // Caso: No hay resultado
  if (!resultData || !resultData.groups || resultData.groups.length === 0) {
    const groups: GroupEvaluation[] = groupsInfo.map(g => {
      const pickGroup = pickData.groups.find(pg => pg.groupId === g.id);
      const groupMaxPositionPts = getMaxPositionPointsForGroup(config, g.teamCount);
      const groupMaxBonus = bonusEnabled && config.bonusPerfectGroup ? config.bonusPerfectGroup : 0;
      return {
        groupId: g.id,
        groupName: g.name,
        hasPick: !!pickGroup,
        hasResult: false,
        positions: [],
        bonusPerfectGroup: {
          enabled: bonusEnabled,
          achieved: false,
          pointsEarned: 0,
          pointsMax: groupMaxBonus,
        },
        totalPointsEarned: 0,
        totalPointsMax: groupMaxPositionPts + groupMaxBonus,
      };
    });

    return {
      type: "GROUP_STANDINGS",
      phaseId: phaseConfig.phaseId,
      hasPick: true,
      hasResult: false,
      groups,
      totalPointsEarned: 0,
      totalPointsMax: totalMax,
      config: normalizedConfig,
      summary: "Pendiente de resultados",
    };
  }

  // Caso: Hay pick y resultado
  const resultMap = new Map<string, string[]>();
  resultData.groups.forEach(g => resultMap.set(g.groupId, g.teamIds));

  const pickMap = new Map<string, string[]>();
  pickData.groups.forEach(g => pickMap.set(g.groupId, g.teamIds));

  let totalEarned = 0;
  const groups: GroupEvaluation[] = groupsInfo.map(g => {
    const pickTeams = pickMap.get(g.id) || [];
    const resultTeams = resultMap.get(g.id) || [];
    const hasPick = pickTeams.length > 0;
    const hasResult = resultTeams.length > 0;

    const groupMaxPositionPts = getMaxPositionPointsForGroup(config, g.teamCount);
    const groupMaxBonus = bonusEnabled && config.bonusPerfectGroup ? config.bonusPerfectGroup : 0;

    if (!hasPick) {
      return {
        groupId: g.id,
        groupName: g.name,
        hasPick: false,
        hasResult,
        positions: [],
        bonusPerfectGroup: {
          enabled: bonusEnabled,
          achieved: false,
          pointsEarned: 0,
          pointsMax: groupMaxBonus,
        },
        totalPointsEarned: 0,
        totalPointsMax: groupMaxPositionPts + groupMaxBonus,
      };
    }

    // Evaluar cada posición
    let groupPoints = 0;
    let perfectGroup = true;
    const positions = resultTeams.map((teamId, index) => {
      const position = index + 1;
      const predictedIndex = pickTeams.indexOf(teamId);
      const predictedPosition = predictedIndex >= 0 ? predictedIndex + 1 : null;
      const matched = predictedPosition === position;

      if (!matched) perfectGroup = false;
      const pointsForThisPosition = getPointsForPosition(config, index);
      const pointsEarned = matched ? pointsForThisPosition : 0;
      groupPoints += pointsEarned;

      const team = teamsMap.get(teamId);

      return {
        position,
        teamId,
        teamName: team?.name || teamId,
        predictedPosition,
        actualPosition: position,
        matched,
        pointsEarned,
      };
    });

    // Bonus por grupo perfecto
    const bonusAchieved = perfectGroup && bonusEnabled && config.bonusPerfectGroup;
    const bonusPoints = bonusAchieved ? config.bonusPerfectGroup! : 0;
    groupPoints += bonusPoints;
    totalEarned += groupPoints;

    return {
      groupId: g.id,
      groupName: g.name,
      hasPick: true,
      hasResult: true,
      positions,
      bonusPerfectGroup: {
        enabled: bonusEnabled,
        achieved: !!bonusAchieved,
        pointsEarned: bonusPoints,
        pointsMax: groupMaxBonus,
      },
      totalPointsEarned: groupPoints,
      totalPointsMax: groupMaxPositionPts + groupMaxBonus,
    };
  });

  return {
    type: "GROUP_STANDINGS",
    phaseId: phaseConfig.phaseId,
    hasPick: true,
    hasResult: true,
    groups,
    totalPointsEarned: totalEarned,
    totalPointsMax: totalMax,
    config: normalizedConfig,
    summary: `${totalEarned} / ${totalMax} pts`,
  };
}

// ==================== BREAKDOWN PARA KNOCKOUT_WINNER ====================

/**
 * Genera breakdown detallado para KNOCKOUT_WINNER
 */
export function generateKnockoutWinnerBreakdown(
  pickData: { matches: Array<{ matchId: string; winnerId: string }> } | null,
  resultData: { matches: Array<{ matchId: string; winnerId: string }> } | null,
  phaseConfig: PhasePickConfig,
  matchesInfo: Array<{ id: string; homeTeamId: string; awayTeamId: string }>,
  teamsMap: Map<string, { id: string; name: string }>
): KnockoutWinnerBreakdown | NoPickBreakdown {
  if (!phaseConfig.structuralPicks || phaseConfig.structuralPicks.type !== "KNOCKOUT_WINNER") {
    throw new Error("generateKnockoutWinnerBreakdown solo aplica para fases KNOCKOUT_WINNER");
  }

  const config = phaseConfig.structuralPicks.config as {
    pointsPerCorrectAdvance: number;
  };

  const totalMax = matchesInfo.length * config.pointsPerCorrectAdvance;

  // Caso: No hay pick
  if (!pickData || !pickData.matches || pickData.matches.length === 0) {
    return {
      type: "NO_PICK",
      reason: "No hiciste prediccion para esta fase",
      totalPointsEarned: 0,
      totalPointsMax: totalMax,
      summary: `0 / ${totalMax} pts`,
    };
  }

  // Crear maps para lookup rapido
  const pickMap = new Map<string, string>();
  pickData.matches.forEach(m => pickMap.set(m.matchId, m.winnerId));

  const resultMap = new Map<string, string>();
  if (resultData?.matches) {
    resultData.matches.forEach(m => resultMap.set(m.matchId, m.winnerId));
  }

  const hasAnyResult = resultMap.size > 0;

  // Evaluar cada partido
  let totalEarned = 0;
  const matches: KnockoutMatchEvaluation[] = matchesInfo.map(match => {
    const predictedWinnerId = pickMap.get(match.id) || null;
    const actualWinnerId = resultMap.get(match.id) || null;
    const hasPick = !!predictedWinnerId;
    const hasResult = !!actualWinnerId;

    const matched = hasPick && hasResult && predictedWinnerId === actualWinnerId;
    const pointsEarned = matched ? config.pointsPerCorrectAdvance : 0;
    if (matched) totalEarned += pointsEarned;

    const predictedTeam = predictedWinnerId ? teamsMap.get(predictedWinnerId) : null;
    const actualTeam = actualWinnerId ? teamsMap.get(actualWinnerId) : null;

    const predictedWinnerName = predictedTeam?.name || predictedWinnerId || null;
    const actualWinnerName = actualTeam?.name || actualWinnerId || null;

    const evaluation: KnockoutMatchEvaluation = {
      matchId: match.id,
      hasPick,
      hasResult,
      predictedWinnerId,
      actualWinnerId,
      matched,
      pointsEarned,
      pointsMax: config.pointsPerCorrectAdvance,
    };

    // Agregar nombres solo si existen (evita undefined con exactOptionalPropertyTypes)
    if (predictedWinnerName) evaluation.predictedWinnerName = predictedWinnerName;
    if (actualWinnerName) evaluation.actualWinnerName = actualWinnerName;

    return evaluation;
  });

  return {
    type: "KNOCKOUT_WINNER",
    phaseId: phaseConfig.phaseId,
    hasPick: true,
    hasResult: hasAnyResult,
    matches,
    totalPointsEarned: totalEarned,
    totalPointsMax: totalMax,
    config,
    summary: hasAnyResult ? `${totalEarned} / ${totalMax} pts` : "Pendiente de resultados",
  };
}
