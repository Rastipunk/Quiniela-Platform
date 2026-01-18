import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { writeAuditEvent } from "../lib/audit";
import { templateDataSchema, validateTemplateDataConsistency } from "../schemas/templateData";


export const adminTemplatesRouter = Router();

// Comentario en español: todas estas rutas requieren usuario autenticado y ADMIN
adminTemplatesRouter.use(requireAuth, requireAdmin);

const createTemplateSchema = z.object({
  key: z.string().min(3).max(50), // ej: worldcup_2026
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
});

// Comentario en español: validamos que exista dataJson; su forma real la valida templateDataSchema aparte
const createVersionSchema = z.object({
  dataJson: z.any(),
});

// Comentario en español: valida dataJson contra el schema real del torneo
// Comentario en español: valida dataJson (forma + consistencia)
function validateTemplateData(dataJson: unknown) {
  const parsed = templateDataSchema.safeParse(dataJson);
  if (!parsed.success) {
    return { ok: false as const, details: parsed.error.flatten() };
  }

  const issues = validateTemplateDataConsistency(parsed.data);
  if (issues.length > 0) {
    return { ok: false as const, details: { formErrors: ["TemplateData inconsistente"], fieldErrors: {}, issues } };
  }

  return { ok: true as const, data: parsed.data };
}


// POST /admin/templates
adminTemplatesRouter.post("/templates", async (req, res) => {
  const parsed = createTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { key, name, description } = parsed.data;

  const existing = await prisma.tournamentTemplate.findUnique({ where: { key } });
  if (existing) {
    return res.status(409).json({ error: "CONFLICT", message: "Template key already exists" });
  }

  const tpl = await prisma.tournamentTemplate.create({
    data: { key, name, description: description ?? null, status: "DRAFT" },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "TEMPLATE_CREATED",
    entityType: "TournamentTemplate",
    entityId: tpl.id,
    dataJson: { key: tpl.key },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.status(201).json(tpl);
});

// POST /admin/templates/:templateId/versions
adminTemplatesRouter.post("/templates/:templateId/versions", async (req, res) => {
  const { templateId } = req.params;

  const parsed = createVersionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const validated = validateTemplateData(parsed.data.dataJson);
  if (!validated.ok) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: validated.details });
  }

  const template = await prisma.tournamentTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const last = await prisma.tournamentTemplateVersion.findFirst({
    where: { templateId },
    orderBy: { versionNumber: "desc" },
  });

  const nextVersionNumber = (last?.versionNumber ?? 0) + 1;

  const version = await prisma.tournamentTemplateVersion.create({
    data: {
      templateId,
      versionNumber: nextVersionNumber,
      status: "DRAFT",
      dataJson: validated.data as unknown as Prisma.InputJsonValue,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "TEMPLATE_VERSION_CREATED",
    entityType: "TournamentTemplateVersion",
    entityId: version.id,
    dataJson: { templateId, versionNumber: version.versionNumber },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.status(201).json(version);
});

// PUT /admin/templates/:templateId/versions/:versionId  (solo DRAFT)
adminTemplatesRouter.put("/templates/:templateId/versions/:versionId", async (req, res) => {
  const { templateId, versionId } = req.params;

  const parsed = createVersionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const validated = validateTemplateData(parsed.data.dataJson);
  if (!validated.ok) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: validated.details });
  }

  const version = await prisma.tournamentTemplateVersion.findFirst({
    where: { id: versionId, templateId },
  });

  if (!version) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  if (version.status !== "DRAFT") {
    return res.status(409).json({ error: "CONFLICT", message: "Only DRAFT versions can be edited" });
  }

  const updated = await prisma.tournamentTemplateVersion.update({
    where: { id: versionId },
    data: { dataJson: validated.data as unknown as Prisma.InputJsonValue },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "TEMPLATE_VERSION_UPDATED",
    entityType: "TournamentTemplateVersion",
    entityId: updated.id,
    dataJson: { templateId, versionId },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json(updated);
});

// POST /admin/templates/:templateId/versions/:versionId/publish
adminTemplatesRouter.post("/templates/:templateId/versions/:versionId/publish", async (req, res) => {
  const { templateId, versionId } = req.params;

  const version = await prisma.tournamentTemplateVersion.findFirst({
    where: { id: versionId, templateId },
  });

  if (!version) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  if (version.status !== "DRAFT") {
    return res.status(409).json({ error: "CONFLICT", message: "Only DRAFT versions can be published" });
  }
    
  const validated = validateTemplateData(version.dataJson);
  if (!validated.ok) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: validated.details });
  }
  const published = await prisma.$transaction(async (tx) => {
    const v = await tx.tournamentTemplateVersion.update({
      where: { id: versionId },
      data: { status: "PUBLISHED", publishedAtUtc: new Date() },
    });

    await tx.tournamentTemplate.update({
      where: { id: templateId },
      data: { status: "PUBLISHED", currentPublishedVersionId: v.id },
    });

    return v;
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "TEMPLATE_VERSION_PUBLISHED",
    entityType: "TournamentTemplateVersion",
    entityId: published.id,
    dataJson: { templateId, versionId },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({ ok: true, publishedVersion: published });
});

// GET /admin/templates
adminTemplatesRouter.get("/templates", async (_req, res) => {
  const list = await prisma.tournamentTemplate.findMany({
    orderBy: { createdAtUtc: "desc" },
    include: { currentPublishedVersion: true },
  });

  return res.json(list);
});

// GET /admin/templates/:templateId/versions
adminTemplatesRouter.get("/templates/:templateId/versions", async (req, res) => {
  const { templateId } = req.params;

  const list = await prisma.tournamentTemplateVersion.findMany({
    where: { templateId },
    orderBy: { versionNumber: "desc" },
  });

  return res.json(list);
});
