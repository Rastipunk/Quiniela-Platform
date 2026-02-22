"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { login, register, loginWithGoogle, type RegisterConsentOptions } from "@/lib/api";
import { consumeSessionExpiredFlag, setToken } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";

// Tipos para Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const expired = useMemo(() => consumeSessionExpiredFlag(), []);
  const isMobile = useIsMobile();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  // Consent checkboxes
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptAge, setAcceptAge] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);

  // Google consent flow (para usuarios nuevos)
  const [showGoogleConsentModal, setShowGoogleConsentModal] = useState(false);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement>(null);

  function onLoggedIn() {
    router.push("/dashboard");
  }

  // Google Sign In callback
  const handleGoogleCallback = async (response: any) => {
    setError(null);
    setLoading(true);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Primero intentamos sin consent (usuario existente)
      const result = await loginWithGoogle(response.credential, timezone);
      setToken(result.token);
      onLoggedIn();
    } catch (err: any) {
      // Si el backend indica que necesita consent (usuario nuevo)
      if (err?.payload?.requiresConsent || err?.payload?.error === "CONSENT_REQUIRED" || err?.payload?.error === "AGE_VERIFICATION_REQUIRED") {
        setPendingGoogleCredential(response.credential);
        setShowGoogleConsentModal(true);
        setLoading(false);
        return;
      }
      setError(err?.message ?? t("googleSignInError"));
    } finally {
      if (!showGoogleConsentModal) {
        setLoading(false);
      }
    }
  };

  // Completar registro con Google después de consent
  const handleGoogleConsentSubmit = async () => {
    if (!pendingGoogleCredential) return;

    // Validar consent obligatorio
    if (!acceptTerms) {
      setError(t("errors.mustAcceptTerms"));
      return;
    }
    if (!acceptPrivacy) {
      setError(t("errors.mustAcceptPrivacy"));
      return;
    }
    if (!acceptAge) {
      setError(t("errors.mustAcceptAge"));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const consent: RegisterConsentOptions = {
        acceptTerms,
        acceptPrivacy,
        acceptAge,
        acceptMarketing,
      };

      const result = await loginWithGoogle(pendingGoogleCredential, timezone, consent);
      setToken(result.token);
      onLoggedIn();
    } catch (err: any) {
      setError(err?.message ?? t("googleRegisterError"));
    } finally {
      setLoading(false);
    }
  };

  const [googleLoadFailed, setGoogleLoadFailed] = useState(false);

  // Inicializar Google Sign In (with retry for script loading)
  useEffect(() => {
    const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!GOOGLE_CLIENT_ID) {
      console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID no configurado. Google Sign In no estará disponible.");
      return;
    }

    setGoogleLoadFailed(false);
    let isMounted = true;

    const initGoogle = () => {
      if (!window.google || !googleButtonRef.current) return false;

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
          use_fedcm_for_prompt: false, // Safari no soporta FedCM bien
        });

        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: googleButtonRef.current.offsetWidth,
          text: mode === "login" ? "signin_with" : "signup_with",
          locale: locale,
        });
        return true;
      } catch (err) {
        console.error("Error initializing Google Sign-In:", err);
        return false;
      }
    };

    // Try immediately
    if (initGoogle()) return () => { isMounted = false; };

    // Retry until script loads (max 10 seconds — Safari ITP can delay loading)
    let attempts = 0;
    const interval = setInterval(() => {
      if (!isMounted) { clearInterval(interval); return; }
      attempts++;
      if (initGoogle()) {
        clearInterval(interval);
      } else if (attempts >= 100) {
        clearInterval(interval);
        if (isMounted) setGoogleLoadFailed(true);
      }
    }, 100);

    return () => { isMounted = false; clearInterval(interval); };
  }, [mode]);

  // Reset consent when switching modes
  useEffect(() => {
    if (mode === "login") {
      setAcceptTerms(false);
      setAcceptPrivacy(false);
      setAcceptAge(false);
      setAcceptMarketing(false);
    }
  }, [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const em = email.trim().toLowerCase();
      if (!em) throw new Error(t("errors.emailRequired"));
      if (!password) throw new Error(t("errors.passwordRequired"));

      if (mode === "register") {
        // Validaciones extras para registro
        const emConfirm = emailConfirm.trim().toLowerCase();
        if (em !== emConfirm) {
          throw new Error(t("errors.emailsMismatch"));
        }

        const user = username.trim().toLowerCase();
        if (!user || user.length < 3) {
          throw new Error(t("errors.usernameMinLength"));
        }

        if (!displayName.trim()) {
          throw new Error(t("errors.displayNameRequired"));
        }

        if (password.length < 8) {
          throw new Error(t("errors.passwordMinLength"));
        }

        // Validar consent obligatorio
        if (!acceptTerms) {
          throw new Error(t("errors.mustAcceptTerms"));
        }
        if (!acceptPrivacy) {
          throw new Error(t("errors.mustAcceptPrivacy"));
        }
        if (!acceptAge) {
          throw new Error(t("errors.mustAcceptAge"));
        }

        // Auto-detectar timezone del navegador
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const consent: RegisterConsentOptions = {
          acceptTerms,
          acceptPrivacy,
          acceptAge,
          acceptMarketing,
        };

        const res = await register(em, user, displayName.trim(), password, timezone, consent);
        setToken(res.token);
        onLoggedIn();
      } else {
        const res = await login(em, password);
        setToken(res.token);
        onLoggedIn();
      }
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  // Estilos responsivos
  const containerStyle = {
    maxWidth: isMobile ? "100%" : 520,
    margin: isMobile ? "0" : "60px auto",
    padding: isMobile ? 20 : 16,
    minHeight: isMobile ? "100vh" : "auto",
    display: isMobile ? "flex" : "block",
    flexDirection: "column" as const,
    justifyContent: isMobile ? "center" : "flex-start",
  };

  const inputStyle = {
    padding: isMobile ? 14 : 10,
    fontSize: isMobile ? 16 : 14,
    minHeight: TOUCH_TARGET.minimum,
    borderRadius: 8,
    border: "1px solid var(--border)",
    width: "100%",
    boxSizing: "border-box" as const,
    ...mobileInteractiveStyles.tapHighlight,
  };

  const buttonStyle = {
    width: "100%",
    padding: isMobile ? 16 : 12,
    fontSize: isMobile ? 16 : 14,
    fontWeight: 600,
    minHeight: TOUCH_TARGET.comfortable,
    borderRadius: 10,
    cursor: "pointer",
    ...mobileInteractiveStyles.tapHighlight,
  };

  const tabButtonStyle = (isActive: boolean) => ({
    flex: 1,
    padding: isMobile ? 14 : 10,
    fontSize: isMobile ? 15 : 14,
    fontWeight: 500,
    minHeight: TOUCH_TARGET.minimum,
    background: isActive ? "var(--primary)" : "var(--surface)",
    color: isActive ? "#fff" : "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    cursor: "pointer",
    ...mobileInteractiveStyles.tapHighlight,
  });

  const checkboxLabelStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1.4,
  };

  const checkboxStyle = {
    width: 18,
    height: 18,
    marginTop: 2,
    cursor: "pointer",
    flexShrink: 0,
  };

  // Componente de checkboxes de consent
  const ConsentCheckboxes = ({ inModal = false }: { inModal?: boolean }) => (
    <div
      style={{
        marginTop: inModal ? 0 : 16,
        marginBottom: inModal ? 0 : 8,
        padding: inModal ? 0 : "12px 0",
        borderTop: inModal ? "none" : "1px solid var(--border)",
      }}
    >
      {!inModal && (
        <div
          style={{
            fontSize: 12,
            color: "var(--muted)",
            marginBottom: 12,
            fontWeight: 500,
          }}
        >
          {t("consentHeader")}
        </div>
      )}

      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          style={checkboxStyle}
        />
        <span>
          {t("acceptTermsText")}{" "}
          <Link href="/terminos" target="_blank" style={{ color: "#2563eb" }}>
            {t("acceptTermsLink")}
          </Link>{" "}
          <span style={{ color: "#dc2626" }}>*</span>
        </span>
      </label>

      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={acceptPrivacy}
          onChange={(e) => setAcceptPrivacy(e.target.checked)}
          style={checkboxStyle}
        />
        <span>
          {t("acceptPrivacyText")}{" "}
          <Link href="/privacidad" target="_blank" style={{ color: "#2563eb" }}>
            {t("acceptPrivacyLink")}
          </Link>{" "}
          <span style={{ color: "#dc2626" }}>*</span>
        </span>
      </label>

      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={acceptAge}
          onChange={(e) => setAcceptAge(e.target.checked)}
          style={checkboxStyle}
        />
        <span>
          {t("acceptAgeFull")}{" "}
          <span style={{ color: "#dc2626" }}>*</span>
        </span>
      </label>

      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={acceptMarketing}
          onChange={(e) => setAcceptMarketing(e.target.checked)}
          style={checkboxStyle}
        />
        <span style={{ color: "var(--muted)" }}>
          {t("acceptMarketingFull")}
        </span>
      </label>

      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
        <span style={{ color: "#dc2626" }}>*</span> {t("requiredFields")}
      </div>
    </div>
  );

  return (
    <div style={containerStyle}>
      <div>
        <div
          style={{
            fontWeight: 900,
            fontSize: isMobile ? 26 : 22,
            marginBottom: 8,
            textAlign: isMobile ? "center" : "left",
          }}
        >
          {t("pageTitle")}
        </div>
        <div
          style={{
            color: "var(--muted)",
            marginBottom: 18,
            fontSize: isMobile ? 15 : 14,
            textAlign: isMobile ? "center" : "left",
          }}
        >
          {t("pageSubtitle")}
        </div>

        {expired && (
          <div className="alert-error" style={{ marginBottom: 12 }}>
            {t("sessionExpired")}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setMode("login")}
            style={tabButtonStyle(mode === "login")}
          >
            {t("loginTab")}
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            style={tabButtonStyle(mode === "register")}
          >
            {t("registerTab")}
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="card"
          style={{
            padding: isMobile ? 20 : 16,
            borderRadius: 16,
          }}
        >
          <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{t("email")}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              required
              style={inputStyle}
            />
          </label>

          {mode === "register" && (
            <>
              <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                  {t("confirmEmail")}
                </span>
                <input
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  required
                  style={inputStyle}
                />
                {emailConfirm && email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase() && (
                  <span style={{ fontSize: 12, color: "var(--error)" }}>{t("emailsMismatch")}</span>
                )}
              </label>

              <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                  {t("username")} <span style={{ fontWeight: "normal" }}>{t("usernameHintFull")}</span>
                </span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("usernamePlaceholder")}
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_-]+"
                  required
                  style={inputStyle}
                />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {t("usernameHint")}
                </span>
              </label>

              <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                  {t("displayName")}
                </span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("displayNamePlaceholder")}
                  required
                  style={inputStyle}
                />
              </label>
            </>
          )}

          <label style={{ display: "grid", gap: 6, marginBottom: mode === "register" ? 8 : 12 }}>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{t("password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              style={inputStyle}
            />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("passwordHint")}</span>
          </label>

          {mode === "login" && (
            <div style={{ marginBottom: 16, textAlign: "right" }}>
              <Link
                href="/forgot-password"
                style={{
                  fontSize: 14,
                  color: "var(--primary)",
                  textDecoration: "none",
                  padding: "8px 0",
                  display: "inline-block",
                }}
              >
                {t("forgotPassword")}
              </Link>
            </div>
          )}

          {mode === "register" && <ConsentCheckboxes />}

          <button disabled={loading} style={buttonStyle}>
            {loading ? t("loading") : mode === "login" ? t("loginTab") : t("registerTab")}
          </button>

          {error && (
            <div className="alert-error" style={{ marginTop: 14 }}>
              {error}
            </div>
          )}
        </form>

        {/* Google Sign In */}
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 18,
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span>{t("orContinueWith")}</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <div ref={googleButtonRef} style={{ display: "flex", justifyContent: "center" }} />

          {googleLoadFailed && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                borderRadius: 8,
                fontSize: 13,
                color: "#92400e",
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              {t("googleLoadError")}
            </div>
          )}
        </div>

        {/* Disclaimer legal en footer */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            textAlign: "center",
            fontSize: 11,
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: "0 0 8px 0" }}>
            {t("footerAccept")}{" "}
            <Link href="/terminos" style={{ color: "#2563eb" }}>
              {t("acceptTermsLink")}
            </Link>{" "}
            {t("footerAnd")}{" "}
            <Link href="/privacidad" style={{ color: "#2563eb" }}>
              {t("acceptPrivacyLink")}
            </Link>
            .
          </p>
          <p style={{ margin: 0, fontSize: 10 }}>
            {t("entertainmentOnly")}
          </p>
        </div>
      </div>

      {/* Modal de consent para Google (usuarios nuevos) */}
      {showGoogleConsentModal && (
        <>
          <div
            onClick={() => {
              setShowGoogleConsentModal(false);
              setPendingGoogleCredential(null);
              setError(null);
            }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--surface)",
              borderRadius: 16,
              padding: 24,
              width: isMobile ? "90vw" : 420,
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              zIndex: 1001,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>{t("googleConsentTitle")}</h3>
            <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "var(--muted)" }}>
              {t("googleConsentSubtitle")}
            </p>

            <ConsentCheckboxes inModal />

            {error && (
              <div className="alert-error" style={{ marginTop: 16, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => {
                  setShowGoogleConsentModal(false);
                  setPendingGoogleCredential(null);
                  setError(null);
                  setAcceptTerms(false);
                  setAcceptPrivacy(false);
                  setAcceptAge(false);
                  setAcceptMarketing(false);
                }}
                style={{
                  ...buttonStyle,
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleGoogleConsentSubmit}
                disabled={loading || !acceptTerms || !acceptPrivacy || !acceptAge}
                style={{
                  ...buttonStyle,
                  opacity: !acceptTerms || !acceptPrivacy || !acceptAge ? 0.5 : 1,
                }}
              >
                {loading ? t("loading") : t("registerTab")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
