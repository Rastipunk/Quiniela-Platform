import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { Prisma } from "@prisma/client";
import { canPublishResults } from "../services/poolStateMachine";
import { requirePoolAdmin } from "../lib/roles";
import { extractPhases, extractMatches, extractTeams } from "../lib/fixture";
import { sendData, sendBadRequest, sendForbidden, sendNotFound, sendConflict } from "../lib/apiResponse";
import { fireAndForget } from "../lib/asyncHelpers";
import { sendKnockoutWinnerOverrideNotification } from "../lib/email";
import { resolveUserLocale } from "../lib/constants";
import { validateCanAutoAdvance, advanceKnockoutPhase } from "../services/instanceAdvancement";

export const structuralResultsRouter = Router();

// Todo requiere autenticación
structuralResultsRouter.use(requireAuth);

// ==================== SCHEMAS ====================

const groupStandingsResultSchema = z.object({
  groupId: z.string(),
  teamIds: z.array(z.string()).length(4),
});

const knockoutWinnerResultSchema = z.object({
  matchId: z.string(),
  winnerId: z.string(),
});

const groupStandingsPhaseResultSchema = z.object({
  groups: z.array(groupStandingsResultSchema),
});

const knockoutPhaseResultSchema = z.object({
  matches: z.array(knockoutWinnerResultSchema),
});

const structuralResultPayloadSchema = z.union([
  groupStandingsPhaseResultSchema,
  knockoutPhaseResultSchema,
]);

// ==================== ENDPOINTS ====================

// PUT /pools/:poolId/structural-results/:phaseId
// Host/Co-Admin publica resultados estructurales de una fase completa
structuralResultsRouter.put("/:poolId/structural-results/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  const parsed = structuralResultPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  const isAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
  if (!isAdmin) {
    return sendForbidden(res, "FORBIDDEN", { message: "Only HOST or CO_ADMIN can publish results" });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return sendNotFound(res, "NOT_FOUND");
  }

  // Validar que el pool permita publicar resultados según su estado
  if (!canPublishResults(pool.status)) {
    return sendConflict(res, "CONFLICT", { message: "Cannot publish results in this pool status" });
  }

  if (pool.tournamentInstance.status === "ARCHIVED") {
    return sendConflict(res, "CONFLICT", { message: "TournamentInstance is ARCHIVED" });
  }

  // Validar que la fase existe en el template
  const phases = extractPhases(pool.tournamentInstance.dataJson);
  const phase = phases.find((p) => p.id === phaseId);

  if (!phase) {
    return sendNotFound(res, "NOT_FOUND", { message: "Phase not found in tournament instance" });
  }

  // Upsert resultado estructural
  const result = await prisma.structuralPhaseResult.upsert({
    where: {
      poolId_phaseId: {
        poolId,
        phaseId,
      },
    },
    update: {
      resultJson: parsed.data as Prisma.InputJsonValue,
      createdByUserId: req.auth!.userId,
      publishedAtUtc: new Date(),
    },
    create: {
      poolId,
      phaseId,
      resultJson: parsed.data as Prisma.InputJsonValue,
      createdByUserId: req.auth!.userId,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "STRUCTURAL_RESULT_PUBLISHED",
    entityType: "StructuralPhaseResult",
    entityId: result.id,
    dataJson: { poolId, phaseId },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return sendData(res, result as any);
});

// PUT /pools/:poolId/structural-results/:phaseId/match/:matchId
// Host publica/sobrescribe el ganador de UN partido knockout
// individual. Hace upsert+merge sobre StructuralPhaseResult.resultJson.matches[].
// Si ya existía un winnerId distinto para ese match → reason obligatorio + email a todos.
// Tras guardar, intenta avance automático si la fase quedó completa.
const knockoutMatchWinnerSchema = z.object({
  winnerId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

structuralResultsRouter.put(
  "/:poolId/structural-results/:phaseId/match/:matchId",
  async (req, res) => {
    const { poolId, phaseId, matchId } = req.params;

    const parsed = knockoutMatchWinnerSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
    }
    const { winnerId, reason } = parsed.data;

    const isAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
    if (!isAdmin) {
      return sendForbidden(res, "FORBIDDEN", { message: "Only HOST or CO_ADMIN can publish results" });
    }

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { tournamentInstance: true },
    });
    if (!pool) return sendNotFound(res, "NOT_FOUND");

    if (!canPublishResults(pool.status)) {
      return sendConflict(res, "CONFLICT", { message: "Cannot publish results in this pool status" });
    }
    if (pool.tournamentInstance.status === "ARCHIVED") {
      return sendConflict(res, "CONFLICT", { message: "TournamentInstance is ARCHIVED" });
    }

    // Validate phase + match exist in the pool's fixture.
    const fixtureSource = pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson;
    const phases = extractPhases(fixtureSource);
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) {
      return sendNotFound(res, "NOT_FOUND", { message: "Phase not found in tournament instance" });
    }
    const allMatches = extractMatches(fixtureSource);
    const targetMatch = allMatches.find((m) => m.id === matchId && m.phaseId === phaseId);
    if (!targetMatch) {
      return sendNotFound(res, "NOT_FOUND", { message: "Match not found in phase" });
    }
    if (winnerId !== targetMatch.homeTeamId && winnerId !== targetMatch.awayTeamId) {
      return sendBadRequest(res, "INVALID_WINNER", {
        message: "winnerId must be one of the two teams in the match",
      });
    }

    // Merge into StructuralPhaseResult.resultJson.matches[].
    const existing = await prisma.structuralPhaseResult.findUnique({
      where: { poolId_phaseId: { poolId, phaseId } },
    });
    type WinnerEntry = { matchId: string; winnerId: string };
    const existingMatches: WinnerEntry[] =
      ((existing?.resultJson as { matches?: WinnerEntry[] } | null)?.matches) ?? [];
    const previousEntry = existingMatches.find((m) => m.matchId === matchId);
    const isOverride = !!previousEntry && previousEntry.winnerId !== winnerId;

    if (isOverride && !reason?.trim()) {
      return sendBadRequest(res, "REASON_REQUIRED_FOR_OVERRIDE", {
        message: "Changing an already-published winner requires a reason. All members will be notified.",
      });
    }

    const mergedMatches: WinnerEntry[] = previousEntry
      ? existingMatches.map((m) => (m.matchId === matchId ? { matchId, winnerId } : m))
      : [...existingMatches, { matchId, winnerId }];

    const updatedResultJson = { matches: mergedMatches };

    const result = await prisma.structuralPhaseResult.upsert({
      where: { poolId_phaseId: { poolId, phaseId } },
      update: {
        resultJson: updatedResultJson as Prisma.InputJsonValue,
        createdByUserId: req.auth!.userId,
        publishedAtUtc: new Date(),
      },
      create: {
        poolId,
        phaseId,
        resultJson: updatedResultJson as Prisma.InputJsonValue,
        createdByUserId: req.auth!.userId,
      },
    });

    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: isOverride ? "KNOCKOUT_WINNER_OVERRIDDEN" : "KNOCKOUT_WINNER_PUBLISHED",
      entityType: "StructuralPhaseResult",
      entityId: result.id,
      dataJson: {
        poolId,
        phaseId,
        matchId,
        winnerId,
        previousWinnerId: previousEntry?.winnerId ?? null,
        reason: reason ?? null,
      },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    // Override → notify everyone (same pattern as match-result override
    // and group-standings override). Fire-and-forget so the host's PUT
    // doesn't wait on Resend.
    if (isOverride && reason && previousEntry) {
      const teams = extractTeams(fixtureSource);
      const teamNameById = new Map(teams.map((t: any) => [t.id, t.name as string]));
      const previousWinnerName =
        teamNameById.get(previousEntry.winnerId) ?? previousEntry.winnerId;
      const newWinnerName = teamNameById.get(winnerId) ?? winnerId;
      const homeName = teamNameById.get(targetMatch.homeTeamId) ?? "Local";
      const awayName = teamNameById.get(targetMatch.awayTeamId) ?? "Visitante";
      const matchDescription = `${homeName} vs ${awayName}`;

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
        fireAndForget(
          "knockout-winner-override-email",
          sendKnockoutWinnerOverrideNotification({
            to: member.user.email,
            userId: member.user.id,
            memberName: member.user.displayName || "Jugador",
            poolName: pool.name,
            poolId,
            matchDescription,
            previousWinnerName,
            newWinnerName,
            reason,
            hostName,
            locale: resolveUserLocale(member.user),
          }),
        );
      }
    }

    // Auto-advance check after publishing. If every match in the phase
    // now has a winner published, advance the bracket. Best-effort —
    // failures don't roll back the publish.
    let autoAdvanceResult: { advanced: true; nextPhaseId: string; resolvedCount: number } | null = null;
    try {
      const phaseMatchCount = allMatches.filter((m) => m.phaseId === phaseId).length;
      if (mergedMatches.length >= phaseMatchCount) {
        const validation = await validateCanAutoAdvance(
          pool.tournamentInstanceId,
          phaseId,
          poolId,
        );
        if (validation.canAdvance) {
          // Best-effort lookup of the next knockout phase id from the
          // fixture's phase ordering. If the current phase is the last,
          // there's nothing to advance to.
          const phaseOrder = phases
            .filter((p) => p.type !== "GROUP")
            .sort((a, b) => a.order - b.order);
          const idx = phaseOrder.findIndex((p) => p.id === phaseId);
          const nextPhase = idx >= 0 ? phaseOrder[idx + 1] : undefined;
          if (nextPhase) {
            const adv = await advanceKnockoutPhase(
              pool.tournamentInstanceId,
              phaseId,
              nextPhase.id,
              poolId,
            );
            autoAdvanceResult = {
              advanced: true,
              nextPhaseId: nextPhase.id,
              resolvedCount: adv.resolvedMatches.length,
            };
            fireAndForget("audit:auto-advance-knockout", writeAuditEvent({
              actorUserId: req.auth!.userId,
              action: "TOURNAMENT_AUTO_ADVANCED_KNOCKOUT",
              entityType: "TournamentInstance",
              entityId: pool.tournamentInstanceId,
              dataJson: {
                triggeredBy: "KNOCKOUT_WINNER_PUBLISHED",
                fromPhaseId: phaseId,
                toPhaseId: nextPhase.id,
                resolvedCount: adv.resolvedMatches.length,
              },
              ip: req.ip,
              userAgent: req.get("user-agent") ?? null,
            }));
          }
        }
      }
    } catch (autoErr) {
      console.error("[AUTO-ADVANCE ERROR after knockout winner publish]", autoErr);
    }

    return sendData(res, { result, isOverride, autoAdvance: autoAdvanceResult } as any);
  },
);

// GET /pools/:poolId/structural-results/:phaseId
// Obtiene el resultado estructural oficial de una fase
structuralResultsRouter.get("/:poolId/structural-results/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  // Cualquier miembro activo puede ver resultados
  const isMember = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!isMember) {
    return sendForbidden(res, "FORBIDDEN");
  }

  const result = await prisma.structuralPhaseResult.findUnique({
    where: {
      poolId_phaseId: {
        poolId,
        phaseId,
      },
    },
    include: {
      createdBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  if (!result) {
    return sendData(res, { result: null });
  }

  return sendData(res, { result } as any);
});

// GET /pools/:poolId/structural-results
// Lista TODOS los resultados estructurales de la pool
structuralResultsRouter.get("/:poolId/structural-results", async (req, res) => {
  const { poolId } = req.params;

  const isMember = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!isMember) {
    return sendForbidden(res, "FORBIDDEN");
  }

  const results = await prisma.structuralPhaseResult.findMany({
    where: { poolId },
    include: {
      createdBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: { createdAtUtc: "asc" },
  });

  return sendData(res, { results } as any);
});
