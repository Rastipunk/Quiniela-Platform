// Design tokens — single source of truth for all style constants.
// Import from "@/lib/theme" instead of hardcoding values.

// ── Colors ──────────────────────────────────────────────────

export const colors = {
  // Brand
  brand: "#4f46e5",
  brandLight: "#667eea",
  brandDark: "#312e81",
  brandGradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  brandGradientAlt: "linear-gradient(135deg, #4f46e5, #7c3aed)",
  brandBg: "rgba(79,70,229,0.08)",

  // Text
  text: "#111",
  textDark: "#333",
  textMuted: "#666",
  textLight: "#999",
  textLighter: "#9ca3af",

  // Semantic text (CSS variable aware)
  varText: "var(--text)",
  varMuted: "var(--muted)",
  varBg: "var(--bg)",
  varSurface: "var(--surface)",
  varBorder: "var(--border)",

  // Backgrounds
  white: "#fff",
  bgLight: "#f8f9fa",
  bgLighter: "#f9fafb",
  bgCard: "#fff",

  // Borders
  border: "#ddd",
  borderLight: "#e5e7eb",
  borderLighter: "#e9ecef",
  borderMedium: "#d1d5db",
  borderDark: "#dee2e6",

  // Status — success
  success: "#28a745",
  successAlt: "#10b981",
  successDark: "#155724",
  successDarker: "#065f46",
  successBg: "#d4edda",
  successBgLight: "#ecfdf5",
  successBgAlt: "#f0fdf4",
  successBorder: "#bbf7d0",
  successBorderAlt: "#c3e6cb",
  successBorderBright: "#6ee7b7",
  successBorderDark: "#34d399",

  // Status — warning
  warning: "#ffc107",
  warningDark: "#856404",
  warningDarker: "#92400e",
  warningBg: "#fff3cd",
  warningBgLight: "#fefce8",
  warningBgAmber: "#fef3c7",
  warningBorder: "#fcd34d",
  warningBorderLight: "#fde68a",

  // Status — error/danger
  error: "#dc2626",
  errorAlt: "#dc3545",
  errorDark: "#b91c1c",
  errorDarker: "#991b1b",
  errorDarkest: "#721c24",
  errorBg: "#fef2f2",
  errorBgAlt: "#f8d7da",
  errorBorder: "#fecaca",
  errorBorderLight: "#fca5a5",
  errorBorderStrong: "#ef4444",

  // Status — info
  info: "#17a2b8",
  infoDark: "#0c5460",
  infoDarker: "#004085",
  infoBg: "#d1ecf1",
  infoBgLight: "#e7f3ff",
  infoBorder: "#b3d7ff",

  // Blue (action/link)
  blue: "#007bff",
  blueBg: "#007bff20",

  // Purple (corporate)
  purple: "#7c3aed",
  purpleDark: "#5b21b6",
  purpleBg: "#ede9fe",
  purpleBorder: "#7c3aed",

  // Disabled/inactive
  disabled: "#ccc",
  disabledDark: "#aaa",

  // Overlay
  overlay: "rgba(0,0,0,0.5)",
  overlayLight: "rgba(0,0,0,0.3)",
  overlayDark: "rgba(0,0,0,0.6)",
  overlayDarker: "rgba(0,0,0,0.45)",
  overlaySubtle: "rgba(0,0,0,0.1)",
  overlayWhite: "rgba(255,255,255,0.2)",

  // Shadows (used in boxShadow)
  shadowLight: "rgba(0,0,0,0.1)",
  shadowMedium: "rgba(0,0,0,0.2)",
  shadowHeavy: "rgba(0,0,0,0.25)",
  shadowDark: "rgba(0,0,0,0.3)",
} as const;

// ── Spacing ─────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

// ── Border Radius ───────────────────────────────────────────

export const radii = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  "2xl": 12,
  "3xl": 14,
  "4xl": 16,
  pill: 999,
  circle: "50%",
} as const;

// ── z-Index Scale ───────────────────────────────────────────
// Establishes a clear stacking hierarchy for the entire app.

export const zIndex = {
  base: 1,
  dropdown: 10,
  sticky: 100,
  navbar: 200,
  languageDropdown: 300,
  overlay: 900,
  modal: 1000,
  modalAbove: 1001,
  toast: 1100,
  expulsion: 9999,
} as const;

// ── Shadows ─────────────────────────────────────────────────

export const shadows = {
  sm: "0 1px 3px rgba(0,0,0,0.1)",
  md: "0 4px 12px rgba(0,0,0,0.1)",
  lg: "0 8px 32px rgba(0,0,0,0.2)",
  xl: "0 10px 40px rgba(0,0,0,0.2)",
  heavy: "0 25px 50px rgba(0,0,0,0.25)",
  card: "0 2px 4px rgba(0,0,0,0.2)",
} as const;

// ── Font sizes ──────────────────────────────────────────────

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 15,
  xl: 16,
  "2xl": 18,
  "3xl": 20,
  "4xl": 24,
  "5xl": 32,
  "6xl": 48,
} as const;

// ── Font weights ────────────────────────────────────────────

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
} as const;

// ── Reusable style patterns ─────────────────────────────────

/** Modal overlay backdrop */
export const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: colors.overlay,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: zIndex.modal,
};

/** Modal overlay (dark variant) */
export const modalOverlayDarkStyle: React.CSSProperties = {
  ...modalOverlayStyle,
  background: colors.overlayDark,
};

/** Standard modal card container */
export const modalCardStyle: React.CSSProperties = {
  background: colors.white,
  borderRadius: radii["4xl"],
  maxWidth: 550,
  width: "100%",
  boxShadow: shadows.lg,
};

/** Admin section card */
export const adminSectionStyle: React.CSSProperties = {
  marginBottom: spacing["2xl"],
  padding: spacing.lg,
  background: colors.bgLight,
  borderRadius: radii["2xl"],
  border: `1px solid ${colors.borderLighter}`,
};

/** Admin section heading */
export const adminHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: fontSize.xl,
  fontWeight: fontWeight.bold,
  marginBottom: spacing.md,
  color: colors.blue,
};

/** Toggle switch track */
export function toggleTrackStyle(isOn: boolean, isBusy: boolean): React.CSSProperties {
  return {
    position: "relative",
    width: 48,
    height: 24,
    borderRadius: radii["2xl"],
    background: isOn ? colors.success : colors.disabled,
    cursor: isBusy ? "wait" : "pointer",
    transition: "background 0.3s ease",
    flexShrink: 0,
  };
}

/** Toggle switch thumb */
export function toggleThumbStyle(isOn: boolean): React.CSSProperties {
  return {
    position: "absolute",
    top: 2,
    left: isOn ? 26 : 2,
    width: 20,
    height: 20,
    borderRadius: radii.circle as string,
    background: colors.white,
    boxShadow: shadows.card,
    transition: "left 0.3s ease",
  };
}

/** Badge style */
export function badgeStyle(borderColor: string, bgColor: string, textColor: string): React.CSSProperties {
  return {
    fontSize: fontSize.xs,
    padding: "2px 8px",
    borderRadius: radii.sm,
    border: `1px solid ${borderColor}`,
    background: bgColor,
    color: textColor,
    fontWeight: fontWeight.semibold,
  };
}

/** Pill badge (used in dashboard, leaderboard) */
export function pillBadgeStyle(borderColor: string, bgColor: string, textColor: string): React.CSSProperties {
  return {
    fontSize: fontSize.xs,
    padding: "3px 8px",
    borderRadius: radii.pill,
    border: `1px solid ${borderColor}`,
    background: bgColor,
    color: textColor,
    fontWeight: fontWeight.semibold,
  };
}
