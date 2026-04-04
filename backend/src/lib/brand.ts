// ── Brand Identity ──────────────────────────────────────────
// Single source of truth for backend branding (emails, notifications).
// Mirrors frontend-next/src/lib/brand.ts — keep both in sync.
//
// To override at runtime without redeploy, set BRAND_COLORS_JSON env var:
//   BRAND_COLORS_JSON='{"primary":"#ff0000","gradient":"linear-gradient(...)"}'
//
// Future: when assets arrive, add logoUrl, iconUrl, etc. here.

const defaults = {
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
};

type BrandColors = typeof defaults;

function loadBrand(): BrandColors {
  const override = process.env.BRAND_COLORS_JSON;
  if (!override) return defaults;
  try {
    return { ...defaults, ...JSON.parse(override) };
  } catch {
    console.warn("⚠️ BRAND_COLORS_JSON is invalid JSON, using defaults");
    return defaults;
  }
}

export const BRAND = loadBrand();
