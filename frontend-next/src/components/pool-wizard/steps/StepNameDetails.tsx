"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight } from "@/lib/theme";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";
import { WizardSubStep } from "../WizardSubStep";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";

// ── Deadline presets ──────────────────────────────────────────

const DEADLINE_PRESETS: Array<{ labelKey: string; value: number; recommended?: boolean }> = [
  { labelKey: "deadlineAtStart", value: 0 },
  { labelKey: "deadline10min", value: 10, recommended: true },
  { labelKey: "deadline1hr", value: 60 },
  { labelKey: "deadline1day", value: 1440 },
];

import { COMMON_TIMEZONES } from "@/lib/timezones";

export function StepNameDetails() {
  const t = useTranslations("poolWizard");
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
      {/* 1. Pool name */}
      <WizardSubStep
        isFirst
        number={1}
        title={t("poolNameLabel")}
        subtitle={t("poolNameHelp")}
        requiredMark
      >
        <input
          type="text"
          value={state.poolName}
          onChange={(e) => setField("poolName", e.target.value)}
          placeholder={t("poolNamePlaceholder")}
          aria-label={t("poolNameLabel")}
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
      </WizardSubStep>

      {/* 2. Description */}
      <WizardSubStep
        number={2}
        title={t("descriptionLabel")}
        subtitle={t("descriptionHelp")}
      >
        <textarea
          value={state.poolDescription}
          onChange={(e) => setField("poolDescription", e.target.value)}
          placeholder={t("descriptionPlaceholder")}
          aria-label={t("descriptionLabel")}
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
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: spacing.xs,
        }}>
          <span style={{
            fontSize: fontSize.xs,
            color: descriptionOver ? colors.error : colors.textLight,
          }}>
            {descriptionLength}/500
          </span>
        </div>
      </WizardSubStep>

      {/* 3. Deadline */}
      <WizardSubStep
        number={3}
        title={t("deadlineLabel")}
        subtitle={t("deadlineHelp")}
      >
        {/* Quick preset pills */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing.sm,
        }}>
            {DEADLINE_PRESETS.map((opt) => {
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

          {/* Custom input with unit selector */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            marginTop: spacing.md,
          }}>
            <span style={{ fontSize: fontSize.sm, color: colors.textMuted, whiteSpace: "nowrap" }}>
              {t("nameDetails.customDeadlineLabel")}
            </span>
            <input
              type="number"
              min={0}
              max={10080}
              value={(() => {
                const v = state.deadlineMinutesBeforeKickoff;
                if (v >= 1440 && v % 1440 === 0) return v / 1440;
                if (v >= 60 && v % 60 === 0) return v / 60;
                return v;
              })()}
              onChange={(e) => {
                const num = parseInt(e.target.value) || 0;
                const v = state.deadlineMinutesBeforeKickoff;
                let unit: "min" | "hr" | "day" = "min";
                if (v >= 1440 && v % 1440 === 0) unit = "day";
                else if (v >= 60 && v % 60 === 0) unit = "hr";
                const multiplier = unit === "day" ? 1440 : unit === "hr" ? 60 : 1;
                setField("deadlineMinutesBeforeKickoff", Math.min(num * multiplier, 10080));
              }}
              style={{
                ...inputBaseStyle,
                width: 80,
                textAlign: "center" as const,
                padding: `${spacing.sm}px ${spacing.md}px`,
              }}
            />
            <select
              value={(() => {
                const v = state.deadlineMinutesBeforeKickoff;
                if (v >= 1440 && v % 1440 === 0) return "day";
                if (v >= 60 && v % 60 === 0) return "hr";
                return "min";
              })()}
              onChange={(e) => {
                const v = state.deadlineMinutesBeforeKickoff;
                const unit = e.target.value;
                let currentValue: number;
                if (v >= 1440 && v % 1440 === 0) currentValue = v / 1440;
                else if (v >= 60 && v % 60 === 0) currentValue = v / 60;
                else currentValue = v;
                const multiplier = unit === "day" ? 1440 : unit === "hr" ? 60 : 1;
                setField("deadlineMinutesBeforeKickoff", Math.min(currentValue * multiplier, 10080));
              }}
              style={{
                ...inputBaseStyle,
                width: "auto",
                padding: `${spacing.sm}px ${spacing.md}px`,
                cursor: "pointer",
              }}
            >
              <option value="min">{t("nameDetails.deadlineUnits.min")}</option>
              <option value="hr">{t("nameDetails.deadlineUnits.hr")}</option>
              <option value="day">{t("nameDetails.deadlineUnits.day")}</option>
            </select>
            <span style={{ fontSize: fontSize.sm, color: colors.textMuted, whiteSpace: "nowrap" }}>
              {t("nameDetails.deadlineBefore")}
            </span>
          </div>
        </WizardSubStep>

        {/* 4. Timezone */}
        <WizardSubStep
          number={4}
          title={t("timezoneLabel")}
          subtitle={t("timezoneHelp")}
        >
          <select
            value={state.timeZone || detectedTimezone}
            onChange={(e) => setField("timeZone", e.target.value)}
            aria-label={t("timezoneLabel")}
            style={{
              ...inputBaseStyle,
              cursor: "pointer",
              appearance: "auto" as const,
            }}
          >
            {/* Auto-detected option if not in common list */}
            {!COMMON_TIMEZONES.some(tz => tz.value === (state.timeZone || detectedTimezone)) && (
              <option value={state.timeZone || detectedTimezone}>
                {state.timeZone || detectedTimezone} {t("nameDetails.timezoneDetectedSuffix")}
              </option>
            )}
            {COMMON_TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>
                {tz.label}{tz.value === detectedTimezone ? ` ${t("nameDetails.timezoneDetectedArrow")}` : ""}
              </option>
            ))}
          </select>
        </WizardSubStep>

        {/* 5. Require Approval toggle */}
        <WizardSubStep
          number={5}
          title={t("requireApprovalLabel")}
          subtitle={t("requireApprovalHelp")}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: spacing.md,
          }}>
            <ToggleSwitch
              checked={state.requireApproval}
              onChange={(v) => setField("requireApproval", v)}
            />
          </div>
        </WizardSubStep>
    </PoolWizardStepContainer>
  );
}

// ── Shared styles ─────────────────────────────────────────────

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

const errorTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.error,
  margin: `${spacing.xs}px 0 0`,
  lineHeight: 1.4,
};
