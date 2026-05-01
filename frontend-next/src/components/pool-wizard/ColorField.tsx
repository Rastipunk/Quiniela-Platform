"use client";

import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { colors, radii, fontSize, fontWeight, spacing } from "@/lib/theme";
import { isValidHex } from "@/lib/brandColors";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  // Default shown as a "ghost" color when value is empty. Used for
  // the swatch preview when the user hasn't picked a color yet.
  fallback: string;
  ariaLabel?: string;
}

// Single-color picker: clickable swatch that opens a `react-colorful`
// popover, plus a hex text input synced with the same state. Empty
// value means "no override" — the consumer can interpret that as
// "use the platform default".
export function ColorField({ label, value, onChange, fallback, ariaLabel }: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(value);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Keep the local hex draft in sync if parent state changes (e.g.
  // "Reset to default" sweeps both fields back to "").
  useEffect(() => {
    setHexDraft(value);
  }, [value]);

  // Close popover on outside click. Touch devices need touchstart
  // since the click event might be swallowed by the swatch.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [open]);

  function handleHexInput(raw: string) {
    setHexDraft(raw);
    if (raw === "") {
      onChange("");
      return;
    }
    const candidate = raw.startsWith("#") ? raw : `#${raw}`;
    if (isValidHex(candidate)) onChange(candidate.toLowerCase());
  }

  // The swatch shows the picked color, or the fallback at 50% opacity
  // (with a subtle "default" overlay) when nothing is set.
  const swatchColor = isValidHex(value) ? value : fallback;
  const isDefault = !isValidHex(value);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label
        style={{
          display: "block",
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          color: colors.textMuted,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setOpen((s) => !s)}
          aria-label={ariaLabel ?? label}
          aria-expanded={open}
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.md,
            border: `2px solid ${colors.borderMedium}`,
            background: swatchColor,
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
            position: "relative",
            opacity: isDefault ? 0.55 : 1,
            transition: "opacity 0.15s, border-color 0.15s",
          }}
        />
        <input
          type="text"
          value={hexDraft}
          onChange={(e) => handleHexInput(e.target.value)}
          onBlur={() => {
            // On blur, snap visible text back to the committed value
            // so the input never lingers in an invalid state.
            if (!isValidHex(hexDraft) && hexDraft !== "") setHexDraft(value);
          }}
          placeholder={fallback.toUpperCase()}
          maxLength={7}
          spellCheck={false}
          aria-label={`${label} hex`}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 12px",
            borderRadius: radii.md,
            border: `1px solid ${colors.borderLight}`,
            fontSize: fontSize.base,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {open && (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`${label} picker`}
            style={{
              position: "absolute",
              top: 52,
              left: 0,
              zIndex: 20,
              padding: spacing.sm,
              background: colors.white,
              border: `1px solid ${colors.borderMedium}`,
              borderRadius: radii.lg,
              boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
            }}
          >
            <HexColorPicker
              color={isValidHex(value) ? value : fallback}
              onChange={(next) => {
                onChange(next.toLowerCase());
                setHexDraft(next.toLowerCase());
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
