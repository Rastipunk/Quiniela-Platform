"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getToken } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { colors } from "@/lib/theme";
import { BRAND } from "@/lib/brand";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * CTA button to subscribe/unsubscribe from AI prediction updates.
 * If user is not logged in, clicking opens the auth panel (via redirect to login).
 * If logged in, toggles the subscription in one click.
 */
export function PredictionSubscribeButton() {
  const t = useTranslations("worldCup");
  const locale = useLocale();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [justSubscribed, setJustSubscribed] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setIsLoggedIn(true);

    // Check current subscription status
    fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.predictionUpdates !== undefined) {
          setIsSubscribed(data.predictionUpdates);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    const token = getToken();
    if (!token) {
      // Redirect to login preserving the current locale prefix so the
      // user stays in their chosen language. Pre-fix this used a bare
      // "/login?..." which sent EN/PT users to the Spanish login page.
      const localePrefix = locale === "es" ? "" : `/${locale}`;
      const returnPath = encodeURIComponent(window.location.pathname);
      window.location.href = `${localePrefix}/login?redirect=${returnPath}`;
      return;
    }

    setToggling(true);
    try {
      const res = await fetch(`${API_URL}/me/prediction-subscription`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ enabled: !isSubscribed }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsSubscribed(data.enabled);
        trackEvent("notification_subscription_toggled", {
          type: "prediction_updates",
          enabled: data.enabled,
        });
        // Only fire Lead on opt-IN (not on unsubscribe) so Meta Ads optimiser
        // treats this as a positive signal.
        if (data.enabled) {
          trackMetaCustomEvent("PredictionSubscribed", {
            content_name: "prediction_updates",
          });
          setJustSubscribed(true);
          setTimeout(() => setJustSubscribed(false), 4000);
        }
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setToggling(false);
    }
  };

  if (loading) return null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: `2px solid ${isSubscribed ? colors.successAlt : BRAND.primary}`,
        borderRadius: 16,
        padding: "24px 28px",
        textAlign: "center",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <div style={{ fontSize: "1.5rem", marginBottom: 8 }} aria-hidden="true">
        {isSubscribed ? "✅" : "🤖"}
      </div>
      <h3
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          marginBottom: 8,
          color: "var(--text)",
        }}
      >
        {isSubscribed
          ? t("predictions.subscribe.activeTitle")
          : t("predictions.subscribe.title")}
      </h3>
      <p
        style={{
          color: "var(--muted)",
          fontSize: "0.9rem",
          lineHeight: 1.6,
          marginBottom: 16,
          maxWidth: 400,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {isSubscribed
          ? t("predictions.subscribe.activeDesc")
          : t("predictions.subscribe.desc")}
      </p>

      <button
        onClick={handleToggle}
        disabled={toggling}
        style={{
          background: isSubscribed ? "transparent" : colors.brandGradient,
          color: isSubscribed ? "var(--muted)" : "white",
          border: isSubscribed ? "1px solid var(--border)" : "none",
          borderRadius: 12,
          padding: "12px 28px",
          fontSize: "0.95rem",
          fontWeight: 700,
          cursor: toggling ? "wait" : "pointer",
          opacity: toggling ? 0.7 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {toggling
          ? "..."
          : isSubscribed
            ? t("predictions.subscribe.unsubscribe")
            : isLoggedIn
              ? t("predictions.subscribe.activate")
              : t("predictions.subscribe.createAccount")}
      </button>

      {justSubscribed && (
        <p
          style={{
            color: colors.successAlt,
            fontSize: "0.85rem",
            fontWeight: 600,
            marginTop: 12,
            marginBottom: 0,
          }}
        >
          {t("predictions.subscribe.confirmed")}
        </p>
      )}

      {!isLoggedIn && (
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.78rem",
            marginTop: 12,
            marginBottom: 0,
          }}
        >
          {t("predictions.subscribe.accountRequired")}
        </p>
      )}
    </div>
  );
}
