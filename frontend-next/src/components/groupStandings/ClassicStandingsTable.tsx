"use client";

// Classic FIFA-style group standings table used in Estratega.
// Columns: Pos · Equipo · PJ · G · E · P · GF · GC · DG · Pts.
//
// Renders both partial (some matches still pending) and complete states.
// When the host has published an official table that differs from the
// live-computed order (override scenario), the table can be told to
// follow the publishedOrder instead — we surface a small badge so the
// player understands what they're looking at.

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { colors } from "@/lib/theme";
import type { Team } from "./types";
import type { TeamStandingRow } from "../../lib/api";

export type ClassicStandingsTableProps = {
  teams: Team[];
  standings: TeamStandingRow[];
  /** Number of matches already finalised in the group. */
  completedMatches: number;
  /** Total matches in the group (typically 6 for 4-team groups). */
  totalMatches: number;
  /**
   * Official team order published by the host (if any). When provided
   * and it diverges from the natural sort of `standings`, the table
   * follows this order and surfaces a banner explaining why.
   */
  publishedOrder?: string[] | null;
  /** Reason the host gave for the override (only set if there is one). */
  publishedReason?: string | null;
  isMobile?: boolean;
};

export function ClassicStandingsTable({
  teams,
  standings,
  completedMatches,
  totalMatches,
  publishedOrder,
  publishedReason,
  isMobile,
}: ClassicStandingsTableProps) {
  const t = useTranslations("pool");

  const teamMap = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);
  const standingsByTeamId = useMemo(
    () => new Map(standings.map((s) => [s.teamId, s])),
    [standings],
  );

  // Decide row order. If host published an override that disagrees with
  // the live-computed natural order, follow the publishedOrder. Otherwise
  // follow the calculator's position field.
  const naturalOrder = [...standings]
    .sort((a, b) => a.position - b.position)
    .map((s) => s.teamId);
  const overrideActive =
    !!publishedOrder &&
    publishedOrder.length === naturalOrder.length &&
    publishedOrder.some((id, i) => id !== naturalOrder[i]);
  const rowOrder = overrideActive ? publishedOrder! : naturalOrder;

  const isPartial = completedMatches < totalMatches && completedMatches > 0;
  const isEmpty = completedMatches === 0;

  return (
    <div>
      {/* Status banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
          fontSize: isMobile ? 11 : 12,
          color: colors.textLighter,
          gap: "0.5rem",
          flexWrap: "wrap" as const,
        }}
      >
        <span>
          {isEmpty
            ? t("groupStandings.tablePending")
            : isPartial
              ? t("groupStandings.tablePartial", { completed: completedMatches, total: totalMatches })
              : t("groupStandings.tableComplete", { total: totalMatches })}
        </span>
        {overrideActive && (
          <span
            style={{
              fontSize: isMobile ? 10 : 11,
              padding: "2px 8px",
              borderRadius: 99,
              background: colors.warningBgAmber,
              color: colors.warningDarker,
              fontWeight: 600,
            }}
            title={publishedReason ?? undefined}
          >
            ★ {t("groupStandings.tableOverridden")}
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto" as const }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse" as const,
            fontSize: isMobile ? 11 : 12,
            minWidth: isMobile ? 380 : undefined,
          }}
        >
          <thead>
            <tr>
              <Th align="center" w={26} isMobile={isMobile}>#</Th>
              <Th align="left" isMobile={isMobile}>{t("groupStandings.colTeam")}</Th>
              <Th align="center" w={isMobile ? 24 : 28} isMobile={isMobile} title={t("groupStandings.colPlayedTitle")}>{t("groupStandings.colPlayed")}</Th>
              <Th align="center" w={isMobile ? 22 : 26} isMobile={isMobile} title={t("groupStandings.colWonTitle")}>{t("groupStandings.colWon")}</Th>
              <Th align="center" w={isMobile ? 22 : 26} isMobile={isMobile} title={t("groupStandings.colDrawnTitle")}>{t("groupStandings.colDrawn")}</Th>
              <Th align="center" w={isMobile ? 22 : 26} isMobile={isMobile} title={t("groupStandings.colLostTitle")}>{t("groupStandings.colLost")}</Th>
              <Th align="center" w={isMobile ? 24 : 30} isMobile={isMobile} title={t("groupStandings.colGoalsForTitle")}>{t("groupStandings.colGoalsFor")}</Th>
              <Th align="center" w={isMobile ? 24 : 30} isMobile={isMobile} title={t("groupStandings.colGoalsAgainstTitle")}>{t("groupStandings.colGoalsAgainst")}</Th>
              <Th align="center" w={isMobile ? 28 : 32} isMobile={isMobile} title={t("groupStandings.colGoalDiffTitle")}>{t("groupStandings.colGoalDiff")}</Th>
              <Th align="center" w={isMobile ? 30 : 36} isMobile={isMobile} title={t("groupStandings.colPointsTitle")}>{t("groupStandings.colPoints")}</Th>
            </tr>
          </thead>
          <tbody>
            {rowOrder.map((teamId, i) => {
              const team = teamMap.get(teamId);
              const stats = standingsByTeamId.get(teamId);
              const position = i + 1;
              return (
                <tr
                  key={teamId}
                  style={{
                    background: position <= 2 ? colors.successBgLight : "transparent",
                    borderBottom: `1px solid ${colors.borderLight}`,
                  }}
                >
                  <Td align="center" mono><strong>{position}</strong></Td>
                  <Td align="left">
                    <span style={{ fontWeight: 500, color: colors.text }}>
                      {team?.name ?? "—"}
                    </span>
                  </Td>
                  <Td align="center" mono>{stats?.played ?? 0}</Td>
                  <Td align="center" mono>{stats?.won ?? 0}</Td>
                  <Td align="center" mono>{stats?.drawn ?? 0}</Td>
                  <Td align="center" mono>{stats?.lost ?? 0}</Td>
                  <Td align="center" mono>{stats?.goalsFor ?? 0}</Td>
                  <Td align="center" mono>{stats?.goalsAgainst ?? 0}</Td>
                  <Td align="center" mono>
                    {formatGoalDifference(stats?.goalDifference ?? 0)}
                  </Td>
                  <Td align="center" mono>
                    <strong>{stats?.points ?? 0}</strong>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  align,
  w,
  isMobile,
  title,
}: {
  children: React.ReactNode;
  align: "left" | "center";
  w?: number;
  isMobile?: boolean;
  title?: string;
}) {
  return (
    <th
      title={title}
      style={{
        textAlign: align,
        padding: isMobile ? "6px 3px" : "6px 6px",
        fontWeight: 600,
        color: colors.textLighter,
        fontSize: isMobile ? 10 : 11,
        textTransform: "uppercase" as const,
        letterSpacing: 0.5,
        width: w,
        borderBottom: `2px solid ${colors.borderLight}`,
        whiteSpace: "nowrap" as const,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  mono,
}: {
  children: React.ReactNode;
  align: "left" | "center";
  mono?: boolean;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "6px 4px",
        color: colors.text,
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
        whiteSpace: "nowrap" as const,
      }}
    >
      {children}
    </td>
  );
}

function formatGoalDifference(diff: number): string {
  if (diff > 0) return `+${diff}`;
  return String(diff);
}
