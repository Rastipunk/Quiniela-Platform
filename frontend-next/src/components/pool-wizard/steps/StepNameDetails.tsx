"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight, shadows } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";
import { RECOMMENDED_DEADLINE } from "@/types/poolWizard";

// ── Deadline options ──────────────────────────────────────────

const DEADLINE_OPTIONS: Array<{ labelKey: string; value: number; recommended?: boolean }> = [
  { labelKey: "deadlineAtStart", value: 0 },
  { labelKey: "deadline10min", value: 10, recommended: true },
  { labelKey: "deadline1hr", value: 60 },
  { labelKey: "deadline1day", value: 1440 },
] as const;

export function StepNameDetails() {
  const t = useTranslations("poolWizard");
  const isMobile = useIsMobile();
  const { state, dispatch } = useWizard();

  // Auto-detect timezone
  const detectedTimezone = useMemo(
    () =>
      typeof window !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "America/Bogota",
    [],
  );

  const setField = useCallback(
    (field: string, value: unknown) => {
      dispatch({ type: "SET_FIELD", field: field as any, value });
    },
    [dispatch],
  );

  const poolNameError =
    state.poolName.length > 0 && state.poolName.trim().length < 3
      ? t("nameMinLength")
      : null;

  const descriptionLength = state.poolDescription.length;
  const descriptionOver = descriptionLength > 500;

  return (
    <PoolWizardStepContainer
      title={t("nameDetailsTitle")}
      subtitle={t("nameDetailsSubtitle")}
      icon="✏️"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: spacing["2xl"] }}>
        {/* ── Pool name ────────────────────────────────────────── */}
        <div>
          <label style={labelStyle}>
            {t("poolNameLabel")} <span style={{ color: colors.error }}>*</span>
          </label>
          <input
            type="text"
            value={state.poolName}
            onChange={(e) => setField("poolName", e.target.value)}
            placeholder={t("poolNamePlaceholder")}
            maxLength={60}
            style={{
              ...inputBaseStyle,
              borderColor: poolNameError ? colors.error : colors.borderLight,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = poolNameError ? colors.error : colors.brand;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${poolNameError ? "rgba(220,38,38,0.1)" : "rgba(79,70,229,0.1)"}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = poolNameError ? colors.error : colors.borderLight;
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {poolNameError && (
            <p style={errorTextStyle}>{poolNameError}</p>
          )}
          <p style={helpTextStyle}>{t("poolNameHelp")}</p>
        </div>

        {/* ── Description ──────────────────────────────────────── */}
        <div>
          <label style={labelStyle}>{t("descriptionLabel")}</label>
          <textarea
            value={state.poolDescription}
            onChange={(e) => setField("poolDescription", e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            maxLength={500}
            rows={3}
            style={{
              ...inputBaseStyle,
              resize: "vertical" as const,
              minHeight: 80,
              fontFamily: "inherit",
              borderColor: descriptionOver ? colors.error : colors.borderLight,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.brand;
              e.currentTarget.style.boxShadow = `0 0 0 3px rgba(79,70,229,0.1)`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.borderLight;
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: spacing.xs,
          }}>
            <p style={helpTextStyle}>{t("descriptionHelp")}</p>
            <span style={{
              fontSize: fontSize.xs,
              color: descriptionOver ? colors.error : colors.textLight,
            }}>
              {descriptionLength}/500
            </span>
          </div>
        </div>

        {/* ── Deadline ─────────────────────────────────────────── */}
        <div>
          <label style={labelStyle}>{t("deadlineLabel")}</label>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginTop: spacing.xs,
          }}>
            {DEADLINE_OPTIONS.map((opt) => {
              const isActive = state.deadlineMinutesBeforeKickoff === opt.value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setField("deadlineMinutesBeforeKickoff", opt.value)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: spacing.xs,
                    padding: `${spacing.sm}px ${spacing.lg}px`,
                    borderRadius: radii.pill,
                    border: isActive
                      ? `2px solid ${colors.brand}`
                      : `1px solid ${colors.borderMedium}`,
                    background: isActive ? colors.brandBg : colors.white,
                    color: isActive ? colors.brand : colors.textDark,
                    fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                    fontSize: fontSize.base,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = colors.brandLight;
                      e.currentTarget.style.background = colors.bgLighter;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = colors.borderMedium;
                      e.currentTarget.style.background = colors.white;
                    }
                  }}
                >
                  {t(opt.labelKey)}
                  {opt.recommended && (
                    <span style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: colors.successDarker,
                      background: colors.successBgLight,
                      border: `1px solid ${colors.successBorder}`,
                      borderRadius: radii.pill,
                      padding: "1px 8px",
                      lineHeight: 1.4,
                    }}>
                      {t("recommended")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p style={helpTextStyle}>{t("deadlineHelp")}</p>
        </div>

        {/* ── Timezone ─────────────────────────────────────────── */}
        <div>
          <label style={labelStyle}>{t("timezoneLabel")}</label>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            marginTop: spacing.xs,
          }}>
            <div style={{
              ...inputBaseStyle,
              display: "flex",
              alignItems: "center",
              background: colors.bgLight,
              color: colors.textDark,
              cursor: "default",
              flex: 1,
            }}>
              {state.timeZone || detectedTimezone}
            </div>
            <button
              type="button"
              onClick={() => {
                const tz = prompt(t("timezonePrompt"), state.timeZone || detectedTimezone);
                if (tz && tz.trim()) {
                  setField("timeZone", tz.trim());
                }
              }}
              style={{
                background: "none",
                border: "none",
                color: colors.brand,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                cursor: "pointer",
                textDecoration: "underline",
                padding: spacing.xs,
                whiteSpace: "nowrap",
              }}
            >
              {t("timezoneEdit")}
            </button>
          </div>
          <p style={helpTextStyle}>{t("timezoneHelp")}</p>
        </div>

        {/* ── Require Approval toggle ──────────────────────────── */}
        <div>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                {t("requireApprovalLabel")}
              </label>
              <p style={{
                ...helpTextStyle,
                marginTop: spacing.xs,
              }}>
                {t("requireApprovalHelp")}
              </p>
            </div>

            {/* Toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={state.requireApproval}
              onClick={() => setField("requireApproval", !state.requireApproval)}
              style={{
                position: "relative",
                width: 48,
                height: 26,
                borderRadius: radii.pill,
                border: "none",
                background: state.requireApproval ? colors.brand : colors.disabled,
                cursor: "pointer",
                transition: "background 0.25s ease",
                flexShrink: 0,
                padding: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: state.requireApproval ? 25 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: radii.circle as string,
                  background: colors.white,
                  boxShadow: shadows.card,
                  transition: "left 0.25s ease",
                }}
              />
            </button>
          </div>
        </div>
      </div>
    </PoolWizardStepContainer>
  );
}

// ── Shared styles ─────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: fontSize.base,
  fontWeight: fontWeight.semibold,
  color: colors.text,
  marginBottom: spacing.sm,
};

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  padding: `${spacing.md}px ${spacing.lg}px`,
  fontSize: fontSize.base,
  color: colors.text,
  border: `1px solid ${colors.borderLight}`,
  borderRadius: radii.lg,
  outline: "none",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  boxSizing: "border-box",
  lineHeight: 1.5,
};

const helpTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.textLight,
  margin: `${spacing.xs}px 0 0`,
  lineHeight: 1.4,
};

const errorTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.error,
  margin: `${spacing.xs}px 0 0`,
  lineHeight: 1.4,
};
