"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { colors, radii, fontSize, fontWeight, shadows, spacing, zIndex } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getToken } from "@/lib/auth";
import { initMetaPixel, trackMetaEvent, revokeMetaPixelConsent } from "@/lib/metaPixel";
import { updateConsent, type ConsentValue } from "@/lib/analytics";

const CONSENT_KEY = "p4a_cookie_consent";
type ConsentState = ConsentValue | null;

function getStoredConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "granted" || v === "denied") return v;
  } catch {
    // localStorage may throw in private mode / with storage disabled.
  }
  return null;
}

function persistConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Best-effort: analytics still work in-session even without persistence.
  }
}

/**
 * Apply a consent decision end-to-end: update Google Consent Mode v2 so
 * GA4/GTM tags unlock, and kick off the Meta Pixel (which only loads after
 * consent to keep us compliant).
 */
function applyConsent(consent: ConsentValue): void {
  updateConsent(consent);
  if (consent === "granted") {
    initMetaPixel();
    trackMetaEvent("PageView");
  } else {
    // Explicit revoke: Meta Pixel does not honour Google Consent Mode v2,
    // so a generic analytics-denied update is not enough — we must tell fbq
    // directly to stop collecting.
    revokeMetaPixelConsent();
  }
}

/**
 * Auto-accept analytics consent for authenticated users. The ToS they agreed
 * to at registration discloses analytics usage (Privacy Policy §11), so an
 * authenticated session is an implicit grant on any device they sign into.
 */
export function acceptAnalyticsConsent(): void {
  if (typeof window === "undefined") return;
  persistConsent("granted");
  applyConsent("granted");
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

  // Cross-tab sync: when another tab updates the consent preference, mirror
  // it in this tab so both GA4 and Meta see a consistent state. We only
  // apply changes we did not originate — `localStorage` does not fire
  // `storage` events in the tab that made the change.
  useEffect(() => {
    function onStorage(event: StorageEvent): void {
      if (event.key !== CONSENT_KEY) return;
      const next = event.newValue;
      if (next === "granted" || next === "denied") {
        applyConsent(next);
        // Hide the banner in this tab if it was showing.
        setVisible(false);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const stored = getStoredConsent();

    if (stored) {
      // Already made a choice — re-apply it so Consent Mode transitions from
      // the default 'denied' state without waiting for user action.
      applyConsent(stored);
      return;
    }

    // Authenticated users auto-accept analytics (see acceptAnalyticsConsent).
    const token = getToken();
    if (token) {
      persistConsent("granted");
      applyConsent("granted");
      return;
    }

    // Respect Do Not Track for anonymous visitors.
    const dnt = navigator.doNotTrack === "1";
    if (dnt) {
      persistConsent("denied");
      // Default is already denied; no need to re-push, but do it for clarity
      // (it is a no-op on GTM's side when the value matches the current one).
      applyConsent("denied");
      return;
    }

    // Anonymous visitor, no stored preference, no DNT → show banner.
    // Default remains 'denied' from the inline script in <head>.
    setVisible(true);
  }, []);

  function handleAccept() {
    persistConsent("granted");
    applyConsent("granted");
    setVisible(false);
  }

  function handleReject() {
    persistConsent("denied");
    applyConsent("denied");
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
