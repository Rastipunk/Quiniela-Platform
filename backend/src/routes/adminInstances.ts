import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { writeAuditEvent } from "../lib/audit";

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

