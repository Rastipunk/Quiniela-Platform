"use client";

// frontend-next/src/components/PlayerSummary.tsx
// Componente que muestra el resumen detallado de puntos de un jugador

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { getPlayerSummary } from "../lib/api";
import type { PlayerSummaryResponse, PlayerSummaryPhase, PlayerSummaryMatch } from "../lib/api";
import { getToken } from "../lib/auth";
import { TeamFlag } from "./TeamFlag";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";

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
const GRID_TEMPLATE_MOBILE = "auto 16px 1fr 56px 56px 60px";

// Translation keys for pick type labels - resolved via t() in components
const typeTranslationKeys: Record<string, string> = {
  EXACT_SCORE: "pickTypeNames.EXACT_SCORE",
  GOAL_DIFFERENCE: "pickTypeNames.GOAL_DIFFERENCE",
  PARTIAL_SCORE: "pickTypeNames.PARTIAL_SCORE",
  TOTAL_GOALS: "pickTypeNames.TOTAL_GOALS",
  OUTCOME: "pickTypeNames.MATCH_OUTCOME_90MIN",
  MATCH_OUTCOME_90MIN: "pickTypeNames.MATCH_OUTCOME_90MIN",
  HOME_GOALS: "pickTypeNames.HOME_GOALS",
  AWAY_GOALS: "pickTypeNames.AWAY_GOALS",
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
  const t = useTranslations("pool");
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
        <div style={{ fontSize: 12, color: "#999" }}>{t("scoringBreakdown.noHits")}</div>
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
              <span style={{ fontSize: 12, color: "#333" }}>{typeTranslationKeys[b.type] ? t(typeTranslationKeys[b.type] as any) : b.type}</span>
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

// Translation keys for status labels - resolved via t() in components
const statusTranslationKeys: Record<string, string> = {
  SCORED: "playerSummaryView.statusScored",
  NO_PICK: "playerSummaryView.statusNoPick",
  PENDING_RESULT: "playerSummaryView.statusPendingResult",
  LOCKED: "playerSummaryView.statusLocked",
};

// Componente para una fila de partido (usa display:contents para compartir grid del padre)
function MatchRow({ match, tournamentKey, isMobile }: { match: PlayerSummaryMatch; tournamentKey: string; isMobile?: boolean }) {
  const t = useTranslations("pool");
  const [showBreakdown, setShowBreakdown] = useState(false);

  const colors = statusColors[match.status] ?? statusColors.LOCKED;
  const hasBreakdown = match.status === "SCORED" && match.breakdown?.some((b) => b.matched);
  const rowBg = match.status === "SCORED" && match.pointsEarned > 0 ? "#f8fff8" : "#fff";

  // Shared style for all cells in this row (continuous background, no gaps)
  const cell: React.CSSProperties = {
    backgroundColor: rowBg,
    borderBottom: "1px solid #eee",
    padding: isMobile ? "8px 3px" : "10px 4px",
    display: "flex",
    alignItems: "center",
  };

  return (
    <div style={{ display: "contents" }}>
      {/* Equipo local */}
      <div style={{ ...cell, paddingLeft: isMobile ? 8 : 16, gap: 4, whiteSpace: "nowrap" }}>
        {match.homeTeam ? (
          <TeamFlag
            teamId={`t_${match.homeTeam.code ?? match.homeTeam.id}`}
            tournamentKey={tournamentKey}
            size="sm"
            showName={true}
          />
        ) : (
          <span style={{ color: "#999", fontSize: isMobile ? 12 : 13 }}>TBD</span>
        )}
      </div>

      {/* VS */}
      <div style={{ ...cell, justifyContent: "center" }}>
        <span style={{ color: "#aaa", fontSize: isMobile ? 10 : 11 }}>vs</span>
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
          <span style={{ color: "#999", fontSize: isMobile ? 12 : 13 }}>TBD</span>
        )}
      </div>

      {/* Mi Pick */}
      <div style={{ ...cell, justifyContent: "center" }}>
        {match.pick ? (
          <span style={{ fontWeight: 600, color: "#333", fontSize: isMobile ? 13 : 14 }}>
            {match.pick.homeGoals}-{match.pick.awayGoals}
          </span>
        ) : (
          <span style={{ color: "#bbb", fontSize: isMobile ? 12 : 13 }}>-</span>
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
              padding: isMobile ? "2px 4px" : "2px 8px",
              borderRadius: 4,
              fontSize: isMobile ? 13 : 14,
            }}
          >
            {match.result.homeGoals}-{match.result.awayGoals}
          </span>
        ) : (
          <span style={{ color: "#bbb", fontSize: isMobile ? 12 : 13 }}>-</span>
        )}
      </div>

      {/* Puntos (con popover de breakdown) */}
      <div style={{ ...cell, justifyContent: "flex-end", paddingRight: isMobile ? 8 : 16, position: "relative" }}>
        {match.status === "SCORED" ? (
          <span
            onClick={hasBreakdown ? () => setShowBreakdown(!showBreakdown) : undefined}
            style={{
              fontWeight: 700,
              fontSize: isMobile ? 13 : 14,
              color: match.pointsEarned > 0 ? "#28a745" : "#dc3545",
              cursor: hasBreakdown ? "pointer" : "default",
              borderBottom: hasBreakdown ? "1px dashed currentColor" : "none",
              paddingBottom: 1,
              minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
              display: "flex",
              alignItems: "center",
            }}
          >
            {match.pointsEarned > 0 ? `+${match.pointsEarned}` : "0"}
          </span>
        ) : (
          <span
            style={{
              display: "inline-block",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: isMobile ? 10 : 11,
              backgroundColor: colors.bg,
              color: colors.text,
              whiteSpace: "nowrap",
            }}
          >
            {statusTranslationKeys[match.status] ? t(statusTranslationKeys[match.status] as any) : match.status}
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
function PhaseSection({ phase, tournamentKey, defaultExpanded, isMobile }: { phase: PlayerSummaryPhase; tournamentKey: string; defaultExpanded?: boolean; isMobile?: boolean }) {
  const t = useTranslations("pool");
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
          padding: isMobile ? "14px 12px" : "12px 16px",
          backgroundColor: "#f8f9fa",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid #ddd" : "none",
          minHeight: isMobile ? TOUCH_TARGET.comfortable : undefined,
          ...mobileInteractiveStyles.tapHighlight,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
          <span style={{ fontSize: isMobile ? 14 : 18 }}>{expanded ? "▼" : "▶"}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: isMobile ? 14 : 16 }}>{phase.phaseName}</div>
            <div style={{ fontSize: isMobile ? 11 : 12, color: "#666" }}>
              {t("playerSummaryView.scoredOfTotal", { scored: phase.scoredCount, total: phase.matchCount })}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: isMobile ? 18 : 20, color: "#007bff" }}>{phase.totalPoints} pts</div>
          {phase.maxPossiblePoints > 0 && (
            <div style={{ fontSize: 11, color: "#666" }}>
              {successRate}%
            </div>
          )}
        </div>
      </div>

      {/* Contenido expandible: scrollable on mobile */}
      {expanded && (
        <div style={{ overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch" as any }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? GRID_TEMPLATE_MOBILE : GRID_TEMPLATE,
              minWidth: isMobile ? 420 : undefined,
            }}
          >
            {/* Header row (display:contents so cells participate in the grid) */}
            <div style={{ display: "contents" }}>
              {[
                { label: t("playerSummaryView.headerHome"), align: "left" as const, pl: isMobile ? 8 : 16 },
                { label: "", align: "center" as const },
                { label: t("playerSummaryView.headerAway"), align: "left" as const },
                { label: t("playerSummaryView.headerPick"), align: "center" as const },
                { label: t("playerSummaryView.headerResult"), align: "center" as const },
                { label: t("playerSummaryView.headerPts"), align: "right" as const, pr: isMobile ? 8 : 16 },
              ].map((h, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: "#f1f3f5",
                    padding: isMobile ? "6px 3px" : "8px 4px",
                    paddingLeft: h.pl ?? (isMobile ? 3 : 4),
                    paddingRight: h.pr ?? (isMobile ? 3 : 4),
                    fontSize: isMobile ? 10 : 11,
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
              <MatchRow key={match.matchId} match={match} tournamentKey={tournamentKey} isMobile={isMobile} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente principal
export function PlayerSummary({ poolId, userId, tournamentKey = "wc_2026_sandbox", initialPhase, onClose }: PlayerSummaryProps) {
  const t = useTranslations("pool");
  const isMobile = useIsMobile();
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
          setError(t("playerSummaryView.notAuthenticated"));
          return;
        }
        const result = await getPlayerSummary(token, poolId, userId);
        setData(result);
      } catch (err: any) {
        setError(err.message ?? t("playerSummaryView.errorLoading"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [poolId, userId, t]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 24 }}>{t("playerSummaryView.loadingSummary")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#dc3545" }}>
        <div style={{ fontSize: 18 }}>{t("playerSummaryView.errorPrefix", { message: error })}</div>
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
    <div style={{ maxWidth: isMobile ? "100%" : 900, margin: "0 auto", padding: isMobile ? "0 4px" : 0 }}>
      {/* Header con info del jugador */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 12 : 0,
          padding: isMobile ? 16 : 20,
          backgroundColor: "#f8f9fa",
          borderRadius: 12,
          marginBottom: isMobile ? 16 : 20,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
            <span style={{ fontSize: isMobile ? 28 : 32 }}>
              {data.player.rank === 1 ? "🥇" : data.player.rank === 2 ? "🥈" : data.player.rank === 3 ? "🥉" : "👤"}
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 24 }}>
                {data.isViewingSelf ? t("playerSummaryView.mySummary") : data.player.displayName}
              </h2>
              <div style={{ color: "#666", fontSize: isMobile ? 13 : 14 }}>
                #{data.player.rank} • {data.player.role}
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: isMobile ? "center" : "right" }}>
          <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, color: "#007bff" }}>{data.player.totalPoints}</div>
          <div style={{ fontSize: isMobile ? 13 : 14, color: "#666" }}>{t("playerSummaryView.totalPoints")}</div>
        </div>
      </div>

      {/* Stats cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(150px, 1fr))",
          gap: isMobile ? 10 : 16,
          marginBottom: isMobile ? 16 : 24,
        }}
      >
        <div style={{ padding: isMobile ? 12 : 16, backgroundColor: "#e7f3ff", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#0056b3" }}>{data.player.rank}°</div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: "#666" }}>{t("playerSummaryView.position")}</div>
        </div>
        <div style={{ padding: isMobile ? 12 : 16, backgroundColor: "#d4edda", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#155724" }}>{data.player.totalPoints}</div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: "#666" }}>{t("playerSummaryView.pointsLabel")}</div>
        </div>
        <div style={{ padding: isMobile ? 12 : 16, backgroundColor: "#fff3cd", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#856404" }}>{totalScored}</div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: "#666" }}>{t("playerSummaryView.scored")}</div>
        </div>
        <div style={{ padding: isMobile ? 12 : 16, backgroundColor: "#f8d7da", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#721c24" }}>
            {totalMaxPoints > 0 ? Math.round((data.player.totalPoints / totalMaxPoints) * 100) : 0}%
          </div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: "#666" }}>{t("playerSummaryView.effectiveness")}</div>
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
          {t("playerSummaryView.onlyDeadlinePassed")}
        </div>
      )}

      {/* Fases */}
      <h3 style={{ fontSize: isMobile ? 16 : 18, marginBottom: 16, color: "#333" }}>{t("playerSummaryView.phaseBreakdown")}</h3>
      {data.phases.length === 0 ? (
        <div style={{ padding: isMobile ? 20 : 40, textAlign: "center", color: "#666" }}>
          {t("playerSummaryView.noMatchesVisible")}
        </div>
      ) : (
        data.phases.map((phase, idx) => (
          <PhaseSection
            key={phase.phaseId}
            phase={phase}
            tournamentKey={tournamentKey}
            defaultExpanded={initialPhase ? phase.phaseId === initialPhase : idx === 0}
            isMobile={isMobile}
          />
        ))
      )}

      {/* Botón cerrar si es modal */}
      {onClose && (
        <div style={{ textAlign: "center", marginTop: 20, paddingBottom: isMobile ? 20 : 0 }}>
          <button
            onClick={onClose}
            style={{
              padding: isMobile ? "14px 40px" : "10px 30px",
              backgroundColor: "#6c757d",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: isMobile ? 16 : 14,
              cursor: "pointer",
              minHeight: TOUCH_TARGET.minimum,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {t("playerSummaryView.close")}
          </button>
        </div>
      )}
    </div>
  );
}
