"use client";

import { useTranslations } from "next-intl";
import type { PoolOverview } from "@/lib/api";
import type { PhaseData } from "../poolTypes";
import { formatPhaseFullName, derivePhaseState, type PhaseUiState } from "../poolHelpers";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  colors, fontSize, fontWeight, radii,
  adminSectionStyle, adminHeadingStyle,
} from "@/lib/theme";

// A match counts as "con resultado" only when its result is FINAL — provisional
// scraper scores (a match still live / pending ≥3-source confirmation) must NOT
// inflate the progress to 100% (mirrors backend FINAL_RESULT_SOURCES).
const FINAL_RESULT_SOURCES = new Set(["API_CONFIRMED", "HOST_OVERRIDE", "HOST_MANUAL"]);

export interface PhaseStatusPanelProps {
  overview: PoolOverview;
  phases: PhaseData[];
}

// Read-only phase status (ADR-084). Advancement is automatic (auto-advance) and
// release is controlled by the admin "Gestor de fases" — hosts no longer advance
// phases manually, so this panel only SHOWS state, it does not act.
export function PhaseStatusPanel({ overview, phases }: PhaseStatusPanelProps) {
  const t = useTranslations("pool");
  const isMobile = useIsMobile();

  return (
    <div style={adminSectionStyle}>
      <h4 style={adminHeadingStyle}>
        📊 {t("admin.phasePanel.title")}
      </h4>
      <div style={{ display: "grid", gap: 10 }}>
        {phases.map((phase: any) => {
          const phaseMatches = overview.matches.filter((m: any) => m.phaseId === phase.id);
          // Count only FINALIZED matches — provisional/live results don't count.
          const completedMatches = phaseMatches.filter(
            (m: any) => m.resultSource && FINAL_RESULT_SOURCES.has(m.resultSource),
          ).length;
          const totalMatches = phaseMatches.length;
          const progress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

          const st = derivePhaseState(phase.id, overview.matches, overview.tournamentInstance.knockoutRelease);
          const stateMap: Record<PhaseUiState, { label: string; bg: string; border: string; text: string; icon: string }> = {
            GROUP_ACTIVE: { label: t("phaseRelease.active"), bg: colors.successBg, border: colors.success, text: colors.successDark, icon: "⚽" },
            OPEN: { label: t("phaseRelease.open"), bg: colors.successBg, border: colors.success, text: colors.successDark, icon: "🟢" },
            CONFIRMING: { label: t("phaseRelease.confirming"), bg: colors.warningBg, border: colors.warning, text: colors.warningDark, icon: "⏳" },
            PENDING: { label: t("phaseRelease.pending"), bg: colors.warningBg, border: colors.warning, text: colors.warningDark, icon: "🔒" },
            FINALIZED: { label: t("phaseRelease.finalized"), bg: colors.infoBg, border: colors.info, text: colors.infoDark, icon: "✅" },
          };
          const meta = stateMap[st];

          return (
            <div
              key={phase.id}
              style={{
                padding: 14,
                background: colors.white,
                borderRadius: radii.lg,
                border: `2px solid ${meta.border}`,
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "space-between",
                alignItems: isMobile ? "stretch" : "center",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{meta.icon}</span>
                  <span style={{ fontWeight: fontWeight.bold, fontSize: fontSize.lg, color: colors.textDark }}>{formatPhaseFullName(phase.id, t)}</span>
                </div>
                <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                  {t("admin.phasePanel.matchesProgress", { completed: completedMatches, total: totalMatches, percent: progress.toFixed(0) })}
                </div>
                {st !== "PENDING" && (
                  <div style={{ marginTop: 6, background: colors.borderLighter, borderRadius: radii.sm, height: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${progress}%`,
                      background: st === "FINALIZED" ? colors.info : colors.success,
                      transition: "width 0.3s",
                    }} />
                  </div>
                )}
              </div>
              {/* Phase state INDICATOR (ADR-084) — informational, not a button.
                  Apertura/bloqueo se controla desde el Gestor de fases (admin). */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", ...(isMobile ? { width: "100%" } : {}) }}>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "8px 16px",
                    borderRadius: radii.lg,
                    border: `1px solid ${meta.border}`,
                    background: meta.bg,
                    color: meta.text,
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.bold,
                    whiteSpace: "nowrap",
                    ...(isMobile ? { flex: 1 } : {}),
                  }}
                >
                  {meta.icon} {meta.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
