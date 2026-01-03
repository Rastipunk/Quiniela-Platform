import type { Request, Response, NextFunction } from "express";

// Comentario en español: exige que el usuario autenticado sea ADMIN
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }
  if (req.auth.platformRole !== "ADMIN") {
    return res.status(403).json({ error: "FORBIDDEN" });
  }
  return next();
}
