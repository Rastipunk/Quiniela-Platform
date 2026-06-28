"use client";

import { colors } from "@/lib/theme";

import { useTranslations } from "next-intl";
import { archivePool } from "@/lib/api";
import type { PoolTabBaseProps, PhaseData } from "./poolTypes";
import { AdminSettingsToggles } from "./admin/AdminSettingsToggles";
import { ExtraTimeConfigSection } from "./admin/ExtraTimeConfigSection";
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

      {/* Phase-advancement notifications retired (ADR-084): advancement is
          automatic and release is admin-controlled via the Gestor de fases, so
          the host has no manual advance action to be notified about. */}

      <AdminSettingsToggles
        poolId={poolId} token={token} overview={overview} phases={phases}
        busyKey={busyKey} setBusyKey={setBusyKey} setError={setError}
        friendlyError={friendlyError} reload={reload}
      />

      {/* Knockout extra-time scoring (v2). Renders only for gated score-pools
          (overview.extraTime.enabled && isScorePool); replaces the legacy
          extra-time toggle hidden in AdminSettingsToggles. */}
      <ExtraTimeConfigSection
        poolId={poolId} token={token} overview={overview} reload={reload}
      />

      {/* Host-only — edit scoring rules. Editor opens only in DRAFT;
          other states show a locked banner explaining how to unlock. */}
      <ManageRulesPanel
        poolId={poolId} token={token} overview={overview}
        setError={setError} friendlyError={friendlyError} reload={reload}
      />

      <PhaseStatusPanel overview={overview} phases={phases} />

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
