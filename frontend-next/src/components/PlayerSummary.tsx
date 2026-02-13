"use client";

// frontend-next/src/components/PlayerSummary.tsx
// Componente que muestra el resumen detallado de puntos de un jugador

import { useState, useEffect, useRef } from "react";
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

// Grid template: home column auto-sizes to widest name, "vs" stays close
// [home:auto] [vs:20px] [away:1fr] [pick:70px] [result:70px] [points:80px]
const GRID_TEMPLATE = "auto 20px 1fr 70px 70px 80px";

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
  HOME_GOALS: "#fd7e14",
  AWAY_GOALS: "#e83e8c",
};

// Popover for breakdown details
function BreakdownPopover({ breakdown, onClose }: {
  breakdown: Array<{ type: string; matched: boolean; points: number }>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const matched = breakdown.filter((b) => b.matched);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        right: 0,
        top: "100%",
        marginTop: 4,
        backgroundColor: "#fff",
        border: "1px solid #ddd",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        padding: "8px 12px",
        zIndex: 50,
        minWidth: 160,
        whiteSpace: "nowrap",
      }}
    >
      {matched.length === 0 ? (
        <div style={{ fontSize: 12, color: "#999" }}>Sin aciertos</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {matched.map((b, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: typeColors[b.type] ?? "#6c757d",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: "#333" }}>{typeLabels[b.type] ?? b.type}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: typeColors[b.type] ?? "#6c757d", marginLeft: "auto" }}>
                +{b.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

// Componente para una fila de partido (usa display:contents para compartir grid del padre)
function MatchRow({ match, tournamentKey }: { match: PlayerSummaryMatch; tournamentKey: string }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const colors = statusColors[match.status] ?? statusColors.LOCKED;
  const hasBreakdown = match.status === "SCORED" && match.breakdown?.some((b) => b.matched);
  const rowBg = match.status === "SCORED" && match.pointsEarned > 0 ? "#f8fff8" : "#fff";

  // Shared style for all cells in this row (continuous background, no gaps)
  const cell: React.CSSProperties = {
    backgroundColor: rowBg,
    borderBottom: "1px solid #eee",
    padding: "10px 4px",
    display: "flex",
    alignItems: "center",
  };

  return (
    <div style={{ display: "contents" }}>
      {/* Equipo local */}
      <div style={{ ...cell, paddingLeft: 16, gap: 4, whiteSpace: "nowrap" }}>
        {match.homeTeam ? (
          <TeamFlag
            teamId={`t_${match.homeTeam.code ?? match.homeTeam.id}`}
            tournamentKey={tournamentKey}
            size="sm"
            showName={true}
          />
        ) : (
          <span style={{ color: "#999", fontSize: 13 }}>TBD</span>
        )}
      </div>

      {/* VS */}
      <div style={{ ...cell, justifyContent: "center" }}>
        <span style={{ color: "#aaa", fontSize: 11 }}>vs</span>
      </div>

      {/* Equipo visitante */}
      <div style={{ ...cell, gap: 4, overflow: "hidden" }}>
        {match.awayTeam ? (
          <TeamFlag
            teamId={`t_${match.awayTeam.code ?? match.awayTeam.id}`}
            tournamentKey={tournamentKey}
            size="sm"
            showName={true}
          />
        ) : (
          <span style={{ color: "#999", fontSize: 13 }}>TBD</span>
        )}
      </div>

      {/* Mi Pick */}
      <div style={{ ...cell, justifyContent: "center" }}>
        {match.pick ? (
          <span style={{ fontWeight: 600, color: "#333", fontSize: 14 }}>
            {match.pick.homeGoals} - {match.pick.awayGoals}
          </span>
        ) : (
          <span style={{ color: "#bbb", fontSize: 13 }}>-</span>
        )}
      </div>

      {/* Resultado oficial */}
      <div style={{ ...cell, justifyContent: "center" }}>
        {match.result ? (
          <span
            style={{
              fontWeight: 700,
              color: "#007bff",
              backgroundColor: "#e7f3ff",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 14,
            }}
          >
            {match.result.homeGoals} - {match.result.awayGoals}
          </span>
        ) : (
          <span style={{ color: "#bbb", fontSize: 13 }}>-</span>
        )}
      </div>

      {/* Puntos (con popover de breakdown) */}
      <div style={{ ...cell, justifyContent: "flex-end", paddingRight: 16, position: "relative" }}>
        {match.status === "SCORED" ? (
          <span
            onClick={hasBreakdown ? () => setShowBreakdown(!showBreakdown) : undefined}
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: match.pointsEarned > 0 ? "#28a745" : "#dc3545",
              cursor: hasBreakdown ? "pointer" : "default",
              borderBottom: hasBreakdown ? "1px dashed currentColor" : "none",
              paddingBottom: 1,
            }}
          >
            {match.pointsEarned > 0 ? `+${match.pointsEarned}` : "0"} pts
          </span>
        ) : (
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 11,
              backgroundColor: colors.bg,
              color: colors.text,
            }}
          >
            {statusLabels[match.status]}
          </span>
        )}
        {showBreakdown && (
          <BreakdownPopover
            breakdown={match.breakdown}
            onClose={() => setShowBreakdown(false)}
          />
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

      {/* Contenido expandible: single grid so all rows share column tracks */}
      {expanded && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID_TEMPLATE,
          }}
        >
          {/* Header row (display:contents so cells participate in the grid) */}
          <div
            style={{ display: "contents" }}
          >
            {[
              { label: "Local", align: "left" as const, pl: 16 },
              { label: "", align: "center" as const },
              { label: "Visitante", align: "left" as const },
              { label: "Mi Pick", align: "center" as const },
              { label: "Resultado", align: "center" as const },
              { label: "Puntos", align: "right" as const, pr: 16 },
            ].map((h, i) => (
              <span
                key={i}
                style={{
                  backgroundColor: "#f1f3f5",
                  padding: "8px 4px",
                  paddingLeft: h.pl ?? 4,
                  paddingRight: h.pr ?? 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#666",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  textAlign: h.align,
                  borderBottom: "1px solid #ddd",
                }}
              >
                {h.label}
              </span>
            ))}
          </div>

          {/* Match rows (each uses display:contents) */}
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
