"use client";

// frontend-next/src/components/TeamFlag.tsx
import { getTeamFlag, getCountryName } from "../data/teamFlags";

type TeamFlagProps = {
  teamId: string;           // Formato: "t_A1", "t_B2", etc.
  tournamentKey: string;    // "wc_2026_sandbox"
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  layout?: "horizontal" | "vertical";
  /** If true, render name first then flag (useful for "home" side facing center) */
  reverseOrder?: boolean;
  /** If true, allow the country name to wrap to multiple lines */
  wrapName?: boolean;
  /** Text alignment for the name (only relevant when wrapName=true) */
  nameAlign?: "left" | "right" | "center";
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
  reverseOrder = false,
  wrapName = false,
  nameAlign,
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

  const flagImg = (
    <img
      src={flag.flagUrl}
      alt={flag.country}
      width={sizeMap[size]}
      height={Math.round(sizeMap[size] * 0.75)}
      loading="lazy"
      decoding="async"
      style={{
        width: sizeMap[size],
        height: "auto",
        borderRadius: 2,
        border: "1px solid #ddd",
        flexShrink: 0,
      }}
    />
  );
  const nameSpan = showName && (
    <span
      style={{
        fontSize: size === "sm" ? 12 : size === "md" ? 14 : 16,
        fontWeight: size === "lg" ? 600 : 500,
        textAlign: nameAlign ?? (layout === "vertical" ? "center" : "left"),
        whiteSpace: wrapName ? "normal" : "nowrap",
        lineHeight: 1.2,
        minWidth: 0,
      }}
    >
      {flag.country}
    </span>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: layout === "vertical" ? 4 : 8,
        flexDirection: layout === "vertical" ? "column" : "row",
      }}
    >
      {reverseOrder ? (
        <>
          {nameSpan}
          {flagImg}
        </>
      ) : (
        <>
          {flagImg}
          {nameSpan}
        </>
      )}
    </div>
  );
}
