"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { verifyEmail } from "@/lib/api";

type VerificationStatus = "loading" | "success" | "already_verified" | "error";

export default function VerifyEmailPage() {
  const t = useTranslations("auth");
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#6b7280" }}>{t("verifyEmailPage.loadingText")}</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const token = searchParams.get("token");

  const verify = useCallback(async () => {
    if (!token) {
      setStatus("error");
      setErrorMessage(t("verifyEmailPage.tokenNotFound"));
      return;
    }

    try {
      const result = await verifyEmail(token);

      if (result.alreadyVerified) {
        setStatus("already_verified");
      } else if (result.verified) {
        setStatus("success");
      } else {
        setStatus("success");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(
        err.message || t("verifyEmailPage.invalidOrExpired")
      );
    }
  }, [token, t]);

  useEffect(() => {
    verify();
  }, [verify]);

  // Redirigir al dashboard después de verificación exitosa
  useEffect(() => {
    if (status === "success" || status === "already_verified") {
      const timer = setTimeout(() => {
        router.push("/dashboard");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    padding: 40,
    maxWidth: 440,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 64,
    marginBottom: 24,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 700,
    color: "#1f2937",
    marginBottom: 12,
  };

  const messageStyle: React.CSSProperties = {
    fontSize: 16,
    color: "#6b7280",
    lineHeight: 1.6,
    marginBottom: 24,
  };

  const buttonStyle: React.CSSProperties = {
    display: "inline-block",
    background: "#4f46e5",
    color: "#fff",
    padding: "12px 24px",
    borderRadius: 8,
    fontWeight: 600,
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
  };

  const redirectTextStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 16,
  };

  if (status === "loading") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ ...iconStyle, animation: "spin 1s linear infinite" }}>
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              style={{ animation: "spin 1s linear infinite" }}
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="#4f46e5"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 style={titleStyle}>{t("verifyEmailPage.verifying.title")}</h1>
          <p style={messageStyle}>
            {t("verifyEmailPage.verifying.description")}
          </p>
          <style>
            {`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      </div>
    );
  }

  if (status === "success") {
    const successMessage = t("verifyEmailPage.success.message");
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={iconStyle}>&#10004;&#65039;</div>
          <h1 style={titleStyle}>{t("verifyEmailPage.success.title")}</h1>
          <p style={messageStyle}>
            {successMessage.split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
          <Link href="/dashboard" style={buttonStyle}>
            {t("verifyEmailPage.success.goToDashboard")}
          </Link>
          <p style={redirectTextStyle}>
            {t("verifyEmailPage.success.redirect")}
          </p>
        </div>
      </div>
    );
  }

  if (status === "already_verified") {
    const alreadyMessage = t("verifyEmailPage.alreadyVerified.message");
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={iconStyle}>&#9989;</div>
          <h1 style={titleStyle}>{t("verifyEmailPage.alreadyVerified.title")}</h1>
          <p style={messageStyle}>
            {alreadyMessage.split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
          <Link href="/dashboard" style={buttonStyle}>
            {t("verifyEmailPage.alreadyVerified.goToDashboard")}
          </Link>
          <p style={redirectTextStyle}>
            {t("verifyEmailPage.success.redirect")}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={iconStyle}>&#10060;</div>
        <h1 style={titleStyle}>{t("verifyEmailPage.failed.title")}</h1>
        <p style={messageStyle}>
          {errorMessage}
        </p>
        <p style={{ ...messageStyle, marginBottom: 24 }}>
          {t("verifyEmailPage.failed.requestNewLink")}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login" style={buttonStyle}>
            {t("verifyEmailPage.failed.login")}
          </Link>
          <Link
            href="/dashboard"
            style={{
              ...buttonStyle,
              background: "transparent",
              color: "#4f46e5",
              border: "2px solid #4f46e5",
            }}
          >
            {t("verifyEmailPage.failed.goToDashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
