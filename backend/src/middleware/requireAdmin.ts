import type { Request, Response, NextFunction } from "express";
import { sendUnauthorized, sendForbidden } from "../lib/apiResponse";

// Comentario en español: exige que el usuario autenticado sea ADMIN
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return sendUnauthorized(res, "UNAUTHENTICATED");
  }
  if (req.auth.platformRole !== "ADMIN") {
    return sendForbidden(res, "FORBIDDEN");
  }
  return next();
}
