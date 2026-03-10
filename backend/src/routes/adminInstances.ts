import { Router } from "express";
import { Prisma, ResultSourceMode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { writeAuditEvent } from "../lib/audit";
import {
  advanceToRoundOf32,
  advanceKnockoutPhase,
  advanceTwoLeggedPhase,
  validateGroupStageComplete,
} from "../services/instanceAdvancement";
import { getResultSyncService } from "../services/resultSync";
import { getJobStatus, triggerManualSync } from "../jobs/resultSyncJob";

export const adminInstancesRouter = Router();

// Comentario en español: todo aquí requiere ADMIN
adminInstancesRouter.use(requireAuth, requireAdmin);

const createInstanceSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  // Comentario en español: opcional, para crear desde una versión publicada específica
  templateVersionId: z.string().uuid().optional(),
});

// POST /admin/templates/:templateId/instances
// Comentario en español: crea TournamentInstance desde:
// - currentPublishedVersionId (default) o
// - templateVersionId (si se envía, debe ser PUBLISHED y del mismo template)
adminInstancesRouter.post("/templates/:templateId/instances", async (req, res) => {
  const { templateId } = req.params;

  const bodyParsed = createInstanceSchema.safeParse(req.body ?? {});
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: bodyParsed.error.flatten() });
  }

  const template = await prisma.tournamentTemplate.findUnique({
    where: { id: templateId },
    include: { currentPublishedVersion: true },
  });

  if (!template) return res.status(404).json({ error: "NOT_FOUND" });

  let sourceVersionId: string | null = null;

  // Comentario en español: si el request manda templateVersionId, lo respetamos
  if (bodyParsed.data.templateVersionId) {
    sourceVersionId = bodyParsed.data.templateVersionId;
  } else {
    sourceVersionId = template.currentPublishedVersionId ?? null;
  }

  if (!sourceVersionId) {
    return res.status(409).json({ error: "CONFLICT", message: "Template has no published version" });
  }

  const version = await prisma.tournamentTemplateVersion.findFirst({
    where: { id: sourceVersionId, templateId },
  });

  if (!version) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Template version not found for this template" });
  }

  if (version.status !== "PUBLISHED") {
    return res.status(409).json({ error: "CONFLICT", message: "Selected templateVersionId is not PUBLISHED" });
  }

  const name = bodyParsed.data.name ?? `${template.name} (Instance)`;

  const instance = await prisma.tournamentInstance.create({
    data: {
      templateId: template.id,
      templateVersionId: version.id,
      name,
      status: "DRAFT",
      dataJson: version.dataJson as Prisma.InputJsonValue,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "TOURNAMENT_INSTANCE_CREATED",
    entityType: "TournamentInstance",
    entityId: instance.id,
    dataJson: { templateId: template.id, templateVersionId: version.id },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.status(201).json(instance);
});

function ensureTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    DRAFT: ["ACTIVE", "ARCHIVED"],
    ACTIVE: ["COMPLETED"],
    COMPLETED: ["ARCHIVED"],
    ARCHIVED: [],
  };
  return (allowed[from] ?? []).includes(to);
}

// POST /admin/instances/:instanceId/activate  (DRAFT -> ACTIVE)
adminInstancesRouter.post("/instances/:instanceId/activate", async (req, res) => {
  const { instanceId } = req.params;

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) return res.status(404).json({ error: "NOT_FOUND" });

  if (!ensureTransition(instance.status, "ACTIVE")) {
    return res.status(409).json({ error: "CONFLICT", message: `Cannot transition ${instance.status} -> ACTIVE` });
  }

  const updated = await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: { status: "ACTIVE" },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "TOURNAMENT_INSTANCE_ACTIVATED",
    entityType: "TournamentInstance",
    entityId: updated.id,
    dataJson: { from: instance.status, to: "ACTIVE" },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json(updated);
});

// POST /admin/instances/:instanceId/complete  (ACTIVE -> COMPLETED)
adminInstancesRouter.post("/instances/:instanceId/complete", async (req, res) => {
  const { instanceId } = req.params;

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) return res.status(404).json({ error: "NOT_FOUND" });

  if (!ensureTransition(instance.status, "COMPLETED")) {
    return res.status(409).json({ error: "CONFLICT", message: `Cannot transition ${instance.status} -> COMPLETED` });
  }

  const updated = await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: { status: "COMPLETED" },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "TOURNAMENT_INSTANCE_COMPLETED",
    entityType: "TournamentInstance",
    entityId: updated.id,
    dataJson: { from: instance.status, to: "COMPLETED" },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json(updated);
});

// POST /admin/instances/:instanceId/archive  (DRAFT|COMPLETED -> ARCHIVED)
adminInstancesRouter.post("/instances/:instanceId/archive", async (req, res) => {
  const { instanceId } = req.params;

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) return res.status(404).json({ error: "NOT_FOUND" });

  if (!ensureTransition(instance.status, "ARCHIVED")) {
    return res.status(409).json({ error: "CONFLICT", message: `Cannot transition ${instance.status} -> ARCHIVED` });
  }

  const updated = await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: { status: "ARCHIVED" },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "TOURNAMENT_INSTANCE_ARCHIVED",
    entityType: "TournamentInstance",
    entityId: updated.id,
    dataJson: { from: instance.status, to: "ARCHIVED" },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json(updated);
});

// GET /admin/instances
adminInstancesRouter.get("/instances", async (_req, res) => {
  const list = await prisma.tournamentInstance.findMany({
    orderBy: { createdAtUtc: "desc" },
  });
  return res.json(list);
});

// GET /admin/instances/:instanceId
adminInstancesRouter.get("/instances/:instanceId", async (req, res) => {
  const { instanceId } = req.params;
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(instance);
});

// ========== TOURNAMENT ADVANCEMENT ENDPOINTS ==========

// POST /admin/instances/:instanceId/advance-to-r32
// Avanza el torneo de la fase de grupos al Round of 32
adminInstancesRouter.post("/instances/:instanceId/advance-to-r32", async (req, res) => {
  const { instanceId } = req.params;

  try {
    const result = await advanceToRoundOf32(instanceId);

    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "TOURNAMENT_ADVANCED_TO_R32",
      entityType: "TournamentInstance",
      entityId: instanceId,
      dataJson: {
        winnersCount: result.winners.size,
        runnersUpCount: result.runnersUp.size,
        bestThirdsCount: result.bestThirds.length,
        resolvedMatchesCount: result.resolvedMatches.length,
      },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    return res.json({
      success: true,
      message: "Avance a Round of 32 completado",
      data: {
        standings: Object.fromEntries(result.standings),
        winners: Object.fromEntries(result.winners),
        runnersUp: Object.fromEntries(result.runnersUp),
        bestThirds: result.bestThirds,
        resolvedMatches: result.resolvedMatches,
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      error: "ADVANCEMENT_FAILED",
      message: error.message,
    });
  }
});

// POST /admin/instances/:instanceId/advance-knockout
// Avanza una fase eliminatoria a la siguiente
// Body: { currentPhaseId: "round_of_32", nextPhaseId: "round_of_16" }
const advanceKnockoutSchema = z.object({
  currentPhaseId: z.string(),
  nextPhaseId: z.string(),
});

adminInstancesRouter.post("/instances/:instanceId/advance-knockout", async (req, res) => {
  const { instanceId } = req.params;

  const bodyParsed = advanceKnockoutSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: bodyParsed.error.flatten() });
  }

  const { currentPhaseId, nextPhaseId } = bodyParsed.data;

  try {
    const result = await advanceKnockoutPhase(instanceId, currentPhaseId, nextPhaseId);

    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "TOURNAMENT_ADVANCED_KNOCKOUT",
      entityType: "TournamentInstance",
      entityId: instanceId,
      dataJson: {
        from: currentPhaseId,
        to: nextPhaseId,
        resolvedMatchesCount: result.resolvedMatches.length,
      },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    return res.json({
      success: true,
      message: `Avance de ${currentPhaseId} a ${nextPhaseId} completado`,
      data: {
        resolvedMatches: result.resolvedMatches,
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      error: "ADVANCEMENT_FAILED",
      message: error.message,
    });
  }
});

// POST /admin/instances/:instanceId/advance-two-legged
// Avanza una ronda two-legged (ida + vuelta) a la siguiente
// Body: { currentRound: "r32", nextRound: "r16", poolId?: string }
const advanceTwoLeggedSchema = z.object({
  currentRound: z.string(), // "r32", "r16", "qf", "sf"
  nextRound: z.string(),    // "r16", "qf", "sf", "final"
  poolId: z.string().uuid().optional(),
});

adminInstancesRouter.post("/instances/:instanceId/advance-two-legged", async (req, res) => {
  const { instanceId } = req.params;

  const bodyParsed = advanceTwoLeggedSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: bodyParsed.error.flatten() });
  }

  const { currentRound, nextRound, poolId } = bodyParsed.data;

  try {
    // Si se especifica poolId, solo avanzar esa pool
    // Si no, avanzar todas las pools de la instancia
    let poolIds: string[];

    if (poolId) {
      poolIds = [poolId];
    } else {
      const pools = await prisma.pool.findMany({
        where: { tournamentInstanceId: instanceId },
        select: { id: true },
      });
      poolIds = pools.map((p) => p.id);
    }

    if (poolIds.length === 0) {
      return res.status(404).json({ error: "NOT_FOUND", message: "No pools found for this instance" });
    }

    const allResults = [];
    for (const pid of poolIds) {
      const result = await advanceTwoLeggedPhase(instanceId, currentRound, nextRound, pid);
      allResults.push({ poolId: pid, ...result });
    }

    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "TOURNAMENT_ADVANCED_TWO_LEGGED",
      entityType: "TournamentInstance",
      entityId: instanceId,
      dataJson: {
        from: currentRound,
        to: nextRound,
        poolsAdvanced: poolIds.length,
        winnersPerPool: allResults.map((r) => ({
          poolId: r.poolId,
          winners: r.winners.map((w) => ({
            tieNumber: w.tieNumber,
            winnerId: w.winnerId,
            decidedBy: w.decidedBy,
          })),
        })),
      },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    return res.json({
      success: true,
      message: `Avance de ${currentRound} a ${nextRound} completado para ${poolIds.length} pool(s)`,
      data: allResults,
    });
  } catch (error: any) {
    return res.status(400).json({
      error: "ADVANCEMENT_FAILED",
      message: error.message,
    });
  }
});

// GET /admin/instances/:instanceId/group-stage-status
// Verifica si la fase de grupos está completa
adminInstancesRouter.get("/instances/:instanceId/group-stage-status", async (req, res) => {
  const { instanceId } = req.params;

  try {
    const validation = await validateGroupStageComplete(instanceId);

    return res.json({
      isComplete: validation.isComplete,
      missingMatches: validation.missingMatches,
      missingCount: validation.missingMatches.length,
    });
  } catch (error: any) {
    return res.status(400).json({
      error: "VALIDATION_FAILED",
      message: error.message,
    });
  }
});

// ========== RESULT SOURCE CONFIGURATION ENDPOINTS ==========

const resultSourceConfigSchema = z.object({
  resultSourceMode: z.enum(["MANUAL", "AUTO"]),
  apiFootballLeagueId: z.number().int().positive().optional(),
  apiFootballSeasonId: z.number().int().positive().optional(),
  syncEnabled: z.boolean().optional(),
});

// PUT /admin/instances/:instanceId/result-source
// Configura el modo de fuente de resultados para una instancia
adminInstancesRouter.put("/instances/:instanceId/result-source", async (req, res) => {
  const { instanceId } = req.params;

  const bodyParsed = resultSourceConfigSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: bodyParsed.error.flatten() });
  }

  const { resultSourceMode, apiFootballLeagueId, apiFootballSeasonId, syncEnabled } = bodyParsed.data;

  // Si es AUTO, requerir IDs de API-Football
  if (resultSourceMode === "AUTO") {
    if (!apiFootballLeagueId || !apiFootballSeasonId) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "apiFootballLeagueId and apiFootballSeasonId are required when resultSourceMode is AUTO",
      });
    }
  }

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const updated = await prisma.tournamentInstance.update({
    where: { id: instanceId },
    data: {
      resultSourceMode: resultSourceMode as ResultSourceMode,
      apiFootballLeagueId: resultSourceMode === "AUTO" ? apiFootballLeagueId : null,
      apiFootballSeasonId: resultSourceMode === "AUTO" ? apiFootballSeasonId : null,
      syncEnabled: syncEnabled ?? (resultSourceMode === "AUTO"),
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "INSTANCE_RESULT_SOURCE_CONFIGURED",
    entityType: "TournamentInstance",
    entityId: instanceId,
    dataJson: {
      resultSourceMode,
      apiFootballLeagueId,
      apiFootballSeasonId,
      syncEnabled,
    },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json(updated);
});

// ========== MATCH MAPPING ENDPOINTS ==========

const matchMappingSchema = z.object({
  internalMatchId: z.string(),
  apiFootballFixtureId: z.number().int().positive(),
});

const bulkMappingsSchema = z.object({
  mappings: z.array(matchMappingSchema).min(1).max(200),
});

// POST /admin/instances/:instanceId/match-mappings
// Crear/actualizar mapeos de partidos a API-Football (bulk)
adminInstancesRouter.post("/instances/:instanceId/match-mappings", async (req, res) => {
  const { instanceId } = req.params;

  const bodyParsed = bulkMappingsSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: bodyParsed.error.flatten() });
  }

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  if (instance.resultSourceMode !== "AUTO") {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Match mappings can only be created for instances in AUTO mode",
    });
  }

  const { mappings } = bodyParsed.data;

  // Usar upsert para cada mapeo (crear o actualizar)
  const results = await prisma.$transaction(
    mappings.map((m) =>
      prisma.matchExternalMapping.upsert({
        where: {
          tournamentInstanceId_internalMatchId: {
            tournamentInstanceId: instanceId,
            internalMatchId: m.internalMatchId,
          },
        },
        create: {
          tournamentInstanceId: instanceId,
          internalMatchId: m.internalMatchId,
          apiFootballFixtureId: m.apiFootballFixtureId,
        },
        update: {
          apiFootballFixtureId: m.apiFootballFixtureId,
        },
      })
    )
  );

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "MATCH_MAPPINGS_UPDATED",
    entityType: "TournamentInstance",
    entityId: instanceId,
    dataJson: { mappingsCount: mappings.length },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.status(201).json({
    success: true,
    created: results.length,
    mappings: results,
  });
});

// GET /admin/instances/:instanceId/match-mappings
// Listar todos los mapeos de una instancia
adminInstancesRouter.get("/instances/:instanceId/match-mappings", async (req, res) => {
  const { instanceId } = req.params;

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const mappings = await prisma.matchExternalMapping.findMany({
    where: { tournamentInstanceId: instanceId },
    orderBy: { createdAtUtc: "asc" },
  });

  return res.json({
    instanceId,
    resultSourceMode: instance.resultSourceMode,
    mappingsCount: mappings.length,
    mappings,
  });
});

// DELETE /admin/instances/:instanceId/match-mappings/:mappingId
// Eliminar un mapeo específico
adminInstancesRouter.delete("/instances/:instanceId/match-mappings/:mappingId", async (req, res) => {
  const { instanceId, mappingId } = req.params;

  const mapping = await prisma.matchExternalMapping.findFirst({
    where: { id: mappingId, tournamentInstanceId: instanceId },
  });

  if (!mapping) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  await prisma.matchExternalMapping.delete({ where: { id: mappingId } });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "MATCH_MAPPING_DELETED",
    entityType: "MatchExternalMapping",
    entityId: mappingId,
    dataJson: { instanceId, internalMatchId: mapping.internalMatchId },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({ success: true });
});

// ========== SYNC ENDPOINTS ==========

// POST /admin/instances/:instanceId/sync
// Disparar sincronización manual para una instancia
adminInstancesRouter.post("/instances/:instanceId/sync", async (req, res) => {
  const { instanceId } = req.params;

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  if (instance.resultSourceMode !== "AUTO") {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Sync is only available for instances in AUTO mode",
    });
  }

  const syncService = getResultSyncService();

  if (!syncService.isAvailable()) {
    return res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message: "API-Football service is not available",
    });
  }

  try {
    const result = await syncService.syncInstance(instanceId);

    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "MANUAL_SYNC_TRIGGERED",
      entityType: "TournamentInstance",
      entityId: instanceId,
      dataJson: {
        fixturesChecked: result.fixturesChecked,
        fixturesUpdated: result.fixturesUpdated,
        status: result.status,
      },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    return res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "SYNC_FAILED",
      message: error.message,
    });
  }
});

// GET /admin/instances/:instanceId/sync-status
// Ver estado y logs de sincronización
adminInstancesRouter.get("/instances/:instanceId/sync-status", async (req, res) => {
  const { instanceId } = req.params;

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  // Obtener últimos 20 logs de sincronización
  const syncLogs = await prisma.resultSyncLog.findMany({
    where: { tournamentInstanceId: instanceId },
    orderBy: { startedAtUtc: "desc" },
    take: 20,
  });

  // Obtener conteo de mapeos
  const mappingsCount = await prisma.matchExternalMapping.count({
    where: { tournamentInstanceId: instanceId },
  });

  // Estado del job global
  const jobStatus = getJobStatus();

  return res.json({
    instanceId,
    instanceName: instance.name,
    resultSourceMode: instance.resultSourceMode,
    syncEnabled: instance.syncEnabled,
    apiFootballLeagueId: instance.apiFootballLeagueId,
    apiFootballSeasonId: instance.apiFootballSeasonId,
    lastSyncAtUtc: instance.lastSyncAtUtc,
    mappingsCount,
    jobStatus,
    recentSyncLogs: syncLogs,
  });
});

// POST /admin/sync/trigger-all
// Disparar sincronización manual de todas las instancias AUTO
adminInstancesRouter.post("/sync/trigger-all", async (req, res) => {
  const syncService = getResultSyncService();

  if (!syncService.isAvailable()) {
    return res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message: "API-Football service is not available",
    });
  }

  try {
    const summary = await syncService.syncAllAutoInstances();

    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "GLOBAL_SYNC_TRIGGERED",
      entityType: "System",
      entityId: "result-sync",
      dataJson: {
        instancesChecked: summary.instancesChecked,
        instancesUpdated: summary.instancesUpdated,
        totalFixturesUpdated: summary.totalFixturesUpdated,
      },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    return res.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "SYNC_FAILED",
      message: error.message,
    });
  }
});

// GET /admin/sync/status
// Ver estado global del sistema de sincronización
adminInstancesRouter.get("/sync/status", async (_req, res) => {
  const syncService = getResultSyncService();
  const jobStatus = getJobStatus();

  // Contar instancias AUTO
  const autoInstancesCount = await prisma.tournamentInstance.count({
    where: { resultSourceMode: "AUTO" },
  });

  const enabledAutoInstancesCount = await prisma.tournamentInstance.count({
    where: { resultSourceMode: "AUTO", syncEnabled: true },
  });

  // Últimas sincronizaciones globales
  const recentLogs = await prisma.resultSyncLog.findMany({
    orderBy: { startedAtUtc: "desc" },
    take: 10,
    include: {
      tournamentInstance: {
        select: { id: true, name: true },
      },
    },
  });

  return res.json({
    serviceAvailable: syncService.isAvailable(),
    jobStatus,
    autoInstancesCount,
    enabledAutoInstancesCount,
    recentLogs,
  });
});

