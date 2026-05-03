"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { colors } from "@/lib/theme";
import {
  createCheckout,
  createMpCheckout,
  getPaymentCountry,
} from "@/lib/api/payments";
import {
  getTierForCustomCount,
  getTierForCustomCountUsd,
  formatPrice,
  type PoolType as PricingPoolType,
  type Currency,
} from "@/lib/pricing";
import CapacitySelector from "@/components/CapacitySelector";
import type { PoolOverview } from "@/lib/api";

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
  const [selectedCapacity, setSelectedCapacity] = useState(currentCapacity);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState("US");

  useEffect(() => {
    getPaymentCountry().then(setCountry).catch(() => {});
  }, []);

  const handleExpand = async () => {
    if (selectedCapacity <= currentCapacity) return;
    setBusy(true);
    try {
      const country = await getPaymentCountry();
      if (country === "CO") {
        // Mercado Pago (Colombia/COP) — navigate to embedded Payment Brick
        const mpData = await createMpCheckout(poolId, selectedCapacity);
        const params = new URLSearchParams({
          publicKey: mpData.publicKey || "",
          amount: String(mpData.amountCop),
          paymentId: mpData.paymentId,
          reference: mpData.reference,
          preferenceId: mpData.preferenceId,
          poolId,
        });
        const localePrefix = locale === "es" ? "" : `/${locale}`;
        window.location.href = `${localePrefix}/pago/checkout?${params.toString()}`;
      } else {
        // Polar redirect (International)
        const result = await createCheckout(poolId, selectedCapacity);
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      console.error("Expand checkout failed:", err);
      setBusy(false);
    }
  };

  return (
    <div>
      <CapacitySelector
        type={poolType}
        currentCapacity={currentCapacity}
        selectedCapacity={selectedCapacity}
        onSelect={setSelectedCapacity}
        mode="expansion"
        currency={country === "CO" ? "COP" : "USD"}
      />
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
