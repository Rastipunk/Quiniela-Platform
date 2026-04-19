"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { login, register, loginWithGoogle, type RegisterConsentOptions } from "@/lib/api";
import { trackEvent, setAnalyticsUserId } from "@/lib/analytics";
import { trackMetaEvent, setMetaUserData } from "@/lib/metaPixel";
import { acceptAnalyticsConsent } from "@/components/CookieConsent";
import { setToken } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { colors, radii, shadows, fontWeight as fw, zIndex } from "@/lib/theme";
import PasswordStrengthIndicator from "./PasswordStrengthIndicator";

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

interface AuthSlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoggedIn: () => void;
  initialMode?: "login" | "register";
}

export function AuthSlidePanel({ isOpen, onClose, onLoggedIn, initialMode }: AuthSlidePanelProps) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const isMobile = useIsMobile();

  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    if (isOpen && initialMode) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptAge, setAcceptAge] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);

  const [showGoogleConsentModal, setShowGoogleConsentModal] = useState(false);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoadFailed, setGoogleLoadFailed] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !showGoogleConsentModal) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, showGoogleConsentModal]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setEmailConfirm("");
      setUsername("");
      setDisplayName("");
      setPassword("");
      setError(null);
      setAcceptTerms(false);
      setAcceptPrivacy(false);
      setAcceptAge(false);
      setAcceptMarketing(false);
      setShowGoogleConsentModal(false);
      setPendingGoogleCredential(null);
    }
  }, [isOpen]);

  const handleGoogleCallback = async (response: any) => {
    setError(null);
    setLoading(true);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await loginWithGoogle(response.credential, timezone);
      setToken(result.token);
      acceptAnalyticsConsent();
      if (result.user?.id) {
        setAnalyticsUserId(result.user.id);
        setMetaUserData({ externalId: result.user.id, email: result.user.email });
      }
      trackEvent("login", { method: "google" });
      onLoggedIn();
    } catch (err: any) {
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

  const handleGoogleConsentSubmit = async () => {
    if (!pendingGoogleCredential) return;

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
      acceptAnalyticsConsent();
      if (result.user?.id) {
        setAnalyticsUserId(result.user.id);
        setMetaUserData({ externalId: result.user.id, email: result.user.email });
      }
      trackEvent("sign_up", { method: "google" });
      trackMetaEvent("CompleteRegistration", { content_name: "google", status: true });
      onLoggedIn();
    } catch (err: any) {
      setError(err?.message ?? t("googleRegisterError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!GOOGLE_CLIENT_ID) return;

    setGoogleLoadFailed(false);
    let isMounted = true;

    const initGoogle = () => {
      if (!window.google || !googleButtonRef.current) return false;
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: googleButtonRef.current.offsetWidth || 280,
          text: mode === "login" ? "signin_with" : "signup_with",
          locale,
        });
        return true;
      } catch {
        return false;
      }
    };

    if (initGoogle()) return () => { isMounted = false; };

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
  }, [isOpen, mode]);

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

        if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
          throw new Error(t("errors.passwordMinLength"));
        }

        if (!acceptTerms) {
          throw new Error(t("errors.mustAcceptTerms"));
        }
        if (!acceptPrivacy) {
          throw new Error(t("errors.mustAcceptPrivacy"));
        }
        if (!acceptAge) {
          throw new Error(t("errors.mustAcceptAge"));
        }

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const consent: RegisterConsentOptions = {
          acceptTerms,
          acceptPrivacy,
          acceptAge,
          acceptMarketing,
        };

        const res = await register(em, user, displayName.trim(), password, timezone, consent);
        setToken(res.token);
        acceptAnalyticsConsent();
        if (res.user?.id) {
          setAnalyticsUserId(res.user.id);
          setMetaUserData({ externalId: res.user.id, email: em, firstName: displayName.trim() });
        }
        trackEvent("sign_up", { method: "email" });
        trackMetaEvent("CompleteRegistration", { content_name: "email", status: true });
        onLoggedIn();
      } else {
        const res = await login(em, password);
        setToken(res.token);
        acceptAnalyticsConsent();
        if (res.user?.id) {
          setAnalyticsUserId(res.user.id);
          setMetaUserData({ externalId: res.user.id, email: em });
        }
        trackEvent("login", { method: "email" });
        onLoggedIn();
      }
    } catch (err: any) {
      const errorCode = err?.payload?.error ?? err?.code;
      if (errorCode === "GOOGLE_ACCOUNT_NO_PASSWORD") {
        setError(t("errors.googleAccountUseGoogle"));
      } else {
        setError(err?.message ?? "Error");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    padding: 12,
    fontSize: 15,
    minHeight: TOUCH_TARGET.minimum,
    borderRadius: radii.lg,
    border: `1px solid ${colors.varBorder}`,
    width: "100%",
    boxSizing: "border-box" as const,
    background: colors.varBg,
    color: colors.varText,
    ...mobileInteractiveStyles.tapHighlight,
  };

  const buttonStyle = {
    width: "100%",
    padding: 14,
    fontSize: 15,
    fontWeight: fw.semibold,
    minHeight: TOUCH_TARGET.comfortable,
    borderRadius: radii.xl,
    cursor: "pointer",
    background: colors.brandGradient,
    color: "white",
    border: "none",
    ...mobileInteractiveStyles.tapHighlight,
  };

  const tabButtonStyle = (isActive: boolean) => ({
    flex: 1,
    padding: 12,
    fontSize: 14,
    fontWeight: fw.medium,
    minHeight: TOUCH_TARGET.minimum,
    background: isActive ? colors.brandGradient : "transparent",
    color: isActive ? colors.white : colors.varText,
    border: isActive ? "none" : `1px solid ${colors.varBorder}`,
    borderRadius: radii.lg,
    cursor: "pointer",
    ...mobileInteractiveStyles.tapHighlight,
  });

  const checkboxLabelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1.4,
  };

  const checkboxStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    minWidth: 20,
    cursor: "pointer",
    flexShrink: 0,
    accentColor: colors.brand,
  };

  const ConsentCheckboxes = ({ inModal = false }: { inModal?: boolean }) => (
    <div
      style={{
        marginTop: inModal ? 0 : 12,
        marginBottom: inModal ? 0 : 8,
        padding: inModal ? 0 : "12px 0",
        borderTop: inModal ? "none" : "1px solid var(--border)",
      }}
    >
      {!inModal && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10, fontWeight: 500 }}>
          {t("consentHeaderShort")}
        </div>
      )}

      <label style={checkboxLabelStyle}>
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} style={checkboxStyle} />
        <span>
          {t("acceptTermsText")}{" "}
          <Link href="/terminos" target="_blank" style={{ color: colors.brandLight }}>{t("acceptTermsLink")}</Link>{" "}
          <span style={{ color: colors.error }}>*</span>
        </span>
      </label>

      <label style={checkboxLabelStyle}>
        <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} style={checkboxStyle} />
        <span>
          {t("acceptPrivacyText")}{" "}
          <Link href="/privacidad" target="_blank" style={{ color: colors.brandLight }}>{t("acceptPrivacyLink")}</Link>{" "}
          <span style={{ color: colors.error }}>*</span>
        </span>
      </label>

      <label style={checkboxLabelStyle}>
        <input type="checkbox" checked={acceptAge} onChange={(e) => setAcceptAge(e.target.checked)} style={checkboxStyle} />
        <span>
          {t("acceptAge")}{" "}
          <span style={{ color: colors.error }}>*</span>
        </span>
      </label>

      <label style={checkboxLabelStyle}>
        <input type="checkbox" checked={acceptMarketing} onChange={(e) => setAcceptMarketing(e.target.checked)} style={checkboxStyle} />
        <span style={{ color: "var(--muted)" }}>{t("acceptMarketing")}</span>
      </label>
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} aria-hidden="true" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: colors.overlay, zIndex: zIndex.modal, animation: "fadeIn 0.25s ease" }} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="auth-panel-title" style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: isMobile ? "100%" : "min(420px, 90vw)", background: colors.varSurface, zIndex: zIndex.modalAbove, boxShadow: `-8px 0 30px ${colors.shadowMedium}`, animation: "slideInRight 0.3s ease", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${colors.varBorder}`, background: colors.varBg }}>
          <h2 id="auth-panel-title" style={{ margin: 0, fontSize: 18, fontWeight: fw.bold }}>
            {mode === "login" ? t("loginTitle") : t("registerTitle")}
          </h2>
          <button onClick={onClose} aria-label={t("close")} style={{ width: TOUCH_TARGET.minimum, height: TOUCH_TARGET.minimum, display: "flex", alignItems: "center", justifyContent: "center", background: colors.varSurface, border: `1px solid ${colors.varBorder}`, borderRadius: radii.lg, color: colors.varText, fontSize: 18, cursor: "pointer", ...mobileInteractiveStyles.tapHighlight }}>
            X
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button type="button" onClick={() => setMode("login")} style={tabButtonStyle(mode === "login")}>{t("loginTab")}</button>
            <button type="button" onClick={() => setMode("register")} style={tabButtonStyle(mode === "register")}>{t("registerTab")}</button>
          </div>

          {/* Google Sign-In — prominent at top */}
          <div ref={googleButtonRef} style={{ display: "flex", justifyContent: "center", marginBottom: 8 }} />
          {googleLoadFailed && (
            <div style={{
              marginBottom: 8,
              padding: "10px 14px",
              background: "#fffbeb",
              border: "1px solid #f59e0b",
              borderRadius: radii.lg,
              fontSize: 13,
              color: "#92400e",
              textAlign: "center",
              lineHeight: 1.4,
            }}>
              {t("googleLoadError")}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, color: "var(--muted)", fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span>{mode === "login" ? t("orContinueWith") : t("orRegisterWithEmail")}</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <form onSubmit={onSubmit}>
            <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{t("email")}</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} required style={inputStyle} />
            </label>

            {mode === "register" && (
              <>
                <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{t("confirmEmailShort")}</span>
                  <input type="email" value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} placeholder={t("emailPlaceholder")} required style={inputStyle} />
                  {emailConfirm && email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase() && (
                    <span style={{ fontSize: 11, color: "var(--error)" }}>{t("emailsMismatch")}</span>
                  )}
                </label>

                <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{t("username")}</span>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("usernamePlaceholder")} minLength={3} maxLength={20} pattern="[a-zA-Z0-9_-]+" required style={inputStyle} />
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("usernameHint")}</span>
                </label>

                <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{t("displayName")}</span>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("displayNamePlaceholder")} required style={inputStyle} />
                </label>
              </>
            )}

            <label style={{ display: "grid", gap: 4, marginBottom: mode === "register" ? 4 : 12 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{t("password")}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required style={inputStyle} />
              {mode === "register" ? (
                <PasswordStrengthIndicator password={password} />
              ) : (
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("passwordHint")}</span>
              )}
            </label>

            {mode === "login" && (
              <div style={{ marginBottom: 16, textAlign: "right" }}>
                <Link href="/forgot-password" onClick={onClose} style={{ fontSize: 13, color: "#667eea", textDecoration: "none" }}>
                  {t("forgotPassword")}
                </Link>
              </div>
            )}

            {mode === "register" && <ConsentCheckboxes />}

            <button disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }}>
              {loading ? t("loading") : mode === "login" ? t("loginTab") : t("registerTab")}
            </button>

            {error && (
              <div style={{ marginTop: 12, padding: 12, background: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.3)", borderRadius: radii.lg, color: colors.error, fontSize: 13 }}>
                {error}
              </div>
            )}
          </form>


          <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
            <Link href="/login" onClick={onClose} style={{ color: "#667eea", textDecoration: "none" }}>
              {t("openFullPage")}
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${colors.varBorder}`, textAlign: "center", fontSize: 10, color: colors.varMuted, background: colors.varBg }}>
          {t("footerAccept")}{" "}
          <Link href="/terminos" target="_blank" style={{ color: colors.brandLight }}>{t("footerTerms")}</Link>{" "}
          {t("footerAnd")}{" "}
          <Link href="/privacidad" target="_blank" style={{ color: colors.brandLight }}>{t("footerPrivacy")}</Link>
        </div>
      </div>

      {/* Google Consent Modal */}
      {showGoogleConsentModal && (
        <>
          <div onClick={() => { setShowGoogleConsentModal(false); setPendingGoogleCredential(null); setError(null); }} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: colors.overlayDark, zIndex: zIndex.toast }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: colors.varSurface, borderRadius: radii["4xl"], padding: 24, width: isMobile ? "90vw" : 380, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", zIndex: zIndex.toast, boxShadow: `0 20px 60px ${colors.shadowDark}` }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>{t("googleConsentTitle")}</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: 12, color: "var(--muted)" }}>{t("googleConsentSubtitleShort")}</p>

            <ConsentCheckboxes inModal />

            {error && (
              <div style={{ marginTop: 12, padding: 10, background: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.3)", borderRadius: radii.lg, color: colors.error, fontSize: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => { setShowGoogleConsentModal(false); setPendingGoogleCredential(null); setError(null); setAcceptTerms(false); setAcceptPrivacy(false); setAcceptAge(false); setAcceptMarketing(false); }} style={{ ...buttonStyle, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}>
                {t("cancel")}
              </button>
              <button type="button" onClick={handleGoogleConsentSubmit} disabled={loading || !acceptTerms || !acceptPrivacy || !acceptAge} style={{ ...buttonStyle, opacity: !acceptTerms || !acceptPrivacy || !acceptAge ? 0.5 : 1 }}>
                {loading ? t("loading") : t("registerTab")}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
