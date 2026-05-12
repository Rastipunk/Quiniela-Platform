"use client";

// frontend-next/src/components/PlayerSummaryStructural.tsx
//
// Estratega-specific blocks for the PlayerSummary modal. The original
// score-based PlayerSummary renders Pick/Result columns with marker
// scores (`2-1` vs `2-3`); those have no meaning in Estratega where
// only the team ORDER and the WINNER matter. These components replace
// those blocks for SIMPLE-preset pools.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { colors } from "@/lib/theme";
import { TeamFlag } from "./TeamFlag";
import { TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";
import type {
  StructuralGroupDetail,
  StructuralKnockoutDetail,
} from "../lib/api/scoring";

// Anchor color for a "correct" pick. The same green is used for ✓ marks
// across the modal so the visual language stays consistent.
const OK_GREEN = "#16a34a";
const MISS_RED = "#dc2626";
const PERFECT_AMBER = "#f59e0b";

// ── Group standings comparison ────────────────────────────────────────
// Side-by-side table: Pos / Tu predicción / Resultado for one group.
// Empty state (no prediction yet): renders a single placeholder row.
// Hidden state (opponent + deadline not passed): renders the lock badge
// and hides the predicted column entirely.

type GroupOrderComparisonProps = {
  group: StructuralGroupDetail;
  tournamentKey: string;
  isMobile: boolean;
};

function GroupOrderComparison({ group, tournamentKey, isMobile }: GroupOrderComparisonProps) {
  const t = useTranslations("pool.playerSummaryView");
  const { predictedTeamIds, actualTeamIds, isPerfect, isPredictionVisible, positionsCorrect, positionsTotal, points } = group;

  const positionCount = Math.max(predictedTeamIds.length, actualTeamIds?.length ?? 0, 4);
  const rows: number[] = Array.from({ length: positionCount }, (_, i) => i);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: isMobile ? 12 : 14, marginBottom: 10, background: colors.white }}>
      {/* Header: group name + points + perfect badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15 }}>{group.groupName}</span>
          {isPerfect && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              padding: "2px 8px", borderRadius: 12,
              background: "#fffbeb", color: PERFECT_AMBER,
              border: `1px solid ${PERFECT_AMBER}`,
            }}>
              ★ {t("perfectGroup")}
            </span>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: colors.brand, lineHeight: 1 }}>
            {points} <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 500 }}>pts</span>
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            {isPredictionVisible
              ? t("positionsHit", { correct: positionsCorrect, total: positionsTotal })
              : t("predictionHidden")}
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isPredictionVisible ? "32px 1fr 1fr 28px" : "32px 1fr 28px",
        gap: 0,
        fontSize: isMobile ? 12 : 13,
        borderTop: "1px solid #f0f0f0",
      }}>
        {/* Header row */}
        <HeaderCell>{t("headerPos")}</HeaderCell>
        {isPredictionVisible && <HeaderCell>{t("headerYourPrediction")}</HeaderCell>}
        <HeaderCell>{t("headerActual")}</HeaderCell>
        <HeaderCell />

        {rows.map((i) => {
          const predTeamId = predictedTeamIds[i];
          const actualTeamId = actualTeamIds?.[i];
          const matched = isPredictionVisible && predTeamId && actualTeamId && predTeamId === actualTeamId;
          const rowBg = matched ? "#f0fdf4" : "transparent";
          return (
            <div key={i} style={{ display: "contents" }}>
              <Cell bg={rowBg} center>{i + 1}</Cell>
              {isPredictionVisible && (
                <Cell bg={rowBg}>
                  {predTeamId ? (
                    <TeamFlag teamId={predTeamId} tournamentKey={tournamentKey} size="sm" showName={true} />
                  ) : (
                    <span style={{ color: colors.textLight, fontSize: 11 }}>{t("noPick")}</span>
                  )}
                </Cell>
              )}
              <Cell bg={rowBg}>
                {actualTeamId ? (
                  <TeamFlag teamId={actualTeamId} tournamentKey={tournamentKey} size="sm" showName={true} />
                ) : (
                  <span style={{ color: colors.textLight, fontSize: 11 }}>{t("notDecidedYet")}</span>
                )}
              </Cell>
              <Cell bg={rowBg} center>
                {!isPredictionVisible
                  ? <span style={{ color: colors.textLight }}>—</span>
                  : matched
                    ? <span style={{ color: OK_GREEN, fontWeight: 700 }}>✓</span>
                    : (predTeamId && actualTeamId)
                      ? <span style={{ color: MISS_RED, fontWeight: 700 }}>✗</span>
                      : <span style={{ color: colors.textLight }}>—</span>}
              </Cell>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeaderCell({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{
      padding: "8px 6px",
      fontSize: 10,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.03em",
      color: colors.textMuted,
      background: "#f9fafb",
      borderBottom: "1px solid #e5e7eb",
    }}>
      {children}
    </div>
  );
}

function Cell({ children, bg, center }: { children: React.ReactNode; bg?: string; center?: boolean }) {
  return (
    <div style={{
      padding: "8px 6px",
      background: bg,
      borderBottom: "1px solid #f0f0f0",
      display: "flex",
      alignItems: "center",
      justifyContent: center ? "center" : "flex-start",
    }}>
      {children}
    </div>
  );
}

// ── Knockout winner comparison ────────────────────────────────────────
// One card per match: HOME vs AWAY, predicted winner badge, actual
// winner badge, ✓/✗ and points earned. No scores — only winners.

type KnockoutMatchComparisonProps = {
  match: StructuralKnockoutDetail;
  tournamentKey: string;
  isMobile: boolean;
};

function KnockoutMatchComparison({ match, tournamentKey, isMobile }: KnockoutMatchComparisonProps) {
  const t = useTranslations("pool.playerSummaryView");
  const { homeTeam, awayTeam, predictedWinnerId, actualWinnerId, isCorrect, points, isPredictionVisible } = match;
  const decided = !!actualWinnerId;

  let resultLabel: React.ReactNode;
  if (!decided) {
    resultLabel = (
      <span style={{ color: colors.textMuted, fontSize: 12 }}>{t("matchUpcoming")}</span>
    );
  } else if (!isPredictionVisible) {
    resultLabel = (
      <span style={{ color: colors.textMuted, fontSize: 12 }}>—</span>
    );
  } else if (!predictedWinnerId) {
    resultLabel = (
      <span style={{ color: MISS_RED, fontSize: 12, fontWeight: 700 }}>{t("noPick")}</span>
    );
  } else {
    resultLabel = (
      <span style={{ color: isCorrect ? OK_GREEN : MISS_RED, fontWeight: 700, fontSize: 14 }}>
        {isCorrect ? `✓ +${points}` : "✗ 0"}
      </span>
    );
  }

  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: isMobile ? 10 : 12,
      marginBottom: 8,
      background: isCorrect && decided ? "#f0fdf4" : colors.white,
    }}>
      {/* Top row: matchup */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <TeamFlag teamId={homeTeam.id} tournamentKey={tournamentKey} size="sm" showName={true} reverseOrder />
        </div>
        <span style={{ color: colors.textLight, fontSize: 11, fontWeight: 600 }}>vs</span>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <TeamFlag teamId={awayTeam.id} tournamentKey={tournamentKey} size="sm" showName={true} />
        </div>
      </div>

      {/* Pick + winner + result */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto",
        gap: 8,
        alignItems: "center",
        paddingTop: 8,
        borderTop: "1px solid #f0f0f0",
        fontSize: isMobile ? 12 : 13,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: colors.textMuted, marginBottom: 4 }}>
            {t("yourPick")}
          </div>
          {isPredictionVisible
            ? predictedWinnerId
              ? <TeamFlag teamId={predictedWinnerId} tournamentKey={tournamentKey} size="sm" showName={true} />
              : <span style={{ color: colors.textLight }}>{t("noPick")}</span>
            : <span style={{ color: colors.textLight }}>{t("predictionHidden")}</span>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: colors.textMuted, marginBottom: 4 }}>
            {t("winner")}
          </div>
          {decided
            ? <TeamFlag teamId={actualWinnerId!} tournamentKey={tournamentKey} size="sm" showName={true} />
            : <span style={{ color: colors.textLight }}>{t("notDecidedYet")}</span>}
        </div>
        <div style={{ textAlign: "right" }}>{resultLabel}</div>
      </div>
    </div>
  );
}

// ── Structural phase section ──────────────────────────────────────────
// Collapsible block: phase header + counters + the group/match list.

type StructuralPhaseSectionProps = {
  phaseId: string;
  phaseName: string;
  phaseType: "GROUP_STANDINGS" | "KNOCKOUT_WINNER";
  points: number;
  positionsCorrect?: number;
  positionsTotal?: number;
  perfectGroups?: number;
  totalGroups?: number;
  winnersCorrect?: number;
  totalMatches?: number;
  groups: StructuralGroupDetail[];
  knockoutMatches: StructuralKnockoutDetail[];
  defaultExpanded?: boolean;
  tournamentKey: string;
  isMobile: boolean;
};

export function StructuralPhaseSection({
  phaseId,
  phaseName,
  phaseType,
  points,
  positionsCorrect,
  positionsTotal,
  perfectGroups,
  totalGroups,
  winnersCorrect,
  totalMatches,
  groups,
  knockoutMatches,
  defaultExpanded,
  tournamentKey,
  isMobile,
}: StructuralPhaseSectionProps) {
  const t = useTranslations("pool.playerSummaryView");
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  const subtitle = phaseType === "GROUP_STANDINGS"
    ? t("phaseSubtitleGroups", {
        positionsCorrect: positionsCorrect ?? 0,
        positionsTotal: positionsTotal ?? 0,
        perfectGroups: perfectGroups ?? 0,
        totalGroups: totalGroups ?? 0,
      })
    : t("phaseSubtitleKnockout", {
        correct: winnersCorrect ?? 0,
        total: totalMatches ?? 0,
      });

  const phaseGroups = groups.filter((g) => g.phaseId === phaseId);
  const phaseMatches = knockoutMatches.filter((m) => m.phaseId === phaseId);

  return (
    <div style={{ marginBottom: 16, border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: isMobile ? "14px 12px" : "12px 16px",
          backgroundColor: colors.bgLight,
          cursor: "pointer",
          borderBottom: expanded ? "1px solid #ddd" : "none",
          minHeight: isMobile ? TOUCH_TARGET.comfortable : undefined,
          ...mobileInteractiveStyles.tapHighlight,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
          <span style={{ fontSize: isMobile ? 14 : 18 }}>{expanded ? "▼" : "▶"}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: isMobile ? 14 : 16 }}>{phaseName}</div>
            <div style={{ fontSize: isMobile ? 11 : 12, color: colors.textMuted }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: isMobile ? 18 : 20, color: colors.brand }}>{points} pts</div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: isMobile ? 8 : 12, background: "#fafafa" }}>
          {phaseType === "GROUP_STANDINGS"
            ? phaseGroups.length === 0
              ? <EmptyMsg>{t("noGroups")}</EmptyMsg>
              : phaseGroups.map((g) => (
                  <GroupOrderComparison key={g.groupId} group={g} tournamentKey={tournamentKey} isMobile={isMobile} />
                ))
            : phaseMatches.length === 0
              ? <EmptyMsg>{t("noKnockoutMatches")}</EmptyMsg>
              : phaseMatches.map((m) => (
                  <KnockoutMatchComparison key={m.matchId} match={m} tournamentKey={tournamentKey} isMobile={isMobile} />
                ))}
        </div>
      )}
    </div>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
      {children}
    </div>
  );
}

