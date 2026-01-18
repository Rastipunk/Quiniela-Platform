// Gestor principal de picks estructurales (preset SIMPLE)
// Sprint 2 - Advanced Pick Types System

import { useState, useEffect, useMemo } from "react";
import { GroupStandingsCard } from "./GroupStandingsCard";
import { KnockoutMatchCard } from "./KnockoutMatchCard";
import {
  upsertStructuralPick,
  getStructuralPick,
  publishStructuralResult,
  getStructuralResult,
} from "../lib/api";
import type {
  GroupStandingsPhasePickData,
  KnockoutPhasePickData,
  PhasePickConfig,
} from "../types/pickConfig";

type Team = {
  id: string;
  name: string;
  flag?: string;
};

type GroupMatch = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffUtc: string;
};

type Group = {
  id: string;
  name: string;
  teams: Team[];
  matches: GroupMatch[];
};

type Match = {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  kickoffUtc: string;
};

type MatchResult = {
  homeGoals: number;
  awayGoals: number;
  homePenalties?: number | null;
  awayPenalties?: number | null;
};

type StructuralPicksManagerProps = {
  poolId: string;
  phaseId: string;
  phaseName: string;
  phaseType: "GROUP" | "KNOCKOUT";
  phaseConfig: PhasePickConfig;
  tournamentData: any; // Template data completo
  token: string;
  isHost: boolean;
  isLocked: boolean; // Si ya se publicó resultado oficial
  // Resultados existentes de partidos (por matchId)
  matchResults?: Map<string, MatchResult>;
  // Callback para refrescar datos después de cambios
  onDataChanged?: () => void;
  // Callback para mostrar desglose de puntuación
  onShowBreakdown?: () => void;
};

export function StructuralPicksManager({
  poolId,
  phaseId,
  phaseName: _phaseName,
  phaseType,
  phaseConfig: _phaseConfig,
  tournamentData,
  token,
  isHost,
  isLocked,
  matchResults,
  onDataChanged,
  onShowBreakdown: _onShowBreakdown,
}: StructuralPicksManagerProps) {
  void _phaseName; // Used for display in child components
  void _phaseConfig; // Config passed to child components
  const [loading, setLoading] = useState(true);
  const [_saving, _setSaving] = useState(false);
  void _saving; // For future use with batch save
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estado para GROUP_STANDINGS
  const [groupPicks, setGroupPicks] = useState<Map<string, string[]>>(new Map());

  // Estado para KNOCKOUT_WINNER
  const [knockoutPicks, setKnockoutPicks] = useState<Map<string, string>>(new Map());

  // Cargar datos iniciales
  useEffect(() => {
    async function loadPickData() {
      try {
        setLoading(true);
        setError(null);

        // Para KNOCKOUT phases, los resultados de partidos vienen como prop (matchResults)
        // Solo necesitamos cargar los picks del usuario
        if (phaseType === "KNOCKOUT") {
          // Cargar picks del usuario (no structural results, porque knockout usa Result de partidos)
          const { pick } = await getStructuralPick(token, poolId, phaseId);
          if (pick) {
            loadPickData_internal(pick);
          }
          setLoading(false);
          return;
        }

        // Para GROUP phases, la lógica original
        // Si es HOST publicando resultados, cargar resultado oficial si existe
        if (isHost) {
          const { result } = await getStructuralResult(token, poolId, phaseId);
          if (result) {
            loadResultData(result.resultJson);
            setLoading(false);
            return;
          }
        }

        // Cargar pick del usuario
        const { pick } = await getStructuralPick(token, poolId, phaseId);
        if (pick) {
          loadPickData_internal(pick);
        }
      } catch (err: any) {
        setError(err?.message || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }

    loadPickData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, phaseId, token, isHost, phaseType]);

  function loadPickData_internal(pickData: any) {
    if (phaseType === "GROUP") {
      const data = pickData as GroupStandingsPhasePickData;
      const newMap = new Map<string, string[]>();
      data.groups.forEach((g) => {
        newMap.set(g.groupId, g.teamIds);
      });
      setGroupPicks(newMap);
    } else {
      const data = pickData as KnockoutPhasePickData;
      const newMap = new Map<string, string>();
      data.matches.forEach((m) => {
        newMap.set(m.matchId, m.winnerId);
      });
      setKnockoutPicks(newMap);
    }
  }

  function loadResultData(resultData: any) {
    // Mismo formato que picks
    loadPickData_internal(resultData);
  }

  // Note: handleSave is preserved for potential future batch-save functionality
  // Currently, individual components (GroupStandingsCard, KnockoutMatchCard) handle their own saves
  async function _handleSave() {
    try {
      _setSaving(true);
      setError(null);
      setSuccessMessage(null);

      let pickData: any;

      if (phaseType === "GROUP") {
        // Construir payload para GROUP_STANDINGS
        const groups: any[] = [];
        groupPicks.forEach((teamIds, groupId) => {
          groups.push({ groupId, teamIds });
        });
        pickData = { groups };

        // Validación: debe haber al menos un grupo completo
        if (groups.length === 0) {
          setError("Debes ordenar al menos un grupo antes de guardar");
          return;
        }
      } else {
        // Construir payload para KNOCKOUT_WINNER
        const matches: any[] = [];
        knockoutPicks.forEach((winnerId, matchId) => {
          matches.push({ matchId, winnerId });
        });
        pickData = { matches };

        // Validación: debe haber al menos un ganador seleccionado
        if (matches.length === 0) {
          setError("Debes seleccionar al menos un ganador antes de guardar");
          return;
        }
      }

      console.log("💾 Guardando picks:", pickData);

      if (isHost) {
        // HOST publicando resultado oficial
        await publishStructuralResult(token, poolId, phaseId, pickData);
        setSuccessMessage("✅ Resultado oficial publicado exitosamente");
      } else {
        // PLAYER guardando pick
        await upsertStructuralPick(token, poolId, phaseId, pickData);
        setSuccessMessage("✅ Predicción guardada exitosamente");
      }

      // Auto-hide success message después de 3 segundos
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error("❌ Error al guardar:", err);
      setError(err?.message || "Error al guardar");
    } finally {
      _setSaving(false);
    }
  }
  void _handleSave; // Preserved for future batch-save

  // Extraer grupos y partidos del tournament data
  const groups = useMemo(() => extractGroups(tournamentData, phaseId), [tournamentData, phaseId]);
  const matches = useMemo(() => extractMatches(tournamentData, phaseId), [tournamentData, phaseId]);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: 18, color: "#666" }}>⏳ Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "1.5rem",
          background: "#f8d7da",
          border: "1px solid #f5c6cb",
          borderRadius: 8,
          color: "#721c24",
        }}
      >
        ❌ <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem 0" }}>
      {/* Header */}
      <div
        style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          background: phaseType === "GROUP"
            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
          borderRadius: 12,
          color: "white",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem 0", fontSize: 24, fontWeight: 900, color: "white" }}>
          {phaseType === "GROUP"
            ? (isHost ? "📊 Publicar Resultados de Grupos" : "🎯 Predecir Posiciones de Grupos")
            : "⚔️ Fase Eliminatoria"}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "white", opacity: 1 }}>
          {phaseType === "GROUP"
            ? "Ordena los equipos del 1° al 4° lugar en cada grupo"
            : (isHost
                ? "Publica el resultado de cada partido (los jugadores predicen quién avanza)"
                : "Selecciona qué equipo avanza en cada partido")}
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            background: "#d4edda",
            border: "1px solid #c3e6cb",
            borderRadius: 8,
            color: "#155724",
            fontWeight: 600,
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Pickers por tipo de fase */}
      {phaseType === "GROUP" ? (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {groups.map((group) => (
            <GroupStandingsCard
              key={group.id}
              poolId={poolId}
              phaseId={phaseId}
              groupId={group.id}
              groupName={group.name}
              teams={group.teams}
              matches={group.matches}
              token={token}
              isHost={isHost}
              isLocked={isLocked}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {matches.map((match) => {
            const existingResult = matchResults?.get(match.id);
            return (
              <KnockoutMatchCard
                key={match.id}
                poolId={poolId}
                phaseId={phaseId}
                matchId={match.id}
                homeTeam={match.homeTeam}
                awayTeam={match.awayTeam}
                kickoffUtc={match.kickoffUtc}
                token={token}
                isHost={isHost}
                isLocked={isLocked}
                existingResult={existingResult || null}
                existingPick={knockoutPicks.get(match.id) || null}
                onResultSaved={() => {
                  onDataChanged?.();
                }}
                onPickSaved={() => {
                  // Actualizar estado local
                  onDataChanged?.();
                }}
              />
            );
          })}
        </div>
      )}

      {/* Info message para fase bloqueada */}
      {isLocked && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1.5rem",
            background: "#e7f3ff",
            border: "1px solid #b3d9ff",
            borderRadius: 12,
            textAlign: "center",
            color: "#004085",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: _onShowBreakdown ? "1rem" : 0 }}>
            {isHost ? "Todos los resultados oficiales han sido publicados" : "Fase bloqueada - Los resultados oficiales ya fueron publicados"}
          </div>
          {_onShowBreakdown && (
            <button
              onClick={_onShowBreakdown}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>📊</span>
              Ver desglose de puntos
            </button>
          )}
        </div>
      )}

      {/* Progreso para KNOCKOUT */}
      {!isLocked && phaseType === "KNOCKOUT" && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            background: "#f8fafc",
            borderRadius: 8,
            textAlign: "center",
            fontSize: 13,
            color: "#64748b",
          }}
        >
          {isHost
            ? `Resultados publicados: ${matchResults?.size || 0}/${matches.length} partidos`
            : `Predicciones guardadas: ${knockoutPicks.size}/${matches.length} partidos`}
        </div>
      )}
    </div>
  );
}

// ==================== HELPER FUNCTIONS ====================

function extractGroups(tournamentData: any, _phaseId: string): Group[] {
  // En WC2026 sandbox, los grupos no están dentro de las fases
  // Los equipos tienen groupId, así que agrupamos por ese campo
  const allTeams = tournamentData?.teams || [];
  const allMatches = tournamentData?.matches || [];

  // Agrupar equipos por groupId
  const teamsByGroup = new Map<string, Team[]>();
  for (const team of allTeams) {
    if (!team.groupId) continue;
    const group = teamsByGroup.get(team.groupId) || [];
    group.push({
      id: team.id,
      name: team.name,
      flag: team.flag,
    });
    teamsByGroup.set(team.groupId, group);
  }

  // Agrupar partidos por groupId
  const matchesByGroup = new Map<string, GroupMatch[]>();
  for (const match of allMatches) {
    if (!match.groupId) continue;
    const group = matchesByGroup.get(match.groupId) || [];
    group.push({
      id: match.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      kickoffUtc: match.kickoffUtc,
    });
    matchesByGroup.set(match.groupId, group);
  }

  // Convertir a array de grupos
  const groups: Group[] = [];
  teamsByGroup.forEach((teams, groupId) => {
    groups.push({
      id: groupId,
      name: `Grupo ${groupId}`,
      teams,
      matches: matchesByGroup.get(groupId) || [],
    });
  });

  // Ordenar alfabéticamente
  return groups.sort((a, b) => a.id.localeCompare(b.id));
}

function extractMatches(tournamentData: any, phaseId: string): Match[] {
  const allMatches = tournamentData?.matches || [];
  return allMatches
    .filter((m: any) => m.phaseId === phaseId)
    .map((m: any) => {
      // Buscar equipos en el template
      const teams = tournamentData?.teams || [];
      const homeTeam = teams.find((t: any) => t.id === m.homeTeamId);
      const awayTeam = teams.find((t: any) => t.id === m.awayTeamId);

      return {
        id: m.id,
        homeTeam: homeTeam || { id: m.homeTeamId, name: "TBD" },
        awayTeam: awayTeam || { id: m.awayTeamId, name: "TBD" },
        kickoffUtc: m.kickoffUtc,
      };
    });
}
