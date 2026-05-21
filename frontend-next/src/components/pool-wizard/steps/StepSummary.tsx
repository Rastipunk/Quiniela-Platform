"use client";

import { useTranslations } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";
import type { WizardStep } from "@/types/poolWizard";
import { formatPhaseFullName } from "@/app/[locale]/(authenticated)/pools/[poolId]/components/poolHelpers";

export function StepSummary() {
  const t = useTranslations("poolWizard");
  const tp = useTranslations("pool");
  const tDyn = t as unknown as (key: string) => string;
  const isMobile = useIsMobile();
  const { state, goToStep } = useWizard();

  const isCorporate = state.mode === "corporate";

  // Build scoring summary string
  const enabledTypes = state.scoringConfig
    .flatMap((p) => p.matchPicks?.types ?? [])
    .filter((t) => t.enabled);
  const uniqueTypes = [...new Set(enabledTypes.map((t) => t.key))];

  const hasAutoScaling = state.scoringConfig.some(
    (p) => p.matchPicks?.autoScaling?.enabled
  );

  const extraTimePhases = state.scoringConfig
    .filter((p) => p.includeExtraTime)
    .map((p) => formatPhaseFullName(p.phaseId, tp));

  // ── Section row component ───────────────────────────────

  function SummarySection({
    label,
    value,
    step,
  }: {
    label: string;
    value: string | React.ReactNode;
    step: WizardStep;
    multiline?: boolean;
  }) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          padding: `${isMobile ? 10 : spacing.md}px 0`,
          borderBottom: `1px solid ${colors.borderLight}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              color: colors.textMuted,
              textTransform: "uppercase" as const,
              letterSpacing: 0.5,
              marginBottom: 2,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: isMobile ? fontSize.base : fontSize.lg,
              fontWeight: fontWeight.medium,
              color: colors.text,
              lineHeight: 1.3,
            }}
          >
            {value}
          </div>
        </div>
        <button
          type="button"
          onClick={() => goToStep(step)}
          style={{
            background: "none",
            border: "none",
            color: colors.brand,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            cursor: "pointer",
            padding: `2px ${spacing.xs}px`,
            borderRadius: radii.md,
            transition: "background 0.15s",
            flexShrink: 0,
          }}
        >
          {t("summary.edit")}
        </button>
      </div>
    );
  }

  return (
    <PoolWizardStepContainer
      title={t("summary.title")}
      subtitle={t("summary.subtitle")}
      icon="&#x2705;"
    >
      {/* Error display */}
      {state.error && (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radii["2xl"],
            background: colors.errorBg,
            border: `1px solid ${colors.errorBorder}`,
            color: colors.error,
            fontSize: fontSize.base,
            marginBottom: spacing.lg,
          }}
        >
          {state.error}
        </div>
      )}

      {/* Company info — corporate only */}
      {isCorporate && (
        <SummarySection
          label={t("summary.company")}
          value={state.companyName}
          step="COMPANY_INFO"
        />
      )}

      {/* Tournament */}
      <SummarySection
        label={t("summary.tournament")}
        value={state.instanceName || "—"}
        step="TOURNAMENT"
      />

      {/* Pool name + description */}
      <SummarySection
        label={t("summary.poolName")}
        value={
          <div>
            <div>{state.poolName}</div>
            {state.poolDescription && (
              <div
                style={{
                  fontSize: fontSize.md,
                  color: colors.textMuted,
                  marginTop: 2,
                }}
              >
                {state.poolDescription}
              </div>
            )}
          </div>
        }
        step="NAME_DETAILS"
        multiline
      />

      {/* Scoring */}
      <SummarySection
        label={t("summary.scoring")}
        value={
          <div>
            <div>
              {state.scoringStyle
                ? tDyn(`scoring.presets.${state.scoringStyle}.name`)
                : "—"}
            </div>
            {uniqueTypes.length > 0 && (
              <div
                style={{
                  fontSize: fontSize.sm,
                  color: colors.textMuted,
                  marginTop: 2,
                }}
              >
                {t("summary.pickTypes", { count: uniqueTypes.length })}
              </div>
            )}
            {hasAutoScaling && (
              <div
                style={{
                  fontSize: fontSize.sm,
                  color: colors.brand,
                  marginTop: 2,
                }}
              >
                {t("summary.scalingEnabled")}
              </div>
            )}
            {extraTimePhases.length > 0 && (
              <div
                style={{
                  fontSize: fontSize.sm,
                  color: colors.textMuted,
                  marginTop: 2,
                }}
              >
                {t("summary.extraTime")}{" "}
                {extraTimePhases.join(", ")}
              </div>
            )}
          </div>
        }
        step="SCORING"
        multiline
      />

      {/* Deadline */}
      <SummarySection
        label={t("summary.deadline")}
        value={t("summary.deadlineValue", {
          minutes: state.deadlineMinutesBeforeKickoff,
        })}
        step="NAME_DETAILS"
      />

      {/* Company details — corporate only */}
      {isCorporate && state.welcomeMessage && (
        <SummarySection
          label={t("summary.welcomeMessage")}
          value={
            <span
              style={{
                fontSize: fontSize.base,
                color: colors.textDark,
                whiteSpace: "pre-wrap",
              }}
            >
              {state.welcomeMessage.length > 120
                ? state.welcomeMessage.slice(0, 120) + "..."
                : state.welcomeMessage}
            </span>
          }
          step="COMPANY_INFO"
          multiline
        />
      )}

      {/* Info note */}
      <div
        style={{
          marginTop: isMobile ? spacing.md : spacing.xl,
          padding: isMobile ? spacing.sm : spacing.md,
          borderRadius: radii.xl,
          background: colors.infoBgLight,
          border: `1px solid ${colors.infoBorder}`,
          fontSize: fontSize.sm,
          color: colors.infoDarker,
          lineHeight: 1.4,
          textAlign: "center",
        }}
      >
        {t("summary.note")}
      </div>
    </PoolWizardStepContainer>
  );
}
