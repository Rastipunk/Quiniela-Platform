"use client";

import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
const StepAdvancedRules = lazy(
  () => import("./steps/StepAdvancedRules").then((m) => ({ default: m.StepAdvancedRules }))
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
  const isMobile = useIsMobile();
  const router = useRouter();
  const { token } = useAuth();
  const { state, dispatch, isLastStep } = useWizard();

  const [submitBusy, setSubmitBusy] = useState(false);

  // ── Build payload & submit ──────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!token) return;

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
          tournamentInstanceId: state.instanceId,
          poolName: state.poolName.trim(),
          poolDescription: state.poolDescription.trim() || undefined,
          timeZone: state.timeZone,
          deadlineMinutesBeforeKickoff: state.deadlineMinutesBeforeKickoff,
          requireApproval: state.requireApproval,
          pickTypesConfig: state.scoringConfig,
          maxParticipants: state.maxParticipants,
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
          maxParticipants: state.maxParticipants,
        });

        poolId = res.id;
      }

      clearWizardDraft();
      router.push(`/pools/${poolId}`);
    } catch (err) {
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
      case "ADVANCED_RULES":
        return <StepAdvancedRules />;
      case "CAPACITY":
        return <StepCapacity />;
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
          <span style={{ fontSize: fontSize.lg }}>&#8592;</span>
          {t("backToDashboard", { defaultMessage: "Volver al dashboard" })}
        </button>
      </div>

      {/* Progress bar */}
      <PoolWizardProgressBar />

      {/* Step content */}
      <div style={{ flex: 1 }}>
        <Suspense fallback={<StepLoader />}>{renderStep()}</Suspense>
      </div>

      {/* Navigation buttons */}
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          width: "100%",
          padding: isMobile ? "0 16px" : "0 24px",
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
    </div>
  );
}

// ── Outer wrapper (reads mode from URL, provides context) ──
export default function PoolCreationWizard() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: WizardMode =
    modeParam === "corporate" ? "corporate" : "standard";

  return (
    <PoolWizardProvider mode={mode}>
      <WizardInner />
    </PoolWizardProvider>
  );
}
