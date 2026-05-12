"use client";

// GROUP_STANDINGS card (Estratega mode).
//
// Source of truth for the official table is the scraper-fed pipeline:
//   1. liveScoresJob writes PoolMatchResult for every match.
//   2. autoPublishStructuralResults (backend) recomputes the group
//      table and upserts GroupStandingsResult whenever the last match
//      of the group is confirmed.
//
// The host never publishes the table manually. The host CAN, in case
// of a scraper error or fair-play tiebreaker the calculator can't
// know about, override the published order via drag-and-drop +
// mandatory reason — that flow is preserved unchanged from the
// previous iteration.
//
// PLAYER → drags teams to predict the order.
// HOST   → same view as the player, plus a "Sobrescribir tabla"
//          button that appears only when an official table has been
//          published.

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { colors } from "@/lib/theme";
import {
  saveGroupStandingsPick,
  getGroupStandingsPick,
  getGroupStandingsStats,
  publishGroupStandingsResult,
  getGroupBreakdown,
  type GroupSingleBreakdown,
  type GroupStandingsStats,
} from "../../lib/api";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../../hooks/useIsMobile";
import type { Team, Match, TeamStanding } from "./types";
import { BreakdownModal } from "./BreakdownModal";
import { StaticTeamList, DraggableTeamList } from "./TeamListComponents";
import { ClassicStandingsTable } from "./ClassicStandingsTable";

export type { Team, Match, TeamStanding };

type GroupStandingsCardProps = {
  poolId: string;
  phaseId: string;
  groupId: string;
  groupName: string;
  teams: Team[];
  matches: Match[];
  token: string;
  isHost: boolean;
  isLocked: boolean;
};

export function GroupStandingsCard({
  poolId,
  phaseId,
  groupId,
  groupName,
  teams,
  token,
  isHost,
  isLocked,
}: GroupStandingsCardProps) {
  const isMobile = useIsMobile();
  const t = useTranslations("pool");
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  // Player pick state
  const [playerPick, setPlayerPick] = useState<string[]>([]);
  const [playerPickSaved, setPlayerPickSaved] = useState(false);
  const [isEditingPick, setIsEditingPick] = useState(false);
  const [savingPick, setSavingPick] = useState(false);

  // Live + published stats coming from the new backend endpoint.
  const [stats, setStats] = useState<GroupStandingsStats | null>(null);

  // HOST override state (drag-and-drop over a published table)
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideOrder, setOverrideOrder] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Breakdown modal
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownData, setBreakdownData] = useState<GroupSingleBreakdown | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, phaseId, groupId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const { prediction } = await getGroupStandingsPick(token, poolId, phaseId, groupId);
      if (prediction?.teamIds) {
        setPlayerPick(prediction.teamIds);
        setPlayerPickSaved(true);
        setIsEditingPick(false);
      } else {
        setPlayerPick(teams.map((t) => t.id));
        setPlayerPickSaved(false);
        setIsEditingPick(true);
      }

      const liveStats = await getGroupStandingsStats(token, poolId, phaseId, groupId);
      setStats(liveStats);
    } catch (err: any) {
      setError(err?.message || t("groupStandings.errorLoading"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlayerPick() {
    try {
      setSavingPick(true);
      setError(null);
      await saveGroupStandingsPick(token, poolId, phaseId, groupId, playerPick);
      setPlayerPickSaved(true);
      setIsEditingPick(false);
      setSuccessMessage(t("groupStandings.pickSaved"));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err?.message || t("groupStandings.errorSaving"));
    } finally {
      setSavingPick(false);
    }
  }

  function handleEnterOverride() {
    if (!stats?.publishedTeamIds) return;
    setOverrideOrder([...stats.publishedTeamIds]);
    setOverrideReason("");
    setIsOverriding(true);
  }

  function handleCancelOverride() {
    setIsOverriding(false);
    setOverrideOrder([]);
    setOverrideReason("");
  }

  async function handleSaveOverride() {
    if (!overrideReason.trim()) {
      setError(t("groupStandings.reasonRequired"));
      return;
    }
    if (overrideOrder.length !== teams.length) return;

    try {
      setSavingOverride(true);
      setError(null);

      await publishGroupStandingsResult(
        token, poolId, phaseId, groupId,
        overrideOrder, overrideReason.trim(),
      );

      setIsOverriding(false);
      setOverrideReason("");
      setSuccessMessage(t("groupStandings.overrideSuccess"));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000);

      // Refresh stats so the table picks up the new publishedTeamIds.
      const liveStats = await getGroupStandingsStats(token, poolId, phaseId, groupId);
      setStats(liveStats);
    } catch (err: any) {
      setError(err?.message || t("groupStandings.errorOverride"));
    } finally {
      setSavingOverride(false);
    }
  }

  async function handleShowBreakdown() {
    try {
      setLoadingBreakdown(true);
      setShowBreakdown(true);
      const { breakdown } = await getGroupBreakdown(token, poolId, groupId);
      setBreakdownData(breakdown);
    } catch (err: any) {
      setError(err?.message || t("groupStandings.errorLoadingBreakdown"));
      setShowBreakdown(false);
    } finally {
      setLoadingBreakdown(false);
    }
  }

  if (loading) {
    return (
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: isMobile ? "1rem" : "1.25rem", background: colors.white, textAlign: "center" }}>
        {t("groupStandings.loading")}
      </div>
    );
  }

  const officialPublished = !!stats?.publishedTeamIds;
  const showPickSavedTreatment = playerPickSaved && !isEditingPick;
  const pickColumnStyle: React.CSSProperties = showPickSavedTreatment
    ? {
        border: "2px solid #16a34a",
        borderRadius: 10,
        padding: isMobile ? "0.75rem" : "0.85rem",
        background: "#f9fdfb",
      }
    : {};

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: isMobile ? "1rem" : "1.25rem", background: colors.white }}>
      <h3 style={{ margin: "0 0 1rem 0", fontSize: 16, fontWeight: 700, color: colors.text }}>{groupName}</h3>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "1rem" : "1.5rem" }}>

        {/* LEFT: Player Pick */}
        <div style={pickColumnStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.5rem", color: colors.textLighter }}>
            {t("groupStandings.yourPrediction")}
          </div>

          {isEditingPick ? (
            <>
              <DraggableTeamList
                teams={teams}
                orderedTeamIds={playerPick}
                onOrderChange={setPlayerPick}
                disabled={savingPick}
                isMobile={isMobile}
              />
              {!isLocked && (
                <button
                  onClick={handleSavePlayerPick}
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
                  {savingPick ? t("groupStandings.saving") : t("groupStandings.save")}
                </button>
              )}
            </>
          ) : (
            <>
              <div
                style={{
                  background: "#dcfce7",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  padding: isMobile ? "0.55rem 0.75rem" : "0.45rem 0.65rem",
                  borderRadius: 6,
                  fontSize: isMobile ? 13 : 12,
                  fontWeight: 600,
                  marginBottom: "0.75rem",
                  textAlign: "center",
                }}
              >
                {t("groupStandings.pickSavedBanner")}
              </div>
              <StaticTeamList teams={teams} orderedTeamIds={playerPick} isMobile={isMobile} />
              {!isLocked && (
                <button
                  onClick={() => setIsEditingPick(true)}
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
                  {t("groupStandings.editPick")}
                </button>
              )}
            </>
          )}
        </div>

        {/* RIGHT: Classic standings table (live + published) or Override */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.5rem", color: colors.textLighter }}>
            {t("groupStandings.officialResult")}
            {officialPublished && !isOverriding && <span style={{ color: colors.warning }}> ★</span>}
          </div>

          {isOverriding ? (
            // HOST drag-and-drop override of a published table.
            <div
              style={{
                border: "2px solid #f59e0b",
                borderRadius: 10,
                padding: isMobile ? "0.75rem" : "0.85rem",
                background: "#fffbeb",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: "0.25rem" }}>
                {t("groupStandings.overrideTitle")}
              </div>
              <div style={{ fontSize: 12, color: "#78350f", marginBottom: "0.75rem", lineHeight: 1.4 }}>
                {t("groupStandings.overrideDesc")}
              </div>
              <DraggableTeamList
                teams={teams}
                orderedTeamIds={overrideOrder}
                onOrderChange={setOverrideOrder}
                disabled={savingOverride}
                isMobile={isMobile}
              />
              <label style={{ display: "block", fontSize: isMobile ? 13 : 12, color: "#78350f", fontWeight: 600, marginTop: "0.75rem", marginBottom: "0.25rem" }}>
                {t("groupStandings.overrideReasonLabel")}
              </label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={t("groupStandings.overrideReasonPlaceholder")}
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
                ⚠️ {t("groupStandings.overrideWarning")}
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
                  {t("groupStandings.cancel")}
                </button>
                <button
                  onClick={handleSaveOverride}
                  disabled={savingOverride || !overrideReason.trim()}
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
                  {savingOverride ? t("groupStandings.overrideSaving") : t("groupStandings.overrideSaveBtn")}
                </button>
              </div>
            </div>
          ) : stats ? (
            <>
              <ClassicStandingsTable
                teams={teams}
                standings={stats.standings}
                completedMatches={stats.completedMatches}
                totalMatches={stats.totalMatches}
                publishedOrder={stats.publishedTeamIds}
                publishedReason={stats.publishedReason}
                isMobile={isMobile}
              />
              {isHost && officialPublished && !isLocked && (
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
                  {t("groupStandings.overrideBtn")}
                </button>
              )}
            </>
          ) : (
            <div style={{ padding: "2rem 1rem", textAlign: "center", background: colors.bgLighter, borderRadius: 8, color: colors.textLighter, fontSize: 13 }}>
              {t("groupStandings.pendingPublish")}
            </div>
          )}
        </div>
      </div>

      {/* Breakdown button */}
      {officialPublished && !isOverriding && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button
            onClick={handleShowBreakdown}
            disabled={loadingBreakdown}
            style={{
              padding: isMobile ? "12px 20px" : "0.5rem 1rem",
              fontSize: isMobile ? 14 : 12,
              fontWeight: 600,
              background: colors.brandGradient,
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: loadingBreakdown ? "not-allowed" : "pointer",
              opacity: loadingBreakdown ? 0.7 : 1,
              minHeight: TOUCH_TARGET.minimum,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {loadingBreakdown ? t("groupStandings.loading") : t("groupStandings.viewBreakdown")}
          </button>
        </div>
      )}

      {error && (
        <div style={{ marginTop: "1rem", padding: "0.6rem", background: colors.errorBg, border: "1px solid #fecaca", borderRadius: 6, color: colors.error, fontSize: 12 }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div style={{ marginTop: "1rem", padding: "0.6rem", background: colors.successBgAlt, border: "1px solid #bbf7d0", borderRadius: 6, color: colors.successAlt, fontSize: 12 }}>
          {successMessage}
        </div>
      )}

      {showBreakdown && (
        <BreakdownModal
          groupName={groupName}
          breakdownData={breakdownData}
          loadingBreakdown={loadingBreakdown}
          isMobile={isMobile}
          onClose={() => { setShowBreakdown(false); setBreakdownData(null); }}
          t={t}
        />
      )}
    </div>
  );
}
