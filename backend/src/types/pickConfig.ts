// Tipos TypeScript para configuración de picks avanzados
// Sprint 2 - Advanced Pick Types System

// ==================== MATCH-BASED PICK TYPES ====================

/**
 * Tipos de picks basados en marcadores de partidos individuales
 */
export type MatchPickTypeKey =
  | "EXACT_SCORE"           // Marcador exacto (ej: 2-1)
  | "GOAL_DIFFERENCE"       // Diferencia exacta de goles (ej: +2)
  | "PARTIAL_SCORE"         // Acierta goles local O visitante (no ambos)
  | "TOTAL_GOALS"           // Total exacto de goles (ej: 3)
  | "MATCH_OUTCOME_90MIN";  // Resultado (HOME/DRAW/AWAY) en 90min

/**
 * Configuración de un tipo de pick para partidos
 */
export type MatchPickType = {
  key: MatchPickTypeKey;
  enabled: boolean;
  points: number;
  config?: Record<string, any>; // Configuración específica del tipo (futuro)
};

/**
 * Configuración de auto-scaling para fases eliminatorias
 * Multiplica puntos automáticamente según importancia de la ronda
 */
export type AutoScalingConfig = {
  enabled: boolean;
  basePhase: string; // ej: "group_stage"
  multipliers: {
    [phaseId: string]: number; // ej: { "round_of_16": 1.5, "quarterfinals": 2.0 }
  };
};

/**
 * Configuración de picks basados en marcadores de partidos
 */
export type MatchPicksConfig = {
  types: MatchPickType[];
  autoScaling?: AutoScalingConfig;
};

// ==================== STRUCTURAL PICK TYPES ====================

/**
 * Tipos de picks estructurales (sin marcadores)
 */
export type StructuralPickType =
  | "GROUP_STANDINGS"       // Ordenar equipos dentro de cada grupo
  | "GLOBAL_QUALIFIERS"     // Ordenar todos los clasificados (ej: 32 equipos)
  | "KNOCKOUT_WINNER";      // Elegir quién avanza en eliminatorias

/**
 * Configuración para ordenar equipos dentro de cada grupo
 */
export type GroupStandingsConfig = {
  pointsPerExactPosition: number; // Puntos por equipo en posición correcta
  bonusPerfectGroup?: number;     // Bonus si todo el grupo es perfecto

  // Opción adicional: ordenar los 32 clasificados globalmente
  includeGlobalQualifiers?: boolean;
  globalQualifiersPoints?: number; // Puntos por clasificado en posición exacta
};

/**
 * Configuración para ordenar clasificados globalmente
 */
export type GlobalQualifiersConfig = {
  totalQualifiers: number;        // ej: 32 para WC2026
  pointsPerExactPosition: number; // Puntos por equipo en posición exacta
  lockDateTime: string;           // ISO 8601 - se congela en esta fecha/hora
};

/**
 * Configuración para elegir quién avanza en eliminatorias (sin marcador)
 */
export type KnockoutWinnerConfig = {
  pointsPerCorrectAdvance: number; // Puntos por acertar quién pasa
};

/**
 * Union type de todas las configuraciones estructurales
 */
export type StructuralPickConfig =
  | GroupStandingsConfig
  | GlobalQualifiersConfig
  | KnockoutWinnerConfig;

/**
 * Configuración de picks estructurales
 */
export type StructuralPicksConfig = {
  type: StructuralPickType;
  config: StructuralPickConfig;
};

// ==================== PHASE PICK CONFIGURATION ====================

/**
 * Configuración completa de picks para una fase del torneo
 *
 * REGLA FUNDAMENTAL: requiresScore define dos ramas MUTUAMENTE EXCLUYENTES
 * - Si true: solo matchPicks (picks basados en marcadores)
 * - Si false: solo structuralPicks (picks estructurales sin marcadores)
 */
export type PhasePickConfig = {
  phaseId: string;   // ej: "group_stage", "round_of_16", etc.
  phaseName: string; // ej: "Fase de Grupos", "Octavos de Final", etc.

  // DECISIÓN FUNDAMENTAL
  requiresScore: boolean;

  // RAMA A: Structural Picks (requiresScore = false)
  structuralPicks?: StructuralPicksConfig;

  // RAMA B: Match-Based Picks (requiresScore = true)
  matchPicks?: MatchPicksConfig;
};

/**
 * Configuración completa de picks para una pool
 * Array de configuraciones por fase
 */
export type PoolPickTypesConfig = PhasePickConfig[];

// ==================== PRESETS ====================

/**
 * Presets predefinidos para configuración rápida
 */
export type PickConfigPresetKey =
  | "BASIC"      // Solo marcador exacto, auto-scaling
  | "ADVANCED"   // Múltiples tipos de picks con marcador
  | "SIMPLE"     // Sin marcadores, solo posiciones/avances
  | "CUSTOM";    // Personalizado

/**
 * Metadata de un preset
 */
export type PickConfigPreset = {
  key: PickConfigPresetKey;
  name: string;
  description: string;
  config: PoolPickTypesConfig;
};

// ==================== SCORING CONTEXT ====================

/**
 * Contexto de scoring para evaluación de picks
 * Usado por el scoring engine para calcular puntos
 */
export type ScoringContext = {
  phaseId: string;
  matchId: string;
  config: PhasePickConfig;
};

/**
 * Resultado de evaluación de un pick
 */
export type PickEvaluationResult = {
  matchPickType: MatchPickTypeKey;
  points: number;
  matched: boolean;
};

/**
 * Resultado completo de scoring para un partido
 */
export type MatchScoringResult = {
  matchId: string;
  totalPoints: number;
  evaluations: PickEvaluationResult[];
};

// ==================== VALIDATION ====================

/**
 * Resultado de validación de configuración
 */
export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
};

/**
 * Error de validación (bloquea creación)
 */
export type ValidationError = {
  field: string;
  message: string;
};

/**
 * Warning de validación (no bloquea, pero alerta)
 */
export type ValidationWarning = {
  field: string;
  message: string;
  suggestion: string;
};
