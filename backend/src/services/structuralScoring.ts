// Algoritmos de scoring para picks estructurales
// Sprint 2 - Advanced Pick Types System - Preset SIMPLE

/**
 * Configuración de puntuación para GROUP_STANDINGS
 * Soporta dos formatos:
 * 1. Nuevo formato con puntos por posición: pointsPosition1, pointsPosition2, etc.
 * 2. Formato legacy: pointsPerExactPosition (mismo valor para todas las posiciones)
 */
type GroupStandingsConfig = {
  // Nuevo formato: puntos por posición individual
  pointsPosition1?: number;
  pointsPosition2?: number;
  pointsPosition3?: number;
  pointsPosition4?: number;
  // Legacy: mismo valor para todas las posiciones
  pointsPerExactPosition?: number;
  // Bonus por grupo perfecto
  bonusPerfectGroupEnabled?: boolean;
  bonusPerfectGroup?: number;
};

/**
 * Calcula puntos para GROUP_STANDINGS (ordenamiento de equipos en grupos)
 *
 * @param pick - Array de team IDs en orden predicho (1° a 4°)
 * @param result - Array de team IDs en orden oficial (1° a 4°)
 * @param config - Configuración de puntuación
 * @returns Puntos ganados
 */
export function scoreGroupStandings(
  pick: { teamIds: string[] },
  result: { teamIds: string[] },
  config: GroupStandingsConfig
): number {
  if (!pick || !result || !pick.teamIds || !result.teamIds) {
    return 0;
  }

  let points = 0;

  // Obtener puntos por posición (soporta nuevo formato y legacy)
  const getPointsForPosition = (position: number): number => {
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
  };

  // Puntos por cada equipo en su posición exacta
  for (let i = 0; i < Math.min(pick.teamIds.length, result.teamIds.length); i++) {
    if (pick.teamIds[i] === result.teamIds[i]) {
      points += getPointsForPosition(i);
    }
  }

  // Bonus si acertó el grupo completo (todas las posiciones exactas)
  // Soporta nuevo formato (bonusPerfectGroupEnabled) y legacy (solo bonusPerfectGroup)
  const bonusEnabled = config.bonusPerfectGroupEnabled ?? (config.bonusPerfectGroup !== undefined && config.bonusPerfectGroup > 0);

  if (bonusEnabled && config.bonusPerfectGroup) {
    const isPerfectGroup =
      pick.teamIds.length === result.teamIds.length &&
      pick.teamIds.every((teamId, index) => teamId === result.teamIds[index]);

    if (isPerfectGroup) {
      points += config.bonusPerfectGroup;
    }
  }

  return points;
}

/**
 * Calcula puntos para KNOCKOUT_WINNER (seleccionar ganador de partido)
 *
 * @param pick - ID del equipo que el usuario predice que avanza
 * @param result - ID del equipo que realmente avanzó
 * @param config - Configuración de puntuación
 * @returns Puntos ganados
 */
export function scoreKnockoutWinner(
  pick: { winnerId: string },
  result: { winnerId: string },
  config: {
    pointsPerCorrectAdvance: number;
  }
): number {
  if (!pick || !result || !pick.winnerId || !result.winnerId) {
    return 0;
  }

  return pick.winnerId === result.winnerId ? config.pointsPerCorrectAdvance : 0;
}

/**
 * Calcula el puntaje total de una fase estructural completa
 *
 * @param pickData - Datos del pick del usuario (grupos o partidos)
 * @param resultData - Datos del resultado oficial
 * @param phaseConfig - Configuración de la fase
 * @returns Puntos totales ganados en la fase
 */
export function scoreStructuralPhase(
  pickData: any,
  resultData: any,
  phaseConfig: any
): number {
  if (!pickData || !resultData || !phaseConfig || !phaseConfig.structuralPicks) {
    return 0;
  }

  const { type, config } = phaseConfig.structuralPicks;

  if (type === "GROUP_STANDINGS") {
    // Sumar puntos de todos los grupos
    let totalPoints = 0;

    const pickGroups = pickData.groups || [];
    const resultGroups = resultData.groups || [];

    // Crear map de resultados por groupId para lookup rápido
    const resultMap = new Map<string, any>();
    resultGroups.forEach((g: any) => {
      resultMap.set(g.groupId, g);
    });

    // Calcular puntos por cada grupo
    pickGroups.forEach((pickGroup: any) => {
      const resultGroup = resultMap.get(pickGroup.groupId);
      if (resultGroup) {
        const groupPoints = scoreGroupStandings(
          { teamIds: pickGroup.teamIds },
          { teamIds: resultGroup.teamIds },
          config
        );
        totalPoints += groupPoints;
      }
    });

    return totalPoints;
  } else if (type === "KNOCKOUT_WINNER") {
    // Sumar puntos de todos los partidos
    let totalPoints = 0;

    const pickMatches = pickData.matches || [];
    const resultMatches = resultData.matches || [];

    // Crear map de resultados por matchId
    const resultMap = new Map<string, any>();
    resultMatches.forEach((m: any) => {
      resultMap.set(m.matchId, m);
    });

    // Calcular puntos por cada partido
    pickMatches.forEach((pickMatch: any) => {
      const resultMatch = resultMap.get(pickMatch.matchId);
      if (resultMatch) {
        const matchPoints = scoreKnockoutWinner(
          { winnerId: pickMatch.winnerId },
          { winnerId: resultMatch.winnerId },
          config
        );
        totalPoints += matchPoints;
      }
    });

    return totalPoints;
  }

  return 0;
}

/**
 * Calcula el puntaje de un usuario en TODAS las fases estructurales de una pool
 *
 * @param userStructuralPicks - Array de picks estructurales del usuario
 * @param structuralResults - Array de resultados estructurales oficiales
 * @param poolConfig - Configuración completa de la pool (pickTypesConfig)
 * @returns Puntos totales de picks estructurales
 */
export function scoreUserStructuralPicks(
  userStructuralPicks: Array<{ phaseId: string; pickJson: any }>,
  structuralResults: Array<{ phaseId: string; resultJson: any }>,
  poolConfig: any[]
): number {
  if (!userStructuralPicks || !structuralResults || !poolConfig) {
    return 0;
  }

  let totalPoints = 0;

  // Crear map de resultados por phaseId
  const resultsMap = new Map<string, any>();
  structuralResults.forEach((r) => {
    resultsMap.set(r.phaseId, r.resultJson);
  });

  // Crear map de config por phaseId
  const configMap = new Map<string, any>();
  poolConfig.forEach((phaseConfig: any) => {
    configMap.set(phaseConfig.phaseId, phaseConfig);
  });

  // Calcular puntos por cada pick
  userStructuralPicks.forEach((pick) => {
    const result = resultsMap.get(pick.phaseId);
    const phaseConfig = configMap.get(pick.phaseId);

    if (result && phaseConfig) {
      const phasePoints = scoreStructuralPhase(pick.pickJson, result, phaseConfig);
      totalPoints += phasePoints;
    }
  });

  return totalPoints;
}
