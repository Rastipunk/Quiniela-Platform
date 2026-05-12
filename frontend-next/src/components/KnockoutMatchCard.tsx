"use client";

import { colors } from "@/lib/theme";

// Knockout match card (Estratega mode).
//
// Source of truth for the official winner is the scraper-fed pipeline:
//   1. liveScoresJob writes PoolMatchResult (goals + penalties) for
//      every knockout match.
//   2. autoPublishStructuralResults (backend) derives the winner from
//      the score (with penalty fallback) and merges {matchId, winnerId}
//      into StructuralPhaseResult.matches[] the moment the match is
//      confirmed.
//
// The host never enters a score here. The only host action available
// is "Sobrescribir ganador" — surfaces ONLY when a winner is already
// published and the phase isn't locked. That flow requires a reason
// and notifies every member via email (backend sends
// sendKnockoutWinnerOverrideNotification).
//
// PLAYER → picks who they think will advance.
// HOST   → same picker, plus the override button when applicable.

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { upsertStructuralPick, publishKnockoutMatchWinner } from "../lib/api";
import { isApiError } from "../lib/apiError";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";

type Team = {
  id: string;
  name: string;
  code?: string;
  flag?: string;
};

type KnockoutMatchCardProps = {
  poolId: string;
  phaseId: string;
  matchId: string;
  homeTeam: Team;
  awayTeam: Team;
  kickoffUtc: string;
  token: string;
  isHost: boolean;
  isLocked: boolean;
  /**
   * Real match result from PoolMatchResult.currentVersion (populated by
   * the scraper). When present we show the score; when missing the
   * match hasn't been confirmed yet.
   */
  existingResult?: {
    homeGoals: number;
    awayGoals: number;
    homePenalties?: number | null;
    awayPenalties?: number | null;
  } | null;
  /**
   * Winner published in StructuralPhaseResult.matches[] for this match.
   * When set, the "Resultado oficial" side shows the badge and the host
   * can override.
   */
  publishedWinnerId?: string | null;
  /** User's current pick (winnerId), if any. */
  existingPick?: string | null;
  onResultSaved?: () => void;
  onPickSaved?: () => void;
};

const REASON_REQUIRED_FOR_OVERRIDE = "REASON_REQUIRED_FOR_OVERRIDE";

export function KnockoutMatchCard({
  poolId,
  phaseId,
  matchId,
  homeTeam,
  awayTeam,
  kickoffUtc: _kickoffUtc,
  token,
  isHost,
  isLocked,
  existingResult,
  publishedWinnerId,
  existingPick,
  onResultSaved,
  onPickSaved,
}: KnockoutMatchCardProps) {
  void _kickoffUtc;
  const isMobile = useIsMobile();
  const t = useTranslations("pool");
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  // Player pick state
  const [selectedWinner, setSelectedWinner] = useState<string | null>(existingPick || null);
  const [pickSaved, setPickSaved] = useState(!!existingPick);
  const [savingPick, setSavingPick] = useState(false);

  // Host override state
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideWinnerId, setOverrideWinnerId] = useState<string | null>(publishedWinnerId ?? null);
  const [overrideReason, setOverrideReason] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedWinner(existingPick || null);
    setPickSaved(!!existingPick);
  }, [existingPick]);

  useEffect(() => {
    setOverrideWinnerId(publishedWinnerId ?? null);
  }, [publishedWinnerId]);

  const publishedTeam =
    publishedWinnerId === homeTeam.id ? homeTeam :
    publishedWinnerId === awayTeam.id ? awayTeam : null;

  const wentToPenalties =
    !!existingResult &&
    existingResult.homeGoals === existingResult.awayGoals &&
    existingResult.homePenalties != null &&
    existingResult.awayPenalties != null;

  // Player pick save
  async function handleSavePick() {
    if (!selectedWinner) {
      setError(t("knockoutCard.selectTeam"));
      return;
    }
    try {
      setSavingPick(true);
      setError(null);
      const pickData = { matches: [{ matchId, winnerId: selectedWinner }] };
      await upsertStructuralPick(token, poolId, phaseId, pickData);
      setPickSaved(true);
      setSuccessMessage(t("knockoutCard.pickSaved"));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 2000);
      onPickSaved?.();
    } catch (err: any) {
      setError(err?.message || t("knockoutCard.errorSavingPick"));
    } finally {
      setSavingPick(false);
    }
  }

  function handleEnterOverride() {
    setOverrideWinnerId(publishedWinnerId ?? null);
    setOverrideReason("");
    setIsOverriding(true);
  }

  function handleCancelOverride() {
    setIsOverriding(false);
    setOverrideReason("");
    setOverrideWinnerId(publishedWinnerId ?? null);
  }

  async function handleSaveOverride() {
    if (!overrideWinnerId) {
      setError(t("knockoutCard.selectTeam"));
      return;
    }
    if (!overrideReason.trim()) {
      setError(t("knockoutCard.overrideReasonRequired"));
      return;
    }
    try {
      setSavingOverride(true);
      setError(null);
      await publishKnockoutMatchWinner(token, poolId, phaseId, matchId, {
        winnerId: overrideWinnerId,
        reason: overrideReason.trim(),
      });
      setIsOverriding(false);
      setOverrideReason("");
      setSuccessMessage(t("knockoutCard.overrideSuccess"));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000);
      onResultSaved?.();
    } catch (err: unknown) {
      // Defensive: if for some race the server says it needs a reason
      // even though we sent one, surface that. Otherwise show whatever
      // message we got.
      if (isApiError(err) && err.code === REASON_REQUIRED_FOR_OVERRIDE) {
        setError(t("knockoutCard.overrideReasonRequired"));
      } else {
        const msg = err instanceof Error ? err.message : t("knockoutCard.errorPublishing");
        setError(msg);
      }
    } finally {
      setSavingOverride(false);
    }
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: isMobile ? "1rem" : "1.25rem", background: colors.white }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid #f3f4f6",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{homeTeam.name}</span>
          <span style={{ fontSize: 12, color: colors.textLighter }}>vs</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{awayTeam.name}</span>
        </div>
        {publishedTeam && (
          <div style={{
            padding: "0.25rem 0.75rem",
            background: colors.successBgLight,
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            color: colors.successAlt,
          }}>
            {t("knockoutCard.advances", { team: publishedTeam.name })}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "1rem" : "1.5rem" }}>
        {/* LEFT: Player pick */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.75rem", color: colors.textLighter }}>
            {t("knockoutCard.yourPrediction")} {pickSaved && <span style={{ color: colors.successAlt }}>✓</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <TeamPickButton
              team={homeTeam}
              isSelected={selectedWinner === homeTeam.id}
              onClick={() => !isLocked && setSelectedWinner(homeTeam.id)}
              disabled={isLocked}
            />
            <TeamPickButton
              team={awayTeam}
              isSelected={selectedWinner === awayTeam.id}
              onClick={() => !isLocked && setSelectedWinner(awayTeam.id)}
              disabled={isLocked}
            />
          </div>
          {!isLocked && selectedWinner && !pickSaved && (
            <button
              onClick={handleSavePick}
              disabled={savingPick}
              style={{
                width: "100%",
                marginTop: "0.75rem",
                padding: isMobile ? "12px 20px" : "0.6rem",
                fontSize: isMobile ? 15 : 13,
                fontWeight: 600,
                background: colors.successAlt,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: savingPick ? "not-allowed" : "pointer",
                minHeight: TOUCH_TARGET.minimum,
                ...mobileInteractiveStyles.tapHighlight,
              }}
            >
              {savingPick ? t("knockoutCard.saving") : t("knockoutCard.save")}
            </button>
          )}
          {pickSaved && !isLocked && (
            <button
              onClick={() => setPickSaved(false)}
              style={{
                width: "100%",
                marginTop: "0.75rem",
                padding: isMobile ? "12px 20px" : "0.6rem",
                fontSize: isMobile ? 15 : 13,
                fontWeight: 600,
                background: colors.bgLight,
                color: colors.textDark,
                border: "1px solid #d1d5db",
                borderRadius: 8,
                cursor: "pointer",
                minHeight: TOUCH_TARGET.minimum,
                ...mobileInteractiveStyles.tapHighlight,
              }}
            >
              {t("knockoutCard.edit")}
            </button>
          )}
        </div>

        {/* RIGHT: Official result */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.75rem", color: colors.textLighter }}>
            {t("knockoutCard.officialResult")} {publishedTeam && <span style={{ color: colors.warning }}>★</span>}
          </div>

          {isOverriding ? (
            // HOST override flow.
            <div
              style={{
                border: "2px solid #f59e0b",
                borderRadius: 10,
                padding: isMobile ? "0.75rem" : "0.85rem",
                background: "#fffbeb",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: "0.25rem" }}>
                {t("knockoutCard.overrideTitle")}
              </div>
              <div style={{ fontSize: 12, color: "#78350f", marginBottom: "0.75rem", lineHeight: 1.4 }}>
                {t("knockoutCard.overrideDesc")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <TeamPickButton
                  team={homeTeam}
                  isSelected={overrideWinnerId === homeTeam.id}
                  onClick={() => setOverrideWinnerId(homeTeam.id)}
                  disabled={savingOverride}
                />
                <TeamPickButton
                  team={awayTeam}
                  isSelected={overrideWinnerId === awayTeam.id}
                  onClick={() => setOverrideWinnerId(awayTeam.id)}
                  disabled={savingOverride}
                />
              </div>
              <label style={{ display: "block", fontSize: isMobile ? 13 : 12, color: "#78350f", fontWeight: 600, marginBottom: "0.25rem" }}>
                {t("knockoutCard.overrideReasonLabel")}
              </label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={t("knockoutCard.overrideReasonPlaceholder")}
                disabled={savingOverride}
                style={{
                  width: "100%",
                  padding: isMobile ? "0.6rem" : "0.45rem",
                  fontSize: isMobile ? 14 : 12,
                  border: "1px solid #fcd34d",
                  borderRadius: 6,
                  background: "#fffbeb",
                  minHeight: TOUCH_TARGET.minimum,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 11, color: "#92400e", marginTop: "0.4rem", fontStyle: "italic" }}>
                ⚠️ {t("knockoutCard.overrideWarning")}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button
                  onClick={handleCancelOverride}
                  disabled={savingOverride}
                  style={{
                    flex: 1,
                    padding: isMobile ? "12px 16px" : "0.6rem",
                    fontSize: isMobile ? 14 : 13,
                    fontWeight: 600,
                    background: colors.bgLight,
                    color: colors.textDark,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    cursor: savingOverride ? "not-allowed" : "pointer",
                    minHeight: TOUCH_TARGET.minimum,
                    ...mobileInteractiveStyles.tapHighlight,
                  }}
                >
                  {t("knockoutCard.cancel")}
                </button>
                <button
                  onClick={handleSaveOverride}
                  disabled={savingOverride || !overrideReason.trim() || !overrideWinnerId}
                  style={{
                    flex: 1,
                    padding: isMobile ? "12px 16px" : "0.6rem",
                    fontSize: isMobile ? 14 : 13,
                    fontWeight: 700,
                    background: savingOverride || !overrideReason.trim() ? colors.borderMedium : "#d97706",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    cursor: savingOverride || !overrideReason.trim() ? "not-allowed" : "pointer",
                    minHeight: TOUCH_TARGET.minimum,
                    opacity: !overrideReason.trim() ? 0.6 : 1,
                    ...mobileInteractiveStyles.tapHighlight,
                  }}
                >
                  {savingOverride ? t("knockoutCard.saving") : t("knockoutCard.overrideSaveBtn")}
                </button>
              </div>
            </div>
          ) : existingResult ? (
            // Result published by the scraper — show score, optional pens, winner badge.
            <div>
              <div style={{
                padding: "1rem",
                background: colors.bgLighter,
                borderRadius: 8,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>
                  {existingResult.homeGoals} - {existingResult.awayGoals}
                </div>
                {wentToPenalties && (
                  <div style={{ fontSize: 13, color: colors.textLighter, marginTop: "0.25rem" }}>
                    ({existingResult.homePenalties} - {existingResult.awayPenalties} {t("knockoutCard.pen")})
                  </div>
                )}
                {publishedTeam && (
                  <div style={{
                    marginTop: "0.75rem",
                    padding: "0.5rem",
                    background: colors.successBgLight,
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: colors.successAlt,
                  }}>
                    🏆 {t("knockoutCard.teamAdvancesResult", { team: publishedTeam.name })}
                  </div>
                )}
              </div>
              {isHost && publishedTeam && !isLocked && (
                <button
                  onClick={handleEnterOverride}
                  style={{
                    width: "100%",
                    marginTop: "0.75rem",
                    padding: isMobile ? "12px 16px" : "0.6rem",
                    fontSize: isMobile ? 14 : 13,
                    fontWeight: 600,
                    background: colors.warningBgAmber,
                    color: colors.warningDarker,
                    border: "1px solid #fcd34d",
                    borderRadius: 8,
                    cursor: "pointer",
                    minHeight: TOUCH_TARGET.minimum,
                    ...mobileInteractiveStyles.tapHighlight,
                  }}
                >
                  {t("knockoutCard.overrideBtn")}
                </button>
              )}
            </div>
          ) : (
            <div style={{
              padding: "2rem 1rem",
              textAlign: "center",
              background: colors.bgLighter,
              borderRadius: 8,
              color: colors.textLighter,
              fontSize: 13,
            }}>
              {t("knockoutCard.pendingScraperResult")}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: "1rem",
          padding: "0.6rem",
          background: colors.errorBg,
          border: "1px solid #fecaca",
          borderRadius: 6,
          color: colors.error,
          fontSize: 12,
        }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div style={{
          marginTop: "1rem",
          padding: "0.6rem",
          background: colors.successBgAlt,
          border: "1px solid #bbf7d0",
          borderRadius: 6,
          color: colors.successAlt,
          fontSize: 12,
        }}>
          {successMessage}
        </div>
      )}
    </div>
  );
}

function TeamPickButton({
  team,
  isSelected,
  onClick,
  disabled,
}: {
  team: Team;
  isSelected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const t = useTranslations("pool");
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.75rem",
        background: isSelected ? colors.successBgLight : colors.white,
        border: isSelected ? "2px solid #10b981" : "1px solid #e5e7eb",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && !isSelected ? 0.5 : 1,
        transition: "all 0.2s",
        minHeight: TOUCH_TARGET.minimum,
        ...mobileInteractiveStyles.tapHighlight,
      }}
    >
      {isSelected && <span style={{ color: colors.successAlt, fontSize: 16 }}>✓</span>}
      <span style={{
        fontSize: 14,
        fontWeight: isSelected ? 600 : 500,
        color: isSelected ? colors.successAlt : colors.text,
      }}>
        {team.name}
      </span>
      {isSelected && (
        <span style={{
          marginLeft: "auto",
          fontSize: 11,
          color: colors.successAlt,
          background: colors.successBgAlt,
          padding: "0.15rem 0.5rem",
          borderRadius: 10,
        }}>
          {t("knockoutCard.advancesBadge")}
        </span>
      )}
    </button>
  );
}
