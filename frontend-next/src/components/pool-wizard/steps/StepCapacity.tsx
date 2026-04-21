"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";
import CapacitySelector from "@/components/CapacitySelector";
import {
  PERSONAL_FREE_LIMIT,
  CORPORATE_FREE_LIMIT,
  getUpgradePrice,
  getUpgradePriceUsd,
  type Currency,
} from "@/lib/pricing";
import { getPaymentCountry } from "@/lib/api/payments";
import { trackViewItem } from "@/lib/ecommerce";
import { colors, radii } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";

interface Props {
  onSubmit?: (capacityOverride?: number) => void;
  submitBusy?: boolean;
}

export function StepCapacity({ onSubmit, submitBusy }: Props) {
  const t = useTranslations("poolWizard");
  const { state, dispatch, goBack } = useWizard();
  const [currency, setCurrency] = useState<Currency>("COP");
  const isMobile = useIsMobile();

  useEffect(() => {
    getPaymentCountry()
      .then((country) => setCurrency(country === "CO" ? "COP" : "USD"))
      .catch(() => {});
  }, []);

  const poolType = state.mode === "corporate" ? "corporate" : "personal";
  const freeLimit = state.mode === "corporate" ? CORPORATE_FREE_LIMIT : PERSONAL_FREE_LIMIT;
  const isPaidTier = state.maxParticipants > freeLimit;

  // GA4 `view_item`: emit whenever the user selects a paid-tier capacity.
  // Guard against duplicate pushes for the same (capacity, currency) tuple
  // so that repeated renders or mouse hover do not spam dataLayer.
  const lastViewItemKey = useRef<string>("");
  useEffect(() => {
    if (!isPaidTier) return;
    const key = `${poolType}:${state.maxParticipants}:${currency}`;
    if (lastViewItemKey.current === key) return;
    lastViewItemKey.current = key;

    const price =
      currency === "USD"
        ? getUpgradePriceUsd(poolType, freeLimit, state.maxParticipants)
        : getUpgradePrice(poolType, freeLimit, state.maxParticipants);
    if (price <= 0) return;
    trackViewItem({
      fromCapacity: freeLimit,
      toCapacity: state.maxParticipants,
      poolType,
      price,
      currency,
    });
  }, [isPaidTier, state.maxParticipants, currency, poolType, freeLimit]);

  const handleContinueFree = useCallback(() => {
    dispatch({ type: "SET_FIELD", field: "maxParticipants", value: freeLimit });
    // Pass freeLimit as override since React state won't update before onSubmit reads it
    onSubmit?.(freeLimit);
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
    <>
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
          currency={currency}
        />
      </PoolWizardStepContainer>

      {/* Sticky CTA — stays visible on mobile matching other wizard steps */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 20,
          background: "var(--bg, #fff)",
          borderTop: `1px solid ${colors.borderLight}`,
          padding: isMobile ? "12px 16px" : "16px 24px",
          maxWidth: 720,
          margin: "16px auto 0",
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
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
            onClick={() => onSubmit?.()}
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
          state.mode === "corporate" ? (
            <button
              onClick={handleContinueFree}
              style={{
                background: "#f0fdf4",
                border: `1px solid #86efac`,
                borderRadius: radii.lg,
                color: "#166534",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "center",
                padding: "14px 20px",
                maxWidth: 480,
                width: "100%",
                lineHeight: 1.5,
              }}
            >
              {t("capacity.continueFreeCorpShort", {
                defaultMessage: "O continúa gratis para probar la plataforma",
              })}
              <br />
              <span style={{ fontSize: 12, fontWeight: 400, color: "#15803d" }}>
                {t("capacity.continueFreeCorpDetail", {
                  defaultMessage: "(Antes de enviar las invitaciones a tus empleados será necesario hacer el pago por los cupos que necesites)",
                })}
              </span>
            </button>
          ) : (
            <button
              onClick={handleContinueFree}
              style={{
                background: "none",
                border: "none",
                color: colors.brand,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "center",
                padding: "8px 16px",
                textDecoration: "underline",
                maxWidth: 480,
              }}
            >
              {t("capacity.continueFree", {
                defaultMessage: "O continúa con {limit} cupos gratis",
                limit: freeLimit,
              })}
            </button>
          )
        )}
      </div>
    </>
  );
}
