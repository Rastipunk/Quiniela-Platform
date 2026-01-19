// frontend/src/components/PlayerSummary.tsx
// Componente que muestra el resumen detallado de puntos de un jugador

import { useState, useEffect } from "react";
import { getPlayerSummary } from "../lib/api";
import type { PlayerSummaryResponse, PlayerSummaryPhase, PlayerSummaryMatch } from "../lib/api";
import { getToken } from "../lib/auth";
import { TeamFlag } from "./TeamFlag";

type PlayerSummaryProps = {
  poolId: string;
  userId: string;
  tournamentKey?: string;
  initialPhase?: string; // Fase a expandir por defecto (si viene del click en columna de fase)
  onClose?: () => void; // Si se usa en modal
};

// Badge para mostrar tipo de acierto
function MatchTypeBadge({ type, matched, points }: { type: string; matched: boolean; points: number }) {
  if (!matched) return null;

  const typeLabels: Record<string, string> = {
    EXACT_SCORE: "Exacto",
    GOAL_DIFFERENCE: "Diferencia",
    PARTIAL_SCORE: "Parcial",
    TOTAL_GOALS: "Total goles",
    OUTCOME: "Resultado",
    MATCH_OUTCOME_90MIN: "Resultado",
    HOME_GOALS: "Local",
    AWAY_GOALS: "Visitante",
  };

  const typeColors: Record<string, string> = {
    EXACT_SCORE: "#28a745",
    GOAL_DIFFERENCE: "#17a2b8",
    PARTIAL_SCORE: "#ffc107",
    TOTAL_GOALS: "#6c757d",
    OUTCOME: "#007bff",
    MATCH_OUTCOME_90MIN: "#007bff",
    HOME_GOALS: "#fd7e14",  // Orange
    AWAY_GOALS: "#e83e8c",  // Pink
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: typeColors[type] ?? "#6c757d",
        color: "#fff",
      }}
    >
      {typeLabels[type] ?? type} +{points}
    </span>
  );
}

// Componente para una fila de partido
function MatchRow({ match, tournamentKey }: { match: PlayerSummaryMatch; tournamentKey: string }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    SCORED: { bg: "#d4edda", text: "#155724" },
    NO_PICK: { bg: "#f8d7da", text: "#721c24" },
    PENDING_RESULT: { bg: "#fff3cd", text: "#856404" },
    LOCKED: { bg: "#e2e3e5", text: "#383d41" },
  };

  const statusLabels: Record<string, string> = {
    SCORED: "Puntuado",
    NO_PICK: "Sin pick",
    PENDING_RESULT: "Esperando resultado",
    LOCKED: "Bloqueado",
  };

  const colors = statusColors[match.status] ?? statusColors.LOCKED;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr auto auto auto",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid #eee",
        backgroundColor: match.status === "SCORED" && match.pointsEarned > 0 ? "#f8fff8" : "#fff",
      }}
    >
      {/* Equipo local */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {match.homeTeam ? (
          <TeamFlag
            teamId={`t_${match.homeTeam.code ?? match.homeTeam.id}`}
            tournamentKey={tournamentKey}
            size="sm"
            showName={true}
          />
        ) : (
          <span style={{ color: "#999" }}>TBD</span>
        )}
      </div>

      {/* VS */}
      <span style={{ color: "#999", fontSize: 12 }}>vs</span>

      {/* Equipo visitante */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {match.awayTeam ? (
          <TeamFlag
            teamId={`t_${match.awayTeam.code ?? match.awayTeam.id}`}
            tournamentKey={tournamentKey}
            size="sm"
            showName={true}
          />
        ) : (
          <span style={{ color: "#999" }}>TBD</span>
        )}
      </div>

      {/* Pick del usuario */}
      <div style={{ textAlign: "center", minWidth: 60 }}>
        {match.pick ? (
          <span style={{ fontWeight: 600, color: "#333" }}>
            {match.pick.homeGoals} - {match.pick.awayGoals}
          </span>
        ) : (
          <span style={{ color: "#999", fontSize: 12 }}>-</span>
        )}
      </div>

      {/* Resultado oficial */}
      <div style={{ textAlign: "center", minWidth: 60 }}>
        {match.result ? (
          <span
            style={{
              fontWeight: 700,
              color: "#007bff",
              backgroundColor: "#e7f3ff",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {match.result.homeGoals} - {match.result.awayGoals}
          </span>
        ) : (
          <span style={{ color: "#999", fontSize: 12 }}>-</span>
        )}
      </div>

      {/* Puntos y badges */}
      <div style={{ textAlign: "right", minWidth: 100 }}>
        {match.status === "SCORED" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: match.pointsEarned > 0 ? "#28a745" : "#dc3545" }}>
              {match.pointsEarned > 0 ? `+${match.pointsEarned}` : "0"} pts
            </span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {match.breakdown
                .filter((b) => b.matched)
                .map((b, idx) => (
                  <MatchTypeBadge key={idx} type={b.type} matched={b.matched} points={b.points} />
                ))}
            </div>
          </div>
        ) : (
          <span
            style={{
              display: "inline-block",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 11,
              backgroundColor: colors.bg,
              color: colors.text,
            }}
          >
            {statusLabels[match.status]}
          </span>
        )}
      </div>
    </div>
  );
}

// Componente para una fase
function PhaseSection({ phase, tournamentKey, defaultExpanded }: { phase: PlayerSummaryPhase; tournamentKey: string; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  const successRate = phase.scoredCount > 0
    ? Math.round((phase.totalPoints / (phase.maxPossiblePoints || 1)) * 100)
    : 0;

  return (
    <div style={{ marginBottom: 16, border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
      {/* Header de fase */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          backgroundColor: "#f8f9fa",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid #ddd" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>{expanded ? "▼" : "▶"}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{phase.phaseName}</div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {phase.scoredCount} de {phase.matchCount} partidos puntuados
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: "#007bff" }}>{phase.totalPoints} pts</div>
          {phase.maxPossiblePoints > 0 && (
            <div style={{ fontSize: 11, color: "#666" }}>
              {successRate}% efectividad
            </div>
          )}
        </div>
      </div>

      {/* Contenido expandible */}
      {expanded && (
        <div>
          {/* Headers de columnas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr auto auto auto",
              alignItems: "center",
              gap: 12,
              padding: "8px 16px",
              backgroundColor: "#f1f3f5",
              fontSize: 11,
              fontWeight: 600,
              color: "#666",
              textTransform: "uppercase",
            }}
          >
            <span>Local</span>
            <span></span>
            <span>Visitante</span>
            <span style={{ textAlign: "center" }}>Mi Pick</span>
            <span style={{ textAlign: "center" }}>Resultado</span>
            <span style={{ textAlign: "right" }}>Puntos</span>
          </div>

          {/* Filas de partidos */}
          {phase.matches.map((match) => (
            <MatchRow key={match.matchId} match={match} tournamentKey={tournamentKey} />
          ))}
        </div>
      )}
    </div>
  );
}

// Componente principal
export function PlayerSummary({ poolId, userId, tournamentKey = "wc_2026_sandbox", initialPhase, onClose }: PlayerSummaryProps) {
  const [data, setData] = useState<PlayerSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const token = getToken();
        if (!token) {
          setError("No autenticado");
          return;
        }
        const result = await getPlayerSummary(token, poolId, userId);
        setData(result);
      } catch (err: any) {
        setError(err.message ?? "Error cargando resumen");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [poolId, userId]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 24 }}>Cargando resumen...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#dc3545" }}>
        <div style={{ fontSize: 18 }}>Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Calcular estadísticas totales
  const totalScored = data.phases.reduce((sum, p) => sum + p.scoredCount, 0);
  const totalMaxPoints = data.phases.reduce((sum, p) => sum + p.maxPossiblePoints, 0);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header con info del jugador */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 20,
          backgroundColor: "#f8f9fa",
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 32 }}>
              {data.player.rank === 1 ? "🥇" : data.player.rank === 2 ? "🥈" : data.player.rank === 3 ? "🥉" : "👤"}
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: 24 }}>
                {data.isViewingSelf ? "Mi Resumen" : data.player.displayName}
              </h2>
              <div style={{ color: "#666", fontSize: 14 }}>
                Posición #{data.player.rank} • {data.player.role}
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#007bff" }}>{data.player.totalPoints}</div>
          <div style={{ fontSize: 14, color: "#666" }}>puntos totales</div>
        </div>
      </div>

      {/* Stats cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ padding: 16, backgroundColor: "#e7f3ff", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0056b3" }}>{data.player.rank}°</div>
          <div style={{ fontSize: 12, color: "#666" }}>Posición</div>
        </div>
        <div style={{ padding: 16, backgroundColor: "#d4edda", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#155724" }}>{data.player.totalPoints}</div>
          <div style={{ fontSize: 12, color: "#666" }}>Puntos</div>
        </div>
        <div style={{ padding: 16, backgroundColor: "#fff3cd", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#856404" }}>{totalScored}</div>
          <div style={{ fontSize: 12, color: "#666" }}>Partidos puntuados</div>
        </div>
        <div style={{ padding: 16, backgroundColor: "#f8d7da", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#721c24" }}>
            {totalMaxPoints > 0 ? Math.round((data.player.totalPoints / totalMaxPoints) * 100) : 0}%
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>Efectividad</div>
        </div>
      </div>

      {/* Nota para otros jugadores */}
      {!data.isViewingSelf && (
        <div
          style={{
            padding: 12,
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
            color: "#856404",
          }}
        >
          Solo se muestran los picks de partidos cuyo deadline ya pasó.
        </div>
      )}

      {/* Fases */}
      <h3 style={{ fontSize: 18, marginBottom: 16, color: "#333" }}>Desglose por fase</h3>
      {data.phases.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
          No hay partidos visibles todavía
        </div>
      ) : (
        data.phases.map((phase, idx) => (
          <PhaseSection
            key={phase.phaseId}
            phase={phase}
            tournamentKey={tournamentKey}
            defaultExpanded={initialPhase ? phase.phaseId === initialPhase : idx === 0}
          />
        ))
      )}

      {/* Botón cerrar si es modal */}
      {onClose && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 30px",
              backgroundColor: "#6c757d",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
