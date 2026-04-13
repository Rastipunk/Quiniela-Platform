"use client";

import { colors, fontSize as fs, fontWeight as fw, radii } from "@/lib/theme";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { MobileLeaderboard } from "@/components/MobileLeaderboard";
import { PlayerSummary } from "@/components/PlayerSummary";
import { ShareButtons } from "@/components/ShareButtons";
import { PaginationControls } from "@/components/PaginationControls";
import type { PoolOverview } from "@/lib/api";
import type { PlayerSummaryModalData } from "./poolTypes";
import { formatPhaseName, formatPhaseFullName } from "./poolHelpers";
import { TOUCH_TARGET } from "@/hooks/useIsMobile";

const PAGE_SIZE = 20;

interface PoolLeaderboardTabProps {
  overview: PoolOverview;
  poolId: string;
  isMobile: boolean;
  playerSummaryModal: PlayerSummaryModalData | null;
  setPlayerSummaryModal: (data: PlayerSummaryModalData | null) => void;
}

export function PoolLeaderboardTab({
  overview, poolId, isMobile, playerSummaryModal, setPlayerSummaryModal,
}: PoolLeaderboardTabProps) {
  const t = useTranslations("pool");
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const allRows = overview.leaderboard.rows;
  const myUserId = overview.myMembership?.userId;
  const myRow = allRows.find((r) => r.userId === myUserId);
  const myRank = myRow?.rank;
  const leaderPoints = allRows[0]?.points ?? 0;
  const phases = overview.leaderboard.phases || [];

  const isHostOrAdmin = ["HOST", "CO_ADMIN", "CORPORATE_HOST"].includes(overview.myMembership?.role ?? "");

  // Filter + paginate
  const filtered = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter((r) => r.displayName?.toLowerCase().includes(q));
  }, [allRows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Is my row visible in current page?
  const myRowInPage = paged.some((r) => r.userId === myUserId);
  // Show pinned row only when not searching (search already filters)
  const showPinnedRow = myRow && !myRowInPage && !search.trim();

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { exportLeaderboardExcel } = await import("@/lib/exportLeaderboard");
      await exportLeaderboardExcel(overview, (phaseId) => formatPhaseFullName(phaseId, t));
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // ── Render a single table row ──────────────────────────────
  const renderRow = (r: typeof allRows[0], isPinned = false) => {
    const diff = leaderPoints - r.points;
    const originalIdx = allRows.indexOf(r);
    const medal = originalIdx === 0 ? "🥇" : originalIdx === 1 ? "🥈" : originalIdx === 2 ? "🥉" : "";
    const isMe = r.userId === myUserId;

    let rowBg = "transparent";
    if (isPinned) rowBg = colors.infoBgLight;
    else if (isMe) rowBg = "#EEF2FF";
    else if (originalIdx === 0) rowBg = "#fff9e6";
    else if (originalIdx === 1) rowBg = colors.bgLight;
    else if (originalIdx === 2) rowBg = "#fafafa";

    return (
      <tr
        key={`${r.userId}${isPinned ? "-pinned" : ""}`}
        style={{
          borderBottom: isPinned ? `2px solid ${colors.brand}` : "1px solid #f0f0f0",
          background: rowBg,
        }}
      >
        <td style={{ padding: "14px 8px", fontWeight: 700, fontSize: 16 }}>
          {medal ? <span style={{ marginRight: 4 }}>{medal}</span> : null}
          {r.rank}
          {isPinned && (
            <div style={{ fontSize: 9, color: colors.brand, fontWeight: 600, marginTop: 2 }}>
              {t("leaderboard.yourPosition")}
            </div>
          )}
        </td>
        <td
          onClick={() => setPlayerSummaryModal({ userId: r.userId, displayName: r.displayName })}
          style={{ padding: "14px 8px", cursor: "pointer" }}
          onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
          onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.displayName}</div>
          <div style={{ display: "flex", gap: 4 }}>
            {r.role === "HOST" && (
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "#007bff20", border: "1px solid #007bff", color: colors.brand, fontWeight: 600 }}>
                HOST
              </span>
            )}
            {r.role === "CO_ADMIN" && (
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "#28a74520", border: "1px solid #28a745", color: colors.success, fontWeight: 600 }}>
                CO-ADMIN
              </span>
            )}
            {r.role === "PLAYER" && (
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "#6c757d20", border: "1px solid #6c757d", color: colors.textMuted, fontWeight: 600 }}>
                PLAYER
              </span>
            )}
            {r.memberStatus === "LEFT" && (
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "#ef444420", border: "1px solid #ef4444", color: colors.errorBorderStrong, fontWeight: 600 }}>
                {t("mobileLeaderboard.retired")}
              </span>
            )}
          </div>
        </td>
        <td style={{ padding: "14px 8px", textAlign: "center", fontWeight: 900, fontSize: 18, color: colors.brand, background: isPinned ? "#dbeafe" : "#f8fbff" }}>
          {r.points}
        </td>
        {phases.map((phaseId: string) => {
          const phasePoints = r.pointsByPhase?.[phaseId] ?? 0;
          const hasPoints = phasePoints > 0;
          return (
            <td
              key={phaseId}
              onClick={() => { if (hasPoints) setPlayerSummaryModal({ userId: r.userId, displayName: r.displayName, initialPhase: phaseId }); }}
              style={{
                padding: "10px 6px", textAlign: "center", fontSize: 13,
                fontWeight: hasPoints ? 600 : 400,
                color: hasPoints ? colors.textDark : colors.disabled,
                cursor: hasPoints ? "pointer" : "default",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => { if (hasPoints) e.currentTarget.style.background = colors.infoBgLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              title={hasPoints ? t("leaderboard.viewPhaseDetail", { phase: formatPhaseFullName(phaseId, t) }) : t("leaderboard.noPointsYet")}
            >
              {hasPoints ? phasePoints : "-"}
            </td>
          );
        })}
        <td style={{ padding: "14px 8px", textAlign: "center", fontSize: 13, color: colors.textMuted }}>
          {r.rank === 1 ? (
            <span style={{ fontWeight: 700, color: "#2e7d32" }}>{t("leaderboard.leader")}</span>
          ) : (
            <span>-{diff}</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <>
      <div style={{ marginTop: 14, padding: isMobile ? 12 : 20, border: "1px solid #ddd", borderRadius: 14, background: colors.white }}>
        {/* Header */}
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 900 }}>{t("leaderboard.title")}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isHostOrAdmin && (
              <button
                onClick={handleExport}
                disabled={exporting}
                title={t("leaderboard.exportExcel")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: isMobile ? "8px 12px" : "6px 12px", borderRadius: 8,
                  border: `1px solid ${colors.brand}`, background: colors.white,
                  color: colors.brand, cursor: exporting ? "not-allowed" : "pointer",
                  fontSize: 12, fontWeight: 600, opacity: exporting ? 0.6 : 1,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { if (!exporting) e.currentTarget.style.background = "#EEF2FF"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = colors.white; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {exporting ? t("leaderboard.exporting") : (isMobile ? "Excel" : t("leaderboard.exportExcel"))}
              </button>
            )}
            <ShareButtons
              context="leaderboard"
              url={typeof window !== "undefined" ? window.location.href : ""}
              data={{ poolName: overview.pool.name, rank: myRank, totalMembers: overview.counts.membersActive }}
              size="sm"
              showLabels={false}
            />
          </div>
        </div>

        {/* Search */}
        {allRows.length > PAGE_SIZE && (
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("leaderboard.searchPlaceholder")}
              style={{
                width: "100%",
                padding: isMobile ? "12px 14px" : "10px 14px",
                borderRadius: radii.lg,
                border: `1px solid ${colors.borderMedium}`,
                fontSize: isMobile ? 16 : 14,
                outline: "none",
                boxSizing: "border-box",
                minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
              }}
            />
          </div>
        )}

        {isMobile ? (
          <>
            <MobileLeaderboard
              rows={paged}
              phases={phases}
              onPlayerClick={(userId, displayName, initialPhase) => {
                setPlayerSummaryModal({ userId, displayName, initialPhase });
              }}
              formatPhaseName={(phaseId: string) => formatPhaseName(phaseId, t)}
              formatPhaseFullName={(phaseId: string) => formatPhaseFullName(phaseId, t)}
              pinnedRow={showPinnedRow ? myRow : undefined}
              pinnedLabel={t("leaderboard.yourPosition")}
            />
            <PaginationControls
              page={safePage} totalPages={totalPages}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              isMobile={isMobile}
            />
          </>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700, color: colors.textDark }}>{t("leaderboard.pos")}</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700, color: colors.textDark }}>{t("leaderboard.player")}</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: colors.brand, background: colors.infoBgLight, borderRadius: "8px 8px 0 0" }}>{t("leaderboard.total")}</th>
                    {phases.map((phaseId: string) => (
                      <th key={phaseId} title={formatPhaseFullName(phaseId, t)} style={{ padding: "12px 6px", textAlign: "center", fontWeight: 600, color: colors.textMuted, fontSize: 12, minWidth: 50 }}>
                        {formatPhaseName(phaseId, t)}
                      </th>
                    ))}
                    <th style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: colors.textDark }}>{t("leaderboard.diff")}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pinned current user row (when not on current page) */}
                  {showPinnedRow && renderRow(myRow!, true)}
                  {/* Page rows */}
                  {paged.map((r) => renderRow(r))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: colors.textLight }}>
                {search.trim() ? t("leaderboard.noResults") : t("leaderboard.emptyState")}
              </div>
            )}

            <PaginationControls
              page={safePage} totalPages={totalPages}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              isMobile={isMobile}
            />
          </>
        )}
      </div>

      {/* Player Summary Modal */}
      {playerSummaryModal && poolId && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
          onClick={() => setPlayerSummaryModal(null)}
        >
          <div
            style={{ background: colors.white, borderRadius: 16, maxWidth: 950, width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: "sticky", top: 0, background: colors.white, padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>
                {t("playerSummary.title", { name: playerSummaryModal.displayName })}
              </h2>
              <button
                onClick={() => setPlayerSummaryModal(null)}
                style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: colors.textMuted, padding: "4px 8px" }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <PlayerSummary
                poolId={poolId}
                userId={playerSummaryModal.userId}
                tournamentKey={overview.tournamentInstance.templateKey ?? "wc_2026_sandbox"}
                initialPhase={playerSummaryModal.initialPhase}
                onClose={() => setPlayerSummaryModal(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
