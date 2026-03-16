/**
 * Pool Members Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → send response.
 * All business logic lives in services/poolMemberService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import {
  sendData, sendOk, sendBadRequest,
  sendForbidden, sendNotFound,
  sendConflict, sendInternal,
} from "../lib/apiResponse";
import { ServiceError } from "../services/authService";
import type { AuditContext } from "../services/authService";
import {
  listMembers,
  listPendingMembers,
  approveMember,
  rejectMember,
  kickMember,
  leaveMember,
  banMember,
  promoteMember,
  demoteMember,
} from "../services/poolMemberService";

export const poolMembersRouter = Router();

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

const rejectMemberSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

const kickMemberSchema = z.object({
  reason: z.string().optional(),
});

const banMemberSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
  deletePicks: z.boolean().optional(),
});

const promoteMemberSchema = z.object({
  memberId: z.string().uuid(),
});

// ─── Routes ──────────────────────────────────────────────────

// GET /pools/:poolId/members  (solo miembros)
poolMembersRouter.get("/:poolId/members", async (req, res) => {
  const { poolId } = req.params;

  try {
    const result = await listMembers(req.auth!.userId, poolId);
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/pending-members  (solo HOST/CO_ADMIN)
poolMembersRouter.get("/:poolId/pending-members", async (req, res) => {
  const { poolId } = req.params;

  try {
    const result = await listPendingMembers(req.auth!.userId, poolId);
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/members/:memberId/approve  (solo HOST/CO_ADMIN)
poolMembersRouter.post("/:poolId/members/:memberId/approve", async (req, res) => {
  const { poolId, memberId } = req.params;

  try {
    const result = await approveMember(
      { actorUserId: req.auth!.userId, poolId, memberId },
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/members/:memberId/reject  (solo HOST/CO_ADMIN)
poolMembersRouter.post("/:poolId/members/:memberId/reject", async (req, res) => {
  const { poolId, memberId } = req.params;

  const parsed = rejectMemberSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await rejectMember(
      { actorUserId: req.auth!.userId, poolId, memberId, reason: parsed.data.reason },
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/members/:memberId/kick  (solo HOST/CO_ADMIN)
poolMembersRouter.post("/:poolId/members/:memberId/kick", async (req, res) => {
  const { poolId, memberId } = req.params;

  const parsed = kickMemberSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await kickMember(
      { actorUserId: req.auth!.userId, poolId, memberId, reason: parsed.data.reason },
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/leave — Player voluntarily leaves a pool
poolMembersRouter.post("/:poolId/leave", async (req, res) => {
  const { poolId } = req.params;

  try {
    const result = await leaveMember(
      { userId: req.auth!.userId, poolId },
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/members/:memberId/ban  (solo HOST/CO_ADMIN)
poolMembersRouter.post("/:poolId/members/:memberId/ban", async (req, res) => {
  const { poolId, memberId } = req.params;

  const parsed = banMemberSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await banMember(
      {
        actorUserId: req.auth!.userId,
        poolId,
        memberId,
        reason: parsed.data.reason,
        deletePicks: parsed.data.deletePicks,
      },
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/members/:memberId/promote (solo HOST)
poolMembersRouter.post("/:poolId/members/:memberId/promote", async (req, res) => {
  const { poolId, memberId } = req.params;

  try {
    const result = await promoteMember(
      { actorUserId: req.auth!.userId, poolId, memberId },
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/members/:memberId/demote (solo HOST)
poolMembersRouter.post("/:poolId/members/:memberId/demote", async (req, res) => {
  const { poolId, memberId } = req.params;

  try {
    const result = await demoteMember(
      { actorUserId: req.auth!.userId, poolId, memberId },
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});
