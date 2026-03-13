"use client";

// Componente unificado para GROUP_STANDINGS
// HOST: Ingresa resultados de 6 partidos -> genera posiciones automaticamente
// PLAYER: Arrastra equipos para predecir orden -> ve resultado oficial cuando este

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  saveGroupStandingsPick,
  getGroupStandingsPick,
  getGroupStandingsResult,
  getGroupMatchResults,
  generateGroupStandings,
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

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [isEditingMatches, setIsEditingMatches] = useState(false);
  const [errataReason, setErrataReason] = useState("");

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

  // Save match result (HOST)
  async function handleSaveMatchResult(matchId: string, reason?: string) {
    const state = matchResults.get(matchId);
    if (!state) return;

    const homeGoals = parseInt(state.homeGoals);
    const awayGoals = parseInt(state.awayGoals);

    if (isNaN(homeGoals) || isNaN(awayGoals) || homeGoals < 0 || awayGoals < 0) {
      setError(t("invalidScore"));
      return;
    }

    const needsReason = state.existsInDb;
    if (needsReason && !reason?.trim()) {
      setError(t("groupStandings.reasonRequired"));
      return;
    }

    try {
      setSavingMatch(matchId);
      setError(null);

      await upsertResult(token, poolId, matchId, {
        homeGoals,
        awayGoals,
        reason: needsReason ? reason : undefined,
      });

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
      setIsEditingMatches(false);
      setErrataReason("");
      setSuccessMessage(officialResult ? t("groupStandings.standingsUpdated") : t("groupStandings.standingsGenerated"));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err?.message || t("groupStandings.errorGenerating"));
    } finally {
      setGeneratingStandings(false);
    }
  }

  // Entrar en modo edicion de partidos (errata flow)
  function handleEnterEditMode() {
    setIsEditingMatches(true);
    setShowMatchDetails(false);
    setErrataReason("");
  }

  // Cancelar edicion de partidos
  function handleCancelEdit() {
    setIsEditingMatches(false);
    setErrataReason("");
    loadData();
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
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: isMobile ? "1rem" : "1.25rem", background: "#fff", textAlign: "center" }}>
        {t("groupStandings.loading")}
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: isMobile ? "1rem" : "1.25rem", background: "#fff" }}>
      {/* Header */}
      <h3 style={{ margin: "0 0 1rem 0", fontSize: 16, fontWeight: 700, color: "#1f2937" }}>{groupName}</h3>

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "1rem" : "1.5rem" }}>

        {/* LEFT: Player Pick */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.5rem", color: "#6b7280" }}>
            {t("groupStandings.yourPrediction")} {playerPickSaved && !isEditingPick && <span style={{ color: "#10b981" }}>✓</span>}
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
                    background: "#10b981",
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
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    cursor: "pointer",
                    minHeight: TOUCH_TARGET.minimum,
                    ...mobileInteractiveStyles.tapHighlight,
                  }}
                >
                  {t("groupStandings.edit")}
                </button>
              )}
            </>
          )}
        </div>

        {/* RIGHT: Official Result or HOST Match Input */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.5rem", color: "#6b7280" }}>
            {t("groupStandings.officialResult")} {officialResult && <span style={{ color: "#f59e0b" }}>★</span>}
          </div>

          {officialResult && !isEditingMatches ? (
            // Show official standings
            <>
              <StaticTeamList teams={teams} orderedTeamIds={officialResult} isOfficial isMobile={isMobile} />
              {isHost && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    onClick={() => setShowMatchDetails(!showMatchDetails)}
                    style={{
                      flex: 1,
                      padding: isMobile ? "10px 12px" : "0.4rem",
                      fontSize: isMobile ? 13 : 12,
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      cursor: "pointer",
                      minHeight: TOUCH_TARGET.minimum,
                      ...mobileInteractiveStyles.tapHighlight,
                    }}
                  >
                    {showMatchDetails ? t("groupStandings.hideMatches") : t("groupStandings.showMatches")}
                  </button>
                  <button
                    onClick={handleEnterEditMode}
                    style={{
                      flex: 1,
                      padding: isMobile ? "10px 12px" : "0.4rem",
                      fontSize: isMobile ? 13 : 12,
                      background: "#fef3c7",
                      color: "#92400e",
                      border: "1px solid #fcd34d",
                      borderRadius: 6,
                      cursor: "pointer",
                      minHeight: TOUCH_TARGET.minimum,
                      ...mobileInteractiveStyles.tapHighlight,
                    }}
                  >
                    {t("groupStandings.editMatches")}
                  </button>
                </div>
              )}
            </>
          ) : isHost ? (
            // HOST: Input match results (initial o editing mode)
            <MatchInputForm
              matches={matches}
              teamMap={teamMap}
              matchResults={matchResults}
              savingMatch={savingMatch}
              errataReason={errataReason}
              setErrataReason={setErrataReason}
              allMatchesSaved={allMatchesSaved}
              generatingStandings={generatingStandings}
              officialResult={officialResult}
              savedMatchCount={savedMatchCount}
              onSaveMatchResult={handleSaveMatchResult}
              onUpdateMatchResult={updateMatchResult}
              onGenerateStandings={handleGenerateStandings}
              onCancelEdit={handleCancelEdit}
              isMobile={isMobile}
              t={t}
            />
          ) : (
            // PLAYER: Show pending message
            <div style={{ padding: "2rem 1rem", textAlign: "center", background: "#f9fafb", borderRadius: 8, color: "#9ca3af", fontSize: 13 }}>
              {t("groupStandings.pendingPublish")}
            </div>
          )}
        </div>
      </div>

      {/* Show match details for HOST after standings generated */}
      {isHost && showMatchDetails && officialResult && !isEditingMatches && (
        <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#f9fafb", borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: "0.75rem", color: "#6b7280" }}>
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
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                  }}
                >
                  {/* Equipo local */}
                  <div style={{ flex: 1, textAlign: "right", paddingRight: "0.75rem" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#1f2937" }}>
                      {homeTeam?.name || t("groupStandings.unknownTeam")}
                    </span>
                    {homeTeam?.code && (
                      <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: "0.25rem" }}>
                        ({homeTeam.code})
                      </span>
                    )}
                  </div>

                  {/* Marcador */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.25rem 0.75rem",
                    background: "#f3f4f6",
                    borderRadius: 4,
                    minWidth: 70,
                    justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{homeGoals}</span>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>-</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{awayGoals}</span>
                  </div>

                  {/* Equipo visitante */}
                  <div style={{ flex: 1, textAlign: "left", paddingLeft: "0.75rem" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#1f2937" }}>
                      {awayTeam?.name || t("groupStandings.unknownTeam")}
                    </span>
                    {awayTeam?.code && (
                      <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: "0.25rem" }}>
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
      {officialResult && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button
            onClick={handleShowBreakdown}
            disabled={loadingBreakdown}
            style={{
              padding: isMobile ? "12px 20px" : "0.5rem 1rem",
              fontSize: isMobile ? 14 : 12,
              fontWeight: 600,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
        <div style={{ marginTop: "1rem", padding: "0.6rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 12 }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div style={{ marginTop: "1rem", padding: "0.6rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, color: "#16a34a", fontSize: 12 }}>
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
