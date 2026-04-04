"use client";

import { useTranslations } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";

export function StepAdvancedRules() {
  const t = useTranslations("poolWizard");
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

  const sectionStyle: React.CSSProperties = {
    padding: isMobile ? spacing.lg : spacing.xl,
    borderRadius: radii["2xl"],
    border: `1px solid ${colors.borderLight}`,
    background: colors.bgLighter,
    marginBottom: spacing.lg,
  };

  const toggleRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  };

  const toggleTrackStyle = (on: boolean): React.CSSProperties => ({
    position: "relative",
    width: 48,
    height: 26,
    borderRadius: 13,
    background: on ? colors.successAlt : colors.disabled,
    cursor: "pointer",
    transition: "background 0.2s ease",
    flexShrink: 0,
    border: "none",
    padding: 0,
  });

  const toggleThumbStyle = (on: boolean): React.CSSProperties => ({
    position: "absolute",
    top: 3,
    left: on ? 25 : 3,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: colors.white,
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "left 0.2s ease",
  });

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
      {/* Extra time section */}
      {knockoutPhases.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={{
            margin: 0,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: colors.text,
            marginBottom: spacing.xs,
          }}>
            {t("advancedRules.extraTimeTitle", {
              defaultMessage: "Tiempo extra en eliminatorias",
            })}
          </h3>
          <p style={{
            margin: `0 0 ${spacing.lg}px`,
            fontSize: fontSize.md,
            color: colors.textMuted,
            lineHeight: 1.5,
          }}>
            {t("advancedRules.extraTimeDesc", {
              defaultMessage:
                "Si se activa, los resultados de tiempo extra y penales se consideran para el marcador final en esa fase.",
            })}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            {knockoutPhases.map((phase) => (
              <div key={phase.phaseId} style={toggleRowStyle}>
                <div>
                  <span style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.medium,
                    color: colors.textDark,
                  }}>
                    {phase.phaseName}
                  </span>
                  {!phase.includeExtraTime && (
                    <span style={badgeStyle}>
                      {t("advancedRules.recommended", { defaultMessage: "Recomendado" })}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleExtraTime(phase.phaseId)}
                  style={toggleTrackStyle(!!phase.includeExtraTime)}
                  aria-label={`Toggle extra time for ${phase.phaseName}`}
                >
                  <div style={toggleThumbStyle(!!phase.includeExtraTime)} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info note */}
      <div style={{
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
