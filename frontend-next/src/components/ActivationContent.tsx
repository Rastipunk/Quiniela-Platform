"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { activateCorporateAccount } from "@/lib/api";
import { setToken } from "@/lib/auth";

type Status = "form" | "submitting" | "success" | "error";

export function ActivationContent() {
  const t = useTranslations("activation");
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenParam = searchParams.get("token") || "";

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptAge, setAcceptAge] = useState(false);

  const [status, setStatus] = useState<Status>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [poolId, setPoolId] = useState<string | null>(null);
  const [poolName, setPoolName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const canSubmit =
    displayName.trim().length >= 2 &&
    username.trim().length >= 3 &&
    password.length >= 8 &&
    password === confirmPassword &&
    acceptTerms &&
    acceptPrivacy &&
    acceptAge &&
    tokenParam.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (password !== confirmPassword) {
      setErrorMsg(t("passwordMismatch"));
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    try {
      const result = await activateCorporateAccount({
        activationToken: tokenParam,
        displayName: displayName.trim(),
        username: username.trim(),
        password,
        acceptTerms,
        acceptPrivacy,
        acceptAge,
      });

      setToken(result.token);
      setPoolId(result.poolId);
      setPoolName(result.poolName ?? null);
      setCompanyName(result.companyName ?? null);
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      const payload = err?.payload;
      if (payload?.error === "INVALID_TOKEN" || payload?.error === "TOKEN_EXPIRED") {
        setErrorMsg(t("invalidToken"));
      } else if (payload?.error === "ALREADY_ACTIVATED") {
        setErrorMsg(t("alreadyActivated"));
      } else {
        setErrorMsg(payload?.message || err.message || "Error");
      }
    }
  };

  if (!tokenParam) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>
          {t("invalidToken")}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>{t("invalidTokenHelp")}</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{"\u{1F389}"}</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>
          {t("success")}
        </h1>
        {companyName && (
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 4 }}>
            {t("welcomeTo", { company: companyName })}
          </p>
        )}
        {poolName && (
          <p style={{ color: "var(--text)", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            {poolName}
          </p>
        )}
        {poolId && (
          <button
            onClick={() => router.push(`/pools/${poolId}`)}
            style={{
              marginTop: 24,
              background: "#4f46e5",
              color: "white",
              padding: "12px 28px",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            {t("goToPool")}
          </button>
        )}
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    fontSize: 14,
    background: "var(--surface)",
    color: "var(--text)",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4,
    color: "var(--text)",
  };

  return (
    <div style={{ maxWidth: 440, margin: "60px auto", padding: "0 20px" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          marginBottom: 8,
          color: "var(--text)",
          textAlign: "center",
        }}
      >
        {t("title")}
      </h1>
      <p
        style={{
          color: "var(--muted)",
          fontSize: 14,
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        {t("subtitle")}
      </p>

      {errorMsg && (
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
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>{t("displayName")}</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("displayNamePlaceholder")}
            style={inputStyle}
            required
            minLength={2}
            maxLength={50}
          />
        </div>

        <div>
          <label style={labelStyle}>{t("username")}</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder={t("usernamePlaceholder")}
            style={inputStyle}
            required
            minLength={3}
            maxLength={20}
          />
        </div>

        <div>
          <label style={labelStyle}>{t("password")}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            style={inputStyle}
            required
            minLength={8}
            maxLength={200}
          />
        </div>

        <div>
          <label style={labelStyle}>{t("confirmPassword")}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("confirmPasswordPlaceholder")}
            style={inputStyle}
            required
          />
          {confirmPassword && password !== confirmPassword && (
            <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0" }}>
              {t("passwordMismatch")}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
            {t("acceptTerms")}
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
            <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} />
            {t("acceptPrivacy")}
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
            <input type="checkbox" checked={acceptAge} onChange={(e) => setAcceptAge(e.target.checked)} />
            {t("acceptAge")}
          </label>
        </div>

        <button
          type="submit"
          disabled={!canSubmit || status === "submitting"}
          style={{
            marginTop: 8,
            padding: "12px 24px",
            borderRadius: 8,
            border: "none",
            background: canSubmit ? "#4f46e5" : "var(--border)",
            color: canSubmit ? "white" : "var(--muted)",
            fontSize: 15,
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: status === "submitting" ? 0.7 : 1,
          }}
        >
          {status === "submitting" ? t("activating") : t("activate")}
        </button>
      </form>
    </div>
  );
}
