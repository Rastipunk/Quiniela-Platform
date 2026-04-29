/**
 * ISO 3166-1 alpha-2 country list for the corporate quote form.
 *
 * Names are resolved at runtime via `Intl.DisplayNames` so we don't
 * have to maintain three localized name dictionaries by hand. The
 * list is sorted by display name in the active locale.
 *
 * Storage convention: country values are persisted as the alpha-2
 * code ("CO", "AR", "MX") and only ever expanded for display.
 */

export type SupportedLocale = "es" | "en" | "pt";

/**
 * ISO 3166-1 alpha-2 codes that we want to surface in the dropdown.
 * Covers UN-recognized states + a handful of commonly-expected
 * dependent territories (PR, HK, etc.). Sources:
 * https://www.iso.org/obp/ui/#search and Unicode CLDR territory list.
 */
export const COUNTRY_CODES: readonly string[] = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU",
  "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL",
  "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC",
  "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV",
  "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG",
  "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD",
  "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT",
  "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM",
  "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH",
  "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK",
  "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH",
  "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW",
  "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR",
  "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR",
  "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC",
  "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL",
  "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY",
  "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA",
  "ZM", "ZW",
] as const;

const COUNTRY_CODE_SET = new Set(COUNTRY_CODES);

/**
 * Cache the DisplayNames instance per locale — constructing it is non-trivial.
 */
const displayNamesCache = new Map<string, Intl.DisplayNames>();

function getDisplayNames(locale: SupportedLocale): Intl.DisplayNames {
  let dn = displayNamesCache.get(locale);
  if (!dn) {
    dn = new Intl.DisplayNames([locale], { type: "region" });
    displayNamesCache.set(locale, dn);
  }
  return dn;
}

/** Get the localized display name for an ISO alpha-2 code. */
export function getCountryName(code: string, locale: SupportedLocale): string {
  return getDisplayNames(locale).of(code) ?? code;
}

/** Whether a string is a known ISO alpha-2 code. */
export function isValidCountryCode(code: string): boolean {
  return COUNTRY_CODE_SET.has(code);
}

/**
 * Sorted list of countries for rendering in a <datalist>. Sorted by
 * display name in the active locale, with a stable secondary sort by
 * code so identical display names (rare) stay deterministic.
 */
export function getCountriesSorted(
  locale: SupportedLocale,
): Array<{ code: string; name: string }> {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return COUNTRY_CODES
    .map((code) => ({ code, name: getCountryName(code, locale) }))
    .sort((a, b) => collator.compare(a.name, b.name) || a.code.localeCompare(b.code));
}

/**
 * Resolve a user-typed country name (or alpha-2 code) to its ISO code.
 * Case-insensitive and locale-aware. Returns null if no exact match.
 *
 * Used by the quote panel to validate that the typed country is one
 * we recognize before submission.
 */
export function resolveCountryCode(
  input: string,
  locale: SupportedLocale,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && COUNTRY_CODE_SET.has(upper)) return upper;

  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  for (const code of COUNTRY_CODES) {
    const name = getCountryName(code, locale);
    if (collator.compare(name, trimmed) === 0) return code;
  }
  return null;
}
