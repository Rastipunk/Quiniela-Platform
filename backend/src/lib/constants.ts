// ── Time constants (milliseconds) ───────────────────────────
export const MS = {
  SECOND: 1_000,
  MINUTE: 60 * 1_000,
  HOUR: 60 * 60 * 1_000,
  DAY: 24 * 60 * 60 * 1_000,
} as const;

// ── Token / invite expiry ───────────────────────────────────
export const TOKEN_EXPIRY_MS = {
  EMAIL_VERIFICATION: MS.DAY,          // 24 h
  PASSWORD_RESET: MS.HOUR,             // 1 h
  CORPORATE_INVITE: 30 * MS.DAY,      // 30 days
  POOL_INVITE_DEFAULT: 30 * MS.DAY,   // 30 days
} as const;

// ── Crypto sizes ────────────────────────────────────────────
export const CRYPTO_BYTES = {
  TOKEN: 32,
  POOL_INVITE_CODE: 6,
  USERNAME_SUFFIX: 3,
  GENERATED_PASSWORD: 12,             // final length after slice
} as const;

// ── Match sync windows (configurable via env) ────────────────
const envInt = (key: string, fallback: number): number =>
  parseInt(process.env[key] || String(fallback), 10);

export const MATCH_SYNC = {
  /** Minutes after kickoff for first API check (verify match started) */
  FIRST_CHECK_MINUTES: envInt("MATCH_SYNC_FIRST_CHECK_MIN", 5),
  /** Minutes after kickoff for finish check (verify match ended) */
  FINISH_CHECK_MINUTES: envInt("MATCH_SYNC_FINISH_CHECK_MIN", 110),
  /** Convenience: first check offset in ms */
  get FIRST_CHECK_MS() { return this.FIRST_CHECK_MINUTES * MS.MINUTE; },
  /** Convenience: finish check offset in ms */
  get FINISH_CHECK_MS() { return this.FINISH_CHECK_MINUTES * MS.MINUTE; },
} as const;

// ── Scores service (picks4all-scores integration) ────────────
export const SCORES = {
  /** Grace period after FT before finalizing result (ms) */
  GRACE_PERIOD_MS: envInt("SCORES_GRACE_PERIOD_MS", 5 * 60_000), // 5 min
  /** Delay after estimated FT before API-Football fallback activates (ms) */
  FALLBACK_DELAY_MS: envInt("SCORES_FALLBACK_DELAY_MS", 30 * 60_000), // 30 min
} as const;

// ── Advancement automation ──────────────────────────────────
export const ADVANCEMENT = {
  /** Delay after a phase completes before triggering automatic advancement (ms).
   *  Gives admins/hosts a window to make manual corrections before the bracket
   *  is filled with the next phase teams. */
  DELAY_MS: envInt("ADVANCEMENT_DELAY_MS", 10 * 60_000), // 10 min
} as const;

// ── Capacity warnings ───────────────────────────────────────
// Default percentage of maxParticipants at which the host receives the
// "near full" email. Can be overridden per pool via Pool.capacityWarningThresholdPct.
// Clamped to the valid range 1..99 to prevent both "always fires" and "never fires" misconfig.
const _capacityWarningRaw = envInt("CAPACITY_WARNING_THRESHOLD_PCT", 95);
export const CAPACITY = {
  WARNING_THRESHOLD_PCT_DEFAULT: Math.min(99, Math.max(1, _capacityWarningRaw)),
  // Throttle window for the "someone tried to join a full pool" email. One
  // email per pool per window — keeps the host informed without spamming
  // when bots / link-sharing storms hit a full pool repeatedly.
  BLOCKED_ATTEMPT_THROTTLE_MS: envInt("BLOCKED_ATTEMPT_THROTTLE_HOURS", 24) * MS.HOUR,
} as const;

// ── Locales ──────────────────────────────────────────────────
export const SUPPORTED_LOCALES = ["es", "en", "pt"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "es";

// Countries where we send communications in Spanish or Portuguese.
// Anything NOT in this map falls through to a third branch that decides
// EN (explicitly anglophone) vs DEFAULT_LOCALE (unknown).
const COUNTRY_TO_LOCALE: Record<string, SupportedLocale> = {
  // LATAM → Spanish
  MX: "es", GT: "es", HN: "es", SV: "es", NI: "es", CR: "es", PA: "es",
  CO: "es", VE: "es", EC: "es", PE: "es", BO: "es", PY: "es", CL: "es",
  AR: "es", UY: "es", CU: "es", DO: "es", PR: "es",
  // Spain + Equatorial Guinea
  ES: "es", GQ: "es",
  // Portuguese-speaking
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt", CV: "pt",
};

// Anglophone-majority countries: when we can confirm the user is in one
// of these we DO want to send EN. Without this allow-list, prior to the
// fix any null/unknown country defaulted to EN — which delivered ~93%
// of automatic emails in English to a >95% Spanish-speaking user base.
const ANGLOPHONE_COUNTRIES = new Set<string>([
  "US", "GB", "CA", "AU", "NZ", "IE", "ZA",
  "JM", "TT", "BS", "BB", "BZ", "GY",
]);

/**
 * Resolves the email/UI locale from an ISO 3166-1 alpha-2 country code.
 *
 * Returns:
 *   - "es" for any LATAM/Spain country in the map (or NULL/unknown,
 *     matching `DEFAULT_LOCALE` — the platform is Spanish-first).
 *   - "pt" for Brazil/Portugal/lusophone Africa.
 *   - "en" ONLY for countries explicitly listed as anglophone — we never
 *     guess EN from absence of data.
 */
export function countryToLocale(countryCode?: string | null): SupportedLocale {
  if (!countryCode) return DEFAULT_LOCALE;
  const c = countryCode.toUpperCase();
  if (COUNTRY_TO_LOCALE[c]) return COUNTRY_TO_LOCALE[c];
  if (ANGLOPHONE_COUNTRIES.has(c)) return "en";
  return DEFAULT_LOCALE;
}

/**
 * Single source of truth for "which locale do we send to this user?".
 *
 * Strict hierarchy (top wins):
 *   1. `user.locale` — the EXPLICIT user choice captured by the
 *      first-login modal. Absolute priority. If set to a supported
 *      value, no other signal can override it.
 *   2. `countryToLocale(user.country)` — derived from the user's
 *      country when no explicit choice exists yet. Returns "es" for
 *      LATAM/Spain, "pt" for lusophone Africa+Brazil, "en" only for
 *      explicit anglophone countries, and "es" otherwise.
 *   3. `DEFAULT_LOCALE` ("es") — the safety net inside countryToLocale.
 *
 * A NULL `user.locale` means "user has not picked yet" — the modal
 * captures it, and from that moment onward step 1 dominates.
 */
export function resolveUserLocale(user: {
  locale?: string | null;
  country?: string | null;
}): SupportedLocale {
  const userLocale = user.locale?.toLowerCase();
  if (
    userLocale &&
    (SUPPORTED_LOCALES as readonly string[]).includes(userLocale)
  ) {
    return userLocale as SupportedLocale;
  }
  return countryToLocale(user.country);
}

// ── User profile rules ───────────────────────────────────────
export const USER_RULES = {
  USERNAME_CHANGE_COOLDOWN_DAYS: 30,
  MIN_AGE: 13,
  MAX_AGE: 120,
} as const;

// ── Pagination ───────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
} as const;

// ── Reserved usernames ───────────────────────────────────────
export const RESERVED_USERNAMES = [
  "admin", "root", "system", "quiniela", "api", "www",
] as const;

// ── Phase display names (for email notifications) ───────────
export const PHASE_DISPLAY_NAMES: Record<string, Record<string, string>> = {
  group_stage: { es: "Fase de Grupos", en: "Group Stage", pt: "Fase de Grupos" },
  round_of_32: { es: "Dieciseisavos de Final", en: "Round of 32", pt: "Oitavas de Final" },
  round_of_16: { es: "Octavos de Final", en: "Round of 16", pt: "Oitavas de Final" },
  quarter_finals: { es: "Cuartos de Final", en: "Quarter Finals", pt: "Quartas de Final" },
  semi_finals: { es: "Semifinales", en: "Semi Finals", pt: "Semifinais" },
  final: { es: "Final", en: "Final", pt: "Final" },
};

// ── Placeholder team prefixes (block picks) ─────────────────
export const PLACEHOLDER_TEAM_PREFIXES = [
  "t_TBD",
  "W_",
  "RU_",
  "L_",
  "3rd_",
] as const;
