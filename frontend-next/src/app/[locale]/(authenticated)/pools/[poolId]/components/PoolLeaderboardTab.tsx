"use client";

import { useTranslations } from "next-intl";
import { MobileLeaderboard } from "@/components/MobileLeaderboard";
import { PlayerSummary } from "@/components/PlayerSummary";
import type { PoolOverview } from "@/lib/api";
import type { PlayerSummaryModalData } from "./poolTypes";
import { formatPhaseName, formatPhaseFullName } from "./poolHelpers";

interface PoolLeaderboardTabProps {
  overview: PoolOverview;
  poolId: string;
  isMobile: boolean;
  playerSummaryModal: PlayerSummaryModalData | null;
  setPlayerSummaryModal: (data: PlayerSummaryModalData | null) => void;
}

export function PoolLeaderboardTab({
  overview, poolId, isMobile, playerSummaryModal, setPlayerSummaryModal,
}: PoolLeaderboardTabProps) {
  const t = useTranslations("pool");
  const verbose = false;

  return (
    <>
      <div style={{ marginTop: 14, padding: isMobile ? 12 : 20, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 900 }}>{t("leaderboard.title")}</h3>
        </div>

        {isMobile ? (
          <MobileLeaderboard
            rows={overview.leaderboard.rows}
            phases={overview.leaderboard.phases || []}
            onPlayerClick={(userId, displayName, initialPhase) => {
              setPlayerSummaryModal({ userId, displayName, initialPhase });
            }}
            formatPhaseName={(phaseId: string) => formatPhaseName(phaseId, t)}
            formatPhaseFullName={(phaseId: string) => formatPhaseFullName(phaseId, t)}
          />
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700, color: "#444" }}>{t("leaderboard.pos")}</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700, color: "#444" }}>{t("leaderboard.player")}</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: "#007bff", background: "#e7f3ff", borderRadius: "8px 8px 0 0" }}>{t("leaderboard.total")}</th>
                    {(overview.leaderboard.phases || []).map((phaseId: string) => (
                      <th
                        key={phaseId}
                        title={formatPhaseFullName(phaseId, t)}
                        style={{ padding: "12px 6px", textAlign: "center", fontWeight: 600, color: "#666", fontSize: 12, minWidth: 50 }}
                      >
                        {formatPhaseName(phaseId, t)}
                      </th>
                    ))}
                    <th style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: "#444" }}>{t("leaderboard.diff")}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.leaderboard.rows.map((r, idx) => {
                    const leaderPoints = overview.leaderboard.rows[0]?.points ?? 0;
                    const diff = leaderPoints - r.points;
                    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "";
                    const phases = overview.leaderboard.phases || [];

                    return (
                      <tr
                        key={r.userId}
                        style={{
                          borderBottom: "1px solid #f0f0f0",
                          background: idx < 3 ? (idx === 0 ? "#fff9e6" : idx === 1 ? "#f5f5f5" : "#fafafa") : "transparent",
                        }}
                      >
                        <td style={{ padding: "14px 8px", fontWeight: 700, fontSize: 16 }}>
                          {medal ? <span style={{ marginRight: 4 }}>{medal}</span> : null}
                          {r.rank}
                        </td>
                        <td
                          onClick={() => setPlayerSummaryModal({ userId: r.userId, displayName: r.displayName })}
                          style={{ padding: "14px 8px", cursor: "pointer" }}
                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.displayName}</div>
                          <div style={{ display: "flex", gap: 4 }}>
                            {r.role === "HOST" && (
                              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "#007bff20", border: "1px solid #007bff", color: "#007bff", fontWeight: 600 }}>
                                👑 HOST
                              </span>
                            )}
                            {r.role === "CO_ADMIN" && (
                              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "#28a74520", border: "1px solid #28a745", color: "#28a745", fontWeight: 600 }}>
                                ⭐ CO-ADMIN
                              </span>
                            )}
                            {r.role === "PLAYER" && (
                              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "#6c757d20", border: "1px solid #6c757d", color: "#6c757d", fontWeight: 600 }}>
                                PLAYER
                              </span>
                            )}
                            {r.memberStatus === "LEFT" && (
                              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "#ef444420", border: "1px solid #ef4444", color: "#ef4444", fontWeight: 600 }}>
                                {t("mobileLeaderboard.retired")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "14px 8px", textAlign: "center", fontWeight: 900, fontSize: 18, color: "#007bff", background: "#f8fbff" }}>
                          {r.points}
                        </td>
                        {phases.map((phaseId: string) => {
                          const phasePoints = r.pointsByPhase?.[phaseId] ?? 0;
                          const hasPoints = phasePoints > 0;
                          return (
                            <td
                              key={phaseId}
                              onClick={() => {
                                if (hasPoints) {
                                  setPlayerSummaryModal({ userId: r.userId, displayName: r.displayName, initialPhase: phaseId });
                                }
                              }}
                              style={{
                                padding: "10px 6px", textAlign: "center", fontSize: 13,
                                fontWeight: hasPoints ? 600 : 400,
                                color: hasPoints ? "#333" : "#ccc",
                                cursor: hasPoints ? "pointer" : "default",
                                transition: "background 0.15s ease",
                              }}
                              onMouseEnter={(e) => { if (hasPoints) e.currentTarget.style.background = "#e7f3ff"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                              title={hasPoints ? t("leaderboard.viewPhaseDetail", { phase: formatPhaseFullName(phaseId, t) }) : t("leaderboard.noPointsYet")}
                            >
                              {hasPoints ? phasePoints : "-"}
                            </td>
                          );
                        })}
                        <td style={{ padding: "14px 8px", textAlign: "center", fontSize: 13, color: "#666" }}>
                          {idx === 0 ? (
                            <span style={{ fontWeight: 700, color: "#2e7d32" }}>{t("leaderboard.leader")}</span>
                          ) : (
                            <span>-{diff}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {overview.leaderboard.rows.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
                {t("leaderboard.emptyState")}
              </div>
            )}

            {verbose && (
              <details style={{ marginTop: 16, padding: 12, background: "#f9f9f9", borderRadius: 8 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Ver desglose detallado (Debug)</summary>
                <div style={{ marginTop: 10 }}>
                  {overview.leaderboard.rows.map((r) => (
                    <div key={r.userId} style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.displayName}</div>
                      {r.breakdown && (
                        <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", background: "#fff", padding: 8, borderRadius: 4, overflow: "auto" }}>
                          {JSON.stringify(r.breakdown, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>

      {/* Player Summary Modal */}
      {playerSummaryModal && poolId && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
          onClick={() => setPlayerSummaryModal(null)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, maxWidth: 950, width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: "sticky", top: 0, background: "#fff", padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>
                {t("playerSummary.title", { name: playerSummaryModal.displayName })}
              </h2>
              <button
                onClick={() => setPlayerSummaryModal(null)}
                style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666", padding: "4px 8px" }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <PlayerSummary
                poolId={poolId}
                userId={playerSummaryModal.userId}
                tournamentKey={overview.tournamentInstance.templateKey ?? "wc_2026_sandbox"}
                initialPhase={playerSummaryModal.initialPhase}
                onClose={() => setPlayerSummaryModal(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
