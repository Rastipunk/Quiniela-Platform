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

// ── Locales ──────────────────────────────────────────────────
export const SUPPORTED_LOCALES = ["es", "en", "pt"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "es";

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

// ── Placeholder team prefixes (block picks) ─────────────────
export const PLACEHOLDER_TEAM_PREFIXES = [
  "t_TBD",
  "W_",
  "RU_",
  "L_",
  "3rd_",
] as const;
