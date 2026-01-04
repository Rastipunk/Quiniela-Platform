import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { writeAuditEvent } from "../lib/audit";
import {
  advanceToRoundOf32,
  advanceKnockoutPhase,
  validateGroupStageComplete,
} from "../services/instanceAdvancement";

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
      dataJson: version.dataJson,
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

