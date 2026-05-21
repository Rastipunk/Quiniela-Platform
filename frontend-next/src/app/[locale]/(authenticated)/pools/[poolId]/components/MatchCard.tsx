"use client";

import { useTranslations, useLocale } from "next-intl";
import { getTeamFlag, getCountryName } from "@/data/teamFlags";
import { TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import type { PoolOverview, PoolMatchCard } from "@/lib/poolTypes";
import { fmtUtc, isPlaceholder, getPlaceholderName } from "./poolHelpers";
import { colors } from "@/lib/theme";
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
  // Locale captured so `fmtUtc` can render dates with the user's month
  // abbreviation + AM/PM convention. Pre-fix `fmtUtc` always defaulted
  // to `"es"`, leaking "11 jun 2026" into EN/PT UIs (I18N_AUDIT F-2).
  const locale = useLocale();
  const isHost = overview.permissions.canManageResults;
  const tournamentKey = overview.tournamentInstance.templateKey ?? "wc_2026_sandbox";

  // Check if match has placeholders
  const homeIsPlaceholder = isPlaceholder(m.homeTeam?.id || "");
  const awayIsPlaceholder = isPlaceholder(m.awayTeam?.id || "");
  const hasAnyPlaceholder = homeIsPlaceholder || awayIsPlaceholder;

  // Always prefer team.name from API; fall back to static mapping only if missing
  const homeName = m.homeTeam?.name || getCountryName(m.homeTeam?.id, tournamentKey);
  const awayName = m.awayTeam?.name || getCountryName(m.awayTeam?.id, tournamentKey);
  const matchTitle = `${homeName} vs ${awayName}`;

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        background: hasAnyPlaceholder ? colors.bgLight : colors.white,
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
                <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: colors.borderLighter, borderRadius: 2, border: "1px solid #ced4da" }}>
                  <span style={{ fontSize: 14 }}>🔒</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: colors.textMuted, fontStyle: "italic" }}>
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
                      alt={homeName}
                      width={32}
                      height={24}
                      loading="lazy"
                      decoding="async"
                      style={{ width: 32, height: "auto", borderRadius: 2, border: "1px solid #ddd" }}
                    />
                  ) : (
                    <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: colors.bgLight, borderRadius: 2, border: "1px solid #ddd" }}>
                      <span style={{ fontSize: 16 }}>⚽</span>
                    </div>
                  );
                })()}
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {homeName}
                </span>
              </>
            )}
          </div>
          <span style={{ fontWeight: 900, fontSize: 18, color: colors.textMuted, margin: "0 4px" }}>VS</span>
          {/* Away team - flag on right or placeholder */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {awayIsPlaceholder ? (
              <>
                <span style={{ fontSize: 14, fontWeight: 500, color: colors.textMuted, fontStyle: "italic" }}>
                  {getPlaceholderName(m.awayTeam.id, t)}
                </span>
                <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: colors.borderLighter, borderRadius: 2, border: "1px solid #ced4da" }}>
                  <span style={{ fontSize: 14 }}>🔒</span>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {awayName}
                </span>
                {(() => {
                  const flag = getTeamFlag(m.awayTeam.id.replace("t_", ""), tournamentKey);
                  return flag?.flagUrl ? (
                    <img
                      src={flag.flagUrl}
                      alt={awayName}
                      width={32}
                      height={24}
                      loading="lazy"
                      decoding="async"
                      style={{ width: 32, height: "auto", borderRadius: 2, border: "1px solid #ddd" }}
                    />
                  ) : (
                    <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: colors.bgLight, borderRadius: 2, border: "1px solid #ddd" }}>
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
            <span style={{ padding: "4px 10px", border: "1px solid #fbbf24", borderRadius: 999, background: colors.warningBgAmber, color: colors.warningDarker, fontWeight: 600 }}>
              ⚠️ {t("scoringDisabledBadge")}
            </span>
          )}
          {m.isLive && (() => {
            // Status palette: live (green), halftime (amber), final/awaiting (slate)
            const status = m.matchStatus ?? "";
            const isHalftime = status === "HT";
            // AWAITING_FINISH (post-FT, in grace period) → "Final"
            const isAwaitingFinal = m.matchSyncStatus === "AWAITING_FINISH" || ["FT", "AET", "PEN"].includes(status);
            const palette = isHalftime
              ? { bg: "#fef3c7", border: "#fbbf24", fg: "#92400e", dot: "#f59e0b" }
              : isAwaitingFinal
                ? { bg: "#f1f5f9", border: "#cbd5e1", fg: "#475569", dot: "#64748b" }
                : { bg: "#dcfce7", border: "#22c55e", fg: "#166534", dot: "#16a34a" };
            const label = isHalftime
              ? t("result.halftime")
              : isAwaitingFinal
                ? t("result.final")
                : t("result.live");
            return (
              <span style={{
                padding: "4px 10px",
                border: `1px solid ${palette.border}`,
                borderRadius: 999,
                background: palette.bg,
                color: palette.fg,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: palette.dot,
                  animation: isAwaitingFinal ? "none" : "pulse 1.6s ease-in-out infinite",
                  flexShrink: 0,
                }} />
                {label}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Match Info: kickoff + deadline */}
      <div style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12, paddingLeft: 4, display: "flex", flexDirection: "column", gap: 2 }}>
        <div>
          {m.label ?? m.roundLabel ?? t("matchCard.matchLabel", { id: m.matchNumber ?? m.id })} • {t("matchCard.kickoff")}: {fmtUtc(m.kickoffUtc, userTimezone, locale)}
        </div>
        <div style={{ color: m.isLocked ? colors.textLight : "#c0392b" }}>
          {t("matchCard.deadline")}: {fmtUtc(m.deadlineUtc, userTimezone, locale)}
        </div>
      </div>

      {/* Scoring disabled banner */}
      {m.scoringEnabled === false && (
        <div style={{
          padding: "8px 12px",
          background: colors.warningBgAmber,
          border: "1px solid #fbbf24",
          borderRadius: 8,
          marginBottom: 10,
          fontSize: 13,
          color: colors.warningDarker,
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
          background: colors.warningBg,
          border: "1px solid #ffeeba",
          borderRadius: 12,
          textAlign: "center"
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
          <div style={{ fontWeight: 700, color: colors.warningDark, marginBottom: 4 }}>
            {t("matchCard.pendingTitle")}
          </div>
          <div style={{ fontSize: 13, color: colors.warningDark }}>
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
            resultSource={m.resultSource}
            isHost={isHost}
            isLive={m.isLive}
            elapsed={m.elapsed}
            extra={m.extra}
            matchStatus={m.matchStatus}
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
                background: colors.brandGradient,
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
              color: colors.info,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {t("matchCard.viewOtherPicks")}
          </button>

          {/* Host: Toggle scoring for this match — disabled by product decision (kept commented for future reactivation)
          {isHost && (
            <button
              onClick={() => onToggleScoring(m.id, matchTitle, m.scoringEnabled !== false)}
              style={{
                padding: isMobile ? "10px 16px" : "6px 12px",
                borderRadius: 6,
                border: `1px solid ${m.scoringEnabled !== false ? colors.warningBorder : colors.successAlt}`,
                background: m.scoringEnabled !== false ? "#fef9c3" : colors.successBgLight,
                color: m.scoringEnabled !== false ? colors.warningDarker : colors.successDarker,
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
          */}
        </div>
      )}
    </div>
  );
}
