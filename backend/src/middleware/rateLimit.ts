// Middleware de Rate Limiting
// Sprint 3 - Protección contra brute-force y abuso de API

import rateLimit from "express-rate-limit";

// Rate limiter general para API
// 100 requests por minuto por IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // Máximo 100 requests por ventana
  message: {
    error: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true, // Retorna rate limit info en headers `RateLimit-*`
  legacyHeaders: false, // Deshabilita headers `X-RateLimit-*`
  // Skip rate limiting para health checks
  skip: (req) => req.path === "/health",
});

// Rate limiter estricto para autenticación
// 10 intentos por 15 minutos por IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 intentos por ventana
  message: {
    error: "TOO_MANY_LOGIN_ATTEMPTS",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para password reset
// 5 solicitudes por hora por IP
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // Máximo 5 solicitudes por hora
  message: {
    error: "TOO_MANY_RESET_REQUESTS",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para reenvío de verificación de email
// 3 solicitudes por hora por IP
export const verificationResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: "TOO_MANY_RESEND_REQUESTS",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para envío de invitaciones corporativas
// 5 solicitudes por hora por IP
export const corporateInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: "TOO_MANY_INVITE_REQUESTS",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para creación de recursos (pools, invites)
// 20 creaciones por hora por IP
export const createResourceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // Máximo 20 creaciones por hora
  message: {
    error: "TOO_MANY_CREATIONS",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
