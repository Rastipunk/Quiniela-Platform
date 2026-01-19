// Componente de Leaderboard optimizado para móvil
// Sprint 3 - Mobile UX Improvements

import { TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";

type LeaderboardRow = {
  userId: string;
  displayName: string;
  role: string;
  points: number;
  rank: number;
  pointsByPhase?: Record<string, number>;
};

type MobileLeaderboardProps = {
  rows: LeaderboardRow[];
  phases: string[];
  onPlayerClick: (userId: string, displayName: string, initialPhase?: string) => void;
  formatPhaseName: (phaseId: string) => string;
  formatPhaseFullName: (phaseId: string) => string;
};

export function MobileLeaderboard({
  rows,
  phases,
  onPlayerClick,
  formatPhaseName,
  formatPhaseFullName,
}: MobileLeaderboardProps) {
  const leaderPoints = rows[0]?.points ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r, idx) => {
        const diff = leaderPoints - r.points;
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
        const isTopThree = idx < 3;

        return (
          <div
            key={r.userId}
            onClick={() => onPlayerClick(r.userId, r.displayName)}
            style={{
              background: isTopThree
                ? idx === 0
                  ? "linear-gradient(135deg, #fff9e6 0%, #fff3cc 100%)"
                  : idx === 1
                  ? "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)"
                  : "linear-gradient(135deg, #fff8f0 0%, #ffede0 100%)"
                : "#fff",
              border: isTopThree
                ? `2px solid ${idx === 0 ? "#ffc107" : idx === 1 ? "#adb5bd" : "#fd7e14"}`
                : "1px solid #e0e0e0",
              borderRadius: 12,
              padding: 16,
              cursor: "pointer",
              ...mobileInteractiveStyles.tapHighlight,
              transition: "transform 0.1s ease, box-shadow 0.1s ease",
            }}
          >
            {/* Header: Rank + Name + Points */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              {/* Rank Badge */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: isTopThree
                    ? idx === 0
                      ? "linear-gradient(135deg, #ffc107 0%, #ffca28 100%)"
                      : idx === 1
                      ? "linear-gradient(135deg, #adb5bd 0%, #ced4da 100%)"
                      : "linear-gradient(135deg, #fd7e14 0%, #ff922b 100%)"
                    : "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: medal ? 22 : 16,
                  color: isTopThree ? "#fff" : "#666",
                  flexShrink: 0,
                  boxShadow: isTopThree ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {medal || r.rank}
              </div>

              {/* Player Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    marginBottom: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.displayName}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {r.role === "HOST" && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#007bff20",
                        border: "1px solid #007bff",
                        color: "#007bff",
                        fontWeight: 600,
                      }}
                    >
                      👑 HOST
                    </span>
                  )}
                  {r.role === "CO_ADMIN" && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#28a74520",
                        border: "1px solid #28a745",
                        color: "#28a745",
                        fontWeight: 600,
                      }}
                    >
                      ⭐ CO-ADMIN
                    </span>
                  )}
                </div>
              </div>

              {/* Points */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 24,
                    color: "#007bff",
                    lineHeight: 1,
                  }}
                >
                  {r.points}
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                  {idx === 0 ? (
                    <span style={{ color: "#28a745", fontWeight: 600 }}>Líder</span>
                  ) : (
                    <span>-{diff} pts</span>
                  )}
                </div>
              </div>
            </div>

            {/* Phase Breakdown (horizontal scrollable) */}
            {phases.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingTop: 8,
                  borderTop: "1px solid rgba(0,0,0,0.06)",
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                {phases.map((phaseId) => {
                  const phasePoints = r.pointsByPhase?.[phaseId] ?? 0;
                  const hasPoints = phasePoints > 0;

                  return (
                    <button
                      key={phaseId}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasPoints) {
                          onPlayerClick(r.userId, r.displayName, phaseId);
                        }
                      }}
                      disabled={!hasPoints}
                      title={formatPhaseFullName(phaseId)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: hasPoints ? "#f8fbff" : "#f5f5f5",
                        border: hasPoints ? "1px solid #007bff30" : "1px solid #e0e0e0",
                        borderRadius: 8,
                        cursor: hasPoints ? "pointer" : "default",
                        opacity: hasPoints ? 1 : 0.5,
                        minWidth: 50,
                        flexShrink: 0,
                        ...mobileInteractiveStyles.tapHighlight,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: "#666",
                          marginBottom: 2,
                          fontWeight: 500,
                        }}
                      >
                        {formatPhaseName(phaseId)}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: hasPoints ? 700 : 400,
                          color: hasPoints ? "#007bff" : "#ccc",
                        }}
                      >
                        {hasPoints ? phasePoints : "-"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {rows.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "#999",
            background: "#f9f9f9",
            borderRadius: 12,
          }}
        >
          Aún no hay datos en el leaderboard
        </div>
      )}

      {/* Scroll hint for phases */}
      {rows.length > 0 && phases.length > 3 && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#999",
            padding: "8px 0",
          }}
        >
          ← Desliza para ver más fases →
        </div>
      )}
    </div>
  );
}
