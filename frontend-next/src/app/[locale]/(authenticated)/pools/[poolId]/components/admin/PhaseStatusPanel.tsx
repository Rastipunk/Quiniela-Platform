"use client";

import { useTranslations } from "next-intl";
import { manualAdvancePhase, lockPhase } from "@/lib/api";
import type { PoolOverview } from "@/lib/api";
import type { PhaseData } from "../poolTypes";
import { formatPhaseFullName } from "../poolHelpers";
import {
  colors, fontSize, fontWeight, radii, shadows, spacing,
  adminSectionStyle, adminHeadingStyle, badgeStyle,
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

          const statusColorMap = {
            PENDING: { bg: colors.warningBg, border: colors.warning, text: colors.warningDark, icon: "🔒" },
            ACTIVE: { bg: colors.successBg, border: colors.success, text: colors.successDark, icon: "⚽" },
            COMPLETED: { bg: colors.infoBg, border: colors.info, text: colors.infoDark, icon: "✅" }
          };

          const sc = statusColorMap[status as keyof typeof statusColorMap];

          return (
            <div
              key={phase.id}
              style={{
                padding: 14,
                background: colors.white,
                borderRadius: radii.lg,
                border: `2px solid ${sc.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{sc.icon}</span>
                  <span style={{ fontWeight: fontWeight.bold, fontSize: fontSize.lg, color: colors.textDark }}>{formatPhaseFullName(phase.id, t)}</span>
                  <span style={badgeStyle(sc.border, sc.bg, sc.text)}>
                    {status === "PENDING" && t("phaseStatus.PENDING")}
                    {status === "ACTIVE" && t("phaseStatus.ACTIVE")}
                    {status === "COMPLETED" && t("phaseStatus.COMPLETED")}
                  </span>
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
              {status === "COMPLETED" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {!hasPhaseAdvanced(phase.id) && nextPhaseMap[phase.id] && (
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
                        whiteSpace: "nowrap"
                      }}
                    >
                      {busyKey === `advance:${phase.id}` ? `⏳ ${t("admin.phasePanel.advancing")}` : `🚀 ${t("admin.phasePanel.advanceButton")}`}
                    </button>
                  )}
                  {hasPhaseAdvanced(phase.id) && (
                    <span style={{
                      padding: "6px 12px",
                      borderRadius: radii.lg,
                      background: colors.successBg,
                      border: `1px solid ${colors.success}`,
                      color: colors.successDark,
                      fontSize: fontSize.md,
                      fontWeight: fontWeight.semibold,
                      whiteSpace: "nowrap"
                    }}>
                      ✓ {t("admin.phasePanel.alreadyAdvanced")}
                    </span>
                  )}
                  <button
                    disabled={busyKey === `lock:${phase.id}`}
                    onClick={async () => {
                      if (!token || !poolId) return;
                      const isCurrentlyLocked = (overview.pool.lockedPhases || []).includes(phase.id);
                      setBusyKey(`lock:${phase.id}`);
                      setError(null);
                      try {
                        await lockPhase(token, poolId, phase.id, !isCurrentlyLocked);
                        await reload();
                        alert(isCurrentlyLocked ? `✅ ${t("admin.phasePanel.phaseUnlocked")}` : `🔒 ${t("admin.phasePanel.phaseLocked")}`);
                      } catch (err: any) {
                        setError(friendlyError(err));
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: radii.lg,
                      border: `1px solid ${(overview.pool.lockedPhases || []).includes(phase.id) ? colors.success : colors.warning}`,
                      background: busyKey === `lock:${phase.id}` ? colors.disabled : ((overview.pool.lockedPhases || []).includes(phase.id) ? colors.success : colors.warning),
                      color: colors.white,
                      cursor: busyKey === `lock:${phase.id}` ? "wait" : "pointer",
                      fontSize: fontSize.md,
                      fontWeight: fontWeight.semibold,
                      whiteSpace: "nowrap"
                    }}
                  >
                    {busyKey === `lock:${phase.id}`
                      ? `⏳ ${t("admin.phasePanel.processing")}`
                      : (overview.pool.lockedPhases || []).includes(phase.id)
                        ? `🔓 ${t("admin.phasePanel.unlockButton")}`
                        : `🔒 ${t("admin.phasePanel.lockButton")}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
