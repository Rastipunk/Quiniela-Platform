"use client";

// Stats tab (ADR-088): sortable per-player metrics table, aligned with THIS
// pool's scoring config — only criteria the pool actually grades become
// columns, tallied per phase where enabled (backend accumulates them inside
// the same cached leaderboard pass, so this view adds zero compute).

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { colors, radii } from "@/lib/theme";
import type { PoolOverview, LeaderboardRow } from "@/lib/poolTypes";
import { PlayerSummary } from "@/components/PlayerSummary";
import type { PlayerSummaryModalData } from "./poolTypes";

/** Canonical column order — mirrors the scoring editor's criterion order. */
const CRITERIA_ORDER = [
  "MATCH_OUTCOME_90MIN",
  "EXACT_SCORE",
  "HOME_GOALS",
  "AWAY_GOALS",
  "GOAL_DIFFERENCE",
  "TOTAL_GOALS",
  "PARTIAL_SCORE",
] as const;

const CRITERIA_ICONS: Record<string, string> = {
  MATCH_OUTCOME_90MIN: "✅",
  EXACT_SCORE: "🎯",
  HOME_GOALS: "🏠",
  AWAY_GOALS: "✈️",
  GOAL_DIFFERENCE: "➖",
  TOTAL_GOALS: "🔢",
  PARTIAL_SCORE: "🧩",
};

interface Column {
  key: string;
  icon: string;
  /** Full name (tooltip + legend). */
  label: string;
  /** Numeric sort value for a row. */
  value: (r: LeaderboardRow) => number;
  /** Rendered cell text. */
  render: (r: LeaderboardRow) => string;
}

interface PoolStatsTabProps {
  overview: PoolOverview;
  poolId: string;
  isMobile: boolean;
}

export function PoolStatsTab({ overview, poolId, isMobile }: PoolStatsTabProps) {
  const t = useTranslations("pool");
  const [sortKey, setSortKey] = useState<string>("rank");
  const [sortDesc, setSortDesc] = useState(false);
  const [playerModal, setPlayerModal] = useState<PlayerSummaryModalData | null>(null);

  const rows = overview.leaderboard?.rows ?? [];
  const presetMode = overview.leaderboard?.presetMode ?? "SCORE";
  const showScore = presetMode !== "STRUCTURAL";
  const showStructural = presetMode !== "SCORE";
  const myUserId = overview.myMembership?.userId;

  // Criteria this pool actually grades — union across its score phases.
  const enabledCriteria = useMemo(() => {
    const cfgs = (overview.pool.pickTypesConfig ?? []) as Array<{
      requiresScore?: boolean;
      matchPicks?: { types?: Array<{ key: string; enabled: boolean }> } | null;
    }>;
    const enabled = new Set<string>();
    for (const c of cfgs) {
      if (!c.requiresScore || !c.matchPicks?.types) continue;
      for (const type of c.matchPicks.types) if (type.enabled) enabled.add(type.key);
    }
    return CRITERIA_ORDER.filter((k) => enabled.has(k));
  }, [overview.pool.pickTypesConfig]);

  const columns = useMemo<Column[]>(() => {
    const cols: Column[] = [
      {
        key: "points",
        icon: "🏆",
        label: t("statsTab.colPoints"),
        value: (r) => r.points,
        render: (r) => String(r.points),
      },
    ];
    if (showScore) {
      cols.push({
        key: "predicted",
        icon: "📝",
        label: t("statsTab.colPredicted"),
        value: (r) => r.stats?.predicted ?? 0,
        render: (r) => (r.stats ? `${r.stats.predicted}/${r.stats.predictable}` : "—"),
      });
      // Universal exact-scoreline tally; skipped when the pool grades
      // EXACT_SCORE as a criterion (identical number → one column).
      if (!enabledCriteria.includes("EXACT_SCORE")) {
        cols.push({
          key: "exact",
          icon: "🎯",
          label: t("statsTab.colExact"),
          value: (r) => r.stats?.exactScorelines ?? 0,
          render: (r) => String(r.stats?.exactScorelines ?? 0),
        });
      }
      for (const key of enabledCriteria) {
        cols.push({
          key,
          icon: CRITERIA_ICONS[key] ?? "•",
          label: t(`pickTypeNames.${key}` as Parameters<typeof t>[0]),
          value: (r) => r.stats?.criteria?.[key]?.hits ?? 0,
          render: (r) => String(r.stats?.criteria?.[key]?.hits ?? 0),
        });
      }
      cols.push({
        key: "effectiveness",
        icon: "⚡",
        label: t("statsTab.colEffectiveness"),
        value: (r) =>
          r.stats && r.stats.gradedMaxPoints > 0
            ? (r.matchPickPoints ?? 0) / r.stats.gradedMaxPoints
            : 0,
        render: (r) =>
          r.stats && r.stats.gradedMaxPoints > 0
            ? `${Math.round(((r.matchPickPoints ?? 0) / r.stats.gradedMaxPoints) * 100)}%`
            : "—",
      });
    }
    if (showStructural) {
      cols.push(
        {
          key: "positions",
          icon: "📋",
          label: t("statsTab.colPositions"),
          value: (r) => r.structuralStats?.positionsCorrect ?? 0,
          render: (r) =>
            r.structuralStats
              ? `${r.structuralStats.positionsCorrect}/${r.structuralStats.positionsTotal}`
              : "—",
        },
        {
          key: "perfectGroups",
          icon: "💯",
          label: t("statsTab.colPerfectGroups"),
          value: (r) => r.structuralStats?.perfectGroups ?? 0,
          render: (r) => String(r.structuralStats?.perfectGroups ?? 0),
        },
        {
          key: "winners",
          icon: "🏁",
          label: t("statsTab.colWinners"),
          value: (r) =>
            Object.values(r.structuralStats?.winnersByPhase ?? {}).reduce(
              (s, w) => s + w.correct,
              0,
            ),
          render: (r) => {
            const w = Object.values(r.structuralStats?.winnersByPhase ?? {});
            if (w.length === 0) return "—";
            const correct = w.reduce((s, x) => s + x.correct, 0);
            const total = w.reduce((s, x) => s + x.total, 0);
            return `${correct}/${total}`;
          },
        },
      );
    }
    return cols;
  }, [showScore, showStructural, enabledCriteria, t]);

  const sorted = useMemo(() => {
    const list = [...rows];
    if (sortKey === "rank") {
      list.sort((a, b) => (sortDesc ? b.rank - a.rank : a.rank - b.rank));
    } else {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        list.sort((a, b) =>
          sortDesc ? col.value(b) - col.value(a) : col.value(a) - col.value(b),
        );
      }
    }
    return list;
  }, [rows, columns, sortKey, sortDesc]);

  const onSort = (key: string) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      // Metrics read best highest-first; rank reads best 1-first.
      setSortDesc(key !== "rank");
    }
  };

  const arrow = (key: string) => (sortKey === key ? (sortDesc ? " ▼" : " ▲") : "");

  const headerCell = (
    key: string,
    content: string,
    title: string,
    sticky = false,
  ) => (
    <th
      key={key}
      title={title}
      onClick={() => onSort(key)}
      style={{
        padding: isMobile ? "12px 8px" : "10px 12px",
        fontSize: 11,
        fontWeight: 700,
        color: sortKey === key ? colors.brand : colors.textMuted,
        cursor: "pointer",
        whiteSpace: "nowrap",
        textAlign: sticky ? "left" : "center",
        userSelect: "none",
        position: sticky ? "sticky" : undefined,
        left: sticky ? 0 : undefined,
        background: colors.bgLight,
        zIndex: sticky ? 2 : 1,
      }}
    >
      {content}
      {arrow(key)}
    </th>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "14px 2px 4px" }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>🎯 {t("statsTab.title")}</h3>
        <span style={{ fontSize: 12, color: colors.textLight }}>{t("statsTab.sortHint")}</span>
      </div>

      <div
        style={{
          marginTop: 8,
          border: `1px solid ${colors.borderLight}`,
          borderRadius: radii.lg,
          overflowX: "auto",
          background: colors.white,
        }}
      >
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: isMobile ? 520 : 720 }}>
          <thead>
            <tr style={{ background: colors.bgLight }}>
              {headerCell("rank", "#", t("statsTab.colRank"))}
              {headerCell("player", t("statsTab.colPlayer"), t("statsTab.colPlayer"), true)}
              {columns.map((c) => headerCell(c.key, c.icon, c.label))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isMe = r.userId === myUserId;
              return (
                <tr
                  key={r.userId}
                  onClick={() => setPlayerModal({ userId: r.userId, displayName: r.displayName })}
                  style={{
                    borderTop: `1px solid ${colors.borderLighter}`,
                    background: isMe ? "#eef2ff" : colors.white,
                    cursor: "pointer",
                  }}
                >
                  <td style={{ padding: isMobile ? "12px 8px" : "10px 12px", fontSize: 12, textAlign: "center", color: colors.textMuted, fontWeight: 700 }}>
                    {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
                  </td>
                  <td
                    style={{
                      padding: isMobile ? "12px 8px" : "10px 12px",
                      fontSize: 13,
                      fontWeight: isMe ? 800 : 600,
                      color: isMe ? colors.brand : colors.text,
                      whiteSpace: "nowrap",
                      maxWidth: isMobile ? 120 : 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      position: "sticky",
                      left: 0,
                      background: isMe ? "#eef2ff" : colors.white,
                      zIndex: 1,
                    }}
                  >
                    {r.displayName}
                    {isMe ? ` ${t("statsTab.youMark")}` : ""}
                  </td>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        padding: isMobile ? "12px 8px" : "10px 12px",
                        fontSize: 13,
                        textAlign: "center",
                        fontWeight: sortKey === c.key ? 800 : 500,
                        color: sortKey === c.key ? colors.brand : colors.text,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend: icon → full criterion name */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "10px 2px 0", fontSize: 11, color: colors.textMuted }}>
        {columns.map((c) => (
          <span key={c.key} style={{ whiteSpace: "nowrap" }}>
            {c.icon} {c.label}
          </span>
        ))}
      </div>

      {/* Player summary modal — same sheet the leaderboard opens. */}
      {playerModal && (
        <div
          onClick={() => setPlayerModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: colors.white, borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "92vh", overflowY: "auto" }}
          >
            <PlayerSummary
              poolId={poolId}
              userId={playerModal.userId}
              tournamentKey={overview.tournamentInstance.templateKey ?? "wc_2026_sandbox"}
              onClose={() => setPlayerModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
