"use client";

import { useState, useEffect, useCallback } from "react";
import { getToken } from "../lib/auth";
import {
  getUserEmailPreferences,
  updateUserEmailPreferences,
} from "../lib/api";

// Tipo definido localmente para evitar issues de Vite con type exports
type UserEmailPreferences = {
  emailNotificationsEnabled: boolean;
  emailPoolInvitations: boolean;
  emailDeadlineReminders: boolean;
  emailResultNotifications: boolean;
  emailPoolCompletions: boolean;
};

type PlatformEnabled = {
  emailPoolInvitations: boolean;
  emailDeadlineReminders: boolean;
  emailResultNotifications: boolean;
  emailPoolCompletions: boolean;
};

type PreferenceItem = {
  key: keyof UserEmailPreferences;
  platformKey?: keyof PlatformEnabled;
  label: string;
  description: string;
  isMaster?: boolean;
};

const PREFERENCE_ITEMS: PreferenceItem[] = [
  {
    key: "emailNotificationsEnabled",
    label: "Recibir notificaciones por email",
    description: "Activa o desactiva todas las notificaciones (excepto recuperación de contraseña)",
    isMaster: true,
  },
  {
    key: "emailPoolInvitations",
    platformKey: "emailPoolInvitations",
    label: "Invitaciones a quinielas",
    description: "Recibe notificaciones cuando alguien te invita a una quiniela",
  },
  {
    key: "emailDeadlineReminders",
    platformKey: "emailDeadlineReminders",
    label: "Recordatorios de deadline",
    description: "Recibe recordatorios cuando tengas pronósticos pendientes",
  },
  {
    key: "emailResultNotifications",
    platformKey: "emailResultNotifications",
    label: "Resultados publicados",
    description: "Recibe notificaciones cuando se publican resultados de partidos",
  },
  {
    key: "emailPoolCompletions",
    platformKey: "emailPoolCompletions",
    label: "Quinielas completadas",
    description: "Recibe notificaciones cuando termina una quiniela",
  },
];

export function EmailPreferencesSection() {
  const [preferences, setPreferences] = useState<UserEmailPreferences | null>(null);
  const [platformEnabled, setPlatformEnabled] = useState<PlatformEnabled | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getUserEmailPreferences(token);
      setPreferences(data.preferences);
      // El backend ahora incluye platformEnabled
      if (data.platformEnabled) {
        setPlatformEnabled(data.platformEnabled);
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar preferencias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const handleToggle = async (key: keyof UserEmailPreferences) => {
    if (!preferences) return;

    const token = getToken();
    if (!token) return;

    const newValue = !preferences[key];

    // Optimistic update
    setPreferences((prev) => (prev ? { ...prev, [key]: newValue } : prev));
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateUserEmailPreferences(token, { [key]: newValue });
      setPreferences(result.preferences);
      setSuccess("Preferencias guardadas");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      // Revert on error
      setPreferences((prev) => (prev ? { ...prev, [key]: !newValue } : prev));
      setError(err.message || "Error al guardar preferencias");
    } finally {
      setSaving(false);
    }
  };

  // Styles
  const sectionStyle: React.CSSProperties = {
    marginTop: 32,
    paddingTop: 32,
    borderTop: "1px solid #e5e7eb",
  };

  const headingStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    color: "#1f2937",
    marginBottom: 8,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 24,
  };

  const itemContainerStyle: React.CSSProperties = {
    background: "#f9fafb",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  };

  const itemRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  };

  const itemInfoStyle: React.CSSProperties = {
    flex: 1,
  };

  const itemLabelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    color: "#1f2937",
    marginBottom: 2,
  };

  const itemDescStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#6b7280",
  };

  const alertStyle = (type: "error" | "success"): React.CSSProperties => ({
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
    backgroundColor: type === "error" ? "#fef2f2" : "#ecfdf5",
    color: type === "error" ? "#dc2626" : "#059669",
  });

  if (loading) {
    return (
      <div style={sectionStyle}>
        <h2 style={headingStyle}>Notificaciones por Email</h2>
        <p style={{ color: "#6b7280", fontSize: 14 }}>Cargando preferencias...</p>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div style={sectionStyle}>
        <h2 style={headingStyle}>Notificaciones por Email</h2>
        <p style={{ color: "#dc2626", fontSize: 14 }}>Error al cargar preferencias</p>
      </div>
    );
  }

  const masterEnabled = preferences.emailNotificationsEnabled;

  // Filtrar items: no mostrar los que están deshabilitados a nivel de plataforma
  const visibleItems = PREFERENCE_ITEMS.filter((item) => {
    // El master toggle siempre es visible
    if (item.isMaster) return true;
    // Si no hay platformEnabled, mostrar todo (compatibilidad)
    if (!platformEnabled) return true;
    // Mostrar solo si está habilitado a nivel de plataforma
    return item.platformKey ? platformEnabled[item.platformKey] : true;
  });

  // Verificar si hay algún email deshabilitado por admin
  const hasDisabledByAdmin = platformEnabled && PREFERENCE_ITEMS.some(
    (item) => item.platformKey && !platformEnabled[item.platformKey]
  );

  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>Notificaciones por Email</h2>
      <p style={descStyle}>
        Configura qué notificaciones deseas recibir por email.
        La recuperación de contraseña siempre está activa.
      </p>

      {error && <div style={alertStyle("error")}>{error}</div>}
      {success && <div style={alertStyle("success")}>{success}</div>}

      {visibleItems.map((item) => {
        const isDisabledByMaster = !item.isMaster && !masterEnabled;
        const isChecked = preferences[item.key];

        return (
          <div
            key={item.key}
            style={{
              ...itemContainerStyle,
              opacity: isDisabledByMaster ? 0.5 : 1,
              background: item.isMaster ? "#eef2ff" : itemContainerStyle.background,
            }}
          >
            <div style={itemRowStyle}>
              <div style={itemInfoStyle}>
                <div style={itemLabelStyle}>{item.label}</div>
                <div style={itemDescStyle}>{item.description}</div>
              </div>

              <label
                style={{
                  display: "block",
                  width: 48,
                  height: 26,
                  flexShrink: 0,
                  cursor: isDisabledByMaster || saving ? "not-allowed" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(item.key)}
                  disabled={isDisabledByMaster || saving}
                  style={{ display: "none" }}
                />
                <div
                  style={{
                    width: 48,
                    height: 26,
                    backgroundColor: isChecked ? "#4f46e5" : "#cbd5e1",
                    borderRadius: 13,
                    position: "relative",
                    transition: "background-color 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      left: isChecked ? 25 : 3,
                      width: 20,
                      height: 20,
                      backgroundColor: "#fff",
                      borderRadius: "50%",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      transition: "left 0.2s ease",
                    }}
                  />
                </div>
              </label>
            </div>
          </div>
        );
      })}

      {hasDisabledByAdmin && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "#f3f4f6",
            borderRadius: 8,
            fontSize: 12,
            color: "#6b7280",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>ℹ️</span>
          <span>
            Algunas notificaciones han sido desactivadas por el administrador de la plataforma
            y no están disponibles actualmente.
          </span>
        </div>
      )}
    </div>
  );
}
