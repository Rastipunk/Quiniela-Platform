/**
 * Results Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → send HTTP response.
 * All business logic lives in services/resultService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth";
import {
  sendData, sendBadRequest, sendForbidden, sendNotFound,
  sendConflict, sendUnauthorized, sendInternal,
} from "../lib/apiResponse";
import { fireAndForget } from "../lib/asyncHelpers";
import {
  publishResult,
  sendResultNotifications,
  handleAutoAdvance,
  getLeaderboard,
} from "../services/resultService";
import { sendResultOverrideNotification } from "../lib/email";
import { extractTeams } from "../lib/fixture";
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

// ─── Rate Limiters ──────────────────────────────────────────

const resultPublishLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: "TOO_MANY_RESULT_UPDATES" },
  standardHeaders: true,
  legacyHeaders: false,
});

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
resultsRouter.put("/:poolId/results/:matchId", resultPublishLimiter, async (req, res) => {
  const poolId = req.params.poolId as string;
  const matchId = req.params.matchId as string;

  const parsed = upsertResultSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const { saved, pool, match, source } = await publishResult(
      {
        poolId,
        matchId,
        userId: req.auth!.userId,
        ...parsed.data,
      },
      auditCtx(req),
    );

    if ((source as string) === "HOST_OVERRIDE" && parsed.data.reason) {
      // Override: notify ALL members about the change
      const teams = extractTeams(pool.tournamentInstance.dataJson);
      const teamById = new Map(teams.map((t: any) => [t.id, t]));
      const homeName = teamById.get(match.homeTeamId)?.name ?? "Local";
      const awayName = teamById.get(match.awayTeamId)?.name ?? "Visitante";
      const matchDesc = `${homeName} vs ${awayName}`;

      // Get previous result from version history
      const { prisma } = await import("../db");
      const prevVersions = await prisma.poolMatchResultVersion.findMany({
        where: { resultId: saved.id },
        orderBy: { versionNumber: "desc" },
        take: 2,
      });
      const prev = prevVersions[1]; // second most recent = previous
      const prevResult = prev ? `${prev.homeGoals} - ${prev.awayGoals}` : "N/A";
      const newResult = `${parsed.data.homeGoals} - ${parsed.data.awayGoals}`;

      // Get host name
      const host = await prisma.user.findUnique({
        where: { id: req.auth!.userId },
        select: { displayName: true, username: true },
      });
      const hostName = host?.displayName || host?.username || "Host";

      // Get ALL active members and send notification
      const members = await prisma.poolMember.findMany({
        where: { poolId, status: "ACTIVE" },
        include: { user: { select: { email: true, displayName: true } } },
      });

      for (const member of members) {
        fireAndForget("result-override-email", sendResultOverrideNotification({
          to: member.user.email,
          memberName: member.user.displayName || "Jugador",
          poolName: pool.name,
          poolId,
          matchDescription: matchDesc,
          previousResult: prevResult,
          newResult,
          reason: parsed.data.reason,
          hostName,
        }));
      }
    } else {
      // Normal result published (by API sync or legacy manual)
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
    }

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
  const poolId = req.params.poolId as string;
  const verbose = req.query.verbose === "1" || req.query.verbose === "true";

  try {
    const data = await getLeaderboard(poolId, req.auth!.userId, verbose);
    return sendData(res, data as any);
  } catch (err) {
    return handleServiceError(res, err);
  }
});
