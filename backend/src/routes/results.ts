import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import {
  validateCanAutoAdvance,
  advanceToRoundOf32,
  advanceKnockoutPhase,
} from "../services/instanceAdvancement";
import { transitionToCompleted, canPublishResults } from "../services/poolStateMachine";

export const resultsRouter = Router();
resultsRouter.use(requireAuth);

const upsertResultSchema = z.object({
  homeGoals: z.number().int().min(0).max(99),
  awayGoals: z.number().int().min(0).max(99),
  // Comentario en español: penalties opcionales (solo fases eliminatorias con empate)
  homePenalties: z.number().int().min(0).max(99).optional(),
  awayPenalties: z.number().int().min(0).max(99).optional(),
  // Comentario en español: requerido solo cuando ya existía un resultado (errata)
  reason: z.string().min(1).max(500).optional(),
});

type TemplateMatch = {
  id: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
};

function extractMatches(dataJson: unknown): TemplateMatch[] {
  if (!dataJson || typeof dataJson !== "object") return [];
  const dj = dataJson as any;
  if (!Array.isArray(dj.matches)) return [];
  return dj.matches as TemplateMatch[];
}

type TemplateTeam = { id: string; name?: string; code?: string };

function extractTeams(dataJson: unknown): TemplateTeam[] {
  if (!dataJson || typeof dataJson !== "object") return [];
  const dj = dataJson as any;
  if (!Array.isArray(dj.teams)) return [];
  return dj.teams as TemplateTeam[];
}


async function requireActivePoolMember(userId: string, poolId: string) {
  const m = await prisma.poolMember.findFirst({ where: { poolId, userId, status: "ACTIVE" } });
  return m != null;
}

// Comentario en español: valida que el usuario sea HOST o CO_ADMIN del pool
async function requirePoolHostOrCoAdmin(userId: string, poolId: string) {
  const m = await prisma.poolMember.findFirst({ where: { poolId, userId, status: "ACTIVE" } });
  return m?.role === "HOST" || m?.role === "CO_ADMIN";
}

function outcomeFromScore(homeGoals: number, awayGoals: number): "HOME" | "DRAW" | "AWAY" {
  if (homeGoals > awayGoals) return "HOME";
  if (homeGoals < awayGoals) return "AWAY";
  return "DRAW";
}

// PUT /pools/:poolId/results/:matchId  (HOST o CO_ADMIN)
resultsRouter.put("/:poolId/results/:matchId", async (req, res) => {
  const { poolId, matchId } = req.params;

  const isHostOrCoAdmin = await requirePoolHostOrCoAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = upsertResultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });

  // Validar que el pool permita publicar resultados según su estado
  if (!canPublishResults(pool.status as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Cannot publish results in this pool status"
    });
  }

  if (pool.tournamentInstance.status === "ARCHIVED") {
    return res.status(409).json({ error: "CONFLICT", message: "TournamentInstance is ARCHIVED" });
  }

  const matches = extractMatches(pool.tournamentInstance.dataJson);
  const match = matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: "NOT_FOUND", message: "Match not found in instance snapshot" });

  const { homeGoals, awayGoals, homePenalties, awayPenalties, reason } = parsed.data;

  try {
    const saved = await prisma.$transaction(async (tx) => {
      // 1) header (poolId+matchId)
      const header =
        (await tx.poolMatchResult.findUnique({ where: { poolId_matchId: { poolId, matchId } } })) ??
        (await tx.poolMatchResult.create({ data: { poolId, matchId } }));

      // 2) siguiente versionNumber
      const last = await tx.poolMatchResultVersion.findFirst({
        where: { resultId: header.id },
        orderBy: { versionNumber: "desc" },
      });
      const nextVersion = (last?.versionNumber ?? 0) + 1;

      // Comentario en español: si ya existía, exigimos reason (errata)
      if (nextVersion > 1 && !reason) {
        throw new Error("REASON_REQUIRED_FOR_ERRATA");
      }

      // 3) crear versión
      const version = await tx.poolMatchResultVersion.create({
        data: {
          resultId: header.id,
          versionNumber: nextVersion,
          status: "PUBLISHED",
          homeGoals,
          awayGoals,
          homePenalties: homePenalties ?? null,
          awayPenalties: awayPenalties ?? null,
          reason: reason ?? null,
          createdByUserId: req.auth!.userId,
        },
      });

      // 4) apuntar currentVersion
      const updatedHeader = await tx.poolMatchResult.update({
        where: { id: header.id },
        data: { currentVersionId: version.id },
        include: { currentVersion: true },
      });

      return updatedHeader;
    });

    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "RESULT_PUBLISHED",
      entityType: "PoolMatchResult",
      entityId: saved.id,
      dataJson: { poolId, matchId, currentVersionId: saved.currentVersionId },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    // ========== AUTO-ADVANCE LOGIC ==========
    // Después de publicar un resultado, verificar si se completó alguna fase
    // y si es posible avanzar automáticamente a la siguiente

    try {
      const dataJson = pool.tournamentInstance.dataJson as any;
      if (!dataJson?.phases || !dataJson?.matches) {
        // No hay fases definidas, skip auto-advance
        return res.json(saved);
      }

      // Encontrar la fase del partido que acabamos de actualizar
      const updatedMatch = dataJson.matches.find((m: any) => m.id === matchId);
      if (!updatedMatch) {
        return res.json(saved);
      }

      const phaseId = updatedMatch.phaseId;
      if (!phaseId) {
        return res.json(saved);
      }

      // Validar si podemos hacer auto-advance para esta fase
      const validation = await validateCanAutoAdvance(
        pool.tournamentInstance.id,
        phaseId,
        poolId
      );

      if (!validation.canAdvance) {
        // No se puede avanzar automáticamente
        console.log(`[AUTO-ADVANCE BLOCKED] Phase: ${phaseId}, Reason: ${validation.reason}`);
        return res.json(saved);
      }

      // ¡Fase completa y sin bloqueos! Proceder con auto-advance
      console.log(`[AUTO-ADVANCE] Phase ${phaseId} complete. Advancing...`);

      if (phaseId === "group_stage") {
        // Avanzar de Grupos a Round of 32
        const result = await advanceToRoundOf32(pool.tournamentInstance.id, poolId);

        await writeAuditEvent({
          actorUserId: req.auth!.userId,
          action: "TOURNAMENT_AUTO_ADVANCED_TO_R32",
          entityType: "TournamentInstance",
          entityId: pool.tournamentInstance.id,
          dataJson: {
            triggeredBy: "RESULT_PUBLISH",
            matchId,
            winnersCount: result.winners.size,
            runnersUpCount: result.runnersUp.size,
            bestThirdsCount: result.bestThirds.length,
          },
          ip: req.ip,
          userAgent: req.get("user-agent") ?? null,
        });

        console.log(`[AUTO-ADVANCE SUCCESS] Advanced to Round of 32`);
      } else if (phaseId.startsWith("round_of_") || phaseId.includes("finals") || phaseId === "quarter_finals" || phaseId === "semi_finals") {
        // Avanzar fases knockout
        const phaseOrder: Record<string, string | null> = {
          round_of_32: "round_of_16",
          round_of_16: "quarter_finals",
          quarter_finals: "semi_finals",
          semi_finals: "finals",
          finals: null, // Torneo terminado
        };

        const nextPhaseId = phaseOrder[phaseId];
        if (nextPhaseId) {
          const result = await advanceKnockoutPhase(
            pool.tournamentInstance.id,
            phaseId,
            nextPhaseId,
            poolId
          );

          await writeAuditEvent({
            actorUserId: req.auth!.userId,
            action: "TOURNAMENT_AUTO_ADVANCED_KNOCKOUT",
            entityType: "TournamentInstance",
            entityId: pool.tournamentInstance.id,
            dataJson: {
              triggeredBy: "RESULT_PUBLISH",
              matchId,
              from: phaseId,
              to: nextPhaseId,
              resolvedMatchesCount: result.resolvedMatches.length,
            },
            ip: req.ip,
            userAgent: req.get("user-agent") ?? null,
          });

          console.log(`[AUTO-ADVANCE SUCCESS] Advanced from ${phaseId} to ${nextPhaseId}`);
        } else {
          console.log(`[AUTO-ADVANCE] Tournament complete!`);
        }
      }
    } catch (autoAdvanceError: any) {
      // Si falla el auto-advance, loguear pero NO fallar la request original
      console.error("[AUTO-ADVANCE ERROR]", autoAdvanceError.message);
      // El resultado ya se guardó exitosamente, solo falló el avance automático
    }

    // Verificar si todos los partidos tienen resultado → Pool COMPLETED
    try {
      await transitionToCompleted(poolId, req.auth!.userId);
    } catch (completedError: any) {
      // Si falla la transición, loguear pero no fallar la request
      console.error("[POOL COMPLETED ERROR]", completedError.message);
    }

    return res.json(saved);
  } catch (e: any) {
    if (e?.message === "REASON_REQUIRED_FOR_ERRATA") {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "reason is required for errata (version > 1)" });
    }
    throw e;
  }
});

// GET /pools/:poolId/results  (miembros)
resultsRouter.get("/:poolId/leaderboard", async (req, res) => {
  const { poolId } = req.params;

  const verbose = req.query.verbose === "1" || req.query.verbose === "true";

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) return res.status(403).json({ error: "FORBIDDEN" });

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });

  const matches = extractMatches(pool.tournamentInstance.dataJson);
  const teams = extractTeams(pool.tournamentInstance.dataJson);

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const matchIds = matches.map((m) => m.id);

  const results = await prisma.poolMatchResult.findMany({
    where: { poolId },
    include: { currentVersion: true },
  });

  const resultByMatchId = new Map<string, { homeGoals: number; awayGoals: number }>();
  for (const r of results) {
    if (r.currentVersion) {
      resultByMatchId.set(r.matchId, {
        homeGoals: r.currentVersion.homeGoals,
        awayGoals: r.currentVersion.awayGoals,
      });
    }
  }

  const members = await prisma.poolMember.findMany({
    where: { poolId, status: "ACTIVE" },
    include: { user: true },
    orderBy: { joinedAtUtc: "asc" },
  });

  const predictions = await prisma.prediction.findMany({
    where: { poolId, matchId: { in: matchIds } },
  });

  const predsByUserMatch = new Map<string, Map<string, any>>();
  for (const p of predictions) {
    const byMatch = predsByUserMatch.get(p.userId) ?? new Map<string, any>();
    byMatch.set(p.matchId, p);
    predsByUserMatch.set(p.userId, byMatch);
  }

  function outcomeFromScoreLocal(homeGoals: number, awayGoals: number): "HOME" | "DRAW" | "AWAY" {
    if (homeGoals > awayGoals) return "HOME";
    if (homeGoals < awayGoals) return "AWAY";
    return "DRAW";
  }

  function scorePickDetailed(pick: any, actualHome: number, actualAway: number) {
    const actualOutcome = outcomeFromScoreLocal(actualHome, actualAway);

    // Comentario en español: MVP soporta OUTCOME y SCORE
    if (pick?.type === "OUTCOME") {
      const isCorrect = pick.outcome === actualOutcome;
      return {
        pickType: "OUTCOME",
        outcomePoints: isCorrect ? 3 : 0,
        exactScoreBonus: 0,
        totalPoints: isCorrect ? 3 : 0,
        details: { predictedOutcome: pick.outcome, actualOutcome, isCorrect },
      };
    }

    if (pick?.type === "SCORE") {
      const predictedOutcome = outcomeFromScoreLocal(pick.homeGoals, pick.awayGoals);
      const outcomeCorrect = predictedOutcome === actualOutcome;
      const outcomePoints = outcomeCorrect ? 3 : 0;

      const exact = pick.homeGoals === actualHome && pick.awayGoals === actualAway;
      const exactScoreBonus = exact && outcomeCorrect ? 2 : 0;

      return {
        pickType: "SCORE",
        outcomePoints,
        exactScoreBonus,
        totalPoints: outcomePoints + exactScoreBonus,
        details: {
          predictedScore: { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
          actualScore: { homeGoals: actualHome, awayGoals: actualAway },
          predictedOutcome,
          actualOutcome,
          outcomeCorrect,
          exact,
        },
      };
    }

    return {
      pickType: pick?.type ?? "UNKNOWN",
      outcomePoints: 0,
      exactScoreBonus: 0,
      totalPoints: 0,
      details: { message: "Pick type not supported in MVP scoring" },
    };
  }

  const rows = members.map((m) => {
    let points = 0;
    let scoredMatches = 0;

    const byMatch = predsByUserMatch.get(m.userId) ?? new Map<string, any>();
    const breakdown: any[] = [];

    for (const match of matches) {
      const pred = byMatch.get(match.id);
      const result = resultByMatchId.get(match.id);

      const homeTeam = teamById.get(match.homeTeamId);
      const awayTeam = teamById.get(match.awayTeamId);

      if (!result) {
        if (verbose) {
          breakdown.push({
            matchId: match.id,
            kickoffUtc: match.kickoffUtc,
            roundLabel: (match as any).roundLabel ?? null,
            homeTeam: { id: match.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
            awayTeam: { id: match.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
            pick: pred?.pickJson ?? null,
            result: null,
            points: { outcomePoints: 0, exactScoreBonus: 0, totalPoints: 0 },
            status: pred ? "PICKED_NO_RESULT" : "NO_PICK_NO_RESULT",
          });
        }
        continue;
      }

      // si hay resultado, el match cuenta como “scorable” para el usuario si tiene pick
      if (!pred) {
        if (verbose) {
          breakdown.push({
            matchId: match.id,
            kickoffUtc: match.kickoffUtc,
            roundLabel: (match as any).roundLabel ?? null,
            homeTeam: { id: match.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
            awayTeam: { id: match.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
            pick: null,
            result: { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
            points: { outcomePoints: 0, exactScoreBonus: 0, totalPoints: 0 },
            status: "NO_PICK",
          });
        }
        continue;
      }

      const scored = scorePickDetailed(pred.pickJson, result.homeGoals, result.awayGoals);
      points += scored.totalPoints;
      scoredMatches += 1;

      if (verbose) {
        breakdown.push({
          matchId: match.id,
          kickoffUtc: match.kickoffUtc,
          roundLabel: (match as any).roundLabel ?? null,
          homeTeam: { id: match.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
          awayTeam: { id: match.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
          pick: pred.pickJson,
          result: { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
          points: {
            outcomePoints: scored.outcomePoints,
            exactScoreBonus: scored.exactScoreBonus,
            totalPoints: scored.totalPoints,
          },
          status: "SCORED",
          details: scored.details,
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
      breakdown: verbose ? breakdown : undefined,
    };
  });

  // Comentario en español: puntos desc; si empatan, el que llegó primero (joinedAt asc) va arriba
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;

    const aTime = a.joinedAtUtc instanceof Date ? a.joinedAtUtc.getTime() : new Date(a.joinedAtUtc).getTime();
    const bTime = b.joinedAtUtc instanceof Date ? b.joinedAtUtc.getTime() : new Date(b.joinedAtUtc).getTime();
    return aTime - bTime;
  });

  return res.json({
    pool: { id: pool.id, name: pool.name },
    scoring: { outcomePoints: 3, exactScoreBonus: 2 },
    updatedAtUtc: new Date().toISOString(),
    verbose,
    leaderboard: rows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId,
      displayName: r.displayName,
      role: r.role,
      points: r.points,
      scoredMatches: r.scoredMatches,
      joinedAtUtc: r.joinedAtUtc,
      ...(verbose ? { breakdown: r.breakdown } : {}),
    })),
  });
});


// GET /pools/:poolId/leaderboard  (miembros)
// Scoring fijo MVP:
// - OUTCOME correcto: +3
// - SCORE exacto: +2 extra (total 5)
// - tiebreaker MVP: puntos desc, joinedAt asc
resultsRouter.get("/:poolId/leaderboard", async (req, res) => {
  const { poolId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) return res.status(403).json({ error: "FORBIDDEN" });

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });

  const matches = extractMatches(pool.tournamentInstance.dataJson);
  const matchIds = matches.map((m) => m.id);

  const results = await prisma.poolMatchResult.findMany({
    where: { poolId },
    include: { currentVersion: true },
  });

  const resultByMatchId = new Map<string, { homeGoals: number; awayGoals: number }>();
  for (const r of results) {
    if (r.currentVersion) {
      resultByMatchId.set(r.matchId, { homeGoals: r.currentVersion.homeGoals, awayGoals: r.currentVersion.awayGoals });
    }
  }

  const members = await prisma.poolMember.findMany({
    where: { poolId, status: "ACTIVE" },
    include: { user: true },
    orderBy: { joinedAtUtc: "asc" },
  });

  const predictions = await prisma.prediction.findMany({
    where: { poolId, matchId: { in: matchIds } },
  });

  const predsByUser = new Map<string, typeof predictions>();
  for (const p of predictions) {
    const arr = predsByUser.get(p.userId) ?? [];
    arr.push(p);
    predsByUser.set(p.userId, arr);
  }

  function scorePick(pick: any, homeGoals: number, awayGoals: number): number {
    const actualOutcome = outcomeFromScore(homeGoals, awayGoals);

    if (pick?.type === "OUTCOME") {
      return pick.outcome === actualOutcome ? 3 : 0;
    }

    if (pick?.type === "SCORE") {
      const predOutcome = outcomeFromScore(pick.homeGoals, pick.awayGoals);
      const outcomePts = predOutcome === actualOutcome ? 3 : 0;
      const exact = pick.homeGoals === homeGoals && pick.awayGoals === awayGoals;
      return outcomePts + (exact && outcomePts > 0 ? 2 : 0);
    }

    // WINNER lo dejamos para luego; MVP usa OUTCOME/SCORE
    return 0;
  }

  const rows = members.map((m) => {
    let points = 0;
    let scoredMatches = 0;

    const userPreds = predsByUser.get(m.userId) ?? [];
    for (const pred of userPreds) {
      const r = resultByMatchId.get(pred.matchId);
      if (!r) continue;
      points += scorePick(pred.pickJson as any, r.homeGoals, r.awayGoals);
      scoredMatches += 1;
    }

    return {
      userId: m.userId,
      displayName: m.user.displayName,
      role: m.role,
      points,
      scoredMatches,
      joinedAtUtc: m.joinedAtUtc,
    };
  });

    rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;

    const aTime = a.joinedAtUtc instanceof Date ? a.joinedAtUtc.getTime() : new Date(a.joinedAtUtc).getTime();
    const bTime = b.joinedAtUtc instanceof Date ? b.joinedAtUtc.getTime() : new Date(b.joinedAtUtc).getTime();

    return aTime - bTime; // Comentario en español: el que llegó primero queda arriba si empatan en puntos
    });


  return res.json({
    pool: { id: pool.id, name: pool.name },
    scoring: { outcomePoints: 3, exactScoreBonus: 2 },
    updatedAtUtc: new Date().toISOString(),
    leaderboard: rows.map((r, idx) => ({ rank: idx + 1, ...r })),
  });
});
