"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";
import { useIsMobile } from "@/hooks/useIsMobile";
import { colors, radii, spacing, fontSize, fontWeight, shadows } from "@/lib/theme";
import type {
  PhasePickConfig,
  PoolPickTypesConfig,
  MatchPickTypeKey,
  MatchPickType,
  GroupStandingsConfig,
  KnockoutWinnerConfig,
} from "@/types/pickConfig";
import type { PickConfigPresetKey } from "@/types/pickConfig";
import type { InstancePhase } from "@/types/poolWizard";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";

// ── Constants ─────────────────────────────────────────────────

type PresetInfo = {
  key: PickConfigPresetKey;
  icon: string;
  name: string;
  tagline: string;
  description: string;
  example: string;
  recommended?: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
};

const PRESETS: PresetInfo[] = [
  {
    key: "CUMULATIVE",
    icon: "\u{1F3C6}",
    name: "Predictor",
    tagline: "RECOMENDADO",
    description: "Puntos acumulables por cada criterio que aciertes",
    example: "Si dices 3-1 y sale 2-1 \u2192 Resultado \u2713 (10pts) + Visitante \u2713 (4pts) = 14pts",
    recommended: true,
    color: colors.brand,
    bgColor: "rgba(79,70,229,0.06)",
    borderColor: colors.brand,
  },
  {
    key: "BASIC",
    icon: "\u{1F3AF}",
    name: "Todo o Nada",
    tagline: "CLASICO",
    description: "Solo ganas puntos si aciertas el marcador exacto",
    example: "2-1 \u2192 2-1 = 20pts  |  2-1 \u2192 3-1 = 0pts",
    color: colors.successAlt,
    bgColor: "rgba(5,150,105,0.06)",
    borderColor: colors.successAlt,
  },
  {
    key: "SIMPLE",
    icon: "\u{1F9E0}",
    name: "Estratega",
    tagline: "SIN MARCADORES",
    description: "No predices marcadores. Predices posiciones y quien avanza",
    example: "1\u00B0 Argentina, 2\u00B0 Francia \u2192 10pts por cada posicion!",
    color: "#d97706",
    bgColor: "rgba(217,119,6,0.06)",
    borderColor: "#d97706",
  },
  {
    key: "CUSTOM",
    icon: "\u2699\uFE0F",
    name: "Personalizado",
    tagline: "AVANZADO",
    description: "Disena tu propio sistema de puntos fase por fase",
    example: "Control total: elige criterios, puntos y reglas por fase",
    color: colors.purple,
    bgColor: "rgba(124,58,237,0.06)",
    borderColor: colors.purple,
  },
];

const CRITERION_META: Record<MatchPickTypeKey, { label: string; description: string; recGroup: number; recKnockout: number }> = {
  MATCH_OUTCOME_90MIN: { label: "Resultado", description: "Acertar ganador o empate", recGroup: 10, recKnockout: 10 },
  HOME_GOALS:          { label: "Goles Local", description: "Acertar goles del equipo local", recGroup: 4, recKnockout: 4 },
  AWAY_GOALS:          { label: "Goles Visitante", description: "Acertar goles del equipo visitante", recGroup: 4, recKnockout: 4 },
  GOAL_DIFFERENCE:     { label: "Diferencia de goles", description: "Acertar la diferencia entre ambos", recGroup: 2, recKnockout: 2 },
  EXACT_SCORE:         { label: "Marcador Exacto", description: "Bonus por acertar ambos marcadores", recGroup: 0, recKnockout: 0 },
  TOTAL_GOALS:         { label: "Total de Goles", description: "Acertar la suma total de goles", recGroup: 0, recKnockout: 0 },
  PARTIAL_SCORE:       { label: "Marcador Parcial", description: "Acertar uno de los dos marcadores", recGroup: 0, recKnockout: 0 },
};

// ── Preset Config Generator ──────────────────────────────────

function generatePresetConfig(
  presetKey: PickConfigPresetKey,
  phases: InstancePhase[],
): PoolPickTypesConfig {
  if (presetKey === "CUMULATIVE") {
    return phases.map((phase) => ({
      phaseId: phase.id,
      phaseName: phase.name,
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "MATCH_OUTCOME_90MIN" as const, enabled: true, points: 10 },
          { key: "HOME_GOALS" as const, enabled: true, points: 4 },
          { key: "AWAY_GOALS" as const, enabled: true, points: 4 },
          { key: "GOAL_DIFFERENCE" as const, enabled: true, points: 2 },
        ],
      },
    }));
  }

  if (presetKey === "CUSTOM") {
    return phases.map((phase) => ({
      phaseId: phase.id,
      phaseName: phase.name,
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "MATCH_OUTCOME_90MIN" as const, enabled: true, points: 10 },
          { key: "HOME_GOALS" as const, enabled: true, points: 4 },
          { key: "AWAY_GOALS" as const, enabled: true, points: 4 },
          { key: "GOAL_DIFFERENCE" as const, enabled: true, points: 2 },
          { key: "TOTAL_GOALS" as const, enabled: false, points: 0 },
        ],
      },
    }));
  }

  if (presetKey === "BASIC") {
    return phases.map((phase) => ({
      phaseId: phase.id,
      phaseName: phase.name,
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "EXACT_SCORE" as const, enabled: true, points: 20 },
        ],
      },
    }));
  }

  // SIMPLE — base value is 10 pts (groups). Knockout phases derive from
  // the base via the same per-phase multipliers the Predictor uses
  // (×1.5, ×2.0, ×2.5, ×3.0, ×4.0 for R32 → Final). When the wizard
  // applies scaling these become the visible default points; the host
  // can still override per-phase from the advanced UI.
  const knockoutPointsMap: Record<string, number> = {
    round_of_32: 15, round_of_16: 20, quarter_finals: 25,
    semi_finals: 30, finals: 40,
  };

  return phases.map((phase): PhasePickConfig => ({
    phaseId: phase.id,
    phaseName: phase.name,
    requiresScore: false,
    structuralPicks: phase.type === "GROUP"
      ? {
          type: "GROUP_STANDINGS" as const,
          config: {
            pointsPerExactPosition: 10,
            bonusPerfectGroup: 20,
            bonusPerfectGroupEnabled: true,
            includeGlobalQualifiers: false,
          },
        }
      : {
          type: "KNOCKOUT_WINNER" as const,
          config: {
            pointsPerCorrectAdvance: knockoutPointsMap[phase.id] ?? 15,
          },
        },
  }));
}

// ── Score Calculation Helpers ─────────────────────────────────

type CalcResult = { key: MatchPickTypeKey; label: string; hit: boolean; points: number };

function calculateScore(
  realHome: number,
  realAway: number,
  predHome: number,
  predAway: number,
  enabledTypes: MatchPickType[],
): CalcResult[] {
  const results: CalcResult[] = [];

  for (const t of enabledTypes) {
    if (!t.enabled || t.points <= 0) continue;
    const meta = CRITERION_META[t.key];
    let hit = false;

    switch (t.key) {
      case "MATCH_OUTCOME_90MIN": {
        const realOutcome = Math.sign(realHome - realAway);
        const predOutcome = Math.sign(predHome - predAway);
        hit = realOutcome === predOutcome;
        break;
      }
      case "HOME_GOALS":
        hit = realHome === predHome;
        break;
      case "AWAY_GOALS":
        hit = realAway === predAway;
        break;
      case "GOAL_DIFFERENCE":
        hit = (realHome - realAway) === (predHome - predAway);
        break;
      case "EXACT_SCORE":
        hit = realHome === predHome && realAway === predAway;
        break;
      case "TOTAL_GOALS":
        hit = (realHome + realAway) === (predHome + predAway);
        break;
      case "PARTIAL_SCORE":
        hit = realHome === predHome || realAway === predAway;
        break;
    }

    results.push({ key: t.key, label: meta.label, hit, points: hit ? t.points : 0 });
  }

  return results;
}

// ── Preset Card Sub-component ────────────────────────────────

function PresetCard({
  preset,
  isMobile,
  onSelect,
}: {
  preset: PresetInfo;
  isMobile: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
        padding: isMobile ? spacing.lg : spacing.xl,
        background: hovered ? preset.bgColor : colors.white,
        border: `2px solid ${hovered ? preset.borderColor : colors.borderLight}`,
        borderRadius: radii["3xl"],
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? `0 8px 24px ${preset.borderColor}22` : shadows.sm,
        width: "100%",
        outline: "none",
      }}
    >
      {/* Recommended badge */}
      {preset.recommended && (
        <div style={{
          position: "absolute",
          top: isMobile ? -10 : -12,
          right: isMobile ? 12 : 16,
          background: colors.brand,
          color: colors.white,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
          padding: "3px 10px",
          borderRadius: radii.pill,
          letterSpacing: 0.5,
          boxShadow: `0 2px 8px ${colors.brand}44`,
        }}>
          {preset.tagline}
        </div>
      )}

      {/* Header row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
      }}>
        <span style={{ fontSize: isMobile ? 28 : 32, lineHeight: 1 }}>{preset.icon}</span>
        <div>
          <div style={{
            fontSize: isMobile ? fontSize["2xl"] : fontSize["3xl"],
            fontWeight: fontWeight.bold,
            color: preset.color,
            lineHeight: 1.2,
          }}>
            {preset.name}
          </div>
          {!preset.recommended && (
            <div style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              color: colors.textMuted,
              textTransform: "uppercase" as const,
              letterSpacing: 0.5,
              marginTop: 2,
            }}>
              {preset.tagline}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p style={{
        margin: 0,
        fontSize: isMobile ? fontSize.base : fontSize.lg,
        color: colors.textDark,
        lineHeight: 1.5,
      }}>
        {preset.description}
      </p>

      {/* Example box */}
      <div style={{
        background: `${preset.color}08`,
        border: `1px solid ${preset.color}20`,
        borderRadius: radii.lg,
        padding: `${spacing.sm}px ${spacing.md}px`,
        fontSize: isMobile ? fontSize.sm : fontSize.md,
        color: colors.textMuted,
        fontFamily: "monospace",
        lineHeight: 1.6,
      }}>
        {preset.example}
      </div>
    </button>
  );
}

// ── Phase Section (Collapsible) ──────────────────────────────

function PhaseSection({
  phase,
  phaseIndex,
  isOpen,
  onToggle,
  isScoreBased,
  isCustom,
  isMobile,
  onUpdatePhase,
  recommendedStructural,
  scalingEnabled,
}: {
  phase: PhasePickConfig;
  phaseIndex: number;
  isOpen: boolean;
  onToggle: () => void;
  isScoreBased: boolean;
  isCustom: boolean;
  isMobile: boolean;
  onUpdatePhase: (index: number, updated: PhasePickConfig) => void;
  // Suggested values for the SIMPLE / Estratega structural fields,
  // already pre-multiplied by the active per-phase multiplier. Used
  // as the "Sugerido: X" badge target — when the host modifies the
  // input the badge appears with this value and is clickable to
  // restore. For CUSTOM / score-based presets the caller can pass
  // undefined and the section falls back to its prior hardcoded
  // recommendations.
  recommendedStructural?: {
    pointsPerExactPosition: number;
    bonusPerfectGroup: number;
    pointsPerCorrectAdvance: number;
  };
  // When scaling is ON, per-phase point inputs are read-only — the
  // values are derived from `base × multiplier` and would be
  // overwritten on the next multiplier change anyway. The host must
  // disable scaling to edit phase-by-phase.
  scalingEnabled: boolean;
}) {
  const isGroup = !phase.requiresScore && phase.structuralPicks?.type === "GROUP_STANDINGS";
  const isKnockoutStructural = !phase.requiresScore && phase.structuralPicks?.type === "KNOCKOUT_WINNER";
  const phaseIsKnockout = !isGroup;

  // Count active criteria for badge
  const activeCriteria = isScoreBased
    ? (phase.matchPicks?.types.filter(t => t.enabled && t.points > 0).length ?? 0)
    : 1;

  const totalPoints = isScoreBased
    ? (phase.matchPicks?.types.reduce((sum, t) => sum + (t.enabled ? t.points : 0), 0) ?? 0)
    : 0;

  // Handle match pick type toggle
  const handleToggleCriterion = (key: MatchPickTypeKey) => {
    if (!isCustom || !phase.matchPicks) return;
    const updated = {
      ...phase,
      matchPicks: {
        ...phase.matchPicks,
        types: phase.matchPicks.types.map(t =>
          t.key === key ? { ...t, enabled: !t.enabled } : t
        ),
      },
    };
    onUpdatePhase(phaseIndex, updated);
  };

  // Handle points change
  const handlePointsChange = (key: MatchPickTypeKey, points: number) => {
    if (!phase.matchPicks) return;
    const updated = {
      ...phase,
      matchPicks: {
        ...phase.matchPicks,
        types: phase.matchPicks.types.map(t =>
          t.key === key ? { ...t, points: Math.max(0, points) } : t
        ),
      },
    };
    onUpdatePhase(phaseIndex, updated);
  };

  // Handle structural pick changes
  const handleStructuralChange = (field: string, value: number | boolean) => {
    if (!phase.structuralPicks) return;
    const updated = {
      ...phase,
      structuralPicks: {
        ...phase.structuralPicks,
        config: { ...phase.structuralPicks.config, [field]: value },
      },
    };
    onUpdatePhase(phaseIndex, updated);
  };

  return (
    <div style={{
      border: `1px solid ${isOpen ? colors.brand + "40" : colors.borderLight}`,
      borderRadius: radii["2xl"],
      overflow: "hidden",
      transition: "border-color 0.2s ease",
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${spacing.md}px ${spacing.lg}px`,
          background: isOpen ? colors.brandBg : colors.bgLighter,
          border: "none",
          cursor: "pointer",
          transition: "background 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <span style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.semibold,
            color: colors.text,
          }}>
            {phase.phaseName}
          </span>
          {isScoreBased && (
            <span style={{
              fontSize: fontSize.xs,
              padding: "2px 8px",
              borderRadius: radii.pill,
              background: colors.brandBg,
              color: colors.brand,
              fontWeight: fontWeight.semibold,
            }}>
              {activeCriteria} criterios · {totalPoints}pts max
            </span>
          )}
        </div>
        <span style={{
          fontSize: fontSize["2xl"],
          color: colors.textMuted,
          transform: isOpen ? "rotate(180deg)" : "rotate(0)",
          transition: "transform 0.2s ease",
          lineHeight: 1,
        }}>
          ▾
        </span>
      </button>

      {/* Content */}
      {isOpen && (
        <div style={{
          padding: isMobile ? spacing.md : spacing.lg,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}>
          {/* Scaling-locked banner — explains to the host why the inputs
              below are read-only when "Puntos progresivos" is active. */}
          {scalingEnabled && (
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: spacing.sm,
              padding: `${spacing.sm}px ${spacing.md}px`,
              background: colors.infoBgLight,
              border: `1px solid ${colors.infoBorder}`,
              borderRadius: radii.lg,
              fontSize: fontSize.xs,
              color: colors.infoDarker,
              lineHeight: 1.4,
            }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>🔒</span>
              <span>
                Valores calculados automáticamente desde la base por multiplicador.
                Desactiva <strong>Puntos progresivos</strong> arriba para editar fase por fase.
              </span>
            </div>
          )}

          {/* ── CUSTOM: Pick type selector (Marcadores vs Posiciones) ── */}
          {isCustom && (
            <div style={{
              display: "flex",
              gap: spacing.md,
              marginBottom: spacing.sm,
            }}>
              <button
                type="button"
                onClick={() => {
                  if (phase.requiresScore) return; // already selected
                  const updated: PhasePickConfig = {
                    ...phase,
                    requiresScore: true,
                    structuralPicks: undefined,
                    matchPicks: {
                      types: [
                        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: phaseIsKnockout ? 10 : 5 },
                        { key: "HOME_GOALS", enabled: true, points: phaseIsKnockout ? 4 : 2 },
                        { key: "AWAY_GOALS", enabled: true, points: phaseIsKnockout ? 4 : 2 },
                        { key: "GOAL_DIFFERENCE", enabled: true, points: phaseIsKnockout ? 2 : 1 },
                        { key: "EXACT_SCORE", enabled: false, points: 0 },
                        { key: "TOTAL_GOALS", enabled: false, points: 0 },
                        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
                      ],
                    },
                  };
                  onUpdatePhase(phaseIndex, updated);
                }}
                style={{
                  flex: 1,
                  padding: `${spacing.md}px ${spacing.lg}px`,
                  borderRadius: radii.xl,
                  border: phase.requiresScore
                    ? `2px solid ${colors.brand}`
                    : `1px solid ${colors.borderMedium}`,
                  background: phase.requiresScore ? colors.brandBg : colors.white,
                  cursor: "pointer",
                  textAlign: "center" as const,
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>🎯</div>
                <div style={{
                  fontSize: fontSize.base,
                  fontWeight: phase.requiresScore ? fontWeight.bold : fontWeight.medium,
                  color: phase.requiresScore ? colors.brand : colors.textDark,
                }}>
                  Marcadores
                </div>
                <div style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 }}>
                  Predicen el resultado de cada partido
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!phase.requiresScore) return; // already selected
                  const isGroupPhase = phase.phaseId.includes("group") || phase.phaseName.toLowerCase().includes("grupo");
                  // Strip `includeExtraTime` when switching to structural:
                  // the structural scoring engines (GROUP_STANDINGS and
                  // KNOCKOUT_WINNER) derive the advancer directly from the
                  // final winner including penalties, so an ET-vs-90' toggle
                  // has no effect and just clutters the persisted config.
                  const updated: PhasePickConfig = {
                    ...phase,
                    requiresScore: false,
                    matchPicks: undefined,
                    includeExtraTime: undefined,
                    structuralPicks: isGroupPhase
                      ? { type: "GROUP_STANDINGS", config: { pointsPerExactPosition: 10, bonusPerfectGroup: 20, includeGlobalQualifiers: false } }
                      : { type: "KNOCKOUT_WINNER", config: { pointsPerCorrectAdvance: 15 } },
                  };
                  onUpdatePhase(phaseIndex, updated);
                }}
                style={{
                  flex: 1,
                  padding: `${spacing.md}px ${spacing.lg}px`,
                  borderRadius: radii.xl,
                  border: !phase.requiresScore
                    ? `2px solid ${colors.brand}`
                    : `1px solid ${colors.borderMedium}`,
                  background: !phase.requiresScore ? colors.brandBg : colors.white,
                  cursor: "pointer",
                  textAlign: "center" as const,
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>📊</div>
                <div style={{
                  fontSize: fontSize.base,
                  fontWeight: !phase.requiresScore ? fontWeight.bold : fontWeight.medium,
                  color: !phase.requiresScore ? colors.brand : colors.textDark,
                }}>
                  Posiciones
                </div>
                <div style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 }}>
                  {isGroup ? "Ordenan equipos en el grupo" : "Eligen quién avanza"}
                </div>
              </button>
            </div>
          )}

          {/* Score-based criteria rows */}
          {isScoreBased && phase.matchPicks?.types.map((t) => {
            const meta = CRITERION_META[t.key];
            const recommended = phaseIsKnockout ? meta.recKnockout : meta.recGroup;
            const showRecBadge = t.enabled && t.points > 0 && recommended > 0 && t.points !== recommended;

            return (
              <div
                key={t.key}
                style={{
                  display: "flex",
                  alignItems: isMobile ? "flex-start" : "center",
                  flexDirection: isMobile ? "column" : "row",
                  gap: isMobile ? spacing.sm : spacing.md,
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  background: t.enabled ? colors.white : colors.bgLighter,
                  border: `1px solid ${t.enabled ? colors.borderLight : colors.borderLighter}`,
                  borderRadius: radii.lg,
                  opacity: t.enabled ? 1 : 0.6,
                  transition: "all 0.2s ease",
                }}
              >
                {/* Toggle + Labels */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.md,
                  flex: 1,
                  width: isMobile ? "100%" : undefined,
                }}>
                  {/* Toggle switch */}
                  {isCustom && (
                    <div
                      onClick={() => handleToggleCriterion(t.key)}
                      style={{
                        position: "relative",
                        width: 40,
                        height: 22,
                        borderRadius: radii.pill,
                        background: t.enabled ? colors.brand : colors.disabled,
                        cursor: "pointer",
                        transition: "background 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: "absolute",
                        top: 2,
                        left: t.enabled ? 20 : 2,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: colors.white,
                        boxShadow: shadows.sm,
                        transition: "left 0.2s ease",
                      }} />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                      color: colors.text,
                      lineHeight: 1.3,
                    }}>
                      {meta.label}
                    </div>
                    <div style={{
                      fontSize: fontSize.sm,
                      color: colors.textMuted,
                      lineHeight: 1.4,
                    }}>
                      {meta.description}
                    </div>
                  </div>
                </div>

                {/* Points input + recommended badge */}
                {t.enabled && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacing.sm,
                    width: isMobile ? "100%" : undefined,
                    justifyContent: isMobile ? "flex-end" : undefined,
                  }}>
                    {showRecBadge && !scalingEnabled && (
                      <span style={{
                        fontSize: fontSize.xs,
                        color: colors.warningDarker,
                        background: colors.warningBgAmber,
                        padding: "2px 6px",
                        borderRadius: radii.sm,
                        fontWeight: fontWeight.medium,
                        whiteSpace: "nowrap" as const,
                      }}>
                        Sugerido: {recommended}
                      </span>
                    )}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={t.points}
                        onChange={(e) => handlePointsChange(t.key, parseInt(e.target.value) || 0)}
                        disabled={scalingEnabled}
                        title={scalingEnabled ? "Desactiva 'Puntos progresivos' para editar manualmente" : undefined}
                        style={{
                          width: 60,
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          borderRadius: radii.md,
                          border: `1px solid ${colors.borderMedium}`,
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                          textAlign: "center" as const,
                          color: scalingEnabled ? colors.textMuted : colors.text,
                          background: scalingEnabled ? colors.bgLighter : colors.white,
                          outline: "none",
                          cursor: scalingEnabled ? "not-allowed" : "text",
                        }}
                      />
                      <span style={{
                        fontSize: fontSize.sm,
                        color: colors.textMuted,
                        fontWeight: fontWeight.medium,
                      }}>
                        pts
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Structural picks: GROUP_STANDINGS */}
          {isGroup && phase.structuralPicks && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              <StructuralInput
                label="Puntos por posicion exacta"
                description="Puntos por cada equipo que ubiques en su posicion correcta"
                value={(phase.structuralPicks.config as GroupStandingsConfig).pointsPerExactPosition ?? 10}
                onChange={(v) => handleStructuralChange("pointsPerExactPosition", v)}
                isCustom={isCustom}
                recommended={recommendedStructural?.pointsPerExactPosition ?? 10}
                isMobile={isMobile}
                scalingEnabled={scalingEnabled}
              />
              <StructuralInput
                label="Bonus grupo perfecto"
                description="Bonus extra si aciertas las 4 posiciones del grupo"
                value={(phase.structuralPicks.config as GroupStandingsConfig).bonusPerfectGroup ?? 20}
                onChange={(v) => handleStructuralChange("bonusPerfectGroup", v)}
                isCustom={isCustom}
                recommended={recommendedStructural?.bonusPerfectGroup ?? 20}
                isMobile={isMobile}
                scalingEnabled={scalingEnabled}
              />
            </div>
          )}

          {/* Structural picks: KNOCKOUT_WINNER */}
          {isKnockoutStructural && phase.structuralPicks && (
            <StructuralInput
              label="Puntos por acierto"
              description="Puntos por acertar que equipo avanza en esta ronda"
              value={(phase.structuralPicks.config as KnockoutWinnerConfig).pointsPerCorrectAdvance ?? 15}
              onChange={(v) => handleStructuralChange("pointsPerCorrectAdvance", v)}
              isCustom={isCustom}
              recommended={recommendedStructural?.pointsPerCorrectAdvance ?? 15}
              isMobile={isMobile}
              scalingEnabled={scalingEnabled}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Structural Input Row ─────────────────────────────────────

function StructuralInput({
  label,
  description,
  value,
  onChange,
  isCustom,
  recommended,
  isMobile,
  scalingEnabled,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  isCustom: boolean;
  recommended: number;
  isMobile: boolean;
  // When scaling is active the value is derived from base × multiplier,
  // so the input is read-only and the "Sugerido" restore-badge is hidden
  // (it would conflict with the auto-derived value).
  scalingEnabled: boolean;
}) {
  const showRecBadge = value !== recommended && !scalingEnabled;

  return (
    <div style={{
      display: "flex",
      alignItems: isMobile ? "flex-start" : "center",
      flexDirection: isMobile ? "column" : "row",
      gap: isMobile ? spacing.sm : spacing.md,
      padding: `${spacing.sm}px ${spacing.md}px`,
      background: colors.white,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: radii.lg,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: fontSize.base,
          fontWeight: fontWeight.semibold,
          color: colors.text,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: fontSize.sm,
          color: colors.textMuted,
        }}>
          {description}
        </div>
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.sm,
        width: isMobile ? "100%" : undefined,
        justifyContent: isMobile ? "flex-end" : undefined,
      }}>
        {showRecBadge && (
          // Click to restore the suggested value. Clickable badge gives
          // the host a fast "oops, undo my change" affordance without
          // forcing them to retype the number.
          <button
            type="button"
            onClick={() => onChange(recommended)}
            title={`Restaurar al valor sugerido (${recommended})`}
            style={{
              fontSize: fontSize.xs,
              color: colors.warningDarker,
              background: colors.warningBgAmber,
              padding: "2px 8px",
              borderRadius: radii.sm,
              fontWeight: fontWeight.medium,
              whiteSpace: "nowrap" as const,
              border: `1px solid ${colors.warningBorderLight}`,
              cursor: "pointer",
              lineHeight: 1.4,
            }}
          >
            Sugerido: {recommended}
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            min={0}
            max={999}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            disabled={scalingEnabled}
            title={scalingEnabled ? "Desactiva 'Puntos progresivos' para editar manualmente" : undefined}
            style={{
              width: 60,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              borderRadius: radii.md,
              border: `1px solid ${colors.borderMedium}`,
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              textAlign: "center" as const,
              color: scalingEnabled ? colors.textMuted : colors.text,
              background: scalingEnabled ? colors.bgLighter : colors.white,
              outline: "none",
              cursor: scalingEnabled ? "not-allowed" : "text",
            }}
          />
          <span style={{
            fontSize: fontSize.sm,
            color: colors.textMuted,
            fontWeight: fontWeight.medium,
          }}>
            pts
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Interactive Example Calculator ───────────────────────────

function ExampleCalculator({
  scoringConfig,
  isMobile,
}: {
  scoringConfig: PoolPickTypesConfig;
  isMobile: boolean;
}) {
  const [realHome, setRealHome] = useState(2);
  const [realAway, setRealAway] = useState(1);
  const [predHome, setPredHome] = useState(3);
  const [predAway, setPredAway] = useState(1);

  const scorePhases = scoringConfig.filter(p => p.requiresScore && p.matchPicks);
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0);

  if (scorePhases.length === 0) return null;
  const examplePhase = scorePhases[selectedPhaseIdx] ?? scorePhases[0];
  if (!examplePhase?.matchPicks) return null;

  const results = calculateScore(
    realHome, realAway,
    predHome, predAway,
    examplePhase.matchPicks.types,
  );

  const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
  const maxPoints = results.reduce((sum, r) => sum + (r.hit ? r.points : 0) + (!r.hit ? r.points : 0), 0);
  const hasHits = results.some(r => r.hit);

  return (
    <div style={{
      background: colors.bgLighter,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: radii["2xl"],
      padding: isMobile ? spacing.md : spacing.lg,
    }}>
      {/* Title */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.md,
      }}>
        <span style={{ fontSize: 20 }}>{"\u{1F9EE}"}</span>
        <span style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
          color: colors.text,
        }}>
          Calculadora de Ejemplo
        </span>
      </div>

      {/* Phase selector */}
      {scorePhases.length > 1 && (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: spacing.md,
        }}>
          {scorePhases.map((p, i) => (
            <button
              key={p.phaseId}
              onClick={() => setSelectedPhaseIdx(i)}
              style={{
                padding: "4px 12px",
                borderRadius: radii.pill,
                fontSize: fontSize.xs,
                fontWeight: i === selectedPhaseIdx ? fontWeight.bold : fontWeight.medium,
                border: `1px solid ${i === selectedPhaseIdx ? colors.brand : colors.borderLight}`,
                background: i === selectedPhaseIdx ? `${colors.brand}15` : colors.white,
                color: i === selectedPhaseIdx ? colors.brand : colors.textMuted,
                cursor: "pointer",
              }}
            >
              {p.phaseName}
            </button>
          ))}
        </div>
      )}

      {/* Input rows */}
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: spacing.md,
        marginBottom: spacing.md,
      }}>
        {/* Real result */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: spacing.sm,
          background: colors.white,
          padding: `${spacing.sm}px ${spacing.md}px`,
          borderRadius: radii.lg,
          border: `1px solid ${colors.borderLight}`,
        }}>
          <span style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.textMuted,
            whiteSpace: "nowrap" as const,
            minWidth: isMobile ? 60 : 90,
          }}>
            Resultado:
          </span>
          <ScoreInput value={realHome} onChange={setRealHome} />
          <span style={{ fontWeight: fontWeight.bold, color: colors.textMuted }}>-</span>
          <ScoreInput value={realAway} onChange={setRealAway} />
        </div>

        {/* Prediction */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: spacing.sm,
          background: colors.white,
          padding: `${spacing.sm}px ${spacing.md}px`,
          borderRadius: radii.lg,
          border: `1px solid ${colors.brandLight}40`,
        }}>
          <span style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.brand,
            whiteSpace: "nowrap" as const,
            minWidth: isMobile ? 60 : 90,
          }}>
            Prediccion:
          </span>
          <ScoreInput value={predHome} onChange={setPredHome} accent />
          <span style={{ fontWeight: fontWeight.bold, color: colors.brand }}>-</span>
          <ScoreInput value={predAway} onChange={setPredAway} accent />
        </div>
      </div>

      {/* Results breakdown */}
      {results.length > 0 && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginBottom: spacing.md,
        }}>
          {results.map((r) => (
            <div
              key={r.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: `${spacing.xs}px ${spacing.sm}px`,
                borderRadius: radii.md,
                background: r.hit ? colors.successBgAlt : colors.errorBg,
                border: `1px solid ${r.hit ? colors.successBorder : colors.errorBorder}`,
              }}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
              }}>
                <span style={{ fontSize: 16 }}>{r.hit ? "\u2705" : "\u274C"}</span>
                <span style={{
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.medium,
                  color: r.hit ? colors.successDarker : colors.errorDark,
                }}>
                  {r.label}
                </span>
              </div>
              <span style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.bold,
                color: r.hit ? colors.successDarker : colors.errorDark,
              }}>
                {r.hit ? `+${r.points}` : "0"} pts
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${spacing.sm}px ${spacing.md}px`,
        background: hasHits ? colors.brand : colors.bgLight,
        borderRadius: radii.lg,
        border: hasHits ? "none" : `1px solid ${colors.borderLight}`,
      }}>
        <span style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
          color: hasHits ? colors.white : colors.textMuted,
        }}>
          Total
        </span>
        <span style={{
          fontSize: fontSize["3xl"],
          fontWeight: fontWeight.extrabold,
          color: hasHits ? colors.white : colors.textMuted,
        }}>
          {totalPoints} pts
        </span>
      </div>
    </div>
  );
}

// ── Score Input (small number) ───────────────────────────────

function ScoreInput({
  value,
  onChange,
  accent = false,
}: {
  value: number;
  onChange: (v: number) => void;
  accent?: boolean;
}) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      value={value}
      onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
      style={{
        width: 52,
        height: 40,
        padding: "4px 2px",
        borderRadius: radii.md,
        border: `2px solid ${accent ? colors.brandLight : colors.borderMedium}`,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        textAlign: "center" as const,
        color: accent ? colors.brand : colors.text,
        background: accent ? `${colors.brand}08` : colors.white,
        outline: "none",
        MozAppearance: "textfield" as never,
        WebkitAppearance: "none" as never,
      }}
    />
  );
}

// ── Preset Summary ────────────────────────────────────────────
function PresetSummary({ scoringConfig, scoringStyle, isScoreBased, scalingEnabled, isMobile }: {
  scoringConfig: PoolPickTypesConfig;
  scoringStyle: string | null;
  isScoreBased: boolean;
  scalingEnabled: boolean;
  isMobile: boolean;
}) {
  const t = useTranslations("poolWizard");

  // Get enabled criteria keys from first score-based phase
  const firstScorePhase = scoringConfig.find((p) => p.matchPicks);
  const enabledCriteria = firstScorePhase?.matchPicks?.types.filter(
    (type) => type.enabled && type.key !== "EXACT_SCORE" && type.key !== "PARTIAL_SCORE"
  ) ?? [];

  // Abbreviate phase names for table header
  const phaseLabel = (name: string) => {
    if (name.length <= 8) return name;
    const words = name.split(" ");
    if (words.length >= 2) return words.map(w => w.slice(0, 4)).join(" ");
    return name.slice(0, 8);
  };

  return (
    <div style={{
      padding: spacing.md,
      borderRadius: radii.lg,
      border: `1px solid ${colors.borderLight}`,
      background: colors.white,
      display: "flex",
      flexDirection: "column",
      gap: spacing.md,
    }}>
      {/* Score-based: criteria table by phase */}
      {isScoreBased && enabledCriteria.length > 0 && (
        <div>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textDark, marginBottom: 10 }}>
            {t("scoring.activeCriteria")}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 11 : 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: colors.textMuted, fontWeight: 600, borderBottom: `2px solid ${colors.borderLight}` }}>
                    {t("scoring.criterionHeader", { defaultMessage: "Criterio" })}
                  </th>
                  {scoringConfig.filter(p => p.matchPicks).map((phase) => (
                    <th key={phase.phaseId} style={{
                      textAlign: "center", padding: "6px 4px",
                      color: colors.textMuted, fontWeight: 600, fontSize: isMobile ? 10 : 11,
                      borderBottom: `2px solid ${colors.borderLight}`,
                      whiteSpace: "nowrap",
                    }}>
                      {phaseLabel(phase.phaseName)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enabledCriteria.map((criterion) => (
                  <tr key={criterion.key}>
                    <td style={{
                      padding: "7px 8px", color: colors.textDark, fontWeight: 500,
                      borderBottom: `1px solid ${colors.borderLight}`,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ color: colors.successAlt, fontSize: 12 }}>✓</span>
                      {t(`scoring.criteria.${criterion.key}`)}
                    </td>
                    {scoringConfig.filter(p => p.matchPicks).map((phase) => {
                      const pt = phase.matchPicks?.types.find(t => t.key === criterion.key);
                      return (
                        <td key={phase.phaseId} style={{
                          textAlign: "center", padding: "7px 4px",
                          fontWeight: 700, color: colors.brand,
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}>
                          {pt?.points ?? 0}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Structural picks summary for SIMPLE */}
      {!isScoreBased && (
        <div style={{ fontSize: fontSize.sm, color: colors.textDark, lineHeight: 1.5 }}>
          <span style={{ fontWeight: fontWeight.bold }}>
            {t("scoring.presets.SIMPLE.tagline")}
          </span>
          <br />
          {t("scoring.presets.SIMPLE.description")}
        </div>
      )}

      {/* Multiplier status */}
      {isScoreBased && scoringConfig.length > 1 && (
        <div style={{
          padding: `${spacing.sm}px ${spacing.md}px`,
          borderRadius: radii.md,
          background: colors.bgLighter,
          border: `1px solid ${colors.borderLight}`,
          fontSize: fontSize.sm,
          lineHeight: 1.5,
          color: colors.textMuted,
        }}>
          <span style={{ fontWeight: fontWeight.bold, color: colors.textDark }}>
            📈 {t("scoring.multiplierLabel")}:
          </span>{" "}
          <span style={{ fontWeight: fontWeight.bold, color: scalingEnabled ? colors.successAlt : colors.textDark }}>
            {scalingEnabled ? t("scoring.etEnabledLabel") : t("scoring.etDisabledLabel")}
          </span>
          {" — "}
          {scalingEnabled ? t("scoring.multiplierOn") : t("scoring.multiplierOff")}
        </div>
      )}

      {/* Extra time status — hidden for SIMPLE because the Estratega
          doesn't use the score itself, it uses the resolved advancer. */}
      {isScoreBased && (() => {
        const etEnabled = scoringConfig.some(
          (p) => p.phaseId !== "group_stage" && !p.phaseId.includes("group") && p.includeExtraTime
        );
        return (
          <div style={{
            padding: `${spacing.sm}px ${spacing.md}px`,
            borderRadius: radii.md,
            background: colors.bgLighter,
            border: `1px solid ${colors.borderLight}`,
            fontSize: fontSize.sm,
            lineHeight: 1.5,
            color: colors.textMuted,
          }}>
            <span style={{ fontWeight: fontWeight.bold, color: colors.textDark }}>
              ⏱️ {t("scoring.extraTimeStatus")}:
            </span>{" "}
            <span style={{ fontWeight: fontWeight.bold, color: etEnabled ? colors.successAlt : colors.textDark }}>
              {etEnabled ? t("scoring.etEnabledLabel") : t("scoring.etDisabledLabel")}
            </span>
            {" — "}
            {etEnabled ? t("scoring.extraTimeEnabled") : t("scoring.extraTimeDefault")}
          </div>
        );
      })()}

      {/* Calculator inline for presets */}
      {isScoreBased && (
        <ExampleCalculator
          scoringConfig={scoringConfig}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

// ── Extra Time Section ────────────────────────────────────────
function ExtraTimeSection({ knockoutPhases, scoringConfig, dispatch, isCustom, isMobile }: {
  knockoutPhases: PoolPickTypesConfig;
  scoringConfig: PoolPickTypesConfig;
  dispatch: (action: { type: "UPDATE_SCORING_CONFIG"; config: PoolPickTypesConfig }) => void;
  isCustom: boolean;
  isMobile: boolean;
}) {
  const t = useTranslations("poolWizard");
  const [expanded, setExpanded] = useState(false);

  function toggleExtraTime(phaseId: string) {
    const updated = scoringConfig.map((p) =>
      p.phaseId === phaseId
        ? { ...p, includeExtraTime: !p.includeExtraTime }
        : p
    );
    dispatch({ type: "UPDATE_SCORING_CONFIG", config: updated });
  }

  const allDisabled = knockoutPhases.every((p) => !p.includeExtraTime);

  // For presets (not custom), show a compact summary that can expand
  // For custom, always show expanded
  if (!isCustom && !expanded) {
    return (
      <div style={{
        padding: spacing.md,
        borderRadius: radii.lg,
        border: `1px solid ${colors.borderLight}`,
        background: colors.bgLighter,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: "pointer",
      }}
        onClick={() => setExpanded(true)}
      >
        <div>
          <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textDark }}>
            {t("advancedRules.extraTimeTitle")}
          </div>
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
            {allDisabled
              ? t("advancedRules.offExplanationTitle") + " (" + t("advancedRules.recommended") + ")"
              : t("advancedRules.onExplanationTitle")}
          </div>
        </div>
        <span style={{ fontSize: 12, color: colors.brand, fontWeight: fontWeight.semibold }}>
          {t("scoring.advancedOptions")} ▼
        </span>
      </div>
    );
  }

  return (
    <div style={{
      padding: spacing.md,
      borderRadius: radii.lg,
      border: `1px solid ${colors.borderLight}`,
      background: colors.bgLighter,
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.md,
      }}>
        <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textDark }}>
          {t("advancedRules.extraTimeTitle")}
        </div>
        {!isCustom && (
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: "none",
              border: "none",
              fontSize: 12,
              color: colors.brand,
              fontWeight: fontWeight.semibold,
              cursor: "pointer",
            }}
          >
            ▲ {t("scoring.collapse")}
          </button>
        )}
      </div>

      <div style={{ fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 1.5 }}>
        {t("advancedRules.extraTimeDesc")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
        {knockoutPhases.map((phase) => (
          <div key={phase.phaseId} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: `${spacing.sm}px ${spacing.md}px`,
            borderRadius: radii.lg,
            background: colors.white,
            border: `1px solid ${colors.borderLight}`,
          }}>
            <div>
              <span style={{ fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.textDark }}>
                {phase.phaseName}
              </span>
              {!phase.includeExtraTime && (
                <span style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: fontWeight.bold,
                  color: colors.successAlt,
                  background: colors.successBgLight,
                  padding: "2px 6px",
                  borderRadius: 99,
                }}>
                  {t("advancedRules.recommended")}
                </span>
              )}
            </div>
            <ToggleSwitch
              checked={!!phase.includeExtraTime}
              onChange={() => toggleExtraTime(phase.phaseId)}
              size="small"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export function StepScoring() {
  const { state, dispatch } = useWizard();
  const isMobile = useIsMobile();
  const t = useTranslations("poolWizard");

  const { scoringStyle, scoringConfig, instancePhases } = state;

  // Track which phase sections are open
  const [openPhases, setOpenPhases] = useState<Record<number, boolean>>({ 0: true });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scalingEnabled, setScalingEnabled] = useState(true);

  // Editable multipliers per phase
  const DEFAULT_MULTIPLIERS: Record<string, number> = {
    group_stage: 1.0, group: 1.0,
    r32_leg1: 1.5, r32_leg2: 1.5, round_of_32: 1.5, r32: 1.5,
    r16_leg1: 2.0, r16_leg2: 2.0, round_of_16: 2.0, r16: 2.0,
    qf_leg1: 2.5, qf_leg2: 2.5, quarter_finals: 2.5, qf: 2.5,
    sf_leg1: 3.0, sf_leg2: 3.0, semi_finals: 3.0, sf: 3.0,
    third_place: 3.0,
    final: 4.0, finals: 4.0,
  };

  function getDefaultMultiplier(phaseId: string): number {
    const lower = phaseId.toLowerCase();
    for (const [key, mult] of Object.entries(DEFAULT_MULTIPLIERS)) {
      if (lower.includes(key) || lower === key) return mult;
    }
    return 1.0;
  }

  const [phaseMultipliers, setPhaseMultipliers] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    scoringConfig.forEach(p => { m[p.phaseId] = getDefaultMultiplier(p.phaseId); });
    return m;
  });

  // Store base points (from first phase) when scaling is first enabled.
  // Used only by score-based presets (CUMULATIVE / CUSTOM). For SIMPLE
  // the per-criterion base lives in `structuralBase` below because its
  // first phase carries structural picks, not matchPicks.
  const [basePoints, setBasePoints] = useState<number[]>([]);

  // Base values for the SIMPLE preset's structural picks. The Estratega
  // applies the same per-phase multipliers the Predictor uses (×1, ×1.5,
  // ×2, ×2.5, ×3, ×4) on top of these. Group stage uses both the
  // per-position points and the perfect-group bonus; knockout phases
  // multiply `pointsPerCorrectAdvance`. Values are read every time the
  // multiplier changes so the rendered config = base × multiplier.
  const SIMPLE_BASE_POINTS_PER_POSITION = 10;
  const SIMPLE_BASE_PERFECT_GROUP_BONUS = 20;
  const SIMPLE_BASE_POINTS_PER_ADVANCE = 10;

  const isCustom = scoringStyle === "CUSTOM";
  const isScoreBased = scoringStyle === "CUMULATIVE" || scoringStyle === "BASIC" || scoringStyle === "CUSTOM";
  const isSimple = scoringStyle === "SIMPLE";
  const knockoutPhases = scoringConfig.filter(
    (p) => p.phaseId !== "group_stage" && !p.phaseId.includes("group")
  );

  const activePreset = PRESETS.find(p => p.key === scoringStyle);

  // Apply scaling with current multipliers. Handles both score-based
  // presets (where `base` is the per-criterion array of matchPicks
  // points from the first phase) and the SIMPLE / Estratega preset
  // (where each structural picks block is rescaled from the hardcoded
  // base constants above).
  const applyScaling = useCallback((multipliers: Record<string, number>, base: number[]) => {
    const newConfig = scoringConfig.map((phase) => {
      const mult = multipliers[phase.phaseId] ?? 1.0;

      // Score-based phases: scale every matchPicks criterion off the
      // base captured at preset selection time.
      if (phase.matchPicks && base.length > 0) {
        return {
          ...phase,
          matchPicks: {
            ...phase.matchPicks,
            types: phase.matchPicks.types.map((t, ti) => ({
              ...t,
              points: Math.round((base[ti] ?? t.points) * mult),
            })),
          },
        };
      }

      // SIMPLE / Estratega: scale the structural picks fields against
      // the canonical Estratega base constants.
      if (phase.structuralPicks?.type === "GROUP_STANDINGS") {
        const cfg = phase.structuralPicks.config as Record<string, unknown> & {
          pointsPerExactPosition?: number;
          bonusPerfectGroup?: number;
        };
        return {
          ...phase,
          structuralPicks: {
            ...phase.structuralPicks,
            config: {
              ...cfg,
              pointsPerExactPosition: Math.round(SIMPLE_BASE_POINTS_PER_POSITION * mult),
              bonusPerfectGroup: Math.round(SIMPLE_BASE_PERFECT_GROUP_BONUS * mult),
            },
          },
        };
      }
      if (phase.structuralPicks?.type === "KNOCKOUT_WINNER") {
        const cfg = phase.structuralPicks.config as Record<string, unknown> & {
          pointsPerCorrectAdvance?: number;
        };
        return {
          ...phase,
          structuralPicks: {
            ...phase.structuralPicks,
            config: {
              ...cfg,
              pointsPerCorrectAdvance: Math.round(SIMPLE_BASE_POINTS_PER_ADVANCE * mult),
            },
          },
        };
      }

      return phase;
    });
    dispatch({ type: "UPDATE_SCORING_CONFIG", config: newConfig });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoringConfig, dispatch]);

  // Toggle scaling on/off
  const handleToggleScaling = useCallback(() => {
    const newEnabled = !scalingEnabled;
    setScalingEnabled(newEnabled);

    if (newEnabled) {
      // Capture base points from first phase
      const firstPhase = scoringConfig[0];
      const bp = firstPhase?.matchPicks?.types.map(t => t.points) ?? [];
      setBasePoints(bp);

      // Initialize multipliers with defaults
      const mults: Record<string, number> = {};
      scoringConfig.forEach(p => { mults[p.phaseId] = getDefaultMultiplier(p.phaseId); });
      setPhaseMultipliers(mults);

      // Apply
      applyScaling(mults, bp);
    } else {
      // Reset all phases to base points
      if (basePoints.length > 0) {
        const newConfig = scoringConfig.map((phase) => {
          if (!phase.matchPicks) return phase;
          return {
            ...phase,
            matchPicks: {
              ...phase.matchPicks,
              types: phase.matchPicks.types.map((t, ti) => ({
                ...t,
                points: basePoints[ti] ?? t.points,
              })),
            },
          };
        });
        dispatch({ type: "UPDATE_SCORING_CONFIG", config: newConfig });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scalingEnabled, scoringConfig, dispatch]);

  // Handle multiplier change for a specific phase
  const handleMultiplierChange = useCallback((phaseId: string, value: number) => {
    const newMults = { ...phaseMultipliers, [phaseId]: value };
    setPhaseMultipliers(newMults);
    applyScaling(newMults, basePoints);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseMultipliers, basePoints]);

  // Handle preset selection
  const handleSelectPreset = useCallback((key: PickConfigPresetKey) => {
    const config = generatePresetConfig(key, instancePhases);
    setOpenPhases({ 0: true });
    setScalingEnabled(true);

    // Capture base points from first phase
    const bp = config[0]?.matchPicks?.types.map(t => t.points) ?? [];
    setBasePoints(bp);

    // Initialize multipliers with defaults
    const mults: Record<string, number> = {};
    config.forEach(p => { mults[p.phaseId] = getDefaultMultiplier(p.phaseId); });
    setPhaseMultipliers(mults);

    // Apply scaling to the generated config — handles both score-based
    // (matchPicks scaled off `bp`) and SIMPLE (structural picks scaled
    // off the canonical Estratega base constants).
    const scaledConfig = config.map((phase) => {
      const mult = mults[phase.phaseId] ?? 1;

      if (phase.matchPicks) {
        return {
          ...phase,
          matchPicks: {
            ...phase.matchPicks,
            types: phase.matchPicks.types.map((t, ti) => ({
              ...t,
              points: Math.round((bp[ti] ?? t.points) * mult),
            })),
          },
        };
      }

      if (phase.structuralPicks?.type === "GROUP_STANDINGS") {
        const cfg = phase.structuralPicks.config as Record<string, unknown> & {
          pointsPerExactPosition?: number;
          bonusPerfectGroup?: number;
        };
        return {
          ...phase,
          structuralPicks: {
            ...phase.structuralPicks,
            config: {
              ...cfg,
              pointsPerExactPosition: Math.round(SIMPLE_BASE_POINTS_PER_POSITION * mult),
              bonusPerfectGroup: Math.round(SIMPLE_BASE_PERFECT_GROUP_BONUS * mult),
            },
          },
        };
      }
      if (phase.structuralPicks?.type === "KNOCKOUT_WINNER") {
        const cfg = phase.structuralPicks.config as Record<string, unknown> & {
          pointsPerCorrectAdvance?: number;
        };
        return {
          ...phase,
          structuralPicks: {
            ...phase.structuralPicks,
            config: {
              ...cfg,
              pointsPerCorrectAdvance: Math.round(SIMPLE_BASE_POINTS_PER_ADVANCE * mult),
            },
          },
        };
      }

      return phase;
    });

    dispatch({ type: "SET_SCORING", style: key, config: scaledConfig });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instancePhases, dispatch]);

  // Handle going back to preset selection
  const handleChangePreset = useCallback(() => {
    dispatch({ type: "SET_SCORING", style: null as unknown as PickConfigPresetKey, config: [] });
    setScalingEnabled(false);
  }, [dispatch]);

  // Handle phase config updates
  const handleUpdatePhase = useCallback((index: number, updated: PhasePickConfig) => {
    const newConfig = [...scoringConfig];
    newConfig[index] = updated;
    dispatch({ type: "UPDATE_SCORING_CONFIG", config: newConfig });
  }, [scoringConfig, dispatch]);

  // Toggle phase section
  const togglePhase = useCallback((index: number) => {
    setOpenPhases(prev => ({ ...prev, [index]: !prev[index] }));
  }, []);

  // ── View 1: Preset Selection ──────────────────────────────

  if (!scoringStyle) {
    return (
      <PoolWizardStepContainer
        title={t("scoring.title", { defaultMessage: "Sistema de Puntuacion" })}
        subtitle={t("scoring.subtitle", { defaultMessage: "Elige como se calcularan los puntos en tu quiniela" })}
        icon={"\u{1F3B2}"}
      >
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? spacing.lg : spacing.xl,
        }}>
          {PRESETS.map((preset) => (
            <PresetCard
              key={preset.key}
              preset={preset}
              isMobile={isMobile}
              onSelect={() => handleSelectPreset(preset.key)}
            />
          ))}

          {/* Tip at the bottom */}
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: spacing.sm,
            padding: spacing.md,
            background: colors.infoBgLight,
            borderRadius: radii.lg,
            border: `1px solid ${colors.infoBorder}`,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{"\u{1F4A1}"}</span>
            <p style={{
              margin: 0,
              fontSize: fontSize.sm,
              color: colors.infoDarker,
              lineHeight: 1.5,
            }}>
              {t("scoring.tip", {
                defaultMessage:
                  "Si es tu primera vez, te recomendamos \"Predictor\". " +
                  "Premia conocimiento parcial y mantiene a todos competitivos hasta el final.",
              })}
            </p>
          </div>
        </div>
      </PoolWizardStepContainer>
    );
  }

  // ── View 2: Configuration Editor ──────────────────────────

  return (
    <PoolWizardStepContainer
      title={t("scoring.configTitle", { defaultMessage: "Configurar Puntuacion" })}
      subtitle={t("scoring.configSubtitle", {
        defaultMessage: "Revisa y ajusta como se otorgan los puntos en cada fase",
      })}
      icon={activePreset?.icon ?? "\u{1F3B2}"}
    >
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? spacing.lg : spacing.xl,
      }}>
        {/* Active preset header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${spacing.sm}px ${spacing.md}px`,
          background: activePreset ? activePreset.bgColor : colors.bgLighter,
          borderRadius: radii.lg,
          border: `1px solid ${activePreset ? activePreset.borderColor + "30" : colors.borderLight}`,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
          }}>
            <span style={{ fontSize: 22 }}>{activePreset?.icon}</span>
            <div>
              <span style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
                color: activePreset?.color ?? colors.text,
              }}>
                Estilo: {activePreset?.name}
              </span>
              {!isCustom && (
                <div style={{
                  fontSize: fontSize.xs,
                  color: colors.textMuted,
                }}>
                  Los valores vienen preconfigurados. Cambia a Personalizado para editar.
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleChangePreset}
            style={{
              padding: `${spacing.xs}px ${spacing.md}px`,
              borderRadius: radii.md,
              border: `1px solid ${colors.borderMedium}`,
              background: colors.white,
              color: colors.textDark,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              cursor: "pointer",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap" as const,
            }}
          >
            Cambiar
          </button>
        </div>

        {/* Preset summary — only for non-custom presets */}
        {!isCustom && scoringConfig.length > 0 && (
          <PresetSummary
            scoringConfig={scoringConfig}
            scoringStyle={scoringStyle}
            isScoreBased={isScoreBased}
            scalingEnabled={scalingEnabled}
            isMobile={isMobile}
          />
        )}

        {/* Advanced options — unified block */}
        <div style={{
          border: `1px solid ${colors.borderLight}`,
          borderRadius: radii.xl,
          background: colors.bgLighter,
          overflow: "hidden",
          display: isCustom || showAdvanced ? "block" : "block",
        }}>
          {/* Toggle header — only for presets */}
          {!isCustom && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: "100%",
                padding: `${spacing.md}px`,
                background: "transparent",
                border: "none",
                borderBottom: showAdvanced ? `1px solid ${colors.borderLight}` : "none",
                color: colors.brand,
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {showAdvanced ? "▲" : "▼"} {t("scoring.advancedOptions")}
            </button>
          )}

          {(isCustom || showAdvanced) && (<>

        {/* Scaling toggle — also available for SIMPLE / Estratega so the
            host can dial knockout-phase weight up or down. The Estratega's
            base values multiply against the same per-phase factors the
            Predictor uses (×1, ×1.5, ×2, ×2.5, ×3, ×4). */}
        {(isScoreBased || isSimple) && scoringConfig.length > 1 && (
          <div style={{
            padding: `${spacing.md}px ${spacing.lg}px`,
            borderBottom: `1px solid ${colors.borderLight}`,
          }}>
            {/* Header row with toggle */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: scalingEnabled ? spacing.md : 0,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.sm,
                  marginBottom: 4,
                }}>
                  <span style={{ fontSize: 18 }}>📈</span>
                  <span style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.bold,
                    color: colors.text,
                  }}>
                    Puntos progresivos
                  </span>
                </div>
                <div style={{
                  fontSize: fontSize.sm,
                  color: colors.textMuted,
                  lineHeight: 1.5,
                }}>
                  {scalingEnabled
                    ? "Los puntos de cada fase se multiplican respecto a los valores de grupo. Ajusta los multiplicadores a tu gusto."
                    : "Activar para que los puntos valgan más en fases avanzadas. Ideal para premiar las predicciones más difíciles."
                  }
                </div>
              </div>
              <div style={{ marginLeft: spacing.md }}>
                <ToggleSwitch
                  checked={scalingEnabled}
                  onChange={handleToggleScaling}
                  size="small"
                />
              </div>
            </div>

            {/* Editable multipliers per phase */}
            {scalingEnabled && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: `${spacing.sm}px 0`,
              }}>
                {/* Restore defaults button */}
                {scoringConfig.some(p => (phaseMultipliers[p.phaseId] ?? 1) !== getDefaultMultiplier(p.phaseId)) && (
                  <button
                    onClick={() => {
                      const mults: Record<string, number> = {};
                      scoringConfig.forEach(p => { mults[p.phaseId] = getDefaultMultiplier(p.phaseId); });
                      setPhaseMultipliers(mults);
                      applyScaling(mults, basePoints);
                    }}
                    style={{
                      alignSelf: "flex-end",
                      padding: "4px 12px",
                      borderRadius: radii.pill,
                      border: `1px solid ${colors.brand}`,
                      background: `${colors.brand}08`,
                      color: colors.brand,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      cursor: "pointer",
                    }}
                  >
                    ↺ Restaurar recomendados
                  </button>
                )}
                {scoringConfig.map((p) => {
                  const mult = phaseMultipliers[p.phaseId] ?? 1.0;
                  const suggested = getDefaultMultiplier(p.phaseId);
                  const isModified = mult !== suggested;
                  const barWidth = Math.min((mult / 3.0) * 100, 100);
                  return (
                    <div key={p.phaseId} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: spacing.sm,
                      padding: `8px ${spacing.md}px`,
                      background: colors.white,
                      border: `1px solid ${colors.borderLight}`,
                      borderRadius: radii.lg,
                      position: "relative",
                      overflow: "hidden",
                    }}>
                      {/* Progress bar background */}
                      <div style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${barWidth}%`,
                        background: `${colors.brand}08`,
                        transition: "width 0.3s ease",
                      }} />

                      {/* Phase name */}
                      <span style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.medium,
                        color: colors.text,
                        flex: 1,
                        position: "relative",
                        zIndex: 1,
                      }}>
                        {p.phaseName}
                      </span>

                      {/* Stepper controls */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        position: "relative",
                        zIndex: 1,
                      }}>
                        <button
                          onClick={() => handleMultiplierChange(p.phaseId, Math.max(0.5, mult - 0.5))}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: radii.sm,
                            border: `1px solid ${colors.borderLight}`,
                            background: colors.bgLighter,
                            color: colors.textMuted,
                            fontSize: 16,
                            fontWeight: fontWeight.bold,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            lineHeight: 1,
                          }}
                        >−</button>
                        <div
                          style={{
                            minWidth: 52,
                            height: 28,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: fontSize.base,
                            fontWeight: fontWeight.bold,
                            color: mult > 1 ? colors.brand : colors.textMuted,
                            cursor: isModified ? "pointer" : "default",
                          }}
                          title={isModified ? `Sugerido: ×${suggested}` : undefined}
                          onClick={isModified ? () => handleMultiplierChange(p.phaseId, suggested) : undefined}
                        >
                          ×{mult}
                        </div>
                        <button
                          onClick={() => handleMultiplierChange(p.phaseId, Math.min(10, mult + 0.5))}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: radii.sm,
                            border: `1px solid ${colors.borderLight}`,
                            background: colors.bgLighter,
                            color: colors.textMuted,
                            fontSize: 16,
                            fontWeight: fontWeight.bold,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            lineHeight: 1,
                          }}
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Extra time toggle — only meaningful when scoring depends on
            the match score. SIMPLE / Estratega derives the advancer from
            the final winner (incl. penalties) directly, and any knockout
            phase set to structural in CUSTOM does the same. So the toggle
            is hidden unless at least one knockout phase actually uses
            matchPicks. */}
        {(() => {
          const scoreBasedKnockouts = knockoutPhases.filter((p) => p.requiresScore);
          if (isSimple || scoreBasedKnockouts.length === 0) return null;
          return isCustom ? (
            <ExtraTimeSection
              knockoutPhases={scoreBasedKnockouts}
              scoringConfig={scoringConfig}
              dispatch={dispatch}
              isCustom={true}
              isMobile={isMobile}
            />
          ) : (
            <div style={{
              padding: `${spacing.md}px ${spacing.lg}px`,
              borderBottom: `1px solid ${colors.borderLight}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sm, flex: 1 }}>
                <span style={{ fontSize: 18 }}>⏱️</span>
                <div>
                  <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text }}>
                    {t("advancedRules.extraTimeTitle")}
                  </div>
                  <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                    {t("scoring.extraTimeGlobalDesc")}
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={scoreBasedKnockouts.some((p) => p.includeExtraTime)}
                onChange={() => {
                  const newValue = !scoreBasedKnockouts.some((p) => p.includeExtraTime);
                  // Only flip ET for score-based knockouts; structural
                  // phases keep includeExtraTime=undefined (it does
                  // nothing for them anyway).
                  const updated = scoringConfig.map((p) => {
                    const isGroupPhase = p.phaseId === "group_stage" || p.phaseId.includes("group");
                    if (isGroupPhase) return p;
                    if (!p.requiresScore) return p;
                    return { ...p, includeExtraTime: newValue };
                  });
                  dispatch({ type: "UPDATE_SCORING_CONFIG", config: updated });
                }}
                size="small"
              />
            </div>
          );
        })()}

        {/* Phase sections */}
        {(
          <div style={{
            padding: `${spacing.md}px ${spacing.lg}px`,
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
              <span style={{ fontSize: 18 }}>⚙️</span>
              <div>
                <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text }}>
                  Configuración por fase
                </div>
                <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                  {scoringConfig.length} fases
                </div>
              </div>
            </div>

            {scoringConfig.map((phase, i) => {
              const mult = scalingEnabled
                ? (phaseMultipliers[phase.phaseId] ?? getDefaultMultiplier(phase.phaseId))
                : 1;
              // Suggested values for structural-pick fields. For SIMPLE we
              // multiply the canonical Estratega base by the current
              // phase multiplier so the badge accurately reflects "what
              // this phase would be if you hadn't touched it".
              const recommendedStructural = {
                pointsPerExactPosition: Math.round(SIMPLE_BASE_POINTS_PER_POSITION * mult),
                bonusPerfectGroup: Math.round(SIMPLE_BASE_PERFECT_GROUP_BONUS * mult),
                pointsPerCorrectAdvance: Math.round(SIMPLE_BASE_POINTS_PER_ADVANCE * mult),
              };
              return (
                <PhaseSection
                  key={phase.phaseId}
                  phase={phase}
                  phaseIndex={i}
                  isOpen={!!openPhases[i]}
                  onToggle={() => togglePhase(i)}
                  isScoreBased={isScoreBased && phase.requiresScore}
                  isCustom={isCustom}
                  isMobile={isMobile}
                  onUpdatePhase={handleUpdatePhase}
                  recommendedStructural={recommendedStructural}
                  scalingEnabled={scalingEnabled}
                />
              );
            })}
          </div>
        )}

        </>)}
        </div>

        {/* Interactive calculator — only for CUSTOM (presets show it in PresetSummary) */}
        {isCustom && isScoreBased && (
          <ExampleCalculator
            scoringConfig={scoringConfig}
            isMobile={isMobile}
          />
        )}

        {/* SIMPLE preset summary */}
        {isSimple && (
          <div style={{
            background: "#fefce8",
            border: `1px solid ${colors.warningBorder}`,
            borderRadius: radii.lg,
            padding: spacing.md,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: spacing.sm,
            }}>
              <span style={{ fontSize: 18 }}>{"\u{1F9E0}"}</span>
              <span style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.bold,
                color: colors.warningDarker,
              }}>
                Modo Estratega
              </span>
            </div>
            <p style={{
              margin: 0,
              fontSize: fontSize.sm,
              color: colors.warningDark,
              lineHeight: 1.6,
            }}>
              En este modo no se pronostican marcadores. En fase de grupos ordenas los equipos de cada grupo
              y en eliminatorias solo eliges quien avanza. Es mas rapido de completar y requiere menos
              mantenimiento por parte del administrador.
            </p>
          </div>
        )}
      </div>
    </PoolWizardStepContainer>
  );
}

export default StepScoring;
