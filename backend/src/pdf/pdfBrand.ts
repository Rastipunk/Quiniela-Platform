/**
 * Brand colors for PDF rendering.
 *
 * Mirrors frontend-next/src/lib/brand.ts (verified verbatim) plus the
 * green accent extracted from logotipo-degradado-120.svg (.cls-1 fill).
 * Kept duplicated here so the backend doesn't need to reach into the
 * frontend at runtime; CI lint or code review should keep both in sync.
 */

export const PDF_BRAND = {
  primary: "#4F46E5",
  primaryLight: "#667EEA",
  primaryDark: "#312E81",
  secondary: "#764BA2",
  accent: "#7C3AED",
  green: "#7AC943",
  text: "#1F2937",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  bgSubtle: "#F9FAFB",
  bgPurpleSubtle: "#F5F3FF",
  bgGreenSubtle: "#F0FDF4",
  white: "#FFFFFF",
  // Pastel green for table totals — high-contrast with #166534 text.
  totalRowBg: "#DCFCE7",
  totalRowText: "#166534",
  totalRowBorder: "#86EFAC",
} as const;
