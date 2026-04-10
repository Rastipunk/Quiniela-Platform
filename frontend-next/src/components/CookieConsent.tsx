"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { colors, radii, fontSize, fontWeight, shadows, spacing, zIndex } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";

const CONSENT_KEY = "p4a_cookie_consent";
type ConsentState = "granted" | "denied" | null;

function getStoredConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === "granted" || v === "denied") return v;
  return null;
}

/**
 * Push Google Consent Mode v2 defaults and updates to dataLayer.
 * GTM reads these to control which tags fire.
 *
 * @see https://developers.google.com/tag-platform/security/guides/consent
 */
function updateGtmConsent(consent: "granted" | "denied") {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "consent_update",
    analytics_storage: consent,
    ad_storage: consent,
    ad_user_data: consent,
    ad_personalization: consent,
  });
}

/**
 * Cookie consent banner — bottom of screen, minimal and professional.
 *
 * - Shows once per device until user accepts or rejects
 * - Stores preference in localStorage
 * - Pushes Google Consent Mode v2 signals to dataLayer
 * - Respects Do Not Track browser setting
 * - i18n: ES/EN/PT
 */
export function CookieConsent() {
  const t = useTranslations("cookieConsent");
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Respect Do Not Track
    const dnt = navigator.doNotTrack === "1";
    const stored = getStoredConsent();

    if (stored) {
      // Already made a choice — apply it silently
      updateGtmConsent(stored);
      return;
    }

    if (dnt) {
      // DNT enabled and no stored choice — deny by default, don't show banner
      localStorage.setItem(CONSENT_KEY, "denied");
      updateGtmConsent("denied");
      return;
    }

    // No stored preference, no DNT → show banner
    // Set default to denied until user accepts (Consent Mode v2 best practice)
    updateGtmConsent("denied");
    setVisible(true);
  }, []);

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, "granted");
    updateGtmConsent("granted");
    setVisible(false);
  }

  function handleReject() {
    localStorage.setItem(CONSENT_KEY, "denied");
    updateGtmConsent("denied");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: zIndex.toast,
        padding: isMobile ? `${spacing.md}px ${spacing.lg}px` : `${spacing.lg}px ${spacing["3xl"]}px`,
        background: colors.white,
        borderTop: `1px solid ${colors.borderLight}`,
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        gap: isMobile ? spacing.md : spacing.xl,
      }}
    >
      {/* Text */}
      <div style={{ flex: 1, fontSize: isMobile ? fontSize.sm : fontSize.base, color: colors.textMuted, lineHeight: 1.5 }}>
        {t("message")}{" "}
        <Link
          href="/privacidad"
          style={{ color: colors.brand, textDecoration: "underline", fontWeight: fontWeight.medium }}
        >
          {t("learnMore")}
        </Link>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: spacing.sm, flexShrink: 0 }}>
        <button
          onClick={handleReject}
          style={{
            padding: `${spacing.sm}px ${spacing.lg}px`,
            borderRadius: radii.lg,
            border: `1px solid ${colors.borderMedium}`,
            background: colors.white,
            color: colors.textMuted,
            fontSize: fontSize.md,
            fontWeight: fontWeight.medium,
            cursor: "pointer",
          }}
        >
          {t("reject")}
        </button>
        <button
          onClick={handleAccept}
          style={{
            padding: `${spacing.sm}px ${spacing.lg}px`,
            borderRadius: radii.lg,
            border: "none",
            background: colors.brand,
            color: colors.white,
            fontSize: fontSize.md,
            fontWeight: fontWeight.semibold,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          {t("accept")}
        </button>
      </div>
    </div>
  );
}
