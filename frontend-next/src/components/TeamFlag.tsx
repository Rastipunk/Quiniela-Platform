"use client";

// frontend-next/src/components/TeamFlag.tsx
import { getTeamFlag, getCountryName } from "../data/teamFlags";

type TeamFlagProps = {
  teamId: string;           // Formato: "t_A1", "t_B2", etc.
  tournamentKey: string;    // "wc_2026_sandbox"
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  layout?: "horizontal" | "vertical";
};

const sizeMap = {
  sm: 20,
  md: 32,
  lg: 48,
};

export function TeamFlag({
  teamId,
  tournamentKey,
  size = "md",
  showName = true,
  layout = "horizontal",
}: TeamFlagProps) {
  // Extraer código: "t_A1" → "A1"
  const teamCode = teamId.replace("t_", "");
  const flag = getTeamFlag(teamCode, tournamentKey);
  const countryName = getCountryName(teamId, tournamentKey);

  // Fallback si no hay bandera
  if (!flag || !flag.flagUrl) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexDirection: layout === "vertical" ? "column" : "row",
        }}
      >
        <span style={{ fontSize: sizeMap[size] }}>⚽</span>
        {showName && <span style={{ fontSize: size === "sm" ? 12 : 14 }}>{countryName}</span>}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: layout === "vertical" ? 4 : 8,
        flexDirection: layout === "vertical" ? "column" : "row",
      }}
    >
      <img
        src={flag.flagUrl}
        alt={flag.country}
        style={{
          width: sizeMap[size],
          height: "auto",
          borderRadius: 2,
          border: "1px solid #ddd",
        }}
      />
      {showName && (
        <span
          style={{
            fontSize: size === "sm" ? 12 : size === "md" ? 14 : 16,
            fontWeight: size === "lg" ? 600 : 500,
            textAlign: layout === "vertical" ? "center" : "left",
          }}
        >
          {flag.country}
        </span>
      )}
    </div>
  );
}
