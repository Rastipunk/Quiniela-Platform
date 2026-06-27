/**
 * Admin Instance Routes — Thin HTTP layer.
 *
 * Each handler: validate input (Zod) → call service → send HTTP response.
 * All business logic lives in services/adminInstanceService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  sendData,
  sendOk,
  sendCreated,
  sendBadRequest,
  sendNotFound,
  sendConflict,
  sendError,
  sendInternal,
} from "../lib/apiResponse";
import { ServiceError } from "../services/authService";
import type { AuditContext } from "../services/authService";
import {
  createInstance,
  activateInstance,
  completeInstance,
  archiveInstance,
  listInstances,
  getInstance,
  advanceInstanceToR32,
  advanceInstanceKnockout,
  advanceInstanceTwoLegged,
  getGroupStageStatus,
  configureResultSource,
  createMatchMappings,
  listMatchMappings,
  deleteMatchMapping,
  syncInstance,
  getSyncStatus,
  triggerGlobalSync,
  getGlobalSyncStatus,
  updateR16Draw,
} from "../services/adminInstanceService";
import {
  getKnockoutBracketPreview,
  saveKnockoutBracketOverrides,
  setKnockoutReleaseGate,
  setKnockoutPhaseReleased,
} from "../services/knockoutBracketAdmin";

export const adminInstancesRouter = Router();

// Comentario en español: todo aquí requiere ADMIN
adminInstancesRouter.use(requireAuth, requireAdmin);

// ─── Helpers ─────────────────────────────────────────────────

/** Extract audit context from the Express request. */
function auditCtx(req: { ip?: string; get: (h: string) => string | undefined }): AuditContext {
  return { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

/** Map ServiceError to HTTP response. */
function handleServiceError(res: any, err: unknown): void {
  if (err instanceof ServiceError) {
    const send: Record<number, Function> = {
      400: sendBadRequest,
      404: sendNotFound,
      409: sendConflict,
      500: sendInternal,
    };
    const handler = send[err.statusHint];
    if (handler) {
      handler(res, err.code, err.extra);
    } else {
      // Custom status codes (e.g. 503)
      sendError(res, err.statusHint, err.code);
    }
    return;
  }
  throw err; // Re-throw unexpected errors → global error handler
}

// ─── Schemas ─────────────────────────────────────────────────

const createInstanceSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  // Comentario en español: opcional, para crear desde una versión publicada específica
  templateVersionId: z.string().uuid().optional(),
});

const advanceKnockoutSchema = z.object({
  currentPhaseId: z.string(),
  nextPhaseId: z.string(),
});

const advanceTwoLeggedSchema = z.object({
  currentRound: z.string(), // "r32", "r16", "qf", "sf"
  nextRound: z.string(),    // "r16", "qf", "sf", "final"
  poolId: z.string().uuid().optional(),
});

const resultSourceConfigSchema = z.object({
  resultSourceMode: z.enum(["MANUAL", "AUTO"]),
  apiFootballLeagueId: z.number().int().positive().optional(),
  apiFootballSeasonId: z.number().int().positive().optional(),
  syncEnabled: z.boolean().optional(),
});

const matchMappingSchema = z.object({
  internalMatchId: z.string(),
  apiFootballFixtureId: z.number().int().positive(),
});

const bulkMappingsSchema = z.object({
  mappings: z.array(matchMappingSchema).min(1).max(200),
});

// ─── Routes ──────────────────────────────────────────────────

// POST /admin/templates/:templateId/instances
adminInstancesRouter.post("/templates/:templateId/instances", async (req, res) => {
  const { templateId } = req.params;

  const parsed = createInstanceSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await createInstance(
      req.auth!.userId,
      templateId,
      parsed.data.name,
      parsed.data.templateVersionId,
      auditCtx(req),
    );
    return sendCreated(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/instances/:instanceId/activate  (DRAFT -> ACTIVE)
adminInstancesRouter.post("/instances/:instanceId/activate", async (req, res) => {
  try {
    const result = await activateInstance(req.auth!.userId, req.params.instanceId, auditCtx(req));
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/instances/:instanceId/complete  (ACTIVE -> COMPLETED)
adminInstancesRouter.post("/instances/:instanceId/complete", async (req, res) => {
  try {
    const result = await completeInstance(req.auth!.userId, req.params.instanceId, auditCtx(req));
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/instances/:instanceId/archive  (DRAFT|COMPLETED -> ARCHIVED)
adminInstancesRouter.post("/instances/:instanceId/archive", async (req, res) => {
  try {
    const result = await archiveInstance(req.auth!.userId, req.params.instanceId, auditCtx(req));
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /admin/instances
adminInstancesRouter.get("/instances", async (_req, res) => {
  try {
    const result = await listInstances();
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /admin/instances/:instanceId
adminInstancesRouter.get("/instances/:instanceId", async (req, res) => {
  try {
    const result = await getInstance(req.params.instanceId);
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// ========== KNOCKOUT PHASE RELEASE PANEL (ADR-084) ==========

// GET /admin/instances/:instanceId/knockout-brackets — computed FIFA bracket + admin edits.
adminInstancesRouter.get("/instances/:instanceId/knockout-brackets", async (req, res) => {
  try {
    const result = await getKnockoutBracketPreview(req.params.instanceId);
    return sendData(res, result as unknown as Record<string, unknown>);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/instances/:instanceId/knockout-brackets/overrides — save team/date/time edits.
const overrideSchema = z.object({
  overrides: z.record(
    z.string(),
    z.object({
      homeTeamId: z.string().optional(),
      awayTeamId: z.string().optional(),
      kickoffUtc: z.string().optional(),
    }),
  ),
});
adminInstancesRouter.post("/instances/:instanceId/knockout-brackets/overrides", async (req, res) => {
  const parsed = overrideSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");
  try {
    const result = await saveKnockoutBracketOverrides(req.params.instanceId, parsed.data.overrides);
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/instances/:instanceId/knockout-gate — master opt-in toggle.
const gateSchema = z.object({ enabled: z.boolean() });
adminInstancesRouter.post("/instances/:instanceId/knockout-gate", async (req, res) => {
  const parsed = gateSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");
  try {
    const result = await setKnockoutReleaseGate(req.params.instanceId, parsed.data.enabled);
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/instances/:instanceId/knockout-phases/:phaseId/release — release/relock a phase.
const releaseSchema = z.object({ released: z.boolean() });
adminInstancesRouter.post("/instances/:instanceId/knockout-phases/:phaseId/release", async (req, res) => {
  const parsed = releaseSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");
  try {
    const result = await setKnockoutPhaseReleased(req.params.instanceId, req.params.phaseId, parsed.data.released);
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// ========== TOURNAMENT ADVANCEMENT ENDPOINTS ==========

// POST /admin/instances/:instanceId/advance-to-r32
adminInstancesRouter.post("/instances/:instanceId/advance-to-r32", async (req, res) => {
  try {
    const result = await advanceInstanceToR32(req.auth!.userId, req.params.instanceId, auditCtx(req));
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/instances/:instanceId/advance-knockout
adminInstancesRouter.post("/instances/:instanceId/advance-knockout", async (req, res) => {
  const parsed = advanceKnockoutSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await advanceInstanceKnockout(
      req.auth!.userId,
      req.params.instanceId,
      parsed.data.currentPhaseId,
      parsed.data.nextPhaseId,
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/instances/:instanceId/advance-two-legged
adminInstancesRouter.post("/instances/:instanceId/advance-two-legged", async (req, res) => {
  const parsed = advanceTwoLeggedSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await advanceInstanceTwoLegged(
      req.auth!.userId,
      req.params.instanceId,
      parsed.data.currentRound,
      parsed.data.nextRound,
      parsed.data.poolId,
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /admin/instances/:instanceId/group-stage-status
adminInstancesRouter.get("/instances/:instanceId/group-stage-status", async (req, res) => {
  try {
    const result = await getGroupStageStatus(req.params.instanceId);
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// ========== RESULT SOURCE CONFIGURATION ENDPOINTS ==========

// PUT /admin/instances/:instanceId/result-source
adminInstancesRouter.put("/instances/:instanceId/result-source", async (req, res) => {
  const parsed = resultSourceConfigSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await configureResultSource(
      req.auth!.userId,
      req.params.instanceId,
      parsed.data.resultSourceMode,
      parsed.data.apiFootballLeagueId,
      parsed.data.apiFootballSeasonId,
      parsed.data.syncEnabled,
      auditCtx(req),
    );
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// ========== MATCH MAPPING ENDPOINTS ==========

// POST /admin/instances/:instanceId/match-mappings
adminInstancesRouter.post("/instances/:instanceId/match-mappings", async (req, res) => {
  const parsed = bulkMappingsSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR");

  try {
    const result = await createMatchMappings(
      req.auth!.userId,
      req.params.instanceId,
      parsed.data.mappings,
      auditCtx(req),
    );
    return sendCreated(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /admin/instances/:instanceId/match-mappings
adminInstancesRouter.get("/instances/:instanceId/match-mappings", async (req, res) => {
  try {
    const result = await listMatchMappings(req.params.instanceId);
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// DELETE /admin/instances/:instanceId/match-mappings/:mappingId
adminInstancesRouter.delete("/instances/:instanceId/match-mappings/:mappingId", async (req, res) => {
  try {
    await deleteMatchMapping(
      req.auth!.userId,
      req.params.instanceId,
      req.params.mappingId,
      auditCtx(req),
    );
    return sendOk(res);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// ========== SYNC ENDPOINTS ==========

// POST /admin/instances/:instanceId/sync
adminInstancesRouter.post("/instances/:instanceId/sync", async (req, res) => {
  try {
    const result = await syncInstance(req.auth!.userId, req.params.instanceId, auditCtx(req));
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /admin/instances/:instanceId/sync-status
adminInstancesRouter.get("/instances/:instanceId/sync-status", async (req, res) => {
  try {
    const result = await getSyncStatus(req.params.instanceId);
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/sync/trigger-all
adminInstancesRouter.post("/sync/trigger-all", async (req, res) => {
  try {
    const result = await triggerGlobalSync(req.auth!.userId, auditCtx(req));
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/instances/:instanceId/update-r16-draw
adminInstancesRouter.post("/instances/:instanceId/update-r16-draw", async (req, res) => {
  try {
    const result = await updateR16Draw(req.auth!.userId, req.params.instanceId, auditCtx(req));
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /admin/sync/status
adminInstancesRouter.get("/sync/status", async (_req, res) => {
  try {
    const result = await getGlobalSyncStatus();
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});
