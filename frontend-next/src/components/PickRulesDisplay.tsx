"use client";

// Componente para mostrar las reglas de picks en PoolPage
// Sprint 2 - Advanced Pick Types System

import { useTranslations } from "next-intl";
import type { PoolPickTypesConfig } from "../types/pickConfig";

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

  // Guard: verificar que pickTypesConfig es un array válido
  if (!pickTypesConfig || !Array.isArray(pickTypesConfig)) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        {t("configNoRules")}
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem 0" }}>
      <div style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
              background: "#007bff",
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
            <h4 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#007bff" }}>
              {(phase.phaseName || (() => { const key = `phasesLong.${phase.phaseId}` as any; try { return t(key); } catch { return phase.phaseId.replace(/_/g, " "); } })() || `${t("phase")} ${index + 1}`).toUpperCase()}
            </h4>
          </div>

          {phase.requiresScore && phase.matchPicks ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t("predictionType")}:</span>{" "}
                <span
                  style={{
                    background: "#d4edda",
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
                      <span style={{ fontSize: 20, fontWeight: 900, color: "#28a745", minWidth: 50, textAlign: "right" }}>
                        {type.points}
                      </span>
                      <span style={{ fontSize: 14 }}>
                        {t("points")} - <strong>{t(`pickTypeNames.${type.key}` as any)}</strong>{" "}
                        <span style={{ color: "#666", fontSize: 13 }}>{t(`pickTypeDescriptions.${type.key}` as any)}</span>
                      </span>
                    </div>
                  ))}
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "#fff3cd",
                  borderRadius: 8,
                  border: "1px solid #ffeeba",
                }}
              >
                <div style={{ fontSize: 13, color: "#856404" }}>
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
                    background: "#fff3cd",
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

              {phase.structuralPicks.type === "GROUP_STANDINGS" && (
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
                  {(phase.structuralPicks.config as any).pointsPosition1 !== undefined ? (
                    <>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        • 🥇 {t("rulesDisplay.positionPoints1", { points: (phase.structuralPicks.config as any).pointsPosition1 })}
                      </div>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        • 🥈 {t("rulesDisplay.positionPoints2", { points: (phase.structuralPicks.config as any).pointsPosition2 })}
                      </div>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        • 🥉 {t("rulesDisplay.positionPoints3", { points: (phase.structuralPicks.config as any).pointsPosition3 })}
                      </div>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        • 4️⃣ {t("rulesDisplay.positionPoints4", { points: (phase.structuralPicks.config as any).pointsPosition4 })}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#666", fontSize: 13 }}>
                      • {t("rulesDisplay.ptsPerExactPosition", { points: (phase.structuralPicks.config as any).pointsPerExactPosition })}
                    </div>
                  )}
                  {/* Bonus por grupo perfecto - soporta nuevo formato (bonusPerfectGroupEnabled) y legacy */}
                  {((phase.structuralPicks.config as any).bonusPerfectGroupEnabled ?? (phase.structuralPicks.config as any).bonusPerfectGroup) && (phase.structuralPicks.config as any).bonusPerfectGroup && (
                    <div style={{ color: "#666", fontSize: 13 }}>
                      • 🎯 {t("rulesDisplay.bonusPerfectGroupPts", { points: (phase.structuralPicks.config as any).bonusPerfectGroup })}
                    </div>
                  )}
                  {(phase.structuralPicks.config as any).includeGlobalQualifiers && (
                    <div style={{ color: "#666", fontSize: 13 }}>
                      • {t("rulesDisplay.globalQualifiersAdditional", { points: (phase.structuralPicks.config as any).globalQualifiersPoints })}
                    </div>
                  )}
                </div>
              )}

              {phase.structuralPicks.type === "GLOBAL_QUALIFIERS" && (
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
                  <div style={{ color: "#666", fontSize: 13 }}>
                    • {t("rulesDisplay.predictTotalQualifiers", { total: (phase.structuralPicks.config as any).totalQualifiers })}
                  </div>
                  <div style={{ color: "#666", fontSize: 13 }}>
                    • {t("rulesDisplay.ptsPerExactPosition", { points: (phase.structuralPicks.config as any).pointsPerExactPosition })}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#856404" }}>
                    ⚠️ {t("rulesDisplay.lockDateWarning", { date: new Date((phase.structuralPicks.config as any).lockDateTime).toLocaleString() })}
                  </div>
                </div>
              )}

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
                  <div style={{ color: "#666", fontSize: 13 }}>
                    • {t("rulesDisplay.knockoutWinnerPoints", { points: (phase.structuralPicks.config as any).pointsPerCorrectAdvance })}
                  </div>
                  <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                    {t("rulesDisplay.knockoutWinnerNote")}
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
          background: "#f8f9fa",
          borderRadius: 12,
          border: "2px solid #dee2e6",
        }}
      >
        <div style={{ fontSize: 15, color: "#333", lineHeight: 1.8, fontWeight: 500 }}>
          <div style={{ marginBottom: 12, color: "#1a1a2e" }}>
            💡 <strong>{t("rulesDisplay.importantNotes")}:</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 24, color: "#444" }}>
            <li>{t("rulesDisplay.notePhaseRules")}</li>
            <li>{t("rulesDisplay.noteReadCarefully")}</li>
            <li>{t("rulesDisplay.notePointsIncrease")}</li>
            {isCumulativeScoringFromConfig(pickTypesConfig) ? (
              <li style={{ color: "#155724", background: "#d4edda", padding: "8px 12px", borderRadius: 6, marginTop: 8, marginBottom: 8, listStyle: "none", marginLeft: -24 }}>
                {t.rich("rulesDisplay.cumulativeSystem", { strong: (chunks) => <strong>{chunks}</strong> })}
              </li>
            ) : (
              <li>{t("rulesDisplay.nonCumulativeNote")}</li>
            )}
            <li>{t.rich("rulesDisplay.deadlineNote", { strong: (chunks) => <strong style={{ color: "#c92a2a" }}>{chunks}</strong>, minutes: poolDeadlineMinutes })}</li>
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
