"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { archivePool } from "@/lib/api";
import { NotificationBanner } from "@/components/NotificationBanner";
import CapacitySelector from "@/components/CapacitySelector";
import type { PoolTabBaseProps, PhaseData, ExpulsionModalData } from "./poolTypes";
import { AdminSettingsToggles } from "./admin/AdminSettingsToggles";
import { PhaseStatusPanel } from "./admin/PhaseStatusPanel";
import { PendingJoinRequests } from "./admin/PendingJoinRequests";
import { MemberManagement } from "./admin/MemberManagement";
import { ExpulsionModal } from "./admin/ExpulsionModal";

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

  const [expulsionModalData, setExpulsionModalData] = useState<ExpulsionModalData | null>(null);

  return (
    <div style={{ marginTop: 14, padding: 20, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
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

      <MemberManagement
        poolId={poolId} token={token} overview={overview}
        busyKey={busyKey} setBusyKey={setBusyKey} setError={setError}
        friendlyError={friendlyError} reload={reload}
        setExpulsionModalData={setExpulsionModalData}
      />

      {/* Pool Capacity Section */}
      {overview.pool.maxParticipants && (
        <div style={{ marginBottom: 24, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#4f46e5" }}>
            {t("admin.capacity.title")}
          </h4>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
            {t("admin.capacity.current", { current: overview.counts.membersActive, max: overview.pool.maxParticipants })}
          </div>
          <div style={{ height: 8, background: "#e9ecef", borderRadius: 4, marginBottom: 16 }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${Math.min(100, (overview.counts.membersActive / overview.pool.maxParticipants) * 100)}%`,
              background: (overview.counts.membersActive / overview.pool.maxParticipants) > 0.8 ? "#dc3545" : "#28a745",
              transition: "width 0.3s ease",
            }} />
          </div>
          <CapacitySelector
            type={overview.pool.organizationId ? "corporate" : "personal"}
            currentCapacity={overview.pool.maxParticipants}
            selectedCapacity={overview.pool.maxParticipants}
            onSelect={() => {}}
            mode="expansion"
          />
        </div>
      )}

      {/* Archive Pool Section */}
      {overview.pool.status === "COMPLETED" && (
        <div style={{ marginBottom: 24, padding: 16, background: "#fff3cd", borderRadius: 12, border: "1px solid #ffc107" }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#856404" }}>
            📦 {t("admin.archive.title")}
          </h4>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "#856404", marginBottom: 12 }}>
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
              background: busyKey === "archive" ? "#ccc" : "#ffc107",
              color: "#856404", cursor: busyKey === "archive" ? "wait" : "pointer",
              fontSize: 14, fontWeight: 600,
            }}
          >
            {busyKey === "archive" ? `⏳ ${t("admin.archive.archiving")}` : `📦 ${t("admin.archive.archiveButton")}`}
          </button>
        </div>
      )}

      {/* Instructions */}
      <div style={{ padding: 16, background: "#e7f3ff", border: "1px solid #b3d7ff", borderRadius: 12 }}>
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

      {/* Expulsion Modal */}
      {expulsionModalData && (
        <ExpulsionModal
          data={expulsionModalData}
          onClose={() => setExpulsionModalData(null)}
          poolId={poolId}
          token={token}
          busyKey={busyKey}
          setBusyKey={setBusyKey}
          setError={setError}
          friendlyError={friendlyError}
          reload={reload}
        />
      )}
    </div>
  );
}
