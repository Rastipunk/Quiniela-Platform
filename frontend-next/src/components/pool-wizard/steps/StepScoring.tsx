"use client";

// Thin wrapper that mounts the reusable ScoringEditor inside the
// pool-creation wizard. All scoring logic, presets, multipliers,
// example calculator, etc. live in components/scoring-editor —
// this file only adapts wizard state/dispatch to the editor's
// props-driven API and provides the wizard step's title/header.

import { useTranslations } from "next-intl";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";
import { ScoringEditor } from "@/components/scoring-editor/ScoringEditor";
import { PRESETS } from "@/components/scoring-editor/presets";
import type { ScoringStyle } from "@/types/poolWizard";

export function StepScoring() {
  const { state, dispatch } = useWizard();
  const t = useTranslations("poolWizard");

  const isPicker = !state.scoringStyle;
  const activePreset = isPicker
    ? null
    : PRESETS.find((p) => p.key === state.scoringStyle);

  return (
    <PoolWizardStepContainer
      title={isPicker
        ? t("scoring.title", { defaultMessage: "Sistema de Puntuacion" })
        : t("scoring.configTitle", { defaultMessage: "Configurar Puntuacion" })
      }
      subtitle={isPicker
        ? t("scoring.subtitle", { defaultMessage: "Elige como se calcularan los puntos en tu quiniela" })
        : t("scoring.configSubtitle", { defaultMessage: "Revisa y ajusta como se otorgan los puntos en cada fase" })
      }
      icon={activePreset?.icon ?? "\u{1F3B2}"}
    >
      <ScoringEditor
        scoringStyle={state.scoringStyle}
        scoringConfig={state.scoringConfig}
        instancePhases={state.instancePhases}
        // ScoringEditor passes `null` when the user hits "Cambiar" to
        // reset the picker. The wizard reducer accepts null (it just
        // sets state.scoringStyle = action.style and the state field
        // is typed `ScoringStyle | null`), but WizardAction's type
        // statically requires ScoringStyle. Cast for the bridge.
        onSetScoring={(style, config) =>
          dispatch({ type: "SET_SCORING", style: style as ScoringStyle, config })
        }
        onUpdateScoringConfig={(config) => dispatch({ type: "UPDATE_SCORING_CONFIG", config })}
      />
    </PoolWizardStepContainer>
  );
}

export default StepScoring;
