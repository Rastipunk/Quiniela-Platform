/**
 * Admin Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → send response.
 * All business logic lives in services/adminService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  sendOk, sendData, sendBadRequest, sendNotFound, sendInternal,
  sendUnauthorized, sendForbidden, sendConflict,
} from "../lib/apiResponse";
import { ServiceError } from "../services/authService";
import type { AuditContext } from "../services/authService";
import {
  getPlatformStats,
  seedWc2026,
  updateUclR16,
  auditR16LatePicks,
  fixR16Integrity,
} from "../services/adminService";

export const adminRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────

/** Extract audit context from the Express request. */
function auditCtx(req: { ip?: string; get: (h: string) => string | undefined }): AuditContext {
  return { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

/** Map ServiceError to HTTP response. */
function handleServiceError(res: any, err: unknown): void {
  if (err instanceof ServiceError) {
    const send = {
      400: sendBadRequest,
      401: sendUnauthorized,
      403: sendForbidden,
      404: sendNotFound,
      409: sendConflict,
      500: sendInternal,
    }[err.statusHint] ?? sendInternal;
    send(res, err.code, err.extra);
    return;
  }
  throw err; // Re-throw unexpected errors → global error handler
}

// ─── Schemas ─────────────────────────────────────────────────

const fixR16IntegritySchema = z.object({
  dryRun: z.enum(["true", "false"]).optional().default("true"),
});

// ─── Routes ──────────────────────────────────────────────────

// Comentario en español: endpoint de prueba para validar RBAC admin
adminRouter.get("/ping", requireAuth, requireAdmin, (_req, res) => {
  sendOk(res, { admin: true });
});

// GET /admin/stats — platform stats (users, pools, feedback)
adminRouter.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const data = await getPlatformStats();
    return sendData(res, data);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// Bootstrap-admin disabled in production — use seed script for admin creation
adminRouter.post("/bootstrap-admin", (_req, res) => {
  sendNotFound(res, "Not found");
});

// Endpoint para seedear WC2026 en producción (solo admin)
adminRouter.post("/seed-wc2026", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await seedWc2026();
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/update-ucl-r16 — UCL R16 Update (from updateUclR16Draw script)
adminRouter.post("/update-ucl-r16", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await updateUclR16();
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /admin/audit/r16-late-picks — UCL R16 Audit: late picks
adminRouter.get("/audit/r16-late-picks", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await auditR16LatePicks();
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/fix-r16-integrity?dryRun=true — UCL R16 Integrity Fix
adminRouter.post("/fix-r16-integrity", requireAuth, requireAdmin, async (req, res) => {
  const parsed = fixR16IntegritySchema.safeParse(req.query);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  const dryRun = parsed.data.dryRun !== "false"; // default true

  try {
    const result = await fixR16Integrity(dryRun);
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});
