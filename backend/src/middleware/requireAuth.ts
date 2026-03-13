import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../db";
import { getTokenFromCookies } from "../lib/authCookies";

/** Extract Bearer token from Authorization header */
function extractBearerToken(req: Request): string | null {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

// Middleware que requiere JWT válido y usuario activo
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Read token from httpOnly cookie first, fall back to Authorization header
    const token = getTokenFromCookies(req.cookies) || extractBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "NO_AUTH_TOKEN" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (jwtError: any) {
      const errorName = jwtError?.name || "UnknownError";
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        reason: errorName === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      });
    }

    // Validar que el usuario existe y está activo
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "USER_NOT_FOUND" });
    }

    if (user.status !== "ACTIVE") {
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "USER_NOT_ACTIVE" });
    }

    req.auth = { userId: user.id, platformRole: user.platformRole };
    return next();
  } catch (error: any) {
    console.error("[AUTH] Unexpected error:", error instanceof Error ? error.message : String(error));
    return res.status(401).json({ error: "UNAUTHENTICATED", reason: "INTERNAL_ERROR" });
  }
}

// Like requireAuth but does not fail if no token — sets req.auth if valid, otherwise proceeds anonymously
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getTokenFromCookies(req.cookies) || extractBearerToken(req);
    if (!token) return next();

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.status === "ACTIVE") {
      req.auth = { userId: user.id, platformRole: user.platformRole };
    }
  } catch {
    // Invalid token — proceed as anonymous
  }
  return next();
}
