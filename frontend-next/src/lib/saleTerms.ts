// Sales-document term dictionary by locale.
// Mirror of backend/src/lib/saleTerms.ts (kept in sync manually — the
// constant is tiny and never changes without a deliberate decision).
//
// Used by the admin sales forms to filter the `term` dropdown by the
// admin's chosen locale, and by the live preview to substitute the
// {term} placeholder in PDF copy hints.

import type { SaleLocale } from "@/lib/api";

export const SALE_TERMS: Record<SaleLocale, readonly string[]> = {
  es: ["polla", "penca", "prode", "quiniela", "porra", "pool"],
  en: ["pool", "prediction game", "sports pool"],
  pt: ["bolão", "palpites", "pool"],
} as const;

export function isTermValidForLocale(locale: SaleLocale, term: string): boolean {
  return SALE_TERMS[locale]?.includes(term) ?? false;
}

export const DEFAULT_TERM_FOR_LOCALE: Record<SaleLocale, string> = {
  es: "polla",
  en: "pool",
  pt: "bolão",
};
