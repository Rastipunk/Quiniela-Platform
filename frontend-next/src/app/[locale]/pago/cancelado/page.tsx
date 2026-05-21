"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { colors, radii, fontWeight } from "@/lib/theme";
import { BRAND } from "@/lib/brand";
import { reportPaymentAttemptEvent } from "@/lib/api/paymentAttemptEvent";
import { trackEvent } from "@/lib/analytics";

export default function PaymentCancelledPage() {
  const t = useTranslations("payment");
  const router = useRouter();
  const searchParams = useSearchParams();
  const poolId = searchParams.get("poolId");
  const paymentId = searchParams.get("paymentId");

  // F-17: report the cancellation back to the backend + analytics on mount.
  // useRef guard prevents double-firing in React 18+ strict-mode dev
  // re-mounts. The audit row is what closes G-2 ("why did the user not
  // complete?") for the cancellation branch — previously cancellations
  // were completely silent.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;

    if (paymentId) {
      void reportPaymentAttemptEvent(paymentId, {
        eventType: "USER_CANCELLED",
        details: { poolId, source: "pago_cancelado_page" },
      });
    }
    // GA4 funnel event — fires regardless of whether we have a paymentId
    // (legacy cancel URLs only carry poolId). Custom event, not GA4
    // standard, so dashboards count cancellations distinctly from
    // `payment_failed` (gateway-decided) and abandonments (reconciler-
    // decided). See POLAR_AUDIT.md G-3.
    trackEvent("payment_cancelled", {
      poolId: poolId ?? undefined,
      paymentId: paymentId ?? undefined,
      source: "polar_or_mp_cancel_redirect",
    });
  }, [paymentId, poolId]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: colors.bgLighter,
      padding: 20,
    }}>
      <div style={{
        maxWidth: 480,
        width: "100%",
        background: colors.white,
        borderRadius: radii["2xl"],
        padding: 40,
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 8 }}>
          {t("cancel.title")}
        </h1>
        <p style={{ fontSize: 16, color: colors.textMuted, marginBottom: 32, lineHeight: 1.5 }}>
          {t("cancel.subtitle")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {poolId && (
            <button
              onClick={() => router.push(`/pools/${poolId}`)}
              style={{
                padding: "14px 32px",
                borderRadius: radii.lg,
                border: "none",
                background: BRAND.gradient,
                color: colors.white,
                fontSize: 16,
                fontWeight: fontWeight.bold,
                cursor: "pointer",
              }}
            >
              {t("cancel.goToPool")}
            </button>
          )}
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              padding: "14px 32px",
              borderRadius: radii.lg,
              border: `1px solid ${colors.borderMedium}`,
              background: colors.white,
              color: colors.textMuted,
              fontSize: 14,
              fontWeight: fontWeight.medium,
              cursor: "pointer",
            }}
          >
            {t("cancel.continueFree")}
          </button>
        </div>
      </div>
    </div>
  );
}
