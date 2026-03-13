import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { sendResultPublishedEmail } from "../lib/email";
import { getScoringPreset } from "../lib/scoringPresets";
import {
  validateCanAutoAdvance,
  advanceToRoundOf32,
  advanceKnockoutPhase,
} from "../services/instanceAdvancement";
import { transitionToCompleted, canPublishResults } from "../services/poolStateMachine";
import { ResultSource, ResultSourceMode } from "@prisma/client";
import { requirePoolAdmin } from "../lib/roles";
import { extractMatches, extractTeams, parseFixtureData, type FixtureMatch, type FixtureTeam } from "../lib/fixture";

export const resultsRouter = Router();
resultsRouter.use(requireAuth);

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

async function requireActivePoolMember(userId: string, poolId: string) {
  const m = await prisma.poolMember.findFirst({ where: { poolId, userId, status: "ACTIVE" } });
  return m != null;
}

// PUT /pools/:poolId/results/:matchId  (HOST, CO_ADMIN, or CORPORATE_HOST)
resultsRouter.put("/:poolId/results/:matchId", async (req, res) => {
  const { poolId, matchId } = req.params;

  const isAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
  if (!isAdmin) return res.status(403).json({ error: "FORBIDDEN" });

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

  const { homeGoals, awayGoals, homeGoals90, awayGoals90, homePenalties, awayPenalties, reason } = parsed.data;

  // Determinar el modo de fuente de resultados de la instancia
  const instanceResultSourceMode = pool.tournamentInstance.resultSourceMode as ResultSourceMode;

  try {
    const saved = await prisma.$transaction(async (tx) => {
      // 1) header (poolId+matchId) — lock row to serialize concurrent publications
      let header = await tx.poolMatchResult.findUnique({ where: { poolId_matchId: { poolId, matchId } } });
      if (header) {
        await tx.$queryRaw`SELECT id FROM "PoolMatchResult" WHERE id = ${header.id} FOR UPDATE`;
      } else {
        header = await tx.poolMatchResult.create({ data: { poolId, matchId } });
      }

      // 2) siguiente versionNumber y última versión (safe after row lock)
      const last = await tx.poolMatchResultVersion.findFirst({
        where: { resultId: header.id },
        orderBy: { versionNumber: "desc" },
      });
      const nextVersion = (last?.versionNumber ?? 0) + 1;

      // 3) Determinar el source según el modo de la instancia y el estado actual
      let source: ResultSource;

      if (instanceResultSourceMode === "MANUAL") {
        // Instancia MANUAL: siempre HOST_MANUAL
        source = "HOST_MANUAL";
      } else {
        // Instancia AUTO: determinar si es PROVISIONAL u OVERRIDE
        if (!last) {
          // No hay resultado previo → HOST_PROVISIONAL (esperando API)
          source = "HOST_PROVISIONAL";
        } else if (last.source === "API_CONFIRMED") {
          // Ya hay resultado de API → HOST_OVERRIDE (corrigiendo API)
          source = "HOST_OVERRIDE";
        } else if (last.source === "HOST_PROVISIONAL") {
          // Actualizando provisional → sigue siendo PROVISIONAL
          source = "HOST_PROVISIONAL";
        } else if (last.source === "HOST_OVERRIDE") {
          // Ya había un override → nuevo override
          source = "HOST_OVERRIDE";
        } else {
          // Fallback
          source = "HOST_PROVISIONAL";
        }
      }

      // 4) Validar reason según las reglas
      // - Si ya existía cualquier versión (errata), exigimos reason
      // - Si es HOST_OVERRIDE, siempre requiere reason
      if (nextVersion > 1 && !reason) {
        throw new Error("REASON_REQUIRED_FOR_ERRATA");
      }
      if (source === "HOST_OVERRIDE" && !reason) {
        throw new Error("REASON_REQUIRED_FOR_OVERRIDE");
      }

      // 5) crear versión con source
      const version = await tx.poolMatchResultVersion.create({
        data: {
          resultId: header.id,
          versionNumber: nextVersion,
          status: "PUBLISHED",
          homeGoals,
          awayGoals,
          homeGoals90: homeGoals90 ?? null,
          awayGoals90: awayGoals90 ?? null,
          homePenalties: homePenalties ?? null,
          awayPenalties: awayPenalties ?? null,
          reason: reason ?? null,
          createdByUserId: req.auth!.userId,
          source,
        },
      });

      // 6) apuntar currentVersion
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

    // ========== SEND RESULT NOTIFICATION EMAILS ==========
    // Enviar notificaciones por email a los miembros del pool (async, no bloquea)
    (async () => {
      try {
        // Obtener equipos del partido
        const teams = extractTeams(pool.tournamentInstance.dataJson);
        const teamById = new Map(teams.map((t) => [t.id, t]));
        const homeTeam = teamById.get(match.homeTeamId);
        const awayTeam = teamById.get(match.awayTeamId);
        const allMatches = extractMatches(pool.tournamentInstance.dataJson);

        const matchDescription = `${homeTeam?.name ?? "Local"} vs ${awayTeam?.name ?? "Visitante"}`;
        const resultText = `${homeGoals} - ${awayGoals}`;

        // Obtener miembros activos del pool
        const members = await prisma.poolMember.findMany({
          where: { poolId, status: "ACTIVE" },
          include: { user: { select: { id: true, email: true, displayName: true } } },
          orderBy: { joinedAtUtc: "asc" }
        });

        // Obtener picks de este partido
        const matchPicks = await prisma.prediction.findMany({
          where: { poolId, matchId }
        });
        const pickByUserId = new Map(matchPicks.map(p => [p.userId, p]));

        // Obtener todos los resultados para calcular ranking
        const allResults = await prisma.poolMatchResult.findMany({
          where: { poolId },
          include: { currentVersion: true }
        });
        const resultByMatchId = new Map<string, { homeGoals: number; awayGoals: number }>();
        for (const r of allResults) {
          if (r.currentVersion) {
            resultByMatchId.set(r.matchId, {
              homeGoals: r.currentVersion.homeGoals,
              awayGoals: r.currentVersion.awayGoals
            });
          }
        }

        // Obtener todas las predicciones para calcular ranking
        const allPredictions = await prisma.prediction.findMany({
          where: { poolId, matchId: { in: allMatches.map(m => m.id) } }
        });

        // Calcular puntos por usuario usando el preset de la pool
        const preset = getScoringPreset(pool.scoringPresetKey);
        const userPoints = new Map<string, number>();
        for (const pred of allPredictions) {
          const result = resultByMatchId.get(pred.matchId);
          if (!result) continue;
          const pick = pred.pickJson as any;
          const actualOutcomeForPred = result.homeGoals > result.awayGoals ? "HOME" :
                        result.homeGoals < result.awayGoals ? "AWAY" : "DRAW";
          let pts = 0;
          if (pick?.type === "OUTCOME") {
            if (pick.outcome === actualOutcomeForPred) pts = preset.outcomePoints;
          } else if (pick?.type === "SCORE") {
            const predicted = pick.homeGoals > pick.awayGoals ? "HOME" :
                             pick.homeGoals < pick.awayGoals ? "AWAY" : "DRAW";
            if (predicted === actualOutcomeForPred) {
              pts = preset.outcomePoints;
              if (preset.allowScorePick && pick.homeGoals === result.homeGoals && pick.awayGoals === result.awayGoals) {
                pts += preset.exactScoreBonus;
              }
            }
          }
          userPoints.set(pred.userId, (userPoints.get(pred.userId) ?? 0) + pts);
        }

        // Ordenar para ranking
        const sortedMembers = members
          .map(m => ({ ...m, totalPoints: userPoints.get(m.userId) ?? 0 }))
          .sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            return new Date(a.joinedAtUtc).getTime() - new Date(b.joinedAtUtc).getTime();
          });

        // Calcular puntos ganados en este partido por usuario
        const actualOutcome = homeGoals > awayGoals ? "HOME" :
                             homeGoals < awayGoals ? "AWAY" : "DRAW";

        // Enviar emails
        const emailPromises = sortedMembers.map((member, idx) => {
          const pick = pickByUserId.get(member.userId);
          let pointsEarned = 0;
          if (pick) {
            const pickJson = pick.pickJson as any;
            if (pickJson?.type === "OUTCOME" && pickJson.outcome === actualOutcome) {
              pointsEarned = preset.outcomePoints;
            } else if (pickJson?.type === "SCORE") {
              const predicted = pickJson.homeGoals > pickJson.awayGoals ? "HOME" :
                               pickJson.homeGoals < pickJson.awayGoals ? "AWAY" : "DRAW";
              if (predicted === actualOutcome) {
                pointsEarned = preset.outcomePoints;
                if (preset.allowScorePick && pickJson.homeGoals === homeGoals && pickJson.awayGoals === awayGoals) {
                  pointsEarned += preset.exactScoreBonus;
                }
              }
            }
          }

          return sendResultPublishedEmail({
            to: member.user.email,
            userId: member.user.id,
            displayName: member.user.displayName,
            poolName: pool.name,
            poolId: poolId,
            matchDescription,
            result: resultText,
            pointsEarned,
            currentRank: idx + 1,
            totalParticipants: sortedMembers.length,
          }).catch((err) => {
            console.error(`Error sending result email to ${member.user.email}:`, err);
          });
        });

        await Promise.allSettled(emailPromises);
        // Email notifications sent successfully
      } catch (emailError) {
        console.error("Error sending result notification emails:", emailError);
      }
    })();

    // ========== AUTO-ADVANCE LOGIC ==========
    // Después de publicar un resultado, verificar si se completó alguna fase
    // y si es posible avanzar automáticamente a la siguiente

    try {
      const fixtureData = parseFixtureData(pool.tournamentInstance.dataJson);
      if (fixtureData.phases.length === 0 || fixtureData.matches.length === 0) {
        // No hay fases definidas, skip auto-advance
        return res.json(saved);
      }

      // Encontrar la fase del partido que acabamos de actualizar
      const updatedMatch = fixtureData.matches.find((m) => m.id === matchId);
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
    include: { user: { select: { id: true, email: true, username: true, displayName: true } } },
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
            roundLabel: match.roundLabel ?? null,
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
            roundLabel: match.roundLabel ?? null,
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
          roundLabel: match.roundLabel ?? null,
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


