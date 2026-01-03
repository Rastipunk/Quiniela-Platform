import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";

export const adminRouter = Router();

// Comentario en español: endpoint de prueba para validar RBAC admin
adminRouter.get("/ping", requireAuth, requireAdmin, (_req, res) => {
  res.json({ ok: true, admin: true });
});
