"use client";

import { colors } from "@/lib/theme";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { archivePool } from "@/lib/api";
import { createCheckout, createMpCheckout, getPaymentCountry } from "@/lib/api/payments";
import { getTierForCustomCount, getTierForCustomCountUsd, formatPrice, type PoolType as PricingPoolType, type Currency } from "@/lib/pricing";
import { NotificationBanner } from "@/components/NotificationBanner";
import CapacitySelector from "@/components/CapacitySelector";
import type { PoolTabBaseProps, PhaseData } from "./poolTypes";
import { AdminSettingsToggles } from "./admin/AdminSettingsToggles";
import { PhaseStatusPanel } from "./admin/PhaseStatusPanel";
import { PendingJoinRequests } from "./admin/PendingJoinRequests";

interface PoolAdminTabProps extends PoolTabBaseProps {
  phases: PhaseData[];
  getPhaseStatus: (phaseId: string) => string;
  hasPhaseAdvanced: (phaseId: string) => boolean;
  nextPhaseMap: Record<string, string | null>;
  notifications: any;
  tabBadges: Record<string, number>;
  pendingMembers: any[];
  loadPendingMembers: () => Promise<void>;
}

export function PoolAdminTab({
  poolId, token, overview, isMobile, busyKey, setBusyKey, error, setError,
  userTimezone, reload, refetchNotifications, friendlyError,
  phases, getPhaseStatus, hasPhaseAdvanced, nextPhaseMap,
  notifications, tabBadges, pendingMembers, loadPendingMembers,
}: PoolAdminTabProps) {
  const t = useTranslations("pool");
  const verbose = false;

  return (
    <div style={{ marginTop: 14, padding: 20, border: "1px solid #ddd", borderRadius: 14, background: colors.white }}>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, marginBottom: 16 }}>⚙️ {t("admin.title")}</h3>

      {/* Notification Banner for Admin tab */}
      {notifications && (tabBadges.admin > 0) && (() => {
        const bannerItems: { icon: string; message: string }[] = [];

        if (notifications.pendingJoins > 0) {
          bannerItems.push({
            icon: "👤",
            message: notifications.pendingJoins > 1
              ? t("admin.notifications.pendingJoinsPlural", { count: notifications.pendingJoins })
              : t("admin.notifications.pendingJoins", { count: notifications.pendingJoins })
          });
        }

        if (notifications.phasesReadyToAdvance.length > 0) {
          bannerItems.push({
            icon: "🚀",
            message: notifications.phasesReadyToAdvance.length > 1
              ? t("admin.notifications.phasesReadyPlural", { count: notifications.phasesReadyToAdvance.length })
              : t("admin.notifications.phasesReady", { count: notifications.phasesReadyToAdvance.length })
          });
        }

        return bannerItems.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <NotificationBanner items={bannerItems} />
          </div>
        ) : null;
      })()}

      <AdminSettingsToggles
        poolId={poolId} token={token} overview={overview} phases={phases}
        busyKey={busyKey} setBusyKey={setBusyKey} setError={setError}
        friendlyError={friendlyError} reload={reload}
      />

      <PhaseStatusPanel
        poolId={poolId} token={token} overview={overview} phases={phases}
        getPhaseStatus={getPhaseStatus} hasPhaseAdvanced={hasPhaseAdvanced}
        nextPhaseMap={nextPhaseMap} busyKey={busyKey} setBusyKey={setBusyKey}
        setError={setError} friendlyError={friendlyError} reload={reload}
      />

      {/* Pending Join Requests Section */}
      {overview.permissions.canManageResults && (
        <PendingJoinRequests
          poolId={poolId} token={token} pendingMembers={pendingMembers}
          busyKey={busyKey} setBusyKey={setBusyKey} setError={setError}
          friendlyError={friendlyError} userTimezone={userTimezone}
          reload={reload} refetchNotifications={refetchNotifications}
          loadPendingMembers={loadPendingMembers}
        />
      )}

      {/* Pool Capacity Section */}
      {overview.pool.maxParticipants && (
        <div style={{ marginBottom: 24, padding: 16, background: colors.bgLight, borderRadius: 12, border: "1px solid #e9ecef" }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: colors.brand }}>
            {t("admin.capacity.title")}
          </h4>
          <div style={{ fontSize: 14, color: colors.textMuted, marginBottom: 8 }}>
            {t("admin.capacity.current", { current: overview.counts.membersActive, max: overview.pool.maxParticipants })}
          </div>
          <div style={{ height: 8, background: colors.borderLighter, borderRadius: 4, marginBottom: 16 }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${Math.min(100, (overview.counts.membersActive / overview.pool.maxParticipants) * 100)}%`,
              background: (overview.counts.membersActive / overview.pool.maxParticipants) > 0.8 ? colors.errorAlt : colors.success,
              transition: "width 0.3s ease",
            }} />
          </div>
          <ExpandCapacitySection
            poolId={poolId}
            poolType={overview.pool.organizationId ? "corporate" : "personal"}
            currentCapacity={overview.pool.maxParticipants}
          />
        </div>
      )}

      {/* Archive Pool Section */}
      {overview.pool.status === "COMPLETED" && (
        <div style={{ marginBottom: 24, padding: 16, background: colors.warningBg, borderRadius: 12, border: "1px solid #ffc107" }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: colors.warningDark }}>
            📦 {t("admin.archive.title")}
          </h4>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: colors.warningDark, marginBottom: 12 }}>
            {t("admin.archive.description")}
          </div>
          <button
            onClick={async () => {
              if (!token || !poolId || busyKey === "archive") return;
              const confirmed = window.confirm(t("admin.archive.confirm"));
              if (!confirmed) return;
              setBusyKey("archive");
              setError(null);
              try {
                await archivePool(token, poolId);
                await reload();
                alert(`✅ ${t("admin.archive.success")}`);
              } catch (err: any) {
                setError(friendlyError(err));
              } finally {
                setBusyKey(null);
              }
            }}
            disabled={busyKey === "archive"}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "1px solid #856404",
              background: busyKey === "archive" ? colors.disabled : colors.warning,
              color: colors.warningDark, cursor: busyKey === "archive" ? "wait" : "pointer",
              fontSize: 14, fontWeight: 600,
            }}
          >
            {busyKey === "archive" ? `⏳ ${t("admin.archive.archiving")}` : `📦 ${t("admin.archive.archiveButton")}`}
          </button>
        </div>
      )}

      {/* Instructions */}
      <div style={{ padding: 16, background: colors.infoBgLight, border: "1px solid #b3d7ff", borderRadius: 12 }}>
        <div style={{ fontSize: 14, color: "#004085", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>ℹ️ {t("admin.hostInfo.title")}</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>{t("admin.hostInfo.tip1")}</li>
            <li>{t.rich("admin.hostInfo.tip2", { b: (chunks) => <b>{chunks}</b> })}</li>
            <li>{t("admin.hostInfo.tip3")}</li>
            <li>{t.rich("admin.hostInfo.tip4", { b: (chunks) => <b>{chunks}</b> })}</li>
            <li>{t("admin.hostInfo.tip5")}</li>
            <li>{t("admin.hostInfo.tip6")}</li>
          </ul>
        </div>
      </div>

    </div>
  );
}

// ── Expand Capacity Section ────────────────────────────────────

function ExpandCapacitySection({ poolId, poolType, currentCapacity }: {
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
            background: busy ? colors.disabled : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            fontSize: 15,
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? t("checkout.processing") : (() => {
            const cur: Currency = country === "CO" ? "COP" : "USD";
            const getTier = cur === "USD" ? getTierForCustomCountUsd : getTierForCustomCount;
            const tier = getTier(poolType as PricingPoolType, selectedCapacity);
            const fromTier = getTier(poolType as PricingPoolType, currentCapacity);
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
