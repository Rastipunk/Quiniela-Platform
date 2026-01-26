import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../db";

// Comentario en español: requiere JWT válido y usuario activo
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  const method = req.method;

  try {
    const header = req.header("Authorization");
    if (!header) {
      console.error(`[AUTH] ${method} ${path} - No Authorization header`);
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "NO_AUTH_HEADER" });
    }

    if (!header.startsWith("Bearer ")) {
      console.error(`[AUTH] ${method} ${path} - Invalid Authorization format`);
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "INVALID_AUTH_FORMAT" });
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      console.error(`[AUTH] ${method} ${path} - Empty token`);
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "EMPTY_TOKEN" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (jwtError: any) {
      const errorName = jwtError?.name || "UnknownError";
      const errorMessage = jwtError?.message || "Unknown JWT error";
      console.error(`[AUTH] ${method} ${path} - JWT verification failed: ${errorName} - ${errorMessage}`);
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        reason: errorName === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      });
    }

    // Comentario en español: validación adicional contra la DB (usuario existe y está activo)
    let user;
    try {
      user = await prisma.user.findUnique({ where: { id: payload.userId } });
    } catch (dbError: any) {
      console.error(`[AUTH] ${method} ${path} - Database error:`, dbError?.message || dbError);
      console.error(`[AUTH] ${method} ${path} - Database error stack:`, dbError?.stack);
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        reason: "DATABASE_ERROR",
        debug: dbError?.message || "Unknown database error",
      });
    }

    if (!user) {
      console.error(`[AUTH] ${method} ${path} - User not found: ${payload.userId}`);
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "USER_NOT_FOUND" });
    }

    if (user.status !== "ACTIVE") {
      console.error(`[AUTH] ${method} ${path} - User not active: ${payload.userId}, status: ${user.status}`);
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "USER_NOT_ACTIVE" });
    }

    req.auth = { userId: user.id, platformRole: user.platformRole };
    return next();
  } catch (error: any) {
    console.error(`[AUTH] ${method} ${path} - Unexpected error:`, error?.message || error);
    console.error(`[AUTH] ${method} ${path} - Error stack:`, error?.stack);
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      reason: "INTERNAL_ERROR",
      debug: error?.message || "Unknown error",
    });
  }
}

