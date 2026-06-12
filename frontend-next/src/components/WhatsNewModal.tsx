"use client";

// One-time "what's new" announcement modal (versioned).
//
// Shows once per device after a deploy that bumps WHATS_NEW_VERSION —
// the seen-version is stored in localStorage, so it never reappears
// until the next announcement. Supports a staged rollout: while
// TEST_EMAILS is non-null only those accounts see it (the owner
// approves the copy/visuals in production before everyone else does).

import { colors } from "@/lib/theme";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getUserProfile } from "@/lib/api/user";
import { getToken } from "@/lib/auth";

const WHATS_NEW_VERSION = "2026-06-12";
const STORAGE_KEY = "quiniela.whatsNewVersion";

/** Staged rollout: when non-null, ONLY these accounts see the modal.
 *  Set to null to release the announcement to every user.
 *  2026-06-12 announcement: owner approved → released to everyone. */
const TEST_EMAILS: string[] | null = null;

export function WhatsNewModal() {
  const t = useTranslations("whatsNew");
  const isMobile = useIsMobile();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const token = getToken();
    const seenVersion = localStorage.getItem(STORAGE_KEY);
    if (!token || seenVersion === WHATS_NEW_VERSION) return;

    if (!TEST_EMAILS) {
      setShow(true);
      return;
    }
    // Staged rollout — one cheap profile fetch, never blocks the app.
    let cancelled = false;
    void getUserProfile(token)
      .then((r) => {
        if (!cancelled && TEST_EMAILS.includes(r.user.email.toLowerCase())) {
          setShow(true);
        }
      })
      .catch(() => { /* transient API issue — skip silently */ });
    return () => { cancelled = true; };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.white,
          borderRadius: 18,
          width: "100%",
          maxWidth: 460,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
      >
        {/* Brand gradient header */}
        <div
          style={{
            background: colors.brandGradient,
            padding: isMobile ? "22px 20px 18px" : "26px 28px 22px",
            textAlign: "center",
            color: colors.white,
          }}
        >
          <div style={{ fontSize: "2.2rem", lineHeight: 1, marginBottom: 8 }}>✨</div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>
            {t("title")}
          </h2>
          <p style={{ fontSize: "0.9rem", margin: "6px 0 0", opacity: 0.9 }}>
            {t("subtitle")}
          </p>
        </div>

        <div style={{ padding: isMobile ? 20 : 26 }}>
          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
            {/* Item 1: sort by date or group */}
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: "1.6rem", flexShrink: 0 }}>🕐</div>
              <div>
                <div style={{ fontWeight: 700, color: "#111827", marginBottom: 3 }}>
                  {t("item1Title")}
                </div>
                <div style={{ fontSize: "0.86rem", color: "#4b5563", lineHeight: 1.5 }}>
                  {t("item1Desc")}
                </div>
              </div>
            </div>

            {/* Item 2: shareable PDFs */}
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                background: "#faf5ff",
                border: "1px solid #ddd6fe",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: "1.6rem", flexShrink: 0 }}>📄</div>
              <div>
                <div style={{ fontWeight: 700, color: "#111827", marginBottom: 3 }}>
                  {t("item2Title")}
                </div>
                <div style={{ fontSize: "0.86rem", color: "#4b5563", lineHeight: 1.5 }}>
                  {t("item2Desc")}
                </div>
              </div>
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            style={{
              width: "100%",
              minHeight: 48,
              background: colors.brandGradient,
              color: colors.white,
              border: "none",
              borderRadius: 12,
              padding: "13px 24px",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(79,70,229,0.35)",
            }}
          >
            {t("dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
