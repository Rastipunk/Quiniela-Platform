import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { sendAdminNotification, sendCorporateInquiryConfirmationEmail, sendCorporateActivationEmail, sendWelcomeEmail, escapeHtml } from "../lib/email";
import { getPresetByKey, generateDynamicPresetConfig } from "../lib/pickPresets";
import { validatePoolPickTypesConfig, PoolPickTypesConfigSchema } from "../validation/pickConfig";
import { extractPhases } from "../lib/fixture";
import rateLimit from "express-rate-limit";
import { transitionToActive } from "../services/poolStateMachine";

export const corporateRouter = Router();

// =========================================================================
// HELPER: Verificar que el usuario es CORPORATE_HOST del pool
// =========================================================================

async function requireCorporateHost(userId: string, poolId: string) {
  const member = await prisma.poolMember.findUnique({
    where: { poolId_userId: { poolId, userId } },
    select: { role: true },
  });
  return member?.role === "CORPORATE_HOST";
}

// =========================================================================
// POST /corporate/inquiry — Público, sin auth (formulario de contacto)
// =========================================================================

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "RATE_LIMITED" },
});

const inquirySchema = z.object({
  companyName: z.string().min(2).max(200),
  contactName: z.string().min(2).max(100),
  contactEmail: z.string().email().max(255),
  contactPhone: z.string().max(30).optional(),
  employeeCount: z.enum(["1-50", "51-200", "201-500", "500+"]).optional(),
  message: z.string().max(2000).optional(),
  locale: z.enum(["es", "en", "pt"]).default("es"),
});

corporateRouter.post("/inquiry", inquiryLimiter, async (req, res) => {
  const parsed = inquirySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { companyName, contactName, contactEmail, contactPhone, employeeCount, message, locale } = parsed.data;

  const inquiry = await prisma.organizationInquiry.create({
    data: {
      companyName,
      contactName,
      contactEmail,
      contactPhone: contactPhone || null,
      employeeCount: employeeCount || null,
      message: message || null,
      locale,
    },
  });

  sendAdminNotification({
    subject: `${escapeHtml(companyName)} — ${escapeHtml(contactName)}`,
    type: "corporate_inquiry",
    body: `
      <p><strong>Empresa:</strong> ${escapeHtml(companyName)}</p>
      <p><strong>Contacto:</strong> ${escapeHtml(contactName)} &lt;${escapeHtml(contactEmail)}&gt;</p>
      ${contactPhone ? `<p><strong>Teléfono:</strong> ${escapeHtml(contactPhone)}</p>` : ""}
      ${employeeCount ? `<p><strong>Empleados:</strong> ${employeeCount}</p>` : ""}
      ${message ? `<p><strong>Mensaje:</strong> ${escapeHtml(message)}</p>` : ""}
      <p><strong>Idioma:</strong> ${escapeHtml(locale)}</p>
    `,
  }).catch((err) => console.error("Error sending admin notification:", err));

  sendCorporateInquiryConfirmationEmail({
    to: contactEmail,
    contactName,
    companyName,
    locale,
  }).catch((err) => console.error("Error sending corporate confirmation:", err));

  return res.status(201).json({
    success: true,
    message: "Solicitud enviada exitosamente. Nos pondremos en contacto contigo pronto.",
    id: inquiry.id,
  });
});

// =========================================================================
// POST /corporate/pools — Crear pool corporativo (self-service, autenticado)
// =========================================================================

const createCorporatePoolSchema = z.object({
  companyName: z.string().min(2).max(200),
  logoBase64: z.string().max(700_000).optional(),
  welcomeMessage: z.string().max(1000).optional(),
  invitationMessage: z.string().max(1000).optional(),
  tournamentInstanceId: z.string().min(1),
  poolName: z.string().min(3).max(120),
  poolDescription: z.string().max(500).optional(),
  timeZone: z.string().optional(),
  deadlineMinutesBeforeKickoff: z.number().min(0).max(1440).optional(),
  requireApproval: z.boolean().optional(),
  pickTypesConfig: z.union([
    z.enum(["BASIC", "SIMPLE", "CUMULATIVE"]),
    PoolPickTypesConfigSchema,
  ]).optional(),
  maxParticipants: z.number().int().min(100).max(10000).optional(),
  emails: z.array(z.string().email()).max(500).optional(),
});

corporateRouter.post("/pools", requireAuth, async (req, res) => {
  const parsed = createCorporatePoolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const {
    companyName, logoBase64, welcomeMessage, invitationMessage,
    tournamentInstanceId, poolName, poolDescription,
    timeZone, deadlineMinutesBeforeKickoff, requireApproval,
    pickTypesConfig, maxParticipants, emails,
  } = parsed.data;

  // Verificar que la instancia existe
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: tournamentInstanceId } });
  if (!instance) return res.status(404).json({ error: "NOT_FOUND" });
  if (instance.status === "ARCHIVED") {
    return res.status(409).json({ error: "INSTANCE_ARCHIVED" });
  }

  // Procesar pickTypesConfig (misma lógica que pools.ts)
  let finalPickTypesConfig: any = null;
  if (pickTypesConfig) {
    if (typeof pickTypesConfig === "string") {
      const instancePhases = extractPhases(instance.dataJson);
      let dynamicConfig = instancePhases.length > 0
        ? generateDynamicPresetConfig(pickTypesConfig, instancePhases)
        : null;
      if (!dynamicConfig) {
        const preset = getPresetByKey(pickTypesConfig);
        if (!preset) {
          return res.status(400).json({ error: "VALIDATION_ERROR", message: `Invalid preset key: ${pickTypesConfig}` });
        }
        dynamicConfig = preset.config;
      }
      finalPickTypesConfig = dynamicConfig;
    } else {
      const validation = validatePoolPickTypesConfig(pickTypesConfig);
      if (!validation.valid) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid pick types configuration", errors: validation.errors });
      }
      finalPickTypesConfig = pickTypesConfig;
    }
  }

  // Obtener info del usuario creador
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { email: true, displayName: true },
  });

  // Transacción: crear Organization + Pool + PoolMember + CorporateInvites
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: companyName,
        contactEmail: user?.email || "",
        contactName: user?.displayName || "",
        logoBase64: logoBase64 || null,
        welcomeMessage: welcomeMessage || null,
        invitationMessage: invitationMessage || null,
        status: "ACTIVE",
      },
    });

    const pool = await tx.pool.create({
      data: {
        tournamentInstanceId,
        name: poolName,
        description: poolDescription ?? null,
        visibility: "PRIVATE",
        timeZone: timeZone ?? "UTC",
        deadlineMinutesBeforeKickoff: deadlineMinutesBeforeKickoff ?? 10,
        createdByUserId: req.auth!.userId,
        scoringPresetKey: "CLASSIC",
        requireApproval: requireApproval ?? false,
        pickTypesConfig: finalPickTypesConfig,
        fixtureSnapshot: instance.dataJson as Prisma.InputJsonValue,
        organizationId: org.id,
        maxParticipants: maxParticipants ?? 100,
        status: "ACTIVE",
      },
    });

    await tx.poolMember.create({
      data: {
        poolId: pool.id,
        userId: req.auth!.userId,
        role: "CORPORATE_HOST",
        status: "ACTIVE",
      },
    });

    // Crear invites pendientes si se proporcionaron emails
    let pendingInvites = 0;
    if (emails && emails.length > 0) {
      const uniqueEmails = [...new Set(emails.map((e) => e.toLowerCase()))];
      for (const email of uniqueEmails) {
        const token = crypto.randomBytes(32).toString("hex");
        await tx.corporateInvite.create({
          data: {
            poolId: pool.id,
            email,
            activationToken: token,
            activationTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
            status: "PENDING",
          },
        });
        pendingInvites++;
      }
    }

    return { org, pool, pendingInvites };
  });

  // Notificar admin (fire and forget)
  sendAdminNotification({
    subject: `Nueva pool corporativa: ${companyName}`,
    type: "corporate_inquiry",
    body: `
      <p><strong>Empresa:</strong> ${companyName}</p>
      <p><strong>Creado por:</strong> ${user?.displayName || "—"} &lt;${user?.email || "—"}&gt;</p>
      <p><strong>Pool:</strong> ${poolName}</p>
      <p><strong>Empleados pendientes:</strong> ${result.pendingInvites}</p>
    `,
  }).catch((err) => console.error("Error sending admin notification:", err));

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "CORPORATE_POOL_CREATED",
    entityType: "Pool",
    entityId: result.pool.id,
    poolId: result.pool.id,
    dataJson: { companyName, organizationId: result.org.id, pendingInvites: result.pendingInvites },
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json({
    success: true,
    pool: result.pool,
    organization: { id: result.org.id, name: result.org.name },
    pendingInvites: result.pendingInvites,
  });
});

// =========================================================================
// POST /corporate/pools/:poolId/employees — Agregar empleados
// =========================================================================

const addEmployeesSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(500),
});

corporateRouter.post("/pools/:poolId/employees", requireAuth, async (req, res) => {
  const poolId = req.params.poolId as string;

  if (!(await requireCorporateHost(req.auth!.userId, poolId))) {
    return res.status(403).json({ error: "FORBIDDEN", reason: "CORPORATE_HOST_ONLY" });
  }

  const parsed = addEmployeesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const uniqueEmails = [...new Set(parsed.data.emails.map((e) => e.toLowerCase()))];

  // Buscar invites existentes para este pool
  const existing = await prisma.corporateInvite.findMany({
    where: { poolId, email: { in: uniqueEmails } },
    select: { email: true },
  });
  const existingSet = new Set(existing.map((e) => e.email));

  let added = 0;
  let skipped = 0;

  for (const email of uniqueEmails) {
    if (existingSet.has(email)) {
      skipped++;
      continue;
    }
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.corporateInvite.create({
      data: {
        poolId,
        email,
        activationToken: token,
        activationTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "PENDING",
      },
    });
    added++;
  }

  const total = await prisma.corporateInvite.count({ where: { poolId } });

  return res.json({ success: true, added, skipped, total });
});

// =========================================================================
// GET /corporate/pools/:poolId/employees — Listar empleados
// =========================================================================

corporateRouter.get("/pools/:poolId/employees", requireAuth, async (req, res) => {
  const poolId = req.params.poolId as string;

  if (!(await requireCorporateHost(req.auth!.userId, poolId))) {
    return res.status(403).json({ error: "FORBIDDEN", reason: "CORPORATE_HOST_ONLY" });
  }

  const invites = await prisma.corporateInvite.findMany({
    where: { poolId },
    orderBy: { createdAtUtc: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      activatedAt: true,
      createdAtUtc: true,
    },
  });

  const summary = {
    total: invites.length,
    pending: invites.filter((i) => i.status === "PENDING").length,
    sent: invites.filter((i) => i.status === "SENT").length,
    activated: invites.filter((i) => i.status === "ACTIVATED").length,
    failed: invites.filter((i) => i.status === "FAILED").length,
  };

  return res.json({ invites, summary });
});

// =========================================================================
// POST /corporate/pools/:poolId/send-invitations — Enviar invitaciones
// =========================================================================

corporateRouter.post("/pools/:poolId/send-invitations", requireAuth, async (req, res) => {
  const poolId = req.params.poolId as string;

  if (!(await requireCorporateHost(req.auth!.userId, poolId))) {
    return res.status(403).json({ error: "FORBIDDEN", reason: "CORPORATE_HOST_ONLY" });
  }

  // Obtener pool y org para datos del email
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { organization: { select: { name: true, logoBase64: true, invitationMessage: true } } },
  });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });

  const companyName = pool.organization?.name || "Empresa";
  const orgLogoBase64 = pool.organization?.logoBase64 || null;
  const orgInvitationMessage = pool.organization?.invitationMessage || null;

  // Buscar invites PENDING
  const pendingInvites = await prisma.corporateInvite.findMany({
    where: { poolId, status: "PENDING" },
  });

  if (pendingInvites.length === 0) {
    return res.json({ success: true, sent: 0, activated: 0, failed: 0 });
  }

  let sent = 0;
  let activated = 0;
  let failed = 0;

  for (const invite of pendingInvites) {
    try {
      // Verificar si el email ya tiene cuenta
      const existingUser = await prisma.user.findUnique({
        where: { email: invite.email },
        select: { id: true, displayName: true },
      });

      if (existingUser) {
        // Usuario ya existe → agregar directamente al pool
        const existingMember = await prisma.poolMember.findUnique({
          where: { poolId_userId: { poolId, userId: existingUser.id } },
        });

        if (!existingMember) {
          await prisma.poolMember.create({
            data: {
              poolId,
              userId: existingUser.id,
              role: "PLAYER",
              status: "ACTIVE",
            },
          });
        }

        await prisma.corporateInvite.update({
          where: { id: invite.id },
          data: { status: "ACTIVATED", activatedUserId: existingUser.id, activatedAt: new Date() },
        });

        // Transicionar pool DRAFT→ACTIVE si es el primer PLAYER
        await transitionToActive(poolId, existingUser.id).catch((err) =>
          console.error("transitionToActive error (corporate send-invitations):", err)
        );

        activated++;
      } else {
        // Usuario no existe → enviar activation email
        const emailResult = await sendCorporateActivationEmail({
          to: invite.email,
          employeeName: invite.name || undefined,
          companyName,
          poolName: pool.name,
          activationToken: invite.activationToken,
          logoBase64: orgLogoBase64,
          invitationMessage: orgInvitationMessage,
        });

        if (emailResult.success) {
          await prisma.corporateInvite.update({
            where: { id: invite.id },
            data: { status: "SENT" },
          });
          sent++;
        } else {
          console.error(`Email failed for ${invite.email}: ${emailResult.error}`);
          await prisma.corporateInvite.update({
            where: { id: invite.id },
            data: { status: "FAILED" },
          });
          failed++;
        }
      }
    } catch (err) {
      console.error(`Error processing invite ${invite.id}:`, err);
      await prisma.corporateInvite.update({
        where: { id: invite.id },
        data: { status: "FAILED" },
      }).catch(() => {});
      failed++;
    }
  }

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "CORPORATE_INVITATIONS_SENT",
    entityType: "Pool",
    entityId: poolId,
    poolId,
    dataJson: { sent, activated, failed, total: pendingInvites.length },
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.json({ success: true, sent, activated, failed });
});

// =========================================================================
// GET /corporate/csv-template — Descargar template CSV
// =========================================================================

corporateRouter.get("/csv-template", (_req, res) => {
  const bom = "\uFEFF";
  const csv = bom + "email,nombre\nempleado1@empresa.com,Juan Perez\nempleado2@empresa.com,Maria Garcia\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=empleados_template.csv");
  return res.send(csv);
});

// =========================================================================
// DELETE /corporate/pools/:poolId/employees/:inviteId — Remover empleado pendiente
// =========================================================================

corporateRouter.delete("/pools/:poolId/employees/:inviteId", requireAuth, async (req, res) => {
  const poolId = req.params.poolId as string;
  const inviteId = req.params.inviteId as string;

  if (!(await requireCorporateHost(req.auth!.userId, poolId))) {
    return res.status(403).json({ error: "FORBIDDEN", reason: "CORPORATE_HOST_ONLY" });
  }

  const invite = await prisma.corporateInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.poolId !== poolId) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  if (invite.status === "ACTIVATED") {
    return res.status(409).json({ error: "ALREADY_ACTIVATED" });
  }

  await prisma.corporateInvite.delete({ where: { id: inviteId } });

  return res.json({ success: true });
});
