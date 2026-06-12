"use client";

// Pending-picks banner (Partidos tab): lists EXACTLY which matches the
// player still hasn't predicted among those closing in the next 24 h —
// teams, group/round, deadline and kickoff in the user's timezone.
// Mobile-first: stacked full-width rows, 44px touch targets. Lines
// disappear as picks are saved (the list derives live from the
// overview) and the whole banner vanishes when nothing is pending.
// Tapping a row focuses that match in the list below (handled by the
// parent via onSelect).

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { colors, radii } from "@/lib/theme";
import { getTeamFlag } from "@/data/teamFlags";
import { TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import type { PoolMatchCard } from "@/lib/poolTypes";
import { fmtUtc, getMatchLabel, getTeamName } from "./poolHelpers";

/** Rows shown before collapsing behind the "+N more" expander. */
const VISIBLE_ROWS = 4;

export function PendingPicksBanner(props: {
  matches: PoolMatchCard[];
  tournamentKey: string;
  userTimezone: string | null;
  isMobile: boolean;
  onSelect: (matchId: string, phaseId: string) => void;
}) {
  const t = useTranslations("pool");
  const tTeams = useTranslations("teams");
  const locale = useLocale();
  const [showAll, setShowAll] = useState(false);

  const { matches } = props;
  if (matches.length === 0) return null;

  const visible = showAll ? matches : matches.slice(0, VISIBLE_ROWS);
  const hiddenCount = matches.length - visible.length;

  return (
    <div
      style={{
        marginTop: 14,
        padding: "12px 14px",
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        borderRadius: 12,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, color: "#1d4ed8", marginBottom: 8 }}>
        ⏰ {matches.length > 1
          ? t("pendingPicks.titlePlural", { count: matches.length })
          : t("pendingPicks.title")}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {visible.map((m: any) => {
          const homeName = getTeamName(m.homeTeam, tTeams);
          const awayName = getTeamName(m.awayTeam, tTeams);
          const homeFlag = getTeamFlag(m.homeTeam?.id?.replace("t_", "") ?? "", props.tournamentKey);
          const awayFlag = getTeamFlag(m.awayTeam?.id?.replace("t_", "") ?? "", props.tournamentKey);

          return (
            <button
              key={m.id}
              onClick={() => props.onSelect(m.id, m.phaseId)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                width: "100%",
                minHeight: TOUCH_TARGET.minimum,
                padding: "8px 10px",
                background: colors.white,
                border: "1px solid #bfdbfe",
                borderRadius: radii.lg,
                cursor: "pointer",
                textAlign: "left",
                ...mobileInteractiveStyles.tapHighlight,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, fontWeight: 700, color: colors.textDark }}>
                {homeFlag?.flagUrl && (
                  <img src={homeFlag.flagUrl} alt={homeName} width={20} height={15} loading="lazy" style={{ width: 20, height: "auto", borderRadius: 2, border: "1px solid #ddd" }} />
                )}
                {homeName}
                <span style={{ color: colors.textLight, fontWeight: 500 }}>vs</span>
                {awayName}
                {awayFlag?.flagUrl && (
                  <img src={awayFlag.flagUrl} alt={awayName} width={20} height={15} loading="lazy" style={{ width: 20, height: "auto", borderRadius: 2, border: "1px solid #ddd" }} />
                )}
              </span>
              <span style={{ fontSize: 12, color: colors.textMuted }}>
                {getMatchLabel(m, t)} · {t("pendingPicks.plays", { time: fmtUtc(m.kickoffUtc, props.userTimezone, locale) })}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#b45309" }}>
                ⏳ {t("pendingPicks.closes", { time: fmtUtc(m.deadlineUtc, props.userTimezone, locale) })}
              </span>
            </button>
          );
        })}
      </div>

      {(hiddenCount > 0 || showAll) && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            marginTop: 8,
            width: "100%",
            minHeight: TOUCH_TARGET.minimum,
            padding: "8px 10px",
            background: "transparent",
            border: "1px dashed #93c5fd",
            borderRadius: radii.lg,
            color: "#1d4ed8",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            ...mobileInteractiveStyles.tapHighlight,
          }}
        >
          {showAll
            ? t("pendingPicks.showLess")
            : t("pendingPicks.showMore", { count: hiddenCount })}
        </button>
      )}
    </div>
  );
}
