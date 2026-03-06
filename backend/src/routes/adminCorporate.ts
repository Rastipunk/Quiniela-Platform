import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { writeAuditEvent } from "../lib/audit";
import { hashPassword } from "../lib/password";
import { sendWelcomeEmail } from "../lib/email";

export const adminCorporateRouter = Router();

// All routes require admin
adminCorporateRouter.use(requireAuth, requireAdmin);

// =========================================================================
// INQUIRIES
// =========================================================================

// GET /admin/corporate/inquiries — Listar inquiries
adminCorporateRouter.get("/inquiries", async (req, res) => {
  const { responded, page = "1", limit = "50" } = req.query;

  const where: any = {};
  if (responded === "true") where.responded = true;
  if (responded === "false") where.responded = false;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [inquiries, total] = await Promise.all([
    prisma.organizationInquiry.findMany({
      where,
      orderBy: { createdAtUtc: "desc" },
      skip,
      take: limitNum,
      include: { organization: { select: { id: true, name: true } } },
    }),
    prisma.organizationInquiry.count({ where }),
  ]);

  return res.json({
    inquiries,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
});

// PATCH /admin/corporate/inquiries/:id — Marcar como respondida
adminCorporateRouter.patch("/inquiries/:id", async (req, res) => {
  const { id } = req.params;

  const inquiry = await prisma.organizationInquiry.findUnique({ where: { id } });
  if (!inquiry) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const updated = await prisma.organizationInquiry.update({
    where: { id },
    data: { responded: true, respondedAt: new Date() },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "CORPORATE_INQUIRY_RESPONDED",
    entityType: "OrganizationInquiry",
    entityId: id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.json({ success: true, inquiry: updated });
});

// =========================================================================
// ORGANIZATIONS
// =========================================================================

const createOrgSchema = z.object({
  name: z.string().min(2).max(200),
  contactEmail: z.string().email().max(255),
  contactName: z.string().min(2).max(100),
  contactPhone: z.string().max(30).optional(),
  logoUrl: z.string().url().max(500).optional(),
  website: z.string().url().max(500).optional(),
  employeeCount: z.enum(["1-50", "51-200", "201-500", "500+"]).optional(),
  notes: z.string().max(5000).optional(),
  inquiryId: z.string().uuid().optional(),
});

// POST /admin/corporate/organizations — Crear organización
adminCorporateRouter.post("/organizations", async (req, res) => {
  const parsed = createOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { inquiryId, ...orgData } = parsed.data;

  const org = await prisma.organization.create({
    data: {
      ...orgData,
      contactPhone: orgData.contactPhone || null,
      logoUrl: orgData.logoUrl || null,
      website: orgData.website || null,
      employeeCount: orgData.employeeCount || null,
      notes: orgData.notes || null,
      status: "ONBOARDING",
    },
  });

  // Vincular inquiry si se proporcionó
  if (inquiryId) {
    await prisma.organizationInquiry.update({
      where: { id: inquiryId },
      data: { organizationId: org.id },
    }).catch(() => {
      // inquiry no encontrada — no es crítico
    });
  }

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "CORPORATE_ORGANIZATION_CREATED",
    entityType: "Organization",
    entityId: org.id,
    dataJson: { name: org.name, inquiryId },
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json({ success: true, organization: org });
});

// GET /admin/corporate/organizations — Listar organizaciones
adminCorporateRouter.get("/organizations", async (req, res) => {
  const { status, page = "1", limit = "50" } = req.query;

  const where: any = {};
  if (status && ["INQUIRY", "ONBOARDING", "ACTIVE", "SUSPENDED"].includes(status as string)) {
    where.status = status;
  }

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAtUtc: "desc" },
      skip,
      take: limitNum,
      include: {
        _count: { select: { pools: true, inquiries: true } },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return res.json({
    organizations,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
});

const updateOrgSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  contactEmail: z.string().email().max(255).optional(),
  contactName: z.string().min(2).max(100).optional(),
  contactPhone: z.string().max(30).optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  website: z.string().url().max(500).nullable().optional(),
  employeeCount: z.enum(["1-50", "51-200", "201-500", "500+"]).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  status: z.enum(["INQUIRY", "ONBOARDING", "ACTIVE", "SUSPENDED"]).optional(),
});

// PATCH /admin/corporate/organizations/:id — Actualizar organización
adminCorporateRouter.patch("/organizations/:id", async (req, res) => {
  const { id } = req.params;

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const parsed = updateOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: parsed.data,
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "CORPORATE_ORGANIZATION_UPDATED",
    entityType: "Organization",
    entityId: id,
    dataJson: parsed.data,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.json({ success: true, organization: updated });
});

// =========================================================================
// CORPORATE POOLS
// =========================================================================

const createPoolSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(500).optional(),
  tournamentInstanceId: z.string().uuid(),
  logoUrl: z.string().url().max(500).optional(),
});

// POST /admin/corporate/organizations/:orgId/pools — Crear pool para organización
adminCorporateRouter.post("/organizations/:orgId/pools", async (req, res) => {
  const { orgId } = req.params;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const parsed = createPoolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { name, description, tournamentInstanceId, logoUrl } = parsed.data;

  // Verificar que la instancia existe
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: tournamentInstanceId },
    select: { id: true, dataJson: true },
  });
  if (!instance) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const pool = await prisma.pool.create({
    data: {
      name,
      description: description || null,
      tournamentInstanceId,
      organizationId: orgId,
      logoUrl: logoUrl || org.logoUrl || null,
      createdByUserId: req.auth!.userId,
      status: "ACTIVE",
      fixtureSnapshot: instance.dataJson as any,
    },
  });

  // Agregar admin como HOST del pool
  await prisma.poolMember.create({
    data: {
      poolId: pool.id,
      userId: req.auth!.userId,
      role: "HOST",
      status: "ACTIVE",
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "CORPORATE_POOL_CREATED",
    entityType: "Pool",
    entityId: pool.id,
    poolId: pool.id,
    dataJson: { organizationId: orgId, name },
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json({ success: true, pool });
});

// =========================================================================
// BULK CREATE USERS
// =========================================================================

const bulkCreateUsersSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(500),
  poolId: z.string().uuid().optional(),
});

// POST /admin/corporate/bulk-create-users — Crear usuarios masivamente
adminCorporateRouter.post("/bulk-create-users", async (req, res) => {
  const parsed = bulkCreateUsersSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { emails, poolId } = parsed.data;

  // Verificar pool si se proporcionó
  if (poolId) {
    const pool = await prisma.pool.findUnique({ where: { id: poolId }, select: { id: true } });
    if (!pool) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
  }

  // Buscar usuarios existentes
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const existingEmails = new Set(existingUsers.map((u) => u.email));

  const created: Array<{ id: string; email: string; username: string }> = [];
  const existing: Array<{ id: string; email: string }> = existingUsers;

  // Crear nuevos usuarios
  for (const email of emails) {
    if (existingEmails.has(email)) continue;

    const prefix = email.split("@")[0]!;
    const suffix = crypto.randomBytes(3).toString("hex");
    const username = `${prefix}_${suffix}`;
    const displayName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    const password = crypto.randomBytes(9).toString("base64url").slice(0, 12);
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
        emailVerified: true, // Corporate users: email pre-verified
      },
    });

    created.push({ id: user.id, email: user.email, username: user.username });

    // Enviar welcome email (fire and forget)
    sendWelcomeEmail({
      to: email,
      userId: user.id,
      displayName,
    }).catch((err) => console.error(`Error sending welcome email to ${email}:`, err));
  }

  // Agregar a pool si se proporcionó
  let addedToPool = 0;
  if (poolId) {
    const allUserIds = [
      ...created.map((u) => u.id),
      ...existing.map((u) => u.id),
    ];

    // Buscar miembros existentes del pool
    const existingMembers = await prisma.poolMember.findMany({
      where: { poolId, userId: { in: allUserIds } },
      select: { userId: true },
    });
    const existingMemberIds = new Set(existingMembers.map((m) => m.userId));

    // Solo agregar los que no son ya miembros
    const newMembers = allUserIds.filter((id) => !existingMemberIds.has(id));

    if (newMembers.length > 0) {
      await prisma.poolMember.createMany({
        data: newMembers.map((userId) => ({
          poolId,
          userId,
          role: "PLAYER" as const,
          status: "ACTIVE" as const,
        })),
      });
      addedToPool = newMembers.length;
    }
  }

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "CORPORATE_BULK_USERS_CREATED",
    entityType: "User",
    dataJson: {
      emailCount: emails.length,
      createdCount: created.length,
      existingCount: existing.length,
      addedToPool,
      poolId,
    },
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json({
    success: true,
    created,
    existing,
    addedToPool,
    summary: {
      totalEmails: emails.length,
      newUsers: created.length,
      existingUsers: existing.length,
      addedToPool,
    },
  });
});
