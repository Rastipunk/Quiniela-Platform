/**
 * Sales-document term dictionary by locale.
 *
 * Each Quote and AccountReceivable has a `term` field that replaces
 * the `{term}` placeholder in the fixed PDF copy (§3 bullets, §2
 * intro, etc.). The admin picks one per document; the list shown in
 * the form is filtered by the chosen `locale`. See §11.19 in
 * SALES_AUDIT.md.
 *
 * Adding a term: add to the right locale array + add a translation
 * in `backend/src/pdf/i18n.ts` (commit 3) so the PDF body uses the
 * correct word.
 */

export type SaleLocale = "es" | "en" | "pt";

export const SALE_TERMS: Record<SaleLocale, readonly string[]> = {
  es: ["polla", "penca", "prode", "quiniela", "porra", "pool"],
  en: ["pool", "prediction game", "sports pool"],
  pt: ["bolão", "palpites", "pool"],
} as const;

/**
 * Validation helper used in Zod refinements at the route layer.
 */
export function isTermValidForLocale(locale: SaleLocale, term: string): boolean {
  return SALE_TERMS[locale]?.includes(term) ?? false;
}

/**
 * Convenience: the default term per locale (used as the form's
 * default selection when the admin first opens it).
 */
export const DEFAULT_TERM_FOR_LOCALE: Record<SaleLocale, string> = {
  es: "polla",
  en: "pool",
  pt: "bolão",
};
