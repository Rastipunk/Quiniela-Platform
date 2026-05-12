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

// ============================================================================
// Detailed breakdown (Estratega leaderboard + PlayerSummary)
// ============================================================================
//
// The aggregate `scoreUserStructuralPicks` returns a single integer. The UI
// needs the desagregated story: for every group, how many positions were
// correct and whether the whole group was perfect; for every knockout match,
// the predicted vs actual winner and whether that pick scored. We compute it
// once here so callers (poolOverviewService, getPlayerSummary) can choose
// what to expose without re-walking the data.

export type StructuralPickInput = {
  phaseId: string;
  pickJson: { groups?: Array<{ groupId: string; teamIds: string[] }>; matches?: Array<{ matchId: string; winnerId: string }> };
};

export type StructuralResultInput = {
  phaseId: string;
  resultJson: { groups?: Array<{ groupId: string; teamIds: string[] }>; matches?: Array<{ matchId: string; winnerId: string }> };
};

export type StructuralGroupBreakdown = {
  phaseId: string;
  groupId: string;
  /** Order the user submitted; empty array when the user did not submit a pick for this group. */
  predictedTeamIds: string[];
  /** Official order; null when the group has not been resolved yet. */
  actualTeamIds: string[] | null;
  /** 0..4 — count of teams the user placed in the correct position. */
  positionsCorrect: number;
  /** Total positions in the group (typically 4). */
  positionsTotal: number;
  /** True when every position matches AND a bonus is configured. */
  isPerfect: boolean;
  /** Points earned for this group (positions × pointsPerPosition + perfect bonus). */
  points: number;
};

export type StructuralKnockoutBreakdown = {
  phaseId: string;
  matchId: string;
  /** Team the user predicted will advance; null when they did not submit a pick. */
  predictedWinnerId: string | null;
  /** Team that actually advanced; null when the match is not yet decided. */
  actualWinnerId: string | null;
  /** True only when both are present and equal. */
  isCorrect: boolean;
  /** Points earned for this match. */
  points: number;
};

export type StructuralPhaseAggregate = {
  phaseId: string;
  phaseType: "GROUP_STANDINGS" | "KNOCKOUT_WINNER";
  points: number;
  /** Group stage only — sum across groups (e.g. 38 of 48 positions). */
  positionsCorrect?: number;
  positionsTotal?: number;
  perfectGroups?: number;
  totalGroups?: number;
  /** Knockout only — winners hit out of matches in the phase. */
  winnersCorrect?: number;
  totalMatches?: number;
};

export type StructuralBreakdown = {
  totalPoints: number;
  pointsByPhase: Record<string, number>;
  /** One entry per structural phase the pool configures, ordered as in poolConfig. */
  phases: StructuralPhaseAggregate[];
  /** Aggregated across every GROUP_STANDINGS phase. */
  positionsCorrect: number;
  positionsTotal: number;
  perfectGroups: number;
  totalGroups: number;
  /** Per-knockout-phase aggregates, keyed by phaseId. */
  winnersByPhase: Record<string, { correct: number; total: number; points: number }>;
  /** Per-group rows (sorted by phaseId then groupId, stable input order). */
  groups: StructuralGroupBreakdown[];
  /** Per-knockout-match rows. */
  knockoutMatches: StructuralKnockoutBreakdown[];
};

/**
 * Walk every structural phase configured on the pool and produce a fully
 * desagregated breakdown of a single user's performance.
 *
 * Idempotent and side-effect-free. Missing user picks count as 0 points
 * with `predictedTeamIds = []` / `predictedWinnerId = null`; missing
 * results mark the row as not-yet-resolved (`actualTeamIds = null` /
 * `actualWinnerId = null`) but still emit a row so the UI can show "Por
 * jugar" rather than dropping the group/match.
 */
export function computeStructuralBreakdown(
  userStructuralPicks: StructuralPickInput[],
  structuralResults: StructuralResultInput[],
  poolConfig: any[],
  /**
   * Universe of structural matches per phase. Required because a user may
   * not have predicted a knockout match, and a phase may not be resolved
   * yet — we still want a row per match so the UI can render placeholders.
   */
  knockoutMatchUniverse: Array<{ phaseId: string; matchId: string }> = [],
  /**
   * Universe of group ids per phase, for the same reason as above. If
   * omitted, the function falls back to the union of groups present in
   * user picks + official results.
   */
  groupUniverse: Array<{ phaseId: string; groupId: string }> = [],
): StructuralBreakdown {
  const out: StructuralBreakdown = {
    totalPoints: 0,
    pointsByPhase: {},
    phases: [],
    positionsCorrect: 0,
    positionsTotal: 0,
    perfectGroups: 0,
    totalGroups: 0,
    winnersByPhase: {},
    groups: [],
    knockoutMatches: [],
  };

  if (!poolConfig || poolConfig.length === 0) return out;

  // Index picks/results/configs by phaseId for O(1) lookup.
  const picksByPhase = new Map<string, StructuralPickInput>();
  userStructuralPicks?.forEach((p) => picksByPhase.set(p.phaseId, p));
  const resultsByPhase = new Map<string, StructuralResultInput>();
  structuralResults?.forEach((r) => resultsByPhase.set(r.phaseId, r));

  const groupsByPhase = new Map<string, Set<string>>();
  for (const g of groupUniverse) {
    const set = groupsByPhase.get(g.phaseId) ?? new Set<string>();
    set.add(g.groupId);
    groupsByPhase.set(g.phaseId, set);
  }
  const matchesByPhase = new Map<string, Set<string>>();
  for (const m of knockoutMatchUniverse) {
    const set = matchesByPhase.get(m.phaseId) ?? new Set<string>();
    set.add(m.matchId);
    matchesByPhase.set(m.phaseId, set);
  }

  for (const phaseConfig of poolConfig) {
    const structuralPicks = phaseConfig?.structuralPicks;
    if (!structuralPicks) continue; // score-based phase — skip silently
    const { type, config } = structuralPicks;
    const phaseId: string = phaseConfig.phaseId;

    if (type === "GROUP_STANDINGS") {
      // Build the union of groupIds we want to emit a row for.
      const universe = new Set<string>(groupsByPhase.get(phaseId) ?? []);
      const pick = picksByPhase.get(phaseId)?.pickJson;
      const result = resultsByPhase.get(phaseId)?.resultJson;
      (pick?.groups ?? []).forEach((g) => universe.add(g.groupId));
      (result?.groups ?? []).forEach((g) => universe.add(g.groupId));

      const phaseAgg: StructuralPhaseAggregate = {
        phaseId,
        phaseType: "GROUP_STANDINGS",
        points: 0,
        positionsCorrect: 0,
        positionsTotal: 0,
        perfectGroups: 0,
        totalGroups: 0,
      };

      // Deterministic order: stable alphabetic by groupId so leaderboard
      // rows always present groups in the same sequence regardless of
      // insertion order in JSON columns.
      const orderedGroupIds = [...universe].sort();
      for (const groupId of orderedGroupIds) {
        const predicted = pick?.groups?.find((g) => g.groupId === groupId)?.teamIds ?? [];
        const actual = result?.groups?.find((g) => g.groupId === groupId)?.teamIds ?? null;
        const positionsTotal = Math.max(predicted.length, actual?.length ?? 0);

        let positionsCorrect = 0;
        let isPerfect = false;
        let points = 0;

        if (actual && predicted.length > 0) {
          points = scoreGroupStandings({ teamIds: predicted }, { teamIds: actual }, config);
          for (let i = 0; i < Math.min(predicted.length, actual.length); i++) {
            if (predicted[i] === actual[i]) positionsCorrect += 1;
          }
          isPerfect =
            predicted.length === actual.length &&
            predicted.every((id, i) => id === actual[i]);
        }

        out.groups.push({
          phaseId,
          groupId,
          predictedTeamIds: predicted,
          actualTeamIds: actual,
          positionsCorrect,
          positionsTotal,
          isPerfect,
          points,
        });

        phaseAgg.points += points;
        phaseAgg.positionsCorrect = (phaseAgg.positionsCorrect ?? 0) + positionsCorrect;
        phaseAgg.positionsTotal = (phaseAgg.positionsTotal ?? 0) + positionsTotal;
        phaseAgg.totalGroups = (phaseAgg.totalGroups ?? 0) + 1;
        if (isPerfect) phaseAgg.perfectGroups = (phaseAgg.perfectGroups ?? 0) + 1;
      }

      out.phases.push(phaseAgg);
      out.totalPoints += phaseAgg.points;
      out.pointsByPhase[phaseId] = (out.pointsByPhase[phaseId] ?? 0) + phaseAgg.points;
      out.positionsCorrect += phaseAgg.positionsCorrect ?? 0;
      out.positionsTotal += phaseAgg.positionsTotal ?? 0;
      out.perfectGroups += phaseAgg.perfectGroups ?? 0;
      out.totalGroups += phaseAgg.totalGroups ?? 0;
    } else if (type === "KNOCKOUT_WINNER") {
      const universe = new Set<string>(matchesByPhase.get(phaseId) ?? []);
      const pick = picksByPhase.get(phaseId)?.pickJson;
      const result = resultsByPhase.get(phaseId)?.resultJson;
      (pick?.matches ?? []).forEach((m) => universe.add(m.matchId));
      (result?.matches ?? []).forEach((m) => universe.add(m.matchId));

      const phaseAgg: StructuralPhaseAggregate = {
        phaseId,
        phaseType: "KNOCKOUT_WINNER",
        points: 0,
        winnersCorrect: 0,
        totalMatches: 0,
      };

      const orderedMatchIds = [...universe].sort();
      for (const matchId of orderedMatchIds) {
        const predictedWinnerId = pick?.matches?.find((m) => m.matchId === matchId)?.winnerId ?? null;
        const actualWinnerId = result?.matches?.find((m) => m.matchId === matchId)?.winnerId ?? null;

        let isCorrect = false;
        let points = 0;
        if (predictedWinnerId && actualWinnerId) {
          isCorrect = predictedWinnerId === actualWinnerId;
          points = isCorrect ? (config?.pointsPerCorrectAdvance ?? 0) : 0;
        }

        out.knockoutMatches.push({
          phaseId,
          matchId,
          predictedWinnerId,
          actualWinnerId,
          isCorrect,
          points,
        });

        phaseAgg.points += points;
        phaseAgg.totalMatches = (phaseAgg.totalMatches ?? 0) + 1;
        if (isCorrect) phaseAgg.winnersCorrect = (phaseAgg.winnersCorrect ?? 0) + 1;
      }

      out.phases.push(phaseAgg);
      out.totalPoints += phaseAgg.points;
      out.pointsByPhase[phaseId] = (out.pointsByPhase[phaseId] ?? 0) + phaseAgg.points;
      out.winnersByPhase[phaseId] = {
        correct: phaseAgg.winnersCorrect ?? 0,
        total: phaseAgg.totalMatches ?? 0,
        points: phaseAgg.points,
      };
    }
  }

  return out;
}

/**
 * Lightweight summary of a `StructuralBreakdown` for embedding in leaderboard
 * rows. Excludes the per-group / per-match detail arrays — those belong in
 * PlayerSummary where only one user's data is fetched at a time.
 */
export type StructuralStatsSummary = {
  positionsCorrect: number;
  positionsTotal: number;
  perfectGroups: number;
  totalGroups: number;
  winnersByPhase: Record<string, { correct: number; total: number }>;
};

export function summarizeStructural(b: StructuralBreakdown): StructuralStatsSummary {
  const winnersByPhase: Record<string, { correct: number; total: number }> = {};
  for (const [phaseId, v] of Object.entries(b.winnersByPhase)) {
    winnersByPhase[phaseId] = { correct: v.correct, total: v.total };
  }
  return {
    positionsCorrect: b.positionsCorrect,
    positionsTotal: b.positionsTotal,
    perfectGroups: b.perfectGroups,
    totalGroups: b.totalGroups,
    winnersByPhase,
  };
}
