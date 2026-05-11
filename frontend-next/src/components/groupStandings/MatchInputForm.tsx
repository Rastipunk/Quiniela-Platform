"use client";

import { colors } from "@/lib/theme";

import type { Match, Team } from "./types";
import { TOUCH_TARGET, mobileInteractiveStyles } from "../../hooks/useIsMobile";

interface MatchInputFormProps {
  matches: Match[];
  teamMap: Map<string, Team>;
  matchResults: Map<string, { homeGoals: string; awayGoals: string; saved: boolean; existsInDb: boolean }>;
  savingMatch: string | null;
  allMatchesSaved: boolean;
  generatingStandings: boolean;
  savedMatchCount: number;
  onSaveMatchResult: (matchId: string) => void;
  onUpdateMatchResult: (matchId: string, field: "homeGoals" | "awayGoals", value: string) => void;
  onGenerateStandings: () => void;
  isMobile: boolean;
  t: any;
}

export function MatchInputForm({
  matches,
  teamMap,
  matchResults,
  savingMatch,
  allMatchesSaved,
  generatingStandings,
  savedMatchCount,
  onSaveMatchResult,
  onUpdateMatchResult,
  onGenerateStandings,
  isMobile,
  t,
}: MatchInputFormProps) {
  return (
    <div>
      <div style={{ fontSize: 11, color: colors.textLighter, marginBottom: "0.5rem" }}>
        {t("groupStandings.matchesCount", { saved: savedMatchCount, total: matches.length })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "0.5rem" : "0.35rem" }}>
        {matches.map((match) => {
          const state = matchResults.get(match.id) || { homeGoals: "", awayGoals: "", saved: false, existsInDb: false };
          const homeTeam = teamMap.get(match.homeTeamId);
          const awayTeam = teamMap.get(match.awayTeamId);
          const isSaving = savingMatch === match.id;

          return (
            <div
              key={match.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? "0.5rem" : "0.35rem",
                padding: isMobile ? "0.5rem" : "0.3rem",
                background: state.saved ? colors.successBgAlt : colors.bgLighter,
                borderRadius: 6,
                border: state.saved ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
                minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
              }}
            >
              <span style={{ fontSize: isMobile ? 13 : 11, fontWeight: 500, width: isMobile ? 44 : 40, textAlign: "right" as const, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                {homeTeam?.code || homeTeam?.name?.slice(0, 3).toUpperCase()}
              </span>
              <input
                type="number"
                min="0"
                max="99"
                value={state.homeGoals}
                onChange={(e) => onUpdateMatchResult(match.id, "homeGoals", e.target.value)}
                disabled={isSaving}
                style={{ width: isMobile ? 40 : 28, padding: isMobile ? "0.4rem" : "0.15rem", fontSize: isMobile ? 16 : 12, textAlign: "center" as const, border: "1px solid #d1d5db", borderRadius: 4, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
              />
              <span style={{ fontSize: isMobile ? 12 : 10, color: colors.textLighter }}>-</span>
              <input
                type="number"
                min="0"
                max="99"
                value={state.awayGoals}
                onChange={(e) => onUpdateMatchResult(match.id, "awayGoals", e.target.value)}
                disabled={isSaving}
                style={{ width: isMobile ? 40 : 28, padding: isMobile ? "0.4rem" : "0.15rem", fontSize: isMobile ? 16 : 12, textAlign: "center" as const, border: "1px solid #d1d5db", borderRadius: 4, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
              />
              <span style={{ fontSize: isMobile ? 13 : 11, fontWeight: 500, width: isMobile ? 44 : 40, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                {awayTeam?.code || awayTeam?.name?.slice(0, 3).toUpperCase()}
              </span>
              <button
                onClick={() => onSaveMatchResult(match.id)}
                disabled={isSaving || !state.homeGoals || !state.awayGoals}
                style={{
                  padding: isMobile ? "0.4rem 0.6rem" : "0.15rem 0.3rem",
                  fontSize: isMobile ? 13 : 10,
                  fontWeight: 600,
                  background: state.saved ? colors.successAlt : isSaving ? colors.borderMedium : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: isSaving || !state.homeGoals || !state.awayGoals ? "not-allowed" : "pointer",
                  minWidth: isMobile ? 40 : 32,
                  minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                  flexShrink: 0,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {isSaving ? "..." : state.saved ? "✓" : "OK"}
              </button>
            </div>
          );
        })}
      </div>

      {allMatchesSaved && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button
            onClick={onGenerateStandings}
            disabled={generatingStandings}
            style={{
              flex: 1,
              padding: isMobile ? "12px 16px" : "0.6rem",
              fontSize: isMobile ? 15 : 13,
              fontWeight: 600,
              background: generatingStandings ? colors.borderMedium : colors.warning,
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: generatingStandings ? "not-allowed" : "pointer",
              minHeight: TOUCH_TARGET.minimum,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {generatingStandings ? t("groupStandings.generating") : t("groupStandings.generateStandings")}
          </button>
        </div>
      )}
    </div>
  );
}
