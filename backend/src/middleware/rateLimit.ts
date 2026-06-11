import rateLimit, {
  ipKeyGenerator,
  type Options as RateLimitOptions,
} from "express-rate-limit";
import type { Request, Response } from "express";
import { recordRateLimitHit } from "../lib/rateLimitMetrics";

// ── Helpers ─────────────────────────────────────────────────
const envInt = (key: string, fallback: number): number =>
  parseInt(process.env[key] || String(fallback), 10);

/**
 * Each emitted 429 is counted by the platform-health monitor (sliding
 * 60 s window). The counter is independent of express-rate-limit's
 * internal bookkeeping so a metrics regression in one cannot mask the
 * other.
 */
const handler = (_req: Request, res: Response, _next: unknown, opts: RateLimitOptions) => {
  recordRateLimitHit();
  res.status(opts.statusCode).send(opts.message);
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * IPv6 clients are bucketed by subnet. The library default (/56) can
 * span hundreds of subscribers on IPv6-first mobile carriers (CO:
 * Claro/Tigo/Movistar) — collective punishment. /64 is the standard
 * per-subscriber assignment. See ADR-071.
 */
const IPV6_SUBNET = 64;

// ── Rate limit configuration ────────────────────────────────
// All values are overridable via environment variables.

// General API — default 100 req/min per IP
export const apiLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_API_WINDOW_MS", MINUTE),
  max: envInt("RATE_LIMIT_API_MAX", 100),
  message: { error: "RATE_LIMIT_EXCEEDED" },
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: IPV6_SUBNET,
  handler,
  skip: (req) => req.path === "/health",
});

// Auth endpoints — default 10 attempts / 15 min per IP
export const authLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_AUTH_WINDOW_MS", 15 * MINUTE),
  max: envInt("RATE_LIMIT_AUTH_MAX", 10),
  message: { error: "TOO_MANY_LOGIN_ATTEMPTS" },
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: IPV6_SUBNET,
  handler,
});

// Password reset — default 5 req/hour per IP
export const passwordResetLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_RESET_WINDOW_MS", HOUR),
  max: envInt("RATE_LIMIT_RESET_MAX", 5),
  message: { error: "TOO_MANY_RESET_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: IPV6_SUBNET,
  handler,
});

// Email verification resend — default 3 req/hour per IP
export const verificationResendLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_VERIFY_WINDOW_MS", HOUR),
  max: envInt("RATE_LIMIT_VERIFY_MAX", 3),
  message: { error: "TOO_MANY_RESEND_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: IPV6_SUBNET,
  handler,
});

// Pool join — default 10 attempts / 15 min per IP
export const poolJoinLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_POOL_JOIN_WINDOW_MS", 15 * MINUTE),
  max: envInt("RATE_LIMIT_POOL_JOIN_MAX", 10),
  message: { error: "TOO_MANY_JOIN_ATTEMPTS" },
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: IPV6_SUBNET,
  handler,
});

// Per-IP limit on the public corporate invite check endpoint.
// `/auth/check-corporate-invite` is unauthenticated and reveals (a) the
// invite email, (b) whether that email already has an account, (c) the pool
// + company name. The limit is loose enough to allow page reload after a
// network error but tight enough to block mass token enumeration if a leak
// happens. Stricter than the global apiLimiter (100/min) but looser than
// authLimiter (10/15min) since legitimate page loads happen often.
export const corporateInviteCheckLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_INVITE_CHECK_WINDOW_MS", MINUTE),
  max: envInt("RATE_LIMIT_INVITE_CHECK_MAX", 20),
  message: { error: "TOO_MANY_INVITE_CHECKS" },
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: IPV6_SUBNET,
  handler,
});

// Per-IP limit on the actual activation endpoint. The token entropy makes
// brute-force impractical anyway, but this defends against the leaked-token
// scenario (where attacker has a small handful of valid tokens) and
// matches the conservatism of authLimiter on /login + /register.
export const corporateActivateLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_INVITE_ACTIVATE_WINDOW_MS", 15 * MINUTE),
  max: envInt("RATE_LIMIT_INVITE_ACTIVATE_MAX", 10),
  message: { error: "TOO_MANY_ACTIVATION_ATTEMPTS" },
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: IPV6_SUBNET,
  handler,
});

// Per-user invitation send (corporate or regular). Keyed by req.auth.userId
// (falls back to IP for unauthenticated requests, which shouldn't reach the
// invitation endpoints anyway since those require auth). Bucket sized for a
// large corporate event: ~200 invites in a single sitting is normal.
export const inviteSendLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_INVITE_SEND_WINDOW_MS", HOUR),
  max: envInt("RATE_LIMIT_INVITE_SEND_MAX", 200),
  keyGenerator: (req) => {
    // Per-user when auth'd; fall back to IP normalized for IPv6 (/64 prefix)
    // so attackers can't bypass the limit by rotating addresses in the same block.
    const u = (req as { auth?: { userId?: string } }).auth?.userId;
    return u ?? ipKeyGenerator(req.ip ?? "", IPV6_SUBNET);
  },
  message: { error: "TOO_MANY_INVITE_REQUESTS_PER_HOUR" },
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// Hard daily ceiling — defends against compromised host accounts spamming
// invitation emails at scale. Tuned high enough that even a 500-employee
// rollout split across the day passes cleanly.
export const inviteSendDailyLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_INVITE_SEND_DAILY_WINDOW_MS", 24 * HOUR),
  max: envInt("RATE_LIMIT_INVITE_SEND_DAILY_MAX", 1000),
  keyGenerator: (req) => {
    // Per-user when auth'd; fall back to IP normalized for IPv6 (/64 prefix)
    // so attackers can't bypass the limit by rotating addresses in the same block.
    const u = (req as { auth?: { userId?: string } }).auth?.userId;
    return u ?? ipKeyGenerator(req.ip ?? "", IPV6_SUBNET);
  },
  message: { error: "DAILY_INVITE_LIMIT_EXCEEDED" },
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
