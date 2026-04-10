"use client";

import { colors, radii } from "@/lib/theme";

/**
 * Shared toggle switch — consistent styling across the entire app.
 *
 * Fixed dimensions so it never stretches or collapses when surrounding
 * text wraps to multiple lines on mobile.
 *
 * Accessibility: role="switch" + aria-checked for screen readers.
 */

const TRACK_W = 48;
const TRACK_H = 28;
const THUMB_SIZE = 22;
const THUMB_OFFSET = (TRACK_H - THUMB_SIZE) / 2; // 3px

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible label (required for a11y when no visible <label> wraps it) */
  ariaLabel?: string;
  /** Override active color (default: brand indigo) */
  activeColor?: string;
  size?: "default" | "small";
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  activeColor = colors.brand,
  size = "default",
}: ToggleSwitchProps) {
  const isSmall = size === "small";
  const tw = isSmall ? 40 : TRACK_W;
  const th = isSmall ? 22 : TRACK_H;
  const ts = isSmall ? 16 : THUMB_SIZE;
  const offset = (th - ts) / 2;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: tw,
        height: th,
        minWidth: tw,
        minHeight: th,
        borderRadius: th / 2,
        background: checked ? activeColor : colors.disabled,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.2s ease",
        flexShrink: 0,
        border: "none",
        padding: 0,
        outline: "none",
        // Reset browser button defaults
        appearance: "none" as const,
        WebkitAppearance: "none" as const,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: offset,
          left: checked ? tw - ts - offset : offset,
          width: ts,
          height: ts,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 0.2s ease",
          pointerEvents: "none",
        }}
      />
    </button>
  );
}
