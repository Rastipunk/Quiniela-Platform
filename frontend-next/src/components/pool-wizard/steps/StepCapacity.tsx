"use client";

import { useTranslations } from "next-intl";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";
import CapacitySelector from "@/components/CapacitySelector";

export function StepCapacity() {
  const t = useTranslations("poolWizard");
  const { state, dispatch } = useWizard();

  const poolType = state.mode === "corporate" ? "corporate" : "personal";

  return (
    <PoolWizardStepContainer
      title={t("capacity.title", { defaultMessage: "Capacidad del pool" })}
      subtitle={t("capacity.subtitle", {
        defaultMessage: "Elige cuantos participantes puede tener tu pool.",
      })}
      icon="&#x1F465;"
    >
      <CapacitySelector
        type={poolType}
        selectedCapacity={state.maxParticipants}
        onSelect={(capacity) =>
          dispatch({ type: "SET_FIELD", field: "maxParticipants", value: capacity })
        }
        mode="creation"
      />
    </PoolWizardStepContainer>
  );
}
