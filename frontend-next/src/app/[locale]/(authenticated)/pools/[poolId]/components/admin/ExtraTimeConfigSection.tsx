"use client";

// Knockout extra-time scoring config (v2) — host section.
//
// One toggle per knockout scoreline phase; a "Save" button appears per phase
// only when its value differs from what's saved. Saving hits
// PATCH /pools/:id/phases/:phaseId/extra-time (backend enforces the edit
// window). Editable until the last group-stage match is finalized. Gated by
// overview.extraTime.enabled (the viewing user's email).

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { updatePhaseExtraTime } from "@/lib/api";
import type { PoolOverview } from "@/lib/api";
import { formatPhaseFullName } from "../poolHelpers";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { colors, fontSize, fontWeight, radii, spacing, adminSectionStyle, adminHeadingStyle } from "@/lib/theme";

export function ExtraTimeConfigSection({
  poolId,
  token,
  overview,
  reload,
}: {
  poolId: string;
  token: string;
  overview: PoolOverview;
  reload: () => Promise<void>;
}) {
  const t = useTranslations("pool");
  const et = overview.extraTime;
  const phases = et?.phases ?? [];

  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [savingPhase, setSavingPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Seed the local draft from server values. Keyed by the phase-id SET only (not
  // their values) so a background reload (live refresh) never clobbers a host's
  // unsaved toggle — after a successful save the local draft already matches the
  // server, so no value-driven resync is needed.
  const phaseIdsKey = phases.map((p) => p.phaseId).join("|");
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const p of phases) next[p.phaseId] = p.includeExtraTime;
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdsKey]);

  if (!et?.enabled || !et.isScorePool) return null;

  const windowOpen = et.windowOpen;
  const closedReason =
    et.windowReason === "KNOCKOUT_STARTED"
      ? t("extraTimeConfig.windowClosedKnockout")
      : et.windowReason === "GROUP_STAGE_FINALIZED"
        ? t("extraTimeConfig.windowClosedGroup")
        : t("extraTimeConfig.windowClosedGeneric");

  const save = async (phaseId: string) => {
    if (!token) return;
    setSavingPhase(phaseId);
    setError(null);
    try {
      await updatePhaseExtraTime(token, poolId, phaseId, !!draft[phaseId]);
      await reload();
    } catch {
      setError(t("extraTimeConfig.saveError"));
      await reload(); // refresh window state in case it just closed
    } finally {
      setSavingPhase(null);
    }
  };

  return (
    <div style={adminSectionStyle}>
      <h4 style={{ ...adminHeadingStyle, marginBottom: spacing.sm }}>
        ⚽ {t("extraTimeConfig.title")}
      </h4>
      <div style={{ fontSize: fontSize.md, lineHeight: 1.6, color: colors.textMuted, marginBottom: 8 }}>
        {t("extraTimeConfig.intro")}
      </div>

      {/* (?) help disclosure with concrete examples (90+5 stoppage vs 105 ET) */}
      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
          color: colors.brand, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, cursor: "pointer", padding: 0, marginBottom: 10,
        }}
      >
        ❔ {t("extraTimeConfig.helpToggle")}
      </button>
      {showHelp && (
        <div style={{
          background: colors.bgLighter, border: `1px solid ${colors.borderLight}`, borderRadius: radii.lg,
          padding: 14, marginBottom: 12, fontSize: fontSize.sm, lineHeight: 1.65, color: colors.textDark,
        }}>
          <p style={{ margin: "0 0 10px" }}>{t("extraTimeConfig.helpIntro")}</p>
          <p style={{ margin: "0 0 4px", fontWeight: fontWeight.semibold }}>{t("extraTimeConfig.helpReg")}</p>
          <p style={{ margin: "0 0 10px", color: colors.textMuted, fontStyle: "italic" }}>{t("extraTimeConfig.helpRegExample")}</p>
          <p style={{ margin: "0 0 4px", fontWeight: fontWeight.semibold }}>{t("extraTimeConfig.helpET")}</p>
          <p style={{ margin: "0 0 10px", color: colors.textMuted, fontStyle: "italic" }}>{t("extraTimeConfig.helpETExample")}</p>
          <p style={{ margin: 0, color: colors.textMuted }}>{t("extraTimeConfig.helpNote")}</p>
        </div>
      )}

      {!windowOpen && (
        <div style={{
          padding: "8px 12px", background: colors.warningBgAmber, border: "1px solid #fbbf24",
          borderRadius: radii.lg, marginBottom: 10, fontSize: fontSize.sm, color: colors.warningDarker,
        }}>
          🔒 {closedReason}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {phases.map((p) => {
          const current = p.includeExtraTime;
          const val = draft[p.phaseId] ?? current;
          const dirty = val !== current;
          const phaseName = formatPhaseFullName(p.phaseId, t) || p.phaseName;
          const busy = savingPhase === p.phaseId;
          return (
            <div
              key={p.phaseId}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                background: colors.white, borderRadius: radii.lg, border: `1px solid ${colors.borderDark}`,
                opacity: windowOpen ? 1 : 0.7,
              }}
            >
              <ToggleSwitch
                checked={val}
                disabled={!windowOpen || busy}
                activeColor={colors.blue}
                size="small"
                ariaLabel={phaseName}
                onChange={(c) => setDraft((d) => ({ ...d, [p.phaseId]: c }))}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: fontWeight.semibold, fontSize: fontSize.md, color: colors.textDark }}>
                  {phaseName}
                </div>
                <div style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 }}>
                  {val ? t("extraTimeConfig.phaseLabelET") : t("extraTimeConfig.phaseLabel90")}
                </div>
              </div>
              {dirty && windowOpen && (
                <button
                  type="button"
                  onClick={() => save(p.phaseId)}
                  disabled={busy}
                  style={{
                    flexShrink: 0, padding: "8px 14px", borderRadius: radii.lg, border: "none",
                    background: colors.brand, color: colors.white, fontSize: fontSize.sm,
                    fontWeight: fontWeight.bold, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1,
                  }}
                >
                  {busy ? t("extraTimeConfig.saving") : t("extraTimeConfig.save")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {windowOpen && (
        <div style={{ marginTop: 10, fontSize: fontSize.xs, color: colors.textMuted }}>
          ⏳ {t("extraTimeConfig.deadlineNote")}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 8, fontSize: fontSize.sm, color: colors.error }}>{error}</div>
      )}
    </div>
  );
}
