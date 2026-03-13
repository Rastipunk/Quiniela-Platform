"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { CatalogInstance } from "@/lib/api";
import { TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import CapacitySelector from "@/components/CapacitySelector";
import { TOURNAMENT_CATALOG } from "@/lib/tournamentCatalog";
import { colors, radii, zIndex, shadows, spacing, fontSize, fontWeight } from "@/lib/theme";

const PoolConfigWizard = dynamic(() => import("@/components/PoolConfigWizard").then(m => ({ default: m.PoolConfigWizard })), {
  loading: () => <div style={{ padding: spacing.xl, textAlign: "center", color: colors.textLight }}>Loading...</div>,
});

export interface CreateJoinPanelProps {
  panel: "CREATE" | "JOIN";
  onClose: () => void;
  // Create
  createStep: 1 | 2;
  setCreateStep: (step: 1 | 2) => void;
  showWizard: boolean;
  setShowWizard: (show: boolean) => void;
  instanceId: string;
  setInstanceId: (id: string) => void;
  instances: CatalogInstance[] | null;
  poolName: string;
  setPoolName: (name: string) => void;
  poolDesc: string;
  setPoolDesc: (desc: string) => void;
  deadline: number;
  setDeadline: (d: number) => void;
  timeZone: string;
  setTimeZone: (tz: string) => void;
  requireApproval: boolean;
  setRequireApproval: (v: boolean) => void;
  maxParticipants: number;
  setMaxParticipants: (v: number) => void;
  pickTypesConfig: any;
  setPickTypesConfig: (v: any) => void;
  goToCapacityStep: () => void;
  onCreate: () => void;
  // Join
  inviteCode: string;
  setInviteCode: (v: string) => void;
  onJoin: () => void;
  // Shared
  token: string | null;
  isMobile: boolean;
  busy: boolean;
  t: any;
  tc: any;
  inputStyle: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
}

export function CreateJoinPanel({
  panel,
  onClose,
  createStep,
  setCreateStep,
  showWizard,
  setShowWizard,
  instanceId,
  setInstanceId,
  instances,
  poolName,
  setPoolName,
  poolDesc,
  setPoolDesc,
  deadline,
  setDeadline,
  timeZone,
  setTimeZone,
  requireApproval,
  setRequireApproval,
  maxParticipants,
  setMaxParticipants,
  pickTypesConfig,
  setPickTypesConfig,
  goToCapacityStep,
  onCreate,
  inviteCode,
  setInviteCode,
  onJoin,
  token,
  isMobile,
  busy,
  t,
  tc,
  inputStyle,
}: CreateJoinPanelProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: colors.overlayDarker,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : spacing.lg,
        zIndex: zIndex.modal,
      }}
      onClick={() => { onClose(); }}
    >
      <div
        style={{
          width: isMobile ? "100%" : "min(720px, 100%)",
          maxHeight: isMobile ? "90vh" : "85vh",
          background: colors.white,
          borderRadius: isMobile ? "16px 16px 0 0" : radii["4xl"],
          padding: isMobile ? 20 : 16,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: spacing.md,
            marginBottom: spacing.lg,
            paddingBottom: spacing.md,
            borderBottom: "1px solid #eee",
          }}
        >
          <div style={{ fontWeight: fontWeight.black, fontSize: isMobile ? 20 : fontSize["2xl"] }}>
            {panel === "CREATE"
              ? (createStep === 2 ? t("createPanel.capacityStepTitle") : t("createPanel.title"))
              : t("joinPanel.title")}
          </div>
          <button
            onClick={() => { onClose(); }}
            style={{
              width: TOUCH_TARGET.minimum,
              height: TOUCH_TARGET.minimum,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f5f5f5",
              border: "none",
              borderRadius: radii.xl,
              fontSize: fontSize["2xl"],
              color: colors.textMuted,
              cursor: "pointer",
              ...mobileInteractiveStyles.tapHighlight,
            }}
            aria-label="Close"
          >
            &#10005;
          </button>
        </div>

        {panel === "CREATE" && !showWizard && createStep === 1 && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{t("createPanel.tournamentLabel")}</span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 8,
                }}
              >
                {TOURNAMENT_CATALOG.map((tournament) => {
                  const matchingInstance = (instances ?? []).find(
                    (inst) => inst.template?.key === tournament.templateKey
                  );
                  const isAvailable = tournament.active && !!matchingInstance;
                  const isSelected = isAvailable && instanceId === matchingInstance?.id;

                  return (
                    <button
                      key={tournament.key}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (matchingInstance) setInstanceId(matchingInstance.id);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: "12px 8px",
                        borderRadius: radii.xl,
                        border: isSelected
                          ? `2px solid ${colors.brandLight}`
                          : `1px solid ${colors.borderLight}`,
                        background: isSelected
                          ? "linear-gradient(135deg, rgba(102,126,234,0.08), rgba(118,75,162,0.08))"
                          : isAvailable
                            ? colors.white
                            : colors.bgLighter,
                        cursor: isAvailable ? "pointer" : "default",
                        opacity: isAvailable ? 1 : 0.45,
                        filter: isAvailable ? "none" : "grayscale(100%)",
                        transition: "border-color 0.15s, background 0.15s",
                        position: "relative",
                      }}
                    >
                      {!isAvailable && (
                        <span
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            fontSize: "0.55rem",
                            fontWeight: fontWeight.semibold,
                            color: colors.white,
                            background: colors.textLighter,
                            padding: "1px 4px",
                            borderRadius: 3,
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                          }}
                        >
                          {tc("comingSoon")}
                        </span>
                      )}
                      <span style={{ fontSize: "1.5rem" }}>{tournament.emoji}</span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: fontWeight.semibold,
                          color: isAvailable ? "#111827" : colors.textLighter,
                          textAlign: "center",
                          lineHeight: 1.2,
                        }}
                      >
                        {tc(`items.${tournament.i18nKey}.name`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{t("createPanel.poolNameLabel")}</span>
              <input
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder={t("createPanel.poolNamePlaceholder")}
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{t("createPanel.descriptionLabel")}</span>
              <input
                value={poolDesc}
                onChange={(e) => setPoolDesc(e.target.value)}
                placeholder={t("createPanel.descriptionPlaceholder")}
                style={inputStyle}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>
                  {t("createPanel.deadlineLabel")}
                </span>
                <input
                  type="number"
                  value={deadline}
                  min={0}
                  max={1440}
                  onChange={(e) => setDeadline(Number(e.target.value))}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{t("createPanel.timezoneLabel")}</span>
                <input
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  placeholder="America/Bogota"
                  style={inputStyle}
                />
              </label>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.md,
                marginTop: 6,
                padding: spacing.md,
                background: colors.bgLight,
                borderRadius: radii.xl,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                style={{ width: 20, height: 20, cursor: "pointer" }}
              />
              <div>
                <div style={{ fontSize: fontSize.base, color: colors.textDark, fontWeight: fontWeight.medium }}>
                  {t("createPanel.requireApprovalLabel")}
                </div>
                <div style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 }}>
                  {t("createPanel.requireApprovalDesc")}
                </div>
              </div>
            </label>

            {/* Scoring Configuration */}
            <div
              style={{
                marginTop: 8,
                padding: spacing.lg,
                border: `2px solid ${colors.blue}`,
                borderRadius: radii["2xl"],
                background: colors.brandGradient,
                color: "white",
              }}
            >
              <div style={{ fontWeight: fontWeight.bold, fontSize: fontSize.xl, marginBottom: spacing.sm }}>
                {"\u{1F4CA}"} {t("createPanel.scoringTitle")}
              </div>
              <div style={{ fontSize: fontSize.md, marginBottom: spacing.md, opacity: 0.95 }}>
                {t("createPanel.scoringDesc")}
              </div>
              <button
                onClick={() => setShowWizard(true)}
                style={{
                  padding: "12px 16px",
                  borderRadius: radii.lg,
                  border: "2px solid white",
                  background: "white",
                  color: colors.brandLight,
                  cursor: "pointer",
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.bold,
                  minHeight: TOUCH_TARGET.minimum,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {"\u{1F9D9}\u200D\u2642\uFE0F"} {t("createPanel.configWizard")}
              </button>
              {pickTypesConfig && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    background: colors.overlayWhite,
                    borderRadius: radii.md,
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {"\u2705"} {t("createPanel.configReady", { count: Array.isArray(pickTypesConfig) ? pickTypesConfig.length : 0 })}
                </div>
              )}
            </div>

            <button
              onClick={goToCapacityStep}
              style={{
                marginTop: 8,
                padding: isMobile ? 16 : 12,
                borderRadius: radii["2xl"],
                border: "none",
                background: colors.text,
                color: colors.white,
                cursor: "pointer",
                fontSize: isMobile ? fontSize.xl : fontSize.base,
                fontWeight: fontWeight.semibold,
                minHeight: TOUCH_TARGET.comfortable,
                ...mobileInteractiveStyles.tapHighlight,
              }}
            >
              {t("createPanel.nextStep")}
            </button>
          </div>
        )}

        {/* Step 2: Capacity Selection */}
        {panel === "CREATE" && !showWizard && createStep === 2 && (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Step indicator */}
            <div style={{ fontSize: fontSize.md, color: colors.textMuted, fontWeight: fontWeight.medium, textAlign: "center" }}>
              {t("createPanel.stepIndicator", { current: 2, total: 2 })}
            </div>

            <CapacitySelector
              type="personal"
              selectedCapacity={maxParticipants}
              onSelect={setMaxParticipants}
              mode="creation"
            />

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setCreateStep(1)}
                style={{
                  flex: 1,
                  padding: isMobile ? 14 : 10,
                  borderRadius: radii["2xl"],
                  border: `1px solid ${colors.border}`,
                  background: colors.white,
                  color: colors.textDark,
                  cursor: "pointer",
                  fontSize: isMobile ? fontSize.lg : fontSize.base,
                  fontWeight: fontWeight.semibold,
                  minHeight: TOUCH_TARGET.comfortable,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {t("createPanel.backStep")}
              </button>
              <button
                onClick={onCreate}
                disabled={busy}
                style={{
                  flex: 2,
                  padding: isMobile ? 14 : 10,
                  borderRadius: radii["2xl"],
                  border: "none",
                  background: colors.text,
                  color: colors.white,
                  cursor: "pointer",
                  fontSize: isMobile ? fontSize.lg : fontSize.base,
                  fontWeight: fontWeight.semibold,
                  minHeight: TOUCH_TARGET.comfortable,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {busy ? t("createPanel.creating") : t("createPanel.createButton")}
              </button>
            </div>
          </div>
        )}

        {/* Advanced Configuration Wizard */}
        {panel === "CREATE" && showWizard && instanceId && token && (
          <div>
            <PoolConfigWizard
              instanceId={instanceId}
              token={token}
              onComplete={(config) => {
                setPickTypesConfig(config);
                setShowWizard(false);
              }}
              onCancel={() => setShowWizard(false)}
            />
          </div>
        )}

        {panel === "JOIN" && (
          <div style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{t("joinPanel.inviteCodeLabel")}</span>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder={t("joinPanel.inviteCodePlaceholder")}
                style={inputStyle}
              />
            </label>

            <button
              onClick={onJoin}
              disabled={busy}
              style={{
                marginTop: 6,
                padding: isMobile ? 16 : 12,
                borderRadius: radii["2xl"],
                border: "none",
                background: colors.text,
                color: colors.white,
                cursor: "pointer",
                fontSize: isMobile ? fontSize.xl : fontSize.base,
                fontWeight: fontWeight.semibold,
                minHeight: TOUCH_TARGET.comfortable,
                ...mobileInteractiveStyles.tapHighlight,
              }}
            >
              {busy ? t("joinPanel.joining") : t("joinPanel.joinButton")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
