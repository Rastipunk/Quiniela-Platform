/**
 * Pool Admin Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → send HTTP response.
 * All business logic lives in services/poolAdminService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import {
  sendData,
  sendOk,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendInternal,
} from "../lib/apiResponse";
import {
  setScoringOverride,
  advancePhase,
  updatePoolSettings,
  updatePoolScoringConfig,
  updatePhaseExtraTime,
  ackExtraTimeBanner,
  setPhaselock,
  archivePool,
  unarchivePool,
  getMatchPickBreakdown,
  getPhaseBreakdown,
  getGroupBreakdown,
  getPlayerSummary,
  getPoolNotifications,
} from "../services/poolAdminService";
import { PoolPickTypesConfigSchema } from "../validation/pickConfig";
import { CAPRICHO_SAN_RANGE } from "../lib/caprichoSan";
import { ServiceError } from "../services/authService";
import type { AuditContext } from "../services/authService";

export const poolAdminRouter = Router();

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
      401: sendBadRequest, // no 401 helper needed here
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

const scoringOverrideSchema = z.object({
  scoringEnabled: z.boolean(),
  reason: z.string().max(500).optional(),
});

const advancePhaseSchema = z.object({
  currentPhaseId: z.string(),
  nextPhaseId: z.string().optional(),
});

const updatePoolSettingsSchema = z.object({
  autoAdvanceEnabled: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  extraTimePhases: z.array(z.string()).optional(),
  // Capricho San (ADR-075) — only honored for env-allowlisted pools;
  // the service rejects writes for any other pool.
  caprichoSanEnabled: z.boolean().optional(),
  caprichoSanMin: z.number().int().min(CAPRICHO_SAN_RANGE.MIN).max(CAPRICHO_SAN_RANGE.MAX).optional(),
  caprichoSanMax: z.number().int().min(CAPRICHO_SAN_RANGE.MIN).max(CAPRICHO_SAN_RANGE.MAX).optional(),
  // Prediction deadline (minutes before kickoff). Editing it notifies all
  // players by email (anti-cheat — ADR-085). Range mirrors pool creation.
  deadlineMinutesBeforeKickoff: z.number().int().min(0).max(1440).optional(),
}).refine(
  (d) => d.caprichoSanMin === undefined || d.caprichoSanMax === undefined || d.caprichoSanMin <= d.caprichoSanMax,
  { message: "caprichoSanMin must be <= caprichoSanMax" },
);

const lockPhaseSchema = z.object({
  phaseId: z.string().min(1),
  locked: z.boolean(),
});

// Mirrors the create-pool schema for `pickTypesConfig` — a preset key
// string or a fully-detailed config array. The service handles the
// preset-expansion and validation just like the creation path does.
const updateScoringConfigSchema = z.object({
  pickTypesConfig: z.union([
    z.enum(["BASIC", "SIMPLE", "CUMULATIVE"]),
    PoolPickTypesConfigSchema,
  ]),
});

// ─── Routes ──────────────────────────────────────────────────

// PUT /pools/:poolId/matches/:matchId/scoring-override — Host toggles scoring for a match
poolAdminRouter.put("/:poolId/matches/:matchId/scoring-override", async (req, res) => {
  const parsed = scoringOverrideSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await setScoringOverride(
      req.auth!.userId,
      req.params.poolId,
      req.params.matchId,
      parsed.data.scoringEnabled,
      parsed.data.reason,
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/advance-phase (solo HOST)
poolAdminRouter.post("/:poolId/advance-phase", async (req, res) => {
  const parsed = advancePhaseSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await advancePhase(
      req.auth!.userId,
      req.params.poolId,
      parsed.data.currentPhaseId,
      parsed.data.nextPhaseId,
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// PATCH /pools/:poolId/settings (solo HOST)
poolAdminRouter.patch("/:poolId/settings", async (req, res) => {
  const parsed = updatePoolSettingsSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await updatePoolSettings(
      req.auth!.userId,
      req.params.poolId,
      parsed.data,
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// PATCH /pools/:poolId/scoring-config — "Administrar reglas"
// Only allowed while the pool is in DRAFT (canEditScoringConfig).
// Triggers 409 CONFLICT if called on an ACTIVE/COMPLETED/ARCHIVED pool.
poolAdminRouter.patch("/:poolId/scoring-config", async (req, res) => {
  const parsed = updateScoringConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const result = await updatePoolScoringConfig(
      req.auth!.userId,
      req.params.poolId,
      parsed.data.pickTypesConfig,
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// PATCH /pools/:poolId/phases/:phaseId/extra-time — knockout extra-time v2.
// Gated (acting user's email). Window-enforced. No email — players see a
// per-match scoring legend instead.
const extraTimeBodySchema = z.object({ includeExtraTime: z.boolean() });
poolAdminRouter.patch("/:poolId/phases/:phaseId/extra-time", async (req, res) => {
  const parsed = extraTimeBodySchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await updatePhaseExtraTime(
      req.auth!.userId,
      req.params.poolId,
      req.params.phaseId,
      parsed.data.includeExtraTime,
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/extra-time-banner/ack — dismiss the host banner (v2).
poolAdminRouter.post("/:poolId/extra-time-banner/ack", async (req, res) => {
  try {
    const result = await ackExtraTimeBanner(req.auth!.userId, req.params.poolId);
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/lock-phase (solo HOST)
poolAdminRouter.post("/:poolId/lock-phase", async (req, res) => {
  const parsed = lockPhaseSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await setPhaselock(
      req.auth!.userId,
      req.params.poolId,
      parsed.data.phaseId,
      parsed.data.locked,
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/archive (solo HOST)
poolAdminRouter.post("/:poolId/archive", async (req, res) => {
  try {
    await archivePool(req.auth!.userId, req.params.poolId);
    return sendOk(res);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /pools/:poolId/unarchive (solo HOST) — ADR-080
poolAdminRouter.post("/:poolId/unarchive", async (req, res) => {
  try {
    await unarchivePool(req.auth!.userId, req.params.poolId);
    return sendOk(res);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// ==================== SCORING BREAKDOWN ====================

// GET /pools/:poolId/breakdown/match/:matchId
poolAdminRouter.get("/:poolId/breakdown/match/:matchId", async (req, res) => {
  try {
    const result = await getMatchPickBreakdown(
      req.auth!.userId,
      req.params.poolId,
      req.params.matchId,
    );
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/breakdown/phase/:phaseId
poolAdminRouter.get("/:poolId/breakdown/phase/:phaseId", async (req, res) => {
  try {
    const result = await getPhaseBreakdown(
      req.auth!.userId,
      req.params.poolId,
      req.params.phaseId,
    );
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/breakdown/group/:groupId
poolAdminRouter.get("/:poolId/breakdown/group/:groupId", async (req, res) => {
  try {
    const result = await getGroupBreakdown(
      req.auth!.userId,
      req.params.poolId,
      req.params.groupId,
    );
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/players/:userId/summary
poolAdminRouter.get("/:poolId/players/:userId/summary", async (req, res) => {
  try {
    const result = await getPlayerSummary(
      req.auth!.userId,
      req.params.poolId,
      req.params.userId,
    );
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/notifications
poolAdminRouter.get("/:poolId/notifications", async (req, res) => {
  try {
    const result = await getPoolNotifications(
      req.auth!.userId,
      req.params.poolId,
    );
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});
