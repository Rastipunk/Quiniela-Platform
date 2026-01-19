import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { getScoringPreset } from "../lib/scoringPresets";
import { verifyUserPassword } from "../lib/passwordVerification";
import {
  advanceToRoundOf32,
  advanceKnockoutPhase,
  validateGroupStageComplete,
} from "../services/instanceAdvancement";
import {
  transitionToActive,
  transitionToArchived,
  canJoinPool,
  canMakePicks,
  canPublishResults,
  canCreateInvites
} from "../services/poolStateMachine";
import { PoolPickTypesConfigSchema } from "../validation/pickConfig";
import { validatePoolPickTypesConfig } from "../validation/pickConfig";
import { getPresetByKey } from "../lib/pickPresets";
import { scoreMatchPick } from "../lib/scoringAdvanced";
import { scoreUserStructuralPicks } from "../services/structuralScoring";
import {
  generateMatchPickBreakdown,
  generateGroupStandingsBreakdown,
  generateKnockoutWinnerBreakdown,
} from "../lib/scoringBreakdown";
import type { PhasePickConfig } from "../types/pickConfig";


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
  requireApproval: z.boolean().optional(),

  // Comentario en español: configuración avanzada de tipos de picks
  // Puede ser: preset key ("BASIC", "ADVANCED", "SIMPLE", "CUMULATIVE") o configuración custom
  pickTypesConfig: z.union([
    z.enum(["BASIC", "ADVANCED", "SIMPLE", "CUMULATIVE"]), // Preset key
    PoolPickTypesConfigSchema, // Configuración custom
  ]).optional(),
});

function makeInviteCode() {
  // Comentario en español: código corto, suficientemente único para MVP
  return crypto.randomBytes(6).toString("hex"); // 12 chars
}

// Comentario en español: valida que el usuario sea HOST o CO_ADMIN del pool
async function requirePoolHostOrCoAdmin(userId: string, poolId: string) {
  const m = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  return m?.role === "HOST" || m?.role === "CO_ADMIN";
}

// POST /pools  (crea pool y agrega al creador como HOST)
poolsRouter.post("/", async (req, res) => {
  const parsed = createPoolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const {
    tournamentInstanceId,
    name,
    description,
    timeZone,
    deadlineMinutesBeforeKickoff,
    scoringPresetKey,
    requireApproval,
    pickTypesConfig
  } = parsed.data;

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: tournamentInstanceId } });
  if (!instance) return res.status(404).json({ error: "NOT_FOUND", message: "TournamentInstance not found" });

  // Comentario en español: no permitimos pools sobre instancias archivadas
  if (instance.status === "ARCHIVED") {
    return res.status(409).json({ error: "CONFLICT", message: "Cannot create pool on ARCHIVED instance" });
  }

  // Comentario en español: procesar pickTypesConfig
  let finalPickTypesConfig: any = null;

  if (pickTypesConfig) {
    // Si es un string, es un preset key
    if (typeof pickTypesConfig === "string") {
      const preset = getPresetByKey(pickTypesConfig);
      if (!preset) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: `Invalid preset key: ${pickTypesConfig}`
        });
      }
      finalPickTypesConfig = preset.config;
    } else {
      // Es una configuración custom, validar
      const validation = validatePoolPickTypesConfig(pickTypesConfig);

      if (!validation.valid) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Invalid pick types configuration",
          errors: validation.errors,
        });
      }

      // Si hay warnings, incluirlos en la respuesta pero no bloquear
      if (validation.warnings.length > 0) {
        // Los warnings se retornan al frontend para que el usuario decida
        // Por ahora, los guardamos en audit log
        await writeAuditEvent({
          actorUserId: req.auth!.userId,
          action: "POOL_CONFIG_WARNINGS",
          entityType: "Pool",
          entityId: "pending",
          dataJson: { warnings: validation.warnings },
          ip: req.ip ?? null,
          userAgent: req.get("user-agent") ?? null,
        });
      }

      finalPickTypesConfig = pickTypesConfig;
    }
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
        requireApproval: requireApproval ?? false,
        pickTypesConfig: finalPickTypesConfig,
        // CRÍTICO: Copiar el fixture del torneo para que cada pool tenga su propia copia
        fixtureSnapshot: instance.dataJson as Prisma.InputJsonValue,
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
    dataJson: {
      tournamentInstanceId,
      hasPickTypesConfig: !!finalPickTypesConfig,
    },
    ip: req.ip ?? null,
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

  // 3) Snapshot - USAR pool.fixtureSnapshot (copia independiente) en lugar de tournamentInstance.dataJson
  const snapshot = pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson;
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

  const resultByMatchId = new Map<string, {
    homeGoals: number;
    awayGoals: number;
    homePenalties?: number | null;
    awayPenalties?: number | null;
    version: number;
    reason?: string | null;
  }>();
  for (const r of results) {
    if (r.currentVersion) {
      resultByMatchId.set(r.matchId, {
        homeGoals: r.currentVersion.homeGoals,
        awayGoals: r.currentVersion.awayGoals,
        homePenalties: r.currentVersion.homePenalties,
        awayPenalties: r.currentVersion.awayPenalties,
        version: r.currentVersion.versionNumber,
        reason: r.currentVersion.reason,
      });
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

  // ✅ Cargar picks y resultados estructurales (Sprint 2 - Preset SIMPLE)
  const allStructuralPicks = await prisma.structuralPrediction.findMany({
    where: { poolId },
  });

  const structuralPicksByUser = new Map<string, Array<{ phaseId: string; pickJson: any }>>();
  for (const sp of allStructuralPicks) {
    const userPicks = structuralPicksByUser.get(sp.userId) ?? [];
    userPicks.push({ phaseId: sp.phaseId, pickJson: sp.pickJson as any });
    structuralPicksByUser.set(sp.userId, userPicks);
  }

  // ✅ Cargar picks granulares de grupos (GroupStandingsPrediction)
  const allGroupStandingsPicks = await prisma.groupStandingsPrediction.findMany({
    where: { poolId },
  });

  // Agrupar por usuario y fase, convertir al formato esperado por scoreUserStructuralPicks
  for (const gsp of allGroupStandingsPicks) {
    const userPicks = structuralPicksByUser.get(gsp.userId) ?? [];

    // Buscar si ya existe un pick para esta fase
    let existingPhasePick = userPicks.find((p) => p.phaseId === gsp.phaseId);
    if (!existingPhasePick) {
      existingPhasePick = { phaseId: gsp.phaseId, pickJson: { groups: [] } };
      userPicks.push(existingPhasePick);
      structuralPicksByUser.set(gsp.userId, userPicks);
    }

    // Agregar el grupo al pick de la fase
    if (!existingPhasePick.pickJson.groups) {
      existingPhasePick.pickJson.groups = [];
    }
    existingPhasePick.pickJson.groups.push({
      groupId: gsp.groupId,
      teamIds: gsp.teamIds,
    });
  }

  const allStructuralResults = await prisma.structuralPhaseResult.findMany({
    where: { poolId },
  });

  const structuralResults = allStructuralResults.map((sr) => ({
    phaseId: sr.phaseId,
    resultJson: sr.resultJson as any,
  }));

  // ✅ Cargar resultados granulares de grupos (GroupStandingsResult)
  const allGroupStandingsResults = await prisma.groupStandingsResult.findMany({
    where: { poolId },
  });

  // Agrupar por fase y convertir al formato esperado por el scoring
  const groupResultsByPhase = new Map<string, any[]>();
  for (const gsr of allGroupStandingsResults) {
    const groups = groupResultsByPhase.get(gsr.phaseId) ?? [];
    groups.push({
      groupId: gsr.groupId,
      teamIds: gsr.teamIds,
    });
    groupResultsByPhase.set(gsr.phaseId, groups);
  }

  // Agregar resultados de grupos al array de structural results
  groupResultsByPhase.forEach((groups, phaseId) => {
    // Verificar si ya existe un resultado para esta fase
    const existing = structuralResults.find((sr) => sr.phaseId === phaseId);
    if (!existing) {
      structuralResults.push({
        phaseId,
        resultJson: { groups },
      });
    }
  });

  // ✅ Convertir PoolMatchResult de fases knockout a formato estructural con winnerId
  // Esto es necesario porque el scoring de KNOCKOUT_WINNER espera { matches: [{ matchId, winnerId }] }
  const knockoutPhases = ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "finals"];
  const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;

  if (pickTypesConfig) {
    for (const phaseId of knockoutPhases) {
      const phaseConfig = pickTypesConfig.find((p) => p.phaseId === phaseId);
      if (!phaseConfig?.structuralPicks || phaseConfig.structuralPicks.type !== "KNOCKOUT_WINNER") {
        continue;
      }

      // Verificar si ya existe un resultado estructural para esta fase
      const existingResult = structuralResults.find((sr) => sr.phaseId === phaseId);
      if (existingResult) continue;

      // Obtener partidos de esta fase
      const phaseMatches = matches.filter((m) => m.phaseId === phaseId);
      if (phaseMatches.length === 0) continue;

      // Convertir resultados de partidos a formato winnerId
      const knockoutMatches: Array<{ matchId: string; winnerId: string }> = [];

      for (const match of phaseMatches) {
        const result = resultByMatchId.get(match.id);
        if (!result) continue;

        // Determinar ganador basado en goles y penales
        let winnerId: string | null = null;

        if (result.homeGoals > result.awayGoals) {
          winnerId = match.homeTeamId;
        } else if (result.awayGoals > result.homeGoals) {
          winnerId = match.awayTeamId;
        } else {
          // Empate en tiempo regular - verificar penales
          const homePens = result.homePenalties ?? 0;
          const awayPens = result.awayPenalties ?? 0;
          if (homePens > 0 || awayPens > 0) {
            if (homePens > awayPens) {
              winnerId = match.homeTeamId;
            } else if (awayPens > homePens) {
              winnerId = match.awayTeamId;
            }
          }
        }

        if (winnerId) {
          knockoutMatches.push({ matchId: match.id, winnerId });
        }
      }

      if (knockoutMatches.length > 0) {
        structuralResults.push({
          phaseId,
          resultJson: { matches: knockoutMatches },
        });
      }
    }
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


  // Calcular lista única de fases ordenadas por el orden en que aparecen en matches
  const phaseOrder: string[] = [];
  for (const m of matches) {
    if (!phaseOrder.includes(m.phaseId)) {
      phaseOrder.push(m.phaseId);
    }
  }

  const leaderboardRows = members.map((m) => {
    let points = 0;
    let scoredMatches = 0;
    const pointsByPhase: Record<string, number> = {};

    // Inicializar todas las fases en 0
    for (const ph of phaseOrder) {
      pointsByPhase[ph] = 0;
    }

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

      // ✅ SCORING AVANZADO: Si el pool tiene pickTypesConfig, usar scoreMatchPick
      if (pool.pickTypesConfig && Array.isArray(pool.pickTypesConfig)) {
        const phaseConfigs = pool.pickTypesConfig as PhasePickConfig[];
        const phaseConfig = phaseConfigs.find((p) => p.phaseId === match.phaseId);

        if (phaseConfig && phaseConfig.requiresScore && phaseConfig.matchPicks) {
          // Validar que el pick tiene la estructura correcta para scoring avanzado
          if (pick.type === "SCORE" && typeof pick.homeGoals === "number" && typeof pick.awayGoals === "number") {
            try {
              const advancedResult = scoreMatchPick(
                { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
                { homeGoals: r.homeGoals, awayGoals: r.awayGoals },
                phaseConfig
              );

              points += advancedResult.totalPoints;
              pointsByPhase[match.phaseId] = (pointsByPhase[match.phaseId] ?? 0) + advancedResult.totalPoints;
              scoredMatches += 1;

              if (leaderboardVerbose) {
                breakdown.push({
                  matchId: match.id,
                  pick,
                  result: r,
                  points: { totalPoints: advancedResult.totalPoints },
                  evaluations: advancedResult.evaluations,
                  status: "SCORED_ADVANCED",
                });
              }
              continue;
            } catch (err) {
              // Si falla scoring avanzado, caer al legacy
              console.error(`Advanced scoring failed for match ${match.id}, falling back to legacy:`, err);
            }
          }
        }
      }

      // ✅ SCORING LEGACY: Si no hay pickTypesConfig o falló el avanzado
      const scored = scorePick(pick, r.homeGoals, r.awayGoals);
      points += scored.totalPoints;
      pointsByPhase[match.phaseId] = (pointsByPhase[match.phaseId] ?? 0) + scored.totalPoints;
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

    // ✅ AGREGAR PUNTOS ESTRUCTURALES (Sprint 2 - Preset SIMPLE)
    let structuralPoints = 0;

    if (pool.pickTypesConfig && Array.isArray(pool.pickTypesConfig) && structuralResults.length > 0) {
      const userStructuralPicks = structuralPicksByUser.get(m.userId) || [];

      if (userStructuralPicks.length > 0) {
        try {
          structuralPoints = scoreUserStructuralPicks(
            userStructuralPicks,
            structuralResults,
            pool.pickTypesConfig as any[]
          );
        } catch (err) {
          console.error(`Error calculating structural points for user ${m.userId}:`, err);
        }
      }
    }

    return {
      userId: m.userId,
      memberId: m.id,
      displayName: m.user.displayName,
      role: m.role,
      points: points + structuralPoints, // Total: match picks + structural picks
      matchPickPoints: points, // Desglose para debugging
      structuralPickPoints: structuralPoints,
      pointsByPhase, // Puntos desglosados por fase
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

  // 8) Respuesta final "1-call"
  return res.json({
    nowUtc: now.toISOString(),
    pool: {
      id: pool.id,
      name: pool.name,
      description: pool.description,
      visibility: pool.visibility,
      status: pool.status,
      timeZone: pool.timeZone,
      deadlineMinutesBeforeKickoff: pool.deadlineMinutesBeforeKickoff,
      tournamentInstanceId: pool.tournamentInstanceId,
      createdByUserId: pool.createdByUserId,
      createdAtUtc: pool.createdAtUtc,
      updatedAtUtc: pool.updatedAtUtc,
      scoringPresetKey: pool.scoringPresetKey ?? "CLASSIC",
      pickTypesConfig: pool.pickTypesConfig, // Configuración avanzada de tipos de picks
      autoAdvanceEnabled: pool.autoAdvanceEnabled,
      requireApproval: pool.requireApproval,
      lockedPhases: pool.lockedPhases as string[],
    },
    myMembership: {
      id: myMembership.id,
      userId: myMembership.userId,
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
      // Usar fixtureSnapshot si existe (tiene equipos resueltos para knockout)
      // Fallback a dataJson original si no hay snapshot
      dataJson: pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson,
    },
    permissions: {
      canManageResults: myMembership.role === "HOST" || myMembership.role === "CO_ADMIN",
      canInvite: myMembership.role === "HOST" || myMembership.role === "CO_ADMIN",
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
      phases: phaseOrder, // Lista ordenada de fases para mostrar columnas
      rows: leaderboardRows.map((r, idx) => ({
        rank: idx + 1,
        userId: r.userId,
        memberId: r.memberId,
        displayName: r.displayName,
        role: r.role,
        points: r.points,
        pointsByPhase: r.pointsByPhase, // Puntos por cada fase
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
      status: pool.status,
      timeZone: pool.timeZone,
      deadlineMinutesBeforeKickoff: pool.deadlineMinutesBeforeKickoff,
      tournamentInstanceId: pool.tournamentInstanceId,
      createdByUserId: pool.createdByUserId,
      createdAtUtc: pool.createdAtUtc,
      updatedAtUtc: pool.updatedAtUtc,
      scoringPresetKey: pool.scoringPresetKey,
      autoAdvanceEnabled: pool.autoAdvanceEnabled,
      requireApproval: pool.requireApproval,
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

// GET /pools/:poolId/pending-members  (solo HOST/CO_ADMIN)
poolsRouter.get("/:poolId/pending-members", async (req, res) => {
  const { poolId } = req.params;

  const isHostOrCoAdmin = await requirePoolHostOrCoAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const pendingMembers = await prisma.poolMember.findMany({
    where: {
      poolId,
      status: "PENDING_APPROVAL" as any // TypeScript no ha recargado tipos, pero Prisma sí lo soporta
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true
        }
      }
    },
    orderBy: { joinedAtUtc: "asc" },
  });

  return res.json({
    ok: true,
    pendingMembers: pendingMembers.map((m: any) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      displayName: m.user.displayName,
      email: m.user.email,
      requestedAt: m.joinedAtUtc,
    }))
  });
});

// POST /pools/:poolId/members/:memberId/approve  (solo HOST/CO_ADMIN)
poolsRouter.post("/:poolId/members/:memberId/approve", async (req, res) => {
  const { poolId, memberId } = req.params;

  const isHostOrCoAdmin = await requirePoolHostOrCoAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: true }
  });

  if (!member) return res.status(404).json({ error: "NOT_FOUND", message: "Member not found" });
  if (member.poolId !== poolId) return res.status(403).json({ error: "FORBIDDEN" });

  if (member.status !== ("PENDING_APPROVAL" as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Member is not pending approval"
    });
  }

  await prisma.poolMember.update({
    where: { id: memberId },
    data: {
      status: "ACTIVE" as any,
      approvedByUserId: req.auth!.userId,
      approvedAtUtc: new Date(),
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "JOIN_REQUEST_APPROVED",
    entityType: "Pool",
    entityId: poolId,
    dataJson: {
      approvedUserId: member.userId,
      approvedUsername: member.user.username,
      approvedDisplayName: member.user.displayName,
    },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  // Trigger transición DRAFT → ACTIVE si es el primer jugador activo
  await transitionToActive(poolId, member.userId);

  return res.json({
    ok: true,
    message: "Member approved successfully"
  });
});

// POST /pools/:poolId/members/:memberId/reject  (solo HOST/CO_ADMIN)
const rejectMemberSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

poolsRouter.post("/:poolId/members/:memberId/reject", async (req, res) => {
  const { poolId, memberId } = req.params;

  const isHostOrCoAdmin = await requirePoolHostOrCoAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = rejectMemberSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: true }
  });

  if (!member) return res.status(404).json({ error: "NOT_FOUND", message: "Member not found" });
  if (member.poolId !== poolId) return res.status(403).json({ error: "FORBIDDEN" });

  if (member.status !== ("PENDING_APPROVAL" as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Member is not pending approval"
    });
  }

  // Rechazar = eliminar el registro (el usuario puede intentar unirse de nuevo)
  await prisma.poolMember.delete({
    where: { id: memberId },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "JOIN_REQUEST_REJECTED",
    entityType: "Pool",
    entityId: poolId,
    dataJson: {
      rejectedUserId: member.userId,
      rejectedUsername: member.user.username,
      rejectedDisplayName: member.user.displayName,
      reason: parsed.data.reason ?? null,
    },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({
    ok: true,
    message: "Member rejected successfully"
  });
});

const kickMemberSchema = z.object({
  reason: z.string().optional(), // Razón opcional para KICK
});

// POST /pools/:poolId/members/:memberId/kick  (solo HOST/CO_ADMIN)
// Comentario: Expulsa al jugador (LEFT), puede volver a solicitar acceso
poolsRouter.post("/:poolId/members/:memberId/kick", async (req, res) => {
  const { poolId, memberId } = req.params;
  const actorUserId = req.auth!.userId;

  const isHostOrCoAdmin = await requirePoolHostOrCoAdmin(actorUserId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = kickMemberSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { reason } = parsed.data;

  // Verificar que el miembro existe y está activo
  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { username: true } } }
  });

  if (!member || member.poolId !== poolId) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Member not found" });
  }

  if (member.status !== "ACTIVE") {
    return res.status(400).json({
      error: "INVALID_STATUS",
      message: "Can only kick active members"
    });
  }

  // No permitir que el host se expulse a sí mismo
  if (member.userId === actorUserId) {
    return res.status(400).json({
      error: "CANNOT_KICK_SELF",
      message: "You cannot kick yourself"
    });
  }

  // No permitir expulsar al creador del pool
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { createdByUserId: true }
  });

  if (member.userId === pool?.createdByUserId) {
    return res.status(400).json({
      error: "CANNOT_KICK_HOST",
      message: "Cannot kick the pool creator"
    });
  }

  // Actualizar el miembro a LEFT
  await prisma.poolMember.update({
    where: { id: memberId },
    data: {
      status: "LEFT",
      leftAtUtc: new Date(),
    },
  });

  // Auditoría
  await writeAuditEvent({
    actorUserId,
    action: "MEMBER_KICKED",
    entityType: "PoolMember",
    entityId: memberId,
    poolId,
    dataJson: {
      kickedUserId: member.userId,
      kickedUsername: member.user.username,
      reason: reason || "No reason provided",
    },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({
    ok: true,
    message: "Member kicked successfully"
  });
});

const banMemberSchema = z.object({
  reason: z.string().min(1, "Reason is required"), // Razón OBLIGATORIA para BAN
  deletePicks: z.boolean().optional(), // Si true, elimina los picks del jugador
});

// POST /pools/:poolId/members/:memberId/ban  (solo HOST/CO_ADMIN)
// Comentario: Expulsa PERMANENTEMENTE (BANNED), NO puede volver, opcionalmente borra picks
poolsRouter.post("/:poolId/members/:memberId/ban", async (req, res) => {
  const { poolId, memberId } = req.params;
  const actorUserId = req.auth!.userId;

  const isHostOrCoAdmin = await requirePoolHostOrCoAdmin(actorUserId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = banMemberSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { reason, deletePicks } = parsed.data;

  // Verificar que el miembro existe y está activo
  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { username: true } } }
  });

  if (!member || member.poolId !== poolId) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Member not found" });
  }

  if (member.status !== "ACTIVE") {
    return res.status(400).json({
      error: "INVALID_STATUS",
      message: "Can only ban active members"
    });
  }

  // No permitir que el host se expulse a sí mismo
  if (member.userId === actorUserId) {
    return res.status(400).json({
      error: "CANNOT_BAN_SELF",
      message: "You cannot ban yourself"
    });
  }

  // No permitir expulsar al creador del pool
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { createdByUserId: true }
  });

  if (member.userId === pool?.createdByUserId) {
    return res.status(400).json({
      error: "CANNOT_BAN_HOST",
      message: "Cannot ban the pool creator"
    });
  }

  // Si deletePicks = true, eliminar los picks del usuario en este pool
  let picksDeleted = 0;
  if (deletePicks) {
    const deleteResult = await prisma.prediction.deleteMany({
      where: {
        poolId,
        userId: member.userId,
      },
    });
    picksDeleted = deleteResult.count;
  }

  // Actualizar el miembro a BANNED
  await prisma.poolMember.update({
    where: { id: memberId },
    data: {
      status: "BANNED",
      bannedAt: new Date(),
      bannedByUserId: actorUserId,
      banReason: reason,
      banExpiresAt: null, // Siempre permanente
    },
  });

  // Auditoría
  await writeAuditEvent({
    actorUserId,
    action: "MEMBER_BANNED",
    entityType: "PoolMember",
    entityId: memberId,
    poolId,
    dataJson: {
      bannedUserId: member.userId,
      bannedUsername: member.user.username,
      reason,
      deletePicks,
      picksDeleted,
    },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({
    ok: true,
    message: deletePicks
      ? `Member permanently banned and ${picksDeleted} picks deleted`
      : "Member permanently banned"
  });
});

const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(500).optional(),
  expiresAtUtc: z.string().datetime().optional(),
});

// POST /pools/:poolId/invites  (solo HOST)
poolsRouter.post("/:poolId/invites", async (req, res) => {
  const { poolId } = req.params;

  const isHostOrCoAdmin = await requirePoolHostOrCoAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = createInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });

  // Validar que el pool permita crear invites según su estado
  if (!canCreateInvites(pool.status as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Cannot create invites in this pool status"
    });
  }

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

  // Validar que el pool acepte nuevos miembros según su estado
  if (!canJoinPool(invite.pool.status as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Pool is not accepting new members"
    });
  }

  if (invite.expiresAtUtc && invite.expiresAtUtc.getTime() < Date.now()) {
    return res.status(409).json({ error: "CONFLICT", message: "Invite expired" });
  }

  if (invite.maxUses != null && invite.uses >= invite.maxUses) {
    return res.status(409).json({ error: "CONFLICT", message: "Invite maxUses reached" });
  }

  // Determinar el status inicial según si requireApproval está activado
  const initialStatus = invite.pool.requireApproval ? ("PENDING_APPROVAL" as const) : ("ACTIVE" as const);

  let joined;
  try {
    joined = await prisma.$transaction(async (tx) => {
      // Comentario en español: si ya es miembro, no duplicamos
      const existing = await tx.poolMember.findFirst({
        where: { poolId: invite.poolId, userId: req.auth!.userId },
      });

      // CRITICAL: Si el usuario está BANNED, rechazar el join inmediatamente
      if (existing && existing.status === "BANNED") {
        throw new Error("BANNED_FROM_POOL");
      }

    if (!existing) {
      await tx.poolMember.create({
        data: {
          poolId: invite.poolId,
          userId: req.auth!.userId,
          role: "PLAYER",
          status: initialStatus,
        },
      });
    } else if (existing.status === "LEFT") {
      // Si el usuario había dejado el pool, lo reactivamos
      await tx.poolMember.update({
        where: { id: existing.id },
        data: {
          status: initialStatus,
          leftAtUtc: null,
          rejectionReason: null,
          approvedByUserId: null,
          approvedAtUtc: null
        },
      });
    } else if (existing.status === "PENDING_APPROVAL") {
      // Ya tiene una solicitud pendiente
      return { poolId: invite.poolId, status: "PENDING_APPROVAL" };
    } else {
      // Ya es miembro activo o baneado
      return { poolId: invite.poolId, status: existing.status };
    }

    await tx.poolInvite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } },
    });

    return { poolId: invite.poolId, status: initialStatus };
  });
  } catch (err: any) {
    if (err.message === "BANNED_FROM_POOL") {
      return res.status(403).json({
        error: "BANNED_FROM_POOL",
        message: "Has sido expulsado permanentemente de este pool y no puedes volver a unirte."
      });
    }
    throw err; // Re-throw if it's another error
  }

  // Auditoría según el status inicial
  if (joined.status === "PENDING_APPROVAL") {
    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "JOIN_REQUEST_SUBMITTED",
      entityType: "Pool",
      entityId: joined.poolId,
      dataJson: { code: parsed.data.code },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });
  } else if (joined.status === "ACTIVE") {
    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "POOL_JOINED",
      entityType: "Pool",
      entityId: joined.poolId,
      dataJson: { code: parsed.data.code },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    // Trigger transición DRAFT → ACTIVE solo si el join fue directo
    await transitionToActive(joined.poolId, req.auth!.userId);
  }

  return res.json({
    ok: true,
    poolId: joined.poolId,
    status: joined.status,
    message: joined.status === "PENDING_APPROVAL"
      ? "Join request submitted. Awaiting approval from pool administrator."
      : "Successfully joined the pool."
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
      status: pool.status,
      timeZone: pool.timeZone,
      deadlineMinutesBeforeKickoff: pool.deadlineMinutesBeforeKickoff,
      tournamentInstanceId: pool.tournamentInstanceId,
      createdByUserId: pool.createdByUserId,
      createdAtUtc: pool.createdAtUtc,
      updatedAtUtc: pool.updatedAtUtc,
      scoringPresetKey: pool.scoringPresetKey,
      autoAdvanceEnabled: pool.autoAdvanceEnabled,
      requireApproval: pool.requireApproval,
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

// POST /pools/:poolId/advance-phase (solo HOST)
// Endpoint manual para que el Host pueda forzar el avance de fase
// cuando el auto-advance esté bloqueado (por erratas o configuración)
const advancePhaseSchema = z.object({
  currentPhaseId: z.string(),
  nextPhaseId: z.string().optional(),
});

poolsRouter.post("/:poolId/advance-phase", async (req, res) => {
  const { poolId } = req.params;

  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership || myMembership.role !== "HOST") {
    return res.status(403).json({ error: "FORBIDDEN", message: "Solo el HOST puede avanzar fases manualmente" });
  }

  const parsed = advancePhaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { currentPhaseId, nextPhaseId } = parsed.data;

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Pool no encontrada" });
  }

  try {
    let result: any;
    let actualNextPhaseId: string;

    if (currentPhaseId === "group_stage") {
      const validation = await validateGroupStageComplete(pool.tournamentInstance.id, poolId);
      if (!validation.isComplete) {
        return res.status(400).json({
          error: "PHASE_INCOMPLETE",
          message: `Fase de grupos incompleta. Faltan ${validation.missingMatches.length} partido(s)`,
          details: { missingMatches: validation.missingMatches },
        });
      }

      result = await advanceToRoundOf32(pool.tournamentInstance.id, poolId);
      actualNextPhaseId = "round_of_32";

      await writeAuditEvent({
        actorUserId: req.auth!.userId,
        action: "TOURNAMENT_MANUAL_ADVANCED_TO_R32",
        entityType: "TournamentInstance",
        entityId: pool.tournamentInstance.id,
        dataJson: {
          triggeredBy: "MANUAL_HOST_ACTION",
          poolId,
          winnersCount: result.winners.size,
          runnersUpCount: result.runnersUp.size,
          bestThirdsCount: result.bestThirds.length,
        },
        ip: req.ip,
        userAgent: req.get("user-agent") ?? null,
      });
    } else {
      const phaseOrder: Record<string, string> = {
        round_of_32: "round_of_16",
        round_of_16: "quarter_finals",
        quarter_finals: "semi_finals",
        semi_finals: "finals",
      };

      const derivedNextPhase = phaseOrder[currentPhaseId];
      actualNextPhaseId = nextPhaseId || derivedNextPhase || "";
      if (!actualNextPhaseId) {
        return res.status(400).json({
          error: "INVALID_PHASE",
          message: `No se puede determinar la siguiente fase después de ${currentPhaseId}`,
        });
      }

      result = await advanceKnockoutPhase(
        pool.tournamentInstance.id,
        currentPhaseId,
        actualNextPhaseId,
        poolId
      );

      await writeAuditEvent({
        actorUserId: req.auth!.userId,
        action: "TOURNAMENT_MANUAL_ADVANCED_KNOCKOUT",
        entityType: "TournamentInstance",
        entityId: pool.tournamentInstance.id,
        dataJson: {
          triggeredBy: "MANUAL_HOST_ACTION",
          poolId,
          from: currentPhaseId,
          to: actualNextPhaseId,
          resolvedMatchesCount: result.resolvedMatches.length,
        },
        ip: req.ip,
        userAgent: req.get("user-agent") ?? null,
      });
    }

    return res.json({
      success: true,
      message: `Avance manual exitoso: ${currentPhaseId} → ${actualNextPhaseId}`,
      data: {
        currentPhaseId,
        nextPhaseId: actualNextPhaseId,
        ...result,
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      error: "ADVANCEMENT_FAILED",
      message: error.message,
    });
  }
});

// PATCH /pools/:poolId/settings (solo HOST) - Update pool settings
const updatePoolSettingsSchema = z.object({
  autoAdvanceEnabled: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
});

poolsRouter.patch("/:poolId/settings", async (req, res) => {
  const { poolId } = req.params;
  const parsed = updatePoolSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership || myMembership.role !== "HOST") {
    return res.status(403).json({ error: "FORBIDDEN", message: "Solo el HOST puede modificar configuraciones de la pool" });
  }

  const { autoAdvanceEnabled, requireApproval } = parsed.data;

  // Update pool settings
  const updatedPool = await prisma.pool.update({
    where: { id: poolId },
    data: {
      ...(autoAdvanceEnabled !== undefined ? { autoAdvanceEnabled } : {}),
      ...(requireApproval !== undefined ? { requireApproval } : {}),
    },
  });

  await writeAuditEvent({
    action: "POOL_SETTINGS_UPDATED",
    actorUserId: req.auth!.userId,
    poolId,
    dataJson: { changes: parsed.data },
  });

  return res.json({
    success: true,
    pool: {
      id: updatedPool.id,
      autoAdvanceEnabled: updatedPool.autoAdvanceEnabled,
      requireApproval: updatedPool.requireApproval,
    },
  });
});

// POST /pools/:poolId/lock-phase (solo HOST) - Lock a phase to prevent auto-advance
const lockPhaseSchema = z.object({
  phaseId: z.string().min(1),
  locked: z.boolean(),
});

poolsRouter.post("/:poolId/lock-phase", async (req, res) => {
  const { poolId } = req.params;
  const parsed = lockPhaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership || myMembership.role !== "HOST") {
    return res.status(403).json({ error: "FORBIDDEN", message: "Solo el HOST puede bloquear/desbloquear fases" });
  }

  const { phaseId, locked } = parsed.data;

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { lockedPhases: true },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const currentLocked = (pool.lockedPhases as string[]) || [];

  let updatedLocked: string[];
  if (locked) {
    // Add to locked phases if not already there
    updatedLocked = currentLocked.includes(phaseId) ? currentLocked : [...currentLocked, phaseId];
  } else {
    // Remove from locked phases
    updatedLocked = currentLocked.filter((id) => id !== phaseId);
  }

  const updatedPool = await prisma.pool.update({
    where: { id: poolId },
    data: {
      lockedPhases: updatedLocked,
    },
  });

  await writeAuditEvent({
    action: locked ? "PHASE_LOCKED" : "PHASE_UNLOCKED",
    actorUserId: req.auth!.userId,
    poolId,
    dataJson: { phaseId },
  });

  return res.json({
    success: true,
    pool: {
      id: updatedPool.id,
      lockedPhases: updatedPool.lockedPhases,
    },
  });
});

// POST /pools/:poolId/archive (solo HOST)
// Comentario en español: Archivar pool (COMPLETED → ARCHIVED)
poolsRouter.post("/:poolId/archive", async (req, res) => {
  const { poolId } = req.params;

  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership || myMembership.role !== "HOST") {
    return res.status(403).json({ error: "FORBIDDEN", message: "Solo el HOST puede archivar el pool" });
  }

  try {
    await transitionToArchived(poolId, req.auth!.userId);
    return res.json({ success: true });
  } catch (e: any) {
    if (e.message === "Pool not found") {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    if (e.message === "Pool must be COMPLETED to archive") {
      return res.status(409).json({ error: "CONFLICT", message: e.message });
    }
    throw e;
  }
});

// POST /pools/:poolId/members/:memberId/promote (solo HOST)
// Comentario en español: Promover un PLAYER a CO_ADMIN
const promoteMemberSchema = z.object({
  memberId: z.string().uuid(),
});

poolsRouter.post("/:poolId/members/:memberId/promote", async (req, res) => {
  const { poolId, memberId } = req.params;

  // Verificar que el actor es HOST
  const actorMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!actorMembership || actorMembership.role !== "HOST") {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Solo el HOST puede promover miembros a Co-Admin"
    });
  }

  // Buscar el miembro a promover
  const targetMember = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: true, pool: true },
  });

  if (!targetMember || targetMember.poolId !== poolId) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Miembro no encontrado" });
  }

  if (targetMember.status !== "ACTIVE") {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Solo se pueden promover miembros activos"
    });
  }

  if (targetMember.role !== "PLAYER") {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Solo se pueden promover PLAYERs a Co-Admin"
    });
  }

  // Promover a CO_ADMIN
  const updated = await prisma.poolMember.update({
    where: { id: memberId },
    data: { role: "CO_ADMIN" },
    include: { user: true },
  });

  // Auditoría
  await writeAuditEvent({
    action: "MEMBER_PROMOTED_TO_CO_ADMIN",
    actorUserId: req.auth!.userId,
    poolId,
    entityType: "PoolMember",
    entityId: memberId,
    dataJson: {
      targetUserId: targetMember.userId,
      targetUserEmail: targetMember.user.email,
      fromRole: "PLAYER",
      toRole: "CO_ADMIN",
    },
  });

  return res.json({
    success: true,
    member: {
      id: updated.id,
      role: updated.role,
      user: {
        id: updated.user.id,
        email: updated.user.email,
        displayName: updated.user.displayName,
      },
    },
  });
});

// POST /pools/:poolId/members/:memberId/demote (solo HOST)
// Comentario en español: Degradar un CO_ADMIN a PLAYER
poolsRouter.post("/:poolId/members/:memberId/demote", async (req, res) => {
  const { poolId, memberId } = req.params;

  // Verificar que el actor es HOST
  const actorMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!actorMembership || actorMembership.role !== "HOST") {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Solo el HOST puede degradar Co-Admins"
    });
  }

  // Buscar el miembro a degradar
  const targetMember = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: true, pool: true },
  });

  if (!targetMember || targetMember.poolId !== poolId) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Miembro no encontrado" });
  }

  if (targetMember.status !== "ACTIVE") {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Solo se pueden degradar miembros activos"
    });
  }

  if (targetMember.role !== "CO_ADMIN") {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Solo se pueden degradar Co-Admins"
    });
  }

  // Degradar a PLAYER
  const updated = await prisma.poolMember.update({
    where: { id: memberId },
    data: { role: "PLAYER" },
    include: { user: true },
  });

  // Auditoría
  await writeAuditEvent({
    action: "MEMBER_DEMOTED_FROM_CO_ADMIN",
    actorUserId: req.auth!.userId,
    poolId,
    entityType: "PoolMember",
    entityId: memberId,
    dataJson: {
      targetUserId: targetMember.userId,
      targetUserEmail: targetMember.user.email,
      fromRole: "CO_ADMIN",
      toRole: "PLAYER",
    },
  });

  return res.json({
    success: true,
    member: {
      id: updated.id,
      role: updated.role,
      user: {
        id: updated.user.id,
        email: updated.user.email,
        displayName: updated.user.displayName,
      },
    },
  });
});

// ==================== SCORING BREAKDOWN ====================

/**
 * GET /pools/:poolId/breakdown/match/:matchId
 * Obtiene el desglose de puntuacion para un pick de partido especifico
 */
poolsRouter.get("/:poolId/breakdown/match/:matchId", async (req, res) => {
  const userId = (req as any).auth.userId;
  const { poolId, matchId } = req.params;

  try {
    // Obtener pool con datos necesarios
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        tournamentInstance: true,
        members: {
          where: { userId, status: "ACTIVE" },
        },
      },
    });

    if (!pool) {
      return res.status(404).json({ error: "Pool no encontrada" });
    }

    // Verificar que el usuario es miembro
    if (pool.members.length === 0) {
      return res.status(403).json({ error: "No eres miembro de esta pool" });
    }

    // Obtener datos del fixture
    const fixtureData = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as any;
    const matches = fixtureData?.matches || [];
    const match = matches.find((m: any) => m.id === matchId);

    if (!match) {
      return res.status(404).json({ error: "Partido no encontrado" });
    }

    // Obtener configuracion de la fase
    const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;
    if (!pickTypesConfig) {
      return res.status(400).json({ error: "Pool sin configuracion de picks" });
    }

    const phaseConfig = pickTypesConfig.find(p => p.phaseId === match.phaseId);
    if (!phaseConfig) {
      return res.status(400).json({ error: "Fase no configurada" });
    }

    // Verificar que la fase requiere score (match picks)
    if (!phaseConfig.requiresScore || !phaseConfig.matchPicks) {
      return res.status(400).json({
        error: "Esta fase no usa picks de marcador",
        suggestion: "Usa el endpoint de breakdown estructural",
      });
    }

    // Obtener pick del usuario (modelo Prediction)
    const userPick = await prisma.prediction.findUnique({
      where: {
        poolId_userId_matchId: {
          poolId,
          matchId,
          userId,
        },
      },
    });

    // Obtener resultado oficial (con la versión actual que tiene los goles)
    const result = await prisma.poolMatchResult.findUnique({
      where: {
        poolId_matchId: {
          poolId,
          matchId,
        },
      },
      include: {
        currentVersion: true,
      },
    });

    // Generar breakdown
    // pickJson tiene formato: { type: "SCORE", homeGoals: X, awayGoals: Y }
    const pickJson = userPick?.pickJson as { type?: string; homeGoals?: number; awayGoals?: number } | null;
    const pickData = pickJson && typeof pickJson.homeGoals === "number" && typeof pickJson.awayGoals === "number"
      ? { homeGoals: pickJson.homeGoals, awayGoals: pickJson.awayGoals }
      : null;

    const resultData = result?.currentVersion
      ? { homeGoals: result.currentVersion.homeGoals, awayGoals: result.currentVersion.awayGoals }
      : null;

    const breakdown = generateMatchPickBreakdown(pickData, resultData, phaseConfig, matchId);

    // Agregar informacion del partido
    const teams = fixtureData?.teams || [];
    const homeTeam = teams.find((t: any) => t.id === match.homeTeamId);
    const awayTeam = teams.find((t: any) => t.id === match.awayTeamId);

    return res.json({
      breakdown,
      match: {
        id: matchId,
        phaseId: match.phaseId,
        homeTeam: {
          id: match.homeTeamId,
          name: homeTeam?.name || match.homeTeamId,
        },
        awayTeam: {
          id: match.awayTeamId,
          name: awayTeam?.name || match.awayTeamId,
        },
        kickoffUtc: match.kickoffUtc,
      },
    });
  } catch (error) {
    console.error("Error generando breakdown de partido:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * GET /pools/:poolId/breakdown/phase/:phaseId
 * Obtiene el desglose de puntuacion para picks estructurales de una fase
 */
poolsRouter.get("/:poolId/breakdown/phase/:phaseId", async (req, res) => {
  const userId = (req as any).auth.userId;
  const { poolId, phaseId } = req.params;

  try {
    // Obtener pool con datos necesarios
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        tournamentInstance: true,
        members: {
          where: { userId, status: "ACTIVE" },
        },
      },
    });

    if (!pool) {
      return res.status(404).json({ error: "Pool no encontrada" });
    }

    // Verificar que el usuario es miembro
    if (pool.members.length === 0) {
      return res.status(403).json({ error: "No eres miembro de esta pool" });
    }

    // Obtener configuracion de la fase
    const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;
    if (!pickTypesConfig) {
      return res.status(400).json({ error: "Pool sin configuracion de picks" });
    }

    const phaseConfig = pickTypesConfig.find(p => p.phaseId === phaseId);
    if (!phaseConfig) {
      return res.status(400).json({ error: "Fase no configurada" });
    }

    // Verificar que la fase es estructural
    if (phaseConfig.requiresScore || !phaseConfig.structuralPicks) {
      return res.status(400).json({
        error: "Esta fase no usa picks estructurales",
        suggestion: "Usa el endpoint de breakdown de partido",
      });
    }

    // Obtener datos del fixture
    const fixtureData = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as any;
    const matches = fixtureData?.matches || [];
    const teams = fixtureData?.teams || [];
    const groups = fixtureData?.groups || [];

    // Crear mapa de equipos
    const teamsMap = new Map<string, { id: string; name: string }>();
    teams.forEach((t: any) => {
      teamsMap.set(t.id, { id: t.id, name: t.name || t.code || t.id });
    });

    // Obtener pick estructural del usuario
    const userPick = await prisma.structuralPrediction.findUnique({
      where: {
        poolId_userId_phaseId: {
          poolId,
          phaseId,
          userId,
        },
      },
    });

    // Obtener resultado estructural oficial (el más reciente)
    const result = await prisma.structuralPhaseResult.findFirst({
      where: { poolId, phaseId },
      orderBy: { createdAtUtc: "desc" },
    });

    const structuralType = phaseConfig.structuralPicks.type;

    if (structuralType === "GROUP_STANDINGS") {
      // Obtener info de grupos - primero intentar desde fixtureData.groups
      let groupsInfo: Array<{ id: string; name: string; teamCount: number }> = [];

      if (groups && groups.length > 0) {
        groupsInfo = groups.map((g: any) => ({
          id: g.id,
          name: g.name || `Grupo ${g.id}`,
          teamCount: g.teamIds?.length || 4,
        }));
      }

      // Si no hay grupos explícitos, extraerlos de los equipos por groupId
      if (groupsInfo.length === 0) {
        const groupsMap = new Map<string, Set<string>>();
        teams.forEach((t: any) => {
          if (t.groupId) {
            if (!groupsMap.has(t.groupId)) {
              groupsMap.set(t.groupId, new Set());
            }
            groupsMap.get(t.groupId)!.add(t.id);
          }
        });

        groupsMap.forEach((teamIds, groupId) => {
          groupsInfo.push({
            id: groupId,
            name: `Grupo ${groupId}`,
            teamCount: teamIds.size,
          });
        });

        // Ordenar alfabéticamente
        groupsInfo.sort((a, b) => a.id.localeCompare(b.id));
      }

      // Como último recurso, extraerlos de los partidos
      if (groupsInfo.length === 0) {
        const groupIds = new Set<string>();
        matches.filter((m: any) => m.groupId).forEach((m: any) => {
          groupIds.add(m.groupId);
        });
        groupIds.forEach(gId => {
          groupsInfo.push({ id: gId, name: `Grupo ${gId}`, teamCount: 4 });
        });
      }

      console.log(`[Breakdown] GROUP_STANDINGS - Found ${groupsInfo.length} groups`);
      console.log(`[Breakdown] User pick:`, userPick?.pickJson);
      console.log(`[Breakdown] Result:`, result?.resultJson);

      const breakdown = generateGroupStandingsBreakdown(
        userPick?.pickJson as any,
        result?.resultJson as any,
        phaseConfig,
        groupsInfo,
        teamsMap
      );

      return res.json({ breakdown });
    } else if (structuralType === "KNOCKOUT_WINNER") {
      // Obtener partidos de la fase
      const phaseMatches = matches
        .filter((m: any) => m.phaseId === phaseId)
        .map((m: any) => ({
          id: m.id,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
        }));

      // Para KNOCKOUT_WINNER, los resultados vienen de los partidos individuales (PoolMatchResult)
      // No del resultado estructural (StructuralPhaseResult)
      const matchResults = await prisma.poolMatchResult.findMany({
        where: {
          poolId,
          matchId: { in: phaseMatches.map((m: any) => m.id) },
        },
        include: { currentVersion: true },
      });

      // Construir el resultData a partir de los resultados de partidos
      // El ganador es quien tenga más goles (considerando penales si es empate)
      const knockoutResultData: { matches: Array<{ matchId: string; winnerId: string }> } = { matches: [] };

      for (const matchResult of matchResults) {
        if (matchResult.currentVersion) {
          const cv = matchResult.currentVersion;
          const matchInfo = phaseMatches.find((m: any) => m.id === matchResult.matchId);
          if (matchInfo) {
            let winnerId: string;
            if (cv.homeGoals > cv.awayGoals) {
              winnerId = matchInfo.homeTeamId;
            } else if (cv.awayGoals > cv.homeGoals) {
              winnerId = matchInfo.awayTeamId;
            } else {
              // Empate en 90min - ver penales
              if (cv.homePenalties !== null && cv.awayPenalties !== null) {
                winnerId = cv.homePenalties > cv.awayPenalties ? matchInfo.homeTeamId : matchInfo.awayTeamId;
              } else {
                // Sin penales registrados - no hay ganador definido
                continue;
              }
            }
            knockoutResultData.matches.push({ matchId: matchResult.matchId, winnerId });
          }
        }
      }

      console.log(`[Breakdown] KNOCKOUT_WINNER - Found ${phaseMatches.length} matches, ${knockoutResultData.matches.length} with results`);
      console.log(`[Breakdown] User pick:`, userPick?.pickJson);

      const breakdown = generateKnockoutWinnerBreakdown(
        userPick?.pickJson as any,
        knockoutResultData.matches.length > 0 ? knockoutResultData : null,
        phaseConfig,
        phaseMatches,
        teamsMap
      );

      return res.json({ breakdown });
    } else {
      return res.status(400).json({ error: `Tipo estructural no soportado: ${structuralType}` });
    }
  } catch (error) {
    console.error("Error generando breakdown estructural:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * GET /pools/:poolId/breakdown/group/:groupId
 * Obtiene el desglose de puntuacion para un grupo específico (GROUP_STANDINGS)
 */
poolsRouter.get("/:poolId/breakdown/group/:groupId", async (req, res) => {
  const userId = (req as any).auth.userId;
  const { poolId, groupId } = req.params;

  try {
    // Obtener pool con datos necesarios
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        tournamentInstance: true,
        members: {
          where: { userId, status: "ACTIVE" },
        },
      },
    });

    if (!pool) {
      return res.status(404).json({ error: "Pool no encontrada" });
    }

    // Verificar que el usuario es miembro
    if (pool.members.length === 0) {
      return res.status(403).json({ error: "No eres miembro de esta pool" });
    }

    // Buscar la fase de grupos en pickTypesConfig
    const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;
    if (!pickTypesConfig) {
      return res.status(400).json({ error: "Pool sin configuracion de picks" });
    }

    // Encontrar la fase que tiene GROUP_STANDINGS
    const phaseConfig = pickTypesConfig.find(
      p => !p.requiresScore && p.structuralPicks?.type === "GROUP_STANDINGS"
    );

    if (!phaseConfig) {
      return res.status(400).json({ error: "No hay fase de grupos configurada" });
    }

    const config = phaseConfig.structuralPicks!.config as {
      pointsPerExactPosition: number;
      bonusPerfectGroup?: number;
    };

    // Obtener datos del fixture
    const fixtureData = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as any;
    const teams = fixtureData?.teams || [];

    // Crear mapa de equipos
    const teamsMap = new Map<string, { id: string; name: string }>();
    teams.forEach((t: any) => {
      teamsMap.set(t.id, { id: t.id, name: t.name || t.code || t.id });
    });

    // Obtener equipos del grupo específico
    const groupTeams = teams.filter((t: any) => t.groupId === groupId);
    if (groupTeams.length === 0) {
      return res.status(404).json({ error: "Grupo no encontrado" });
    }

    // Obtener pick del usuario para este grupo específico
    const userPick = await prisma.groupStandingsPrediction.findUnique({
      where: {
        poolId_userId_phaseId_groupId: {
          poolId,
          userId,
          phaseId: phaseConfig.phaseId,
          groupId,
        },
      },
    });

    // Obtener resultado oficial para este grupo
    const result = await prisma.groupStandingsResult.findFirst({
      where: { poolId, phaseId: phaseConfig.phaseId, groupId },
      orderBy: { createdAtUtc: "desc" },
    });

    // Calcular máximo teórico para este grupo
    const teamCount = groupTeams.length;
    const maxPositionPoints = teamCount * config.pointsPerExactPosition;
    const maxBonusPoints = config.bonusPerfectGroup || 0;
    const totalMax = maxPositionPoints + maxBonusPoints;

    // Si no hay pick
    if (!userPick || !userPick.teamIds || userPick.teamIds.length === 0) {
      return res.json({
        breakdown: {
          type: "GROUP_SINGLE",
          groupId,
          groupName: `Grupo ${groupId}`,
          hasPick: false,
          hasResult: !!result,
          totalPointsEarned: 0,
          totalPointsMax: totalMax,
          config,
          positions: [],
          bonusPerfectGroup: {
            enabled: !!config.bonusPerfectGroup,
            achieved: false,
            pointsEarned: 0,
            pointsMax: maxBonusPoints,
          },
        },
      });
    }

    // Si no hay resultado
    if (!result || !result.teamIds || result.teamIds.length === 0) {
      return res.json({
        breakdown: {
          type: "GROUP_SINGLE",
          groupId,
          groupName: `Grupo ${groupId}`,
          hasPick: true,
          hasResult: false,
          totalPointsEarned: 0,
          totalPointsMax: totalMax,
          config,
          positions: [],
          bonusPerfectGroup: {
            enabled: !!config.bonusPerfectGroup,
            achieved: false,
            pointsEarned: 0,
            pointsMax: maxBonusPoints,
          },
        },
      });
    }

    // Evaluar posiciones
    const pickTeams = userPick.teamIds as string[];
    const resultTeams = result.teamIds as string[];

    let totalEarned = 0;
    let perfectGroup = true;

    const positions = resultTeams.map((teamId, index) => {
      const position = index + 1;
      const predictedIndex = pickTeams.indexOf(teamId);
      const predictedPosition = predictedIndex >= 0 ? predictedIndex + 1 : null;
      const matched = predictedPosition === position;

      if (!matched) perfectGroup = false;
      const pointsEarned = matched ? config.pointsPerExactPosition : 0;
      totalEarned += pointsEarned;

      const team = teamsMap.get(teamId);

      return {
        position,
        teamId,
        teamName: team?.name || teamId,
        predictedPosition,
        actualPosition: position,
        matched,
        pointsEarned,
      };
    });

    // Bonus por grupo perfecto
    const bonusAchieved = perfectGroup && config.bonusPerfectGroup;
    const bonusPoints = bonusAchieved ? config.bonusPerfectGroup! : 0;
    totalEarned += bonusPoints;

    return res.json({
      breakdown: {
        type: "GROUP_SINGLE",
        groupId,
        groupName: `Grupo ${groupId}`,
        hasPick: true,
        hasResult: true,
        totalPointsEarned: totalEarned,
        totalPointsMax: totalMax,
        config,
        positions,
        bonusPerfectGroup: {
          enabled: !!config.bonusPerfectGroup,
          achieved: !!bonusAchieved,
          pointsEarned: bonusPoints,
          pointsMax: maxBonusPoints,
        },
      },
    });
  } catch (error) {
    console.error("Error generando breakdown de grupo:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ============================================================================
// GET /pools/:poolId/players/:userId/summary
// Resumen detallado de un jugador: puntos por fase, picks, resultados, breakdown
// Si userId != usuario actual, solo muestra picks de partidos con deadline pasado
// ============================================================================
poolsRouter.get("/:poolId/players/:userId/summary", async (req, res) => {
  try {
    const { poolId, userId: targetUserId } = req.params;
    const requestingUserId = req.auth!.userId;
    const now = new Date();

    // 1) Verificar que el usuario solicitante es miembro activo del pool
    const myMembership = await prisma.poolMember.findFirst({
      where: { poolId, userId: requestingUserId, status: "ACTIVE" },
    });
    if (!myMembership) {
      return res.status(403).json({ error: "FORBIDDEN", message: "No eres miembro de esta pool" });
    }

    // 2) Verificar que el usuario objetivo es miembro activo del pool
    const targetMembership = await prisma.poolMember.findFirst({
      where: { poolId, userId: targetUserId, status: "ACTIVE" },
      include: { user: true },
    });
    if (!targetMembership) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Usuario no encontrado en esta pool" });
    }

    // 3) Cargar pool con instancia
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { tournamentInstance: true },
    });
    if (!pool || !pool.tournamentInstance) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Pool no encontrada" });
    }

    const isViewingSelf = targetUserId === requestingUserId;
    const deadlineMinutes = pool.deadlineMinutesBeforeKickoff;

    // 4) Extraer matches y teams del snapshot
    const dataJson = pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson;
    const matches = extractMatches(dataJson);
    const teams = extractTeams(dataJson);
    const teamById = new Map(teams.map((t) => [t.id, t]));

    // 5) Cargar picks del usuario objetivo
    const predictions = await prisma.prediction.findMany({
      where: { poolId, userId: targetUserId },
    });
    const pickByMatchId = new Map(predictions.map((p) => [p.matchId, p.pickJson as any]));

    // 6) Cargar resultados
    const resultsRaw = await prisma.poolMatchResult.findMany({
      where: { poolId },
      include: { currentVersion: true },
    });
    const resultByMatchId = new Map(
      resultsRaw
        .filter((r) => r.currentVersion)
        .map((r) => [
          r.matchId,
          {
            homeGoals: r.currentVersion!.homeGoals,
            awayGoals: r.currentVersion!.awayGoals,
          },
        ])
    );

    // 7) Obtener configuración de picks por fase
    const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;

    // 8) Agrupar matches por fase
    const phaseGroups = new Map<string, SnapshotMatch[]>();
    for (const match of matches) {
      const group = phaseGroups.get(match.phaseId) ?? [];
      group.push(match);
      phaseGroups.set(match.phaseId, group);
    }

    // 9) Calcular resumen por fase
    const phases: any[] = [];

    // Obtener orden de fases del dataJson
    const phasesFromData = (dataJson as any)?.phases ?? [];
    const phaseOrder = new Map<string, number>(
      phasesFromData.map((p: any, idx: number) => [p.id, idx])
    );

    for (const [phaseId, phaseMatches] of phaseGroups) {
      // Obtener config de fase
      const phaseConfig = pickTypesConfig?.find((p) => p.phaseId === phaseId);
      const phaseData = phasesFromData.find((p: any) => p.id === phaseId);
      const phaseName = phaseData?.name ?? phaseId;

      // Ordenar partidos por kickoff
      const sortedMatches = [...phaseMatches].sort(
        (a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime()
      );

      let phaseTotalPoints = 0;
      let phaseMaxPoints = 0;
      let matchCount = 0;
      let scoredCount = 0;

      const matchDetails: any[] = [];

      for (const match of sortedMatches) {
        const kickoff = new Date(match.kickoffUtc);
        const deadlineUtc = new Date(kickoff.getTime() - deadlineMinutes * 60 * 1000);
        const isLocked = now >= deadlineUtc;

        // Si es otro usuario, solo mostrar si deadline pasó
        if (!isViewingSelf && !isLocked) {
          continue;
        }

        const pick = pickByMatchId.get(match.id);
        const result = resultByMatchId.get(match.id);

        const homeTeam = teamById.get(match.homeTeamId);
        const awayTeam = teamById.get(match.awayTeamId);

        let pointsEarned = 0;
        let pointsMax = 0;
        let status: "SCORED" | "NO_PICK" | "PENDING_RESULT" | "LOCKED" = "LOCKED";
        let breakdown: any[] = [];

        matchCount += 1;

        if (result) {
          // Hay resultado oficial
          if (pick && pick.type === "SCORE" && phaseConfig?.requiresScore && phaseConfig.matchPicks) {
            // Scoring avanzado
            try {
              const scoring = scoreMatchPick(
                { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
                { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
                phaseConfig
              );
              pointsEarned = scoring.totalPoints;
              breakdown = scoring.evaluations.map((e: any) => ({
                type: e.matchPickType,
                matched: e.matched,
                points: e.points,
              }));
              status = "SCORED";
              scoredCount += 1;

              // Calcular máximo posible
              const maxType = phaseConfig.matchPicks.types.find((t) => t.enabled);
              pointsMax = maxType?.points ?? 0;
            } catch (err) {
              console.error(`Error scoring match ${match.id}:`, err);
            }
          } else if (pick) {
            // Scoring legacy
            const preset = getScoringPreset(pool.scoringPresetKey ?? "CLASSIC");
            const actualOutcome = outcomeFromScore(result.homeGoals, result.awayGoals);
            const pickOutcome = pick.type === "SCORE"
              ? outcomeFromScore(pick.homeGoals, pick.awayGoals)
              : pick.outcome;
            const outcomeCorrect = pickOutcome === actualOutcome;
            const exact = pick.type === "SCORE" &&
              pick.homeGoals === result.homeGoals &&
              pick.awayGoals === result.awayGoals;

            pointsEarned = (outcomeCorrect ? preset.outcomePoints : 0) +
              (exact && preset.allowScorePick ? preset.exactScoreBonus : 0);
            pointsMax = preset.outcomePoints + (preset.allowScorePick ? preset.exactScoreBonus : 0);
            status = "SCORED";
            scoredCount += 1;

            breakdown = [
              { type: "OUTCOME", matched: outcomeCorrect, points: outcomeCorrect ? preset.outcomePoints : 0 },
              ...(preset.allowScorePick ? [{ type: "EXACT_SCORE", matched: exact, points: exact ? preset.exactScoreBonus : 0 }] : []),
            ];
          } else {
            status = "NO_PICK";
          }
        } else if (!isLocked) {
          status = "LOCKED"; // Aún no ha pasado deadline
        } else {
          status = pick ? "PENDING_RESULT" : "NO_PICK";
        }

        phaseTotalPoints += pointsEarned;
        phaseMaxPoints += pointsMax;

        matchDetails.push({
          matchId: match.id,
          homeTeam: homeTeam ? { id: homeTeam.id, name: homeTeam.name ?? homeTeam.id, code: homeTeam.code } : null,
          awayTeam: awayTeam ? { id: awayTeam.id, name: awayTeam.name ?? awayTeam.id, code: awayTeam.code } : null,
          kickoffUtc: match.kickoffUtc,
          groupId: match.groupId ?? null,
          pick: pick ? { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals, type: pick.type } : null,
          result: result ?? null,
          pointsEarned,
          pointsMax,
          status,
          breakdown,
        });
      }

      // Solo agregar fase si tiene partidos visibles
      if (matchDetails.length > 0) {
        phases.push({
          phaseId,
          phaseName,
          phaseOrder: phaseOrder.get(phaseId) ?? 999,
          totalPoints: phaseTotalPoints,
          maxPossiblePoints: phaseMaxPoints,
          matchCount,
          scoredCount,
          matches: matchDetails,
        });
      }
    }

    // Ordenar fases por order
    phases.sort((a, b) => a.phaseOrder - b.phaseOrder);

    // 10) Calcular totales y rank
    const allMembers = await prisma.poolMember.findMany({
      where: { poolId, status: "ACTIVE" },
      include: { user: true },
    });

    // Calcular puntos de todos para determinar rank
    const memberPoints: Array<{ userId: string; points: number; joinedAt: Date }> = [];
    for (const member of allMembers) {
      let totalPoints = 0;

      const memberPicks = await prisma.prediction.findMany({
        where: { poolId, userId: member.userId },
      });
      const memberPickByMatch = new Map(memberPicks.map((p) => [p.matchId, p.pickJson as any]));

      for (const match of matches) {
        const pick = memberPickByMatch.get(match.id);
        const result = resultByMatchId.get(match.id);

        if (!pick || !result) continue;

        const phaseConfig = pickTypesConfig?.find((p) => p.phaseId === match.phaseId);

        if (pick.type === "SCORE" && phaseConfig?.requiresScore && phaseConfig.matchPicks) {
          try {
            const scoring = scoreMatchPick(
              { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
              { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
              phaseConfig
            );
            totalPoints += scoring.totalPoints;
          } catch {}
        } else {
          const preset = getScoringPreset(pool.scoringPresetKey ?? "CLASSIC");
          const actualOutcome = outcomeFromScore(result.homeGoals, result.awayGoals);
          const pickOutcome = pick.type === "SCORE"
            ? outcomeFromScore(pick.homeGoals, pick.awayGoals)
            : pick.outcome;
          const outcomeCorrect = pickOutcome === actualOutcome;
          const exact = pick.type === "SCORE" &&
            pick.homeGoals === result.homeGoals &&
            pick.awayGoals === result.awayGoals;

          totalPoints += (outcomeCorrect ? preset.outcomePoints : 0) +
            (exact && preset.allowScorePick ? preset.exactScoreBonus : 0);
        }
      }

      memberPoints.push({
        userId: member.userId,
        points: totalPoints,
        joinedAt: member.joinedAtUtc,
      });
    }

    // Ordenar para determinar rank
    memberPoints.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    const targetRank = memberPoints.findIndex((m) => m.userId === targetUserId) + 1;
    const targetPoints = memberPoints.find((m) => m.userId === targetUserId)?.points ?? 0;

    // 11) Respuesta
    return res.json({
      player: {
        userId: targetUserId,
        displayName: targetMembership.user.displayName,
        role: targetMembership.role,
        rank: targetRank,
        totalPoints: targetPoints,
        joinedAtUtc: targetMembership.joinedAtUtc,
      },
      isViewingSelf,
      phases,
      // TODO: Agregar structuralPicks si aplica
    });
  } catch (error) {
    console.error("Error en resumen de jugador:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ==================== NOTIFICACIONES INTERNAS ====================
// GET /pools/:poolId/notifications
// Retorna contadores de acciones pendientes para badges en UI
poolsRouter.get("/:poolId/notifications", async (req, res) => {
  const { poolId } = req.params;
  const userId = req.auth!.userId;

  try {
    // Verificar membresía activa
    const membership = await prisma.poolMember.findFirst({
      where: { poolId, userId, status: "ACTIVE" },
    });

    if (!membership) {
      return res.status(403).json({ error: "FORBIDDEN", message: "No eres miembro activo de esta pool" });
    }

    const isHostOrCoAdmin = membership.role === "HOST" || membership.role === "CO_ADMIN";

    // Obtener pool con fixture
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        tournamentInstance: true,
      },
    });

    if (!pool) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    // Obtener matches del snapshot
    const snapshotData = pool.fixtureSnapshot || pool.tournamentInstance.dataJson;
    const matches = extractMatches(snapshotData);
    const now = new Date();

    // Obtener picks del usuario actual
    const userPicks = await prisma.prediction.findMany({
      where: { poolId, userId },
      select: { matchId: true },
    });
    const pickedMatchIds = new Set(userPicks.map((p) => p.matchId));

    // Obtener resultados publicados
    const publishedResults = await prisma.poolMatchResult.findMany({
      where: { poolId },
      select: { matchId: true },
    });
    const resultsMap = new Set(publishedResults.map((r) => r.matchId));

    // Calcular deadline para cada partido
    const deadlineMinutes = pool.deadlineMinutesBeforeKickoff;

    // Helper: detectar si un teamId es placeholder (equipos aún no resueltos)
    const isPlaceholder = (teamId: string) => {
      return teamId.startsWith("W_") ||
             teamId.startsWith("RU_") ||
             teamId.startsWith("L_") ||
             teamId.startsWith("3rd_");
    };

    // === Cálculos para TODOS los usuarios ===

    // Picks pendientes URGENTES (deadline < 24h, sin pick, equipos definidos)
    const urgentDeadlines: Array<{
      matchId: string;
      phaseId: string;
      deadlineUtc: string;
      homeTeamId: string;
      awayTeamId: string;
      kickoffUtc: string;
    }> = [];

    for (const match of matches) {
      // Ignorar partidos con placeholders (equipos aún no resueltos)
      if (isPlaceholder(match.homeTeamId) || isPlaceholder(match.awayTeamId)) {
        continue;
      }

      const kickoff = new Date(match.kickoffUtc);
      const deadline = new Date(kickoff.getTime() - deadlineMinutes * 60 * 1000);

      // Solo contar partidos donde el deadline NO ha pasado Y es urgente (< 24h)
      if (deadline > now) {
        const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Solo notificar si deadline es en las próximas 24 horas
        if (hoursUntilDeadline < 24 && !pickedMatchIds.has(match.id)) {
          urgentDeadlines.push({
            matchId: match.id,
            phaseId: match.phaseId,
            deadlineUtc: deadline.toISOString(),
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            kickoffUtc: match.kickoffUtc,
          });
        }
      }
    }

    // Ordenar urgentes por deadline más cercano
    urgentDeadlines.sort((a, b) =>
      new Date(a.deadlineUtc).getTime() - new Date(b.deadlineUtc).getTime()
    );

    // pendingPicks ahora es solo el conteo de urgentes
    const pendingPicks = urgentDeadlines.length;

    // === Cálculos solo para HOST/CO_ADMIN ===

    let pendingJoins = 0;
    let pendingResults = 0;
    let phasesReadyToAdvance: string[] = [];

    if (isHostOrCoAdmin) {
      // Solicitudes de join pendientes
      const pendingMembers = await prisma.poolMember.count({
        where: { poolId, status: "PENDING_APPROVAL" as any },
      });
      pendingJoins = pendingMembers;

      // Partidos ya jugados sin resultado publicado
      for (const match of matches) {
        const kickoff = new Date(match.kickoffUtc);
        // Partido ya empezó y no tiene resultado
        if (kickoff < now && !resultsMap.has(match.id)) {
          pendingResults++;
        }
      }

      // Fases completas listas para avanzar
      // Agrupar partidos por fase
      const phaseMatches: Record<string, SnapshotMatch[]> = {};
      for (const match of matches) {
        if (!phaseMatches[match.phaseId]) {
          phaseMatches[match.phaseId] = [];
        }
        phaseMatches[match.phaseId]!.push(match);
      }

      // Mapa de siguiente fase para cada fase
      const nextPhaseMap: Record<string, string | null> = {
        group_stage: "round_of_32",
        round_of_32: "round_of_16",
        round_of_16: "quarter_finals",
        quarter_finals: "semi_finals",
        semi_finals: "finals",
        third_place: null, // No tiene siguiente
        finals: null, // Torneo terminado
      };

      // Helper para detectar si un teamId es placeholder
      const isPlaceholder = (teamId: string) => {
        return teamId.startsWith("W_") ||
               teamId.startsWith("RU_") ||
               teamId.startsWith("L_") ||
               teamId.startsWith("3rd_");
      };

      // Verificar cada fase
      const lockedPhases = Array.isArray(pool.lockedPhases) ? pool.lockedPhases as string[] : [];

      for (const [phaseId, phaseMatchList] of Object.entries(phaseMatches)) {
        // Saltar fases bloqueadas manualmente
        if (lockedPhases.includes(phaseId)) continue;

        // Una fase está "completa" si todos sus partidos tienen resultado
        const allHaveResults = phaseMatchList.every((m) => resultsMap.has(m.id));

        if (allHaveResults && phaseMatchList.length > 0) {
          const nextPhaseId = nextPhaseMap[phaseId];

          // Si no hay siguiente fase (final, third_place), no notificar
          if (!nextPhaseId) continue;

          // Verificar si la siguiente fase tiene placeholders (no ha avanzado)
          const nextPhaseMatches = phaseMatches[nextPhaseId] || [];

          if (nextPhaseMatches.length > 0) {
            // Si algún partido de la siguiente fase tiene placeholders, la fase actual necesita avanzar
            const hasPlaceholders = nextPhaseMatches.some(
              (m) => isPlaceholder(m.homeTeamId) || isPlaceholder(m.awayTeamId)
            );

            if (hasPlaceholders) {
              phasesReadyToAdvance.push(phaseId);
            }
            // Si no tiene placeholders, ya avanzó - no notificar
          }
        }
      }
    }

    // Respuesta
    return res.json({
      // Común a todos
      pendingPicks,
      urgentDeadlines: urgentDeadlines.slice(0, 5), // Máximo 5 urgentes

      // Solo para HOST/CO_ADMIN (0 para players)
      pendingJoins: isHostOrCoAdmin ? pendingJoins : 0,
      pendingResults: isHostOrCoAdmin ? pendingResults : 0,
      phasesReadyToAdvance: isHostOrCoAdmin ? phasesReadyToAdvance : [],

      // Metadatos
      isHostOrCoAdmin,
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Error obteniendo notificaciones:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});
