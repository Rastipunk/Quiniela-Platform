"use client";

import { colors } from "@/lib/theme";

import { useState, useEffect, useCallback, useRef } from "react";
import { getToken } from "@/lib/auth";
import {
  getUserEmailPreferences,
  updateUserEmailPreferences,
} from "@/lib/api";
import { useTranslations } from "next-intl";
import { usePoolTerm } from "@/contexts/PoolTermContext";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";

// Tipo definido localmente para evitar issues de Vite con type exports
type UserEmailPreferences = {
  emailNotificationsEnabled: boolean;
  emailPoolInvitations: boolean;
  emailDeadlineReminders: boolean;
  emailResultNotifications: boolean;
  emailPoolCompletions: boolean;
  emailNewMemberDigest: boolean;
};

type PlatformEnabled = {
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

export function EmailPreferencesSection() {
  const t = useTranslations("profile");
  const { params: poolParams } = usePoolTerm();

  const preferenceItems: PreferenceItem[] = [
    {
      key: "emailNotificationsEnabled",
      label: t("emailPrefs.masterLabel"),
      description: t("emailPrefs.masterDesc"),
      isMaster: true,
    },
    {
      key: "emailPoolInvitations",
      label: t("emailPrefs.invitationsLabel", poolParams),
      description: t("emailPrefs.invitationsDesc", poolParams),
    },
    {
      key: "emailDeadlineReminders",
      platformKey: "emailDeadlineReminders",
      label: t("emailPrefs.deadlineLabel"),
      description: t("emailPrefs.deadlineDesc"),
    },
    {
      key: "emailResultNotifications",
      platformKey: "emailResultNotifications",
      label: t("emailPrefs.resultsLabel"),
      description: t("emailPrefs.resultsDesc"),
    },
    {
      key: "emailPoolCompletions",
      platformKey: "emailPoolCompletions",
      label: t("emailPrefs.completionsLabel", poolParams),
      description: t("emailPrefs.completionsDesc", poolParams),
    },
    {
      key: "emailNewMemberDigest",
      label: t("emailPrefs.newMemberDigestLabel"),
      description: t("emailPrefs.newMemberDigestDesc"),
    },
  ];

  const [preferences, setPreferences] = useState<UserEmailPreferences | null>(null);
  const [platformEnabled, setPlatformEnabled] = useState<PlatformEnabled | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

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
      setError(err.message || t("emailPrefs.loadError"));
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
      setSuccess(t("emailPrefs.saved"));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      // Revert on error
      setPreferences((prev) => (prev ? { ...prev, [key]: !newValue } : prev));
      setError(err.message || t("emailPrefs.saveError"));
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
    color: colors.text,
    marginBottom: 8,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 14,
    color: colors.textLighter,
    marginBottom: 24,
  };

  const itemContainerStyle: React.CSSProperties = {
    background: colors.bgLighter,
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
    color: colors.text,
    marginBottom: 2,
  };

  const itemDescStyle: React.CSSProperties = {
    fontSize: 12,
    color: colors.textLighter,
  };

  const alertStyle = (type: "error" | "success"): React.CSSProperties => ({
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
    backgroundColor: type === "error" ? colors.errorBg : "#ecfdf5",
    color: type === "error" ? colors.error : colors.successAlt,
  });

  if (loading) {
    return (
      <div style={sectionStyle}>
        <h2 style={headingStyle}>{t("emailPrefs.title")}</h2>
        <p style={{ color: colors.textLighter, fontSize: 14 }}>{t("emailPrefs.loading")}</p>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div style={sectionStyle}>
        <h2 style={headingStyle}>{t("emailPrefs.title")}</h2>
        <p style={{ color: colors.error, fontSize: 14 }}>{t("emailPrefs.loadError")}</p>
      </div>
    );
  }

  const masterEnabled = preferences.emailNotificationsEnabled;

  // Filtrar items: no mostrar los que están deshabilitados a nivel de plataforma
  const visibleItems = preferenceItems.filter((item) => {
    // El master toggle siempre es visible
    if (item.isMaster) return true;
    // Si no hay platformEnabled, mostrar todo (compatibilidad)
    if (!platformEnabled) return true;
    // Mostrar solo si está habilitado a nivel de plataforma
    return item.platformKey ? platformEnabled[item.platformKey] : true;
  });

  // Verificar si hay algún email deshabilitado por admin
  const hasDisabledByAdmin = platformEnabled && preferenceItems.some(
    (item) => item.platformKey && !platformEnabled[item.platformKey]
  );

  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>{t("emailPrefs.title")}</h2>
      <p style={descStyle}>
        {t("emailPrefs.description")}
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

              <ToggleSwitch
                checked={isChecked}
                onChange={() => handleToggle(item.key)}
                disabled={isDisabledByMaster || saving}
              />
            </div>
          </div>
        );
      })}

      {hasDisabledByAdmin && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: colors.bgLight,
            borderRadius: 8,
            fontSize: 12,
            color: colors.textLighter,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>&#x2139;&#xFE0F;</span>
          <span>
            {t("emailPrefs.adminDisabled")}
          </span>
        </div>
      )}
    </div>
  );
}
