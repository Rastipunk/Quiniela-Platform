// Componente de Match Card optimizado para móvil
// Sprint 3 - Mobile UX Improvements

import { useState } from "react";
import { TeamFlag } from "./TeamFlag";
import { TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";

type Team = {
  id: string;
  name: string;
};

type Pick = {
  type: string;
  homeGoals?: number;
  awayGoals?: number;
  outcome?: string;
};

type Result = {
  homeGoals: number;
  awayGoals: number;
};

type MobileMatchCardProps = {
  match: {
    id: string;
    homeTeam: Team;
    awayTeam: Team;
    kickoffUtc: string;
    groupId?: string;
    phaseId?: string;
  };
  myPick: Pick | null;
  result: Result | null;
  isLocked: boolean;
  deadlineStatus: "open" | "locked";
  formattedDateTime: string;
  pointsEarned?: number | null;
  allowScorePick?: boolean;
  isBusy: boolean;
  onSavePick: (homeGoals: number, awayGoals: number) => void;
  onViewOtherPicks?: () => void;
  canViewOtherPicks?: boolean;
  isPlaceholder: (teamId: string) => boolean;
  getPlaceholderName: (teamId: string) => string;
};

export function MobileMatchCard({
  match,
  myPick,
  result,
  isLocked,
  deadlineStatus,
  formattedDateTime,
  pointsEarned,
  allowScorePick = true,
  isBusy,
  onSavePick,
  onViewOtherPicks,
  canViewOtherPicks,
  isPlaceholder,
  getPlaceholderName,
}: MobileMatchCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [homeGoals, setHomeGoals] = useState(myPick?.homeGoals?.toString() || "");
  const [awayGoals, setAwayGoals] = useState(myPick?.awayGoals?.toString() || "");

  const homeIsPlaceholder = isPlaceholder(match.homeTeam.id);
  const awayIsPlaceholder = isPlaceholder(match.awayTeam.id);
  const hasPlaceholder = homeIsPlaceholder || awayIsPlaceholder;

  const hasPick = myPick && myPick.homeGoals !== undefined && myPick.awayGoals !== undefined;
  const hasResult = result !== null;

  // Determinar el estado visual
  const getStatusBadge = () => {
    if (hasPlaceholder) {
      return { text: "Por definir", color: "#6c757d", bg: "#6c757d15" };
    }
    if (hasResult) {
      if (pointsEarned !== null && pointsEarned !== undefined && pointsEarned > 0) {
        return { text: `+${pointsEarned} pts`, color: "#28a745", bg: "#28a74515" };
      }
      return { text: "Finalizado", color: "#6c757d", bg: "#6c757d15" };
    }
    if (isLocked) {
      return { text: "Cerrado", color: "#dc3545", bg: "#dc354515" };
    }
    if (!hasPick) {
      return { text: "Sin pick", color: "#ffc107", bg: "#ffc10715" };
    }
    return { text: "Pick listo", color: "#28a745", bg: "#28a74515" };
  };

  const statusBadge = getStatusBadge();

  const handleSave = () => {
    const h = parseInt(homeGoals, 10);
    const a = parseInt(awayGoals, 10);
    if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) {
      onSavePick(h, a);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setHomeGoals(myPick?.homeGoals?.toString() || "");
    setAwayGoals(myPick?.awayGoals?.toString() || "");
    setIsEditing(false);
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e0e0e0",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Header: DateTime + Status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 12px",
          background: "#f8f9fa",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <span style={{ fontSize: 12, color: "#666" }}>
          {formattedDateTime}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 4,
            background: statusBadge.bg,
            color: statusBadge.color,
            fontWeight: 600,
          }}
        >
          {statusBadge.text}
        </span>
      </div>

      {/* Main Content: Teams */}
      <div style={{ padding: 16 }}>
        {/* Teams Layout - Vertical */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Home Team Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!homeIsPlaceholder && (
              <TeamFlag teamId={match.homeTeam.id} size={36} />
            )}
            {homeIsPlaceholder && (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#e0e0e0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: "#999",
                }}
              >
                ?
              </div>
            )}
            <span
              style={{
                flex: 1,
                fontWeight: 600,
                fontSize: 15,
                color: homeIsPlaceholder ? "#999" : "#333",
              }}
            >
              {homeIsPlaceholder ? getPlaceholderName(match.homeTeam.id) : match.homeTeam.name}
            </span>
            {/* Result or Pick */}
            {hasResult ? (
              <span style={{ fontWeight: 700, fontSize: 20 }}>{result.homeGoals}</span>
            ) : hasPick && !isEditing ? (
              <span style={{ fontWeight: 600, fontSize: 18, color: "#007bff" }}>
                {myPick.homeGoals}
              </span>
            ) : null}
          </div>

          {/* Away Team Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!awayIsPlaceholder && (
              <TeamFlag teamId={match.awayTeam.id} size={36} />
            )}
            {awayIsPlaceholder && (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#e0e0e0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: "#999",
                }}
              >
                ?
              </div>
            )}
            <span
              style={{
                flex: 1,
                fontWeight: 600,
                fontSize: 15,
                color: awayIsPlaceholder ? "#999" : "#333",
              }}
            >
              {awayIsPlaceholder ? getPlaceholderName(match.awayTeam.id) : match.awayTeam.name}
            </span>
            {/* Result or Pick */}
            {hasResult ? (
              <span style={{ fontWeight: 700, fontSize: 20 }}>{result.awayGoals}</span>
            ) : hasPick && !isEditing ? (
              <span style={{ fontWeight: 600, fontSize: 18, color: "#007bff" }}>
                {myPick.awayGoals}
              </span>
            ) : null}
          </div>
        </div>

        {/* Pick Editor */}
        {!hasPlaceholder && allowScorePick && !isLocked && isEditing && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "#f8fbff",
              borderRadius: 8,
              border: "1px solid #007bff30",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <input
                type="number"
                min={0}
                max={20}
                value={homeGoals}
                onChange={(e) => setHomeGoals(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1,
                  padding: 12,
                  fontSize: 18,
                  fontWeight: 600,
                  textAlign: "center",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  minHeight: TOUCH_TARGET.minimum,
                }}
              />
              <span style={{ fontWeight: 600, color: "#666" }}>-</span>
              <input
                type="number"
                min={0}
                max={20}
                value={awayGoals}
                onChange={(e) => setAwayGoals(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1,
                  padding: 12,
                  fontSize: 18,
                  fontWeight: 600,
                  textAlign: "center",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  minHeight: TOUCH_TARGET.minimum,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleCancel}
                disabled={isBusy}
                style={{
                  flex: 1,
                  padding: 12,
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  color: "#666",
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: TOUCH_TARGET.minimum,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isBusy}
                style={{
                  flex: 1,
                  padding: 12,
                  background: "#007bff",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: TOUCH_TARGET.minimum,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {isBusy ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!hasPlaceholder && !isEditing && (
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            {/* Edit Pick Button */}
            {allowScorePick && !isLocked && (
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  flex: 1,
                  padding: 12,
                  background: hasPick ? "#fff" : "#007bff",
                  border: hasPick ? "1px solid #007bff" : "none",
                  borderRadius: 8,
                  color: hasPick ? "#007bff" : "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: TOUCH_TARGET.minimum,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {hasPick ? "Modificar pick" : "Hacer pick"}
              </button>
            )}

            {/* View Other Picks Button */}
            {canViewOtherPicks && onViewOtherPicks && (
              <button
                onClick={onViewOtherPicks}
                style={{
                  flex: allowScorePick && !isLocked ? 0 : 1,
                  padding: 12,
                  paddingLeft: allowScorePick && !isLocked ? 16 : 12,
                  paddingRight: allowScorePick && !isLocked ? 16 : 12,
                  background: "#fff",
                  border: "1px solid #6c757d",
                  borderRadius: 8,
                  color: "#6c757d",
                  fontWeight: 500,
                  cursor: "pointer",
                  minHeight: TOUCH_TARGET.minimum,
                  fontSize: 13,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                👁 Picks
              </button>
            )}
          </div>
        )}

        {/* Locked Message */}
        {isLocked && !hasResult && !hasPlaceholder && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              background: "#fff3cd",
              borderRadius: 8,
              fontSize: 12,
              color: "#856404",
              textAlign: "center",
            }}
          >
            {hasPick
              ? "Tu pick está registrado. Espera el resultado."
              : "Deadline alcanzado. No se puede hacer pick."}
          </div>
        )}
      </div>
    </div>
  );
}
