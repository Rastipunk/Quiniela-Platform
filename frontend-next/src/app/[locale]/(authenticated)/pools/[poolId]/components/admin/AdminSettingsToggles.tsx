"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updatePoolSettings } from "@/lib/api";
import type { PoolOverview } from "@/lib/api";
import type { PhaseData } from "../poolTypes";
import { formatPhaseFullName } from "../poolHelpers";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import {
  colors, fontSize, fontWeight, radii, spacing,
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
  const capricho = overview.pool.caprichoSan;
  const [caprichoMin, setCaprichoMin] = useState<number>(capricho?.min ?? 0);
  const [caprichoMax, setCaprichoMax] = useState<number>(capricho?.max ?? 4);
  const caprichoRangeDirty =
    !!capricho && (caprichoMin !== capricho.min || caprichoMax !== capricho.max);
  const caprichoRangeValid =
    Number.isInteger(caprichoMin) && Number.isInteger(caprichoMax) &&
    caprichoMin >= 0 && caprichoMax <= 9 && caprichoMin <= caprichoMax;

  return (
    <>
      {/* Capricho San (gifted feature) — FIRST card by owner request:
          only rendered when the backend marks this pool as allowlisted.
          Random score for players who let the deadline pass without
          predicting. */}
      {capricho?.available && (
        <div style={{ ...adminSectionStyle, border: "2px solid #8b5cf6", background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)" }}>
          <h4 style={adminHeadingStyle}>
            🎲 {t("admin.caprichoSan.title")}
          </h4>
          <div style={{ fontSize: fontSize.base, lineHeight: 1.8, color: colors.textMuted, marginBottom: spacing.md }}>
            {t("admin.caprichoSan.description")}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: spacing.md, background: colors.white, borderRadius: radii.lg, border: `1px solid ${colors.borderDark}` }}>
            <ToggleSwitch
              checked={capricho.enabled}
              disabled={busyKey === "capricho-san-toggle"}
              onChange={async () => {
                if (busyKey === "capricho-san-toggle" || !token || !poolId) return;
                setBusyKey("capricho-san-toggle");
                setError(null);
                try {
                  await updatePoolSettings(token, poolId, { caprichoSanEnabled: !capricho.enabled });
                  await reload();
                } catch (err: any) {
                  setError(friendlyError(err));
                } finally {
                  setBusyKey(null);
                }
              }}
            />
            <div>
              <div style={{ fontWeight: fontWeight.semibold, color: colors.textDark }}>
                {capricho.enabled ? `✅ ${t("admin.caprichoSan.enabled")}` : `❌ ${t("admin.caprichoSan.disabled")}`}
              </div>
              <div style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 }}>
                {capricho.enabled
                  ? t("admin.caprichoSan.enabledDesc", { min: capricho.min, max: capricho.max })
                  : t("admin.caprichoSan.disabledDesc")}
              </div>
            </div>
          </label>

          {capricho.enabled && (
            <div style={{ marginTop: spacing.md, padding: spacing.md, background: colors.white, borderRadius: radii.lg, border: `1px solid ${colors.borderDark}` }}>
              <div style={{ fontWeight: fontWeight.semibold, fontSize: fontSize.md, color: colors.textDark, marginBottom: spacing.sm }}>
                {t("admin.caprichoSan.rangeTitle")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <label style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                  {t("admin.caprichoSan.rangeMin")}{" "}
                  <input
                    type="number" min={0} max={9} step={1} value={caprichoMin}
                    onChange={(e) => setCaprichoMin(parseInt(e.target.value, 10))}
                    style={{ width: 64, padding: "6px 8px", borderRadius: 8, border: `1px solid ${colors.borderDark}`, fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: "center" }}
                  />
                </label>
                <label style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                  {t("admin.caprichoSan.rangeMax")}{" "}
                  <input
                    type="number" min={0} max={9} step={1} value={caprichoMax}
                    onChange={(e) => setCaprichoMax(parseInt(e.target.value, 10))}
                    style={{ width: 64, padding: "6px 8px", borderRadius: 8, border: `1px solid ${colors.borderDark}`, fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: "center" }}
                  />
                </label>
                {caprichoRangeDirty && (
                  <button
                    disabled={!caprichoRangeValid || busyKey === "capricho-san-range"}
                    onClick={async () => {
                      if (!caprichoRangeValid || busyKey === "capricho-san-range" || !token || !poolId) return;
                      setBusyKey("capricho-san-range");
                      setError(null);
                      try {
                        await updatePoolSettings(token, poolId, { caprichoSanMin: caprichoMin, caprichoSanMax: caprichoMax });
                        await reload();
                      } catch (err: any) {
                        setError(friendlyError(err));
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                    style={{
                      padding: "8px 16px", borderRadius: 8, border: "none",
                      background: caprichoRangeValid ? "#8b5cf6" : colors.disabled,
                      color: colors.white, fontWeight: fontWeight.semibold,
                      cursor: caprichoRangeValid ? "pointer" : "not-allowed", fontSize: fontSize.sm,
                    }}
                  >
                    {t("admin.caprichoSan.saveRange")}
                  </button>
                )}
              </div>
              {!caprichoRangeValid && (
                <div style={{ fontSize: fontSize.xs, color: colors.errorAlt, marginTop: 6 }}>
                  {t("admin.caprichoSan.rangeInvalid")}
                </div>
              )}
              <div style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 8 }}>
                {t("admin.caprichoSan.transparencyNote")}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto-Advance Configuration */}
      <div style={adminSectionStyle}>
        <h4 style={adminHeadingStyle}>
          🤖 {t("admin.autoAdvance.title")}
        </h4>
        <div style={{ fontSize: fontSize.base, lineHeight: 1.8, color: colors.textMuted, marginBottom: spacing.md }}>
          {t("admin.autoAdvance.description")}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: spacing.md, background: colors.white, borderRadius: radii.lg, border: `1px solid ${colors.borderDark}` }}>
          <ToggleSwitch
            checked={overview.pool.autoAdvanceEnabled}
            disabled={busyKey === "auto-advance-toggle"}
            onChange={async () => {
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
          />
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
          <ToggleSwitch
            checked={overview.pool.requireApproval}
            disabled={busyKey === "require-approval-toggle"}
            onChange={async () => {
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
          />
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

      {/* Extra Time Configuration (legacy live toggle). Hidden for users on the
          v2 flow (overview.extraTime.enabled) — they get the dedicated
          ExtraTimeConfigSection with per-phase save + end-of-group deadline. */}
      {!overview.extraTime?.enabled && overview.pool.pickTypesConfig && (() => {
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
                    <ToggleSwitch
                      checked={includeET}
                      disabled={locked || busyKey === `et-${pc.phaseId}`}
                      activeColor={colors.blue}
                      size="small"
                      onChange={async () => {
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
                    />
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
