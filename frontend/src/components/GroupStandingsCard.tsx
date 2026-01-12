// Componente unificado para GROUP_STANDINGS
// HOST: Ingresa resultados de 6 partidos → genera posiciones automáticamente
// PLAYER: Arrastra equipos para predecir orden → ve resultado oficial cuando esté

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
} from "../lib/api";

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
  // saved: true si el valor actual coincide con lo que hay en la DB (para mostrar ✓)
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
    // existsInDb nos dice si ya había un resultado guardado antes
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
      setIsEditingMatches(false); // Salir de modo edición
      setErrataReason(""); // Limpiar razón
      setSuccessMessage(officialResult ? "Posiciones actualizadas" : "Posiciones generadas");
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err?.message || "Error al generar posiciones");
    } finally {
      setGeneratingStandings(false);
    }
  }

  // Entrar en modo edición de partidos (errata flow)
  function handleEnterEditMode() {
    setIsEditingMatches(true);
    setShowMatchDetails(false);
    setErrataReason("");
  }

  // Cancelar edición de partidos
  function handleCancelEdit() {
    setIsEditingMatches(false);
    setErrataReason("");
    // Recargar datos para descartar cambios no guardados
    loadData();
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
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.25rem", background: "#fff", textAlign: "center" }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.25rem", background: "#fff" }}>
      {/* Header */}
      <h3 style={{ margin: "0 0 1rem 0", fontSize: 16, fontWeight: 700, color: "#1f2937" }}>{groupName}</h3>

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

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
              />
              {!isLocked && (
                <button
                  onClick={handleSavePlayerPick}
                  disabled={savingPick}
                  style={{
                    width: "100%",
                    marginTop: "0.75rem",
                    padding: "0.6rem",
                    fontSize: 13,
                    fontWeight: 600,
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: savingPick ? "not-allowed" : "pointer",
                  }}
                >
                  {savingPick ? "Guardando..." : "Guardar"}
                </button>
              )}
            </>
          ) : (
            <>
              <StaticTeamList teams={teams} orderedTeamIds={playerPick} />
              {!isLocked && (
                <button
                  onClick={() => setIsEditingPick(true)}
                  style={{
                    width: "100%",
                    marginTop: "0.75rem",
                    padding: "0.6rem",
                    fontSize: 13,
                    fontWeight: 600,
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    cursor: "pointer",
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
              <StaticTeamList teams={teams} orderedTeamIds={officialResult} isOfficial />
              {isHost && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    onClick={() => setShowMatchDetails(!showMatchDetails)}
                    style={{
                      flex: 1,
                      padding: "0.4rem",
                      fontSize: 12,
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {showMatchDetails ? "Ocultar partidos" : "Ver partidos"}
                  </button>
                  <button
                    onClick={handleEnterEditMode}
                    style={{
                      flex: 1,
                      padding: "0.4rem",
                      fontSize: 12,
                      background: "#fef3c7",
                      color: "#92400e",
                      border: "1px solid #fcd34d",
                      borderRadius: 4,
                      cursor: "pointer",
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

              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
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
                        gap: "0.35rem",
                        padding: "0.3rem",
                        background: state.saved ? "#f0fdf4" : "#f9fafb",
                        borderRadius: 4,
                        border: state.saved ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 500, width: 40, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {homeTeam?.code || homeTeam?.name?.slice(0, 3).toUpperCase()}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={state.homeGoals}
                        onChange={(e) => updateMatchResult(match.id, "homeGoals", e.target.value)}
                        disabled={isSaving}
                        style={{ width: 28, padding: "0.15rem", fontSize: 12, textAlign: "center", border: "1px solid #d1d5db", borderRadius: 3 }}
                      />
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>-</span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={state.awayGoals}
                        onChange={(e) => updateMatchResult(match.id, "awayGoals", e.target.value)}
                        disabled={isSaving}
                        style={{ width: 28, padding: "0.15rem", fontSize: 12, textAlign: "center", border: "1px solid #d1d5db", borderRadius: 3 }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 500, width: 40, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {awayTeam?.code || awayTeam?.name?.slice(0, 3).toUpperCase()}
                      </span>
                      <button
                        onClick={() => handleSaveMatchResult(match.id, needsReason ? errataReason : undefined)}
                        disabled={isSaving || !state.homeGoals || !state.awayGoals || (needsReason && !errataReason.trim())}
                        title={needsReason && !errataReason.trim() ? "Escribe una razón abajo" : undefined}
                        style={{
                          padding: "0.15rem 0.3rem",
                          fontSize: 10,
                          fontWeight: 600,
                          background: state.saved ? "#10b981" : isSaving ? "#d1d5db" : "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: 3,
                          cursor: isSaving || !state.homeGoals || !state.awayGoals || (needsReason && !errataReason.trim()) ? "not-allowed" : "pointer",
                          minWidth: 32,
                          opacity: (needsReason && !errataReason.trim()) ? 0.5 : 1,
                        }}
                      >
                        {isSaving ? "..." : state.saved ? "✓" : "OK"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Campo de razón para errata (solo cuando hay partidos que ya existen en DB) */}
              {Array.from(matchResults.values()).some(s => s.existsInDb) && (
                <div style={{ marginTop: "0.75rem" }}>
                  <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: "0.25rem" }}>
                    Razón de corrección (requerido):
                  </label>
                  <input
                    type="text"
                    value={errataReason}
                    onChange={(e) => setErrataReason(e.target.value)}
                    placeholder="Ej: Error de tipeo, resultado oficial corregido..."
                    style={{
                      width: "100%",
                      padding: "0.4rem",
                      fontSize: 12,
                      border: "1px solid #fcd34d",
                      borderRadius: 4,
                      background: "#fffbeb",
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
                      padding: "0.6rem",
                      fontSize: 13,
                      fontWeight: 600,
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      cursor: "pointer",
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
                      padding: "0.6rem",
                      fontSize: 13,
                      fontWeight: 600,
                      background: generatingStandings ? "#d1d5db" : "#f59e0b",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: generatingStandings ? "not-allowed" : "pointer",
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
    </div>
  );
}

// Static team list with medals
function StaticTeamList({ teams, orderedTeamIds }: { teams: Team[]; orderedTeamIds: string[]; isOfficial?: boolean }) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const orderedTeams = orderedTeamIds.map((id) => teamMap.get(id)!).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      {orderedTeams.map((team, index) => (
        <div
          key={team.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 16, width: 24 }}>{MEDALS[index]}</span>
          <span style={{ fontSize: 12, color: "#6b7280", width: 20 }}>{index + 1}.</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#1f2937" }}>{team.name}</span>
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
}: {
  teams: Team[];
  orderedTeamIds: string[];
  onOrderChange: (ids: string[]) => void;
  disabled: boolean;
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
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {orderedTeams.map((team, index) => (
            <SortableTeamItem key={team.id} team={team} position={index} disabled={disabled} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// Sortable team item
function SortableTeamItem({ team, position, disabled }: { team: Team; position: number; disabled: boolean }) {
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
          padding: "0.5rem 0.75rem",
          background: "#fff",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          cursor: disabled ? "not-allowed" : "grab",
        }}
      >
        <span style={{ fontSize: 16, width: 24 }}>{MEDALS[position]}</span>
        <span style={{ fontSize: 12, color: "#6b7280", width: 20 }}>{position + 1}.</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#1f2937", flex: 1 }}>{team.name}</span>
        {!disabled && <span style={{ color: "#9ca3af", fontSize: 14 }}>⋮⋮</span>}
      </div>
    </div>
  );
}
