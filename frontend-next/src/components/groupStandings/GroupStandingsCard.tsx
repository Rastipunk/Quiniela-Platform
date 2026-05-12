"use client";

// Componente unificado para GROUP_STANDINGS (modo Estratega).
//
// HOST sin tabla todavía → arma la tabla con drag-and-drop (misma UI que
//   el jugador) y la publica. NO ingresa marcadores: en este modo no
//   importan, solo el orden final.
// HOST con tabla publicada → puede "Sobrescribir tabla" (drag-and-drop
//   con razón obligatoria + notificación a todos los miembros).
// PLAYER → arma su predicción con drag-and-drop. Ve resultado oficial
//   cuando el host lo publique.

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { colors } from "@/lib/theme";
import {
  saveGroupStandingsPick,
  getGroupStandingsPick,
  getGroupStandingsResult,
  publishGroupStandingsResult,
  getGroupBreakdown,
  type GroupSingleBreakdown,
} from "../../lib/api";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../../hooks/useIsMobile";
import type { Team, Match, TeamStanding } from "./types";
import { BreakdownModal } from "./BreakdownModal";
import { StaticTeamList, DraggableTeamList } from "./TeamListComponents";

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

  // Official result state
  const [officialResult, setOfficialResult] = useState<string[] | null>(null);

  // HOST initial-publish state — host's draft order before the table is
  // published for the first time. Used only when there's no officialResult
  // yet. Once published, the override flow takes over.
  const [hostInitialOrder, setHostInitialOrder] = useState<string[]>([]);
  const [savingInitial, setSavingInitial] = useState(false);

  // HOST override state (drag-and-drop override of an already-published table)
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideOrder, setOverrideOrder] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Breakdown modal state
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownData, setBreakdownData] = useState<GroupSingleBreakdown | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  // Load data on mount
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

      const { result } = await getGroupStandingsResult(token, poolId, phaseId, groupId);
      if (result?.teamIds) {
        setOfficialResult(result.teamIds);
      } else if (isHost) {
        // Seed the host's draft with the teams in default order so the
        // drag-and-drop has something to render before they touch it.
        setHostInitialOrder(teams.map((t) => t.id));
      }
    } catch (err: any) {
      setError(err?.message || t("groupStandings.errorLoading"));
    } finally {
      setLoading(false);
    }
  }

  // Save player pick
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

  // HOST: publish the initial official table.
  // No reason required — this is the first publication, not an errata.
  async function handlePublishInitialResult() {
    if (hostInitialOrder.length !== teams.length) return;
    try {
      setSavingInitial(true);
      setError(null);

      await publishGroupStandingsResult(
        token, poolId, phaseId, groupId,
        hostInitialOrder,
      );

      setOfficialResult(hostInitialOrder);
      setSuccessMessage(t("groupStandings.standingsGenerated"));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err?.message || t("groupStandings.errorGenerating"));
    } finally {
      setSavingInitial(false);
    }
  }

  // HOST: enter drag-and-drop override of the already-published table.
  function handleEnterOverride() {
    if (!officialResult) return;
    setOverrideOrder([...officialResult]);
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

      setOfficialResult(overrideOrder);
      setIsOverriding(false);
      setOverrideReason("");
      setSuccessMessage(t("groupStandings.overrideSuccess"));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000);
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
      {/* Header */}
      <h3 style={{ margin: "0 0 1rem 0", fontSize: 16, fontWeight: 700, color: colors.text }}>{groupName}</h3>

      {/* Two column layout */}
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

        {/* RIGHT: Official Result, HOST initial publish, or HOST Override */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.5rem", color: colors.textLighter }}>
            {t("groupStandings.officialResult")} {officialResult && !isOverriding && <span style={{ color: colors.warning }}>★</span>}
          </div>

          {isOverriding ? (
            // HOST: drag-and-drop override of an already-published table.
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
          ) : officialResult ? (
            // Tabla oficial ya publicada
            <>
              <StaticTeamList teams={teams} orderedTeamIds={officialResult} isOfficial isMobile={isMobile} />
              {isHost && (
                <div style={{ marginTop: "0.5rem" }}>
                  <button
                    onClick={handleEnterOverride}
                    style={{
                      width: "100%",
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
                </div>
              )}
            </>
          ) : isHost ? (
            // HOST sin tabla todavía: arma la tabla y la publica con drag-and-drop.
            <>
              <DraggableTeamList
                teams={teams}
                orderedTeamIds={hostInitialOrder}
                onOrderChange={setHostInitialOrder}
                disabled={savingInitial}
                isMobile={isMobile}
              />
              <div style={{ fontSize: 11, color: colors.textLighter, marginTop: "0.5rem", fontStyle: "italic" }}>
                {t("groupStandings.hostInitialHint")}
              </div>
              <button
                onClick={handlePublishInitialResult}
                disabled={savingInitial || hostInitialOrder.length !== teams.length}
                style={{
                  width: "100%",
                  marginTop: "0.5rem",
                  padding: isMobile ? "12px 20px" : "0.6rem",
                  fontSize: isMobile ? 15 : 13,
                  fontWeight: 600,
                  background: savingInitial ? colors.borderMedium : colors.brand,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: savingInitial ? "not-allowed" : "pointer",
                  minHeight: TOUCH_TARGET.minimum,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {savingInitial ? t("groupStandings.saving") : t("groupStandings.publishStandings")}
              </button>
            </>
          ) : (
            // PLAYER sin tabla: mensaje de espera
            <div style={{ padding: "2rem 1rem", textAlign: "center", background: colors.bgLighter, borderRadius: 8, color: colors.textLighter, fontSize: 13 }}>
              {t("groupStandings.pendingPublish")}
            </div>
          )}
        </div>
      </div>

      {/* Breakdown button - show when there's official result */}
      {officialResult && !isOverriding && (
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

      {/* Messages */}
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

      {/* Breakdown Modal */}
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
