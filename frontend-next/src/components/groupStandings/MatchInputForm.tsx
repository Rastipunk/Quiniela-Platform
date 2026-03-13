"use client";

import type { Match, Team } from "./types";
import { TOUCH_TARGET, mobileInteractiveStyles } from "../../hooks/useIsMobile";

interface MatchInputFormProps {
  matches: Match[];
  teamMap: Map<string, Team>;
  matchResults: Map<string, { homeGoals: string; awayGoals: string; saved: boolean; existsInDb: boolean }>;
  savingMatch: string | null;
  errataReason: string;
  setErrataReason: (v: string) => void;
  allMatchesSaved: boolean;
  generatingStandings: boolean;
  officialResult: string[] | null;
  savedMatchCount: number;
  onSaveMatchResult: (matchId: string, reason?: string) => void;
  onUpdateMatchResult: (matchId: string, field: "homeGoals" | "awayGoals", value: string) => void;
  onGenerateStandings: () => void;
  onCancelEdit: () => void;
  isMobile: boolean;
  t: any;
}

export function MatchInputForm({
  matches,
  teamMap,
  matchResults,
  savingMatch,
  errataReason,
  setErrataReason,
  allMatchesSaved,
  generatingStandings,
  officialResult,
  savedMatchCount,
  onSaveMatchResult,
  onUpdateMatchResult,
  onGenerateStandings,
  onCancelEdit,
  isMobile,
  t,
}: MatchInputFormProps) {
  return (
    <div>
      {officialResult && (
        <div style={{
          marginBottom: "0.75rem",
          padding: "0.5rem",
          background: "#fef3c7",
          border: "1px solid #fcd34d",
          borderRadius: 6,
          fontSize: 11,
          color: "#92400e"
        }}>
          <strong>{t("groupStandings.correctionMode")}</strong> {t("groupStandings.correctionModeDesc")}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: "0.5rem" }}>
        {t("groupStandings.matchesCount", { saved: savedMatchCount, total: matches.length })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "0.5rem" : "0.35rem" }}>
        {matches.map((match) => {
          const state = matchResults.get(match.id) || { homeGoals: "", awayGoals: "", saved: false, existsInDb: false };
          const homeTeam = teamMap.get(match.homeTeamId);
          const awayTeam = teamMap.get(match.awayTeamId);
          const isSaving = savingMatch === match.id;
          // Necesita reason si el resultado ya existe en la DB
          const needsReason = state.existsInDb;

          return (
            <div
              key={match.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? "0.5rem" : "0.35rem",
                padding: isMobile ? "0.5rem" : "0.3rem",
                background: state.saved ? "#f0fdf4" : "#f9fafb",
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
              <span style={{ fontSize: isMobile ? 12 : 10, color: "#9ca3af" }}>-</span>
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
                onClick={() => onSaveMatchResult(match.id, needsReason ? errataReason : undefined)}
                disabled={isSaving || !state.homeGoals || !state.awayGoals || (needsReason && !errataReason.trim())}
                title={needsReason && !errataReason.trim() ? t("groupStandings.needsReasonTooltip") : undefined}
                style={{
                  padding: isMobile ? "0.4rem 0.6rem" : "0.15rem 0.3rem",
                  fontSize: isMobile ? 13 : 10,
                  fontWeight: 600,
                  background: state.saved ? "#10b981" : isSaving ? "#d1d5db" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: isSaving || !state.homeGoals || !state.awayGoals || (needsReason && !errataReason.trim()) ? "not-allowed" : "pointer",
                  minWidth: isMobile ? 40 : 32,
                  minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                  opacity: (needsReason && !errataReason.trim()) ? 0.5 : 1,
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

      {/* Campo de razon para errata (solo cuando hay partidos que ya existen en DB) */}
      {Array.from(matchResults.values()).some(s => s.existsInDb) && (
        <div style={{ marginTop: "0.75rem" }}>
          <label style={{ display: "block", fontSize: isMobile ? 13 : 11, color: "#6b7280", marginBottom: "0.25rem" }}>
            {t("groupStandings.correctionReasonLabel")}
          </label>
          <input
            type="text"
            value={errataReason}
            onChange={(e) => setErrataReason(e.target.value)}
            placeholder={t("groupStandings.correctionReasonPlaceholder")}
            style={{
              width: "100%",
              padding: isMobile ? "0.6rem" : "0.4rem",
              fontSize: isMobile ? 14 : 12,
              border: "1px solid #fcd34d",
              borderRadius: 6,
              background: "#fffbeb",
              minHeight: TOUCH_TARGET.minimum,
            }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
        {officialResult && (
          <button
            onClick={onCancelEdit}
            style={{
              flex: 1,
              padding: isMobile ? "12px 16px" : "0.6rem",
              fontSize: isMobile ? 15 : 13,
              fontWeight: 600,
              background: "#f3f4f6",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              cursor: "pointer",
              minHeight: TOUCH_TARGET.minimum,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {t("groupStandings.cancel")}
          </button>
        )}
        {allMatchesSaved && (
          <button
            onClick={onGenerateStandings}
            disabled={generatingStandings}
            style={{
              flex: 1,
              padding: isMobile ? "12px 16px" : "0.6rem",
              fontSize: isMobile ? 15 : 13,
              fontWeight: 600,
              background: generatingStandings ? "#d1d5db" : "#f59e0b",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: generatingStandings ? "not-allowed" : "pointer",
              minHeight: TOUCH_TARGET.minimum,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {generatingStandings ? t("groupStandings.generating") : officialResult ? t("groupStandings.regenerateStandings") : t("groupStandings.generateStandings")}
          </button>
        )}
      </div>
    </div>
  );
}
