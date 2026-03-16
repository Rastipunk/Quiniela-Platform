/**
 * Results Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → send HTTP response.
 * All business logic lives in services/resultService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import {
  sendData, sendBadRequest, sendForbidden, sendNotFound,
  sendConflict, sendUnauthorized, sendInternal,
} from "../lib/apiResponse";
import {
  publishResult,
  sendResultNotifications,
  handleAutoAdvance,
  getLeaderboard,
} from "../services/resultService";
import { ServiceError, type AuditContext } from "../services/authService";

export const resultsRouter = Router();
resultsRouter.use(requireAuth);

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

const upsertResultSchema = z.object({
  homeGoals: z.number().int().min(0).max(99),
  awayGoals: z.number().int().min(0).max(99),
  // Score al minuto 90 (opcional — solo necesario si el partido fue a tiempo extra)
  homeGoals90: z.number().int().min(0).max(99).optional(),
  awayGoals90: z.number().int().min(0).max(99).optional(),
  // Comentario en español: penalties opcionales (solo fases eliminatorias con empate)
  homePenalties: z.number().int().min(0).max(99).optional(),
  awayPenalties: z.number().int().min(0).max(99).optional(),
  // Comentario en español: requerido solo cuando ya existía un resultado (errata)
  reason: z.string().min(1).max(500).optional(),
});

// ─── Routes ──────────────────────────────────────────────────

// PUT /pools/:poolId/results/:matchId  (HOST, CO_ADMIN, or CORPORATE_HOST)
resultsRouter.put("/:poolId/results/:matchId", async (req, res) => {
  const { poolId, matchId } = req.params;

  const parsed = upsertResultSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const { saved, pool, match } = await publishResult(
      {
        poolId,
        matchId,
        userId: req.auth!.userId,
        ...parsed.data,
      },
      auditCtx(req),
    );

    // Fire-and-forget: email notifications
    sendResultNotifications({
      poolId,
      matchId,
      homeGoals: parsed.data.homeGoals,
      awayGoals: parsed.data.awayGoals,
      pool: {
        name: pool.name,
        scoringPresetKey: pool.scoringPresetKey,
        tournamentInstance: { dataJson: pool.tournamentInstance.dataJson },
      },
      match,
    });

    // Fire-and-forget: auto-advance logic
    handleAutoAdvance(
      {
        poolId,
        matchId,
        userId: req.auth!.userId,
        pool: {
          tournamentInstance: {
            id: pool.tournamentInstance.id,
            dataJson: pool.tournamentInstance.dataJson,
          },
        },
      },
      auditCtx(req),
    );

    return sendData(res, saved as any);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/leaderboard  (active pool members)
resultsRouter.get("/:poolId/leaderboard", async (req, res) => {
  const { poolId } = req.params;
  const verbose = req.query.verbose === "1" || req.query.verbose === "true";

  try {
    const data = await getLeaderboard(poolId, req.auth!.userId, verbose);
    return sendData(res, data as any);
  } catch (err) {
    return handleServiceError(res, err);
  }
});
