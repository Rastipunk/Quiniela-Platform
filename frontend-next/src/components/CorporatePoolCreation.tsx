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

const MAX_LOGO_BYTES = 500 * 1024; // 500 KB

export function CorporatePoolCreation() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const t = useTranslations("enterprise.create");
  const tc = useTranslations("landing.tournaments");
  const token = useMemo(() => getToken(), []);

  // Instances
  const [instances, setInstances] = useState<CatalogInstance[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Step 1: Company info
  const [companyName, setCompanyName] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | undefined>();
  const [welcomeMessage, setWelcomeMessage] = useState("");

  // Step 2: Pool config
  const [instanceId, setInstanceId] = useState("");
  const [poolName, setPoolName] = useState("");
  const [poolDesc, setPoolDesc] = useState("");
  const [deadline, setDeadline] = useState(10);
  const [timeZone, setTimeZone] = useState(detectTz());
  const [requireApproval, setRequireApproval] = useState(false);
  const [pickTypesConfig, setPickTypesConfig] = useState<PoolPickTypesConfig | string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Step 3: Employees
  const [emailsText, setEmailsText] = useState("");

  // UI state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

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

  // Parse emails from textarea
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
    reader.onload = () => {
      setLogoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      // Extract emails from CSV (first column or any column with @)
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

  const canSubmit =
    companyName.trim().length >= 2 &&
    instanceId.length > 0 &&
    poolName.trim().length >= 3 &&
    pickTypesConfig !== null;

  async function handleSubmit() {
    if (!token || !canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      const result = await createCorporatePool(token, {
        companyName: companyName.trim(),
        logoBase64,
        welcomeMessage: welcomeMessage.trim() || undefined,
        tournamentInstanceId: instanceId,
        poolName: poolName.trim(),
        poolDescription: poolDesc.trim() || undefined,
        timeZone,
        deadlineMinutesBeforeKickoff: deadline,
        requireApproval,
        pickTypesConfig,
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

  const sectionStyle: React.CSSProperties = {
    padding: isMobile ? 16 : 24,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
  };

  if (showWizard && instanceId && token) {
    return (
      <PoolConfigWizard
        instanceId={instanceId}
        token={token}
        onComplete={(config) => {
          setPickTypesConfig(config);
          setShowWizard(false);
        }}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: isMobile ? "0 auto" : "24px auto", padding: isMobile ? 16 : 24 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: isMobile ? "1.5rem" : "1.75rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>
          {t("title")}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>
          {t("subtitle")}
        </p>
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
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      {loadError && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#b91c1c",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {loadError}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* ===== SECTION 1: Company Info ===== */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", margin: "0 0 16px" }}>
            {"\u{1F3E2}"} {t("step1")}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>{t("companyName")}</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t("companyNamePlaceholder")}
                style={inputStyle}
                maxLength={200}
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
                  <label
                    style={{
                      fontSize: 13,
                      color: "#4f46e5",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
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
              {logoError && (
                <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{logoError}</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>{t("welcomeMessage")}</label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder={t("welcomeMessagePlaceholder")}
                maxLength={1000}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </div>
        </div>

        {/* ===== SECTION 2: Pool Config ===== */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", margin: "0 0 16px" }}>
            {"\u26BD"} {t("step2")}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Tournament grid */}
            <div>
              <label style={labelStyle}>{t("tournament")}</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 8,
                  marginTop: 6,
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
                        if (matchingInstance) setInstanceId(matchingInstance.id);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: "12px 8px",
                        borderRadius: 10,
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
                      <span style={{ fontSize: "1.5rem" }}>{tournament.emoji}</span>
                      <span
                        style={{
                          fontSize: "0.72rem",
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
            </div>

            <div>
              <label style={labelStyle}>{t("poolName")}</label>
              <input
                type="text"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder={t("poolNamePlaceholder")}
                style={inputStyle}
                maxLength={120}
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
                <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>
                  {t("requireApproval")}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {t("requireApprovalDesc")}
                </div>
              </div>
            </label>

            {/* Scoring */}
            <div
              style={{
                marginTop: 4,
                padding: 16,
                border: "2px solid #4f46e5",
                borderRadius: 12,
                background: "linear-gradient(135deg, #312e81 0%, #4f46e5 100%)",
                color: "white",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                {"\u{1F4CA}"} {t("scoring")}
              </div>
              <div style={{ fontSize: 13, marginBottom: 12, opacity: 0.9 }}>
                {t("scoringDesc")}
              </div>
              <button
                type="button"
                onClick={() => setShowWizard(true)}
                style={{
                  padding: "12px 16px",
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
              {pickTypesConfig && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {"\u2705"} {t("configReady", { count: (pickTypesConfig as any[]).length })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== SECTION 3: Employees (Optional) ===== */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
            {"\u{1F4E7}"} {t("employeesTitle")}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
            {t("employeesDesc")}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                href={`data:text/csv;charset=utf-8,${encodeURIComponent("email,nombre\nempleado1@empresa.com,Juan Pérez\nempleado2@empresa.com,María García\n")}`}
                download="employees_template.csv"
                style={{
                  fontSize: 13,
                  color: "#4f46e5",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                {"\u{1F4E5}"} {t("csvTemplate")}
              </a>
            </div>
          </div>
        </div>

        {/* ===== Submit ===== */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || busy}
          style={{
            padding: isMobile ? 16 : 14,
            borderRadius: 12,
            border: "none",
            background: canSubmit ? "#4f46e5" : "var(--border)",
            color: canSubmit ? "white" : "var(--muted)",
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontSize: isMobile ? 16 : 15,
            fontWeight: 700,
            minHeight: TOUCH_TARGET.comfortable,
            opacity: busy ? 0.7 : 1,
            ...mobileInteractiveStyles.tapHighlight,
          }}
        >
          {busy ? t("creating") : t("createButton")}
        </button>
      </div>
    </div>
  );
}
