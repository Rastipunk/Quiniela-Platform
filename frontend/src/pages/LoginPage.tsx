import { useEffect, useMemo, useState, useRef } from "react";
import { login, register, loginWithGoogle } from "../lib/api";
import { consumeSessionExpiredFlag, setToken } from "../lib/auth";
import { Link } from "react-router-dom";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";

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

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const expired = useMemo(() => consumeSessionExpiredFlag(), []);
  const isMobile = useIsMobile();

  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Google Sign In callback
  const handleGoogleCallback = async (response: any) => {
    setError(null);
    setLoading(true);

    try {
      // Auto-detectar timezone del navegador
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const result = await loginWithGoogle(response.credential, timezone);
      setToken(result.token);
      onLoggedIn();
    } catch (err: any) {
      setError(err?.message ?? "Error al iniciar sesión con Google");
    } finally {
      setLoading(false);
    }
  };

  // Inicializar Google Sign In
  useEffect(() => {
    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!GOOGLE_CLIENT_ID) {
      console.warn("VITE_GOOGLE_CLIENT_ID no configurado. Google Sign In no estará disponible.");
      return;
    }

    if (!window.google) {
      console.warn("Google Identity Services no cargado");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
    });

    if (googleButtonRef.current) {
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: googleButtonRef.current.offsetWidth,
        text: mode === "login" ? "signin_with" : "signup_with",
        locale: "es",
      });
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

        // Auto-detectar timezone del navegador
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const res = await register(em, user, displayName.trim(), password, timezone);
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

          <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
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
                to="/forgot-password"
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
      </div>
    </div>
  );
}
