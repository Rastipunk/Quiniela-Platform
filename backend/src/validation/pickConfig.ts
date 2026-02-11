// Validadores Zod para configuración de picks avanzados
// Sprint 2 - Advanced Pick Types System

import { z } from "zod";
import type { ValidationResult, ValidationWarning } from "../types/pickConfig";

// ==================== MATCH-BASED PICK SCHEMAS ====================

export const MatchPickTypeKeySchema = z.enum([
  "EXACT_SCORE",
  "GOAL_DIFFERENCE",
  "PARTIAL_SCORE",
  "TOTAL_GOALS",
  "MATCH_OUTCOME_90MIN",
  "HOME_GOALS",
  "AWAY_GOALS",
]);

export const MatchPickTypeSchema = z.object({
  key: MatchPickTypeKeySchema,
  enabled: z.boolean(),
  points: z.number().int().min(0).max(1000),
  config: z.record(z.string(), z.any()).optional(),
});

export const AutoScalingConfigSchema = z.object({
  enabled: z.boolean(),
  basePhase: z.string().min(1),
  multipliers: z.record(z.string(), z.number().min(1).max(10)),
});

export const MatchPicksConfigSchema = z.object({
  types: z.array(MatchPickTypeSchema).min(1),
  autoScaling: AutoScalingConfigSchema.optional(),
});

// ==================== STRUCTURAL PICK SCHEMAS ====================

export const StructuralPickTypeSchema = z.enum([
  "GROUP_STANDINGS",
  "GLOBAL_QUALIFIERS",
  "KNOCKOUT_WINNER",
]);

export const GroupStandingsConfigSchema = z.object({
  pointsPerExactPosition: z.number().int().min(0).max(1000),
  bonusPerfectGroup: z.number().int().min(0).max(1000).optional(),
  includeGlobalQualifiers: z.boolean().optional(),
  globalQualifiersPoints: z.number().int().min(0).max(1000).optional(),
});

export const GlobalQualifiersConfigSchema = z.object({
  totalQualifiers: z.number().int().min(1).max(100),
  pointsPerExactPosition: z.number().int().min(0).max(1000),
  lockDateTime: z.string().datetime(),
});

export const KnockoutWinnerConfigSchema = z.object({
  pointsPerCorrectAdvance: z.number().int().min(0).max(1000),
});

export const StructuralPickConfigSchema = z.union([
  GroupStandingsConfigSchema,
  GlobalQualifiersConfigSchema,
  KnockoutWinnerConfigSchema,
]);

export const StructuralPicksConfigSchema = z.object({
  type: StructuralPickTypeSchema,
  config: StructuralPickConfigSchema,
});

// ==================== PHASE PICK CONFIG SCHEMA ====================

export const PhasePickConfigSchema = z.object({
  phaseId: z.string().min(1),
  phaseName: z.string().min(1),
  requiresScore: z.boolean(),
  structuralPicks: StructuralPicksConfigSchema.optional(),
  matchPicks: MatchPicksConfigSchema.optional(),
});

export const PoolPickTypesConfigSchema = z.array(PhasePickConfigSchema);

// ==================== PRESET SCHEMAS ====================

export const PickConfigPresetKeySchema = z.enum([
  "BASIC",
  "SIMPLE",
  "CUMULATIVE",
  "CUSTOM",
]);

// ==================== VALIDACIÓN PERSONALIZADA ====================

/**
 * Valida que una configuración de fase sea consistente
 * Reglas:
 * - Si requiresScore = true, debe tener matchPicks (no structuralPicks)
 * - Si requiresScore = false, debe tener structuralPicks (no matchPicks)
 */
export function validatePhasePickConfig(config: unknown): ValidationResult {
  const errors: { field: string; message: string }[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // Validar schema básico
    const parsed = PhasePickConfigSchema.parse(config);

    // Validar exclusividad requiresScore
    if (parsed.requiresScore) {
      if (!parsed.matchPicks) {
        errors.push({
          field: "matchPicks",
          message: "matchPicks es requerido cuando requiresScore = true",
        });
      }
      if (parsed.structuralPicks) {
        errors.push({
          field: "structuralPicks",
          message: "structuralPicks NO debe estar presente cuando requiresScore = true",
        });
      }

      // Validar que al menos un tipo esté enabled
      if (parsed.matchPicks && !parsed.matchPicks.types.some((t) => t.enabled)) {
        errors.push({
          field: "matchPicks.types",
          message: "Al menos un tipo de pick debe estar habilitado",
        });
      }

      // Soft validation: advertir sobre puntos desbalanceados
      if (parsed.matchPicks) {
        const warnings_ = validateMatchPicksBalance(parsed.matchPicks);
        warnings.push(...warnings_);
      }
    } else {
      if (!parsed.structuralPicks) {
        errors.push({
          field: "structuralPicks",
          message: "structuralPicks es requerido cuando requiresScore = false",
        });
      }
      if (parsed.matchPicks) {
        errors.push({
          field: "matchPicks",
          message: "matchPicks NO debe estar presente cuando requiresScore = false",
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        valid: false,
        errors: err.issues.map((e: z.ZodIssue) => ({
          field: e.path.join("."),
          message: e.message,
        })),
        warnings: [],
      };
    }

    return {
      valid: false,
      errors: [{ field: "unknown", message: "Error de validación desconocido" }],
      warnings: [],
    };
  }
}

/**
 * Valida balance de puntos en match picks (soft validation)
 * Genera warnings si los puntos no siguen el patrón lógico de dificultad
 */
function validateMatchPicksBalance(config: {
  types: Array<{ key: string; enabled: boolean; points: number }>;
}): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const enabledTypes = config.types.filter((t) => t.enabled);

  // Obtener puntos de cada tipo
  const exactScore = enabledTypes.find((t) => t.key === "EXACT_SCORE");
  const goalDiff = enabledTypes.find((t) => t.key === "GOAL_DIFFERENCE");
  const partialScore = enabledTypes.find((t) => t.key === "PARTIAL_SCORE");
  const totalGoals = enabledTypes.find((t) => t.key === "TOTAL_GOALS");

  // Validar orden lógico: EXACT > GOAL_DIFF > PARTIAL > TOTAL
  if (exactScore && goalDiff && exactScore.points <= goalDiff.points) {
    warnings.push({
      field: "matchPicks.types",
      message: "Marcador exacto tiene menos o igual puntos que Diferencia de goles",
      suggestion:
        "Típicamente, acertar el marcador exacto es más difícil que acertar solo la diferencia. " +
        `Considera aumentar EXACT_SCORE (actualmente ${exactScore.points}) por encima de ` +
        `GOAL_DIFFERENCE (actualmente ${goalDiff.points}).`,
    });
  }

  if (goalDiff && partialScore && goalDiff.points <= partialScore.points) {
    warnings.push({
      field: "matchPicks.types",
      message: "Diferencia de goles tiene menos o igual puntos que Marcador parcial",
      suggestion:
        "Típicamente, acertar la diferencia completa es más difícil que acertar solo un marcador parcial. " +
        `Considera aumentar GOAL_DIFFERENCE (actualmente ${goalDiff.points}) por encima de ` +
        `PARTIAL_SCORE (actualmente ${partialScore.points}).`,
    });
  }

  if (partialScore && totalGoals && partialScore.points <= totalGoals.points) {
    warnings.push({
      field: "matchPicks.types",
      message: "Marcador parcial tiene menos o igual puntos que Goles totales",
      suggestion:
        "Típicamente, acertar el marcador parcial es más específico que solo el total de goles. " +
        `Considera aumentar PARTIAL_SCORE (actualmente ${partialScore.points}) por encima de ` +
        `TOTAL_GOALS (actualmente ${totalGoals.points}).`,
    });
  }

  // Advertir si EXACT_SCORE es muy bajo comparado con la suma de otros
  if (exactScore && goalDiff && partialScore) {
    const sumOthers = goalDiff.points + partialScore.points;
    if (exactScore.points < sumOthers * 0.6) {
      warnings.push({
        field: "matchPicks.types",
        message: "Marcador exacto podría estar subvalorado",
        suggestion:
          `El marcador exacto (${exactScore.points} pts) es significativamente menor que la suma ` +
          `de otros tipos (${sumOthers} pts). Considera que acertar el marcador exacto es el logro ` +
          `más completo y debería reflejar eso en puntos.`,
      });
    }
  }

  return warnings;
}

/**
 * Valida configuración completa de pool picks
 */
export function validatePoolPickTypesConfig(config: unknown): ValidationResult {
  const errors: { field: string; message: string }[] = [];
  const allWarnings: ValidationWarning[] = [];

  try {
    // Validar schema básico
    const parsed = PoolPickTypesConfigSchema.parse(config);

    // Validar que haya al menos una fase
    if (parsed.length === 0) {
      errors.push({
        field: "phases",
        message: "Debe haber al menos una fase configurada",
      });
    }

    // Validar cada fase individualmente
    for (let i = 0; i < parsed.length; i++) {
      const phaseResult = validatePhasePickConfig(parsed[i]);

      phaseResult.errors.forEach((err) => {
        errors.push({
          field: `phases[${i}].${err.field}`,
          message: err.message,
        });
      });

      phaseResult.warnings.forEach((warn) => {
        allWarnings.push({
          ...warn,
          field: `phases[${i}].${warn.field}`,
        });
      });
    }

    // Validar IDs únicos
    const phaseIds = parsed.map((p) => p.phaseId);
    const duplicates = phaseIds.filter((id, index) => phaseIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push({
        field: "phases",
        message: `IDs de fase duplicados: ${duplicates.join(", ")}`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: allWarnings,
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        valid: false,
        errors: err.issues.map((e: z.ZodIssue) => ({
          field: e.path.join("."),
          message: e.message,
        })),
        warnings: [],
      };
    }

    return {
      valid: false,
      errors: [{ field: "unknown", message: "Error de validación desconocido" }],
      warnings: [],
    };
  }
}
