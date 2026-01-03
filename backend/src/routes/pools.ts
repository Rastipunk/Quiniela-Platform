import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { getScoringPreset } from "../lib/scoringPresets";


type SnapshotMatch = {
  id: string;
  phaseId: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  matchNumber?: number;
  roundLabel?: string;
  venue?: string;
  groupId?: string;
};

type SnapshotTeam = { id: string; name?: string; code?: string };

function extractMatches(dataJson: unknown): SnapshotMatch[] {
  if (!dataJson || typeof dataJson !== "object") return [];
  const dj = dataJson as any;
  return Array.isArray(dj.matches) ? (dj.matches as SnapshotMatch[]) : [];
}

function extractTeams(dataJson: unknown): SnapshotTeam[] {
  if (!dataJson || typeof dataJson !== "object") return [];
  const dj = dataJson as any;
  return Array.isArray(dj.teams) ? (dj.teams as SnapshotTeam[]) : [];
}

function outcomeFromScore(homeGoals: number, awayGoals: number): "HOME" | "DRAW" | "AWAY" {
  if (homeGoals > awayGoals) return "HOME";
  if (homeGoals < awayGoals) return "AWAY";
  return "DRAW";
}




export const poolsRouter = Router();
poolsRouter.use(requireAuth);

const createPoolSchema = z.object({
  tournamentInstanceId: z.string().uuid(),
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  timeZone: z.string().min(3).max(64).optional(), // Comentario en español: IANA TZ
  deadlineMinutesBeforeKickoff: z.number().int().min(0).max(1440).optional(),
  scoringPresetKey: z.enum(["CLASSIC", "OUTCOME_ONLY", "EXACT_HEAVY"]).optional(),

});

function makeInviteCode() {
  // Comentario en español: código corto, suficientemente único para MVP
  return crypto.randomBytes(6).toString("hex"); // 12 chars
}

async function requirePoolHost(userId: string, poolId: string) {
  const m = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  return m?.role === "HOST";
}

// POST /pools  (crea pool y agrega al creador como HOST)
poolsRouter.post("/", async (req, res) => {
  const parsed = createPoolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

const { tournamentInstanceId, name, description, timeZone, deadlineMinutesBeforeKickoff, scoringPresetKey } = parsed.data;


  const instance = await prisma.tournamentInstance.findUnique({ where: { id: tournamentInstanceId } });
  if (!instance) return res.status(404).json({ error: "NOT_FOUND", message: "TournamentInstance not found" });

  // Comentario en español: no permitimos pools sobre instancias archivadas
  if (instance.status === "ARCHIVED") {
    return res.status(409).json({ error: "CONFLICT", message: "Cannot create pool on ARCHIVED instance" });
  }

  const created = await prisma.$transaction(async (tx) => {
    const pool = await tx.pool.create({
      data: {
        tournamentInstanceId,
        name,
        description: description ?? null,
        visibility: "PRIVATE",
        timeZone: timeZone ?? "UTC",
        deadlineMinutesBeforeKickoff: deadlineMinutesBeforeKickoff ?? 10,
        createdByUserId: req.auth!.userId,
        scoringPresetKey: scoringPresetKey ?? "CLASSIC",
      },
    });

    await tx.poolMember.create({
      data: {
        poolId: pool.id,
        userId: req.auth!.userId,
        role: "HOST",
        status: "ACTIVE",
      },
    });

    return pool;
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "POOL_CREATED",
    entityType: "Pool",
    entityId: created.id,
    dataJson: { tournamentInstanceId },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.status(201).json(created);
});

// GET /pools/:poolId/overview
// Comentario en español: respuesta “1-call” para la pantalla del pool (header + matches + picks + results + leaderboard)
poolsRouter.get("/:poolId/overview", async (req, res) => {
  const { poolId } = req.params;

  const leaderboardVerbose = req.query.leaderboardVerbose === "1" || req.query.leaderboardVerbose === "true";

  // 1) Permiso: debe ser miembro ACTIVO
  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });
  if (!myMembership) return res.status(403).json({ error: "FORBIDDEN" });

  // 2) Pool + instancia
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });
  if (!pool.tournamentInstance) return res.status(409).json({ error: "CONFLICT", message: "Pool has no tournamentInstance" });

  const preset = getScoringPreset(pool.scoringPresetKey);

  const membersActive = await prisma.poolMember.count({ where: { poolId, status: "ACTIVE" } });

  // 3) Snapshot
  const snapshot = pool.tournamentInstance.dataJson;
  const matches = extractMatches(snapshot);
  const teams = extractTeams(snapshot);

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const matchIds = matches.map((m) => m.id);

  const now = new Date();

  // 4) Mis picks
  const myPredictions = await prisma.prediction.findMany({
    where: { poolId, userId: req.auth!.userId, matchId: { in: matchIds } },
  });
  const myPickByMatchId = new Map(myPredictions.map((p) => [p.matchId, p.pickJson as any]));

  // 5) Resultados actuales (currentVersion)
  const results = await prisma.poolMatchResult.findMany({
    where: { poolId, matchId: { in: matchIds } },
    include: { currentVersion: true },
  });

  const resultByMatchId = new Map<string, { homeGoals: number; awayGoals: number }>();
  for (const r of results) {
    if (r.currentVersion) {
      resultByMatchId.set(r.matchId, { homeGoals: r.currentVersion.homeGoals, awayGoals: r.currentVersion.awayGoals });
    }
  }

  // 6) Matches “listos para UI”: deadline + lock + team info + mi pick + resultado
  const matchCards = matches.map((m) => {
    const kickoff = new Date(m.kickoffUtc);
    const deadlineUtc = new Date(kickoff.getTime() - pool.deadlineMinutesBeforeKickoff * 60_000);
    const isLocked = now.getTime() >= deadlineUtc.getTime();

    const homeTeam = teamById.get(m.homeTeamId);
    const awayTeam = teamById.get(m.awayTeamId);

    const myPick = myPickByMatchId.get(m.id) ?? null;
    const result = resultByMatchId.get(m.id) ?? null;

    return {
      id: m.id,
      phaseId: m.phaseId,
      kickoffUtc: m.kickoffUtc,
      deadlineUtc: deadlineUtc.toISOString(),
      isLocked,
      matchNumber: m.matchNumber ?? null,
      roundLabel: m.roundLabel ?? null,
      venue: m.venue ?? null,
      groupId: m.groupId ?? null,
      homeTeam: { id: m.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
      awayTeam: { id: m.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
      myPick,
      result,
    };
  });

  // 7) Leaderboard (mismo scoring MVP)
  const members = await prisma.poolMember.findMany({
    where: { poolId, status: "ACTIVE" },
    include: { user: true },
    orderBy: { joinedAtUtc: "asc" },
  });

  const allPredictions = await prisma.prediction.findMany({
    where: { poolId, matchId: { in: matchIds } },
  });

  const predsByUserMatch = new Map<string, Map<string, any>>();
  for (const p of allPredictions) {
    const byMatch = predsByUserMatch.get(p.userId) ?? new Map<string, any>();
    byMatch.set(p.matchId, p.pickJson as any);
    predsByUserMatch.set(p.userId, byMatch);
  }

  function scorePick(pick: any, actualHome: number, actualAway: number) {
    const actualOutcome = outcomeFromScore(actualHome, actualAway);

    // Caso 1: pick por outcome (HOME/DRAW/AWAY)
    if (pick?.type === "OUTCOME") {
      const ok = pick.outcome === actualOutcome;
      const outcomePoints = ok ? preset.outcomePoints : 0;

      return {
        outcomePoints,
        exactScoreBonus: 0,
        totalPoints: outcomePoints,
        details: leaderboardVerbose ? { actualOutcome } : undefined,
      };
    }

    // Caso 2: pick por score (homeGoals/awayGoals)
    if (pick?.type === "SCORE") {
      const predictedOutcome = outcomeFromScore(pick.homeGoals, pick.awayGoals);
      const outcomeCorrect = predictedOutcome === actualOutcome;

      const outcomePoints = outcomeCorrect ? preset.outcomePoints : 0;

      const exact = pick.homeGoals === actualHome && pick.awayGoals === actualAway;
      const exactScoreBonus =
        preset.allowScorePick && exact && outcomeCorrect ? preset.exactScoreBonus : 0;

      return {
        outcomePoints,
        exactScoreBonus,
        totalPoints: outcomePoints + exactScoreBonus,
        details: leaderboardVerbose
          ? {
              predictedScore: { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
              actualScore: { homeGoals: actualHome, awayGoals: actualAway },
              predictedOutcome,
              actualOutcome,
              outcomeCorrect,
              exact,
            }
          : undefined,
      };
    }

    // Otros tipos (futuro: WINNER, GROUP_POS, etc.)
    return {
      outcomePoints: 0,
      exactScoreBonus: 0,
      totalPoints: 0,
      details: leaderboardVerbose ? { unsupportedPickType: pick?.type ?? null } : undefined,
    };
  }


  const leaderboardRows = members.map((m) => {
    let points = 0;
    let scoredMatches = 0;

    const byMatch = predsByUserMatch.get(m.userId) ?? new Map<string, any>();
    const breakdown: any[] = [];

    for (const match of matches) {
      const pick = byMatch.get(match.id);
      const r = resultByMatchId.get(match.id);

      if (!r) {
        if (leaderboardVerbose) {
          breakdown.push({ matchId: match.id, status: pick ? "PICKED_NO_RESULT" : "NO_PICK_NO_RESULT" });
        }
        continue;
      }

      if (!pick) {
        if (leaderboardVerbose) {
          breakdown.push({
            matchId: match.id,
            status: "NO_PICK",
            result: r,
            points: { outcomePoints: 0, exactScoreBonus: 0, totalPoints: 0 },
          });
        }
        continue;
      }

      const scored = scorePick(pick, r.homeGoals, r.awayGoals);
      points += scored.totalPoints;
      scoredMatches += 1;

      if (leaderboardVerbose) {
        breakdown.push({
          matchId: match.id,
          pick,
          result: r,
          points: { outcomePoints: scored.outcomePoints, exactScoreBonus: scored.exactScoreBonus, totalPoints: scored.totalPoints },
          details: scored.details,
          status: "SCORED",
        });
      }
    }

    return {
      userId: m.userId,
      displayName: m.user.displayName,
      role: m.role,
      points,
      scoredMatches,
      joinedAtUtc: m.joinedAtUtc,
      breakdown: leaderboardVerbose ? breakdown : undefined,
    };
  });

  leaderboardRows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aTime = a.joinedAtUtc instanceof Date ? a.joinedAtUtc.getTime() : new Date(a.joinedAtUtc).getTime();
    const bTime = b.joinedAtUtc instanceof Date ? b.joinedAtUtc.getTime() : new Date(b.joinedAtUtc).getTime();
    return aTime - bTime;
  });

  // 8) Respuesta final “1-call”
  return res.json({
    nowUtc: now.toISOString(),
    pool: {
      id: pool.id,
      name: pool.name,
      description: pool.description,
      visibility: pool.visibility,
      timeZone: pool.timeZone,
      deadlineMinutesBeforeKickoff: pool.deadlineMinutesBeforeKickoff,
      tournamentInstanceId: pool.tournamentInstanceId,
      createdByUserId: pool.createdByUserId,
      createdAtUtc: pool.createdAtUtc,
      updatedAtUtc: pool.updatedAtUtc,
      scoringPresetKey: pool.scoringPresetKey ?? "CLASSIC",
    },
    myMembership: {
      role: myMembership.role,
      status: myMembership.status,
      joinedAtUtc: myMembership.joinedAtUtc,
    },
    counts: { membersActive },
    tournamentInstance: {
      id: pool.tournamentInstance.id,
      name: pool.tournamentInstance.name,
      status: pool.tournamentInstance.status,
      templateId: pool.tournamentInstance.templateId,
      templateVersionId: pool.tournamentInstance.templateVersionId,
    },
    permissions: {
      canManageResults: myMembership.role === "HOST",
      canInvite: myMembership.role === "HOST",
    },
    matches: matchCards,
    leaderboard: {
      scoring: { outcomePoints: preset.outcomePoints, exactScoreBonus: preset.exactScoreBonus },
      scoringPreset: {
        key: preset.key,
        name: preset.name,
        description: preset.description,
        allowScorePick: preset.allowScorePick,
      },
      verbose: leaderboardVerbose,
      rows: leaderboardRows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId,
      displayName: r.displayName,
      role: r.role,
      points: r.points,
      scoredMatches: r.scoredMatches,
      joinedAtUtc: r.joinedAtUtc,
      ...(leaderboardVerbose ? { breakdown: r.breakdown } : {}),
})),

    },
  });
});



// GET /pools/:poolId
// Comentario en español: detalle del pool + mi membership + counts (para pantalla pool)
poolsRouter.get("/:poolId", async (req, res) => {
  const { poolId } = req.params;

  // Comentario en español: hay que ser miembro ACTIVO para ver el pool
  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const membersActive = await prisma.poolMember.count({
    where: { poolId, status: "ACTIVE" },
  });

  return res.json({
    pool: {
      id: pool.id,
      name: pool.name,
      description: pool.description,
      visibility: pool.visibility,
      timeZone: pool.timeZone,
      deadlineMinutesBeforeKickoff: pool.deadlineMinutesBeforeKickoff,
      tournamentInstanceId: pool.tournamentInstanceId,
      createdByUserId: pool.createdByUserId,
      createdAtUtc: pool.createdAtUtc,
      updatedAtUtc: pool.updatedAtUtc,
    },
    myMembership: {
      role: myMembership.role,
      status: myMembership.status,
      joinedAtUtc: myMembership.joinedAtUtc,
    },
    counts: {
      membersActive,
    },
    tournamentInstance: pool.tournamentInstance
      ? {
          id: pool.tournamentInstance.id,
          name: pool.tournamentInstance.name,
          status: pool.tournamentInstance.status,
          templateId: pool.tournamentInstance.templateId,
          templateVersionId: pool.tournamentInstance.templateVersionId,
        }
      : null,
    permissions: {
      // Comentario en español: útil para habilitar/ocultar botones en UI
      canManageResults: myMembership.role === "HOST",
      canInvite: myMembership.role === "HOST",
    },
  });
});


// GET /pools/:poolId/members  (solo miembros)
poolsRouter.get("/:poolId/members", async (req, res) => {
  const { poolId } = req.params;

  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });
  if (!member) return res.status(403).json({ error: "FORBIDDEN" });

  const members = await prisma.poolMember.findMany({
    where: { poolId },
    include: { user: true },
    orderBy: { joinedAtUtc: "asc" },
  });

  return res.json(members.map(m => ({
    id: m.id,
    userId: m.userId,
    displayName: m.user.displayName,
    role: m.role,
    status: m.status,
    joinedAtUtc: m.joinedAtUtc,
  })));
});

const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(500).optional(),
  expiresAtUtc: z.string().datetime().optional(),
});

// POST /pools/:poolId/invites  (solo HOST)
poolsRouter.post("/:poolId/invites", async (req, res) => {
  const { poolId } = req.params;

  const isHost = await requirePoolHost(req.auth!.userId, poolId);
  if (!isHost) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = createInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });

  // Comentario en español: generamos code y reintentamos si colisiona (muy raro)
  let code = makeInviteCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.poolInvite.findUnique({ where: { code } });
    if (!exists) break;
    code = makeInviteCode();
  }

  const invite = await prisma.poolInvite.create({
    data: {
      poolId,
      code,
      createdByUserId: req.auth!.userId,
      maxUses: parsed.data.maxUses ?? null,
      expiresAtUtc: parsed.data.expiresAtUtc ? new Date(parsed.data.expiresAtUtc) : null,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "POOL_INVITE_CREATED",
    entityType: "PoolInvite",
    entityId: invite.id,
    dataJson: { poolId, code },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.status(201).json(invite);
});

const joinSchema = z.object({
  code: z.string().min(6).max(64),
});

// POST /pools/join  (por invite code)
poolsRouter.post("/join", async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const invite = await prisma.poolInvite.findUnique({
    where: { code: parsed.data.code },
    include: { pool: true },
  });

  if (!invite) return res.status(404).json({ error: "NOT_FOUND", message: "Invite not found" });

  if (invite.expiresAtUtc && invite.expiresAtUtc.getTime() < Date.now()) {
    return res.status(409).json({ error: "CONFLICT", message: "Invite expired" });
  }

  if (invite.maxUses != null && invite.uses >= invite.maxUses) {
    return res.status(409).json({ error: "CONFLICT", message: "Invite maxUses reached" });
  }

  const joined = await prisma.$transaction(async (tx) => {
    // Comentario en español: si ya es miembro, no duplicamos
    const existing = await tx.poolMember.findFirst({
      where: { poolId: invite.poolId, userId: req.auth!.userId },
    });

    if (!existing) {
      await tx.poolMember.create({
        data: {
          poolId: invite.poolId,
          userId: req.auth!.userId,
          role: "PLAYER",
          status: "ACTIVE",
        },
      });
    } else if (existing.status !== "ACTIVE") {
      await tx.poolMember.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", leftAtUtc: null },
      });
    }

    await tx.poolInvite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } },
    });

    return { poolId: invite.poolId };
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "POOL_JOINED",
    entityType: "Pool",
    entityId: joined.poolId,
    dataJson: { code: parsed.data.code },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({ ok: true, poolId: joined.poolId });
});

// GET /pools/:poolId
// Comentario en español: detalle del pool + mi membership + counts (para pantalla pool)
poolsRouter.get("/:poolId", async (req, res) => {
  const { poolId } = req.params;

  // Comentario en español: hay que ser miembro ACTIVO para ver el pool
  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const membersActive = await prisma.poolMember.count({
    where: { poolId, status: "ACTIVE" },
  });

  return res.json({
    pool: {
      id: pool.id,
      name: pool.name,
      description: pool.description,
      visibility: pool.visibility,
      timeZone: pool.timeZone,
      deadlineMinutesBeforeKickoff: pool.deadlineMinutesBeforeKickoff,
      tournamentInstanceId: pool.tournamentInstanceId,
      createdByUserId: pool.createdByUserId,
      createdAtUtc: pool.createdAtUtc,
      updatedAtUtc: pool.updatedAtUtc,
    },
    myMembership: {
      role: myMembership.role,
      status: myMembership.status,
      joinedAtUtc: myMembership.joinedAtUtc,
    },
    counts: {
      membersActive,
    },
    tournamentInstance: pool.tournamentInstance
      ? {
          id: pool.tournamentInstance.id,
          name: pool.tournamentInstance.name,
          status: pool.tournamentInstance.status,
          templateId: pool.tournamentInstance.templateId,
          templateVersionId: pool.tournamentInstance.templateVersionId,
        }
      : null,
    permissions: {
      // Comentario en español: útil para habilitar/ocultar botones en UI
      canManageResults: myMembership.role === "HOST",
      canInvite: myMembership.role === "HOST",
    },
  });
});
