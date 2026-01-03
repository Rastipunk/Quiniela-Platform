import { useMemo, useState } from "react";
import { login, register } from "../lib/api";
import { consumeSessionExpiredFlag, setToken } from "../lib/auth";

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const expired = useMemo(() => consumeSessionExpiredFlag(), []);

  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const em = email.trim().toLowerCase();
      if (!em) throw new Error("Email requerido.");
      if (!password) throw new Error("Contraseña requerida.");

      const res =
        mode === "login"
          ? await login(em, password)
          : await register(em, displayName.trim() || "Jugador", password);

      setToken(res.token);
      onLoggedIn();
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
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
        </label>

        {mode === "register" && (
          <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Nombre visible</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" />
          </label>
        )}

        <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Contraseña</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Mínimo 8 caracteres.</span>
        </label>

        <button disabled={loading} style={{ width: "100%" }}>
          {loading ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>

        {error && (
          <div className="alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
}

