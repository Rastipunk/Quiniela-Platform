import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../lib/auth";
import {
  getAdminEmailSettings,
  updateAdminEmailSettings,
} from "../lib/api";

// Tipo definido localmente para evitar bug de Vite con type exports
type PlatformEmailSettings = {
  emailWelcomeEnabled: boolean;
  emailPoolInvitationEnabled: boolean;
  emailDeadlineReminderEnabled: boolean;
  emailResultPublishedEnabled: boolean;
  emailPoolCompletedEnabled: boolean;
};

// Tipo para el estado del toggle con descripción
type EmailToggle = {
  key: keyof PlatformEmailSettings;
  label: string;
  description: string;
};

const EMAIL_TOGGLES: EmailToggle[] = [
  {
    key: "emailWelcomeEnabled",
    label: "Email de Bienvenida",
    description: "Se envía a nuevos usuarios al registrarse. Incluye información de inicio rápido.",
  },
  {
    key: "emailPoolInvitationEnabled",
    label: "Invitación a Quiniela",
    description: "Notifica a usuarios cuando son invitados a una quiniela.",
  },
  {
    key: "emailDeadlineReminderEnabled",
    label: "Recordatorio de Deadline",
    description: "Recuerda a usuarios hacer sus pronósticos antes del cierre.",
  },
  {
    key: "emailResultPublishedEnabled",
    label: "Resultado Publicado",
    description: "Notifica cuando se publica el resultado de un partido.",
  },
  {
    key: "emailPoolCompletedEnabled",
    label: "Quiniela Completada",
    description: "Notifica cuando una quiniela termina con el ranking final.",
  },
];

export function AdminEmailSettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PlatformEmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    updatedAt: string;
    updatedBy: { displayName: string; email: string } | null;
  } | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchSettings = useCallback(async () => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getAdminEmailSettings(token);
      setSettings(data.settings);
      setMetadata(data.metadata);
    } catch (err: any) {
      if (err.status === 401) {
        // Token inválido o expirado - el api.ts ya hizo logout
        navigate("/login");
        return;
      } else if (err.status === 403) {
        setAccessDenied(true);
      } else {
        setError(err.message || "Error al cargar configuración");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = async (key: keyof PlatformEmailSettings) => {
    if (!settings) return;

    const token = getToken();
    if (!token) return;

    const newValue = !settings[key];

    // Optimistic update
    setSettings((prev) => (prev ? { ...prev, [key]: newValue } : prev));
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateAdminEmailSettings(token, { [key]: newValue });
      setSettings(result.settings);
      setSuccess("Configuración guardada correctamente");
      setTimeout(() => setSuccess(null), 3000);

      // Refetch para actualizar metadata
      const data = await getAdminEmailSettings(token);
      setMetadata(data.metadata);
    } catch (err: any) {
      // Revert on error
      setSettings((prev) => (prev ? { ...prev, [key]: !newValue } : prev));
      setError(err.message || "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    maxWidth: 800,
    margin: "0 auto",
    padding: "32px 16px",
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: 32,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    color: "#1f2937",
    marginBottom: 8,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#6b7280",
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    padding: 24,
    marginBottom: 24,
  };

  const toggleRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "16px 0",
    borderBottom: "1px solid #e5e7eb",
  };

  const toggleInfoStyle: React.CSSProperties = {
    flex: 1,
    marginRight: 16,
  };

  const toggleLabelStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    color: "#1f2937",
    marginBottom: 4,
  };

  const toggleDescStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 1.5,
  };

  const switchContainerStyle: React.CSSProperties = {
    position: "relative",
    width: 48,
    height: 28,
    flexShrink: 0,
  };

  const alertStyle = (type: "error" | "success"): React.CSSProperties => ({
    padding: "12px 16px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
    backgroundColor: type === "error" ? "#fef2f2" : "#ecfdf5",
    color: type === "error" ? "#dc2626" : "#059669",
    border: `1px solid ${type === "error" ? "#fecaca" : "#a7f3d0"}`,
  });

  const metadataStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid #e5e7eb",
  };

  const backButtonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#6b7280",
    fontSize: 14,
    textDecoration: "none",
    marginBottom: 16,
    cursor: "pointer",
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: "center", padding: 48, color: "#6b7280" }}>
          Cargando configuración...
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            textAlign: "center",
            padding: 48,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>
            Acceso Restringido
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
            Esta página es exclusiva para administradores de la plataforma.
            Solo el equipo de administración puede gestionar la configuración de emails.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              background: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
        <div style={backButtonStyle} onClick={() => navigate("/dashboard")}>
          <span>&larr;</span>
          <span>Volver al Dashboard</span>
        </div>

        <div style={headerStyle}>
          <h1 style={titleStyle}>Configuración de Emails</h1>
          <p style={subtitleStyle}>
            Activa o desactiva los tipos de email que se envían a los usuarios.
            Los cambios aplican inmediatamente a toda la plataforma.
          </p>
        </div>

        {error && <div style={alertStyle("error")}>{error}</div>}
        {success && <div style={alertStyle("success")}>{success}</div>}

        {settings && (
          <div style={cardStyle}>
            <div style={{ marginBottom: 8, fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
              NOTIFICACIONES POR EMAIL
            </div>

            {EMAIL_TOGGLES.map((toggle, index) => (
              <div
                key={toggle.key}
                style={{
                  ...toggleRowStyle,
                  borderBottom: index === EMAIL_TOGGLES.length - 1 ? "none" : toggleRowStyle.borderBottom,
                }}
              >
                <div style={toggleInfoStyle}>
                  <div style={toggleLabelStyle}>{toggle.label}</div>
                  <div style={toggleDescStyle}>{toggle.description}</div>
                </div>

                <div style={switchContainerStyle}>
                  <label
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settings[toggle.key]}
                      onChange={() => handleToggle(toggle.key)}
                      disabled={saving}
                      style={{ display: "none" }}
                    />
                    <div
                      style={{
                        width: 48,
                        height: 28,
                        backgroundColor: settings[toggle.key] ? "#4f46e5" : "#d1d5db",
                        borderRadius: 14,
                        position: "relative",
                        transition: "background-color 0.2s",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 2,
                          left: settings[toggle.key] ? 22 : 2,
                          width: 24,
                          height: 24,
                          backgroundColor: "#fff",
                          borderRadius: "50%",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          transition: "left 0.2s",
                        }}
                      />
                    </div>
                  </label>
                </div>
              </div>
            ))}

            {metadata && (
              <div style={metadataStyle}>
                Última actualización: {new Date(metadata.updatedAt).toLocaleString("es")}
                {metadata.updatedBy && (
                  <span> por {metadata.updatedBy.displayName}</span>
                )}
              </div>
            )}
          </div>
        )}

        <div style={cardStyle}>
          <div style={{ marginBottom: 8, fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
            INFORMACIÓN
          </div>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
            <strong>Password Reset</strong> siempre está activo por seguridad y no se puede desactivar.
            <br /><br />
            Los usuarios pueden desactivar notificaciones individuales desde su perfil,
            pero solo si el tipo de email está habilitado aquí a nivel de plataforma.
            <br /><br />
            Para ver estadísticas de envío, consulta el{" "}
            <a
              href="https://resend.com/emails"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#4f46e5" }}
            >
              dashboard de Resend
            </a>.
          </p>
        </div>
      </div>
  );
}
