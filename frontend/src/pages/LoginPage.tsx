import { useEffect, useMemo, useState, useRef } from "react";
import { login, register, loginWithGoogle } from "../lib/api";
import { consumeSessionExpiredFlag, setToken } from "../lib/auth";
import { Link } from "react-router-dom";

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

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>Quiniela Platform</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        Entra a tu cuenta o crea una nueva para unirte o crear pools.
      </div>

      {expired && (
        <div className="alert-error" style={{ marginBottom: 12 }}>
          Tu sesión expiró. Inicia sesión de nuevo.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setMode("login")}
          style={{
            flex: 1,
            background: mode === "login" ? "var(--primary)" : "var(--surface)",
            color: mode === "login" ? "#fff" : "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          style={{
            flex: 1,
            background: mode === "register" ? "var(--primary)" : "var(--surface)",
            color: mode === "register" ? "#fff" : "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={onSubmit} className="card" style={{ padding: 16, borderRadius: 16 }}>
        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
          />
        </label>

        {mode === "register" && (
          <>
            <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Confirma tu email</span>
              <input
                type="email"
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                placeholder="tu@email.com"
                required
              />
              {emailConfirm && email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase() && (
                <span style={{ fontSize: 11, color: "var(--error)" }}>Los emails no coinciden</span>
              )}
            </label>

            <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
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
              />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                Solo letras, números, guiones y guiones bajos
              </span>
            </label>

            <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Nombre visible</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tu nombre"
                required
              />
            </label>
          </>
        )}

        <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Mínimo 8 caracteres.</span>
        </label>

        {mode === "login" && (
          <div style={{ marginBottom: 12, textAlign: "right" }}>
            <Link
              to="/forgot-password"
              style={{ fontSize: 13, color: "var(--primary)", textDecoration: "none" }}
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        )}

        <button disabled={loading} style={{ width: "100%" }}>
          {loading ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>

        {error && (
          <div className="alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </form>

      {/* Google Sign In */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
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
  );
}
