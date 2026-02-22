"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { login, register, loginWithGoogle, type RegisterConsentOptions } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";

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
    if (!window.google) return;

    const timer = setTimeout(() => {
      if (googleButtonRef.current) {
        window.google!.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });

        window.google!.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: googleButtonRef.current.offsetWidth || 280,
          text: mode === "login" ? "signin_with" : "signup_with",
          locale,
        });
      }
    }, 100);

    return () => clearTimeout(timer);
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

        if (password.length < 8) {
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

  const inputStyle = {
    padding: 12,
    fontSize: 15,
    minHeight: TOUCH_TARGET.minimum,
    borderRadius: 8,
    border: "1px solid var(--border)",
    width: "100%",
    boxSizing: "border-box" as const,
    background: "var(--bg)",
    color: "var(--text)",
    ...mobileInteractiveStyles.tapHighlight,
  };

  const buttonStyle = {
    width: "100%",
    padding: 14,
    fontSize: 15,
    fontWeight: 600,
    minHeight: TOUCH_TARGET.comfortable,
    borderRadius: 10,
    cursor: "pointer",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    ...mobileInteractiveStyles.tapHighlight,
  };

  const tabButtonStyle = (isActive: boolean) => ({
    flex: 1,
    padding: 12,
    fontSize: 14,
    fontWeight: 500,
    minHeight: TOUCH_TARGET.minimum,
    background: isActive ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "transparent",
    color: isActive ? "#fff" : "var(--text)",
    border: isActive ? "none" : "1px solid var(--border)",
    borderRadius: 8,
    cursor: "pointer",
    ...mobileInteractiveStyles.tapHighlight,
  });

  const checkboxLabelStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1.4,
  };

  const checkboxStyle = {
    width: 16,
    height: 16,
    marginTop: 2,
    cursor: "pointer",
    flexShrink: 0,
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
          <Link href="/terminos" target="_blank" style={{ color: "#667eea" }}>{t("acceptTermsLink")}</Link>{" "}
          <span style={{ color: "#dc2626" }}>*</span>
        </span>
      </label>

      <label style={checkboxLabelStyle}>
        <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} style={checkboxStyle} />
        <span>
          {t("acceptPrivacyText")}{" "}
          <Link href="/privacidad" target="_blank" style={{ color: "#667eea" }}>{t("acceptPrivacyLink")}</Link>{" "}
          <span style={{ color: "#dc2626" }}>*</span>
        </span>
      </label>

      <label style={checkboxLabelStyle}>
        <input type="checkbox" checked={acceptAge} onChange={(e) => setAcceptAge(e.target.checked)} style={checkboxStyle} />
        <span>
          {t("acceptAge")}{" "}
          <span style={{ color: "#dc2626" }}>*</span>
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
      <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, animation: "fadeIn 0.25s ease" }} />

      <div ref={panelRef} style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: isMobile ? "100%" : "min(420px, 90vw)", background: "var(--surface)", zIndex: 1001, boxShadow: "-8px 0 30px rgba(0,0,0,0.2)", animation: "slideInRight 0.3s ease", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {mode === "login" ? t("loginTitle") : t("registerTitle")}
          </h2>
          <button onClick={onClose} aria-label={t("close")} style={{ width: TOUCH_TARGET.minimum, height: TOUCH_TARGET.minimum, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 18, cursor: "pointer", ...mobileInteractiveStyles.tapHighlight }}>
            X
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button type="button" onClick={() => setMode("login")} style={tabButtonStyle(mode === "login")}>{t("loginTab")}</button>
            <button type="button" onClick={() => setMode("register")} style={tabButtonStyle(mode === "register")}>{t("registerTab")}</button>
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
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("passwordHint")}</span>
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
              <div style={{ marginTop: 12, padding: 12, background: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.3)", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
                {error}
              </div>
            )}
          </form>

          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, color: "var(--muted)", fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span>{t("orContinueWith")}</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <div ref={googleButtonRef} style={{ display: "flex", justifyContent: "center" }} />
          </div>

          <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
            <Link href="/login" onClick={onClose} style={{ color: "#667eea", textDecoration: "none" }}>
              {t("openFullPage")}
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", textAlign: "center", fontSize: 10, color: "var(--muted)", background: "var(--bg)" }}>
          {t("footerAccept")}{" "}
          <Link href="/terminos" target="_blank" style={{ color: "#667eea" }}>{t("footerTerms")}</Link>{" "}
          {t("footerAnd")}{" "}
          <Link href="/privacidad" target="_blank" style={{ color: "#667eea" }}>{t("footerPrivacy")}</Link>
        </div>
      </div>

      {/* Google Consent Modal */}
      {showGoogleConsentModal && (
        <>
          <div onClick={() => { setShowGoogleConsentModal(false); setPendingGoogleCredential(null); setError(null); }} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--surface)", borderRadius: 16, padding: 24, width: isMobile ? "90vw" : 380, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", zIndex: 1101, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>{t("googleConsentTitle")}</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: 12, color: "var(--muted)" }}>{t("googleConsentSubtitleShort")}</p>

            <ConsentCheckboxes inModal />

            {error && (
              <div style={{ marginTop: 12, padding: 10, background: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.3)", borderRadius: 8, color: "#dc2626", fontSize: 12 }}>
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
