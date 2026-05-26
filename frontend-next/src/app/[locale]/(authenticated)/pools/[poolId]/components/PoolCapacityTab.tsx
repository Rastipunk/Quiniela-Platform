"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { colors } from "@/lib/theme";
import {
  createCheckout,
  createMpCheckout,
  getPaymentCountry,
} from "@/lib/api/payments";
import { reportPaymentAttemptEvent } from "@/lib/api/paymentAttemptEvent";
import { trackBeginCheckout } from "@/lib/ecommerce";
import { trackMetaEvent } from "@/lib/metaPixel";
import {
  getTierForCustomCount,
  getTierForCustomCountUsd,
  formatPrice,
  type PoolType as PricingPoolType,
  type Currency,
} from "@/lib/pricing";
import CapacitySelector from "@/components/CapacitySelector";
import AccountReceivableRedemptionBox from "@/components/AccountReceivableRedemptionBox";
import type { PoolOverview, RedemptionSummary } from "@/lib/api";
import { useIsMobile } from "@/hooks/useIsMobile";

// Dedicated capacity tab. Extracted verbatim from the old admin tab
// (where it used to live as one of many embedded sections) so hosts
// can find capacity at a glance without spelunking through admin.
//
// Backend, pricing, and checkout flow are untouched — this is a pure
// UI relocation. The "pool full" popup CTA in the parent page now
// routes here too (see `setActiveTab("capacidad")` in page.tsx).

interface Props {
  poolId: string;
  overview: PoolOverview;
}

export function PoolCapacityTab({ poolId, overview }: Props) {
  const t = useTranslations("pool");

  if (!overview.pool.maxParticipants) {
    return (
      <div
        style={{
          marginTop: 14,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 14,
          background: colors.white,
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        {t("admin.capacity.notConfigured", {
          defaultMessage: "Capacidad no configurada para esta pool.",
        })}
      </div>
    );
  }

  const max = overview.pool.maxParticipants;
  const current = overview.counts.membersActive;
  const fillRatio = current / max;

  return (
    <div
      style={{
        marginTop: 14,
        padding: 20,
        border: "1px solid #ddd",
        borderRadius: 14,
        background: colors.white,
      }}
    >
      <div
        style={{
          padding: 16,
          background: colors.bgLight,
          borderRadius: 12,
          border: "1px solid #e9ecef",
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 12,
            color: colors.brand,
          }}
        >
          {t("admin.capacity.title")}
        </h4>
        <div style={{ fontSize: 14, color: colors.textMuted, marginBottom: 8 }}>
          {t("admin.capacity.current", { current, max })}
        </div>
        <div
          style={{
            height: 8,
            background: colors.borderLighter,
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 4,
              width: `${Math.min(100, fillRatio * 100)}%`,
              background: fillRatio > 0.8 ? colors.errorAlt : colors.success,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <ExpandCapacitySection
          poolId={poolId}
          poolType={overview.pool.organizationId ? "corporate" : "personal"}
          currentCapacity={max}
        />
      </div>
    </div>
  );
}

// ── Expand Capacity Section ────────────────────────────────────
//
// Verbatim move from PoolAdminTab.tsx. Owns the "select higher tier
// → checkout via Polar (USD) or Mercado Pago (COP)" flow. Detection
// of the buyer's currency happens server-side via the country IP
// header — same plumbing as before.

function ExpandCapacitySection({
  poolId,
  poolType,
  currentCapacity,
}: {
  poolId: string;
  poolType: "personal" | "corporate";
  currentCapacity: number;
}) {
  const t = useTranslations("payment");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const [selectedCapacity, setSelectedCapacity] = useState(currentCapacity);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState("US");
  // F-1: surface failures explicitly. The pre-fix behaviour was a silent
  // console.error + spinner off — Abril's "no me anda la página" case.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cuenta-de-cobro redemption is only meaningful on corporate pools —
  // backend issuance is gated to poolType="corporate" (commit 5).
  const ccEnabled = poolType === "corporate";
  const [ccApplied, setCcApplied] = useState<RedemptionSummary | null>(null);

  useEffect(() => {
    getPaymentCountry().then(setCountry).catch(() => {});
  }, []);

  // When a CC is applied its targetCapacity drives the selection; the
  // CapacitySelector becomes a read-only summary so the host can't
  // accidentally override what the CC pre-paid for.
  useEffect(() => {
    if (ccApplied) setSelectedCapacity(ccApplied.targetCapacity);
  }, [ccApplied]);

  const handleExpand = async () => {
    if (selectedCapacity <= currentCapacity) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const country = await getPaymentCountry();
      if (country === "CO") {
        // Mercado Pago (Colombia/COP) — navigate to embedded Payment Brick.
        const mpData = await createMpCheckout(poolId, selectedCapacity, ccApplied?.id);
        // F-16: emit GA4 + Meta funnel events from the expand path so
        // admin-tab checkouts are counted alongside wizard checkouts.
        // Pre-fix only PoolCreationWizard emitted these — the funnel
        // was blind to host-driven capacity expansions.
        trackBeginCheckout({
          fromCapacity: currentCapacity,
          toCapacity: selectedCapacity,
          poolType,
          price: mpData.amountCop,
          currency: "COP",
        });
        trackMetaEvent("InitiateCheckout", {
          content_type: "product",
          content_ids: [`pool_upgrade_${poolType}_${selectedCapacity}`],
          num_items: 1,
          currency: "COP",
          value: mpData.amountCop,
        });
        const params = new URLSearchParams({
          publicKey: mpData.publicKey || "",
          amount: String(mpData.amountCop),
          paymentId: mpData.paymentId,
          reference: mpData.reference,
          preferenceId: mpData.preferenceId,
          poolId,
        });
        const localePrefix = locale === "es" ? "" : `/${locale}`;
        const url = `${localePrefix}/pago/checkout?${params.toString()}`;
        // F-13: beacon BEFORE the redirect so the backend has a row
        // even if the browser navigation fails (CSP, popup blocker).
        // Fire-and-forget — never block the redirect on this.
        void reportPaymentAttemptEvent(mpData.paymentId, {
          eventType: "REDIRECT_INITIATED",
          details: { gateway: "MP", url },
        });
        try {
          window.location.href = url;
        } catch (redirectErr) {
          void reportPaymentAttemptEvent(mpData.paymentId, {
            eventType: "REDIRECT_FAILED",
            details: { gateway: "MP", error: String(redirectErr) },
          });
          throw redirectErr;
        }
      } else {
        // Polar redirect (international/USD).
        const result = await createCheckout(poolId, selectedCapacity, ccApplied?.id);
        // F-16: GA4 + Meta funnel events for the admin expand path.
        trackBeginCheckout({
          fromCapacity: currentCapacity,
          toCapacity: selectedCapacity,
          poolType,
          price: result.amountUsd,
          currency: "USD",
        });
        trackMetaEvent("InitiateCheckout", {
          content_type: "product",
          content_ids: [`pool_upgrade_${poolType}_${selectedCapacity}`],
          num_items: 1,
          currency: "USD",
          value: result.amountUsd,
        });
        void reportPaymentAttemptEvent(result.paymentId, {
          eventType: "REDIRECT_INITIATED",
          details: { gateway: "POLAR", url: result.checkoutUrl },
        });
        try {
          window.location.href = result.checkoutUrl;
        } catch (redirectErr) {
          void reportPaymentAttemptEvent(result.paymentId, {
            eventType: "REDIRECT_FAILED",
            details: { gateway: "POLAR", error: String(redirectErr) },
          });
          throw redirectErr;
        }
      }
    } catch (err) {
      console.error("Expand checkout failed:", err);
      // Surface the failure to the user instead of just clearing the
      // spinner (F-1). The backend already has an INITIATED/FAILED row
      // from initiateCheckout's failure path (Commit 3), so there's no
      // need to beacon "CLIENT_ERROR" here — that audit trail exists.
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : t("checkout.checkoutFailed"),
      );
      setBusy(false);
    }
  };

  return (
    <div>
      {ccEnabled && (
        <AccountReceivableRedemptionBox
          onRedeem={setCcApplied}
          onClear={() => {
            setCcApplied(null);
            setSelectedCapacity(currentCapacity);
          }}
          applied={ccApplied}
          isMobile={isMobile}
        />
      )}
      <CapacitySelector
        type={poolType}
        currentCapacity={currentCapacity}
        selectedCapacity={selectedCapacity}
        onSelect={(c) => { if (!ccApplied) setSelectedCapacity(c); }}
        mode="expansion"
        currency={country === "CO" ? "COP" : "USD"}
      />
      {errorMsg && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: "12px 16px",
            borderRadius: 10,
            background: colors.errorBg,
            border: `1px solid ${colors.errorBorder}`,
            color: colors.error,
            fontSize: 14,
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>{t("checkout.errorTitle")}</div>
          <div>{errorMsg}</div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>
            {t("checkout.errorHint")}
          </div>
        </div>
      )}
      {selectedCapacity > currentCapacity && (
        <button
          onClick={handleExpand}
          disabled={busy}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "14px 24px",
            borderRadius: 10,
            border: "none",
            background: busy
              ? colors.disabled
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            fontSize: 15,
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy
            ? t("checkout.processing")
            : errorMsg
              ? t("checkout.retry")
              : (() => {
                  const cur: Currency = country === "CO" ? "COP" : "USD";
                  const getTier =
                    cur === "USD"
                      ? getTierForCustomCountUsd
                      : getTierForCustomCount;
                  const tier = getTier(poolType as PricingPoolType, selectedCapacity);
                  const fromTier = getTier(
                    poolType as PricingPoolType,
                    currentCapacity,
                  );
                  const upgradePrice = tier.totalPrice - fromTier.totalPrice;
                  return t("expand.expandButton", {
                    capacity: selectedCapacity,
                    price: formatPrice(upgradePrice, cur),
                  });
                })()}
        </button>
      )}
    </div>
  );
}
