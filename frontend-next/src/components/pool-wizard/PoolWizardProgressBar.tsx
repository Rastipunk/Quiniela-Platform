"use client";

import { useWizard } from "./PoolWizardContext";
import { useTranslations } from "next-intl";
import { colors, radii } from "../../lib/theme";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { WizardStep } from "../../types/poolWizard";

const STEP_ICONS: Record<WizardStep, string> = {
  COMPANY_INFO: "🏢",
  TOURNAMENT: "🏆",
  NAME_DETAILS: "✏️",
  SCORING: "⭐",
  ADVANCED_RULES: "⚙️",
  CAPACITY: "👥",
  EMPLOYEE_INVITES: "📧",
  SUMMARY: "✅",
};

export function PoolWizardProgressBar() {
  const { steps, currentStepIndex, goToStep } = useWizard();
  const isMobile = useIsMobile();
  const t = useTranslations("poolWizard");

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: isMobile ? 2 : 4,
      padding: isMobile ? "12px 8px" : "16px 24px",
      marginBottom: isMobile ? 16 : 24,
    }}>
      {steps.map((step, i) => {
        const isCompleted = i < currentStepIndex;
        const isCurrent = i === currentStepIndex;
        const isClickable = i < currentStepIndex;

        return (
          <div key={step} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            {/* Step dot */}
            <button
              onClick={() => isClickable && goToStep(step)}
              disabled={!isClickable}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                border: "none",
                background: "none",
                cursor: isClickable ? "pointer" : "default",
                padding: isMobile ? "4px 2px" : "4px 8px",
                minWidth: 0,
                flex: 1,
              }}
              title={t(`steps.${step}`)}
            >
              <div style={{
                width: isMobile ? 28 : 36,
                height: isMobile ? 28 : 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: isMobile ? 12 : 16,
                fontWeight: 600,
                transition: "all 0.3s ease",
                background: isCurrent
                  ? colors.brand
                  : isCompleted
                    ? colors.successAlt
                    : colors.bgLight,
                color: isCurrent || isCompleted ? "#fff" : colors.textMuted,
                border: isCurrent
                  ? `2px solid ${colors.brand}`
                  : isCompleted
                    ? `2px solid ${colors.successAlt}`
                    : `2px solid ${colors.borderLight}`,
              }}>
                {isCompleted ? "✓" : STEP_ICONS[step]}
              </div>

              {!isMobile && (
                <span style={{
                  fontSize: 11,
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? colors.brand : isCompleted ? colors.successDarker : colors.textLight,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 80,
                }}>
                  {t(`steps.${step}`)}
                </span>
              )}
            </button>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div style={{
                height: 2,
                flex: 1,
                minWidth: isMobile ? 8 : 16,
                background: i < currentStepIndex
                  ? colors.successAlt
                  : colors.borderLight,
                borderRadius: 1,
                transition: "background 0.3s ease",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
