"use client";

import { type GroupSingleBreakdown } from "../../lib/api";
import { TOUCH_TARGET, mobileInteractiveStyles } from "../../hooks/useIsMobile";

interface BreakdownModalProps {
  groupName: string;
  breakdownData: GroupSingleBreakdown | null;
  loadingBreakdown: boolean;
  isMobile: boolean;
  onClose: () => void;
  t: any;
}

export function BreakdownModal({
  groupName,
  breakdownData,
  loadingBreakdown,
  isMobile,
  onClose,
  t,
}: BreakdownModalProps) {
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
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: isMobile ? 0 : "1rem",
      }}
      onClick={onClose}
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
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t("groupStandings.breakdownTitle", { name: groupName })}</h3>
          <button
            onClick={onClose}
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
              {t("groupStandings.loadingBreakdown")}
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
                <div style={{ fontSize: 13, opacity: 0.9 }}>{t("groupStandings.pointsEarned")}</div>
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
                <strong>{breakdownData.config.pointsPerExactPosition} {t("points")}</strong> {t("groupStandings.perExactPosition")}
                {breakdownData.config.bonusPerfectGroup && (
                  <> | <strong>+{breakdownData.config.bonusPerfectGroup} {t("points")}</strong> {t("groupStandings.bonusPerfectGroupConfig")}</>
                )}
              </div>

              {/* No pick message */}
              {!breakdownData.hasPick && (
                <div style={{ textAlign: "center", padding: "1.5rem", color: "#dc3545" }}>
                  <div style={{ fontSize: 48, marginBottom: "0.5rem" }}>🚫</div>
                  <div style={{ fontWeight: 600 }}>{t("groupStandings.noPrediction")}</div>
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
                          {t("groupStandings.yourPosition", { position: pos.predictedPosition })}
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
                        {t("groupStandings.bonusPerfectGroupLabel")}
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
  );
}
