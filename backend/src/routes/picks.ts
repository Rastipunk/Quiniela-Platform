import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { canMakePicks } from "../services/poolStateMachine";

export const picksRouter = Router();

// Comentario en español: todo aquí requiere usuario autenticado
picksRouter.use(requireAuth);

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

type TemplateMatch = {
  id: string;
  phaseId: string;
  kickoffUtc: string; // ISO string
  homeTeamId: string;
  awayTeamId: string;
  matchNumber?: number;
  roundLabel?: string;
  venue?: string;
  groupId?: string;
};

function extractMatchesFromInstanceData(dataJson: unknown): TemplateMatch[] {
  if (!dataJson || typeof dataJson !== "object") return [];
  const dj = dataJson as any;
  if (!Array.isArray(dj.matches)) return [];
  return dj.matches as TemplateMatch[];
}

function computeDeadlineUtc(kickoffUtcIso: string, minutesBefore: number): Date | null {
  const kickoff = new Date(kickoffUtcIso);
  if (Number.isNaN(kickoff.getTime())) return null;
  return new Date(kickoff.getTime() - minutesBefore * 60_000);
}

async function requireActivePoolMember(userId: string, poolId: string) {
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  return member != null;
}

// GET /pools/:poolId/matches
// Comentario en español: devuelve el snapshot de matches del TournamentInstance + deadline calculado por pool
picksRouter.get("/:poolId/matches", async (req, res) => {
  const { poolId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) return res.status(403).json({ error: "FORBIDDEN" });

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });

  const matches = extractMatchesFromInstanceData(pool.tournamentInstance.dataJson);
  const now = new Date();

  const enriched = matches.map((m) => {
    const deadlineUtc = computeDeadlineUtc(m.kickoffUtc, pool.deadlineMinutesBeforeKickoff);
    const isLocked = deadlineUtc ? now.getTime() > deadlineUtc.getTime() : false;

    return {
      ...m,
      deadlineUtc: deadlineUtc ? deadlineUtc.toISOString() : null,
      isLocked,
    };
  });

  return res.json({
    pool: {
      id: pool.id,
      name: pool.name,
      timeZone: pool.timeZone,
      deadlineMinutesBeforeKickoff: pool.deadlineMinutesBeforeKickoff,
      tournamentInstanceId: pool.tournamentInstanceId,
    },
    nowUtc: now.toISOString(),
    matches: enriched,
  });
});

// PUT /pools/:poolId/picks/:matchId
// Comentario en español: crea/actualiza el pick del usuario para un match (si no pasó el deadline)
picksRouter.put("/:poolId/picks/:matchId", async (req, res) => {
  const { poolId, matchId } = req.params;

  const parsed = upsertPickSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) return res.status(403).json({ error: "FORBIDDEN" });

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });

  // Validar que el pool permita hacer picks según su estado
  if (!canMakePicks(pool.status as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Cannot make picks in this pool status"
    });
  }

  // Comentario en español: no permitimos picks en instancias archivadas (guardrail)
  if (pool.tournamentInstance.status === "ARCHIVED") {
    return res.status(409).json({ error: "CONFLICT", message: "TournamentInstance is ARCHIVED" });
  }

  const matches = extractMatchesFromInstanceData(pool.tournamentInstance.dataJson);
  const match = matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: "NOT_FOUND", message: "Match not found in instance snapshot" });

  const deadlineUtc = computeDeadlineUtc(match.kickoffUtc, pool.deadlineMinutesBeforeKickoff);
  if (!deadlineUtc) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid kickoffUtc on match" });
  }

  const now = new Date();
  if (now.getTime() > deadlineUtc.getTime()) {
    return res.status(409).json({
      error: "DEADLINE_PASSED",
      deadlineUtc: deadlineUtc.toISOString(),
      nowUtc: now.toISOString(),
    });
  }

  const prediction = await prisma.prediction.upsert({
    where: {
      poolId_userId_matchId: {
        poolId,
        userId: req.auth!.userId,
        matchId,
      },
    },
    update: {
      pickJson: parsed.data.pick,
    },
    create: {
      poolId,
      userId: req.auth!.userId,
      matchId,
      pickJson: parsed.data.pick,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "PREDICTION_UPSERTED",
    entityType: "Prediction",
    entityId: prediction.id,
    dataJson: { poolId, matchId, pickType: (parsed.data.pick as any).type },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json(prediction);
});

// GET /pools/:poolId/matches/:matchId/picks
// Comentario en español: retorna picks de TODOS los usuarios para un partido específico
// SOLO si el deadline del partido ya pasó
picksRouter.get("/:poolId/matches/:matchId/picks", async (req, res) => {
  const { poolId, matchId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) return res.status(403).json({ error: "FORBIDDEN" });

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });

  // Usar fixtureSnapshot si existe (tiene kickoffs personalizados), sino usar dataJson de la instancia
  const fixtureData = pool.fixtureSnapshot || pool.tournamentInstance.dataJson;
  const matches = extractMatchesFromInstanceData(fixtureData);
  const match = matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: "NOT_FOUND", message: "Match not found" });

  const deadlineUtc = computeDeadlineUtc(match.kickoffUtc, pool.deadlineMinutesBeforeKickoff);
  if (!deadlineUtc) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid kickoffUtc" });
  }

  const now = new Date();
  const isUnlocked = now.getTime() > deadlineUtc.getTime();

  // Si el deadline no ha pasado, solo retornar el pick del usuario actual
  if (!isUnlocked) {
    const myPick = await prisma.prediction.findFirst({
      where: { poolId, matchId, userId: req.auth!.userId },
    });

    const me = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { id: true, displayName: true },
    });

    return res.json({
      matchId,
      deadlineUtc: deadlineUtc.toISOString(),
      isUnlocked: false,
      message: "Deadline not passed yet. Only your pick is visible.",
      picks: myPick && me ? [{
        userId: me.id,
        displayName: me.displayName,
        pick: myPick.pickJson,
        isCurrentUser: true,
      }] : [],
    });
  }

  // Deadline pasó: retornar picks de todos los miembros activos
  const members = await prisma.poolMember.findMany({
    where: { poolId, status: "ACTIVE" },
    include: { user: { select: { id: true, displayName: true } } },
  });

  const allPicks = await prisma.prediction.findMany({
    where: { poolId, matchId },
  });

  const picksByUser = new Map<string, any>();
  for (const p of allPicks) {
    picksByUser.set(p.userId, p.pickJson);
  }

  const picks = members.map((m) => ({
    userId: m.user.id,
    displayName: m.user.displayName,
    pick: picksByUser.get(m.user.id) ?? null,
    isCurrentUser: m.user.id === req.auth!.userId,
  }));

  // Ordenar: primero el usuario actual, luego por displayName
  picks.sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return res.json({
    matchId,
    deadlineUtc: deadlineUtc.toISOString(),
    isUnlocked: true,
    picks,
  });
});

// GET /pools/:poolId/picks  (solo mis picks)
// Comentario en español: útil para UI futura
picksRouter.get("/:poolId/picks", async (req, res) => {
  const { poolId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) return res.status(403).json({ error: "FORBIDDEN" });

  const list = await prisma.prediction.findMany({
    where: { poolId, userId: req.auth!.userId },
    orderBy: { updatedAtUtc: "desc" },
  });

  return res.json(list);
});
