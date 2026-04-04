import rateLimit from "express-rate-limit";

// ── Helpers ─────────────────────────────────────────────────
const envInt = (key: string, fallback: number): number =>
  parseInt(process.env[key] || String(fallback), 10);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// ── Rate limit configuration ────────────────────────────────
// All values are overridable via environment variables.

// General API — default 100 req/min per IP
export const apiLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_API_WINDOW_MS", MINUTE),
  max: envInt("RATE_LIMIT_API_MAX", 100),
  message: { error: "RATE_LIMIT_EXCEEDED" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});

// Auth endpoints — default 10 attempts / 15 min per IP
export const authLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_AUTH_WINDOW_MS", 15 * MINUTE),
  max: envInt("RATE_LIMIT_AUTH_MAX", 10),
  message: { error: "TOO_MANY_LOGIN_ATTEMPTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset — default 5 req/hour per IP
export const passwordResetLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_RESET_WINDOW_MS", HOUR),
  max: envInt("RATE_LIMIT_RESET_MAX", 5),
  message: { error: "TOO_MANY_RESET_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email verification resend — default 3 req/hour per IP
export const verificationResendLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_VERIFY_WINDOW_MS", HOUR),
  max: envInt("RATE_LIMIT_VERIFY_MAX", 3),
  message: { error: "TOO_MANY_RESEND_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Corporate invitations — default 5 req/hour per IP
export const corporateInviteLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_CORP_INVITE_WINDOW_MS", HOUR),
  max: envInt("RATE_LIMIT_CORP_INVITE_MAX", 5),
  message: { error: "TOO_MANY_INVITE_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
});
