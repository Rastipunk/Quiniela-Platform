"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { colors } from "@/lib/theme";
import {
  getSessions,
  revokeSession,
  revokeOtherSessions,
  type ActiveSession,
} from "@/lib/api";

/** Best-effort friendly device label from a User-Agent (browser · OS). */
function parseDevice(ua: string | null, fallback: string): string {
  if (!ua) return fallback;
  let os = "";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  let browser = "";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(" · ") : fallback;
}

export function SessionsPanel() {
  const t = useTranslations("profile");
  const locale = useLocale();

  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSessions();
      setSessions(data.sessions);
    } catch (err: any) {
      setError(err?.message || t("sessions.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const fmt = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  async function onRevoke(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await revokeSession(id);
      await fetchSessions();
    } catch (err: any) {
      setError(err?.message || t("sessions.revokeError"));
    } finally {
      setBusyId(null);
    }
  }

  async function onRevokeOthers() {
    setBusyId("__others__");
    setError(null);
    try {
      await revokeOtherSessions();
      await fetchSessions();
    } catch (err: any) {
      setError(err?.message || t("sessions.revokeError"));
    } finally {
      setBusyId(null);
    }
  }

  const sectionStyle: React.CSSProperties = { marginTop: 32, paddingTop: 32, borderTop: "1px solid #e5e7eb" };
  const headingStyle: React.CSSProperties = { fontSize: 18, fontWeight: 600, color: colors.text, marginBottom: 8 };
  const descStyle: React.CSSProperties = { fontSize: 14, color: colors.textLighter, marginBottom: 24 };
  const revokeBtnStyle = (busy: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${colors.error}`,
    background: colors.white,
    color: colors.error,
    fontWeight: 600,
    fontSize: 13,
    cursor: busy ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    opacity: busy ? 0.6 : 1,
  });

  if (loading) return null;

  const list = sessions ?? [];
  // Self-gates the panel during the email-scoped rollout (ADR-081): users
  // outside PERSISTENT_SESSIONS_ALLOWLIST get legacy tokens → no Session rows →
  // nothing to show, so render nothing. Once rolled out to all, everyone has a
  // session and the panel appears.
  if (list.length === 0 && !error) return null;
  const others = list.filter((s) => !s.current);

  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>{t("sessions.title")}</h2>
      <p style={descStyle}>{t("sessions.description")}</p>

      {error && (
        <div style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 16, fontSize: 13, backgroundColor: colors.errorBg, color: colors.error }}>
          {error}
        </div>
      )}

      {list.map((s) => (
        <div
          key={s.id}
          style={{
            background: s.current ? "#eef2ff" : colors.bgLighter,
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: colors.text, marginBottom: 2 }}>
              {parseDevice(s.userAgent, t("sessions.unknownDevice"))}
              {s.current && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#4f46e5" }}>
                  · {t("sessions.current")}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: colors.textLighter }}>
              {t("sessions.lastUsed")}: {fmt(s.lastUsedAtUtc)}
            </div>
          </div>

          {!s.current && (
            <button onClick={() => onRevoke(s.id)} disabled={busyId === s.id} style={revokeBtnStyle(busyId === s.id)}>
              {t("sessions.revoke")}
            </button>
          )}
        </div>
      ))}

      {others.length > 0 ? (
        <button
          onClick={onRevokeOthers}
          disabled={busyId === "__others__"}
          style={{ ...revokeBtnStyle(busyId === "__others__"), marginTop: 8 }}
        >
          {t("sessions.revokeOthers")}
        </button>
      ) : (
        list.length > 0 && (
          <p style={{ fontSize: 13, color: colors.textLighter }}>{t("sessions.onlyThisDevice")}</p>
        )
      )}
    </div>
  );
}
