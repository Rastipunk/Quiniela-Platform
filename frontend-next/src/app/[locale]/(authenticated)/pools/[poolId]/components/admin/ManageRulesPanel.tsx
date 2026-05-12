"use client";

// Host-only panel that lets the pool creator (and CO_ADMINs) edit the
// scoring rules of an existing pool. Mounted inside PoolAdminTab.
//
// State-machine contract:
//   - DRAFT  → fully editable. Opens a modal with the standalone
//              ScoringEditor and PATCHes /pools/:id/scoring-config.
//   - other  → read-only summary + a banner explaining how to unlock
//              the editor (remove all non-host members → auto-revert
//              to DRAFT, see poolStateMachine.revertPoolToDraft).

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { updatePoolScoringConfig } from "@/lib/api";
import type { PoolOverview } from "@/lib/api";
import type {
  PickConfigPresetKey,
  PoolPickTypesConfig,
} from "@/types/pickConfig";
import type { InstancePhase } from "@/types/poolWizard";
import { ScoringEditor } from "@/components/scoring-editor/ScoringEditor";
import { PRESETS } from "@/components/scoring-editor/presets";
import {
  colors, fontSize, fontWeight, radii, spacing, shadows,
  adminSectionStyle, adminHeadingStyle, modalOverlayDarkStyle, zIndex,
} from "@/lib/theme";
import { useIsMobile, TOUCH_TARGET } from "@/hooks/useIsMobile";

export interface ManageRulesPanelProps {
  poolId: string;
  token: string;
  overview: PoolOverview;
  setError: (error: string | null) => void;
  friendlyError: (e: unknown) => string;
  reload: () => Promise<void>;
}

// Best-effort detection of which preset the host last picked. Pool rows
// don't carry the wizard's `scoringStyle`, but we can infer it from
// pickTypesConfig so the editor opens on the most likely starting view
// instead of always sending the host back to the picker.
function detectPresetKey(
  config: PoolPickTypesConfig | null,
): PickConfigPresetKey {
  if (!config || config.length === 0) return "CUMULATIVE";
  const first = config[0];
  if (first?.structuralPicks?.type) return "SIMPLE";
  if (first?.matchPicks) {
    const types = first.matchPicks.types;
    const hasPerSideGoals = types.some(
      (t) => (t.key === "HOME_GOALS" || t.key === "AWAY_GOALS") && t.enabled,
    );
    const hasExact = types.some((t) => t.key === "EXACT_SCORE" && t.enabled);
    const enabledCount = types.filter((t) => t.enabled).length;
    if (hasPerSideGoals) return "CUMULATIVE";
    if (hasExact && enabledCount === 1) return "BASIC";
  }
  return "CUSTOM";
}

export function ManageRulesPanel({
  poolId, token, overview, setError, friendlyError, reload,
}: ManageRulesPanelProps) {
  const t = useTranslations("pool");
  const tPresets = useTranslations("poolWizard.scoring.presets");
  const isMobile = useIsMobile();

  if (!overview.permissions.canManageResults) return null;

  const isDraft = overview.pool.status === "DRAFT";
  const currentConfig = (overview.pool.pickTypesConfig ?? []) as PoolPickTypesConfig;
  const detectedStyle = useMemo(
    () => detectPresetKey(currentConfig),
    // overview.pool.pickTypesConfig is a stable JSON snapshot per reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overview.pool.pickTypesConfig],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [draftStyle, setDraftStyle] = useState<PickConfigPresetKey | null>(detectedStyle);
  const [draftConfig, setDraftConfig] = useState<PoolPickTypesConfig>(currentConfig);
  const [saving, setSaving] = useState(false);

  // Re-seed the draft when the modal re-opens, so the editor always shows
  // the freshly-loaded server state (avoids stale edits leaking across opens).
  useEffect(() => {
    if (isEditing) {
      setDraftStyle(detectedStyle);
      setDraftConfig(currentConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const instancePhases: InstancePhase[] = useMemo(() => {
    const phases = overview.tournamentInstance?.dataJson?.phases ?? [];
    return phases.map((p) => ({ id: p.id, name: p.name, type: p.type }));
  }, [overview.tournamentInstance?.dataJson?.phases]);

  const activePreset = PRESETS.find((p) => p.key === detectedStyle);

  async function handleSave() {
    if (!draftStyle || draftConfig.length === 0) {
      setError(t("admin.rules.errorNoConfig"));
      return;
    }
    const ok = window.confirm(t("admin.rules.confirmSave"));
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await updatePoolScoringConfig(token, poolId, draftConfig);
      await reload();
      setIsEditing(false);
      alert(t("admin.rules.saveSuccess"));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={adminSectionStyle}>
      <h4 style={adminHeadingStyle}>
        ⚖️ {t("admin.rules.title")}
      </h4>

      {/* Current preset summary */}
      <div style={{
        padding: spacing.md,
        background: activePreset?.bgColor ?? colors.bgLighter,
        border: `1px solid ${(activePreset?.borderColor ?? colors.borderLight) + "30"}`,
        borderRadius: radii.lg,
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        marginBottom: spacing.md,
      }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{activePreset?.icon ?? "🎲"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: activePreset?.color ?? colors.text,
          }}>
            {activePreset ? tPresets(`${activePreset.key}.name`) : t("admin.rules.customPreset")}
          </div>
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
            {currentConfig.length} {t("admin.rules.phasesCount")}
          </div>
        </div>
      </div>

      {/* State-dependent action */}
      {isDraft ? (
        <>
          <div style={{
            padding: spacing.md,
            background: colors.infoBgLight,
            border: `1px solid ${colors.infoBorder}`,
            borderRadius: radii.lg,
            fontSize: fontSize.sm,
            color: colors.infoDarker,
            lineHeight: 1.5,
            marginBottom: spacing.md,
          }}>
            💡 {t("admin.rules.draftHint")}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: isMobile ? "12px 20px" : "10px 18px",
              borderRadius: radii.lg,
              border: "none",
              background: colors.brand,
              color: colors.white,
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              cursor: "pointer",
              minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
            }}
          >
            ✏️ {t("admin.rules.editButton")}
          </button>
        </>
      ) : (
        <div style={{
          padding: spacing.md,
          background: colors.warningBg,
          border: `1px solid ${colors.warning}`,
          borderRadius: radii.lg,
          fontSize: fontSize.sm,
          color: colors.warningDark,
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: fontWeight.semibold, marginBottom: 4 }}>
            🔒 {t("admin.rules.lockedTitle")}
          </div>
          {t("admin.rules.lockedExplanation")}
        </div>
      )}

      {/* Editor modal */}
      {isEditing && (
        <div
          style={{ ...modalOverlayDarkStyle, zIndex: zIndex.expulsion, padding: spacing.md, overflowY: "auto" as const }}
          onClick={() => !saving && setIsEditing(false)}
        >
          <div
            style={{
              background: colors.white,
              borderRadius: radii["2xl"],
              padding: isMobile ? spacing.lg : spacing["2xl"],
              maxWidth: 900,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto" as const,
              boxShadow: shadows.lg,
              margin: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.lg }}>
              <h3 style={{ margin: 0, fontSize: fontSize["2xl"], fontWeight: fontWeight.bold, color: colors.text }}>
                ⚖️ {t("admin.rules.modalTitle")}
              </h3>
              <button
                onClick={() => !saving && setIsEditing(false)}
                disabled={saving}
                style={{
                  background: "transparent", border: "none", fontSize: 22,
                  cursor: saving ? "wait" : "pointer", color: colors.textMuted,
                  padding: 4, lineHeight: 1,
                }}
                aria-label={t("admin.rules.cancel")}
              >
                ✕
              </button>
            </div>

            <ScoringEditor
              scoringStyle={draftStyle}
              scoringConfig={draftConfig}
              instancePhases={instancePhases}
              onSetScoring={(style, config) => {
                setDraftStyle(style);
                setDraftConfig(config);
              }}
              onUpdateScoringConfig={setDraftConfig}
            />

            <div style={{
              display: "flex",
              gap: spacing.md,
              marginTop: spacing.xl,
              position: "sticky" as const,
              bottom: 0,
              background: colors.white,
              paddingTop: spacing.md,
              borderTop: `1px solid ${colors.borderLight}`,
            }}>
              <button
                onClick={() => setIsEditing(false)}
                disabled={saving}
                style={{
                  flex: 1, padding: 12, borderRadius: radii.lg,
                  border: `1px solid ${colors.borderMedium}`,
                  background: colors.white, color: colors.textDark,
                  cursor: saving ? "wait" : "pointer",
                  fontSize: fontSize.base, fontWeight: fontWeight.semibold,
                  minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                }}
              >
                {t("admin.rules.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !draftStyle || draftConfig.length === 0}
                style={{
                  flex: 1, padding: 12, borderRadius: radii.lg,
                  border: "none",
                  background: saving ? colors.disabled : colors.brand,
                  color: colors.white,
                  cursor: saving ? "wait" : "pointer",
                  fontSize: fontSize.base, fontWeight: fontWeight.semibold,
                  minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                }}
              >
                {saving ? `⏳ ${t("admin.rules.saving")}` : `💾 ${t("admin.rules.saveButton")}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
