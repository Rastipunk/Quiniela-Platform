import { useState } from "react";
import { resendVerificationEmail } from "../lib/api";
import { getToken } from "../lib/auth";

type Props = {
  emailVerified: boolean;
  isGoogleAccount?: boolean;
  email: string;
};

export function EmailVerificationBanner({
  emailVerified,
  isGoogleAccount,
  email,
}: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No mostrar nada si el email ya está verificado o es cuenta de Google
  if (emailVerified || isGoogleAccount) {
    return null;
  }

  const handleResend = async () => {
    const token = getToken();
    if (!token) return;

    setSending(true);
    setError(null);

    try {
      await resendVerificationEmail(token);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Error al enviar el email de verificación");
    } finally {
      setSending(false);
    }
  };

  const bannerStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    border: "1px solid #f59e0b",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 24,
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 24,
    lineHeight: 1,
    flexShrink: 0,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: "#92400e",
    marginBottom: 4,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#a16207",
    lineHeight: 1.5,
    marginBottom: sent || error ? 8 : 0,
  };

  const buttonStyle: React.CSSProperties = {
    background: "#f59e0b",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: sending ? "not-allowed" : "pointer",
    opacity: sending ? 0.7 : 1,
    marginTop: 8,
  };

  const successStyle: React.CSSProperties = {
    background: "#d1fae5",
    border: "1px solid #10b981",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#065f46",
    fontSize: 13,
    marginTop: 8,
  };

  const errorStyle: React.CSSProperties = {
    background: "#fee2e2",
    border: "1px solid #ef4444",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#b91c1c",
    fontSize: 13,
    marginTop: 8,
  };

  return (
    <div style={bannerStyle}>
      <div style={iconStyle}>&#9888;&#65039;</div>
      <div style={contentStyle}>
        <div style={titleStyle}>Verifica tu email</div>
        <div style={descStyle}>
          Enviamos un enlace de verificación a <strong>{email}</strong>.
          <br />
          Revisa tu bandeja de entrada (y spam) para activar todas las
          funciones.
        </div>

        {sent && (
          <div style={successStyle}>
            &#10004; Email de verificación enviado. Revisa tu bandeja de entrada.
          </div>
        )}

        {error && <div style={errorStyle}>{error}</div>}

        {!sent && (
          <button style={buttonStyle} onClick={handleResend} disabled={sending}>
            {sending ? "Enviando..." : "Reenviar email de verificación"}
          </button>
        )}
      </div>
    </div>
  );
}
