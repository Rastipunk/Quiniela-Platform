"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";
import CapacitySelector from "@/components/CapacitySelector";
import { getUserProfile } from "@/lib/api/user";
import { getToken } from "@/lib/auth";
import { PERSONAL_FREE_LIMIT, CORPORATE_FREE_LIMIT } from "@/lib/pricing";
import { colors, radii } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";

interface Props {
  onSubmit?: () => void;
  submitBusy?: boolean;
}

export function StepCapacity({ onSubmit, submitBusy }: Props) {
  const t = useTranslations("poolWizard");
  const { state, dispatch, goBack } = useWizard();
  const [isAdmin, setIsAdmin] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const token = getToken();
    if (token) {
      getUserProfile(token)
        .then((res) => setIsAdmin(res.user.platformRole === "ADMIN"))
        .catch(() => {});
    }
  }, []);

  const poolType = state.mode === "corporate" ? "corporate" : "personal";
  const freeLimit = state.mode === "corporate" ? CORPORATE_FREE_LIMIT : PERSONAL_FREE_LIMIT;
  const isPaidTier = state.maxParticipants > freeLimit;

  const handleContinueFree = useCallback(() => {
    dispatch({ type: "SET_FIELD", field: "maxParticipants", value: freeLimit });
    // Small delay so state updates before submit
    setTimeout(() => onSubmit?.(), 0);
  }, [dispatch, freeLimit, onSubmit]);

  const buttonBase: React.CSSProperties = {
    padding: isMobile ? "14px 24px" : "12px 32px",
    borderRadius: radii.lg,
    fontSize: isMobile ? 16 : 15,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    transition: "all 0.2s ease",
    width: "100%",
  };

  return (
    <PoolWizardStepContainer
      title={t("capacity.title", { defaultMessage: "Capacidad del pool" })}
      subtitle={t("capacity.subtitle", {
        defaultMessage: "Elige cuantos participantes puede tener tu pool.",
      })}
      icon="&#x1F465;"
    >
      {/* Pool name context */}
      {state.poolName && (
        <p style={{
          textAlign: "center",
          color: colors.textMuted,
          fontSize: 14,
          margin: "0 0 16px",
        }}>
          {t("capacity.yourPool", {
            defaultMessage: "Tu pool: {name}",
            name: state.poolName,
          })}
        </p>
      )}

      <CapacitySelector
        type={poolType}
        selectedCapacity={state.maxParticipants}
        onSelect={(capacity) =>
          dispatch({ type: "SET_FIELD", field: "maxParticipants", value: capacity })
        }
        mode="creation"
        allowPaidTiers={isAdmin}
      />

      {/* CTA Buttons */}
      <div style={{
        marginTop: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}>
        {/* Navigation: Back + Primary CTA */}
        <div style={{
          display: "flex",
          gap: 12,
          width: "100%",
          maxWidth: 480,
        }}>
          <button
            onClick={goBack}
            style={{
              ...buttonBase,
              width: "auto",
              flex: "0 0 auto",
              padding: isMobile ? "14px 20px" : "12px 24px",
              background: colors.bgLight,
              color: colors.textDark,
              border: `1px solid ${colors.borderMedium}`,
            }}
          >
            ← {t("nav.back", { defaultMessage: "Atrás" })}
          </button>

          <button
            onClick={onSubmit}
            disabled={submitBusy || state.maxParticipants < 2}
            style={{
              ...buttonBase,
              background: submitBusy ? colors.disabled : colors.brand,
              color: colors.white,
              opacity: submitBusy ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {submitBusy
              ? t("nav.creating", { defaultMessage: "Creando..." })
              : isPaidTier
                ? <>&#x1F6D2; {t("capacity.proceedToPayment", { defaultMessage: "Proceder al pago" })}</>
                : t("capacity.createPool", { defaultMessage: "Crear Pool" })
            }
          </button>
        </div>

        {/* Secondary: continue free option (only when paid tier is selected) */}
        {isPaidTier && !submitBusy && (
          <button
            onClick={handleContinueFree}
            style={{
              background: "none",
              border: "none",
              color: colors.textMuted,
              fontSize: 13,
              cursor: "pointer",
              textAlign: "center",
              padding: "8px 16px",
              maxWidth: 480,
              lineHeight: 1.4,
            }}
          >
            {state.mode === "corporate" ? (
              <>
                {t("capacity.continueFreeCorpShort", {
                  defaultMessage: "O continúa gratis para probar la plataforma",
                })}
                <br />
                <span style={{ fontSize: 11, color: colors.textLight }}>
                  {t("capacity.continueFreeCorpDetail", {
                    defaultMessage: "(Antes de enviar las invitaciones a tus empleados será necesario hacer el pago por los cupos que necesites)",
                  })}
                </span>
              </>
            ) : (
              t("capacity.continueFree", {
                defaultMessage: "O continúa con {limit} cupos gratis",
                limit: freeLimit,
              })
            )}
          </button>
        )}
      </div>
    </PoolWizardStepContainer>
  );
}
