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

// ── Placeholder team prefixes (block picks) ─────────────────
export const PLACEHOLDER_TEAM_PREFIXES = [
  "t_TBD",
  "W_",
  "RU_",
  "L_",
  "3rd_",
] as const;
