"use client";

import { useTranslations } from "next-intl";
import { updatePoolSettings } from "@/lib/api";
import type { PoolOverview } from "@/lib/api";
import type { PhaseData } from "../poolTypes";
import { formatPhaseFullName } from "../poolHelpers";
import {
  colors, fontSize, fontWeight, radii, shadows, spacing,
  adminSectionStyle, adminHeadingStyle, toggleTrackStyle, toggleThumbStyle,
} from "@/lib/theme";

export interface AdminSettingsTogglesProps {
  poolId: string;
  token: string;
  overview: PoolOverview;
  phases: PhaseData[];
  busyKey: string | null;
  setBusyKey: (key: string | null) => void;
  setError: (error: string | null) => void;
  friendlyError: (e: any) => string;
  reload: () => Promise<void>;
}

export function AdminSettingsToggles({
  poolId, token, overview, phases,
  busyKey, setBusyKey, setError, friendlyError, reload,
}: AdminSettingsTogglesProps) {
  const t = useTranslations("pool");

  return (
    <>
      {/* Auto-Advance Configuration */}
      <div style={adminSectionStyle}>
        <h4 style={adminHeadingStyle}>
          🤖 {t("admin.autoAdvance.title")}
        </h4>
        <div style={{ fontSize: fontSize.base, lineHeight: 1.8, color: colors.textMuted, marginBottom: spacing.md }}>
          {t("admin.autoAdvance.description")}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: spacing.md, background: colors.white, borderRadius: radii.lg, border: `1px solid ${colors.borderDark}` }}>
          <div
            onClick={async () => {
              if (busyKey === "auto-advance-toggle" || !token || !poolId) return;
              setBusyKey("auto-advance-toggle");
              setError(null);
              try {
                const newValue = !overview.pool.autoAdvanceEnabled;
                await updatePoolSettings(token, poolId, { autoAdvanceEnabled: newValue });
                await reload();
              } catch (err: any) {
                console.error('[TOGGLE] Error:', err);
                setError(friendlyError(err));
              } finally {
                setBusyKey(null);
              }
            }}
            style={toggleTrackStyle(overview.pool.autoAdvanceEnabled, busyKey === "auto-advance-toggle")}
          >
            <div
              style={toggleThumbStyle(overview.pool.autoAdvanceEnabled)}
            />
          </div>
          <div>
            <div style={{ fontWeight: fontWeight.semibold, color: colors.textDark }}>
              {overview.pool.autoAdvanceEnabled ? `✅ ${t("admin.autoAdvance.enabled")}` : `❌ ${t("admin.autoAdvance.disabled")}`}
            </div>
            <div style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 }}>
              {overview.pool.autoAdvanceEnabled
                ? t("admin.autoAdvance.enabledDesc")
                : t("admin.autoAdvance.disabledDesc")}
            </div>
          </div>
        </label>
      </div>

      {/* Require Approval Configuration */}
      <div style={adminSectionStyle}>
        <h4 style={adminHeadingStyle}>
          🔐 {t("admin.approval.title")}
        </h4>
        <div style={{ fontSize: fontSize.base, lineHeight: 1.8, color: colors.textMuted, marginBottom: spacing.md }}>
          {t("admin.approval.description")}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: spacing.md, background: colors.white, borderRadius: radii.lg, border: `1px solid ${colors.borderDark}` }}>
          <div
            onClick={async () => {
              if (busyKey === "require-approval-toggle" || !token || !poolId) return;
              setBusyKey("require-approval-toggle");
              setError(null);
              try {
                const newValue = !overview.pool.requireApproval;
                await updatePoolSettings(token, poolId, { requireApproval: newValue });
                await reload();
              } catch (err: any) {
                setError(friendlyError(err));
              } finally {
                setBusyKey(null);
              }
            }}
            style={toggleTrackStyle(overview.pool.requireApproval, busyKey === "require-approval-toggle")}
          >
            <div
              style={toggleThumbStyle(overview.pool.requireApproval)}
            />
          </div>
          <div>
            <div style={{ fontWeight: fontWeight.semibold, color: colors.textDark }}>
              {overview.pool.requireApproval ? `✅ ${t("admin.approval.required")}` : `❌ ${t("admin.approval.direct")}`}
            </div>
            <div style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 }}>
              {overview.pool.requireApproval
                ? t("admin.approval.requiredDesc")
                : t("admin.approval.directDesc")}
            </div>
          </div>
        </label>
      </div>

      {/* Extra Time Configuration */}
      {overview.pool.pickTypesConfig && (() => {
        const ptc = overview.pool.pickTypesConfig!;
        const scoringPhases = ptc.filter((pc) => pc.requiresScore);
        if (scoringPhases.length === 0) return null;

        const now = Date.now();
        const deadlineMinutes = overview.pool.deadlineMinutesBeforeKickoff ?? 10;

        return (
          <div style={adminSectionStyle}>
            <h4 style={{ ...adminHeadingStyle, marginBottom: spacing.sm }}>
              {"⏱️"} {t("admin.extraTime.title")}
            </h4>
            <div style={{ fontSize: fontSize.md, lineHeight: 1.6, color: colors.textMuted, marginBottom: 14 }}>
              {t("admin.extraTime.description")}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {scoringPhases.map((pc: any) => {
                const phase = phases.find((p: any) => p.id === pc.phaseId);
                const phaseName = phase ? formatPhaseFullName(pc.phaseId, t) : pc.phaseName;
                const phaseMatches = overview.matches.filter((m: any) => m.phaseId === pc.phaseId);
                const matchesWithResult = phaseMatches.filter((m: any) => m.result);
                const includeET = pc.includeExtraTime ?? false;

                let locked = false;
                let lockReason = "";

                if (matchesWithResult.length > 0) {
                  locked = true;
                  lockReason = matchesWithResult.length === phaseMatches.length
                    ? t("admin.extraTime.lockedCompleted")
                    : t("admin.extraTime.lockedOldResults");
                }

                if (!locked && phaseMatches.length > 0) {
                  const kickoffs = phaseMatches
                    .filter((m: any) => m.kickoffUtc)
                    .map((m: any) => new Date(m.kickoffUtc).getTime() - deadlineMinutes * 60_000);
                  if (kickoffs.length > 0) {
                    const firstDeadline = Math.min(...kickoffs);
                    const hoursUntil = (firstDeadline - now) / (1000 * 60 * 60);
                    if (hoursUntil < 48) {
                      locked = true;
                      lockReason = t("admin.extraTime.lockedDeadline");
                    }
                  }
                }

                return (
                  <div
                    key={pc.phaseId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: colors.white,
                      borderRadius: radii.lg,
                      border: `1px solid ${colors.borderDark}`,
                      opacity: locked ? 0.7 : 1,
                    }}
                  >
                    <div
                      onClick={async () => {
                        if (locked || busyKey === `et-${pc.phaseId}` || !token || !poolId) return;
                        setBusyKey(`et-${pc.phaseId}`);
                        setError(null);
                        try {
                          const currentEtPhases = (overview.pool.pickTypesConfig ?? [])
                            .filter((p) => p.includeExtraTime)
                            .map((p) => p.phaseId);
                          const newEtPhases = includeET
                            ? currentEtPhases.filter((id: string) => id !== pc.phaseId)
                            : [...currentEtPhases, pc.phaseId];
                          await updatePoolSettings(token, poolId, { extraTimePhases: newEtPhases });
                          await reload();
                        } catch (err: any) {
                          setError(friendlyError(err));
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                      style={{
                        position: "relative",
                        width: 40,
                        height: 20,
                        borderRadius: radii.xl,
                        background: locked ? colors.disabledDark : includeET ? colors.blue : colors.disabled,
                        cursor: locked ? "not-allowed" : busyKey === `et-${pc.phaseId}` ? "wait" : "pointer",
                        transition: "background 0.3s ease",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 2,
                          left: includeET ? 22 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: radii.circle as string,
                          background: colors.white,
                          boxShadow: shadows.sm,
                          transition: "left 0.3s ease",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: fontWeight.semibold, fontSize: fontSize.md, color: colors.textDark }}>
                        {phaseName}
                      </div>
                      <div style={{ fontSize: fontSize.xs, color: locked ? colors.textLight : colors.textMuted, marginTop: 1 }}>
                        {locked
                          ? lockReason
                          : includeET
                            ? t("admin.extraTime.labelET")
                            : t("admin.extraTime.label90")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </>
  );
}
