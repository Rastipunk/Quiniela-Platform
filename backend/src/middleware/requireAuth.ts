import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../db";

// Comentario en español: requiere JWT válido y usuario activo
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    }

    const token = header.slice("Bearer ".length).trim();
    const payload = verifyToken(token);

    // Comentario en español: validación adicional contra la DB (usuario existe y está activo)
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    }

    req.auth = { userId: user.id, platformRole: user.platformRole };
    return next();
  } catch {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }
}

