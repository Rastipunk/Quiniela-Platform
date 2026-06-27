"use client";

import { useTranslations } from "next-intl";
import { manualAdvancePhase } from "@/lib/api";
import type { PoolOverview } from "@/lib/api";
import type { PhaseData } from "../poolTypes";
import { formatPhaseFullName, derivePhaseState, type PhaseUiState } from "../poolHelpers";
import { useIsMobile, TOUCH_TARGET } from "@/hooks/useIsMobile";
import {
  colors, fontSize, fontWeight, radii, spacing,
  adminSectionStyle, adminHeadingStyle,
} from "@/lib/theme";

export interface PhaseStatusPanelProps {
  poolId: string;
  token: string;
  overview: PoolOverview;
  phases: PhaseData[];
  getPhaseStatus: (phaseId: string) => string;
  hasPhaseAdvanced: (phaseId: string) => boolean;
  nextPhaseMap: Record<string, string | null>;
  busyKey: string | null;
  setBusyKey: (key: string | null) => void;
  setError: (error: string | null) => void;
  friendlyError: (e: any) => string;
  reload: () => Promise<void>;
}

export function PhaseStatusPanel({
  poolId, token, overview, phases,
  getPhaseStatus, hasPhaseAdvanced, nextPhaseMap,
  busyKey, setBusyKey, setError, friendlyError, reload,
}: PhaseStatusPanelProps) {
  const t = useTranslations("pool");
  const isMobile = useIsMobile();

  return (
    <div style={adminSectionStyle}>
      <h4 style={adminHeadingStyle}>
        📊 {t("admin.phasePanel.title")}
      </h4>
      <div style={{ display: "grid", gap: 10 }}>
        {phases.map((phase: any) => {
          const status = getPhaseStatus(phase.id);
          const phaseMatches = overview.matches.filter((m: any) => m.phaseId === phase.id);
          const completedMatches = phaseMatches.filter((m: any) => m.result).length;
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
          const sc = meta;

          return (
            <div
              key={phase.id}
              style={{
                padding: 14,
                background: colors.white,
                borderRadius: radii.lg,
                border: `2px solid ${sc.border}`,
                display: "flex",
                // Mobile: stack info over actions so the action buttons
                // never overflow the viewport. Desktop: side-by-side.
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "space-between",
                alignItems: isMobile ? "stretch" : "center",
                gap: 12
              }}
            >
              {/* minWidth:0 lets this flex child shrink so the title row
                  wraps instead of forcing horizontal overflow. */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{meta.icon}</span>
                  <span style={{ fontWeight: fontWeight.bold, fontSize: fontSize.lg, color: colors.textDark }}>{formatPhaseFullName(phase.id, t)}</span>
                </div>
                <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                  {t("admin.phasePanel.matchesProgress", { completed: completedMatches, total: totalMatches, percent: progress.toFixed(0) })}
                </div>
                {status !== "PENDING" && (
                  <div style={{ marginTop: 6, background: colors.borderLighter, borderRadius: radii.sm, height: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${progress}%`,
                      background: status === "COMPLETED" ? colors.info : colors.success,
                      transition: "width 0.3s"
                    }} />
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", ...(isMobile ? { width: "100%" } : {}) }}>
                {/* Advance is only meaningful once every match in the
                    phase has a result — keep it gated to COMPLETED. */}
                {status === "COMPLETED" && !hasPhaseAdvanced(phase.id) && nextPhaseMap[phase.id] && (
                  <button
                    disabled={busyKey === `advance:${phase.id}`}
                    onClick={async () => {
                      if (!token || !poolId) return;
                      setBusyKey(`advance:${phase.id}`);
                      setError(null);
                      try {
                        const result = await manualAdvancePhase(token, poolId, phase.id);
                        await reload();
                        alert(`✅ ${t("admin.phasePanel.advanceSuccess")}: ${result.message || ''}`);
                      } catch (err: any) {
                        setError(friendlyError(err));
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: radii.lg,
                      border: `1px solid ${colors.blue}`,
                      background: busyKey === `advance:${phase.id}` ? colors.disabled : colors.blue,
                      color: colors.white,
                      cursor: busyKey === `advance:${phase.id}` ? "wait" : "pointer",
                      fontSize: fontSize.md,
                      fontWeight: fontWeight.semibold,
                      whiteSpace: "nowrap",
                      ...(isMobile ? { flex: 1, minHeight: TOUCH_TARGET.minimum } : {})
                    }}
                  >
                    {busyKey === `advance:${phase.id}` ? `⏳ ${t("admin.phasePanel.advancing")}` : `🚀 ${t("admin.phasePanel.advanceButton")}`}
                  </button>
                )}
                {status === "COMPLETED" && hasPhaseAdvanced(phase.id) && (
                  <span style={{
                    padding: "6px 12px",
                    borderRadius: radii.lg,
                    background: colors.successBg,
                    border: `1px solid ${colors.success}`,
                    color: colors.successDark,
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.semibold,
                    whiteSpace: "nowrap",
                    ...(isMobile ? { flex: 1, textAlign: "center" as const } : {})
                  }}>
                    ✓ {t("admin.phasePanel.alreadyAdvanced")}
                  </span>
                )}
                {/* Phase state INDICATOR (ADR-084) — informational, not a button.
                    Apertura/bloqueo se controla desde el Gestor de fases (admin). */}
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
