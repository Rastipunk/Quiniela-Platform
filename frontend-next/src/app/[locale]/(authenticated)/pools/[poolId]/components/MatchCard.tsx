"use client";

import { useTranslations } from "next-intl";
import { getTeamFlag, getCountryName } from "@/data/teamFlags";
import { TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import type { PoolOverview, PoolMatchCard } from "@/lib/poolTypes";
import { fmtUtc, isPlaceholder, getPlaceholderName } from "./poolHelpers";
import { PickSection } from "./PickComponents";
import { ResultSection } from "./ResultComponents";

interface MatchCardProps {
  match: PoolMatchCard;
  overview: PoolOverview;
  isMobile: boolean;
  busyPick: boolean;
  busyRes: boolean;
  userTimezone: string | null;
  allowScorePick: boolean;
  savePick: (pick: any) => Promise<void>;
  saveResult: (input: any) => Promise<void>;
  onViewBreakdown: (matchId: string, matchTitle: string) => void;
  onViewMatchPicks: (matchId: string, matchTitle: string) => void;
  onToggleScoring: (matchId: string, matchTitle: string, currentEnabled: boolean) => void;
}

export function MatchCard({
  match: m,
  overview,
  isMobile,
  busyPick,
  busyRes,
  userTimezone,
  allowScorePick,
  savePick,
  saveResult,
  onViewBreakdown,
  onViewMatchPicks,
  onToggleScoring,
}: MatchCardProps) {
  const t = useTranslations("pool");
  const isHost = overview.permissions.canManageResults;
  const tournamentKey = overview.tournamentInstance.templateKey ?? "wc_2026_sandbox";

  // Check if match has placeholders
  const homeIsPlaceholder = isPlaceholder(m.homeTeam?.id || "");
  const awayIsPlaceholder = isPlaceholder(m.awayTeam?.id || "");
  const hasAnyPlaceholder = homeIsPlaceholder || awayIsPlaceholder;

  const matchTitle = `${getCountryName(m.homeTeam?.id, tournamentKey)} vs ${getCountryName(m.awayTeam?.id, tournamentKey)}`;

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        background: hasAnyPlaceholder ? "#f8f9fa" : "#fff",
        opacity: hasAnyPlaceholder ? 0.85 : 1,
      }}
    >
      {/* Match Header with Flags or Placeholders */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: isMobile ? 8 : 16, alignItems: "center", marginBottom: isMobile ? 10 : 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          {/* Home team - flag on left or placeholder */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {homeIsPlaceholder ? (
              <>
                <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#e9ecef", borderRadius: 2, border: "1px solid #ced4da" }}>
                  <span style={{ fontSize: 14 }}>🔒</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#6c757d", fontStyle: "italic" }}>
                  {getPlaceholderName(m.homeTeam.id, t)}
                </span>
              </>
            ) : (
              <>
                {(() => {
                  const flag = getTeamFlag(m.homeTeam.id.replace("t_", ""), tournamentKey);
                  return flag?.flagUrl ? (
                    <img
                      src={flag.flagUrl}
                      alt={getCountryName(m.homeTeam.id, tournamentKey)}
                      style={{ width: 32, height: "auto", borderRadius: 2, border: "1px solid #ddd" }}
                    />
                  ) : (
                    <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 2, border: "1px solid #ddd" }}>
                      <span style={{ fontSize: 16 }}>⚽</span>
                    </div>
                  );
                })()}
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {getCountryName(m.homeTeam.id, tournamentKey)}
                </span>
              </>
            )}
          </div>
          <span style={{ fontWeight: 900, fontSize: 18, color: "#666", margin: "0 4px" }}>VS</span>
          {/* Away team - flag on right or placeholder */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {awayIsPlaceholder ? (
              <>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#6c757d", fontStyle: "italic" }}>
                  {getPlaceholderName(m.awayTeam.id, t)}
                </span>
                <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#e9ecef", borderRadius: 2, border: "1px solid #ced4da" }}>
                  <span style={{ fontSize: 14 }}>🔒</span>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {getCountryName(m.awayTeam.id, tournamentKey)}
                </span>
                {(() => {
                  const flag = getTeamFlag(m.awayTeam.id.replace("t_", ""), tournamentKey);
                  return flag?.flagUrl ? (
                    <img
                      src={flag.flagUrl}
                      alt={getCountryName(m.awayTeam.id, tournamentKey)}
                      style={{ width: 32, height: "auto", borderRadius: 2, border: "1px solid #ddd" }}
                    />
                  ) : (
                    <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 2, border: "1px solid #ddd" }}>
                      <span style={{ fontSize: 16 }}>⚽</span>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        <div style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {m.isLocked ? (
            <span style={{ padding: "4px 10px", border: "1px solid #f99", borderRadius: 999, background: "#fee" }}>
              🔒 {t("matchCard.locked")}
            </span>
          ) : (
            <span style={{ padding: "4px 10px", border: "1px solid #9f9", borderRadius: 999, background: "#efe" }}>
              ✅ {t("matchCard.open")}
            </span>
          )}
          {m.scoringEnabled === false && (
            <span style={{ padding: "4px 10px", border: "1px solid #fbbf24", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
              ⚠️ {t("scoringDisabledBadge")}
            </span>
          )}
        </div>
      </div>

      {/* Match Info: kickoff + deadline */}
      <div style={{ color: "#666", fontSize: 12, marginBottom: 12, paddingLeft: 4, display: "flex", flexDirection: "column", gap: 2 }}>
        <div>
          {m.label ?? m.roundLabel ?? t("matchCard.matchLabel", { id: m.matchNumber ?? m.id })} • {t("matchCard.kickoff")}: {fmtUtc(m.kickoffUtc, userTimezone)}
        </div>
        <div style={{ color: m.isLocked ? "#999" : "#c0392b" }}>
          {t("matchCard.deadline")}: {fmtUtc(m.deadlineUtc, userTimezone)}
        </div>
      </div>

      {/* Scoring disabled banner */}
      {m.scoringEnabled === false && (
        <div style={{
          padding: "8px 12px",
          background: "#fef3c7",
          border: "1px solid #fbbf24",
          borderRadius: 8,
          marginBottom: 10,
          fontSize: 13,
          color: "#92400e",
        }}>
          ⚠️ {t("scoringDisabledByHost")}
          {m.scoringOverrideReason && (
            <span style={{ fontStyle: "italic" }}> — {m.scoringOverrideReason}</span>
          )}
        </div>
      )}

      {/* Content: Picks and Results OR Placeholder Message */}
      {hasAnyPlaceholder ? (
        <div style={{
          padding: 20,
          background: "#fff3cd",
          border: "1px solid #ffeeba",
          borderRadius: 12,
          textAlign: "center"
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
          <div style={{ fontWeight: 700, color: "#856404", marginBottom: 4 }}>
            {t("matchCard.pendingTitle")}
          </div>
          <div style={{ fontSize: 13, color: "#856404" }}>
            {t("matchCard.pendingDesc")}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          {/* Pick */}
          <PickSection
            pick={m.myPick}
            isLocked={m.isLocked || overview.myMembership.status === "LEFT"}
            allowScorePick={allowScorePick}
            onSave={(pick: any) => savePick(pick)}
            disabled={busyPick}
            homeTeam={m.homeTeam}
            awayTeam={m.awayTeam}
            tournamentKey={tournamentKey}
          />

          {/* Result + Host */}
          <ResultSection
            result={m.result}
            isHost={isHost}
            onSave={(homeGoals, awayGoals, reason, homePenalties, awayPenalties) =>
              saveResult({
                homeGoals,
                awayGoals,
                ...(reason ? { reason } : {}),
                ...(homePenalties !== undefined ? { homePenalties } : {}),
                ...(awayPenalties !== undefined ? { awayPenalties } : {}),
              })
            }
            disabled={busyRes}
            homeTeam={m.homeTeam}
            awayTeam={m.awayTeam}
            tournamentKey={tournamentKey}
            phaseId={m.phaseId}
          />
        </div>
      )}

      {/* Botones de acción - en una sola línea */}
      {(m.isLocked && !isPlaceholder(m.homeTeam?.id ?? "") && !isPlaceholder(m.awayTeam?.id ?? "")) && (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Botón Ver Desglose - solo si hay resultado y la fase usa requiresScore */}
          {m.result && overview.pool.pickTypesConfig && (() => {
            const phaseConfig = overview.pool.pickTypesConfig?.find(
              (p) => p.phaseId === m.phaseId
            );
            return phaseConfig?.requiresScore === true;
          })() && (
            <button
              onClick={() => onViewBreakdown(m.id, matchTitle)}
              style={{
                padding: isMobile ? "10px 16px" : "6px 12px",
                borderRadius: 6,
                border: "none",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                ...mobileInteractiveStyles.tapHighlight,
              }}
            >
              {t("matchCard.viewBreakdown")}
            </button>
          )}

          {/* Botón Ver picks de otros */}
          <button
            onClick={() => onViewMatchPicks(m.id, matchTitle)}
            style={{
              padding: isMobile ? "10px 16px" : "6px 12px",
              borderRadius: 6,
              border: "1px solid #17a2b8",
              background: "#e7f6f8",
              color: "#17a2b8",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {t("matchCard.viewOtherPicks")}
          </button>

          {/* Host: Toggle scoring for this match */}
          {isHost && (
            <button
              onClick={() => onToggleScoring(m.id, matchTitle, m.scoringEnabled !== false)}
              style={{
                padding: isMobile ? "10px 16px" : "6px 12px",
                borderRadius: 6,
                border: `1px solid ${m.scoringEnabled !== false ? "#fbbf24" : "#10b981"}`,
                background: m.scoringEnabled !== false ? "#fef9c3" : "#d1fae5",
                color: m.scoringEnabled !== false ? "#92400e" : "#065f46",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                ...mobileInteractiveStyles.tapHighlight,
              }}
            >
              {m.scoringEnabled !== false ? t("scoringDisabled") : t("scoringEnabled")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
