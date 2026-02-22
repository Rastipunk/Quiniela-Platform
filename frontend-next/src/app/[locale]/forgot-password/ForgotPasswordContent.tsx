"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { forgotPassword } from "@/lib/api";
import { Link } from "@/i18n/navigation";

/**
 * Tipos de resultado para el flujo de forgot password.
 * Permite manejar diferentes estados de manera tipada y clara.
 */
type ForgotPasswordResult =
  | { type: "idle" }
  | { type: "success" }
  | { type: "google_account" }
  | { type: "error"; message: string };

export default function ForgotPasswordContent() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ForgotPasswordResult>({ type: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult({ type: "idle" });
    setLoading(true);

    try {
      const em = email.trim().toLowerCase();
      if (!em) throw new Error(t("forgotPasswordPage.emailRequired"));

      await forgotPassword(em);
      setResult({ type: "success" });
    } catch (err: any) {
      // Verificar si es una cuenta de Google (código de error específico del backend)
      const errorCode = err?.payload?.error;

      if (errorCode === "GOOGLE_ACCOUNT") {
        setResult({ type: "google_account" });
      } else {
        setResult({ type: "error", message: err?.message ?? t("forgotPasswordPage.sendError") });
      }
    } finally {
      setLoading(false);
    }
  }

  // Estado: Email enviado exitosamente
  if (result.type === "success") {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
        <div className="card" style={{ padding: 24, borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <h2 style={{ marginBottom: 8 }}>{t("forgotPasswordPage.success.title")}</h2>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            {t("forgotPasswordPage.success.message")}
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
            {t("forgotPasswordPage.success.expiryNote")}
          </p>
          <Link href="/">
            <button style={{ width: "100%" }}>{t("forgotPasswordPage.success.backToHome")}</button>
          </Link>
        </div>
      </div>
    );
  }

  // Estado: Cuenta de Google detectada
  if (result.type === "google_account") {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
        <div className="card" style={{ padding: 24, borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" style={{ display: "inline-block" }}>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          </div>
          <h2 style={{ marginBottom: 8 }}>{t("forgotPasswordPage.googleAccount.title")}</h2>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            {t("forgotPasswordPage.googleAccount.description")}
          </p>
          <p
            style={{
              fontSize: 13,
              color: "var(--muted)",
              marginBottom: 20,
              padding: "12px",
              backgroundColor: "var(--surface)",
              borderRadius: 8,
            }}
          >
            {t("forgotPasswordPage.googleAccount.instructions")}
          </p>
          <Link href="/">
            <button style={{ width: "100%" }}>{t("forgotPasswordPage.googleAccount.goToLogin")}</button>
          </Link>
        </div>
      </div>
    );
  }

  // Estado: Formulario inicial / error
  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>{t("forgotPasswordPage.title")}</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        {t("forgotPasswordPage.subtitle")}
      </div>

      <form onSubmit={onSubmit} className="card" style={{ padding: 16, borderRadius: 16 }}>
        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("email")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
            autoFocus
          />
        </label>

        <button disabled={loading} style={{ width: "100%", marginBottom: 12 }}>
          {loading ? t("forgotPasswordPage.sending") : t("forgotPasswordPage.sendLink")}
        </button>

        <div style={{ textAlign: "center" }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--primary)", textDecoration: "none" }}>
            {t("forgotPasswordPage.backToLogin")}
          </Link>
        </div>

        {result.type === "error" && (
          <div className="alert-error" style={{ marginTop: 12 }}>
            {result.message}
          </div>
        )}
      </form>
    </div>
  );
}
