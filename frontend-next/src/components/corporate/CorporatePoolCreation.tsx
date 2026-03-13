"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  createCorporatePool,
  listCatalogInstances,
  type CatalogInstance,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { PoolConfigWizard } from "@/components/PoolConfigWizard";
import CapacitySelector from "@/components/CapacitySelector";
import type { PoolPickTypesConfig } from "@/types/pickConfig";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { TOURNAMENT_CATALOG } from "@/lib/tournamentCatalog";
import { colors, radii, fontSize as fs, fontWeight as fw } from "@/lib/theme";

import { CorporateProgressBar } from "./CorporateProgressBar";
import { StepCompanyInfo } from "./StepCompanyInfo";
import { StepTournamentSelect } from "./StepTournamentSelect";
import { StepPoolDetails } from "./StepPoolDetails";
import { StepScoringConfig } from "./StepScoringConfig";
import { StepEmployeeInvites } from "./StepEmployeeInvites";
import { StepSummary } from "./StepSummary";

function detectTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Bogota";
  } catch {
    return "America/Bogota";
  }
}

const MAX_LOGO_BYTES = 500 * 1024;
const TOTAL_STEPS = 7;

export function CorporatePoolCreation() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const t = useTranslations("enterprise.create");
  const tc = useTranslations("landing.tournaments");
  const token = useMemo(() => getToken(), []);

  // Wizard step (1-7)
  const [step, setStep] = useState(1);
  const [showScoringWizard, setShowScoringWizard] = useState(false);

  // Instances
  const [instances, setInstances] = useState<CatalogInstance[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Step 1: Company info
  const [companyName, setCompanyName] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | undefined>();
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [invitationMessage, setInvitationMessage] = useState("");
  const [logoError, setLogoError] = useState<string | null>(null);

  // Step 2: Tournament
  const [instanceId, setInstanceId] = useState("");

  // Step 3: Pool config
  const [poolName, setPoolName] = useState("");
  const [poolDesc, setPoolDesc] = useState("");
  const [deadline, setDeadline] = useState(10);
  const [timeZone, setTimeZone] = useState(detectTz());
  const [requireApproval, setRequireApproval] = useState(false);

  // Step 4: Scoring
  const [pickTypesConfig, setPickTypesConfig] = useState<PoolPickTypesConfig | string | null>(null);

  // Step 5: Capacity
  const [maxParticipants, setMaxParticipants] = useState<number>(100);

  // Step 6: Employees
  const [emailsText, setEmailsText] = useState("");

  // UI state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    listCatalogInstances(token)
      .then((inst) => {
        setInstances(inst);
        if (inst.length && !instanceId) setInstanceId(inst[0].id);
      })
      .catch((e: any) => setLoadError(e?.message ?? "Error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validEmails = useMemo(() => {
    if (!emailsText.trim()) return [];
    const lines = emailsText
      .split(/[\n,;]+/)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return [...new Set(lines.filter((l) => emailRegex.test(l)))];
  }, [emailsText]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(t("imageSize"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const emailRegex = /[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/g;
      const found = text.match(emailRegex) || [];
      const unique = [...new Set(found.map((e) => e.toLowerCase()))];
      setEmailsText((prev) => {
        const existing = prev.trim();
        return existing ? existing + "\n" + unique.join("\n") : unique.join("\n");
      });
    };
    reader.readAsText(file);
  }

  // Step validation
  function canAdvance(s: number): boolean {
    switch (s) {
      case 1: return companyName.trim().length >= 2;
      case 2: return instanceId.length > 0;
      case 3: return poolName.trim().length >= 3;
      case 4: return pickTypesConfig !== null;
      case 5: return true;
      case 6: return true;
      default: return true;
    }
  }

  function goNext() {
    if (step < TOTAL_STEPS && canAdvance(step)) {
      setStep(step + 1);
    }
  }

  function goBack() {
    if (step > 1) setStep(step - 1);
  }

  // Get tournament name for summary
  function getSelectedTournamentName(): string {
    const inst = (instances ?? []).find((i) => i.id === instanceId);
    if (!inst) return "\u2014";
    const cat = TOURNAMENT_CATALOG.find((c) => c.templateKey === inst.template?.key);
    return cat ? `${cat.emoji} ${inst.name || cat.key}` : inst.name || "\u2014";
  }

  async function handleSubmit() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createCorporatePool(token, {
        companyName: companyName.trim(),
        logoBase64,
        welcomeMessage: welcomeMessage.trim() || undefined,
        invitationMessage: invitationMessage.trim() || undefined,
        tournamentInstanceId: instanceId,
        poolName: poolName.trim(),
        poolDescription: poolDesc.trim() || undefined,
        timeZone,
        deadlineMinutesBeforeKickoff: deadline,
        requireApproval,
        pickTypesConfig,
        maxParticipants,
        emails: validEmails.length > 0 ? validEmails : undefined,
      });
      router.push(`/pools/${result.pool.id}`);
    } catch (e: any) {
      setError(e?.message ?? t("error"));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: isMobile ? 14 : 10,
    fontSize: isMobile ? 16 : 14,
    borderRadius: radii.xl,
    border: `1px solid ${colors.varBorder}`,
    background: colors.varSurface,
    color: colors.varText,
    boxSizing: "border-box",
    ...mobileInteractiveStyles.tapHighlight,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: fs.md,
    fontWeight: fw.semibold,
    marginBottom: 4,
    color: colors.varText,
  };

  // ── If scoring wizard is open, show it full-screen ──
  if (showScoringWizard && instanceId && token) {
    return (
      <PoolConfigWizard
        instanceId={instanceId}
        token={token}
        onComplete={(config) => {
          setPickTypesConfig(config);
          setShowScoringWizard(false);
        }}
        onCancel={() => setShowScoringWizard(false)}
      />
    );
  }

  // ── Progress bar data ──
  const stepLabels = [
    t("step1"), t("step2"), t("step3"),
    t("step4"), t("step5"), t("step6"), t("step7"),
  ];

  const stepDescriptions: Record<number, string> = {
    1: t("step1Desc"),
    2: t("step2Desc"),
    3: t("step3Desc"),
    4: t("step4Desc"),
    5: t("step5Desc"),
    6: t("step6Desc"),
  };

  // ── Navigation buttons ──
  function renderNavButtons() {
    const isLast = step === TOTAL_STEPS;
    return (
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 24,
          justifyContent: "space-between",
        }}
      >
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            style={{
              padding: isMobile ? "12px 20px" : "10px 20px",
              borderRadius: radii.xl,
              border: `1px solid ${colors.varBorder}`,
              background: colors.varSurface,
              color: colors.varText,
              fontSize: fs.base,
              fontWeight: fw.semibold,
              cursor: "pointer",
              minHeight: TOUCH_TARGET.minimum,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {t("back")}
          </button>
        ) : (
          <div />
        )}

        {isLast ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            style={{
              padding: isMobile ? "14px 28px" : "12px 28px",
              borderRadius: radii.xl,
              border: "none",
              background: colors.brand,
              color: "white",
              fontSize: fs.lg,
              fontWeight: fw.bold,
              cursor: busy ? "not-allowed" : "pointer",
              minHeight: TOUCH_TARGET.comfortable,
              opacity: busy ? 0.7 : 1,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {busy ? t("creating") : t("createButton")}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance(step)}
            style={{
              padding: isMobile ? "12px 24px" : "10px 24px",
              borderRadius: radii.xl,
              border: "none",
              background: canAdvance(step) ? colors.brand : colors.varBorder,
              color: canAdvance(step) ? "white" : colors.varMuted,
              fontSize: fs.base,
              fontWeight: fw.bold,
              cursor: canAdvance(step) ? "pointer" : "not-allowed",
              minHeight: TOUCH_TARGET.minimum,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {step === 6 && validEmails.length === 0 ? t("skipStep") : t("next")}
          </button>
        )}
      </div>
    );
  }

  const navButtons = renderNavButtons();

  // ── Step content ──
  function renderStep() {
    switch (step) {
      case 1:
        return (
          <StepCompanyInfo
            companyName={companyName}
            setCompanyName={setCompanyName}
            logoBase64={logoBase64}
            welcomeMessage={welcomeMessage}
            setWelcomeMessage={setWelcomeMessage}
            invitationMessage={invitationMessage}
            setInvitationMessage={setInvitationMessage}
            logoError={logoError}
            handleLogoChange={handleLogoChange}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
            navButtons={navButtons}
            t={t}
          />
        );

      case 2:
        return (
          <StepTournamentSelect
            instanceId={instanceId}
            setInstanceId={setInstanceId}
            instances={instances}
            setPickTypesConfig={setPickTypesConfig}
            loadError={loadError}
            navButtons={navButtons}
            t={t}
            tc={tc}
            labelStyle={labelStyle}
          />
        );

      case 3:
        return (
          <StepPoolDetails
            poolName={poolName}
            setPoolName={setPoolName}
            poolDesc={poolDesc}
            setPoolDesc={setPoolDesc}
            deadline={deadline}
            setDeadline={setDeadline}
            timeZone={timeZone}
            setTimeZone={setTimeZone}
            requireApproval={requireApproval}
            setRequireApproval={setRequireApproval}
            isMobile={isMobile}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
            navButtons={navButtons}
            t={t}
          />
        );

      case 4:
        return (
          <StepScoringConfig
            pickTypesConfig={pickTypesConfig}
            setShowScoringWizard={setShowScoringWizard}
            navButtons={navButtons}
            t={t}
          />
        );

      // Step 5: Capacity — inline (~25 lines)
      case 5:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <CapacitySelector
              type="corporate"
              selectedCapacity={maxParticipants}
              onSelect={setMaxParticipants}
              mode="creation"
            />
            <div style={{
              padding: "16px 18px",
              borderRadius: radii["2xl"],
              background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
              border: `2px solid ${colors.successBorderDark}`,
              fontSize: fs.md,
              color: colors.successDarker,
              lineHeight: 1.7,
            }}>
              {t("aprilNotice")}
            </div>
            {navButtons}
          </div>
        );

      case 6:
        return (
          <StepEmployeeInvites
            emailsText={emailsText}
            setEmailsText={setEmailsText}
            validEmails={validEmails}
            handleCsvUpload={handleCsvUpload}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
            navButtons={navButtons}
            t={t}
          />
        );

      case 7:
        return (
          <StepSummary
            companyName={companyName}
            tournamentName={getSelectedTournamentName()}
            poolName={poolName}
            deadline={deadline}
            pickTypesConfig={pickTypesConfig}
            maxParticipants={maxParticipants}
            validEmails={validEmails}
            requireApproval={requireApproval}
            error={error}
            navButtons={navButtons}
            t={t}
          />
        );

      default:
        return null;
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: isMobile ? "0 auto" : "24px auto", padding: isMobile ? 16 : 24 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: isMobile ? "1.4rem" : "1.6rem", fontWeight: fw.extrabold, color: colors.varText, margin: 0 }}>
          {t("title")}
        </h1>
        <p style={{ color: colors.varMuted, fontSize: fs.md, marginTop: 4, marginBottom: 0 }}>
          {t("subtitle")}
        </p>
      </div>

      <CorporateProgressBar
        step={step}
        totalSteps={TOTAL_STEPS}
        stepLabels={stepLabels}
        stepDescriptions={stepDescriptions}
        isMobile={isMobile}
        onStepClick={setStep}
        stepOfLabel={t("stepOf", { current: step, total: TOTAL_STEPS })}
      />

      {/* Step content card */}
      <div
        style={{
          padding: isMobile ? 16 : 24,
          borderRadius: radii["2xl"],
          border: `1px solid ${colors.varBorder}`,
          background: colors.varSurface,
        }}
      >
        {renderStep()}
      </div>
    </div>
  );
}
