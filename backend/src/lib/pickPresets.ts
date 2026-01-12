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

// ==================== PRESET: AVANZADO ====================

/**
 * AVANZADO: Múltiples tipos de picks con auto-scaling
 * - Para usuarios experimentados que quieren más formas de ganar puntos
 * - Combina exacto, diferencia, parcial y totales
 */
const ADVANCED_CONFIG: PoolPickTypesConfig = [
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
          enabled: true,
          points: 10,
        },
        {
          key: "PARTIAL_SCORE",
          enabled: true,
          points: 8,
        },
        {
          key: "TOTAL_GOALS",
          enabled: true,
          points: 5,
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
          points: 30,
        },
        {
          key: "GOAL_DIFFERENCE",
          enabled: true,
          points: 15,
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
          points: 40,
        },
        {
          key: "GOAL_DIFFERENCE",
          enabled: true,
          points: 20,
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
          points: 50,
        },
        {
          key: "GOAL_DIFFERENCE",
          enabled: true,
          points: 25,
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
          points: 60,
        },
        {
          key: "GOAL_DIFFERENCE",
          enabled: true,
          points: 30,
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

export const ADVANCED_PRESET: PickConfigPreset = {
  key: "ADVANCED",
  name: "Avanzado",
  description:
    "Múltiples formas de ganar puntos: marcador exacto (20 pts), diferencia de goles (10 pts), " +
    "marcador parcial (8 pts) y goles totales (5 pts) en fase de grupos. " +
    "En eliminatorias solo exacto y diferencia con auto-scaling.",
  config: ADVANCED_CONFIG,
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

// ==================== HELPER FUNCTIONS ====================

/**
 * Obtiene todos los presets disponibles
 */
export function getAllPresets(): PickConfigPreset[] {
  return [BASIC_PRESET, ADVANCED_PRESET, SIMPLE_PRESET];
}

/**
 * Obtiene un preset por su key
 */
export function getPresetByKey(key: string): PickConfigPreset | null {
  const presets = getAllPresets();
  return presets.find((p) => p.key === key) || null;
}
