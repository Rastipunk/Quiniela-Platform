import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { canMakePicks } from "../services/poolStateMachine";
import { advanceToRoundOf32, validateCanAutoAdvance } from "../services/instanceAdvancement";

export const groupStandingsRouter = Router();

// Todo requiere autenticación
groupStandingsRouter.use(requireAuth);

// ==================== SCHEMAS ====================

const groupStandingsSchema = z.object({
  teamIds: z.array(z.string()).length(4), // Exactamente 4 equipos en orden
  reason: z.string().optional(), // Razón de la errata (obligatorio si es edición)
});

// ==================== HELPERS ====================

async function requireActivePoolMember(userId: string, poolId: string) {
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  return member != null;
}

async function requireHostOrCoAdmin(userId: string, poolId: string) {
  const member = await prisma.poolMember.findFirst({
    where: {
      poolId,
      userId,
      status: "ACTIVE",
      role: { in: ["HOST", "CO_ADMIN"] },
    },
  });
  return member != null;
}

// ==================== ENDPOINTS - PLAYER PICKS ====================

// PUT /pools/:poolId/group-standings/:phaseId/:groupId
// Guarda/actualiza el pick de un grupo específico
groupStandingsRouter.put("/:poolId/group-standings/:phaseId/:groupId", async (req, res) => {
  const { poolId, phaseId, groupId } = req.params;

  const parsed = groupStandingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    });
  }

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  // Validar que el pool permita hacer picks según su estado
  if (!canMakePicks(pool.status as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Cannot make picks in this pool status",
    });
  }

  if (pool.tournamentInstance.status === "ARCHIVED") {
    return res.status(409).json({
      error: "CONFLICT",
      message: "TournamentInstance is ARCHIVED",
    });
  }

  // Guardar pick granular
  const prediction = await prisma.groupStandingsPrediction.upsert({
    where: {
      poolId_userId_phaseId_groupId: {
        poolId,
        userId: req.auth!.userId,
        phaseId,
        groupId,
      },
    },
    update: {
      teamIds: parsed.data.teamIds,
    },
    create: {
      poolId,
      userId: req.auth!.userId,
      phaseId,
      groupId,
      teamIds: parsed.data.teamIds,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "GROUP_STANDINGS_PREDICTION_UPSERTED",
    entityType: "GroupStandingsPrediction",
    entityId: prediction.id,
    dataJson: { poolId, phaseId, groupId },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json(prediction);
});

// GET /pools/:poolId/group-standings/:phaseId/:groupId
// Obtiene el pick de un grupo específico del usuario actual
groupStandingsRouter.get("/:poolId/group-standings/:phaseId/:groupId", async (req, res) => {
  const { poolId, phaseId, groupId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const prediction = await prisma.groupStandingsPrediction.findUnique({
    where: {
      poolId_userId_phaseId_groupId: {
        poolId,
        userId: req.auth!.userId,
        phaseId,
        groupId,
      },
    },
  });

  return res.json({ prediction });
});

// GET /pools/:poolId/group-standings/:phaseId
// Obtiene todos los picks de grupos de la fase del usuario actual
groupStandingsRouter.get("/:poolId/group-standings/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const predictions = await prisma.groupStandingsPrediction.findMany({
    where: {
      poolId,
      userId: req.auth!.userId,
      phaseId,
    },
  });

  return res.json({ predictions });
});

// ==================== ENDPOINTS - HOST RESULTS ====================

// PUT /pools/:poolId/group-standings-results/:phaseId/:groupId
// Publica el resultado oficial de un grupo específico
groupStandingsRouter.put("/:poolId/group-standings-results/:phaseId/:groupId", async (req, res) => {
  const { poolId, phaseId, groupId } = req.params;

  const parsed = groupStandingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    });
  }

  const isHostOrCoAdmin = await requireHostOrCoAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Only HOST or CO_ADMIN can publish results",
    });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  // Verificar si ya existe un resultado (para determinar si es errata)
  const existingResult = await prisma.groupStandingsResult.findUnique({
    where: {
      poolId_phaseId_groupId: {
        poolId,
        phaseId,
        groupId,
      },
    },
  });

  const isErrata = existingResult !== null;

  // Si es errata, requerir razón
  if (isErrata && !parsed.data.reason?.trim()) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Se requiere una razón para corregir un resultado ya publicado",
    });
  }

  // Publicar resultado granular
  const result = await prisma.groupStandingsResult.upsert({
    where: {
      poolId_phaseId_groupId: {
        poolId,
        phaseId,
        groupId,
      },
    },
    update: {
      teamIds: parsed.data.teamIds,
      createdByUserId: req.auth!.userId,
      publishedAtUtc: new Date(),
      version: { increment: 1 },
      reason: parsed.data.reason,
    },
    create: {
      poolId,
      phaseId,
      groupId,
      teamIds: parsed.data.teamIds,
      createdByUserId: req.auth!.userId,
      version: 1,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: isErrata ? "GROUP_STANDINGS_RESULT_ERRATA" : "GROUP_STANDINGS_RESULT_PUBLISHED",
    entityType: "GroupStandingsResult",
    entityId: result.id,
    dataJson: { poolId, phaseId, groupId, version: result.version, reason: parsed.data.reason },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json(result);
});

// GET /pools/:poolId/group-standings-results/:phaseId/:groupId
// Obtiene el resultado oficial de un grupo específico
groupStandingsRouter.get("/:poolId/group-standings-results/:phaseId/:groupId", async (req, res) => {
  const { poolId, phaseId, groupId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const result = await prisma.groupStandingsResult.findUnique({
    where: {
      poolId_phaseId_groupId: {
        poolId,
        phaseId,
        groupId,
      },
    },
  });

  return res.json({ result });
});

// GET /pools/:poolId/group-standings-results/:phaseId
// Obtiene todos los resultados oficiales de grupos de la fase
groupStandingsRouter.get("/:poolId/group-standings-results/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const results = await prisma.groupStandingsResult.findMany({
    where: {
      poolId,
      phaseId,
    },
  });

  return res.json({ results });
});

// ==================== GENERAR POSICIONES DESDE RESULTADOS DE PARTIDOS ====================

// POST /pools/:poolId/group-standings-generate/:phaseId/:groupId
// Calcula las posiciones basándose en los resultados de partidos del grupo
// y las guarda en GroupStandingsResult
groupStandingsRouter.post("/:poolId/group-standings-generate/:phaseId/:groupId", async (req, res) => {
  const { poolId, phaseId, groupId } = req.params;

  const isHostOrCoAdmin = await requireHostOrCoAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Only HOST or CO_ADMIN can generate standings",
    });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  // Obtener datos del torneo
  const data = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as any;
  if (!data?.matches || !data?.teams) {
    return res.status(400).json({ error: "INVALID_DATA", message: "No tournament data found" });
  }

  // Obtener partidos del grupo
  const groupMatches = data.matches.filter((m: any) => m.groupId === groupId);
  if (groupMatches.length === 0) {
    return res.status(404).json({ error: "NOT_FOUND", message: "No matches found for group" });
  }

  // Obtener resultados publicados para estos partidos
  const matchIds = groupMatches.map((m: any) => m.id);
  const results = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: matchIds },
    },
    include: { currentVersion: true },
  });

  // Verificar que todos los partidos tengan resultado
  const resultsWithVersion = results.filter((r) => r.currentVersion !== null);
  if (resultsWithVersion.length !== groupMatches.length) {
    return res.status(400).json({
      error: "INCOMPLETE",
      message: `Only ${resultsWithVersion.length}/${groupMatches.length} matches have results`,
    });
  }

  // Obtener equipos del grupo
  const teamIds = new Set<string>();
  groupMatches.forEach((m: any) => {
    teamIds.add(m.homeTeamId);
    teamIds.add(m.awayTeamId);
  });

  // Calcular standings
  const standingsMap = new Map<string, any>();
  teamIds.forEach((teamId) => {
    standingsMap.set(teamId, {
      teamId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  });

  // Procesar cada resultado
  for (const result of resultsWithVersion) {
    const match = groupMatches.find((m: any) => m.id === result.matchId);
    if (!match || !result.currentVersion) continue;

    const home = standingsMap.get(match.homeTeamId);
    const away = standingsMap.get(match.awayTeamId);
    if (!home || !away) continue;

    const homeGoals = result.currentVersion.homeGoals;
    const awayGoals = result.currentVersion.awayGoals;

    home.played++;
    away.played++;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (homeGoals < awayGoals) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  // Ordenar por criterios FIFA
  const standingsArray = Array.from(standingsMap.values());
  standingsArray.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return 0;
  });

  // Extraer teamIds en orden
  const orderedTeamIds = standingsArray.map((s) => s.teamId);

  // Verificar si ya existe un resultado (para determinar si es actualización)
  const existingResult = await prisma.groupStandingsResult.findUnique({
    where: {
      poolId_phaseId_groupId: { poolId, phaseId, groupId },
    },
  });

  // Guardar en GroupStandingsResult
  const savedResult = await prisma.groupStandingsResult.upsert({
    where: {
      poolId_phaseId_groupId: { poolId, phaseId, groupId },
    },
    update: {
      teamIds: orderedTeamIds,
      createdByUserId: req.auth!.userId,
      publishedAtUtc: new Date(),
      version: existingResult ? { increment: 1 } : 1,
      reason: existingResult ? "Regenerado desde resultados de partidos" : null,
    },
    create: {
      poolId,
      phaseId,
      groupId,
      teamIds: orderedTeamIds,
      createdByUserId: req.auth!.userId,
      version: 1,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "GROUP_STANDINGS_GENERATED",
    entityType: "GroupStandingsResult",
    entityId: savedResult.id,
    dataJson: { poolId, phaseId, groupId, standings: standingsArray },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  // ========== AUTO-ADVANCE CHECK ==========
  // Verificar si todos los grupos de la fase tienen standings para auto-advance
  let autoAdvanceResult = null;
  try {
    // Obtener todos los grupos de la fase
    const allGroups = new Set<string>();
    data.matches?.forEach((m: any) => {
      if (m.groupId && (!m.phaseId || m.phaseId === phaseId)) {
        allGroups.add(m.groupId);
      }
    });

    // Verificar cuántos grupos tienen resultado
    const allGroupResults = await prisma.groupStandingsResult.findMany({
      where: { poolId, phaseId },
    });

    console.log(`[AUTO-ADVANCE CHECK] Groups in phase: ${allGroups.size}, Results: ${allGroupResults.length}`);

    if (allGroupResults.length === allGroups.size && allGroups.size > 0) {
      // Todos los grupos tienen resultados, verificar si podemos avanzar
      const validation = await validateCanAutoAdvance(
        pool.tournamentInstance.id,
        phaseId,
        poolId
      );

      if (validation.canAdvance) {
        console.log(`[AUTO-ADVANCE] All groups complete. Advancing to Round of 32...`);

        const result = await advanceToRoundOf32(pool.tournamentInstance.id, poolId);
        autoAdvanceResult = {
          advanced: true,
          phase: "round_of_32",
          winnersCount: result.winners.size,
          runnersUpCount: result.runnersUp.size,
          bestThirdsCount: result.bestThirds.length,
        };

        await writeAuditEvent({
          actorUserId: req.auth!.userId,
          action: "TOURNAMENT_AUTO_ADVANCED_TO_R32",
          entityType: "TournamentInstance",
          entityId: pool.tournamentInstance.id,
          dataJson: {
            triggeredBy: "GROUP_STANDINGS_GENERATE",
            groupId,
            ...autoAdvanceResult,
          },
          ip: req.ip,
          userAgent: req.get("user-agent") ?? null,
        });

        console.log(`[AUTO-ADVANCE SUCCESS] Advanced to Round of 32`);
      } else {
        console.log(`[AUTO-ADVANCE BLOCKED] Reason: ${validation.reason}`);
      }
    }
  } catch (autoAdvanceError: any) {
    // Si falla el auto-advance, loguear pero NO fallar la request original
    console.error("[AUTO-ADVANCE ERROR]", autoAdvanceError.message);
  }

  return res.json({
    result: savedResult,
    standings: standingsArray,
    autoAdvance: autoAdvanceResult,
  });
});

// GET /pools/:poolId/group-match-results/:groupId
// Obtiene los resultados de partidos de un grupo específico
groupStandingsRouter.get("/:poolId/group-match-results/:groupId", async (req, res) => {
  const { poolId, groupId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const data = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as any;
  const groupMatches = data.matches?.filter((m: any) => m.groupId === groupId) || [];
  const matchIds = groupMatches.map((m: any) => m.id);

  const results = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: matchIds },
    },
    include: { currentVersion: true },
  });

  const resultsByMatch = new Map<string, any>();
  for (const r of results) {
    if (r.currentVersion) {
      resultsByMatch.set(r.matchId, {
        matchId: r.matchId,
        homeGoals: r.currentVersion.homeGoals,
        awayGoals: r.currentVersion.awayGoals,
      });
    }
  }

  return res.json({
    matches: groupMatches,
    results: Object.fromEntries(resultsByMatch),
    completedCount: resultsByMatch.size,
    totalCount: groupMatches.length,
  });
});
