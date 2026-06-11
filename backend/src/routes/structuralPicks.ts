import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { Prisma } from "@prisma/client";
import { canMakePicks } from "../services/poolStateMachine";
import { extractMatches, extractPhases, typed, type StructuralPickJson } from "../lib/fixture";
import { buildGroupLockTimes, partitionGroupPicksByLock, mergeGroupPicks } from "../lib/poolHelpers";
import { sendData, sendBadRequest, sendForbidden, sendNotFound, sendConflict } from "../lib/apiResponse";

export const structuralPicksRouter = Router();

// Todo requiere autenticación
structuralPicksRouter.use(requireAuth);

// ==================== SCHEMAS ====================

const groupStandingsPickSchema = z.object({
  groupId: z.string(),
  teamIds: z.array(z.string()).length(4), // Exactamente 4 equipos en orden
});

const knockoutWinnerPickSchema = z.object({
  matchId: z.string(),
  winnerId: z.string(),
});

const groupStandingsPhasePickSchema = z.object({
  groups: z.array(groupStandingsPickSchema),
});

const knockoutPhasePickSchema = z.object({
  matches: z.array(knockoutWinnerPickSchema),
});

const structuralPickPayloadSchema = z.union([
  groupStandingsPhasePickSchema,
  knockoutPhasePickSchema,
]);

// ==================== HELPERS ====================

async function requireActivePoolMember(userId: string, poolId: string) {
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  return member != null;
}

// ==================== ENDPOINTS ====================

// PUT /pools/:poolId/structural-picks/:phaseId
// Guarda/actualiza todos los picks estructurales de una fase completa
structuralPicksRouter.put("/:poolId/structural-picks/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  const parsed = structuralPickPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return sendForbidden(res, "FORBIDDEN");
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return sendNotFound(res, "NOT_FOUND");
  }

  // Validar que el pool permita hacer picks según su estado
  if (!canMakePicks(pool.status)) {
    return sendConflict(res, "CONFLICT", { message: "Cannot make picks in this pool status" });
  }

  if (pool.tournamentInstance.status === "ARCHIVED") {
    return sendConflict(res, "CONFLICT", { message: "TournamentInstance is ARCHIVED" });
  }

  // Read from the per-pool fixture snapshot first (CLAUDE.md §6
  // invariant 6) so phases auto-generated after advancement are
  // recognised, and validate the phase exists.
  const fixtureData = pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson;
  const phases = extractPhases(fixtureData);
  const phase = phases.find((p) => p.id === phaseId);

  if (!phase) {
    return sendNotFound(res, "NOT_FOUND", { message: "Phase not found in tournament instance" });
  }

  // Host can manually freeze a phase. Reject any write while it's
  // listed in pool.lockedPhases.
  const lockedPhases = (pool.lockedPhases as string[] | null) ?? [];
  if (lockedPhases.includes(phaseId)) {
    return sendConflict(res, "PHASE_LOCKED", {
      message: "Phase is locked by the host",
      phaseId,
    });
  }

  // Per-match deadline filter for knockout winner picks. Each match
  // has its own kickoff, so a single phase-level lock would
  // unnecessarily freeze later matches when only the earliest one
  // started. Drop any incoming pick whose match has already passed
  // its lock window; merge the rest with the existing prediction so
  // already-saved picks for locked matches are preserved verbatim.
  const allMatches = extractMatches(fixtureData);
  const phaseMatches = allMatches.filter((m) => m.phaseId === phaseId);
  const lockBufferMs = pool.deadlineMinutesBeforeKickoff * 60_000;
  const lockedMatchIds: string[] = [];
  let validIncomingMatches: { matchId: string; winnerId: string }[] = [];
  if ("matches" in parsed.data) {
    for (const incoming of parsed.data.matches) {
      const fixtureMatch = phaseMatches.find((m) => m.id === incoming.matchId);
      if (!fixtureMatch) {
        // Unknown matchId — drop. Could be a stale UI sending a
        // fixture that no longer matches the snapshot.
        lockedMatchIds.push(incoming.matchId);
        continue;
      }
      const lockTime =
        new Date(fixtureMatch.kickoffUtc).getTime() - lockBufferMs;
      if (Date.now() >= lockTime) {
        lockedMatchIds.push(incoming.matchId);
        continue;
      }
      validIncomingMatches.push(incoming);
    }
    // If the user attempted to update at least one match and every
    // single one is locked, surface a clear 409 instead of silently
    // saving an empty update.
    if (parsed.data.matches.length > 0 && validIncomingMatches.length === 0) {
      return sendConflict(res, "DEADLINE_PASSED", {
        message: "All submitted matches are past their lock time",
        lockedMatchIds,
      });
    }
  }

  // Per-group deadline filter for group-standings picks — mirror of the
  // per-match knockout filter above. A group locks when its earliest
  // match reaches the pool's deadline window, the same rule the
  // dedicated /group-standings endpoint enforces. Without this, picks
  // sent through this route after kickoff would still score.
  let validIncomingGroups: { groupId: string; teamIds: string[] }[] = [];
  if ("groups" in parsed.data) {
    const groupLocks = buildGroupLockTimes(
      allMatches,
      pool.deadlineMinutesBeforeKickoff,
    );
    const partitioned = partitionGroupPicksByLock(
      parsed.data.groups,
      groupLocks,
      Date.now(),
    );
    validIncomingGroups = partitioned.valid;
    if (parsed.data.groups.length > 0 && validIncomingGroups.length === 0) {
      return sendConflict(res, "DEADLINE_PASSED", {
        message: "All submitted groups are past their lock time",
        lockedGroupIds: partitioned.lockedGroupIds,
      });
    }
  }

  // Obtener pick existente para hacer merge
  const existingPick = await prisma.structuralPrediction.findUnique({
    where: {
      poolId_userId_phaseId: {
        poolId,
        userId: req.auth!.userId,
        phaseId,
      },
    },
  });

  // Merge con picks existentes: los picks de unidades ya bloqueadas
  // (partidos o grupos) se preservan verbatim — un replace total
  // permitiría borrarlos después del kickoff.
  let finalPickData =
    "matches" in parsed.data
      ? { matches: validIncomingMatches }
      : { groups: validIncomingGroups };
  if (existingPick?.pickJson) {
    const existingData = typed<StructuralPickJson>(existingPick.pickJson);
    if ("matches" in parsed.data && existingData.matches && Array.isArray(existingData.matches)) {
      // Crear un map de picks existentes
      const matchesMap = new Map<string, string>();
      for (const m of existingData.matches) {
        matchesMap.set(m.matchId, m.winnerId);
      }
      // Actualizar con los nuevos picks (solo los que pasaron el filtro de lock)
      for (const m of validIncomingMatches) {
        matchesMap.set(m.matchId, m.winnerId);
      }
      // Convertir de vuelta a array
      finalPickData = {
        matches: Array.from(matchesMap.entries()).map(([matchId, winnerId]) => ({
          matchId,
          winnerId,
        })),
      };
    }
    if ("groups" in parsed.data && Array.isArray(existingData.groups)) {
      finalPickData = {
        groups: mergeGroupPicks(existingData.groups, validIncomingGroups),
      };
    }
  }

  // Guardar en tabla StructuralPrediction (nueva tabla)
  const prediction = await prisma.structuralPrediction.upsert({
    where: {
      poolId_userId_phaseId: {
        poolId,
        userId: req.auth!.userId,
        phaseId,
      },
    },
    update: {
      pickJson: finalPickData as Prisma.InputJsonValue,
    },
    create: {
      poolId,
      userId: req.auth!.userId,
      phaseId,
      pickJson: finalPickData as Prisma.InputJsonValue,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "STRUCTURAL_PREDICTION_UPSERTED",
    entityType: "StructuralPrediction",
    entityId: prediction.id,
    dataJson: { poolId, phaseId },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return sendData(res, prediction as any);
});

// GET /pools/:poolId/structural-picks/:phaseId
// Obtiene el pick estructural del usuario para una fase
structuralPicksRouter.get("/:poolId/structural-picks/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return sendForbidden(res, "FORBIDDEN");
  }

  const prediction = await prisma.structuralPrediction.findUnique({
    where: {
      poolId_userId_phaseId: {
        poolId,
        userId: req.auth!.userId,
        phaseId,
      },
    },
  });

  if (!prediction) {
    return sendData(res, { pick: null });
  }

  return sendData(res, { pick: prediction.pickJson } as any);
});

// GET /pools/:poolId/structural-picks
// Lista TODOS los picks estructurales del usuario en la pool
structuralPicksRouter.get("/:poolId/structural-picks", async (req, res) => {
  const { poolId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return sendForbidden(res, "FORBIDDEN");
  }

  const predictions = await prisma.structuralPrediction.findMany({
    where: { poolId, userId: req.auth!.userId },
    orderBy: { createdAtUtc: "asc" },
  });

  return sendData(res, { picks: predictions } as any);
});
