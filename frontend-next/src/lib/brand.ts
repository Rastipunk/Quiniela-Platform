// ── Brand Identity ──────────────────────────────────────────
// Single source of truth for frontend branding (theme, images, OG).
// Mirrors backend/src/lib/brand.ts — keep both in sync.
//
// Future: when assets arrive, add logoUrl, iconUrl, etc. here.

export const BRAND = {
  name: "Picks4All",
  domain: "picks4all.com",
  primary: "#4f46e5",
  primaryLight: "#667eea",
  primaryDark: "#312e81",
  secondary: "#764ba2",
  accent: "#7c3aed",
  gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  gradientAlt: "linear-gradient(135deg, #4f46e5, #7c3aed)",
  text: "#1F2937",
  textMuted: "#6B7280",
  background: "#F9FAFB",
  card: "#FFFFFF",
} as const;
