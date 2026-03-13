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

  // Wizard step (1-6)
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
      case 5: return true; // capacity — always valid (default 100)
      case 6: return true; // employees — optional
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
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    boxSizing: "border-box",
    ...mobileInteractiveStyles.tapHighlight,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4,
    color: "var(--text)",
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

  // ── Progress bar ──
  const stepLabels = [
    t("step1"), t("step2"), t("step3"),
    t("step4"), t("step5"), t("step6"), t("step7"),
  ];

  function renderProgressBar() {
    return (
      <div style={{ marginBottom: 28 }}>
        {/* Step counter */}
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginBottom: 12, fontWeight: 500 }}>
          {t("stepOf", { current: step, total: TOTAL_STEPS })}
        </div>

        {/* Progress dots + lines */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
          {stepLabels.map((_, i) => {
            const stepNum = i + 1;
            const isCompleted = stepNum < step;
            const isCurrent = stepNum === step;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                {/* Dot */}
                <div
                  style={{
                    width: isCurrent ? 36 : 28,
                    height: isCurrent ? 36 : 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isCurrent ? 14 : 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: isCompleted
                      ? "#4f46e5"
                      : isCurrent
                        ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                        : "var(--surface)",
                    color: isCompleted || isCurrent ? "white" : "var(--muted)",
                    border: isCompleted || isCurrent ? "2px solid #4f46e5" : "2px solid var(--border)",
                    transition: "all 0.2s ease",
                    cursor: isCompleted ? "pointer" : "default",
                  }}
                  onClick={() => { if (isCompleted) setStep(stepNum); }}
                >
                  {isCompleted ? "\u2713" : stepNum}
                </div>
                {/* Connector line */}
                {i < stepLabels.length - 1 && (
                  <div
                    style={{
                      width: isMobile ? 16 : 32,
                      height: 2,
                      background: stepNum < step ? "#4f46e5" : "var(--border)",
                      transition: "background 0.2s ease",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Current step label */}
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            {stepLabels[step - 1]}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {t({
              1: "step1Desc",
              2: "step2Desc",
              3: "step3Desc",
              4: "step4Desc",
              5: "step5Desc",
              6: "step6Desc",
            }[step] ?? "step1Desc")}
          </div>
        </div>
      </div>
    );
  }

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
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 14,
              fontWeight: 600,
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
              borderRadius: 10,
              border: "none",
              background: "#4f46e5",
              color: "white",
              fontSize: 15,
              fontWeight: 700,
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
              borderRadius: 10,
              border: "none",
              background: canAdvance(step) ? "#4f46e5" : "var(--border)",
              color: canAdvance(step) ? "white" : "var(--muted)",
              fontSize: 14,
              fontWeight: 700,
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

  // ── Step content ──
  function renderStep() {
    switch (step) {
      // ════════════════════ STEP 1: Company Info ════════════════════
      case 1:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>{t("companyName")} *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t("companyNamePlaceholder")}
                style={inputStyle}
                maxLength={200}
                autoFocus
              />
            </div>

            <div>
              <label style={labelStyle}>{t("logo")}</label>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>{t("logoHint")}</p>
              {logoBase64 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img
                    src={logoBase64}
                    alt="Logo"
                    style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                  <label style={{ fontSize: 13, color: "#4f46e5", cursor: "pointer", fontWeight: 600 }}>
                    {t("logoChange")}
                    <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} style={{ display: "none" }} />
                  </label>
                </div>
              ) : (
                <label
                  style={{
                    display: "inline-block",
                    padding: "8px 16px",
                    border: "1px dashed var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--muted)",
                    cursor: "pointer",
                  }}
                >
                  {t("logoSelect")}
                  <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} style={{ display: "none" }} />
                </label>
              )}
              {logoError && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{logoError}</p>}
            </div>

            <div>
              <label style={labelStyle}>{t("welcomeMessage")}</label>
              <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280" }}>{t("welcomeMessageHint")}</p>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder={t("welcomeMessagePlaceholder")}
                maxLength={1000}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={labelStyle}>{t("invitationMessage")}</label>
              <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280" }}>{t("invitationMessageHint")}</p>
              <textarea
                value={invitationMessage}
                onChange={(e) => setInvitationMessage(e.target.value)}
                placeholder={t("invitationMessagePlaceholder")}
                maxLength={1000}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {renderNavButtons()}
          </div>
        );

      // ════════════════════ STEP 2: Tournament ════════════════════
      case 2:
        return (
          <div>
            <label style={labelStyle}>{t("tournament")}</label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
                marginTop: 8,
              }}
            >
              {TOURNAMENT_CATALOG.map((tournament) => {
                const matchingInstance = (instances ?? []).find(
                  (inst) => inst.template?.key === tournament.templateKey
                );
                const isAvailable = tournament.active && !!matchingInstance;
                const isSelected = isAvailable && instanceId === matchingInstance?.id;

                return (
                  <button
                    key={tournament.key}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => {
                      if (matchingInstance) {
                        setInstanceId(matchingInstance.id);
                        setPickTypesConfig(null);
                      }
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      padding: "16px 8px",
                      borderRadius: 12,
                      border: isSelected ? "2px solid #4f46e5" : "1px solid var(--border)",
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(79,70,229,0.04))"
                        : isAvailable
                          ? "var(--bg)"
                          : "var(--surface)",
                      cursor: isAvailable ? "pointer" : "default",
                      opacity: isAvailable ? 1 : 0.45,
                      filter: isAvailable ? "none" : "grayscale(100%)",
                      position: "relative",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    {!isAvailable && (
                      <span
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          fontSize: "0.55rem",
                          fontWeight: 600,
                          color: "#fff",
                          background: "#9ca3af",
                          padding: "1px 4px",
                          borderRadius: 3,
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                        }}
                      >
                        {tc("comingSoon")}
                      </span>
                    )}
                    <span style={{ fontSize: "2rem" }}>{tournament.emoji}</span>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: isAvailable ? "var(--text)" : "var(--muted)",
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      {tc(`items.${tournament.i18nKey}.name`)}
                    </span>
                  </button>
                );
              })}
            </div>

            {loadError && (
              <div style={{ padding: 12, background: "#fef2f2", borderRadius: 8, color: "#b91c1c", fontSize: 13, marginTop: 12 }}>
                {loadError}
              </div>
            )}

            {renderNavButtons()}
          </div>
        );

      // ════════════════════ STEP 3: Pool Details ════════════════════
      case 3:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>{t("poolName")} *</label>
              <input
                type="text"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder={t("poolNamePlaceholder")}
                style={inputStyle}
                maxLength={120}
                autoFocus
              />
            </div>

            <div>
              <label style={labelStyle}>{t("poolDescription")}</label>
              <input
                type="text"
                value={poolDesc}
                onChange={(e) => setPoolDesc(e.target.value)}
                placeholder={t("poolDescriptionPlaceholder")}
                style={inputStyle}
                maxLength={500}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>{t("deadline")}</label>
                <input
                  type="number"
                  value={deadline}
                  min={0}
                  max={1440}
                  onChange={(e) => setDeadline(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t("timezone")}</label>
                <input
                  type="text"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  placeholder="America/Bogota"
                  style={inputStyle}
                />
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
                background: "var(--bg)",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                style={{ width: 20, height: 20, cursor: "pointer" }}
              />
              <div>
                <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{t("requireApproval")}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{t("requireApprovalDesc")}</div>
              </div>
            </label>

            {renderNavButtons()}
          </div>
        );

      // ════════════════════ STEP 4: Scoring ════════════════════
      case 4:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                padding: 20,
                border: "2px solid #4f46e5",
                borderRadius: 12,
                background: "linear-gradient(135deg, #312e81 0%, #4f46e5 100%)",
                color: "white",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u{1F4CA}"}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                {t("scoring")}
              </div>
              <div style={{ fontSize: 13, marginBottom: 16, opacity: 0.9 }}>
                {t("scoringDesc")}
              </div>
              <button
                type="button"
                onClick={() => setShowScoringWizard(true)}
                style={{
                  padding: "12px 24px",
                  borderRadius: 8,
                  border: "2px solid white",
                  background: "white",
                  color: "#4f46e5",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  minHeight: TOUCH_TARGET.minimum,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {"\u{1F9D9}\u200D\u2642\uFE0F"} {t("configWizard")}
              </button>
            </div>

            {pickTypesConfig ? (
              <div
                style={{
                  padding: 14,
                  background: "#ecfdf5",
                  border: "1px solid #6ee7b7",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#065f46",
                  textAlign: "center",
                }}
              >
                {"\u2705"} {t("configReady", { count: Array.isArray(pickTypesConfig) ? pickTypesConfig.length : 0 })}
              </div>
            ) : (
              <div
                style={{
                  padding: 14,
                  background: "#fefce8",
                  border: "1px solid #fde68a",
                  borderRadius: 10,
                  fontSize: 13,
                  color: "#92400e",
                  textAlign: "center",
                }}
              >
                {t("scoringNeeded")}
              </div>
            )}

            {renderNavButtons()}
          </div>
        );

      // ════════════════════ STEP 5: Capacity & Pricing ════════════════════
      case 5:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <CapacitySelector
              type="corporate"
              selectedCapacity={maxParticipants}
              onSelect={setMaxParticipants}
              mode="creation"
            />
            {/* Emphatic trial notice */}
            <div style={{
              padding: "16px 18px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
              border: "2px solid #34d399",
              fontSize: 13,
              color: "#065f46",
              lineHeight: 1.7,
            }}>
              {t("aprilNotice")}
            </div>

            {renderNavButtons()}
          </div>
        );

      // ════════════════════ STEP 6: Employees ════════════════════
      case 6:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
              border: "1px solid #93c5fd",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 13,
              color: "#1e40af",
              lineHeight: 1.6,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>&#8505;&#65039;</span>
              <span>{t("employeesLaterNotice")}</span>
            </div>

            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              {t("employeesDesc")}
            </p>

            <textarea
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder={t("emailsPlaceholder")}
              rows={5}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace" }}
            />

            {validEmails.length > 0 && (
              <div style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>
                {"\u2705"} {t("emailCount", { count: validEmails.length })}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--text)",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {"\u{1F4C1}"} {t("csvUpload")}
                <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} style={{ display: "none" }} />
              </label>

              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFFemail,nombre\nempleado1@empresa.com,Juan Perez\nempleado2@empresa.com,Maria Garcia\n")}`}
                download="employees_template.csv"
                style={{ fontSize: 13, color: "#4f46e5", textDecoration: "none", fontWeight: 500 }}
              >
                {"\u{1F4E5}"} {t("csvTemplate")}
              </a>
            </div>

            {renderNavButtons()}
          </div>
        );

      // ════════════════════ STEP 7: Summary ════════════════════
      case 7:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Summary card */}
            <div
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                overflow: "hidden",
              }}
            >
              {[
                { label: t("summaryCompany"), value: companyName, icon: "\u{1F3E2}" },
                { label: t("summaryTournament"), value: getSelectedTournamentName(), icon: "\u26BD" },
                { label: t("summaryPool"), value: poolName, icon: "\u{1F3AF}" },
                { label: t("summaryDeadline"), value: t("summaryMinutes", { min: deadline }), icon: "\u23F0" },
                { label: t("summaryScoring"), value: pickTypesConfig ? t("summaryConfigured") : "\u2014", icon: "\u{1F4CA}" },
                { label: t("summaryCapacity"), value: `${maxParticipants} ${t("summaryPlayers")}`, icon: "\u{1F465}" },
                {
                  label: t("summaryEmployees"),
                  value: validEmails.length > 0
                    ? `${validEmails.length} emails`
                    : t("summaryNone"),
                  icon: "\u{1F4E7}",
                },
              ].map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    borderBottom: i < 6 ? "1px solid var(--border)" : "none",
                    background: i % 2 === 0 ? "var(--bg)" : "var(--surface)",
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{row.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{row.label}</div>
                    <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>{row.value}</div>
                  </div>
                </div>
              ))}

              {requireApproval && (
                <div
                  style={{
                    padding: "10px 16px",
                    background: "#fefce8",
                    fontSize: 13,
                    color: "#92400e",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {"\u{1F512}"} {t("summaryApproval")}
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  color: "#b91c1c",
                  fontSize: 13,
                  marginTop: 16,
                }}
              >
                {error}
              </div>
            )}

            {renderNavButtons()}
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: isMobile ? "0 auto" : "24px auto", padding: isMobile ? 16 : 24 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: isMobile ? "1.4rem" : "1.6rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>
          {t("title")}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          {t("subtitle")}
        </p>
      </div>

      {renderProgressBar()}

      {/* Step content card */}
      <div
        style={{
          padding: isMobile ? 16 : 24,
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        {renderStep()}
      </div>
    </div>
  );
}
