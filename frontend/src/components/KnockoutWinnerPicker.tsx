// Componente para seleccionar el ganador de un partido eliminatorio
// Sprint 2 - Advanced Pick Types System - Preset SIMPLE

import { useState, useEffect } from "react";

type Team = {
  id: string;
  name: string;
  flag?: string;
};

type Match = {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  kickoffUtc: string;
};

type KnockoutWinnerPickerProps = {
  match: Match;
  initialWinnerId?: string | null;
  onWinnerChange: (winnerId: string) => void;
  disabled?: boolean;
};

export function KnockoutWinnerPicker({
  match,
  initialWinnerId,
  onWinnerChange,
  disabled = false,
}: KnockoutWinnerPickerProps) {
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(
    initialWinnerId || null
  );

  useEffect(() => {
    setSelectedWinnerId(initialWinnerId || null);
  }, [initialWinnerId]);

  function handleSelectWinner(teamId: string) {
    if (disabled) return;

    setSelectedWinnerId(teamId);
    onWinnerChange(teamId);
  }

  return (
    <div
      style={{
        padding: "1.5rem",
        background: "white",
        borderRadius: 12,
        border: "2px solid #6c757d",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          marginBottom: "1rem",
          fontSize: 13,
          color: "#666",
          textAlign: "center",
        }}
      >
        {disabled ? "Predicción guardada (bloqueada)" : "¿Quién avanza a la siguiente ronda?"}
      </div>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        {/* Home Team */}
        <TeamButton
          team={match.homeTeam}
          isSelected={selectedWinnerId === match.homeTeam.id}
          onClick={() => handleSelectWinner(match.homeTeam.id)}
          disabled={disabled}
        />

        {/* VS Separator */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "#999",
            flexShrink: 0,
          }}
        >
          VS
        </div>

        {/* Away Team */}
        <TeamButton
          team={match.awayTeam}
          isSelected={selectedWinnerId === match.awayTeam.id}
          onClick={() => handleSelectWinner(match.awayTeam.id)}
          disabled={disabled}
        />
      </div>

      {!disabled && !selectedWinnerId && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            background: "#fff3cd",
            borderRadius: 8,
            fontSize: 12,
            color: "#856404",
            textAlign: "center",
          }}
        >
          ⚠️ Selecciona un equipo para guardar tu predicción
        </div>
      )}

      {selectedWinnerId && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            background: disabled ? "#e7f3ff" : "#d4edda",
            borderRadius: 8,
            fontSize: 13,
            color: disabled ? "#004085" : "#155724",
            textAlign: "center",
            fontWeight: 600,
          }}
        >
          {disabled ? "✓" : "✓"} Predicción:{" "}
          <strong>
            {selectedWinnerId === match.homeTeam.id
              ? match.homeTeam.name
              : match.awayTeam.name}
          </strong>{" "}
          avanza
        </div>
      )}
    </div>
  );
}

type TeamButtonProps = {
  team: Team;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
};

function TeamButton({ team, isSelected, onClick, disabled }: TeamButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: "1.5rem 1rem",
        background: isSelected
          ? "linear-gradient(135deg, #28a745 0%, #20c997 100%)"
          : "white",
        border: `3px solid ${isSelected ? "#28a745" : "#dee2e6"}`,
        borderRadius: 12,
        cursor: disabled ? "default" : "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        opacity: disabled && !isSelected ? 0.5 : 1,
        transform: isSelected ? "scale(1.05)" : "scale(1)",
        boxShadow: isSelected
          ? "0 8px 20px rgba(40, 167, 69, 0.3)"
          : "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      {/* Bandera */}
      {team.flag && (
        <div style={{ fontSize: 48, filter: isSelected ? "none" : "grayscale(50%)" }}>
          {team.flag}
        </div>
      )}

      {/* Nombre del equipo */}
      <div
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: isSelected ? "white" : "#333",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {team.name}
      </div>

      {/* Check icon si está seleccionado */}
      {isSelected && (
        <div
          style={{
            fontSize: 24,
            color: "white",
          }}
        >
          ✓
        </div>
      )}
    </button>
  );
}
