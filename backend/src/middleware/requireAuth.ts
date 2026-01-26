import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../db";

// Middleware que requiere JWT válido y usuario activo
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header("Authorization");
    if (!header) {
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "NO_AUTH_HEADER" });
    }

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "INVALID_AUTH_FORMAT" });
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({ error: "UNAUTHENTICATED", reason: "EMPTY_TOKEN" });
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
    console.error("[AUTH] Unexpected error:", error?.message || error);
    return res.status(401).json({ error: "UNAUTHENTICATED", reason: "INTERNAL_ERROR" });
  }
}
