"use client";

// Componente unificado para GROUP_STANDINGS
// HOST: Ingresa resultados de partidos -> genera posiciones automaticamente.
//       Si la tabla generada no coincide con la realidad (p.ej. fair play
//       en FIFA), puede sobrescribirla manualmente arrastrando equipos.
// PLAYER: Arrastra equipos para predecir orden -> ve resultado oficial cuando esté.

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { colors } from "@/lib/theme";
import {
  saveGroupStandingsPick,
  getGroupStandingsPick,
  getGroupStandingsResult,
  getGroupMatchResults,
  generateGroupStandings,
  publishGroupStandingsResult,
  upsertResult,
  getGroupBreakdown,
  type GroupSingleBreakdown,
} from "../../lib/api";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../../hooks/useIsMobile";
import type { Team, Match, TeamStanding } from "./types";
import { BreakdownModal } from "./BreakdownModal";
import { MatchInputForm } from "./MatchInputForm";
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
  matches,
  token,
  isHost,
  isLocked,
}: GroupStandingsCardProps) {
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
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
  // officialStandings se usa para debug/log pero no se renderiza directamente
  const [, setOfficialStandings] = useState<TeamStanding[] | null>(null);

  // HOST match results state
  const [matchResults, setMatchResults] = useState<Map<string, { homeGoals: string; awayGoals: string; saved: boolean; existsInDb: boolean }>>(new Map());
  const [savingMatch, setSavingMatch] = useState<string | null>(null);
  const [generatingStandings, setGeneratingStandings] = useState(false);

  // HOST override state (drag-and-drop manual override of an already-published table)
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideOrder, setOverrideOrder] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);

  // Breakdown modal state
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownData, setBreakdownData] = useState<GroupSingleBreakdown | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [poolId, phaseId, groupId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Load player pick
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

      // Load official result
      const { result } = await getGroupStandingsResult(token, poolId, phaseId, groupId);
      if (result?.teamIds) {
        setOfficialResult(result.teamIds);
      }

      // If HOST, load match results
      if (isHost) {
        const matchData = await getGroupMatchResults(token, poolId, groupId);
        const newMatchResults = new Map<string, { homeGoals: string; awayGoals: string; saved: boolean; existsInDb: boolean }>();

        for (const match of matches) {
          const existing = matchData.results[match.id];
          newMatchResults.set(match.id, {
            homeGoals: existing ? String(existing.homeGoals) : "",
            awayGoals: existing ? String(existing.awayGoals) : "",
            saved: !!existing,
            existsInDb: !!existing,
          });
        }
        setMatchResults(newMatchResults);
      }
    } catch (err: any) {
      setError(err?.message || t("groupStandings.errorLoading"));
    } finally {
      setLoading(false);
    }
  }

  // Count saved matches
  const savedMatchCount = useMemo(() => {
    let count = 0;
    matchResults.forEach((v) => { if (v.saved) count++; });
    return count;
  }, [matchResults]);

  const allMatchesSaved = savedMatchCount === matches.length;

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

  // Save match result (HOST). Initial entry only — modificar marcadores
  // ya cerrados se hace desde el flujo de overrides de partidos, no aquí.
  async function handleSaveMatchResult(matchId: string) {
    const state = matchResults.get(matchId);
    if (!state) return;

    const homeGoals = parseInt(state.homeGoals);
    const awayGoals = parseInt(state.awayGoals);

    if (isNaN(homeGoals) || isNaN(awayGoals) || homeGoals < 0 || awayGoals < 0) {
      setError(t("invalidScore"));
      return;
    }

    try {
      setSavingMatch(matchId);
      setError(null);

      await upsertResult(token, poolId, matchId, { homeGoals, awayGoals });

      setMatchResults((prev) => {
        const newMap = new Map(prev);
        newMap.set(matchId, { ...state, saved: true, existsInDb: true });
        return newMap;
      });

      setSuccessMessage(t("groupStandings.resultSaved"));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 1500);
    } catch (err: any) {
      setError(err?.message || t("groupStandings.errorSavingResult"));
    } finally {
      setSavingMatch(null);
    }
  }

  // Generate standings from match results (HOST)
  async function handleGenerateStandings() {
    try {
      setGeneratingStandings(true);
      setError(null);

      const { result, standings } = await generateGroupStandings(token, poolId, phaseId, groupId);
      setOfficialResult(result.teamIds);
      setOfficialStandings(standings);
      setSuccessMessage(t("groupStandings.standingsGenerated"));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err?.message || t("groupStandings.errorGenerating"));
    } finally {
      setGeneratingStandings(false);
    }
  }

  // Entrar en modo override drag-and-drop. Solo disponible cuando ya
  // hay tabla oficial publicada y todos los partidos están cerrados.
  function handleEnterOverride() {
    if (!officialResult) return;
    setOverrideOrder([...officialResult]);
    setOverrideReason("");
    setIsOverriding(true);
    setShowMatchDetails(false);
  }

  function handleCancelOverride() {
    setIsOverriding(false);
    setOverrideOrder([]);
    setOverrideReason("");
  }

  // Guardar override: PUT al endpoint de results, dispara email a todos.
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

  // Cargar breakdown de puntos
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

  function updateMatchResult(matchId: string, field: "homeGoals" | "awayGoals", value: string) {
    setMatchResults((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(matchId) || { homeGoals: "", awayGoals: "", saved: false, existsInDb: false };
      newMap.set(matchId, { ...current, [field]: value, saved: false });
      return newMap;
    });
  }

  if (loading) {
    return (
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: isMobile ? "1rem" : "1.25rem", background: colors.white, textAlign: "center" }}>
        {t("groupStandings.loading")}
      </div>
    );
  }

  // Visual treatment for the player's "saved" state: green border on the
  // column, banner across the top, "Edit prediction" button — designed
  // so the user can tell at a glance whether their pick is locked in.
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
              {/* Saved-state banner */}
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

        {/* RIGHT: Official Result, HOST Match Input, or HOST Override */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.5rem", color: colors.textLighter }}>
            {t("groupStandings.officialResult")} {officialResult && !isOverriding && <span style={{ color: colors.warning }}>★</span>}
          </div>

          {isOverriding ? (
            // HOST: Manual drag-and-drop override of the published table.
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
            // Tabla oficial publicada
            <>
              <StaticTeamList teams={teams} orderedTeamIds={officialResult} isOfficial isMobile={isMobile} />
              {isHost && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    onClick={() => setShowMatchDetails(!showMatchDetails)}
                    style={{
                      flex: 1,
                      padding: isMobile ? "10px 12px" : "0.4rem",
                      fontSize: isMobile ? 13 : 12,
                      background: colors.bgLight,
                      color: colors.textDark,
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      cursor: "pointer",
                      minHeight: TOUCH_TARGET.minimum,
                      ...mobileInteractiveStyles.tapHighlight,
                    }}
                  >
                    {showMatchDetails ? t("groupStandings.hideMatches") : t("groupStandings.showMatches")}
                  </button>
                  {allMatchesSaved && (
                    <button
                      onClick={handleEnterOverride}
                      style={{
                        flex: 1,
                        padding: isMobile ? "10px 12px" : "0.4rem",
                        fontSize: isMobile ? 13 : 12,
                        fontWeight: 600,
                        background: colors.warningBgAmber,
                        color: colors.warningDarker,
                        border: "1px solid #fcd34d",
                        borderRadius: 6,
                        cursor: "pointer",
                        minHeight: TOUCH_TARGET.minimum,
                        ...mobileInteractiveStyles.tapHighlight,
                      }}
                    >
                      {t("groupStandings.overrideBtn")}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : isHost ? (
            // HOST sin tabla todavía: ingresa marcadores para generar
            <MatchInputForm
              matches={matches}
              teamMap={teamMap}
              matchResults={matchResults}
              savingMatch={savingMatch}
              allMatchesSaved={allMatchesSaved}
              generatingStandings={generatingStandings}
              savedMatchCount={savedMatchCount}
              onSaveMatchResult={handleSaveMatchResult}
              onUpdateMatchResult={updateMatchResult}
              onGenerateStandings={handleGenerateStandings}
              isMobile={isMobile}
              t={t}
            />
          ) : (
            // PLAYER sin tabla: mensaje de espera
            <div style={{ padding: "2rem 1rem", textAlign: "center", background: colors.bgLighter, borderRadius: 8, color: colors.textLighter, fontSize: 13 }}>
              {t("groupStandings.pendingPublish")}
            </div>
          )}
        </div>
      </div>

      {/* Show match details for HOST after standings generated */}
      {isHost && showMatchDetails && officialResult && !isOverriding && (
        <div style={{ marginTop: "1rem", padding: "0.75rem", background: colors.bgLighter, borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: "0.75rem", color: colors.textLighter }}>
            {t("groupStandings.matchResultsTitle")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {matches.map((match) => {
              const state = matchResults.get(match.id);
              const homeTeam = teamMap.get(match.homeTeamId);
              const awayTeam = teamMap.get(match.awayTeamId);
              const homeGoals = state?.homeGoals ?? "?";
              const awayGoals = state?.awayGoals ?? "?";

              return (
                <div
                  key={match.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    background: colors.white,
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                  }}
                >
                  <div style={{ flex: 1, textAlign: "right", paddingRight: "0.75rem" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>
                      {homeTeam?.name || t("groupStandings.unknownTeam")}
                    </span>
                    {homeTeam?.code && (
                      <span style={{ fontSize: 10, color: colors.textLighter, marginLeft: "0.25rem" }}>
                        ({homeTeam.code})
                      </span>
                    )}
                  </div>

                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.25rem 0.75rem",
                    background: colors.bgLight,
                    borderRadius: 4,
                    minWidth: 70,
                    justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{homeGoals}</span>
                    <span style={{ fontSize: 12, color: colors.textLighter }}>-</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{awayGoals}</span>
                  </div>

                  <div style={{ flex: 1, textAlign: "left", paddingLeft: "0.75rem" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>
                      {awayTeam?.name || t("groupStandings.unknownTeam")}
                    </span>
                    {awayTeam?.code && (
                      <span style={{ fontSize: 10, color: colors.textLighter, marginLeft: "0.25rem" }}>
                        ({awayTeam.code})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
