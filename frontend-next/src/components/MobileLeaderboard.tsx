"use client";

import { colors } from "@/lib/theme";

// Componente de Leaderboard optimizado para móvil
// Sprint 3 - Mobile UX Improvements

import { useTranslations } from "next-intl";
import { mobileInteractiveStyles } from "../hooks/useIsMobile";

type LeaderboardStructuralStats = {
  positionsCorrect: number;
  positionsTotal: number;
  perfectGroups: number;
  totalGroups: number;
  winnersByPhase: Record<string, { correct: number; total: number }>;
};

type LeaderboardRow = {
  userId: string;
  displayName: string;
  role: string;
  memberStatus?: string;
  points: number;
  rank: number;
  isTied?: boolean;
  perfectCount?: number;
  partialCount?: number;
  pointsByPhase?: Record<string, number>;
  structuralStats?: LeaderboardStructuralStats;
};

type PhaseType = "STRUCTURAL_GROUP" | "STRUCTURAL_KNOCKOUT" | "SCORE";

type MobileLeaderboardProps = {
  rows: LeaderboardRow[];
  phases: string[];
  onPlayerClick: (userId: string, displayName: string, initialPhase?: string) => void;
  formatPhaseName: (phaseId: string) => string;
  formatPhaseFullName: (phaseId: string) => string;
  /** Pinned current-user row shown at top when they're not on the current page */
  pinnedRow?: LeaderboardRow;
  pinnedLabel?: string;
  /** Per-phase scoring type — drives whether each chip shows a structural counter. */
  phaseTypeByPhaseId?: Map<string, PhaseType>;
  /** True when at least one phase is structural — toggles the summary line under the name. */
  hasAnyStructural?: boolean;
  /** Which tiebreaker counters are meaningful for this pool (D4). */
  tiebreakers?: { perfect: boolean; partial: boolean };
};

export function MobileLeaderboard({
  rows,
  phases,
  onPlayerClick,
  formatPhaseName,
  formatPhaseFullName,
  pinnedRow,
  pinnedLabel,
  phaseTypeByPhaseId,
  hasAnyStructural,
  tiebreakers: tb,
}: MobileLeaderboardProps) {
  const t = useTranslations("pool");
  const leaderPoints = rows[0]?.points ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Pinned current user row */}
      {pinnedRow && (
        <div
          key={`pinned-${pinnedRow.userId}`}
          onClick={() => onPlayerClick(pinnedRow.userId, pinnedRow.displayName)}
          role="button"
          tabIndex={0}
          aria-label={`${pinnedRow.displayName} - ${pinnedRow.points} pts`}
          style={{
            background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
            border: `2px solid ${colors.brand}`,
            borderRadius: 12,
            padding: 16,
            cursor: "pointer",
            ...mobileInteractiveStyles.tapHighlight,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: colors.brand, color: colors.white, fontWeight: 800, fontSize: 14,
              }}>
                {pinnedRow.rank}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>{pinnedRow.displayName}</div>
                <div style={{ fontSize: 10, color: colors.brand, fontWeight: 600 }}>{pinnedLabel}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: colors.brand }}>{pinnedRow.points}</div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>
                -{(leaderPoints || pinnedRow.points) - pinnedRow.points} pts
              </div>
            </div>
          </div>
        </div>
      )}

      {rows.map((r, idx) => {
        const diff = leaderPoints - r.points;
        // Medal by (possibly shared) rank, not array index — ties share it.
        const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : null;
        const isTopThree = idx < 3;

        return (
          <div
            key={r.userId}
            onClick={() => onPlayerClick(r.userId, r.displayName)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPlayerClick(r.userId, r.displayName); }}}
            role="button"
            tabIndex={0}
            aria-label={`${r.displayName} - ${r.points} pts`}
            style={{
              background: isTopThree
                ? idx === 0
                  ? "linear-gradient(135deg, #fff9e6 0%, #fff3cc 100%)"
                  : idx === 1
                  ? "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)"
                  : "linear-gradient(135deg, #fff8f0 0%, #ffede0 100%)"
                : colors.white,
              border: isTopThree
                ? `2px solid ${idx === 0 ? colors.warning : idx === 1 ? colors.disabled : "#fd7e14"}`
                : "1px solid #e0e0e0",
              borderRadius: 12,
              padding: 16,
              cursor: "pointer",
              ...mobileInteractiveStyles.tapHighlight,
              transition: "transform 0.1s ease, box-shadow 0.1s ease",
            }}
          >
            {/* Header: Rank + Name + Points */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              {/* Rank Badge */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: isTopThree
                    ? idx === 0
                      ? "linear-gradient(135deg, #ffc107 0%, #ffca28 100%)"
                      : idx === 1
                      ? "linear-gradient(135deg, #adb5bd 0%, #ced4da 100%)"
                      : "linear-gradient(135deg, #fd7e14 0%, #ff922b 100%)"
                    : "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: medal ? 22 : 16,
                  color: isTopThree ? colors.white : colors.textMuted,
                  flexShrink: 0,
                  boxShadow: isTopThree ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {medal || r.rank}
              </div>

              {/* Player Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    marginBottom: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.displayName}
                </div>
                {hasAnyStructural && r.structuralStats && r.structuralStats.positionsTotal > 0 && (
                  <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                    {t("leaderboard.structuralSummary", {
                      positionsCorrect: r.structuralStats.positionsCorrect,
                      positionsTotal: r.structuralStats.positionsTotal,
                      perfectGroups: r.structuralStats.perfectGroups,
                    })}
                  </div>
                )}
                {tb && (tb.perfect || tb.partial) && (
                  <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                    {tb.perfect && <span>✓ {t("leaderboard.perfectCount", { count: r.perfectCount ?? 0 })}</span>}
                    {tb.perfect && tb.partial && <span> · </span>}
                    {tb.partial && <span>~ {t("leaderboard.partialCount", { count: r.partialCount ?? 0 })}</span>}
                    {r.isTied && <span style={{ fontWeight: 700 }}> · ={t("leaderboard.tiedShort")}</span>}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {r.role === "HOST" && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#007bff20",
                        border: "1px solid #007bff",
                        color: colors.brand,
                        fontWeight: 600,
                      }}
                    >
                      👑 {t("mobileLeaderboard.host")}
                    </span>
                  )}
                  {r.role === "CO_ADMIN" && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#28a74520",
                        border: "1px solid #28a745",
                        color: colors.success,
                        fontWeight: 600,
                      }}
                    >
                      ⭐ {t("mobileLeaderboard.coAdmin")}
                    </span>
                  )}
                  {r.memberStatus === "LEFT" && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#ef444420",
                        border: "1px solid #ef4444",
                        color: colors.errorBorderStrong,
                        fontWeight: 600,
                      }}
                    >
                      {t("mobileLeaderboard.retired")}
                    </span>
                  )}
                </div>
              </div>

              {/* Points */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 24,
                    color: colors.brand,
                    lineHeight: 1,
                  }}
                >
                  {r.points}
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  {idx === 0 ? (
                    <span style={{ color: colors.success, fontWeight: 600 }}>{t("mobileLeaderboard.leader")}</span>
                  ) : (
                    <span>-{diff} pts</span>
                  )}
                </div>
              </div>
            </div>

            {/* Phase Breakdown (horizontal scrollable) */}
            {phases.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingTop: 8,
                  borderTop: "1px solid rgba(0,0,0,0.06)",
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                {phases.map((phaseId) => {
                  const phasePoints = r.pointsByPhase?.[phaseId] ?? 0;
                  const hasPoints = phasePoints > 0;
                  // Per-phase counter chip (under the points number),
                  // driven by THIS phase's configured type — so MIXED
                  // pools show "X★" only on structural groups and
                  // "X/Y" only on structural knockouts.
                  const phaseType = phaseTypeByPhaseId?.get(phaseId);
                  let counter: string | null = null;
                  if (phaseType === "STRUCTURAL_GROUP" && r.structuralStats) {
                    counter = `${r.structuralStats.perfectGroups}★`;
                  } else if (phaseType === "STRUCTURAL_KNOCKOUT" && r.structuralStats) {
                    const k = r.structuralStats.winnersByPhase?.[phaseId];
                    if (k && k.total > 0) counter = `${k.correct}/${k.total}`;
                  }
                  const isStructuralPhase = phaseType === "STRUCTURAL_GROUP" || phaseType === "STRUCTURAL_KNOCKOUT";
                  const showChip = hasPoints || (isStructuralPhase && counter !== null);

                  return (
                    <button
                      key={phaseId}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (showChip) {
                          onPlayerClick(r.userId, r.displayName, phaseId);
                        }
                      }}
                      disabled={!showChip}
                      title={formatPhaseFullName(phaseId)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: hasPoints ? "#f8fbff" : colors.bgLight,
                        border: hasPoints ? "1px solid #007bff30" : "1px solid #e0e0e0",
                        borderRadius: 8,
                        cursor: showChip ? "pointer" : "default",
                        opacity: showChip ? 1 : 0.5,
                        minWidth: isStructuralPhase ? 58 : 50,
                        flexShrink: 0,
                        ...mobileInteractiveStyles.tapHighlight,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: colors.textMuted,
                          marginBottom: 2,
                          fontWeight: 500,
                        }}
                      >
                        {formatPhaseName(phaseId)}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: hasPoints ? 700 : 400,
                          color: hasPoints ? colors.brand : colors.disabled,
                        }}
                      >
                        {showChip ? phasePoints : "-"}
                      </span>
                      {counter && (
                        <span style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                          {counter}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {rows.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: colors.textLight,
            background: colors.bgLighter,
            borderRadius: 12,
          }}
        >
          {t("mobileLeaderboard.emptyState")}
        </div>
      )}

      {/* Scroll hint for phases */}
      {rows.length > 0 && phases.length > 3 && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: colors.textLight,
            padding: "8px 0",
          }}
        >
          ← {t("mobileLeaderboard.scrollHint")} →
        </div>
      )}
    </div>
  );
}
