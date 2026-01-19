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
    message: "Demasiadas solicitudes. Intenta de nuevo en 1 minuto.",
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
    message: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.",
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
    message: "Demasiadas solicitudes de recuperación. Intenta de nuevo en 1 hora.",
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
    message: "Has creado demasiados recursos. Intenta de nuevo más tarde.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
