"use client";

import { colors } from "@/lib/theme";

import { useTranslations } from "next-intl";
import { archivePool } from "@/lib/api";
import { NotificationBanner } from "@/components/NotificationBanner";
import type { PoolTabBaseProps, PhaseData } from "./poolTypes";
import { AdminSettingsToggles } from "./admin/AdminSettingsToggles";
import { ManageRulesPanel } from "./admin/ManageRulesPanel";
import { PhaseStatusPanel } from "./admin/PhaseStatusPanel";

interface PoolAdminTabProps extends PoolTabBaseProps {
  phases: PhaseData[];
  getPhaseStatus: (phaseId: string) => string;
  hasPhaseAdvanced: (phaseId: string) => boolean;
  nextPhaseMap: Record<string, string | null>;
  notifications: any;
  tabBadges: Record<string, number>;
}

export function PoolAdminTab({
  poolId, token, overview, isMobile, busyKey, setBusyKey, error, setError,
  userTimezone, reload, refetchNotifications, friendlyError,
  phases, getPhaseStatus, hasPhaseAdvanced, nextPhaseMap,
  notifications, tabBadges,
}: PoolAdminTabProps) {
  const t = useTranslations("pool");

  return (
    <div style={{ marginTop: 14, padding: 20, border: "1px solid #ddd", borderRadius: 14, background: colors.white }}>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, marginBottom: 16 }}>⚙️ {t("admin.title")}</h3>

      {/* Notification banner — only phase-advancement signals belong here.
          Pending-approval was moved to the Players tab where the host
          actually does member management. */}
      {notifications && (tabBadges.admin > 0) && (() => {
        const bannerItems: { icon: string; message: string }[] = [];

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

      {/* Host-only — edit scoring rules. Editor opens only in DRAFT;
          other states show a locked banner explaining how to unlock. */}
      <ManageRulesPanel
        poolId={poolId} token={token} overview={overview}
        setError={setError} friendlyError={friendlyError} reload={reload}
      />

      <PhaseStatusPanel
        poolId={poolId} token={token} overview={overview} phases={phases}
        getPhaseStatus={getPhaseStatus} hasPhaseAdvanced={hasPhaseAdvanced}
        nextPhaseMap={nextPhaseMap} busyKey={busyKey} setBusyKey={setBusyKey}
        setError={setError} friendlyError={friendlyError} reload={reload}
      />

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
