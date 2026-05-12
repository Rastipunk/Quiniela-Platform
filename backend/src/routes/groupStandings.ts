/**
 * Group Standings Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → send response.
 * All business logic lives in services/groupStandingsService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import {
  sendData, sendBadRequest, sendForbidden, sendNotFound,
  sendConflict, sendInternal,
} from "../lib/apiResponse";
import { ServiceError, type AuditContext } from "../services/authService";
import {
  upsertGroupStandingsPick,
  getGroupStandingsPick,
  getGroupStandingsPicksByPhase,
  publishGroupStandingsResult,
  getGroupStandingsResult,
  getGroupStandingsResultsByPhase,
  generateGroupStandings,
  getGroupMatchResults,
  getGroupStandingsStats,
} from "../services/groupStandingsService";
import { prisma } from "../db";
import { fireAndForget } from "../lib/asyncHelpers";
import { extractTeams } from "../lib/fixture";
import { countryToLocale } from "../lib/constants";
import { sendGroupStandingsOverrideNotification } from "../lib/email";

export const groupStandingsRouter = Router();

// Todo requiere autenticación
groupStandingsRouter.use(requireAuth);

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

const groupStandingsSchema = z.object({
  teamIds: z.array(z.string()).length(4), // Exactamente 4 equipos en orden
  reason: z.string().optional(), // Razón de la errata (obligatorio si es edición)
});

// ─── Player Picks ────────────────────────────────────────────

// PUT /pools/:poolId/group-standings/:phaseId/:groupId
// Guarda/actualiza el pick de un grupo específico
groupStandingsRouter.put("/:poolId/group-standings/:phaseId/:groupId", async (req, res) => {
  const { poolId, phaseId, groupId } = req.params;

  const parsed = groupStandingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const prediction = await upsertGroupStandingsPick(
      req.auth!.userId, poolId, phaseId, groupId,
      parsed.data.teamIds, auditCtx(req),
    );
    return sendData(res, prediction);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/group-standings/:phaseId/:groupId
// Obtiene el pick de un grupo específico del usuario actual
groupStandingsRouter.get("/:poolId/group-standings/:phaseId/:groupId", async (req, res) => {
  const { poolId, phaseId, groupId } = req.params;

  try {
    const data = await getGroupStandingsPick(req.auth!.userId, poolId, phaseId, groupId);
    return sendData(res, data);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/group-standings/:phaseId
// Obtiene todos los picks de grupos de la fase del usuario actual
groupStandingsRouter.get("/:poolId/group-standings/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  try {
    const data = await getGroupStandingsPicksByPhase(req.auth!.userId, poolId, phaseId);
    return sendData(res, data);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// ─── Host Results ────────────────────────────────────────────

// PUT /pools/:poolId/group-standings-results/:phaseId/:groupId
// Publica el resultado oficial de un grupo específico
groupStandingsRouter.put("/:poolId/group-standings-results/:phaseId/:groupId", async (req, res) => {
  const { poolId, phaseId, groupId } = req.params;

  const parsed = groupStandingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const { result, isErrata, previousTeamIds } = await publishGroupStandingsResult(
      req.auth!.userId, poolId, phaseId, groupId,
      parsed.data.teamIds, parsed.data.reason, auditCtx(req),
    );

    // Override of an existing standings table: notify ALL active members.
    // Mirrors the match-result HOST_OVERRIDE notification pattern.
    if (isErrata && parsed.data.reason && previousTeamIds) {
      const pool = await prisma.pool.findUnique({
        where: { id: poolId },
        include: { tournamentInstance: true },
      });
      if (pool) {
        const teams = extractTeams(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
        const teamNameById = new Map(teams.map((t: any) => [t.id, t.name as string]));
        const toName = (id: string) => teamNameById.get(id) ?? id;

        const host = await prisma.user.findUnique({
          where: { id: req.auth!.userId },
          select: { displayName: true, username: true },
        });
        const hostName = host?.displayName || host?.username || "Host";

        const members = await prisma.poolMember.findMany({
          where: { poolId, status: "ACTIVE" },
          include: {
            user: {
              select: {
                id: true, email: true, displayName: true,
                country: true, emailNotificationsEnabled: true,
              },
            },
          },
        });

        for (const member of members) {
          if (!member.user.emailNotificationsEnabled) continue;
          fireAndForget("group-standings-override-email", sendGroupStandingsOverrideNotification({
            to: member.user.email,
            userId: member.user.id,
            memberName: member.user.displayName || "Jugador",
            poolName: pool.name,
            poolId,
            groupId,
            previousStandings: previousTeamIds.map(toName),
            newStandings: parsed.data.teamIds.map(toName),
            reason: parsed.data.reason,
            hostName,
            locale: countryToLocale(member.user.country),
          }));
        }
      }
    }

    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/group-standings-results/:phaseId/:groupId
// Obtiene el resultado oficial de un grupo específico
groupStandingsRouter.get("/:poolId/group-standings-results/:phaseId/:groupId", async (req, res) => {
  const { poolId, phaseId, groupId } = req.params;

  try {
    const data = await getGroupStandingsResult(req.auth!.userId, poolId, phaseId, groupId);
    return sendData(res, data);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/group-standings-results/:phaseId
// Obtiene todos los resultados oficiales de grupos de la fase
groupStandingsRouter.get("/:poolId/group-standings-results/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  try {
    const data = await getGroupStandingsResultsByPhase(req.auth!.userId, poolId, phaseId);
    return sendData(res, data);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /pools/:poolId/group-standings-stats/:phaseId/:groupId
// Devuelve la tabla clásica calculada en vivo desde los marcadores
// actuales (Pos / PJ / G / E / P / GF / GC / DG / Pts). Tolera datos
// parciales — se llena conforme van terminando los partidos. También
// incluye el orden oficial publicado (si existe) para que el frontend
// pueda mostrar la diferencia si el host hizo un override.
groupStandingsRouter.get(
  "/:poolId/group-standings-stats/:phaseId/:groupId",
  async (req, res) => {
    const { poolId, phaseId, groupId } = req.params;
    try {
      const data = await getGroupStandingsStats(req.auth!.userId, poolId, phaseId, groupId);
      return sendData(res, data);
    } catch (err) {
      return handleServiceError(res, err);
    }
  },
);

// ─── Generate Standings from Match Results ───────────────────

// POST /pools/:poolId/group-standings-generate/:phaseId/:groupId
// Calcula las posiciones basándose en los resultados de partidos del grupo
// y las guarda en GroupStandingsResult
groupStandingsRouter.post("/:poolId/group-standings-generate/:phaseId/:groupId", async (req, res) => {
  const { poolId, phaseId, groupId } = req.params;

  try {
    const data = await generateGroupStandings(
      req.auth!.userId, poolId, phaseId, groupId, auditCtx(req),
    );
    return sendData(res, data);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// ─── Group Match Results ─────────────────────────────────────

// GET /pools/:poolId/group-match-results/:groupId
// Obtiene los resultados de partidos de un grupo específico
groupStandingsRouter.get("/:poolId/group-match-results/:groupId", async (req, res) => {
  const { poolId, groupId } = req.params;

  try {
    const data = await getGroupMatchResults(req.auth!.userId, poolId, groupId);
    return sendData(res, data);
  } catch (err) {
    return handleServiceError(res, err);
  }
});
