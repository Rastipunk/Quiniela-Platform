import { Router } from "express";
import { prisma } from "../db";
import { getScoringPreset } from "../lib/scoringPresets";
import { isPoolAdmin } from "../lib/roles";
import { extractMatches, extractTeams, extractPhases } from "../lib/fixture";
import { scoreMatchPick } from "../lib/scoringAdvanced";
import { scoreUserStructuralPicks } from "../services/structuralScoring";
import { outcomeFromScore } from "../lib/poolHelpers";
import type { PhasePickConfig } from "../types/pickConfig";

export const poolOverviewRouter = Router();

// GET /pools/:poolId/overview
// Comentario en español: respuesta "1-call" para la pantalla del pool (header + matches + picks + results + leaderboard)
poolOverviewRouter.get("/:poolId/overview", async (req, res) => {
  const { poolId } = req.params;

  const leaderboardVerbose = req.query.leaderboardVerbose === "1" || req.query.leaderboardVerbose === "true";

  // 1) Permiso: debe ser miembro ACTIVO o LEFT (LEFT = read-only)
  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: { in: ["ACTIVE", "LEFT"] } },
  });
  if (!myMembership) return res.status(403).json({ error: "FORBIDDEN" });

  // 2) Pool + instancia
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      tournamentInstance: { include: { template: { select: { key: true } } } },
      organization: { select: { id: true, name: true, logoBase64: true, welcomeMessage: true } },
    },
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

  // 4+5) Mis picks, resultados y overrides en paralelo (queries independientes)
  const [myPredictions, results, matchOverrides] = await Promise.all([
    prisma.prediction.findMany({
      where: { poolId, userId: req.auth!.userId, matchId: { in: matchIds } },
    }),
    prisma.poolMatchResult.findMany({
      where: { poolId, matchId: { in: matchIds } },
      include: { currentVersion: true },
    }),
    prisma.poolMatchOverride.findMany({
      where: { poolId },
    }),
  ]);
  const overrideByMatchId = new Map(matchOverrides.map((o) => [o.matchId, o]));
  const myPickByMatchId = new Map(myPredictions.map((p) => [p.matchId, p.pickJson as any]));

  const resultByMatchId = new Map<string, {
    homeGoals: number;
    awayGoals: number;
    homeGoals90?: number | null;
    awayGoals90?: number | null;
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
        homeGoals90: r.currentVersion.homeGoals90,
        awayGoals90: r.currentVersion.awayGoals90,
        homePenalties: r.currentVersion.homePenalties,
        awayPenalties: r.currentVersion.awayPenalties,
        version: r.currentVersion.versionNumber,
        reason: r.currentVersion.reason,
      });
    }
  }

  // 6) Matches "listos para UI": deadline + lock + team info + mi pick + resultado
  const matchCards = matches.map((m) => {
    const kickoff = new Date(m.kickoffUtc);
    const deadlineUtc = new Date(kickoff.getTime() - pool.deadlineMinutesBeforeKickoff * 60_000);
    const isLocked = now.getTime() >= deadlineUtc.getTime();

    const homeTeam = teamById.get(m.homeTeamId);
    const awayTeam = teamById.get(m.awayTeamId);

    const myPick = myPickByMatchId.get(m.id) ?? null;
    const result = resultByMatchId.get(m.id) ?? null;
    const override = overrideByMatchId.get(m.id);

    return {
      id: m.id,
      phaseId: m.phaseId,
      kickoffUtc: m.kickoffUtc,
      deadlineUtc: deadlineUtc.toISOString(),
      isLocked,
      matchNumber: m.matchNumber ?? null,
      roundLabel: m.roundLabel ?? null,
      label: m.label ?? null,
      venue: m.venue ?? null,
      groupId: m.groupId ?? null,
      homeTeam: { id: m.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
      awayTeam: { id: m.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
      myPick,
      result,
      scoringEnabled: override ? override.scoringEnabled : true,
      scoringOverrideReason: override?.reason ?? null,
    };
  });

  // 7) Leaderboard — members + allPredictions en paralelo
  const [members, allPredictions] = await Promise.all([
    prisma.poolMember.findMany({
      where: { poolId, status: { in: ["ACTIVE", "LEFT"] } },
      include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
      orderBy: { joinedAtUtc: "asc" },
    }),
    prisma.prediction.findMany({
      where: { poolId, matchId: { in: matchIds } },
    }),
  ]);

  const predsByUserMatch = new Map<string, Map<string, any>>();
  for (const p of allPredictions) {
    const byMatch = predsByUserMatch.get(p.userId) ?? new Map<string, any>();
    byMatch.set(p.matchId, p.pickJson as any);
    predsByUserMatch.set(p.userId, byMatch);
  }

  // ✅ Cargar picks y resultados estructurales en paralelo
  const [allStructuralPicks, allGroupStandingsPicks, allStructuralResults, allGroupStandingsResults] = await Promise.all([
    prisma.structuralPrediction.findMany({ where: { poolId } }),
    prisma.groupStandingsPrediction.findMany({ where: { poolId } }),
    prisma.structuralPhaseResult.findMany({ where: { poolId } }),
    prisma.groupStandingsResult.findMany({ where: { poolId } }),
  ]);

  const structuralPicksByUser = new Map<string, Array<{ phaseId: string; pickJson: any }>>();
  for (const sp of allStructuralPicks) {
    const userPicks = structuralPicksByUser.get(sp.userId) ?? [];
    userPicks.push({ phaseId: sp.phaseId, pickJson: sp.pickJson as any });
    structuralPicksByUser.set(sp.userId, userPicks);
  }

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

  const structuralResults = allStructuralResults.map((sr) => ({
    phaseId: sr.phaseId,
    resultJson: sr.resultJson as any,
  }));

  // Agrupar resultados de grupos por fase
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

      // Check if scoring is disabled for this match
      const matchOverride = overrideByMatchId.get(match.id);
      if (matchOverride && !matchOverride.scoringEnabled) {
        if (leaderboardVerbose) {
          breakdown.push({ matchId: match.id, status: "SCORING_DISABLED", reason: matchOverride.reason });
        }
        continue;
      }

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
              // Choose score based on includeExtraTime config
              const resultForScoring = {
                homeGoals: phaseConfig.includeExtraTime
                  ? r.homeGoals
                  : (r.homeGoals90 ?? r.homeGoals),
                awayGoals: phaseConfig.includeExtraTime
                  ? r.awayGoals
                  : (r.awayGoals90 ?? r.awayGoals),
              };
              const advancedResult = scoreMatchPick(
                { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
                resultForScoring,
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
      // Apply includeExtraTime logic even for legacy scoring
      const phaseConfigs2 = pool.pickTypesConfig as PhasePickConfig[] | null;
      const phaseConfig2 = phaseConfigs2?.find((p) => p.phaseId === match.phaseId);
      const legacyHome = phaseConfig2?.includeExtraTime ? r.homeGoals : (r.homeGoals90 ?? r.homeGoals);
      const legacyAway = phaseConfig2?.includeExtraTime ? r.awayGoals : (r.awayGoals90 ?? r.awayGoals);
      const scored = scorePick(pick, legacyHome, legacyAway);
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
      memberStatus: m.status,
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
      maxParticipants: pool.maxParticipants,
      lockedPhases: pool.lockedPhases as string[],
      organizationId: pool.organizationId ?? null,
      organization: pool.organization
        ? {
            id: pool.organization.id,
            name: pool.organization.name,
            logoBase64: pool.organization.logoBase64 ?? null,
            welcomeMessage: pool.organization.welcomeMessage ?? null,
          }
        : null,
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
      templateKey: pool.tournamentInstance.template?.key ?? null,
      // Usar fixtureSnapshot si existe (tiene equipos resueltos para knockout)
      // Fallback a dataJson original si no hay snapshot
      dataJson: pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson,
    },
    permissions: {
      canManageResults: isPoolAdmin(myMembership.role),
      canInvite: isPoolAdmin(myMembership.role),
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
        memberStatus: r.memberStatus,
        points: r.points,
        pointsByPhase: r.pointsByPhase, // Puntos por cada fase
        scoredMatches: r.scoredMatches,
        joinedAtUtc: r.joinedAtUtc,
        ...(leaderboardVerbose ? { breakdown: r.breakdown } : {}),
      })),
    },
  });
});
