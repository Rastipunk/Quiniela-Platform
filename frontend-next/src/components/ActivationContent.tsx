"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { activateCorporateAccount, checkCorporateInvite } from "@/lib/api";
import { setToken } from "@/lib/auth";

type Status = "form" | "submitting" | "success" | "error";
type CheckStatus = "loading" | "new_user" | "existing_user" | "error";

export function ActivationContent() {
  const t = useTranslations("activation");
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenParam = searchParams.get("token") || "";

  // Check status
  const [checkStatus, setCheckStatus] = useState<CheckStatus>("loading");
  const [inviteEmail, setInviteEmail] = useState("");
  const [poolName, setPoolName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Form fields (new user)
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptAge, setAcceptAge] = useState(false);

  // Shared state
  const [status, setStatus] = useState<Status>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [poolId, setPoolId] = useState<string | null>(null);

  // Check invite on mount
  useEffect(() => {
    if (!tokenParam) {
      setCheckStatus("error");
      setErrorMsg(t("invalidToken"));
      return;
    }

    checkCorporateInvite(tokenParam)
      .then((data) => {
        setInviteEmail(data.email);
        setPoolName(data.poolName);
        setCompanyName(data.companyName);
        setCheckStatus(data.alreadyExists ? "existing_user" : "new_user");
      })
      .catch((err: any) => {
        const code = err?.payload?.error;
        if (code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") {
          setErrorMsg(t("invalidToken"));
        } else if (code === "ALREADY_ACTIVATED") {
          setErrorMsg(t("alreadyActivated"));
        } else {
          setErrorMsg(err?.payload?.message || err.message || "Error");
        }
        setCheckStatus("error");
      });
  }, [tokenParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit =
    displayName.trim().length >= 2 &&
    username.trim().length >= 3 &&
    password.length >= 8 &&
    password === confirmPassword &&
    acceptTerms &&
    acceptPrivacy &&
    acceptAge &&
    tokenParam.length > 0;

  // New user: full form submit
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

  // Existing user: join pool directly
  const handleExistingUserJoin = async () => {
    setStatus("submitting");
    setErrorMsg("");

    try {
      const result = await activateCorporateAccount({
        activationToken: tokenParam,
      });

      setToken(result.token);
      setPoolId(result.poolId);
      setPoolName(result.poolName ?? null);
      setCompanyName(result.companyName ?? null);
      setStatus("success");
    } catch (err: any) {
      setStatus("form");
      const payload = err?.payload;
      if (payload?.error === "POOL_FULL") {
        setErrorMsg(t("invalidToken")); // pool full treated as generic error
      } else if (payload?.error === "ALREADY_ACTIVATED") {
        setErrorMsg(t("alreadyActivated"));
      } else {
        setErrorMsg(payload?.message || err.message || "Error");
      }
    }
  };

  // ---- Loading state ----
  if (checkStatus === "loading") {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16, animation: "spin 1s linear infinite" }}>&#9696;</div>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>{t("checking")}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ---- Error state (no valid token) ----
  if (checkStatus === "error" && status !== "success") {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>
          {errorMsg || t("invalidToken")}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>{t("invalidTokenHelp")}</p>
      </div>
    );
  }

  // ---- Success state ----
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

  // ---- Existing user: simplified join UI ----
  if (checkStatus === "existing_user") {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{"\u{1F44B}"}</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>
          {t("existingUserTitle")}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          {t("existingUserDesc", {
            email: inviteEmail,
            poolName: poolName ?? "",
            companyName: companyName ?? "",
          })}
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

        <button
          onClick={handleExistingUserJoin}
          disabled={status === "submitting"}
          style={{
            padding: "14px 32px",
            borderRadius: 10,
            border: "none",
            background: "#4f46e5",
            color: "white",
            fontSize: 16,
            fontWeight: 700,
            cursor: status === "submitting" ? "not-allowed" : "pointer",
            opacity: status === "submitting" ? 0.7 : 1,
          }}
        >
          {status === "submitting" ? t("joining") : t("joinPool")}
        </button>
      </div>
    );
  }

  // ---- New user: full registration form ----
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
