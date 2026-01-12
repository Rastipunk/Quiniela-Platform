import { useState } from "react";
import { forgotPassword } from "../lib/api";
import { Link } from "react-router-dom";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const em = email.trim().toLowerCase();
      if (!em) throw new Error("Email requerido");

      const res = await forgotPassword(em);
      setSuccess(true);
      console.log(res.message);
    } catch (err: any) {
      setError(err?.message ?? "Error al enviar solicitud");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
        <div className="card" style={{ padding: 24, borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <h2 style={{ marginBottom: 8 }}>Revisa tu email</h2>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
            El enlace expira en 1 hora.
          </p>
          <Link to="/">
            <button style={{ width: "100%" }}>Volver al inicio</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>Recuperar contraseña</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
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
            autoFocus
          />
        </label>

        <button disabled={loading} style={{ width: "100%", marginBottom: 12 }}>
          {loading ? "Enviando..." : "Enviar enlace de recuperación"}
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
