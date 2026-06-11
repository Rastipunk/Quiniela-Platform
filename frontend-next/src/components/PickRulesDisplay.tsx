"use client";

// Componente para mostrar las reglas de picks en PoolPage
// Sprint 2 - Advanced Pick Types System

import { useTranslations, useLocale } from "next-intl";
import { colors } from "@/lib/theme";
import type { PoolPickTypesConfig } from "../types/pickConfig";
import { formatMatchDateTime } from "../lib/timezone";
import { formatPhaseFullName } from "@/app/[locale]/(authenticated)/pools/[poolId]/components/poolHelpers";

interface StructuralConfig {
  lockDateTime: string;
  pointsPosition1: number;
  pointsPosition2: number;
  pointsPosition3: number;
  pointsPosition4: number;
  pointsPerExactPosition: number;
  bonusPerfectGroupEnabled: boolean;
  bonusPerfectGroup: number;
  includeGlobalQualifiers: boolean;
  globalQualifiersPoints: number;
  totalQualifiers: number;
  pointsPerCorrectAdvance: number;
  [key: string]: unknown;
}

type PickRulesDisplayProps = {
  pickTypesConfig: PoolPickTypesConfig;
  poolDeadlineMinutes: number;
  poolTimeZone: string;
};

export function PickRulesDisplay({
  pickTypesConfig,
  poolDeadlineMinutes,
  poolTimeZone,
}: PickRulesDisplayProps) {
  const t = useTranslations("pool");
  const locale = useLocale();
  // next-intl doesn't support computed keys at type level
  const tDynamic = t as (key: string) => string;

  // Guard: verificar que pickTypesConfig es un array válido
  if (!pickTypesConfig || !Array.isArray(pickTypesConfig)) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: colors.textMuted }}>
        {t("configNoRules")}
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem 0" }}>
      <div style={{
        background: colors.brandGradient,
        padding: "1.5rem",
        borderRadius: 12,
        marginBottom: "2rem",
        color: "white"
      }}>
        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: 24, fontWeight: 900 }}>
          📜 {t("rulesHeader")}
        </h3>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "white" }}>
          {t("rulesSubheader")}
        </p>
      </div>

      {pickTypesConfig.map((phase, index) => (
        <div
          key={phase.phaseId}
          style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            background: "white",
            borderRadius: 12,
            border: "2px solid #e9ecef",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: "1rem",
            paddingBottom: "0.75rem",
            borderBottom: "2px solid #007bff"
          }}>
            <span style={{
              fontSize: 28,
              background: colors.brand,
              color: "white",
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900
            }}>
              {index + 1}
            </span>
            <h4 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: colors.brand }}>
              {(formatPhaseFullName(phase.phaseId, t) || phase.phaseName || `${t("phase")} ${index + 1}`).toUpperCase()}
            </h4>
          </div>

          {phase.requiresScore && phase.matchPicks ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t("predictionType")}:</span>{" "}
                <span
                  style={{
                    background: colors.successBg,
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "1px solid #c3e6cb",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  📝 {t("matchScores")}
                </span>
              </div>

              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>{t("rulesDisplay.howToEarnPoints")}:</strong>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {phase.matchPicks.types
                  .filter((tp) => tp.enabled)
                  .map((type) => (
                    <div
                      key={type.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        background: "white",
                        borderRadius: 8,
                        border: "1px solid #dee2e6",
                      }}
                    >
                      <span style={{ fontSize: 20, fontWeight: 900, color: colors.success, minWidth: 50, textAlign: "right" }}>
                        {type.points}
                      </span>
                      <span style={{ fontSize: 14 }}>
                        {t("points")} - <strong>{tDynamic(`pickTypeNames.${type.key}`)}</strong>{" "}
                        <span style={{ color: colors.textMuted, fontSize: 13 }}>{tDynamic(`pickTypeDescriptions.${type.key}`)}</span>
                      </span>
                    </div>
                  ))}
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: colors.warningBg,
                  borderRadius: 8,
                  border: "1px solid #ffeeba",
                }}
              >
                <div style={{ fontSize: 13, color: colors.warningDark }}>
                  ⏰ <b>{t("deadlineInfo")}:</b> {t("deadlineMinutes", { minutes: poolDeadlineMinutes })} ({t("timezoneInfo", { timezone: poolTimeZone })})
                </div>
              </div>
            </>
          ) : phase.structuralPicks ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t("predictionType")}:</span>{" "}
                <span
                  style={{
                    background: colors.warningBg,
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "1px solid #ffeeba",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  📊 {t("rulesDisplay.noScores")}
                </span>
              </div>

              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>{t("rulesDisplay.howToEarnPoints")}:</strong>
              </div>

              {phase.structuralPicks.type === "GROUP_STANDINGS" && (() => {
                const cfg = phase.structuralPicks!.config as StructuralConfig;
                return (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "white",
                    borderRadius: 8,
                    border: "1px solid #dee2e6",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    📋 <strong>{t("rulesDisplay.groupStandingsTitle")}</strong>
                  </div>
                  {/* Soportar nuevo formato (pointsPosition1-4) y legacy (pointsPerExactPosition) */}
                  {cfg.pointsPosition1 !== undefined ? (
                    <>
                      <div style={{ color: colors.textMuted, fontSize: 13 }}>
                        • 🥇 {t("rulesDisplay.positionPoints1", { points: cfg.pointsPosition1 })}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: 13 }}>
                        • 🥈 {t("rulesDisplay.positionPoints2", { points: cfg.pointsPosition2 })}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: 13 }}>
                        • 🥉 {t("rulesDisplay.positionPoints3", { points: cfg.pointsPosition3 })}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: 13 }}>
                        • 4️⃣ {t("rulesDisplay.positionPoints4", { points: cfg.pointsPosition4 })}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: colors.textMuted, fontSize: 13 }}>
                      • {t("rulesDisplay.ptsPerExactPosition", { points: cfg.pointsPerExactPosition })}
                    </div>
                  )}
                  {/* Bonus por grupo perfecto - soporta nuevo formato (bonusPerfectGroupEnabled) y legacy */}
                  {(cfg.bonusPerfectGroupEnabled ?? cfg.bonusPerfectGroup) && cfg.bonusPerfectGroup && (
                    <div style={{ color: colors.textMuted, fontSize: 13 }}>
                      • 🎯 {t("rulesDisplay.bonusPerfectGroupPts", { points: cfg.bonusPerfectGroup })}
                    </div>
                  )}
                  {cfg.includeGlobalQualifiers && (
                    <div style={{ color: colors.textMuted, fontSize: 13 }}>
                      • {t("rulesDisplay.globalQualifiersAdditional", { points: cfg.globalQualifiersPoints })}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      background: colors.warningBg,
                      borderRadius: 8,
                      border: "1px solid #ffeeba",
                    }}
                  >
                    <div style={{ fontSize: 13, color: colors.warningDark }}>
                      ⏰ <b>{t("deadlineInfo")}:</b> {t("rulesDisplay.groupDeadlineNote", { minutes: poolDeadlineMinutes })}
                    </div>
                  </div>
                </div>
                );
              })()}

              {phase.structuralPicks.type === "GLOBAL_QUALIFIERS" && (() => {
                const cfg = phase.structuralPicks!.config as StructuralConfig;
                return (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "white",
                    borderRadius: 8,
                    border: "1px solid #dee2e6",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    🌍 <strong>{t("rulesDisplay.globalQualifiersTitle")}</strong>
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: 13 }}>
                    • {t("rulesDisplay.predictTotalQualifiers", { total: cfg.totalQualifiers })}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: 13 }}>
                    • {t("rulesDisplay.ptsPerExactPosition", { points: cfg.pointsPerExactPosition })}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: colors.warningDark }}>
                    ⚠️ {t("rulesDisplay.lockDateWarning", { date: formatMatchDateTime(cfg.lockDateTime!, poolTimeZone, locale) })} ({t("timezoneInfo", { timezone: poolTimeZone })})
                  </div>
                </div>
                );
              })()}

              {phase.structuralPicks.type === "KNOCKOUT_WINNER" && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "white",
                    borderRadius: 8,
                    border: "1px solid #dee2e6",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    🎯 <strong>{t("rulesDisplay.knockoutWinnerTitle")}</strong>
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: 13 }}>
                    • {t("rulesDisplay.knockoutWinnerPoints", { points: (phase.structuralPicks.config as StructuralConfig).pointsPerCorrectAdvance })}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                    {t("rulesDisplay.knockoutWinnerNote")}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      background: colors.warningBg,
                      borderRadius: 8,
                      border: "1px solid #ffeeba",
                    }}
                  >
                    <div style={{ fontSize: 13, color: colors.warningDark }}>
                      ⏰ <b>{t("deadlineInfo")}:</b> {t("rulesDisplay.knockoutDeadlineNote", { minutes: poolDeadlineMinutes })}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      ))}

      {/* General Notes */}
      <div
        style={{
          marginTop: 24,
          padding: "1.5rem",
          background: colors.bgLight,
          borderRadius: 12,
          border: "2px solid #dee2e6",
        }}
      >
        <div style={{ fontSize: 15, color: colors.textDark, lineHeight: 1.8, fontWeight: 500 }}>
          <div style={{ marginBottom: 12, color: "#1a1a2e" }}>
            💡 <strong>{t("rulesDisplay.importantNotes")}:</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 24, color: colors.textDark }}>
            <li>{t("rulesDisplay.notePhaseRules")}</li>
            <li>{t("rulesDisplay.noteReadCarefully")}</li>
            <li>{t("rulesDisplay.notePointsIncrease")}</li>
            {isCumulativeScoringFromConfig(pickTypesConfig) ? (
              <li style={{ color: colors.successDark, background: colors.successBg, padding: "8px 12px", borderRadius: 6, marginTop: 8, marginBottom: 8, listStyle: "none", marginLeft: -24 }}>
                {t.rich("rulesDisplay.cumulativeSystem", { strong: (chunks) => <strong>{chunks}</strong> })}
              </li>
            ) : (
              <li>{t("rulesDisplay.nonCumulativeNote")}</li>
            )}
            <li>{t.rich("rulesDisplay.deadlineNote", { strong: (chunks) => <strong style={{ color: "#c92a2a" }}>{chunks}</strong>, minutes: poolDeadlineMinutes })}</li>
            <li style={{ marginTop: 8 }}>{t.rich("rulesDisplay.tiebreakerNote", { strong: (chunks) => <strong>{chunks}</strong> })}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Detecta si la configuración usa el sistema acumulativo
 */
function isCumulativeScoring(types: { key: string; enabled: boolean }[]): boolean {
  return types.some((t) => t.enabled && (t.key === "HOME_GOALS" || t.key === "AWAY_GOALS"));
}

/**
 * Detecta si el pool completo usa el sistema acumulativo (revisa todas las fases)
 */
function isCumulativeScoringFromConfig(config: PoolPickTypesConfig): boolean {
  return config.some((phase) =>
    phase.requiresScore &&
    phase.matchPicks?.types &&
    isCumulativeScoring(phase.matchPicks.types)
  );
}
