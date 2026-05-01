// Helpers for working with optional per-organization brand colors.
//
// `Organization.primaryColor` and `secondaryColor` are nullable on the
// backend. Anywhere we render a corporate splash, header, or email,
// we resolve the pair through `resolveBrandColors()` so missing values
// fall back to the Picks4All defaults.

const DEFAULT_PRIMARY = "#4f46e5";
const DEFAULT_SECONDARY = "#764ba2";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const PICKS4ALL_DEFAULT_PRIMARY = DEFAULT_PRIMARY;
export const PICKS4ALL_DEFAULT_SECONDARY = DEFAULT_SECONDARY;

export function isValidHex(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

// Resolve a (primary, secondary) pair from optional inputs. If only
// the primary is set, derive the secondary by darkening the primary
// 25% in HSL so the gradient still has visible contrast. If neither
// is set, fall back to the Picks4All defaults.
export function resolveBrandColors(
  primary: string | null | undefined,
  secondary: string | null | undefined,
): { primary: string; secondary: string; isCustom: boolean } {
  const p = isValidHex(primary) ? primary : null;
  const s = isValidHex(secondary) ? secondary : null;
  if (p && s) return { primary: p, secondary: s, isCustom: true };
  if (p) return { primary: p, secondary: darken(p, 0.25), isCustom: true };
  if (s) return { primary: lighten(s, 0.25), secondary: s, isCustom: true };
  return { primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY, isCustom: false };
}

// ─── Color math (hex ⇄ HSL, lighten/darken, contrast ratio) ──

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = hex.startsWith("#") ? hex.slice(1) : hex;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN:
        h = (gN - bN) / d + (gN < bN ? 6 : 0);
        break;
      case gN:
        h = (bN - rN) / d + 2;
        break;
      default:
        h = (rN - gN) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: conv(h + 1 / 3) * 255,
    g: conv(h) * 255,
    b: conv(h - 1 / 3) * 255,
  };
}

export function darken(hex: string, amount: number): string {
  if (!isValidHex(hex)) return hex;
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const l2 = Math.max(0, l - amount);
  const out = hslToRgb(h, s, l2);
  return rgbToHex(out.r, out.g, out.b);
}

export function lighten(hex: string, amount: number): string {
  if (!isValidHex(hex)) return hex;
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const l2 = Math.min(1, l + amount);
  const out = hslToRgb(h, s, l2);
  return rgbToHex(out.r, out.g, out.b);
}

// Relative luminance per WCAG 2.x.
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// Contrast ratio between two hex colors. Range 1..21. WCAG AA for body
// text wants ≥ 4.5 on normal text, ≥ 3 for large/bold.
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = luminance(hexA);
  const lB = luminance(hexB);
  const light = Math.max(lA, lB);
  const dark = Math.min(lA, lB);
  return (light + 0.05) / (dark + 0.05);
}

// Convenience: do BOTH brand colors clear the WCAG AA contrast bar
// against pure white text? The splash/header render white text on
// these colors, so this is the relevant check for accessibility.
export function hasGoodContrastAgainstWhite(
  primary: string,
  secondary: string,
): boolean {
  const cp = contrastRatio(primary, "#ffffff");
  const cs = contrastRatio(secondary, "#ffffff");
  // 3.0 is the WCAG AA bar for large-format text — splash uses 32px+
  // titles so this is the right threshold. 4.5 would be too strict
  // for vibrant brand colors (red, orange, yellow would all fail).
  return cp >= 3 && cs >= 3;
}

// Build the splash-style gradient string used both in the wizard
// preview and in the actual splash render.
export function buildSplashGradient(primary: string, secondary: string): string {
  return `linear-gradient(160deg, ${primary} 0%, ${secondary} 100%)`;
}
