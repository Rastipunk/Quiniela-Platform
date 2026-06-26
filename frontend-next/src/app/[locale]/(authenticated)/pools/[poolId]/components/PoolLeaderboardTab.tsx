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
import { BarChartRaceModal } from "./BarChartRaceModal";
import { getToken } from "@/lib/auth";
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
  const [showBarRace, setShowBarRace] = useState(false);
  const barRaceEnabled = !!overview.leaderboard.barRaceEnabled;
  const token = useMemo(() => getToken(), []);

  const allRows = overview.leaderboard.rows;
  // Which tiebreaker columns to surface (D4: only where meaningful).
  const tb = overview.leaderboard.tiebreakers;
  const anyTieAtTop = allRows.some((r) => r.rank === 1 && r.isTied);
  // Tiebreaker counters are shown ONLY for players caught in a points tie
  // (i.e. when the counters are actually used to resolve — or not — the
  // tie). Players with a unique points total don't show them.
  const tiedPointsValues = useMemo(() => {
    const counts = new Map<number, number>();
    for (const r of allRows) counts.set(r.points, (counts.get(r.points) ?? 0) + 1);
    // Exclude 0: a 0-point tie (tournament not started / nobody scored) is
    // not a meaningful tie — don't surface counters for it.
    return new Set([...counts.entries()].filter(([p, n]) => n >= 2 && p > 0).map(([p]) => p));
  }, [allRows]);
  const myUserId = overview.myMembership?.userId;
  const myRow = allRows.find((r) => r.userId === myUserId);
  const myRank = myRow?.rank;
  const leaderPoints = allRows[0]?.points ?? 0;
  const phases = overview.leaderboard.phases || [];
  // "Puntos ganados / posiciones movidas" in the most recent match(es).
  // Beta-gated per pool (deltaEnabled) — when off the table is unchanged.
  const lastStep = overview.leaderboard.lastStep ?? null;
  const showDelta = !!overview.leaderboard.deltaEnabled && !!lastStep && lastStep.matchIds.length > 0;
  // Are the last-step match(es) still being played, or already finished?
  const lastStepLive =
    showDelta && overview.matches.some((m) => lastStep!.matchIds.includes(m.id) && m.isLive);
  // Per-phase type detection. Each phase column in the leaderboard
  // decides its own rendering based on how the host configured THAT
  // phase, so MIXED pools (some structural, some score) show the right
  // counter (or no counter) on a per-cell basis. We read pickTypesConfig
  // straight from the pool — it is the source of truth.
  const phaseTypeByPhaseId = useMemo(() => {
    const map = new Map<string, "STRUCTURAL_GROUP" | "STRUCTURAL_KNOCKOUT" | "SCORE">();
    const cfg = overview.pool.pickTypesConfig;
    if (Array.isArray(cfg)) {
      for (const phase of cfg) {
        if (!phase) continue;
        if (phase.structuralPicks?.type === "GROUP_STANDINGS") {
          map.set(phase.phaseId, "STRUCTURAL_GROUP");
        } else if (phase.structuralPicks?.type === "KNOCKOUT_WINNER") {
          map.set(phase.phaseId, "STRUCTURAL_KNOCKOUT");
        } else {
          map.set(phase.phaseId, "SCORE");
        }
      }
    }
    return map;
  }, [overview.pool.pickTypesConfig]);
  // Pool has at least one structural phase? Drives the "X/Y posiciones
  // · Z grupos perfectos" summary line under the player name (still
  // useful in MIXED pools that have structural groups).
  const hasAnyStructural = useMemo(
    () => Array.from(phaseTypeByPhaseId.values()).some((t) => t !== "SCORE"),
    [phaseTypeByPhaseId],
  );

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

  // Share-friendly PDF: full standings with per-phase points, ordered by
  // position — available to EVERY member (it's the artifact people drop
  // in the group chat). Mirrors the Excel column layout.
  const [exportingPdf, setExportingPdf] = useState(false);
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const { generateBrandedTablePdf } = await import("@/lib/exportPdf");
      const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
      await generateBrandedTablePdf({
        docTitle: t("pdf.leaderboardDoc"),
        poolName: overview.pool.name,
        subtitleLines: [
          ...(overview.tournamentInstance?.name ? [overview.tournamentInstance.name] : []),
          t("pdf.generatedLine", { date: dateStr }),
        ],
        // The last-match movement caption goes in a highlighted banner above the
        // table (not the muted subtitle).
        highlightBanner: showDelta
          ? t(lastStep!.matchIds.length > 1 ? "lastMatch.captionMany" : "lastMatch.captionOne", { match: lastStep!.label })
          : undefined,
        head: [
          t("pdf.posHeader"),
          t("pdf.playerHeader"),
          t("pdf.totalHeader"),
          ...(showDelta ? [t("lastMatch.gained"), t("lastMatch.moved")] : []),
          ...phases.map((p) => formatPhaseName(p, t)),
          t("pdf.diffHeader"),
        ],
        body: allRows.map((r, idx) => [
          r.isTied ? `${r.rank}=` : String(r.rank),
          r.displayName,
          r.points,
          ...(showDelta
            ? [
                (r.lastGainPoints ?? 0) > 0 ? `+${r.lastGainPoints}` : "0",
                // Magnitude only — the up/down triangle is drawn as a vector.
                (r.lastRankDelta ?? 0) !== 0 ? `  ${Math.abs(r.lastRankDelta ?? 0)}` : "=",
              ]
            : []),
          ...phases.map((p) => {
            const v = r.pointsByPhase?.[p] ?? 0;
            return v === 0 ? "-" : v;
          }),
          idx === 0 ? "-" : `-${leaderPoints - r.points}`,
        ]),
        totalColIndex: 2,
        deltaColIndices: showDelta ? [3, 4] : undefined,
        arrowColIndex: showDelta ? 4 : undefined,
        arrowDirections: showDelta ? allRows.map((r) => Math.sign(r.lastRankDelta ?? 0)) : undefined,
        podiumRows: true,
        footerText: t("pdf.footerCounts", { players: allRows.length, matches: overview.matches.length }),
        filenameBase: `${t("pdf.leaderboardDoc")}_${overview.pool.name}`,
      });
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Render a single table row ──────────────────────────────
  const renderRow = (r: typeof allRows[0], isPinned = false) => {
    const diff = leaderPoints - r.points;
    // Medal/highlight key off the (possibly shared) RANK, not the array
    // index — so two players tied for 1st both show 🥇.
    const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : "";
    const isMe = r.userId === myUserId;

    let rowBg = "transparent";
    if (isPinned) rowBg = colors.infoBgLight;
    else if (isMe) rowBg = "#EEF2FF";
    else if (r.rank === 1) rowBg = "#fff9e6";
    else if (r.rank === 2) rowBg = colors.bgLight;
    else if (r.rank === 3) rowBg = "#fafafa";

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
          {r.isTied && (
            <span title={t("leaderboard.tiedNote")} style={{ marginLeft: 3, fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>=</span>
          )}
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
          {hasAnyStructural && r.structuralStats && r.structuralStats.positionsTotal > 0 && (
            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
              {t("leaderboard.structuralSummary", {
                positionsCorrect: r.structuralStats.positionsCorrect,
                positionsTotal: r.structuralStats.positionsTotal,
                perfectGroups: r.structuralStats.perfectGroups,
              })}
            </div>
          )}
          {tb && (tb.perfect || tb.partial) && tiedPointsValues.has(r.points) && (
            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }} title={t("leaderboard.tiebreakerTooltip")}>
              {tb.perfect && <span>✓ {t("leaderboard.perfectCount", { count: r.perfectCount ?? 0 })}</span>}
              {tb.perfect && tb.partial && <span> · </span>}
              {tb.partial && <span>~ {t("leaderboard.partialCount", { count: r.partialCount ?? 0 })}</span>}
            </div>
          )}
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
        {showDelta && (
          <td style={{ padding: "14px 8px", textAlign: "center", fontSize: 14, fontWeight: 700, background: colors.infoBgLight, borderLeft: `2px solid ${colors.brand}40`, color: (r.lastGainPoints ?? 0) > 0 ? "#16a34a" : colors.textMuted }}>
            {(r.lastGainPoints ?? 0) > 0 ? `+${r.lastGainPoints}` : "0"}
          </td>
        )}
        {showDelta && (() => {
          const d = r.lastRankDelta ?? 0;
          return (
            <td style={{ padding: "14px 8px", textAlign: "center", fontSize: 14, fontWeight: 700, background: colors.infoBgLight, borderRight: `2px solid ${colors.brand}40`, color: d > 0 ? "#16a34a" : d < 0 ? "#dc2626" : colors.textMuted }}>
              {d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "—"}
            </td>
          );
        })()}
        {phases.map((phaseId: string) => {
          const phasePoints = r.pointsByPhase?.[phaseId] ?? 0;
          const hasPoints = phasePoints > 0;
          // Per-phase counter, driven by this phase's configured type
          // (not by the overall pool mode). A MIXED pool with a
          // structural group_stage and score knockouts shows "X★" on the
          // group column and a bare number on the knockout columns —
          // each correctly describing how that phase is being scored.
          const phaseType = phaseTypeByPhaseId.get(phaseId);
          let counter: string | null = null;
          let counterTitle: string | null = null;
          if (phaseType === "STRUCTURAL_GROUP" && r.structuralStats) {
            const s = r.structuralStats;
            counter = `${s.perfectGroups}★`;
            counterTitle = t("leaderboard.tooltipGroupStage", {
              positionsCorrect: s.positionsCorrect,
              positionsTotal: s.positionsTotal,
              perfectGroups: s.perfectGroups,
              totalGroups: s.totalGroups,
            });
          } else if (phaseType === "STRUCTURAL_KNOCKOUT" && r.structuralStats) {
            const k = r.structuralStats.winnersByPhase?.[phaseId];
            if (k && k.total > 0) {
              counter = `${k.correct}/${k.total}`;
              counterTitle = t("leaderboard.tooltipKnockout", {
                correct: k.correct,
                total: k.total,
              });
            }
          }
          // For structural phases, render the cell as soon as the phase
          // has a counter (so "0 · 0/16" shows even before any match is
          // decided). Score phases keep the original "show dash until
          // points exist" behavior.
          const isStructuralPhase = phaseType === "STRUCTURAL_GROUP" || phaseType === "STRUCTURAL_KNOCKOUT";
          const showCell = hasPoints || (isStructuralPhase && counter !== null);
          const cellTitle = showCell
            ? counterTitle ?? t("leaderboard.viewPhaseDetail", { phase: formatPhaseFullName(phaseId, t) })
            : t("leaderboard.noPointsYet");
          return (
            <td
              key={phaseId}
              onClick={() => { if (showCell) setPlayerSummaryModal({ userId: r.userId, displayName: r.displayName, initialPhase: phaseId }); }}
              style={{
                padding: "10px 6px", textAlign: "center", fontSize: 13,
                fontWeight: hasPoints ? 600 : 400,
                color: hasPoints ? colors.textDark : colors.disabled,
                cursor: showCell ? "pointer" : "default",
                transition: "background 0.15s ease",
                minWidth: isStructuralPhase ? 62 : undefined,
              }}
              onMouseEnter={(e) => { if (showCell) e.currentTarget.style.background = colors.infoBgLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              title={cellTitle}
            >
              {showCell ? (
                <>
                  <div>{phasePoints}</div>
                  {counter && (
                    <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 500, marginTop: 2 }}>
                      {counter}
                    </div>
                  )}
                </>
              ) : "-"}
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
            {/* PDF: available to every member — the share artifact. */}
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              title={t("pdf.download")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: isMobile ? "8px 12px" : "6px 12px", borderRadius: 8,
                border: `1px solid ${colors.brand}`, background: colors.brand,
                color: colors.white, cursor: exportingPdf ? "not-allowed" : "pointer",
                fontSize: 12, fontWeight: 600, opacity: exportingPdf ? 0.6 : 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {exportingPdf ? t("pdf.generating") : t("pdf.download")}
            </button>
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

        {/* Evolución bar-chart-race call-to-action (beta-gated) */}
        {barRaceEnabled && (
          <button
            onClick={() => setShowBarRace(true)}
            style={{
              width: "100%", marginBottom: 12, padding: "12px 16px", borderRadius: radii.lg,
              border: "none", background: colors.brandGradient, color: colors.white,
              fontSize: isMobile ? 13 : 15, fontWeight: 800, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: `0 4px 16px ${colors.brand}44`,
            }}
          >
            ▶ {t("barRace.openButton", { pool: overview.pool.name })}
          </button>
        )}

        {/* Empate en el 1er lugar — lo decide la organización */}
        {anyTieAtTop && (
          <div style={{
            marginBottom: 12, padding: "8px 12px", borderRadius: radii.lg,
            background: colors.warningBg, border: `1px solid ${colors.warning}`,
            color: colors.warningDark, fontSize: 13,
          }}>
            🤝 {t("leaderboard.tieAtTopNote")}
          </div>
        )}

        {/* Last-match delta caption + live/finished signal */}
        {showDelta && (
          <div style={{
            marginBottom: 12, padding: "8px 12px", borderRadius: radii.lg,
            background: colors.infoBgLight, border: `1px solid ${colors.infoBorder}`,
            color: colors.infoDarker, fontSize: 13,
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          }}>
            <span>🔄 {t(lastStep!.matchIds.length > 1 ? "lastMatch.captionMany" : "lastMatch.captionOne", { match: lastStep!.label })}</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: lastStepLive ? "#fee2e2" : "#dcfce7",
              color: lastStepLive ? "#b91c1c" : "#15803d",
            }}>
              {lastStepLive ? `🔴 ${t("lastMatch.live")}` : `✅ ${t("lastMatch.finished")}`}
            </span>
          </div>
        )}

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
              phaseTypeByPhaseId={phaseTypeByPhaseId}
              hasAnyStructural={hasAnyStructural}
              tiebreakers={tb}
              tiedPointsValues={[...tiedPointsValues]}
              showDelta={showDelta}
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
                    {showDelta && (
                      <>
                        <th title={t("lastMatch.gainedTooltip", { match: lastStep!.label })} style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: colors.brand, background: colors.infoBgLight, borderLeft: `2px solid ${colors.brand}40`, borderTopLeftRadius: 8 }}>{t("lastMatch.gained")}</th>
                        <th title={t("lastMatch.movedTooltip", { match: lastStep!.label })} style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: colors.brand, background: colors.infoBgLight, borderRight: `2px solid ${colors.brand}40`, borderTopRightRadius: 8 }}>{t("lastMatch.moved")}</th>
                      </>
                    )}
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

      {showBarRace && (
        <BarChartRaceModal
          poolId={poolId}
          token={token}
          poolName={overview.pool.name}
          tournamentKey={overview.tournamentInstance.templateKey ?? ""}
          isMobile={isMobile}
          onClose={() => setShowBarRace(false)}
        />
      )}
    </>
  );
}
