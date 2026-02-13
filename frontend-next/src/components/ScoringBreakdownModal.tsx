"use client";

// Componente Modal para mostrar desglose de puntuacion
// Sprint 2 - Scoring Breakdown System

import { useState, useEffect } from "react";
import {
  getMatchBreakdown,
  getPhaseBreakdown,
  type ScoringBreakdown,
  type MatchPickBreakdown,
  type GroupStandingsBreakdown,
  type KnockoutWinnerBreakdown,
  type NoPickBreakdown,
  type RuleEvaluation,
  type GroupEvaluation,
  type KnockoutMatchEvaluation,
} from "../lib/api";
import { getToken } from "../lib/auth";

// ==================== TIPOS ====================

type BreakdownModalProps = {
  isOpen: boolean;
  onClose: () => void;
  poolId: string;
  // Para breakdown de partido
  matchId?: string;
  matchTitle?: string;
  // Para breakdown de fase estructural
  phaseId?: string;
  phaseTitle?: string;
};

// ==================== COMPONENTE PRINCIPAL ====================

export function ScoringBreakdownModal({
  isOpen,
  onClose,
  poolId,
  matchId,
  matchTitle,
  phaseId,
  phaseTitle,
}: BreakdownModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<ScoringBreakdown | null>(null);
  const [matchInfo, setMatchInfo] = useState<{
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchBreakdown = async () => {
      setLoading(true);
      setError(null);
      setBreakdown(null);
      setMatchInfo(null);

      const token = getToken();
      if (!token) {
        setError("No autorizado");
        setLoading(false);
        return;
      }

      try {
        if (matchId) {
          const data = await getMatchBreakdown(token, poolId, matchId);
          setBreakdown(data.breakdown);
          setMatchInfo({
            homeTeam: data.match.homeTeam,
            awayTeam: data.match.awayTeam,
          });
        } else if (phaseId) {
          const data = await getPhaseBreakdown(token, poolId, phaseId);
          setBreakdown(data.breakdown);
        }
      } catch (err: any) {
        setError(err.message || "Error al cargar desglose");
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdown();
  }, [isOpen, poolId, matchId, phaseId]);

  if (!isOpen) return null;

  const title = matchTitle || phaseTitle || "Desglose de Puntuacion";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          maxWidth: 600,
          width: "100%",
          maxHeight: "90vh",
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
            padding: "1.25rem 1.5rem",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            X
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
              Cargando desglose...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "1rem",
                background: "#f8d7da",
                borderRadius: 8,
                color: "#721c24",
                border: "1px solid #f5c6cb",
              }}
            >
              {error}
            </div>
          )}

          {breakdown && renderBreakdown(breakdown, matchInfo)}
        </div>
      </div>
    </div>
  );
}

// ==================== RENDER BREAKDOWN ====================

function renderBreakdown(
  breakdown: ScoringBreakdown,
  matchInfo: { homeTeam: { id: string; name: string }; awayTeam: { id: string; name: string } } | null
) {
  switch (breakdown.type) {
    case "NO_PICK":
      return <NoPickBreakdownView breakdown={breakdown} />;
    case "MATCH":
      return <MatchBreakdownView breakdown={breakdown} matchInfo={matchInfo} />;
    case "GROUP_STANDINGS":
      return <GroupStandingsBreakdownView breakdown={breakdown} />;
    case "KNOCKOUT_WINNER":
      return <KnockoutWinnerBreakdownView breakdown={breakdown} />;
    default:
      return <div>Tipo de breakdown no soportado</div>;
  }
}

// ==================== NO PICK VIEW ====================

function NoPickBreakdownView({ breakdown }: { breakdown: NoPickBreakdown }) {
  return (
    <div style={{ textAlign: "center", padding: "2rem" }}>
      <div
        style={{
          fontSize: 64,
          marginBottom: "1rem",
        }}
      >
        &#128683;
      </div>
      <h4 style={{ margin: "0 0 0.5rem 0", color: "#dc3545", fontSize: 20 }}>
        {breakdown.reason}
      </h4>
      <p style={{ margin: 0, color: "#666" }}>
        Puntos obtenidos: <strong>0</strong> / {breakdown.totalPointsMax} posibles
      </p>
    </div>
  );
}

// ==================== MATCH BREAKDOWN VIEW ====================

function MatchBreakdownView({
  breakdown,
  matchInfo,
}: {
  breakdown: MatchPickBreakdown;
  matchInfo: { homeTeam: { id: string; name: string }; awayTeam: { id: string; name: string } } | null;
}) {
  return (
    <div>
      {/* Summary Card */}
      <div
        style={{
          background:
            breakdown.totalPointsEarned === breakdown.totalPointsMax
              ? "linear-gradient(135deg, #28a745 0%, #20c997 100%)"
              : breakdown.totalPointsEarned > 0
              ? "linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)"
              : "linear-gradient(135deg, #6c757d 0%, #495057 100%)",
          padding: "1.25rem",
          borderRadius: 12,
          color: "white",
          textAlign: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 900 }}>
          {breakdown.totalPointsEarned} / {breakdown.totalPointsMax}
        </div>
        <div style={{ fontSize: 14, opacity: 0.9 }}>puntos obtenidos</div>
      </div>

      {/* Pick vs Result */}
      {matchInfo && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {/* Pick */}
          <div
            style={{
              background: "#f8f9fa",
              padding: "1rem",
              borderRadius: 8,
              border: "2px solid #dee2e6",
            }}
          >
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4, fontWeight: 600 }}>
              Tu prediccion
            </div>
            {breakdown.pick ? (
              <div style={{ fontSize: 24, fontWeight: 900, color: "#007bff" }}>
                {breakdown.pick.homeGoals} - {breakdown.pick.awayGoals}
              </div>
            ) : (
              <div style={{ fontSize: 16, color: "#dc3545" }}>Sin prediccion</div>
            )}
          </div>

          {/* Result */}
          <div
            style={{
              background: "#f8f9fa",
              padding: "1rem",
              borderRadius: 8,
              border: "2px solid #dee2e6",
            }}
          >
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4, fontWeight: 600 }}>
              Resultado oficial
            </div>
            {breakdown.result ? (
              <div style={{ fontSize: 24, fontWeight: 900, color: "#28a745" }}>
                {breakdown.result.homeGoals} - {breakdown.result.awayGoals}
              </div>
            ) : (
              <div style={{ fontSize: 16, color: "#ffc107" }}>Pendiente</div>
            )}
          </div>
        </div>
      )}

      {/* Rules Evaluation */}
      {breakdown.hasResult && breakdown.rules.length > 0 && (
        <div>
          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: 16, color: "#495057" }}>
            Evaluacion de reglas
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {breakdown.rules.map((rule) => (
              <RuleEvaluationRow key={rule.ruleKey} rule={rule} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== RULE EVALUATION ROW ====================

function RuleEvaluationRow({ rule }: { rule: RuleEvaluation }) {
  const isMatched = rule.matched;
  const isNotApplicable = rule.pointsMax === 0 && rule.details?.includes("No aplica");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0.75rem",
        background: isMatched ? "#d4edda" : isNotApplicable ? "#f8f9fa" : "#fff",
        borderRadius: 8,
        border: `1px solid ${isMatched ? "#c3e6cb" : isNotApplicable ? "#dee2e6" : "#e9ecef"}`,
      }}
    >
      {/* Icon */}
      <div style={{ fontSize: 24 }}>
        {isMatched ? "✅" : isNotApplicable ? "—" : "❌"}
      </div>

      {/* Rule Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{rule.ruleName}</div>
        {rule.details && (
          <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{rule.details}</div>
        )}
      </div>

      {/* Points */}
      <div
        style={{
          fontWeight: 900,
          fontSize: 16,
          color: isMatched ? "#28a745" : isNotApplicable ? "#adb5bd" : "#6c757d",
          minWidth: 50,
          textAlign: "right",
        }}
      >
        {isNotApplicable ? "-" : `+${rule.pointsEarned}`}
      </div>
    </div>
  );
}

// ==================== GROUP STANDINGS BREAKDOWN VIEW ====================

function GroupStandingsBreakdownView({ breakdown }: { breakdown: GroupStandingsBreakdown }) {
  return (
    <div>
      {/* Summary Card */}
      <div
        style={{
          background:
            breakdown.totalPointsEarned === breakdown.totalPointsMax
              ? "linear-gradient(135deg, #28a745 0%, #20c997 100%)"
              : breakdown.totalPointsEarned > 0
              ? "linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)"
              : "linear-gradient(135deg, #6c757d 0%, #495057 100%)",
          padding: "1.25rem",
          borderRadius: 12,
          color: "white",
          textAlign: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 900 }}>
          {breakdown.totalPointsEarned} / {breakdown.totalPointsMax}
        </div>
        <div style={{ fontSize: 14, opacity: 0.9 }}>puntos obtenidos</div>
      </div>

      {/* Config Info */}
      <div
        style={{
          background: "#e7f3ff",
          padding: "0.75rem 1rem",
          borderRadius: 8,
          marginBottom: "1rem",
          fontSize: 13,
          color: "#004085",
        }}
      >
        <strong>{breakdown.config.pointsPerExactPosition} pts</strong> por posicion exacta
        {breakdown.config.bonusPerfectGroup && (
          <> | <strong>+{breakdown.config.bonusPerfectGroup} pts</strong> bonus grupo perfecto</>
        )}
      </div>

      {/* Groups */}
      {breakdown.groups.map((group) => (
        <GroupEvaluationCard key={group.groupId} group={group} />
      ))}
    </div>
  );
}

// ==================== GROUP EVALUATION CARD ====================

function GroupEvaluationCard({ group }: { group: GroupEvaluation }) {
  const isPerfect =
    group.bonusPerfectGroup.enabled && group.bonusPerfectGroup.achieved;

  return (
    <div
      style={{
        marginBottom: "1rem",
        padding: "1rem",
        background: "#fff",
        borderRadius: 8,
        border: isPerfect ? "2px solid #28a745" : "1px solid #dee2e6",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
          {group.groupName}
          {isPerfect && <span style={{ marginLeft: 8, color: "#28a745" }}>★ Perfecto!</span>}
        </h5>
        <span style={{ fontWeight: 900, color: "#28a745" }}>
          +{group.totalPointsEarned}
        </span>
      </div>

      {!group.hasPick ? (
        <div style={{ color: "#dc3545", fontSize: 14 }}>No hiciste prediccion</div>
      ) : !group.hasResult ? (
        <div style={{ color: "#ffc107", fontSize: 14 }}>Pendiente de resultados</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {group.positions.map((pos) => (
            <div
              key={pos.teamId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 8px",
                background: pos.matched ? "#d4edda" : "#fff",
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 700, width: 20 }}>{pos.position}.</span>
              <span style={{ flex: 1 }}>{pos.teamName || pos.teamId}</span>
              {pos.predictedPosition !== null && pos.predictedPosition !== pos.position && (
                <span style={{ color: "#6c757d", fontSize: 11 }}>
                  (tu: {pos.predictedPosition})
                </span>
              )}
              <span
                style={{
                  fontWeight: 600,
                  color: pos.matched ? "#28a745" : "#dc3545",
                }}
              >
                {pos.matched ? "✅" : "❌"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bonus */}
      {group.bonusPerfectGroup.enabled && group.hasResult && (
        <div
          style={{
            marginTop: "0.5rem",
            padding: "4px 8px",
            background: group.bonusPerfectGroup.achieved ? "#d4edda" : "#f8f9fa",
            borderRadius: 4,
            fontSize: 12,
            color: group.bonusPerfectGroup.achieved ? "#155724" : "#6c757d",
          }}
        >
          Bonus grupo perfecto: {group.bonusPerfectGroup.achieved ? `+${group.bonusPerfectGroup.pointsEarned}` : "0"} pts
        </div>
      )}
    </div>
  );
}

// ==================== KNOCKOUT WINNER BREAKDOWN VIEW ====================

function KnockoutWinnerBreakdownView({ breakdown }: { breakdown: KnockoutWinnerBreakdown }) {
  return (
    <div>
      {/* Summary Card */}
      <div
        style={{
          background:
            breakdown.totalPointsEarned === breakdown.totalPointsMax
              ? "linear-gradient(135deg, #28a745 0%, #20c997 100%)"
              : breakdown.totalPointsEarned > 0
              ? "linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)"
              : "linear-gradient(135deg, #6c757d 0%, #495057 100%)",
          padding: "1.25rem",
          borderRadius: 12,
          color: "white",
          textAlign: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 900 }}>
          {breakdown.totalPointsEarned} / {breakdown.totalPointsMax}
        </div>
        <div style={{ fontSize: 14, opacity: 0.9 }}>puntos obtenidos</div>
      </div>

      {/* Config Info */}
      <div
        style={{
          background: "#e7f3ff",
          padding: "0.75rem 1rem",
          borderRadius: 8,
          marginBottom: "1rem",
          fontSize: 13,
          color: "#004085",
        }}
      >
        <strong>{breakdown.config.pointsPerCorrectAdvance} pts</strong> por cada equipo que avanza correctamente
      </div>

      {/* Matches */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {breakdown.matches.map((match) => (
          <KnockoutMatchRow key={match.matchId} match={match} />
        ))}
      </div>
    </div>
  );
}

// ==================== KNOCKOUT MATCH ROW ====================

function KnockoutMatchRow({ match }: { match: KnockoutMatchEvaluation }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0.75rem",
        background: match.matched ? "#d4edda" : "#fff",
        borderRadius: 8,
        border: `1px solid ${match.matched ? "#c3e6cb" : "#e9ecef"}`,
      }}
    >
      {/* Icon */}
      <div style={{ fontSize: 24 }}>
        {match.matched ? "✅" : !match.hasResult ? "⏳" : "❌"}
      </div>

      {/* Match Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 2 }}>
          Tu prediccion: <strong>{match.predictedWinnerName || "Sin prediccion"}</strong>
        </div>
        {match.hasResult && (
          <div style={{ fontSize: 13, color: "#666" }}>
            Avanzo: <strong style={{ color: "#28a745" }}>{match.actualWinnerName}</strong>
          </div>
        )}
        {!match.hasResult && (
          <div style={{ fontSize: 12, color: "#ffc107" }}>Pendiente de resultado</div>
        )}
      </div>

      {/* Points */}
      <div
        style={{
          fontWeight: 900,
          fontSize: 16,
          color: match.matched ? "#28a745" : "#6c757d",
          minWidth: 50,
          textAlign: "right",
        }}
      >
        +{match.pointsEarned}
      </div>
    </div>
  );
}
