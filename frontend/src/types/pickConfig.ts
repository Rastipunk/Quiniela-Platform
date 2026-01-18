// Tipos TypeScript para configuración de picks (Frontend)
// Sprint 2 - Advanced Pick Types System

// ==================== MATCH-BASED PICK TYPES ====================

export type MatchPickTypeKey =
  | "EXACT_SCORE"
  | "GOAL_DIFFERENCE"
  | "PARTIAL_SCORE"
  | "TOTAL_GOALS"
  | "MATCH_OUTCOME_90MIN";

export type MatchPickType = {
  key: MatchPickTypeKey;
  enabled: boolean;
  points: number;
  config?: Record<string, any>;
};

export type AutoScalingConfig = {
  enabled: boolean;
  basePhase: string;
  multipliers: {
    [phaseId: string]: number;
  };
};

export type MatchPicksConfig = {
  types: MatchPickType[];
  autoScaling?: AutoScalingConfig;
};

// ==================== STRUCTURAL PICK TYPES ====================

export type StructuralPickType =
  | "GROUP_STANDINGS"
  | "GLOBAL_QUALIFIERS"
  | "KNOCKOUT_WINNER";

export type GroupStandingsConfig = {
  // Legacy format
  pointsPerExactPosition?: number;
  // New format: points per position
  pointsPosition1?: number;
  pointsPosition2?: number;
  pointsPosition3?: number;
  pointsPosition4?: number;
  // Bonus for perfect group
  bonusPerfectGroup?: number;
  bonusPerfectGroupEnabled?: boolean;
  // Global qualifiers (optional)
  includeGlobalQualifiers?: boolean;
  globalQualifiersPoints?: number;
};

export type GlobalQualifiersConfig = {
  totalQualifiers: number;
  pointsPerExactPosition: number;
  lockDateTime: string;
};

export type KnockoutWinnerConfig = {
  pointsPerCorrectAdvance: number;
};

export type StructuralPickConfig =
  | GroupStandingsConfig
  | GlobalQualifiersConfig
  | KnockoutWinnerConfig;

export type StructuralPicksConfig = {
  type: StructuralPickType;
  config: StructuralPickConfig;
};

// ==================== PHASE PICK CONFIGURATION ====================

export type PhasePickConfig = {
  phaseId: string;
  phaseName: string;
  requiresScore: boolean;
  structuralPicks?: StructuralPicksConfig;
  matchPicks?: MatchPicksConfig;
};

export type PoolPickTypesConfig = PhasePickConfig[];

// ==================== PRESETS ====================

export type PickConfigPresetKey = "BASIC" | "ADVANCED" | "SIMPLE" | "CUSTOM";

export type PickConfigPreset = {
  key: PickConfigPresetKey;
  name: string;
  description: string;
  config: PoolPickTypesConfig;
};

// ==================== WIZARD STATE ====================

export type WizardStep = "PRESET_SELECTION" | "PHASE_CONFIG" | "SUMMARY";

export type WizardState = {
  currentStep: WizardStep;
  selectedPreset: PickConfigPresetKey | null;
  configuration: PoolPickTypesConfig;
  currentPhaseIndex: number;
};

// ==================== STRUCTURAL PICK/RESULT DATA ====================

// Para GROUP_STANDINGS: lista ordenada de team IDs (1° a 4° lugar)
export type GroupStandingsPickData = {
  groupId: string;
  teamIds: string[]; // [teamId1, teamId2, teamId3, teamId4] en orden del 1° al 4°
};

// Para KNOCKOUT_WINNER: ID del equipo que avanza
export type KnockoutWinnerPickData = {
  matchId: string;
  winnerId: string;
};

// Para fases de grupos: múltiples picks (uno por grupo)
export type GroupStandingsPhasePickData = {
  groups: GroupStandingsPickData[];
};

// Para fases eliminatorias: múltiples picks (uno por partido)
export type KnockoutPhasePickData = {
  matches: KnockoutWinnerPickData[];
};

// Union type para todos los tipos de picks estructurales
export type StructuralPickData =
  | GroupStandingsPhasePickData
  | KnockoutPhasePickData;

// Result data (mismo formato que picks, pero publicado por el host)
export type GroupStandingsResultData = GroupStandingsPickData;
export type KnockoutWinnerResultData = KnockoutWinnerPickData;
