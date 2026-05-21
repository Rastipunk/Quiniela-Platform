"use client";

import { useTranslations } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";
import { WizardSubStep } from "../WizardSubStep";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { formatPhaseFullName } from "@/app/[locale]/(authenticated)/pools/[poolId]/components/poolHelpers";

export function StepAdvancedRules() {
  const t = useTranslations("poolWizard");
  const tp = useTranslations("pool");
  const isMobile = useIsMobile();
  const { state, dispatch } = useWizard();

  const knockoutPhases = state.scoringConfig.filter(
    (p) => p.phaseId !== "group_stage" && !p.phaseId.includes("group")
  );

  // ── Toggle extra time for a phase ─────────────────────────
  function toggleExtraTime(phaseId: string) {
    const updated = state.scoringConfig.map((p) =>
      p.phaseId === phaseId
        ? { ...p, includeExtraTime: !p.includeExtraTime }
        : p
    );
    dispatch({ type: "UPDATE_SCORING_CONFIG", config: updated });
  }

  // ── Styles ────────────────────────────────────────────────

  const toggleRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  };

  const badgeStyle: React.CSSProperties = {
    display: "inline-block",
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.successDarker,
    background: colors.successBgAlt,
    border: `1px solid ${colors.successBorder}`,
    borderRadius: radii.pill,
    padding: "2px 8px",
    marginLeft: spacing.sm,
  };

  return (
    <PoolWizardStepContainer
      title={t("advancedRules.title", { defaultMessage: "Reglas avanzadas" })}
      subtitle={t("advancedRules.subtitle", {
        defaultMessage: "Ajustes opcionales para personalizar la experiencia. Todos tienen valores predeterminados sensatos.",
      })}
      icon="&#x2699;&#xFE0F;"
    >
      {/* 1. Extra time */}
      {knockoutPhases.length > 0 && (
        <WizardSubStep
          isFirst
          number={1}
          title={t("advancedRules.extraTimeTitle", {
            defaultMessage: "Incluir tiempo extra",
          })}
          subtitle={t("advancedRules.extraTimeDesc", {
            defaultMessage:
              "Contar los goles del tiempo extra en eliminatorias (no incluye penales).",
          })}
        >
          {/* Explanation boxes */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: spacing.sm,
            marginBottom: spacing.lg,
          }}>
            <div style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: radii.lg,
              background: colors.successBgLight,
              border: `1px solid ${colors.successBorder}`,
              fontSize: fontSize.sm,
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: fontWeight.bold, color: colors.successDarker, marginBottom: 2 }}>
                {t("advancedRules.offExplanationTitle", { defaultMessage: "Desactivado (recomendado)" })}
              </div>
              <div style={{ color: colors.successDarker }}>
                {t("advancedRules.offExplanation", { defaultMessage: "Solo cuenta el resultado de los 90 minutos. Si predices 1-1 y el partido termina 1-1 (pero en extra time gana 2-1), tu predicción es correcta." })}
              </div>
            </div>
            <div style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: radii.lg,
              background: colors.warningBgLight,
              border: `1px solid ${colors.warningBorderLight}`,
              fontSize: fontSize.sm,
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: fontWeight.bold, color: colors.warningDarker, marginBottom: 2 }}>
                {t("advancedRules.onExplanationTitle", { defaultMessage: "Activado" })}
              </div>
              <div style={{ color: colors.warningDarker }}>
                {t("advancedRules.onExplanation", { defaultMessage: "Cuenta el resultado final incluyendo tiempo extra. Si predices 1-1 pero el partido termina 2-1 en extra time, tu predicción falla." })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            {knockoutPhases.map((phase) => (
              <div key={phase.phaseId} style={toggleRowStyle}>
                <div>
                  <span style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.medium,
                    color: colors.textDark,
                  }}>
                    {formatPhaseFullName(phase.phaseId, tp)}
                  </span>
                  {!phase.includeExtraTime && (
                    <span style={badgeStyle}>
                      {t("advancedRules.recommended", { defaultMessage: "Recomendado" })}
                    </span>
                  )}
                </div>
                <ToggleSwitch
                  checked={!!phase.includeExtraTime}
                  onChange={() => toggleExtraTime(phase.phaseId)}
                  activeColor={colors.successAlt}
                  ariaLabel={`Toggle extra time for ${formatPhaseFullName(phase.phaseId, tp)}`}
                />
              </div>
            ))}
          </div>
        </WizardSubStep>
      )}

      {/* Info note */}
      <div style={{
        marginTop: spacing.xl,
        padding: spacing.md,
        borderRadius: radii["2xl"],
        background: colors.infoBgLight,
        border: `1px solid ${colors.infoBorder}`,
        fontSize: fontSize.md,
        color: colors.infoDarker,
        lineHeight: 1.5,
      }}>
        {t("advancedRules.note", {
          defaultMessage:
            "Estos ajustes son opcionales. Si no los cambias, se usaran valores por defecto que funcionan bien para la mayoria de quinielas.",
        })}
      </div>
    </PoolWizardStepContainer>
  );
}
