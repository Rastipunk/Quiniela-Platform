"use client";

import { useWizard } from "./PoolWizardContext";
import { useTranslations } from "next-intl";
import { colors, radii } from "../../lib/theme";
import { useIsMobile } from "../../hooks/useIsMobile";
import { trackEvent } from "@/lib/analytics";

interface Props {
  onSubmit?: () => void;
  submitLabel?: string;
  submitBusy?: boolean;
}

export function PoolWizardNavButtons({ onSubmit, submitLabel, submitBusy }: Props) {
  const { canGoNext, goNext, goBack, isFirstStep, isLastStep, state } = useWizard();
  const isMobile = useIsMobile();
  const t = useTranslations("poolWizard");

  const buttonBase: React.CSSProperties = {
    padding: isMobile ? "14px 24px" : "12px 32px",
    borderRadius: radii.lg,
    fontSize: isMobile ? 16 : 15,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    transition: "all 0.2s ease",
    minWidth: isMobile ? 0 : 140,
    flex: isMobile ? 1 : undefined,
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
    }}>
      {/* Back button */}
      {!isFirstStep ? (
        <button
          onClick={goBack}
          style={{
            ...buttonBase,
            background: colors.bgLight,
            color: colors.textDark,
            border: `1px solid ${colors.borderMedium}`,
          }}
        >
          ← {t("nav.back", { defaultMessage: "Atrás" })}
        </button>
      ) : (
        <div />
      )}

      {/* Next / Submit button */}
      {isLastStep && onSubmit ? (
        <button
          onClick={onSubmit}
          disabled={submitBusy || !canGoNext}
          style={{
            ...buttonBase,
            background: submitBusy ? colors.disabled : colors.brand,
            color: "#fff",
            opacity: submitBusy ? 0.7 : 1,
          }}
        >
          {submitBusy
            ? t("nav.creating", { defaultMessage: "Creando..." })
            : submitLabel || t("nav.create", { defaultMessage: "Crear Pool" })
          }
        </button>
      ) : (
        <button
          onClick={() => {
            trackEvent("wizard_step", { step_name: state.currentStep, mode: state.mode });
            goNext();
          }}
          disabled={!canGoNext}
          style={{
            ...buttonBase,
            background: canGoNext ? colors.brand : colors.disabled,
            color: canGoNext ? "#fff" : colors.textLight,
          }}
        >
          {t("nav.next", { defaultMessage: "Siguiente" })} →
        </button>
      )}
    </div>
  );
}
