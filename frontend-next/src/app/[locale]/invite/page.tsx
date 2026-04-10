"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getToken } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { BRAND } from "@/lib/brand";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface InvitePreview {
  poolName: string;
  tournamentName: string | null;
  hostName: string | null;
  memberCount: number;
  status: string;
  valid: boolean;
}

function InviteContent() {
  const searchParams = useSearchParams();
  const t = useTranslations("pool");
  const code = searchParams.get("code");

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isLoggedIn = typeof window !== "undefined" && !!getToken();
  const joinUrl = `/pools/join?code=${code}`;
  const loginUrl = `/login?redirect=${encodeURIComponent(joinUrl)}`;

  useEffect(() => {
    if (!code) {
      setLoading(false);
      setError(true);
      return;
    }

    fetch(`${API_URL}/invite-preview/${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.poolName) {
          setPreview(data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--muted)", fontSize: "1rem" }}>...</div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 20, padding: "48px 32px", maxWidth: 440, width: "100%", textAlign: "center",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>😕</div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>
            {t("inviteLanding.invalidTitle")}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: 24, lineHeight: 1.6 }}>
            {t("inviteLanding.invalidDesc")}
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block", background: "var(--primary)", color: "white",
              padding: "12px 24px", borderRadius: 12, fontWeight: 700, textDecoration: "none",
            }}
          >
            {t("inviteLanding.goHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 20, padding: "48px 32px", maxWidth: 480, width: "100%", textAlign: "center",
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
      }}>
        {/* Brand */}
        <div style={{
          fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1,
          color: BRAND.primary, textTransform: "uppercase", marginBottom: 20,
        }}>
          {BRAND.name}
        </div>

        {/* Invite message */}
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: 12, lineHeight: 1.3, color: "var(--text)" }}>
          {t("inviteLanding.title", { host: preview.hostName || t("inviteLanding.someone") })}
        </h1>

        {/* Pool card */}
        <div style={{
          background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14,
          padding: "20px 24px", marginBottom: 24, textAlign: "left",
        }}>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)", marginBottom: 6 }}>
            {preview.poolName}
          </div>
          {preview.tournamentName && (
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 8 }}>
              {preview.tournamentName}
            </div>
          )}
          <div style={{
            display: "flex", gap: 16, fontSize: "0.82rem", color: "var(--muted)",
          }}>
            <span>👥 {t("inviteLanding.members", { count: preview.memberCount })}</span>
            {preview.valid && (
              <span style={{ color: colors.successAlt }}>✓ {t("inviteLanding.active")}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {preview.valid ? (
          isLoggedIn ? (
            <a
              href={joinUrl}
              style={{
                display: "block", background: colors.brandGradient, color: "white",
                padding: "14px 28px", borderRadius: 14, fontWeight: 700, fontSize: "1rem",
                textDecoration: "none", marginBottom: 12,
              }}
            >
              {t("inviteLanding.joinNow")}
            </a>
          ) : (
            <>
              <a
                href={loginUrl}
                style={{
                  display: "block", background: colors.brandGradient, color: "white",
                  padding: "14px 28px", borderRadius: 14, fontWeight: 700, fontSize: "1rem",
                  textDecoration: "none", marginBottom: 12,
                }}
              >
                {t("inviteLanding.createAccountToJoin")}
              </a>
              <a
                href={loginUrl}
                style={{
                  display: "block", color: "var(--text)", fontSize: "0.9rem",
                  fontWeight: 600, textDecoration: "none",
                }}
              >
                {t("inviteLanding.alreadyHaveAccount")}
              </a>
            </>
          )
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            {t("inviteLanding.expired")}
          </p>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--muted)" }}>...</div>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
