// Presets predefinidos para configuración rápida de picks
// Sprint 2 - Advanced Pick Types System

import type { PickConfigPreset, PoolPickTypesConfig } from "../types/pickConfig";

// ==================== PRESET: BÁSICO ====================

/**
 * BÁSICO: Solo marcador exacto en todas las fases con auto-scaling
 * - Ideal para usuarios nuevos que quieren simplicidad
 * - Puntos crecen automáticamente en rondas eliminatorias
 */
const BASIC_CONFIG: PoolPickTypesConfig = [
  {
    phaseId: "group_stage",
    phaseName: "Fase de Grupos",
    requiresScore: true,
    matchPicks: {
      types: [
        {
          key: "EXACT_SCORE",
          enabled: true,
          points: 20,
        },
        {
          key: "GOAL_DIFFERENCE",
          enabled: false,
          points: 0,
        },
        {
          key: "PARTIAL_SCORE",
          enabled: false,
          points: 0,
        },
        {
          key: "TOTAL_GOALS",
          enabled: false,
          points: 0,
        },
        {
          key: "MATCH_OUTCOME_90MIN",
          enabled: false,
          points: 0,
        },
      ],
      autoScaling: {
        enabled: true,
        basePhase: "group_stage",
        multipliers: {
          group_stage: 1.0,
          round_of_16: 1.5,
          quarter_finals: 2.0,
          semi_finals: 2.5,
          third_place: 2.5,
          final: 3.0,
        },
      },
    },
  },
  {
    phaseId: "round_of_16",
    phaseName: "Octavos de Final",
    requiresScore: true,
    matchPicks: {
      types: [
        {
          key: "EXACT_SCORE",
          enabled: true,
          points: 30, // 20 * 1.5
        },
        {
          key: "GOAL_DIFFERENCE",
          enabled: false,
          points: 0,
        },
        {
          key: "PARTIAL_SCORE",
          enabled: false,
          points: 0,
        },
        {
          key: "TOTAL_GOALS",
          enabled: false,
          points: 0,
        },
        {
          key: "MATCH_OUTCOME_90MIN",
          enabled: false,
          points: 0,
        },
      ],
    },
  },
  {
    phaseId: "quarter_finals",
    phaseName: "Cuartos de Final",
    requiresScore: true,
    matchPicks: {
      types: [
        {
          key: "EXACT_SCORE",
          enabled: true,
          points: 40, // 20 * 2.0
        },
        {
          key: "GOAL_DIFFERENCE",
          enabled: false,
          points: 0,
        },
        {
          key: "PARTIAL_SCORE",
          enabled: false,
          points: 0,
        },
        {
          key: "TOTAL_GOALS",
          enabled: false,
          points: 0,
        },
        {
          key: "MATCH_OUTCOME_90MIN",
          enabled: false,
          points: 0,
        },
      ],
    },
  },
  {
    phaseId: "semi_finals",
    phaseName: "Semifinales",
    requiresScore: true,
    matchPicks: {
      types: [
        {
          key: "EXACT_SCORE",
          enabled: true,
          points: 50, // 20 * 2.5
        },
        {
          key: "GOAL_DIFFERENCE",
          enabled: false,
          points: 0,
        },
        {
          key: "PARTIAL_SCORE",
          enabled: false,
          points: 0,
        },
        {
          key: "TOTAL_GOALS",
          enabled: false,
          points: 0,
        },
        {
          key: "MATCH_OUTCOME_90MIN",
          enabled: false,
          points: 0,
        },
      ],
    },
  },
  {
    phaseId: "final",
    phaseName: "Final",
    requiresScore: true,
    matchPicks: {
      types: [
        {
          key: "EXACT_SCORE",
          enabled: true,
          points: 60, // 20 * 3.0
        },
        {
          key: "GOAL_DIFFERENCE",
          enabled: false,
          points: 0,
        },
        {
          key: "PARTIAL_SCORE",
          enabled: false,
          points: 0,
        },
        {
          key: "TOTAL_GOALS",
          enabled: false,
          points: 0,
        },
        {
          key: "MATCH_OUTCOME_90MIN",
          enabled: false,
          points: 0,
        },
      ],
    },
  },
];

export const BASIC_PRESET: PickConfigPreset = {
  key: "BASIC",
  name: "Básico",
  description:
    "Solo marcador exacto en todos los partidos. Los puntos aumentan automáticamente " +
    "en rondas eliminatorias (grupos: 20 pts, octavos: 30 pts, final: 60 pts).",
  config: BASIC_CONFIG,
};

// ==================== PRESET: SIMPLE ====================

/**
 * SIMPLE: Sin marcadores, solo posiciones y avances
 * - Ideal para usuarios casuales o torneos rápidos
 * - Menos mantenimiento para el HOST
 */
const SIMPLE_CONFIG: PoolPickTypesConfig = [
  {
    phaseId: "group_stage",
    phaseName: "Fase de Grupos",
    requiresScore: false,
    structuralPicks: {
      type: "GROUP_STANDINGS",
      config: {
        pointsPerExactPosition: 10,
        bonusPerfectGroup: 20,
        includeGlobalQualifiers: false,
      },
    },
  },
  {
    phaseId: "round_of_32",
    phaseName: "Dieciseisavos de Final",
    requiresScore: false,
    structuralPicks: {
      type: "KNOCKOUT_WINNER",
      config: {
        pointsPerCorrectAdvance: 10,
      },
    },
  },
  {
    phaseId: "round_of_16",
    phaseName: "Octavos de Final",
    requiresScore: false,
    structuralPicks: {
      type: "KNOCKOUT_WINNER",
      config: {
        pointsPerCorrectAdvance: 15,
      },
    },
  },
  {
    phaseId: "quarter_finals",
    phaseName: "Cuartos de Final",
    requiresScore: false,
    structuralPicks: {
      type: "KNOCKOUT_WINNER",
      config: {
        pointsPerCorrectAdvance: 20,
      },
    },
  },
  {
    phaseId: "semi_finals",
    phaseName: "Semifinales",
    requiresScore: false,
    structuralPicks: {
      type: "KNOCKOUT_WINNER",
      config: {
        pointsPerCorrectAdvance: 25,
      },
    },
  },
  {
    phaseId: "finals",
    phaseName: "Final",
    requiresScore: false,
    structuralPicks: {
      type: "KNOCKOUT_WINNER",
      config: {
        pointsPerCorrectAdvance: 30,
      },
    },
  },
];

export const SIMPLE_PRESET: PickConfigPreset = {
  key: "SIMPLE",
  name: "Simple",
  description:
    "Sin marcadores de partidos. En fase de grupos ordenas los equipos de cada grupo " +
    "(10 pts por posición correcta, +20 pts si el grupo completo es perfecto). " +
    "En eliminatorias solo eliges quién avanza.",
  config: SIMPLE_CONFIG,
};

// ==================== PRESET: ACUMULATIVO ====================

/**
 * ACUMULATIVO: Los puntos se suman por cada criterio que aciertes
 * - Resultado (ganador/empate): 5 pts en grupos, 10 pts en eliminatorias
 * - Goles local exactos: 2 pts en grupos, 4 pts en eliminatorias
 * - Goles visitante exactos: 2 pts en grupos, 4 pts en eliminatorias
 * - Diferencia de goles: 1 pt en grupos, 2 pts en eliminatorias
 *
 * Marcador exacto = suma de todos = 10 pts en grupos, 20 pts en eliminatorias
 */
const CUMULATIVE_CONFIG: PoolPickTypesConfig = [
  {
    phaseId: "group_stage",
    phaseName: "Fase de Grupos",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 1 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 5 },
        { key: "HOME_GOALS", enabled: true, points: 2 },
        { key: "AWAY_GOALS", enabled: true, points: 2 },
      ],
    },
  },
  {
    phaseId: "round_of_32",
    phaseName: "Dieciseisavos de Final",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
  {
    phaseId: "round_of_16",
    phaseName: "Octavos de Final",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
  {
    phaseId: "quarter_finals",
    phaseName: "Cuartos de Final",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
  {
    phaseId: "semi_finals",
    phaseName: "Semifinales",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
  {
    phaseId: "third_place",
    phaseName: "Tercer Lugar",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
  {
    phaseId: "finals",
    phaseName: "Final",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
];

export const CUMULATIVE_PRESET: PickConfigPreset = {
  key: "CUMULATIVE",
  name: "Acumulativo",
  description:
    "Los puntos se ACUMULAN: Resultado (5/10 pts) + Goles local (2/4 pts) + Goles visitante (2/4 pts) + " +
    "Diferencia (1/2 pts). Marcador exacto = suma de todos = 10 pts en grupos, 20 pts en eliminatorias.",
  config: CUMULATIVE_CONFIG,
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Obtiene todos los presets disponibles
 */
export function getAllPresets(): PickConfigPreset[] {
  return [CUMULATIVE_PRESET, BASIC_PRESET, SIMPLE_PRESET];
}

/**
 * Obtiene un preset por su key (hardcoded config con phaseIds genéricos)
 */
export function getPresetByKey(key: string): PickConfigPreset | null {
  const presets = getAllPresets();
  return presets.find((p) => p.key === key) || null;
}

/**
 * Genera configuración de preset dinámicamente usando las fases reales de la instancia.
 * Esto evita el mismatch de phaseIds entre presets hardcoded y datos reales del torneo.
 *
 * @param presetKey - Key del preset ("CUMULATIVE", "BASIC", "SIMPLE")
 * @param instancePhases - Fases extraídas del dataJson de la instancia
 * @returns Configuración de picks con phaseIds reales, o null si el preset no existe
 */
export function generateDynamicPresetConfig(
  presetKey: string,
  instancePhases: Array<{ id: string; name: string; type: string }>
): PoolPickTypesConfig | null {
  if (presetKey === "CUMULATIVE") {
    return instancePhases.map((phase) => {
      const isKnockout = phase.type !== "GROUP";
      return {
        phaseId: phase.id,
        phaseName: phase.name,
        requiresScore: true,
        matchPicks: {
          types: [
            { key: "EXACT_SCORE" as const, enabled: false, points: 0 },
            { key: "GOAL_DIFFERENCE" as const, enabled: true, points: isKnockout ? 2 : 1 },
            { key: "PARTIAL_SCORE" as const, enabled: false, points: 0 },
            { key: "TOTAL_GOALS" as const, enabled: false, points: 0 },
            { key: "MATCH_OUTCOME_90MIN" as const, enabled: true, points: isKnockout ? 10 : 5 },
            { key: "HOME_GOALS" as const, enabled: true, points: isKnockout ? 4 : 2 },
            { key: "AWAY_GOALS" as const, enabled: true, points: isKnockout ? 4 : 2 },
          ],
        },
      };
    });
  }

  if (presetKey === "BASIC") {
    return instancePhases.map((phase, index) => ({
      phaseId: phase.id,
      phaseName: phase.name,
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "EXACT_SCORE" as const, enabled: true, points: 20 + index * 10 },
          { key: "GOAL_DIFFERENCE" as const, enabled: false, points: 0 },
          { key: "PARTIAL_SCORE" as const, enabled: false, points: 0 },
          { key: "TOTAL_GOALS" as const, enabled: false, points: 0 },
          { key: "MATCH_OUTCOME_90MIN" as const, enabled: false, points: 0 },
        ],
      },
    }));
  }

  if (presetKey === "SIMPLE") {
    return instancePhases.map((phase) => ({
      phaseId: phase.id,
      phaseName: phase.name,
      requiresScore: false,
      structuralPicks: {
        type: (phase.type === "GROUP" ? "GROUP_STANDINGS" : "KNOCKOUT_WINNER") as any,
        config:
          phase.type === "GROUP"
            ? {
                pointsPosition1: 10,
                pointsPosition2: 10,
                pointsPosition3: 10,
                pointsPosition4: 10,
                bonusPerfectGroupEnabled: true,
                bonusPerfectGroup: 20,
              }
            : {
                pointsPerCorrectAdvance: 15,
              },
      },
    }));
  }

  return null;
}
