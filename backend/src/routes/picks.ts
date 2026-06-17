/**
 * Picks Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → send response.
 * All business logic lives in services/pickService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import {
  sendData, sendOk, sendBadRequest,
  sendForbidden, sendNotFound,
  sendConflict, sendInternal,
} from "../lib/apiResponse";
import {
  getPoolMatches,
  upsertPick,
  getMatchPicks,
  getMyPicks,
} from "../services/pickService";
import { getPredictionStatus } from "../services/predictionStatusService";
import { ServiceError } from "../services/authService";
import type { AuditContext } from "../services/authService";

export const picksRouter = Router();

// Comentario en español: todo aquí requiere usuario autenticado
picksRouter.use(requireAuth);

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
      401: sendBadRequest,
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

// Comentario en español: esquema mínimo pero útil para MVP (sin casarnos aún a un solo tipo de pick)
const pickSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("OUTCOME"),
    // HOME = gana local, DRAW = empate, AWAY = gana visitante
    outcome: z.enum(["HOME", "DRAW", "AWAY"]),
  }),
  z.object({
    type: z.literal("SCORE"),
    homeGoals: z.number().int().min(0).max(99),
    awayGoals: z.number().int().min(0).max(99),
  }),
  z.object({
    type: z.literal("WINNER"),
    winnerTeamId: z.string().min(1).max(50),
  }),
]);

const upsertPickSchema = z.object({
  pick: pickSchema,
});

// Path params for the prediction-status endpoint. poolId is a UUID; matchId is
// a fixture-snapshot id (a non-empty string, not necessarily a UUID).
const predictionStatusParamsSchema = z.object({
  poolId: z.string().uuid(),
  matchId: z.string().min(1),
});

// ─── Routes ──────────────────────────────────────────────────

// GET /pools/:poolId/matches
// Comentario en español: devuelve el snapshot de matches del TournamentInstance + deadline calculado por pool
picksRouter.get("/:poolId/matches", async (req, res) => {
  const { poolId } = req.params;

  try {
    const result = await getPoolMatches({ userId: req.auth!.userId, poolId });
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// PUT /pools/:poolId/picks/:matchId
// Comentario en español: crea/actualiza el pick del usuario para un match (si no pasó el deadline)
picksRouter.put("/:poolId/picks/:matchId", async (req, res) => {
  const { poolId, matchId } = req.params;

  const parsed = upsertPickSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const result = await upsertPick(
      { userId: req.auth!.userId, poolId, matchId, pick: parsed.data.pick },
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/matches/:matchId/picks
// Comentario en español: retorna picks de TODOS los usuarios para un partido específico
// SOLO si el deadline del partido ya pasó
picksRouter.get("/:poolId/matches/:matchId/picks", async (req, res) => {
  const { poolId, matchId } = req.params;

  try {
    const result = await getMatchPicks({ userId: req.auth!.userId, poolId, matchId });
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/matches/:matchId/prediction-status
// Comentario en español: devuelve, por miembro ACTIVE, si ya guardó predicción
// para el partido (booleano). NUNCA expone el contenido del pick (ADR-045).
// Gateado por feature flag (PREDICTION_STATUS_HOST_ALLOWLIST).
picksRouter.get("/:poolId/matches/:matchId/prediction-status", async (req, res) => {
  const parsed = predictionStatusParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const result = await getPredictionStatus(
      req.auth!.userId,
      parsed.data.poolId,
      parsed.data.matchId,
    );
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/picks  (solo mis picks)
// Comentario en español: útil para UI futura
picksRouter.get("/:poolId/picks", async (req, res) => {
  const { poolId } = req.params;

  try {
    const result = await getMyPicks({ userId: req.auth!.userId, poolId });
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});
