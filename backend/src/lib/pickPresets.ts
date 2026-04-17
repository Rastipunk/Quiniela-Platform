// Presets predefinidos para configuración rápida de picks
// Sprint 2 - Advanced Pick Types System

import type { PhasePickConfig, PickConfigPreset, PoolPickTypesConfig } from "../types/pickConfig";

// Base multipliers used by auto-scaling and hardcoded presets
const DEFAULT_MULTIPLIERS: Record<string, number> = {
  group_stage: 1.0,
  round_of_32: 1.5,
  round_of_16: 2.0,
  quarter_finals: 2.5,
  semi_finals: 3.0,
  finals: 4.0,
};

// Progressive knockout points for SIMPLE preset
const KNOCKOUT_POINTS: Record<string, number> = {
  round_of_32: 10,
  round_of_16: 15,
  quarter_finals: 20,
  semi_finals: 25,
  finals: 30,
};

function makeBasicTypes(points: number) {
  return [
    { key: "EXACT_SCORE" as const, enabled: true, points },
    { key: "GOAL_DIFFERENCE" as const, enabled: false, points: 0 },
    { key: "PARTIAL_SCORE" as const, enabled: false, points: 0 },
    { key: "TOTAL_GOALS" as const, enabled: false, points: 0 },
    { key: "MATCH_OUTCOME_90MIN" as const, enabled: false, points: 0 },
  ];
}

function makeCumulativeTypes(mult: number) {
  return [
    { key: "EXACT_SCORE" as const, enabled: false, points: 0 },
    { key: "GOAL_DIFFERENCE" as const, enabled: true, points: Math.round(2 * mult) },
    { key: "PARTIAL_SCORE" as const, enabled: false, points: 0 },
    { key: "TOTAL_GOALS" as const, enabled: false, points: 0 },
    { key: "MATCH_OUTCOME_90MIN" as const, enabled: true, points: Math.round(10 * mult) },
    { key: "HOME_GOALS" as const, enabled: true, points: Math.round(4 * mult) },
    { key: "AWAY_GOALS" as const, enabled: true, points: Math.round(4 * mult) },
  ];
}

// ==================== PRESET: BÁSICO ====================

/**
 * BÁSICO: Solo marcador exacto en todas las fases con auto-scaling
 * - Base: 20 pts en fase de grupos (×1.0)
 * - Puntos crecen automáticamente: R32 ×1.5, R16 ×2, QF ×2.5, SF ×3, Finals ×4
 */
const BASIC_CONFIG: PoolPickTypesConfig = [
  {
    phaseId: "group_stage",
    phaseName: "Fase de Grupos",
    requiresScore: true,
    matchPicks: {
      types: makeBasicTypes(20),
      autoScaling: {
        enabled: true,
        basePhase: "group_stage",
        multipliers: DEFAULT_MULTIPLIERS,
      },
    },
  },
  {
    phaseId: "round_of_32",
    phaseName: "Dieciseisavos de Final",
    requiresScore: true,
    matchPicks: { types: makeBasicTypes(30) },
  },
  {
    phaseId: "round_of_16",
    phaseName: "Octavos de Final",
    requiresScore: true,
    matchPicks: { types: makeBasicTypes(40) },
  },
  {
    phaseId: "quarter_finals",
    phaseName: "Cuartos de Final",
    requiresScore: true,
    matchPicks: { types: makeBasicTypes(50) },
  },
  {
    phaseId: "semi_finals",
    phaseName: "Semifinales",
    requiresScore: true,
    matchPicks: { types: makeBasicTypes(60) },
  },
  {
    phaseId: "finals",
    phaseName: "Final",
    requiresScore: true,
    matchPicks: { types: makeBasicTypes(80) },
  },
];

export const BASIC_PRESET: PickConfigPreset = {
  key: "BASIC",
  name: "Básico",
  description:
    "Solo marcador exacto en todos los partidos. Los puntos aumentan automáticamente " +
    "en rondas eliminatorias (grupos: 20 pts, octavos: 40 pts, final: 80 pts).",
  config: BASIC_CONFIG,
};

// ==================== PRESET: SIMPLE ====================

/**
 * SIMPLE: Sin marcadores, solo posiciones y avances
 * - Fase de grupos: GROUP_STANDINGS (10 pts/posición, +20 bonus grupo perfecto)
 * - Eliminatorias: KNOCKOUT_WINNER (progresivo: R32=10, R16=15, QF=20, SF=25, Finals=30)
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
      config: { pointsPerCorrectAdvance: 10 },
    },
  },
  {
    phaseId: "round_of_16",
    phaseName: "Octavos de Final",
    requiresScore: false,
    structuralPicks: {
      type: "KNOCKOUT_WINNER",
      config: { pointsPerCorrectAdvance: 15 },
    },
  },
  {
    phaseId: "quarter_finals",
    phaseName: "Cuartos de Final",
    requiresScore: false,
    structuralPicks: {
      type: "KNOCKOUT_WINNER",
      config: { pointsPerCorrectAdvance: 20 },
    },
  },
  {
    phaseId: "semi_finals",
    phaseName: "Semifinales",
    requiresScore: false,
    structuralPicks: {
      type: "KNOCKOUT_WINNER",
      config: { pointsPerCorrectAdvance: 25 },
    },
  },
  {
    phaseId: "finals",
    phaseName: "Final",
    requiresScore: false,
    structuralPicks: {
      type: "KNOCKOUT_WINNER",
      config: { pointsPerCorrectAdvance: 30 },
    },
  },
];

export const SIMPLE_PRESET: PickConfigPreset = {
  key: "SIMPLE",
  name: "Simple",
  description:
    "Sin marcadores de partidos. En fase de grupos ordenas los equipos de cada grupo " +
    "(10 pts por posición correcta, +20 pts si el grupo completo es perfecto). " +
    "En eliminatorias solo eliges quién avanza (puntos crecen por ronda).",
  config: SIMPLE_CONFIG,
};

// ==================== PRESET: ACUMULATIVO ====================

/**
 * ACUMULATIVO: Los puntos se suman por cada criterio que aciertes
 * - Base: Resultado 10 pts + Goles local 4 pts + Goles visitante 4 pts + Diferencia 2 pts = 20 pts max
 * - Auto-scaling por fase: ×1.0 grupos, ×1.5 R32, ×2.0 R16, ×2.5 QF, ×3.0 SF, ×4.0 Finals
 */
const CUMULATIVE_CONFIG: PoolPickTypesConfig = [
  {
    phaseId: "group_stage",
    phaseName: "Fase de Grupos",
    requiresScore: true,
    matchPicks: {
      types: makeCumulativeTypes(1.0),
      autoScaling: {
        enabled: true,
        basePhase: "group_stage",
        multipliers: DEFAULT_MULTIPLIERS,
      },
    },
  },
  {
    phaseId: "round_of_32",
    phaseName: "Dieciseisavos de Final",
    requiresScore: true,
    matchPicks: { types: makeCumulativeTypes(1.5) },
  },
  {
    phaseId: "round_of_16",
    phaseName: "Octavos de Final",
    requiresScore: true,
    matchPicks: { types: makeCumulativeTypes(2.0) },
  },
  {
    phaseId: "quarter_finals",
    phaseName: "Cuartos de Final",
    requiresScore: true,
    matchPicks: { types: makeCumulativeTypes(2.5) },
  },
  {
    phaseId: "semi_finals",
    phaseName: "Semifinales",
    requiresScore: true,
    matchPicks: { types: makeCumulativeTypes(3.0) },
  },
  {
    phaseId: "finals",
    phaseName: "Final",
    requiresScore: true,
    matchPicks: { types: makeCumulativeTypes(4.0) },
  },
];

export const CUMULATIVE_PRESET: PickConfigPreset = {
  key: "CUMULATIVE",
  name: "Acumulativo",
  description:
    "Los puntos se ACUMULAN: Resultado (10 pts) + Goles local (4 pts) + Goles visitante (4 pts) + " +
    "Diferencia (2 pts) = 20 pts max. Puntos escalan por fase (grupos ×1, final ×4).",
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
    return instancePhases.map((phase) => ({
      phaseId: phase.id,
      phaseName: phase.name,
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "EXACT_SCORE" as const, enabled: false, points: 0 },
          { key: "GOAL_DIFFERENCE" as const, enabled: true, points: 2 },
          { key: "PARTIAL_SCORE" as const, enabled: false, points: 0 },
          { key: "TOTAL_GOALS" as const, enabled: false, points: 0 },
          { key: "MATCH_OUTCOME_90MIN" as const, enabled: true, points: 10 },
          { key: "HOME_GOALS" as const, enabled: true, points: 4 },
          { key: "AWAY_GOALS" as const, enabled: true, points: 4 },
        ],
        autoScaling: {
          enabled: true,
          basePhase: instancePhases[0]?.id ?? "group_stage",
          multipliers: DEFAULT_MULTIPLIERS,
        },
      },
    }));
  }

  if (presetKey === "BASIC") {
    return instancePhases.map((phase) => ({
      phaseId: phase.id,
      phaseName: phase.name,
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "EXACT_SCORE" as const, enabled: true, points: 20 },
          { key: "GOAL_DIFFERENCE" as const, enabled: false, points: 0 },
          { key: "PARTIAL_SCORE" as const, enabled: false, points: 0 },
          { key: "TOTAL_GOALS" as const, enabled: false, points: 0 },
          { key: "MATCH_OUTCOME_90MIN" as const, enabled: false, points: 0 },
        ],
        autoScaling: {
          enabled: true,
          basePhase: instancePhases[0]?.id ?? "group_stage",
          multipliers: DEFAULT_MULTIPLIERS,
        },
      },
    }));
  }

  if (presetKey === "SIMPLE") {
    return instancePhases.map((phase): PhasePickConfig => ({
      phaseId: phase.id,
      phaseName: phase.name,
      requiresScore: false,
      structuralPicks: phase.type === "GROUP"
        ? {
            type: "GROUP_STANDINGS" as const,
            config: {
              pointsPerExactPosition: 10,
              bonusPerfectGroup: 20,
              includeGlobalQualifiers: false,
            },
          }
        : {
            type: "KNOCKOUT_WINNER" as const,
            config: {
              pointsPerCorrectAdvance: KNOCKOUT_POINTS[phase.id] ?? 15,
            },
          },
    }));
  }

  return null;
}
