import rateLimit from "express-rate-limit";

// General API — 100 req/min per IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "RATE_LIMIT_EXCEEDED" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});

// Auth endpoints — 10 attempts / 15 min per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "TOO_MANY_LOGIN_ATTEMPTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset — 5 req/hour per IP
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "TOO_MANY_RESET_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email verification resend — 3 req/hour per IP
export const verificationResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "TOO_MANY_RESEND_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Corporate invitations — 5 req/hour per IP
export const corporateInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "TOO_MANY_INVITE_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
});
