import { useState, useEffect } from "react";
import { resetPassword } from "../lib/api";
import { Link, useSearchParams } from "react-router-dom";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Token inválido o faltante");
    }
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!token) throw new Error("Token inválido");
      if (!newPassword || newPassword.length < 8) {
        throw new Error("La contraseña debe tener al menos 8 caracteres");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Las contraseñas no coinciden");
      }

      await resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? "Error al restablecer contraseña");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
        <div className="card" style={{ padding: 24, borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 8 }}>Contraseña actualizada</h2>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            Tu contraseña ha sido actualizada exitosamente.
          </p>
          <Link to="/">
            <button style={{ width: "100%" }}>Iniciar sesión</button>
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
        <div className="alert-error" style={{ padding: 16, borderRadius: 8 }}>
          Token inválido o faltante. Por favor solicita un nuevo enlace de recuperación.
        </div>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link to="/forgot-password">
            <button>Solicitar nuevo enlace</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>Nueva contraseña</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
      </div>

      <form onSubmit={onSubmit} className="card" style={{ padding: 16, borderRadius: 16 }}>
        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Nueva contraseña</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            minLength={8}
            required
            autoFocus
          />
        </label>

        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Confirma la contraseña</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite tu contraseña"
            minLength={8}
            required
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <span style={{ fontSize: 11, color: "var(--error)" }}>Las contraseñas no coinciden</span>
          )}
        </label>

        <button disabled={loading || !token} style={{ width: "100%", marginBottom: 12 }}>
          {loading ? "Actualizando..." : "Restablecer contraseña"}
        </button>

        <div style={{ textAlign: "center" }}>
          <Link to="/" style={{ fontSize: 13, color: "var(--primary)", textDecoration: "none" }}>
            Volver al login
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
