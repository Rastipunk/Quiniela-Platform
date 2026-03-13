import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { getScoringPreset } from "../lib/scoringPresets";
import { requirePoolAdmin, isPoolOwner, isPoolAdmin } from "../lib/roles";
import {
  advanceToRoundOf32,
  advanceKnockoutPhase,
  validateGroupStageComplete,
} from "../services/instanceAdvancement";
import { transitionToArchived } from "../services/poolStateMachine";
import { scoreMatchPick } from "../lib/scoringAdvanced";
import {
  generateMatchPickBreakdown,
  generateGroupStandingsBreakdown,
  generateKnockoutWinnerBreakdown,
} from "../lib/scoringBreakdown";
import { outcomeFromScore } from "../lib/poolHelpers";
import { extractMatches, extractTeams, extractPhases, parseFixtureData, type FixtureMatch } from "../lib/fixture";
import type { PhasePickConfig } from "../types/pickConfig";

export const poolAdminRouter = Router();

// PUT /pools/:poolId/matches/:matchId/scoring-override — Host toggles scoring for a match
const scoringOverrideSchema = z.object({
  scoringEnabled: z.boolean(),
  reason: z.string().max(500).optional(),
});

poolAdminRouter.put("/:poolId/matches/:matchId/scoring-override", async (req, res) => {
  const { poolId, matchId } = req.params;
  const userId = req.auth!.userId;

  const isHostOrCoAdmin = await requirePoolAdmin(userId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = scoringOverrideSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { scoringEnabled, reason } = parsed.data;

  if (scoringEnabled) {
    // Re-enable scoring: delete the override record
    await prisma.poolMatchOverride.deleteMany({ where: { poolId, matchId } });
  } else {
    // Disable scoring: upsert the override record
    await prisma.poolMatchOverride.upsert({
      where: { poolId_matchId: { poolId, matchId } },
      create: { poolId, matchId, scoringEnabled: false, reason: reason || null, setByUserId: userId },
      update: { scoringEnabled: false, reason: reason || null, setByUserId: userId, setAtUtc: new Date() },
    });
  }

  await writeAuditEvent({
    actorUserId: userId,
    action: scoringEnabled ? "MATCH_SCORING_ENABLED" : "MATCH_SCORING_DISABLED",
    entityType: "PoolMatchOverride",
    entityId: `${poolId}:${matchId}`,
    poolId,
    dataJson: { matchId, scoringEnabled, reason },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({ ok: true, scoringEnabled, matchId });
});

// POST /pools/:poolId/advance-phase (solo HOST)
// Endpoint manual para que el Host pueda forzar el avance de fase
// cuando el auto-advance esté bloqueado (por erratas o configuración)
const advancePhaseSchema = z.object({
  currentPhaseId: z.string(),
  nextPhaseId: z.string().optional(),
});

poolAdminRouter.post("/:poolId/advance-phase", async (req, res) => {
  const { poolId } = req.params;

  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership || !isPoolOwner(myMembership.role)) {
    return res.status(403).json({ error: "FORBIDDEN", reason: "OWNER_ONLY" });
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
    return res.status(404).json({ error: "NOT_FOUND" });
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
      // Derive next phase dynamically from tournament data phase order
      let derivedNextPhase: string | undefined;
      const instancePhases = extractPhases(pool.tournamentInstance!.dataJson);
      if (instancePhases.length > 0) {
        const sorted = [...instancePhases].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((p) => p.id === currentPhaseId);
        if (idx >= 0 && idx < sorted.length - 1) {
          derivedNextPhase = sorted[idx + 1]?.id;
        }
      }

      // Fallback to hardcoded WC-style map if dynamic derivation fails
      if (!derivedNextPhase) {
        const phaseOrderFallback: Record<string, string> = {
          round_of_32: "round_of_16",
          round_of_16: "quarter_finals",
          quarter_finals: "semi_finals",
          semi_finals: "finals",
        };
        derivedNextPhase = phaseOrderFallback[currentPhaseId];
      }

      actualNextPhaseId = nextPhaseId || derivedNextPhase || "";
      if (!actualNextPhaseId) {
        return res.status(400).json({
          error: "INVALID_PHASE",
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
  extraTimePhases: z.array(z.string()).optional(), // Phase IDs where includeExtraTime = true
});

poolAdminRouter.patch("/:poolId/settings", async (req, res) => {
  const { poolId } = req.params;
  const parsed = updatePoolSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership || !isPoolOwner(myMembership.role)) {
    return res.status(403).json({ error: "FORBIDDEN", reason: "OWNER_ONLY" });
  }

  const { autoAdvanceEnabled, requireApproval, extraTimePhases } = parsed.data;

  // Handle extraTimePhases: update pickTypesConfig JSON
  let pickTypesConfigUpdate: PhasePickConfig[] | undefined;
  if (extraTimePhases !== undefined) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: {
        pickTypesConfig: true,
        deadlineMinutesBeforeKickoff: true,
        tournamentInstance: { select: { dataJson: true } },
      },
    });
    if (!pool) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const phaseConfigs = pool.pickTypesConfig as PhasePickConfig[] | null;
    if (!phaseConfigs) {
      return res.status(400).json({ error: "NO_CONFIG", message: "Pool has no pick types config" });
    }

    // Get matches from tournament data for deadline validation
    const fixtureData = parseFixtureData(pool.tournamentInstance?.dataJson);
    const allMatches = fixtureData.matches;

    // Get existing results to check for lock conditions
    const resultsRaw = await prisma.poolMatchResult.findMany({
      where: { poolId },
      include: { currentVersion: true },
    });
    const resultsByPhase = new Map<string, any[]>();
    for (const r of resultsRaw) {
      if (r.currentVersion) {
        // Find which phase this match belongs to
        const match = allMatches.find((m) => m.id === r.matchId);
        if (match) {
          const phaseId = match.phaseId;
          if (phaseId) {
            const arr = resultsByPhase.get(phaseId) ?? [];
            arr.push(r.currentVersion);
            resultsByPhase.set(phaseId, arr);
          }
        }
      }
    }

    const now = Date.now();
    pickTypesConfigUpdate = phaseConfigs.map((pc) => {
      const wantET = extraTimePhases.includes(pc.phaseId);
      const currentET = pc.includeExtraTime ?? false;

      // If no change needed, keep as is
      if (wantET === currentET) return pc;

      // Check lock conditions
      const phaseResults = resultsByPhase.get(pc.phaseId) ?? [];

      // 1. Old results without homeGoals90 → locked to ET
      const hasOldResults = phaseResults.some(
        (r: any) => r.homeGoals90 === null && r.homeGoals !== null
      );
      if (hasOldResults) {
        return pc; // Can't change — silently keep current
      }

      // 2. Phase completed (all matches have results)
      const phaseMatches = allMatches.filter((m) => m.phaseId === pc.phaseId);
      const allHaveResults = phaseMatches.length > 0 &&
        phaseMatches.every((m) => resultsRaw.some((r) => r.matchId === m.id && r.currentVersion));
      if (allHaveResults) {
        return pc; // Can't change — phase completed
      }

      // 3. First deadline < 48h
      const deadlineMinutes = pool.deadlineMinutesBeforeKickoff;
      const phaseKickoffs = phaseMatches
        .filter((m: any) => m.kickoffUtc)
        .map((m: any) => new Date(m.kickoffUtc).getTime() - deadlineMinutes * 60_000);
      const firstDeadline = phaseKickoffs.length > 0 ? Math.min(...phaseKickoffs) : Infinity;
      const hoursUntil = (firstDeadline - now) / (1000 * 60 * 60);
      if (hoursUntil < 48) {
        return pc; // Can't change — within 48h of first deadline
      }

      return { ...pc, includeExtraTime: wantET };
    });
  }

  // Update pool settings
  const updatedPool = await prisma.pool.update({
    where: { id: poolId },
    data: {
      ...(autoAdvanceEnabled !== undefined ? { autoAdvanceEnabled } : {}),
      ...(requireApproval !== undefined ? { requireApproval } : {}),
      ...(pickTypesConfigUpdate ? { pickTypesConfig: pickTypesConfigUpdate as any } : {}),
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
      pickTypesConfig: updatedPool.pickTypesConfig,
    },
  });
});

// POST /pools/:poolId/lock-phase (solo HOST) - Lock a phase to prevent auto-advance
const lockPhaseSchema = z.object({
  phaseId: z.string().min(1),
  locked: z.boolean(),
});

poolAdminRouter.post("/:poolId/lock-phase", async (req, res) => {
  const { poolId } = req.params;
  const parsed = lockPhaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership || !isPoolOwner(myMembership.role)) {
    return res.status(403).json({ error: "FORBIDDEN", reason: "OWNER_ONLY" });
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
poolAdminRouter.post("/:poolId/archive", async (req, res) => {
  const { poolId } = req.params;

  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership || !isPoolOwner(myMembership.role)) {
    return res.status(403).json({ error: "FORBIDDEN", reason: "OWNER_ONLY" });
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

// ==================== SCORING BREAKDOWN ====================

/**
 * GET /pools/:poolId/breakdown/match/:matchId
 * Obtiene el desglose de puntuacion para un pick de partido especifico
 */
poolAdminRouter.get("/:poolId/breakdown/match/:matchId", async (req, res) => {
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
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    // Verificar que el usuario es miembro
    if (pool.members.length === 0) {
      return res.status(403).json({ error: "FORBIDDEN", reason: "NOT_A_MEMBER" });
    }

    // Obtener datos del fixture
    const fixtureData = parseFixtureData(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
    const match = fixtureData.matches.find((m) => m.id === matchId);

    if (!match) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    // Obtener configuracion de la fase
    const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;
    if (!pickTypesConfig) {
      return res.status(400).json({ error: "NO_PICK_CONFIG" });
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
poolAdminRouter.get("/:poolId/breakdown/phase/:phaseId", async (req, res) => {
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
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    // Verificar que el usuario es miembro
    if (pool.members.length === 0) {
      return res.status(403).json({ error: "FORBIDDEN", reason: "NOT_A_MEMBER" });
    }

    // Obtener configuracion de la fase
    const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;
    if (!pickTypesConfig) {
      return res.status(400).json({ error: "NO_PICK_CONFIG" });
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
    const fixtureData = parseFixtureData(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
    const matches = fixtureData.matches;
    const teams = fixtureData.teams;
    const groups = (fixtureData as any).groups || [];

    // Crear mapa de equipos
    const teamsMap = new Map<string, { id: string; name: string }>();
    teams.forEach((t) => {
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
poolAdminRouter.get("/:poolId/breakdown/group/:groupId", async (req, res) => {
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
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    // Verificar que el usuario es miembro
    if (pool.members.length === 0) {
      return res.status(403).json({ error: "FORBIDDEN", reason: "NOT_A_MEMBER" });
    }

    // Buscar la fase de grupos en pickTypesConfig
    const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;
    if (!pickTypesConfig) {
      return res.status(400).json({ error: "NO_PICK_CONFIG" });
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
    const fixtureData = parseFixtureData(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
    const teams = fixtureData.teams;

    // Crear mapa de equipos
    const teamsMap = new Map<string, { id: string; name: string }>();
    teams.forEach((t) => {
      teamsMap.set(t.id, { id: t.id, name: t.name || t.code || t.id });
    });

    // Obtener equipos del grupo específico
    const groupTeams = teams.filter((t) => t.groupId === groupId);
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
poolAdminRouter.get("/:poolId/players/:userId/summary", async (req, res) => {
  try {
    const { poolId, userId: targetUserId } = req.params;
    const requestingUserId = req.auth!.userId;
    const now = new Date();

    // 1) Verificar que el usuario solicitante es miembro activo del pool
    const myMembership = await prisma.poolMember.findFirst({
      where: { poolId, userId: requestingUserId, status: "ACTIVE" },
    });
    if (!myMembership) {
      return res.status(403).json({ error: "FORBIDDEN", reason: "NOT_A_MEMBER" });
    }

    // 2) Verificar que el usuario objetivo es miembro activo del pool
    const targetMembership = await prisma.poolMember.findFirst({
      where: { poolId, userId: targetUserId, status: "ACTIVE" },
      include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
    });
    if (!targetMembership) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    // 3) Cargar pool con instancia
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { tournamentInstance: true },
    });
    if (!pool || !pool.tournamentInstance) {
      return res.status(404).json({ error: "NOT_FOUND" });
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

    // 6) Cargar resultados y overrides
    const [resultsRaw, playerSummaryOverrides] = await Promise.all([
      prisma.poolMatchResult.findMany({
        where: { poolId },
        include: { currentVersion: true },
      }),
      prisma.poolMatchOverride.findMany({ where: { poolId } }),
    ]);
    const playerSummaryOverrideMap = new Map(playerSummaryOverrides.map((o) => [o.matchId, o]));
    const resultByMatchId = new Map(
      resultsRaw
        .filter((r) => r.currentVersion)
        .map((r) => [
          r.matchId,
          {
            homeGoals: r.currentVersion!.homeGoals,
            awayGoals: r.currentVersion!.awayGoals,
            homeGoals90: r.currentVersion!.homeGoals90,
            awayGoals90: r.currentVersion!.awayGoals90,
          },
        ])
    );

    // 7) Obtener configuración de picks por fase
    const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;

    // 8) Agrupar matches por fase
    const phaseGroups = new Map<string, FixtureMatch[]>();
    for (const match of matches) {
      const group = phaseGroups.get(match.phaseId) ?? [];
      group.push(match);
      phaseGroups.set(match.phaseId, group);
    }

    // 9) Calcular resumen por fase
    const phases: any[] = [];

    // Obtener orden de fases del dataJson
    const phasesFromData = extractPhases(dataJson);
    const phaseOrder = new Map<string, number>(
      phasesFromData.map((p, idx) => [p.id, idx])
    );

    for (const [phaseId, phaseMatches] of phaseGroups) {
      // Obtener config de fase
      const phaseConfig = pickTypesConfig?.find((p) => p.phaseId === phaseId);
      const phaseData = phasesFromData.find((p) => p.id === phaseId);
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

        // Check scoring override
        const pOverride = playerSummaryOverrideMap.get(match.id);
        if (pOverride && !pOverride.scoringEnabled) {
          matchDetails.push({
            matchId: match.id,
            homeTeam: { id: match.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
            awayTeam: { id: match.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
            kickoffUtc: match.kickoffUtc,
            status: "SCORING_DISABLED",
            scoringOverrideReason: pOverride.reason ?? null,
          });
          continue;
        }

        let pointsEarned = 0;
        let pointsMax = 0;
        let status: "SCORED" | "NO_PICK" | "PENDING_RESULT" | "LOCKED" = "LOCKED";
        let breakdown: any[] = [];

        matchCount += 1;

        if (result) {
          // Hay resultado oficial
          if (pick && pick.type === "SCORE" && phaseConfig?.requiresScore && phaseConfig.matchPicks) {
            // Scoring avanzado — choose score based on includeExtraTime
            try {
              const resultForScoring = {
                homeGoals: phaseConfig.includeExtraTime
                  ? result.homeGoals
                  : (result.homeGoals90 ?? result.homeGoals),
                awayGoals: phaseConfig.includeExtraTime
                  ? result.awayGoals
                  : (result.awayGoals90 ?? result.awayGoals),
              };
              const scoring = scoreMatchPick(
                { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
                resultForScoring,
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
              const allEnabled = phaseConfig.matchPicks.types.filter((t) => t.enabled);
              const isCumulative = allEnabled.some((t) => t.key === "HOME_GOALS" || t.key === "AWAY_GOALS");
              if (isCumulative) {
                pointsMax = allEnabled.reduce((sum, t) => sum + t.points, 0);
              } else {
                pointsMax = Math.max(...allEnabled.map((t) => t.points), 0);
              }
            } catch (err) {
              console.error(`Error scoring match ${match.id}:`, err);
            }
          } else if (pick) {
            // Scoring legacy — use correct score based on includeExtraTime
            const preset = getScoringPreset(pool.scoringPresetKey ?? "CLASSIC");
            const legacyResult = {
              homeGoals: phaseConfig?.includeExtraTime
                ? result.homeGoals
                : (result.homeGoals90 ?? result.homeGoals),
              awayGoals: phaseConfig?.includeExtraTime
                ? result.awayGoals
                : (result.awayGoals90 ?? result.awayGoals),
            };
            const actualOutcome = outcomeFromScore(legacyResult.homeGoals, legacyResult.awayGoals);
            const pickOutcome = pick.type === "SCORE"
              ? outcomeFromScore(pick.homeGoals, pick.awayGoals)
              : pick.outcome;
            const outcomeCorrect = pickOutcome === actualOutcome;
            const exact = pick.type === "SCORE" &&
              pick.homeGoals === legacyResult.homeGoals &&
              pick.awayGoals === legacyResult.awayGoals;

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
      include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
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
            const resultForScoring = {
              homeGoals: phaseConfig.includeExtraTime
                ? result.homeGoals
                : (result.homeGoals90 ?? result.homeGoals),
              awayGoals: phaseConfig.includeExtraTime
                ? result.awayGoals
                : (result.awayGoals90 ?? result.awayGoals),
            };
            const scoring = scoreMatchPick(
              { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
              resultForScoring,
              phaseConfig
            );
            totalPoints += scoring.totalPoints;
          } catch {}
        } else {
          const preset = getScoringPreset(pool.scoringPresetKey ?? "CLASSIC");
          const scoringResult = {
            homeGoals: phaseConfig?.includeExtraTime
              ? result.homeGoals
              : (result.homeGoals90 ?? result.homeGoals),
            awayGoals: phaseConfig?.includeExtraTime
              ? result.awayGoals
              : (result.awayGoals90 ?? result.awayGoals),
          };
          const actualOutcome = outcomeFromScore(scoringResult.homeGoals, scoringResult.awayGoals);
          const pickOutcome = pick.type === "SCORE"
            ? outcomeFromScore(pick.homeGoals, pick.awayGoals)
            : pick.outcome;
          const outcomeCorrect = pickOutcome === actualOutcome;
          const exact = pick.type === "SCORE" &&
            pick.homeGoals === scoringResult.homeGoals &&
            pick.awayGoals === scoringResult.awayGoals;

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
poolAdminRouter.get("/:poolId/notifications", async (req, res) => {
  const { poolId } = req.params;
  const userId = req.auth!.userId;

  try {
    // Verificar membresía activa
    const membership = await prisma.poolMember.findFirst({
      where: { poolId, userId, status: "ACTIVE" },
    });

    if (!membership) {
      return res.status(403).json({ error: "FORBIDDEN", reason: "NOT_A_MEMBER" });
    }

    const isHostOrCoAdmin = isPoolAdmin(membership.role);

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
      const phaseMatches: Record<string, FixtureMatch[]> = {};
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
