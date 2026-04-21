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
/**
 * Custom DOM event that the Footer (and any other surface) can dispatch
 * to re-open the consent banner after the user has already made a
 * choice. GDPR requires the preference to be revocable with the same
 * ease it was granted; exposing a hidden `localStorage` edit is not
 * sufficient. Listening inside `CookieConsent` keeps the side-effect
 * contained — no prop drilling, no context.
 */
const CONSENT_REOPEN_EVENT = "p4a:consent:reopen";

export function openCookieConsent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT));
}

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
    function onReopen(): void {
      // Imperative reopen from the Footer. Clear the persisted choice so
      // the next applyConsent() call represents a fresh decision, and
      // show the banner regardless of previous state or DNT.
      try {
        localStorage.removeItem(CONSENT_KEY);
      } catch {
        // best-effort
      }
      setVisible(true);
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(CONSENT_REOPEN_EVENT, onReopen);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CONSENT_REOPEN_EVENT, onReopen);
    };
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

  // Design choices that drive consent rate without crossing into
  // dark-pattern territory:
  //   - Card-style popover anchored bottom-left (feels like a helpful
  //     notice rather than a wall blocking the page).
  //   - Short, benefit-oriented headline ("Mejora tu experiencia")
  //     above the legal message so the user understands WHY before
  //     they read the boilerplate.
  //   - Accept CTA uses brand gradient + shadow — primary visual weight.
  //     Reject is a text-only link in muted grey — present, legible, one
  //     click away, but not the eye-catcher. GDPR requires both options
  //     to be equally easy to action; it does NOT require them to have
  //     equal visual weight.
  //   - No emoji, no manipulative copy. Privacy link is prominent.
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("headline")}
      style={{
        position: "fixed",
        bottom: isMobile ? 0 : spacing.lg,
        left: isMobile ? 0 : spacing.lg,
        right: isMobile ? 0 : "auto",
        maxWidth: isMobile ? "100%" : 420,
        zIndex: zIndex.toast,
        padding: isMobile ? `${spacing.lg}px ${spacing.lg}px ${spacing.lg}px` : `${spacing.lg}px`,
        background: colors.white,
        border: `1px solid ${colors.borderLight}`,
        borderTop: isMobile ? `1px solid ${colors.borderLight}` : `1px solid ${colors.borderLight}`,
        borderRadius: isMobile ? `${radii.lg}px ${radii.lg}px 0 0` : radii.lg,
        boxShadow: "0 12px 32px rgba(17, 24, 39, 0.12), 0 4px 12px rgba(17, 24, 39, 0.06)",
      }}
    >
      <div style={{
        fontSize: fontSize.base,
        fontWeight: fontWeight.bold,
        color: colors.text,
        marginBottom: spacing.xs,
        lineHeight: 1.3,
      }}>
        {t("headline")}
      </div>
      <div style={{
        fontSize: fontSize.sm,
        color: colors.textMuted,
        lineHeight: 1.5,
        marginBottom: spacing.md,
      }}>
        {t("message")}{" "}
        <Link
          href="/privacidad"
          style={{ color: colors.brand, textDecoration: "underline", fontWeight: fontWeight.medium }}
        >
          {t("learnMore")}
        </Link>
      </div>

      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        gap: spacing.sm,
      }}>
        <button
          onClick={handleAccept}
          style={{
            flex: isMobile ? undefined : 1,
            padding: `${spacing.md}px ${spacing.lg}px`,
            borderRadius: radii.lg,
            border: "none",
            background: colors.brandGradient,
            color: colors.white,
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            cursor: "pointer",
            boxShadow: shadows.md,
            minHeight: 44,
          }}
        >
          {t("accept")}
        </button>
        <button
          onClick={handleReject}
          style={{
            padding: `${spacing.sm}px ${spacing.md}px`,
            borderRadius: radii.lg,
            border: "none",
            background: "transparent",
            color: colors.textMuted,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            cursor: "pointer",
            textDecoration: "underline",
            minHeight: 44,
          }}
        >
          {t("reject")}
        </button>
      </div>
    </div>
  );
}
