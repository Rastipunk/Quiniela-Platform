"use client";

import { Suspense, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { resetPassword } from "@/lib/api";
import { Link } from "@/i18n/navigation";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken, clearToken } from "@/lib/auth";

/**
 * Página de restablecimiento de contraseña.
 *
 * Esta página es accesible independientemente del estado de autenticación,
 * permitiendo a usuarios con sesión activa restablecer su contraseña
 * (ej: desde otro dispositivo o por seguridad).
 */
export default function ResetPasswordContent() {
  const t = useTranslations("auth");
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#6b7280" }}>{t("resetPasswordPage.loadingText")}</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detectar si el usuario tiene una sesión activa
  const hasActiveSession = !!getToken();

  useEffect(() => {
    if (!token) {
      setError(t("resetPasswordPage.invalidToken"));
    }
  }, [token, t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!token) throw new Error(t("resetPasswordPage.invalidTokenShort"));
      if (!newPassword || newPassword.length < 8) {
        throw new Error(t("resetPasswordPage.passwordMinLength"));
      }
      if (newPassword !== confirmPassword) {
        throw new Error(t("resetPasswordPage.passwordsMismatch"));
      }

      await resetPassword(token, newPassword);

      // Si había sesión activa, cerrarla por seguridad
      // (la contraseña cambió, el usuario debe re-autenticarse)
      if (hasActiveSession) {
        clearToken();
      }

      setSuccess(true);
    } catch (err: any) {
      // Manejar errores específicos del backend
      const errorCode = err?.payload?.error;

      if (errorCode === "INVALID_TOKEN") {
        setError(t("resetPasswordPage.tokenExpired"));
      } else {
        setError(err?.message ?? t("resetPasswordPage.resetError"));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogoutAndContinue() {
    clearToken();
    // Forzar re-render para actualizar hasActiveSession
    window.location.reload();
  }

  // Estado: Contraseña actualizada exitosamente
  if (success) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
        <div className="card" style={{ padding: 24, borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 8 }}>{t("resetPasswordPage.success.title")}</h2>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            {t("resetPasswordPage.success.message")}
          </p>
          <Link href="/">
            <button style={{ width: "100%" }}>{t("resetPasswordPage.success.loginButton")}</button>
          </Link>
        </div>
      </div>
    );
  }

  // Estado: Token inválido o faltante
  if (!token) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
        <div className="card" style={{ padding: 24, borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ marginBottom: 8 }}>{t("resetPasswordPage.invalidLink.title")}</h2>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            {t("resetPasswordPage.invalidLink.description")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link href="/forgot-password">
              <button style={{ width: "100%" }}>{t("resetPasswordPage.invalidLink.requestNew")}</button>
            </Link>
            <Link href="/">
              <button
                style={{
                  width: "100%",
                  background: "transparent",
                  color: "var(--primary)",
                  border: "1px solid var(--border)",
                }}
              >
                {t("resetPasswordPage.invalidLink.backToHome")}
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Estado: Formulario de nueva contraseña
  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
      {/* Aviso de sesión activa */}
      {hasActiveSession && (
        <div
          style={{
            padding: 16,
            marginBottom: 16,
            borderRadius: 12,
            backgroundColor: "var(--warning-bg, #fef3c7)",
            border: "1px solid var(--warning-border, #f59e0b)",
            color: "var(--warning-text, #92400e)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚠️</span>
            <span>{t("resetPasswordPage.activeSession.title")}</span>
          </div>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            {t("resetPasswordPage.activeSession.message")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => router.push("/")}
              style={{
                flex: 1,
                minWidth: 120,
                padding: "8px 12px",
                fontSize: 13,
                background: "transparent",
                color: "var(--warning-text, #92400e)",
                border: "1px solid var(--warning-border, #f59e0b)",
              }}
            >
              {t("resetPasswordPage.activeSession.goToDashboard")}
            </button>
            <button
              onClick={handleLogoutAndContinue}
              style={{
                flex: 1,
                minWidth: 120,
                padding: "8px 12px",
                fontSize: 13,
                background: "var(--warning-border, #f59e0b)",
                color: "white",
                border: "none",
              }}
            >
              {t("resetPasswordPage.activeSession.logoutFirst")}
            </button>
          </div>
        </div>
      )}

      <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>{t("resetPasswordPage.title")}</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        {t("resetPasswordPage.subtitle")}
      </div>

      <form onSubmit={onSubmit} className="card" style={{ padding: 16, borderRadius: 16 }}>
        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("resetPasswordPage.newPasswordLabel")}</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("resetPasswordPage.newPasswordPlaceholder")}
            minLength={8}
            required
            autoFocus
          />
        </label>

        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("resetPasswordPage.confirmPasswordLabel")}</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("resetPasswordPage.confirmPasswordPlaceholder")}
            minLength={8}
            required
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <span style={{ fontSize: 11, color: "var(--error)" }}>{t("resetPasswordPage.passwordsMismatch")}</span>
          )}
        </label>

        <button disabled={loading || !token} style={{ width: "100%", marginBottom: 12 }}>
          {loading ? t("resetPasswordPage.updating") : t("resetPasswordPage.resetButton")}
        </button>

        <div style={{ textAlign: "center" }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--primary)", textDecoration: "none" }}>
            {hasActiveSession ? t("resetPasswordPage.backToDashboard") : t("resetPasswordPage.backToLogin")}
          </Link>
        </div>

        {error && (
          <div className="alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
