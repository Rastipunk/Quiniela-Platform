"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { login, register, loginWithGoogle, type RegisterConsentOptions } from "../../lib/api";
import { consumeSessionExpiredFlag, setToken } from "../../lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../../hooks/useIsMobile";

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
      setError(err?.message ?? "Error al iniciar sesión con Google");
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
      setError("Debes aceptar los Términos de Servicio");
      return;
    }
    if (!acceptPrivacy) {
      setError("Debes aceptar la Política de Privacidad");
      return;
    }
    if (!acceptAge) {
      setError("Debes confirmar que tienes al menos 13 años");
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
      setError(err?.message ?? "Error al crear cuenta con Google");
    } finally {
      setLoading(false);
    }
  };

  // Inicializar Google Sign In (with retry for script loading)
  useEffect(() => {
    const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!GOOGLE_CLIENT_ID) {
      console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID no configurado. Google Sign In no estará disponible.");
      return;
    }

    const initGoogle = () => {
      if (!window.google || !googleButtonRef.current) return false;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: googleButtonRef.current.offsetWidth,
        text: mode === "login" ? "signin_with" : "signup_with",
        locale: "es",
      });
      return true;
    };

    // Try immediately
    if (initGoogle()) return;

    // Retry until script loads (max 5 seconds)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (initGoogle() || attempts >= 50) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
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
      if (!em) throw new Error("Email requerido.");
      if (!password) throw new Error("Contraseña requerida.");

      if (mode === "register") {
        // Validaciones extras para registro
        const emConfirm = emailConfirm.trim().toLowerCase();
        if (em !== emConfirm) {
          throw new Error("Los emails no coinciden");
        }

        const user = username.trim().toLowerCase();
        if (!user || user.length < 3) {
          throw new Error("Username debe tener al menos 3 caracteres");
        }

        if (!displayName.trim()) {
          throw new Error("Nombre visible requerido");
        }

        if (password.length < 8) {
          throw new Error("La contraseña debe tener al menos 8 caracteres");
        }

        // Validar consent obligatorio
        if (!acceptTerms) {
          throw new Error("Debes aceptar los Términos de Servicio");
        }
        if (!acceptPrivacy) {
          throw new Error("Debes aceptar la Política de Privacidad");
        }
        if (!acceptAge) {
          throw new Error("Debes confirmar que tienes al menos 13 años");
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
          Para crear tu cuenta, confirma lo siguiente:
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
          Acepto los{" "}
          <Link href="/terminos" target="_blank" style={{ color: "#2563eb" }}>
            Términos de Servicio
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
          Acepto la{" "}
          <Link href="/privacidad" target="_blank" style={{ color: "#2563eb" }}>
            Política de Privacidad
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
          Confirmo que tengo al menos <strong>13 años</strong> de edad{" "}
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
          Acepto recibir noticias y actualizaciones por email (opcional)
        </span>
      </label>

      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
        <span style={{ color: "#dc2626" }}>*</span> Campos obligatorios
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
          Quiniela Platform
        </div>
        <div
          style={{
            color: "var(--muted)",
            marginBottom: 18,
            fontSize: isMobile ? 15 : 14,
            textAlign: isMobile ? "center" : "left",
          }}
        >
          Entra a tu cuenta o crea una nueva para unirte o crear pools.
        </div>

        {expired && (
          <div className="alert-error" style={{ marginBottom: 12 }}>
            Tu sesión expiró. Inicia sesión de nuevo.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setMode("login")}
            style={tabButtonStyle(mode === "login")}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            style={tabButtonStyle(mode === "register")}
          >
            Crear cuenta
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
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              style={inputStyle}
            />
          </label>

          {mode === "register" && (
            <>
              <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                  Confirma tu email
                </span>
                <input
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  style={inputStyle}
                />
                {emailConfirm && email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase() && (
                  <span style={{ fontSize: 12, color: "var(--error)" }}>Los emails no coinciden</span>
                )}
              </label>

              <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                  Username <span style={{ fontWeight: "normal" }}>(único, 3-20 caracteres)</span>
                </span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="tu_usuario"
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_-]+"
                  required
                  style={inputStyle}
                />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Solo letras, números, guiones y guiones bajos
                </span>
              </label>

              <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                  Nombre visible
                </span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  style={inputStyle}
                />
              </label>
            </>
          )}

          <label style={{ display: "grid", gap: 6, marginBottom: mode === "register" ? 8 : 12 }}>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              style={inputStyle}
            />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Mínimo 8 caracteres.</span>
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
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          )}

          {mode === "register" && <ConsentCheckboxes />}

          <button disabled={loading} style={buttonStyle}>
            {loading ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
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
            <span>o continúa con</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <div ref={googleButtonRef} style={{ display: "flex", justifyContent: "center" }} />
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
            Al usar esta plataforma aceptas nuestros{" "}
            <Link href="/terminos" style={{ color: "#2563eb" }}>
              Términos de Servicio
            </Link>{" "}
            y{" "}
            <Link href="/privacidad" style={{ color: "#2563eb" }}>
              Política de Privacidad
            </Link>
            .
          </p>
          <p style={{ margin: 0, fontSize: 10 }}>
            Esta plataforma es solo para entretenimiento. No involucra dinero real ni apuestas.
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
            <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Crear cuenta con Google</h3>
            <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "var(--muted)" }}>
              Para completar tu registro, confirma lo siguiente:
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
                Cancelar
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
                {loading ? "..." : "Crear cuenta"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
