"use client";

import { Suspense, useState, useEffect } from "react";
import { resetPassword } from "../../lib/api";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken, clearToken } from "../../lib/auth";

/**
 * Página de restablecimiento de contraseña.
 *
 * Esta página es accesible independientemente del estado de autenticación,
 * permitiendo a usuarios con sesión activa restablecer su contraseña
 * (ej: desde otro dispositivo o por seguridad).
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#6b7280" }}>Cargando...</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detectar si el usuario tiene una sesión activa
  const hasActiveSession = !!getToken();

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

      // Si había sesión activa, cerrarla por seguridad
      // (la contraseña cambió, el usuario debe re-autenticarse)
      if (hasActiveSession) {
        clearToken();
      }

      setSuccess(true);
    } catch (err: any) {
      // Manejar errores específicos del backend
      const errorCode = err?.payload?.error;

      if (errorCode === "INVALID_TOKEN") {
        setError("El enlace ha expirado o ya fue utilizado. Solicita uno nuevo.");
      } else {
        setError(err?.message ?? "Error al restablecer contraseña");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogoutAndContinue() {
    clearToken();
    // Forzar re-render para actualizar hasActiveSession
    window.location.reload();
  }

  // Estado: Contraseña actualizada exitosamente
  if (success) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
        <div className="card" style={{ padding: 24, borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 8 }}>Contraseña actualizada</h2>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            Tu contraseña ha sido actualizada exitosamente. Por seguridad, todas las sesiones
            activas han sido cerradas.
          </p>
          <Link href="/">
            <button style={{ width: "100%" }}>Iniciar sesión</button>
          </Link>
        </div>
      </div>
    );
  }

  // Estado: Token inválido o faltante
  if (!token) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
        <div className="card" style={{ padding: 24, borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ marginBottom: 8 }}>Enlace inválido</h2>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            Este enlace de recuperación es inválido o ha expirado. Los enlaces son válidos por 1
            hora.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link href="/forgot-password">
              <button style={{ width: "100%" }}>Solicitar nuevo enlace</button>
            </Link>
            <Link href="/">
              <button
                style={{
                  width: "100%",
                  background: "transparent",
                  color: "var(--primary)",
                  border: "1px solid var(--border)",
                }}
              >
                Volver al inicio
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Estado: Formulario de nueva contraseña
  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
      {/* Aviso de sesión activa */}
      {hasActiveSession && (
        <div
          style={{
            padding: 16,
            marginBottom: 16,
            borderRadius: 12,
            backgroundColor: "var(--warning-bg, #fef3c7)",
            border: "1px solid var(--warning-border, #f59e0b)",
            color: "var(--warning-text, #92400e)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚠️</span>
            <span>Sesión activa detectada</span>
          </div>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            Tienes una sesión iniciada. Si continúas, la contraseña se actualizará y tu sesión
            actual será cerrada por seguridad.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => router.push("/")}
              style={{
                flex: 1,
                minWidth: 120,
                padding: "8px 12px",
                fontSize: 13,
                background: "transparent",
                color: "var(--warning-text, #92400e)",
                border: "1px solid var(--warning-border, #f59e0b)",
              }}
            >
              Ir al dashboard
            </button>
            <button
              onClick={handleLogoutAndContinue}
              style={{
                flex: 1,
                minWidth: 120,
                padding: "8px 12px",
                fontSize: 13,
                background: "var(--warning-border, #f59e0b)",
                color: "white",
                border: "none",
              }}
            >
              Cerrar sesión primero
            </button>
          </div>
        </div>
      )}

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
          <Link href="/" style={{ fontSize: 13, color: "var(--primary)", textDecoration: "none" }}>
            {hasActiveSession ? "Volver al dashboard" : "Volver al login"}
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
