/**
 * Server-side amount-in-words for sales documents.
 *
 * Wraps `numero-a-letras` and applies locale-aware currency suffixes:
 *   es-CO → "DOSCIENTOS CINCUENTA Y SIETE MIL PESOS M/CTE"
 *   en    → "TWO HUNDRED FIFTY-SEVEN THOUSAND DOLLARS"
 *   pt-BR → "DUZENTOS E CINQUENTA E SETE MIL REAIS"
 *
 * NOTE for v1: only ES uses the actual numero-a-letras conversion
 * because the library is Spanish-only. For EN and PT we render with
 * Intl.NumberFormat + a manual currency-word suffix. When/if we need
 * full Spanish-grade word output in EN/PT, we swap libraries here.
 *
 * Wrapping the library means we can swap it without touching every
 * call site.
 */

// numero-a-letras default exports a function under a quirky name;
// ESM/CJS interop handled by the wrapper.
import { NumerosALetras } from "numero-a-letras";

import type { SaleLocale } from "./saleTerms";

export type AmountCurrency = "COP" | "USD";

interface FormatOptions {
  amount: number;       // In MAJOR units (whole pesos, whole dollars). Cents not supported v1.
  currency: AmountCurrency;
  locale: SaleLocale;
}

/**
 * Render an amount as uppercase words for the cuenta de cobro PDF.
 * The wrapper strips trailing periods, normalises case, and applies
 * the right currency tail per (locale, currency).
 */
export function amountInWords({ amount, currency, locale }: FormatOptions): string {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`amountInWords: amount must be a non-negative integer (got ${amount})`);
  }

  const tail = currencyTail(locale, currency, amount === 1);

  if (locale === "es") {
    // numero-a-letras returns the words; we override its default
    // currency suffix with our own to match Colombian / international
    // conventions per (locale, currency).
    const raw = (NumerosALetras as unknown as (n: number, opts?: unknown) => string)(amount);
    // The library appends "M.N." or similar by default — strip that and
    // any trailing period before adding our suffix.
    const stripped = raw
      .toUpperCase()
      .replace(/\s*PESOS?\s*M\.N\.?\s*$/i, "")
      .replace(/\s*PESOS?\s*$/i, "")
      .replace(/\.$/, "")
      .trim();
    return `${stripped} ${tail}`.trim();
  }

  // EN / PT: numero-a-letras doesn't cover them. Use a simple
  // numeric-string + suffix fallback. v2 candidate: a multilingual
  // amount-in-words lib (e.g. `to-words`).
  const formatted = amount.toLocaleString(locale === "pt" ? "pt-BR" : "en-US");
  return `${formatted.toUpperCase()} ${tail}`;
}

function currencyTail(locale: SaleLocale, currency: AmountCurrency, singular: boolean): string {
  // Currency word + Colombian-style "M/CTE" marker for COP. M/CTE =
  // "moneda corriente", a standard suffix on Colombian formal docs.
  if (currency === "COP") {
    return singular ? "PESO M/CTE" : "PESOS M/CTE";
  }
  // USD
  if (locale === "es") return singular ? "DÓLAR" : "DÓLARES";
  if (locale === "pt") return singular ? "DÓLAR" : "DÓLARES";
  return singular ? "DOLLAR" : "DOLLARS";
}
