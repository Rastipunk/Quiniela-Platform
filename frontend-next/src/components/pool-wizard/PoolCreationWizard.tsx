"use client";

import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/hooks/useAuth";
import {
  PoolWizardProvider,
  useWizard,
  clearWizardDraft,
} from "./PoolWizardContext";
import { PoolWizardProgressBar } from "./PoolWizardProgressBar";
import { PoolWizardNavButtons } from "./PoolWizardNavButtons";
import { createPool } from "@/lib/api/pools";
import { createCorporatePool } from "@/lib/api/corporate";
import type { WizardMode } from "@/types/poolWizard";
import { trackEvent } from "@/lib/analytics";
import { refreshUserProperties } from "@/lib/authAnalytics";
import { trackMetaCustomEvent, trackMetaEvent } from "@/lib/metaPixel";
import { trackBeginCheckout } from "@/lib/ecommerce";
import { createCheckout, createMpCheckout, getPaymentCountry } from "@/lib/api/payments";
import { PERSONAL_FREE_LIMIT, CORPORATE_FREE_LIMIT } from "@/lib/pricing";

// ── Dynamic step imports (code-split each step) ────────────
const StepCompanyInfo = lazy(
  () => import("./steps/corporate/StepCompanyInfo").then((m) => ({ default: m.StepCompanyInfo }))
);
const StepTournament = lazy(
  () => import("./steps/StepTournament").then((m) => ({ default: m.StepTournament }))
);
const StepNameDetails = lazy(
  () => import("./steps/StepNameDetails").then((m) => ({ default: m.StepNameDetails }))
);
const StepScoring = lazy(
  () => import("./steps/StepScoring").then((m) => ({ default: m.StepScoring }))
);
const StepCapacity = lazy(
  () => import("./steps/StepCapacity").then((m) => ({ default: m.StepCapacity }))
);
const StepEmployeeInvites = lazy(
  () => import("./steps/corporate/StepEmployeeInvites").then((m) => ({ default: m.StepEmployeeInvites }))
);
const StepSummary = lazy(
  () => import("./steps/StepSummary").then((m) => ({ default: m.StepSummary }))
);

// ── Loading fallback ────────────────────────────────────────
function StepLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
        color: colors.textMuted,
        fontSize: fontSize.lg,
      }}
    >
      Cargando...
    </div>
  );
}

// ── Inner wizard (needs context) ────────────────────────────
function WizardInner() {
  const t = useTranslations("poolWizard");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const router = useRouter();
  const { token } = useAuth();
  const { state, dispatch, isLastStep } = useWizard();

  const [submitBusy, setSubmitBusy] = useState(false);

  // ── Build payload & submit ──────────────────────────────
  const handleSubmit = useCallback(async (capacityOverride?: number) => {
    if (!token) return;

    const effectiveCapacity = capacityOverride ?? state.maxParticipants;

    setSubmitBusy(true);
    dispatch({ type: "SET_FIELD", field: "error", value: null });
    dispatch({ type: "SET_FIELD", field: "busy", value: true });

    try {
      let poolId: string;

      if (state.mode === "corporate") {
        // Parse employee emails
        const emails = state.employeeEmails
          .split(/[,\n]/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

        const res = await createCorporatePool(token, {
          companyName: state.companyName.trim(),
          logoBase64: state.logoBase64 || undefined,
          welcomeMessage: state.welcomeMessage.trim() || undefined,
          invitationMessage: state.invitationMessage.trim() || undefined,
          primaryColor: state.primaryColor || undefined,
          secondaryColor: state.secondaryColor || undefined,
          tournamentInstanceId: state.instanceId,
          poolName: state.poolName.trim(),
          poolDescription: state.poolDescription.trim() || undefined,
          timeZone: state.timeZone,
          deadlineMinutesBeforeKickoff: state.deadlineMinutesBeforeKickoff,
          requireApproval: state.requireApproval,
          pickTypesConfig: state.scoringConfig,
          maxParticipants: effectiveCapacity,
          emails: emails.length > 0 ? emails : undefined,
        });

        poolId = (res.pool as Record<string, string>).id;
      } else {
        const res = await createPool(token, {
          tournamentInstanceId: state.instanceId,
          name: state.poolName.trim(),
          description: state.poolDescription.trim() || undefined,
          timeZone: state.timeZone,
          deadlineMinutesBeforeKickoff: state.deadlineMinutesBeforeKickoff,
          pickTypesConfig: state.scoringConfig,
          requireApproval: state.requireApproval,
          maxParticipants: effectiveCapacity,
        });

        poolId = res.id;
      }

      clearWizardDraft();
      trackEvent("pool_created", {
        pool_type: state.mode,
        tournament: state.instanceName,
        capacity: effectiveCapacity,
        scoring_style: state.scoringStyle,
      });
      trackMetaCustomEvent("PoolCreated", {
        content_name: state.mode,
        content_category: state.instanceName,
      });
      // pool_count just incremented — re-fetch aggregated snapshot so the
      // next GA4 event carries the updated tier / pool_count. Fire-and-forget
      // so wizard navigation is not blocked on analytics I/O.
      void refreshUserProperties();

      // Check if payment is needed (user selected capacity above free limit)
      const freeLimit = state.mode === "corporate" ? CORPORATE_FREE_LIMIT : PERSONAL_FREE_LIMIT;
      const poolType = state.mode === "corporate" ? "corporate" : "personal";
      if (effectiveCapacity > freeLimit && token) {
        try {
          // Detect country to choose gateway
          const country = await getPaymentCountry();
          const isColombia = country === "CO";

          if (isColombia) {
            // Mercado Pago (Colombia/COP) — navigate to embedded Payment Brick
            const mpData = await createMpCheckout(poolId, effectiveCapacity);
            trackBeginCheckout({
              fromCapacity: freeLimit,
              toCapacity: effectiveCapacity,
              poolType,
              price: mpData.amountCop,
              currency: "COP",
            });
            // Meta funnel parity with GA4: `InitiateCheckout` fires here so
            // Meta Ads Manager sees the same step the GA4 funnel reports.
            trackMetaEvent("InitiateCheckout", {
              content_type: "product",
              content_ids: [`pool_upgrade_${poolType}_${effectiveCapacity}`],
              num_items: 1,
              currency: "COP",
              value: mpData.amountCop,
            });
            const params = new URLSearchParams({
              publicKey: mpData.publicKey || process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "",
              amount: String(mpData.amountCop),
              paymentId: mpData.paymentId,
              reference: mpData.reference,
              preferenceId: mpData.preferenceId,
              poolId,
              // Passed through so the Brick page can emit add_payment_info /
              // purchase with the same canonical shape (no price recomputation
              // client-side means GA4 value stays consistent across events).
              fromCapacity: String(freeLimit),
              toCapacity: String(effectiveCapacity),
              poolType,
            });
            const localePrefix = locale === "es" ? "" : `/${locale}`;
            window.location.href = `${localePrefix}/pago/checkout?${params.toString()}`;
            return;
          } else {
            // Polar redirect (International/USD)
            const checkout = await createCheckout(poolId, effectiveCapacity);
            trackBeginCheckout({
              fromCapacity: freeLimit,
              toCapacity: effectiveCapacity,
              poolType,
              price: checkout.amountUsd,
              currency: "USD",
            });
            trackMetaEvent("InitiateCheckout", {
              content_type: "product",
              content_ids: [`pool_upgrade_${poolType}_${effectiveCapacity}`],
              num_items: 1,
              currency: "USD",
              value: checkout.amountUsd,
            });
            window.location.href = checkout.checkoutUrl;
            return;
          }
        } catch (checkoutErr) {
          console.error("[Wizard] Checkout creation failed:", checkoutErr);
          // If checkout fails, still go to pool (they can expand later)
        }
      }

      router.push(`/pools/${poolId}`);
    } catch (err) {
      // Surface the failure: log to console for diagnostics AND show
      // a banner so the user actually sees something happened (the
      // wizard used to silently swallow errors into state.error with
      // no UI to render them, which read as "the button does nothing").
      console.error("[PoolCreationWizard] Pool creation failed:", err);
      const message =
        err instanceof Error ? err.message : "Error al crear el pool";
      dispatch({ type: "SET_FIELD", field: "error", value: message });
    } finally {
      setSubmitBusy(false);
      dispatch({ type: "SET_FIELD", field: "busy", value: false });
    }
  }, [token, state, dispatch, router]);

  // ── Render current step ─────────────────────────────────
  function renderStep() {
    switch (state.currentStep) {
      case "COMPANY_INFO":
        return <StepCompanyInfo />;
      case "TOURNAMENT":
        return <StepTournament />;
      case "NAME_DETAILS":
        return <StepNameDetails />;
      case "SCORING":
        return <StepScoring />;
      case "CAPACITY":
        return <StepCapacity onSubmit={handleSubmit} submitBusy={submitBusy} />;
      case "EMPLOYEE_INVITES":
        return <StepEmployeeInvites />;
      case "SUMMARY":
        return <StepSummary />;
      default:
        return null;
    }
  }

  return (
    <div
      style={{
        maxWidth: 840,
        margin: "0 auto",
        padding: isMobile ? "16px 0" : "24px 16px",
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Back to dashboard link */}
      <div style={{ padding: isMobile ? "0 16px 8px" : "0 0 12px" }}>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          style={{
            background: "none",
            border: "none",
            color: colors.textMuted,
            fontSize: fontSize.md,
            fontWeight: fontWeight.medium,
            cursor: "pointer",
            padding: `${spacing.xs}px 0`,
            display: "flex",
            alignItems: "center",
            gap: spacing.xs,
          }}
        >
          {t("backToDashboard", { defaultMessage: "← Volver a mis pools" })}
        </button>
      </div>

      {/* Progress bar */}
      <PoolWizardProgressBar />

      {/* Submit error banner — sticks to the top of the step content
          when handleSubmit catches a failure. Without this the error
          silently goes into state and the user sees the "Crear Pool"
          button do nothing. */}
      {state.error && (
        <div
          role="alert"
          style={{
            margin: "12px auto 0",
            maxWidth: 720,
            width: "calc(100% - 24px)",
            padding: "12px 16px",
            borderRadius: 8,
            background: colors.errorBg,
            border: `1px solid ${colors.errorBorder}`,
            color: colors.error,
            fontSize: 14,
            lineHeight: 1.5,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>&#9888;&#65039;</span>
          <div style={{ flex: 1 }}>
            <strong style={{ display: "block", marginBottom: 2 }}>
              {t("nav.errorTitle", { defaultMessage: "No pudimos crear el pool" })}
            </strong>
            <span>{state.error}</span>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_FIELD", field: "error", value: null })}
            aria-label={t("nav.dismissError", { defaultMessage: "Cerrar" })}
            style={{
              background: "transparent",
              border: "none",
              color: colors.error,
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              padding: 4,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Step content */}
      <div style={{ flex: 1 }}>
        <Suspense fallback={<StepLoader />}>{renderStep()}</Suspense>
      </div>

      {/* Navigation buttons — hidden on CAPACITY step (it renders its own CTA) */}
      {state.currentStep !== "CAPACITY" && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 20,
            background: "var(--bg, #fff)",
            borderTop: `1px solid ${colors.borderLight}`,
            padding: isMobile ? "12px 16px" : "16px 24px",
            maxWidth: 720,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <PoolWizardNavButtons
            onSubmit={isLastStep ? handleSubmit : undefined}
            submitLabel={
              state.mode === "corporate"
                ? t("nav.createCorporate", {
                    defaultMessage: "Crear Pool Corporativo",
                  })
                : t("nav.create", { defaultMessage: "Crear Pool" })
            }
            submitBusy={submitBusy}
          />
        </div>
      )}
    </div>
  );
}

// ── Outer wrapper ──
//
// Mode resolution priority:
//   1. Explicit `mode` prop (when mounted from a dedicated route like /empresas/crear)
//   2. `?mode=corporate` URL search param (when mounted from a generic creation route)
//   3. Default to "standard"
//
// Using a prop guarantees the wizard renders correctly even on routes that
// don't pass query params (the /empresas/crear page) without forcing a redirect.
export default function PoolCreationWizard({ mode: modeProp }: { mode?: WizardMode } = {}) {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: WizardMode =
    modeProp ?? (modeParam === "corporate" ? "corporate" : "standard");

  return (
    <PoolWizardProvider mode={mode}>
      <WizardInner />
    </PoolWizardProvider>
  );
}
