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
    example: "Si dices 3-1 y sale 2-1 \u2192 Resultado \u2713 (5pts) + Visitante \u2713 (2pts) = 7pts",
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
    color: "#059669",
    bgColor: "rgba(5,150,105,0.06)",
    borderColor: "#059669",
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
    color: "#7c3aed",
    bgColor: "rgba(124,58,237,0.06)",
    borderColor: "#7c3aed",
  },
];

const CRITERION_META: Record<MatchPickTypeKey, { label: string; description: string; recGroup: number; recKnockout: number }> = {
  MATCH_OUTCOME_90MIN: { label: "Resultado", description: "Acertar ganador o empate", recGroup: 5, recKnockout: 10 },
  HOME_GOALS:          { label: "Goles Local", description: "Acertar goles del equipo local", recGroup: 2, recKnockout: 4 },
  AWAY_GOALS:          { label: "Goles Visitante", description: "Acertar goles del equipo visitante", recGroup: 2, recKnockout: 4 },
  GOAL_DIFFERENCE:     { label: "Diferencia de goles", description: "Acertar la diferencia entre ambos", recGroup: 1, recKnockout: 2 },
  EXACT_SCORE:         { label: "Marcador Exacto", description: "Bonus por acertar ambos marcadores", recGroup: 0, recKnockout: 0 },
  TOTAL_GOALS:         { label: "Total de Goles", description: "Acertar la suma total de goles", recGroup: 0, recKnockout: 0 },
  PARTIAL_SCORE:       { label: "Marcador Parcial", description: "Acertar uno de los dos marcadores", recGroup: 0, recKnockout: 0 },
};

// ── Preset Config Generator ──────────────────────────────────

function generatePresetConfig(
  presetKey: PickConfigPresetKey,
  phases: InstancePhase[],
): PoolPickTypesConfig {
  if (presetKey === "CUMULATIVE" || presetKey === "CUSTOM") {
    return phases.map((phase) => {
      const isKnockout = phase.type !== "GROUP";
      return {
        phaseId: phase.id,
        phaseName: phase.name,
        requiresScore: true,
        matchPicks: {
          types: [
            { key: "MATCH_OUTCOME_90MIN" as const, enabled: true, points: isKnockout ? 10 : 5 },
            { key: "HOME_GOALS" as const, enabled: true, points: isKnockout ? 4 : 2 },
            { key: "AWAY_GOALS" as const, enabled: true, points: isKnockout ? 4 : 2 },
            { key: "GOAL_DIFFERENCE" as const, enabled: true, points: isKnockout ? 2 : 1 },
            { key: "EXACT_SCORE" as const, enabled: false, points: 0 },
            { key: "TOTAL_GOALS" as const, enabled: false, points: 0 },
            { key: "PARTIAL_SCORE" as const, enabled: false, points: 0 },
          ],
        },
      };
    });
  }

  if (presetKey === "BASIC") {
    return phases.map((phase, index) => ({
      phaseId: phase.id,
      phaseName: phase.name,
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "EXACT_SCORE" as const, enabled: true, points: 20 + index * 10 },
          { key: "MATCH_OUTCOME_90MIN" as const, enabled: false, points: 0 },
          { key: "HOME_GOALS" as const, enabled: false, points: 0 },
          { key: "AWAY_GOALS" as const, enabled: false, points: 0 },
          { key: "GOAL_DIFFERENCE" as const, enabled: false, points: 0 },
          { key: "TOTAL_GOALS" as const, enabled: false, points: 0 },
          { key: "PARTIAL_SCORE" as const, enabled: false, points: 0 },
        ],
      },
    }));
  }

  // SIMPLE
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
            pointsPerCorrectAdvance: 15,
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
}: {
  phase: PhasePickConfig;
  phaseIndex: number;
  isOpen: boolean;
  onToggle: () => void;
  isScoreBased: boolean;
  isCustom: boolean;
  isMobile: boolean;
  onUpdatePhase: (index: number, updated: PhasePickConfig) => void;
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
                  const updated: PhasePickConfig = {
                    ...phase,
                    requiresScore: false,
                    matchPicks: undefined,
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
                    {showRecBadge && (
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
                        disabled={false}
                        style={{
                          width: 60,
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          borderRadius: radii.md,
                          border: `1px solid ${colors.borderMedium}`,
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                          textAlign: "center" as const,
                          color: colors.text,
                          background: colors.white,
                          outline: "none",
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
                recommended={10}
                isMobile={isMobile}
              />
              <StructuralInput
                label="Bonus grupo perfecto"
                description="Bonus extra si aciertas las 4 posiciones del grupo"
                value={(phase.structuralPicks.config as GroupStandingsConfig).bonusPerfectGroup ?? 20}
                onChange={(v) => handleStructuralChange("bonusPerfectGroup", v)}
                isCustom={isCustom}
                recommended={20}
                isMobile={isMobile}
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
              recommended={15}
              isMobile={isMobile}
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
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  isCustom: boolean;
  recommended: number;
  isMobile: boolean;
}) {
  const showRecBadge = value !== recommended;

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
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            min={0}
            max={999}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            disabled={false}
            style={{
              width: 60,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              borderRadius: radii.md,
              border: `1px solid ${colors.borderMedium}`,
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              textAlign: "center" as const,
              color: colors.text,
              background: colors.white,
              outline: "none",
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

// ── Main Component ───────────────────────────────────────────

export function StepScoring() {
  const { state, dispatch } = useWizard();
  const isMobile = useIsMobile();
  const t = useTranslations("poolWizard");

  const { scoringStyle, scoringConfig, instancePhases } = state;

  // Track which phase sections are open
  const [openPhases, setOpenPhases] = useState<Record<number, boolean>>({ 0: true });
  const [scalingEnabled, setScalingEnabled] = useState(false);

  // Editable multipliers per phase
  const DEFAULT_MULTIPLIERS: Record<string, number> = {
    group_stage: 1.0, group: 1.0,
    r32_leg1: 1.2, r32_leg2: 1.2, round_of_32: 1.2, r32: 1.2,
    r16_leg1: 1.5, r16_leg2: 1.5, round_of_16: 1.5, r16: 1.5,
    qf_leg1: 2.0, qf_leg2: 2.0, quarter_finals: 2.0, qf: 2.0,
    sf_leg1: 2.5, sf_leg2: 2.5, semi_finals: 2.5, sf: 2.5,
    third_place: 2.5,
    final: 3.0, finals: 3.0,
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

  // Store base points (from first phase) when scaling is first enabled
  const [basePoints, setBasePoints] = useState<number[]>([]);

  const isCustom = scoringStyle === "CUSTOM";
  const isScoreBased = scoringStyle === "CUMULATIVE" || scoringStyle === "BASIC" || scoringStyle === "CUSTOM";
  const isSimple = scoringStyle === "SIMPLE";

  const activePreset = PRESETS.find(p => p.key === scoringStyle);

  // Apply scaling with current multipliers
  const applyScaling = useCallback((multipliers: Record<string, number>, base: number[]) => {
    if (base.length === 0) return;
    const newConfig = scoringConfig.map((phase) => {
      if (!phase.matchPicks) return phase;
      const mult = multipliers[phase.phaseId] ?? 1.0;
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
    });
    dispatch({ type: "UPDATE_SCORING_CONFIG", config: newConfig });
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
    dispatch({ type: "SET_SCORING", style: key, config });
    setOpenPhases({ 0: true });
    setScalingEnabled(false);
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

        {/* Scaling toggle */}
        {isScoreBased && scoringConfig.length > 1 && (
          <div style={{
            padding: `${spacing.md}px ${spacing.lg}px`,
            background: scalingEnabled ? `${colors.brand}06` : colors.bgLighter,
            border: `1px solid ${scalingEnabled ? `${colors.brand}25` : colors.borderLight}`,
            borderRadius: radii.xl,
            transition: "all 0.2s ease",
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
              <div
                onClick={handleToggleScaling}
                style={{
                  position: "relative",
                  width: 48,
                  height: 26,
                  borderRadius: radii.pill,
                  background: scalingEnabled ? colors.brand : colors.disabled,
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                  flexShrink: 0,
                  marginLeft: spacing.md,
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 3,
                  left: scalingEnabled ? 24 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: colors.white,
                  boxShadow: shadows.sm,
                  transition: "left 0.2s ease",
                }} />
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
                {scoringConfig.map((p) => {
                  const mult = phaseMultipliers[p.phaseId] ?? 1.0;
                  const isBase = mult === 1.0;
                  return (
                    <div key={p.phaseId} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: `6px ${spacing.md}px`,
                      background: isBase ? colors.white : `${colors.brand}08`,
                      border: `1px solid ${isBase ? colors.borderLight : `${colors.brand}20`}`,
                      borderRadius: radii.lg,
                    }}>
                      <span style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.medium,
                        color: colors.text,
                        flex: 1,
                      }}>
                        {p.phaseName}
                      </span>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}>
                        <span style={{
                          fontSize: fontSize.xs,
                          color: colors.textMuted,
                        }}>×</span>
                        <input
                          type="number"
                          min={0.5}
                          max={10}
                          step={0.5}
                          value={mult}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= 0.5 && v <= 10) {
                              handleMultiplierChange(p.phaseId, v);
                            }
                          }}
                          style={{
                            width: 56,
                            height: 32,
                            borderRadius: radii.md,
                            border: `1px solid ${isBase ? colors.borderMedium : colors.brand}`,
                            fontSize: fontSize.base,
                            fontWeight: fontWeight.bold,
                            textAlign: "center" as const,
                            color: isBase ? colors.textMuted : colors.brand,
                            background: colors.white,
                            outline: "none",
                          }}
                        />
                        {getDefaultMultiplier(p.phaseId) !== mult && (
                          <span style={{
                            fontSize: 10,
                            color: colors.textMuted,
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                          onClick={() => handleMultiplierChange(p.phaseId, getDefaultMultiplier(p.phaseId))}
                          >
                            (sug: ×{getDefaultMultiplier(p.phaseId)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Phase sections */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}>
          <div style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.textMuted,
            textTransform: "uppercase" as const,
            letterSpacing: 0.5,
          }}>
            Configuración por fase ({scoringConfig.length} fases)
          </div>

          {scoringConfig.map((phase, i) => (
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
            />
          ))}
        </div>

        {/* Interactive calculator — only for score-based presets */}
        {isScoreBased && (
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
