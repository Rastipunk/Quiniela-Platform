"use client";

// Componente unificado para GROUP_STANDINGS
// HOST: Ingresa resultados de 6 partidos -> genera posiciones automaticamente
// PLAYER: Arrastra equipos para predecir orden -> ve resultado oficial cuando este

import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  saveGroupStandingsPick,
  getGroupStandingsPick,
  getGroupStandingsResult,
  getGroupMatchResults,
  generateGroupStandings,
  upsertResult,
  getGroupBreakdown,
  type GroupSingleBreakdown,
} from "../lib/api";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";

type Team = {
  id: string;
  name: string;
  code?: string;
  flag?: string;
};

type Match = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffUtc: string;
};

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

type TeamStanding = {
  teamId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

const MEDALS = ["🥇", "🥈", "🥉", ""];

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
  // existsInDb: true si el resultado ya existe en la base de datos (para saber si necesita reason al editar)
  // saved: true si el valor actual coincide con lo que hay en la DB (para mostrar checkmark)
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
            existsInDb: !!existing, // true si ya existe en la DB
          });
        }
        setMatchResults(newMatchResults);
      }
    } catch (err: any) {
      setError(err?.message || "Error al cargar datos");
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
      setSuccessMessage("Predicción guardada");
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err?.message || "Error al guardar");
    } finally {
      setSavingPick(false);
    }
  }

  // Save match result (HOST)
  // Si el resultado ya existe en la DB (existsInDb), el backend requiere reason
  async function handleSaveMatchResult(matchId: string, reason?: string) {
    const state = matchResults.get(matchId);
    if (!state) return;

    const homeGoals = parseInt(state.homeGoals);
    const awayGoals = parseInt(state.awayGoals);

    if (isNaN(homeGoals) || isNaN(awayGoals) || homeGoals < 0 || awayGoals < 0) {
      setError("Marcador inválido");
      return;
    }

    // El backend requiere reason si el resultado ya existe en la DB (version > 1)
    // existsInDb nos dice si ya habia un resultado guardado antes
    const needsReason = state.existsInDb;
    if (needsReason && !reason?.trim()) {
      setError("Se requiere una razón para corregir un resultado ya publicado");
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

      setSuccessMessage("Resultado guardado");
      setTimeout(() => setSuccessMessage(null), 1500);
    } catch (err: any) {
      setError(err?.message || "Error al guardar resultado");
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
      setIsEditingMatches(false); // Salir de modo edicion
      setErrataReason(""); // Limpiar razon
      setSuccessMessage(officialResult ? "Posiciones actualizadas" : "Posiciones generadas");
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err?.message || "Error al generar posiciones");
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
    // Recargar datos para descartar cambios no guardados
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
      setError(err?.message || "Error al cargar desglose");
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
        Cargando...
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
            Tu predicción {playerPickSaved && !isEditingPick && <span style={{ color: "#10b981" }}>✓</span>}
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
                  {savingPick ? "Guardando..." : "Guardar"}
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
                  Editar
                </button>
              )}
            </>
          )}
        </div>

        {/* RIGHT: Official Result or HOST Match Input */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.5rem", color: "#6b7280" }}>
            Resultado oficial {officialResult && <span style={{ color: "#f59e0b" }}>★</span>}
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
                    {showMatchDetails ? "Ocultar partidos" : "Ver partidos"}
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
                    Editar partidos
                  </button>
                </div>
              )}
            </>
          ) : isHost ? (
            // HOST: Input match results (initial o editing mode)
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
                  <strong>Modo corrección:</strong> Los cambios requerirán regenerar las posiciones.
                </div>
              )}

              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: "0.5rem" }}>
                {savedMatchCount}/{matches.length} partidos
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
                        onChange={(e) => updateMatchResult(match.id, "homeGoals", e.target.value)}
                        disabled={isSaving}
                        style={{ width: isMobile ? 40 : 28, padding: isMobile ? "0.4rem" : "0.15rem", fontSize: isMobile ? 16 : 12, textAlign: "center" as const, border: "1px solid #d1d5db", borderRadius: 4, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
                      />
                      <span style={{ fontSize: isMobile ? 12 : 10, color: "#9ca3af" }}>-</span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={state.awayGoals}
                        onChange={(e) => updateMatchResult(match.id, "awayGoals", e.target.value)}
                        disabled={isSaving}
                        style={{ width: isMobile ? 40 : 28, padding: isMobile ? "0.4rem" : "0.15rem", fontSize: isMobile ? 16 : 12, textAlign: "center" as const, border: "1px solid #d1d5db", borderRadius: 4, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
                      />
                      <span style={{ fontSize: isMobile ? 13 : 11, fontWeight: 500, width: isMobile ? 44 : 40, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                        {awayTeam?.code || awayTeam?.name?.slice(0, 3).toUpperCase()}
                      </span>
                      <button
                        onClick={() => handleSaveMatchResult(match.id, needsReason ? errataReason : undefined)}
                        disabled={isSaving || !state.homeGoals || !state.awayGoals || (needsReason && !errataReason.trim())}
                        title={needsReason && !errataReason.trim() ? "Escribe una razón abajo" : undefined}
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
                    Razón de corrección (requerido):
                  </label>
                  <input
                    type="text"
                    value={errataReason}
                    onChange={(e) => setErrataReason(e.target.value)}
                    placeholder="Ej: Error de tipeo, resultado oficial corregido..."
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
                    onClick={handleCancelEdit}
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
                    Cancelar
                  </button>
                )}
                {allMatchesSaved && (
                  <button
                    onClick={handleGenerateStandings}
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
                    {generatingStandings ? "Generando..." : officialResult ? "Regenerar posiciones" : "Generar posiciones"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            // PLAYER: Show pending message
            <div style={{ padding: "2rem 1rem", textAlign: "center", background: "#f9fafb", borderRadius: 8, color: "#9ca3af", fontSize: 13 }}>
              Pendiente de publicar
            </div>
          )}
        </div>
      </div>

      {/* Show match details for HOST after standings generated */}
      {isHost && showMatchDetails && officialResult && !isEditingMatches && (
        <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#f9fafb", borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: "0.75rem", color: "#6b7280" }}>
            Resultados de partidos
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
                      {homeTeam?.name || "Desconocido"}
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
                      {awayTeam?.name || "Desconocido"}
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
            {loadingBreakdown ? "Cargando..." : "Ver desglose de puntos"}
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
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: isMobile ? 0 : "1rem",
          }}
          onClick={() => { setShowBreakdown(false); setBreakdownData(null); }}
        >
          <div
            style={{
              background: "white",
              borderRadius: isMobile ? "16px 16px 0 0" : 16,
              maxWidth: isMobile ? "100%" : 450,
              width: "100%",
              maxHeight: isMobile ? "85vh" : "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                padding: "1rem 1.25rem",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Desglose - {groupName}</h3>
              <button
                onClick={() => { setShowBreakdown(false); setBreakdownData(null); }}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "white",
                  width: TOUCH_TARGET.minimum,
                  height: TOUCH_TARGET.minimum,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.25rem", overflowY: "auto", flex: 1 }}>
              {loadingBreakdown && (
                <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
                  Cargando desglose...
                </div>
              )}

              {breakdownData && (
                <>
                  {/* Summary */}
                  <div
                    style={{
                      background:
                        breakdownData.totalPointsEarned === breakdownData.totalPointsMax
                          ? "linear-gradient(135deg, #28a745 0%, #20c997 100%)"
                          : breakdownData.totalPointsEarned > 0
                          ? "linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)"
                          : "linear-gradient(135deg, #6c757d 0%, #495057 100%)",
                      padding: "1rem",
                      borderRadius: 12,
                      color: "white",
                      textAlign: "center",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={{ fontSize: 32, fontWeight: 900 }}>
                      {breakdownData.totalPointsEarned} / {breakdownData.totalPointsMax}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>puntos obtenidos</div>
                  </div>

                  {/* Config info */}
                  <div
                    style={{
                      background: "#e7f3ff",
                      padding: "0.6rem 0.75rem",
                      borderRadius: 6,
                      marginBottom: "1rem",
                      fontSize: 12,
                      color: "#004085",
                    }}
                  >
                    <strong>{breakdownData.config.pointsPerExactPosition} pts</strong> por posición exacta
                    {breakdownData.config.bonusPerfectGroup && (
                      <> | <strong>+{breakdownData.config.bonusPerfectGroup} pts</strong> bonus grupo perfecto</>
                    )}
                  </div>

                  {/* No pick message */}
                  {!breakdownData.hasPick && (
                    <div style={{ textAlign: "center", padding: "1.5rem", color: "#dc3545" }}>
                      <div style={{ fontSize: 48, marginBottom: "0.5rem" }}>🚫</div>
                      <div style={{ fontWeight: 600 }}>No hiciste predicción para este grupo</div>
                    </div>
                  )}

                  {/* Positions */}
                  {breakdownData.hasPick && breakdownData.hasResult && breakdownData.positions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      {breakdownData.positions.map((pos) => (
                        <div
                          key={pos.teamId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "0.5rem 0.75rem",
                            background: pos.matched ? "#d4edda" : "#fff",
                            borderRadius: 6,
                            border: `1px solid ${pos.matched ? "#c3e6cb" : "#e5e7eb"}`,
                          }}
                        >
                          <span style={{ fontWeight: 700, width: 24, fontSize: 14 }}>{pos.position}°</span>
                          <span style={{ flex: 1, fontSize: 13 }}>{pos.teamName || pos.teamId}</span>
                          {pos.predictedPosition !== null && pos.predictedPosition !== pos.position && (
                            <span style={{ color: "#6c757d", fontSize: 11 }}>
                              (tú: {pos.predictedPosition}°)
                            </span>
                          )}
                          <span style={{ fontSize: 18 }}>{pos.matched ? "✅" : "❌"}</span>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              color: pos.matched ? "#28a745" : "#6c757d",
                              minWidth: 35,
                              textAlign: "right",
                            }}
                          >
                            +{pos.pointsEarned}
                          </span>
                        </div>
                      ))}

                      {/* Bonus */}
                      {breakdownData.bonusPerfectGroup.enabled && (
                        <div
                          style={{
                            marginTop: "0.5rem",
                            padding: "0.5rem 0.75rem",
                            background: breakdownData.bonusPerfectGroup.achieved ? "#d4edda" : "#f8f9fa",
                            borderRadius: 6,
                            border: `1px solid ${breakdownData.bonusPerfectGroup.achieved ? "#c3e6cb" : "#e5e7eb"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ fontSize: 13 }}>
                            {breakdownData.bonusPerfectGroup.achieved ? "🌟 " : ""}
                            Bonus grupo perfecto
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              color: breakdownData.bonusPerfectGroup.achieved ? "#28a745" : "#6c757d",
                            }}
                          >
                            +{breakdownData.bonusPerfectGroup.pointsEarned}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Static team list with medals
function StaticTeamList({ teams, orderedTeamIds, isMobile }: { teams: Team[]; orderedTeamIds: string[]; isOfficial?: boolean; isMobile?: boolean }) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const orderedTeams = orderedTeamIds.map((id) => teamMap.get(id)!).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "0.5rem" : "0.35rem" }}>
      {orderedTeams.map((team, index) => (
        <div
          key={team.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: isMobile ? "0.65rem 0.75rem" : "0.5rem 0.75rem",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
          }}
        >
          <span style={{ fontSize: 16, width: 24 }}>{MEDALS[index]}</span>
          <span style={{ fontSize: isMobile ? 13 : 12, color: "#6b7280", width: 20 }}>{index + 1}.</span>
          <span style={{ fontSize: isMobile ? 14 : 13, fontWeight: 500, color: "#1f2937" }}>{team.name}</span>
        </div>
      ))}
    </div>
  );
}

// Draggable team list
function DraggableTeamList({
  teams,
  orderedTeamIds,
  onOrderChange,
  disabled,
  isMobile,
}: {
  teams: Team[];
  orderedTeamIds: string[];
  onOrderChange: (ids: string[]) => void;
  disabled: boolean;
  isMobile?: boolean;
}) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const orderedTeams = orderedTeamIds.map((id) => teamMap.get(id)!).filter(Boolean);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || disabled) return;

    const oldIndex = orderedTeams.findIndex((item) => item.id === active.id);
    const newIndex = orderedTeams.findIndex((item) => item.id === over.id);
    const newOrder = arrayMove(orderedTeams, oldIndex, newIndex);

    setTimeout(() => {
      onOrderChange(newOrder.map((t) => t.id));
    }, 0);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedTeams.map((t) => t.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "0.5rem" : "0.35rem" }}>
          {orderedTeams.map((team, index) => (
            <SortableTeamItem key={team.id} team={team} position={index} disabled={disabled} isMobile={isMobile} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// Sortable team item
function SortableTeamItem({ team, position, disabled, isMobile }: { team: Team; position: number; disabled: boolean; isMobile?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: team.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: isMobile ? "0.65rem 0.75rem" : "0.5rem 0.75rem",
          background: "#fff",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          cursor: disabled ? "not-allowed" : "grab",
          minHeight: isMobile ? TOUCH_TARGET.comfortable : undefined,
          ...(isMobile ? mobileInteractiveStyles.tapHighlight : {}),
        }}
      >
        <span style={{ fontSize: 16, width: 24 }}>{MEDALS[position]}</span>
        <span style={{ fontSize: isMobile ? 13 : 12, color: "#6b7280", width: 20 }}>{position + 1}.</span>
        <span style={{ fontSize: isMobile ? 14 : 13, fontWeight: 500, color: "#1f2937", flex: 1 }}>{team.name}</span>
        {!disabled && <span style={{ color: "#9ca3af", fontSize: isMobile ? 18 : 14 }}>⋮⋮</span>}
      </div>
    </div>
  );
}
