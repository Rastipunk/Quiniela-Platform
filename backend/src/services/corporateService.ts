/**
 * Corporate Service — Pure business logic for corporate pool flows.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Audit context (ip, userAgent) passed as a separate object.
 *   - Side effects (email, audit) are fire-and-forget but logged on failure.
 */

import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import {
  sendAdminNotification,
  sendCorporateInquiryConfirmationEmail,
  sendCorporateActivationEmail,
  escapeHtml,
} from "../lib/email";
import { getPresetByKey, generateDynamicPresetConfig } from "../lib/pickPresets";
import { validatePoolPickTypesConfig } from "../validation/pickConfig";
import { extractPhases } from "../lib/fixture";
import { transitionToActive } from "./poolStateMachine";
import { TOKEN_EXPIRY_MS, CRYPTO_BYTES } from "../lib/constants";
import { ServiceError, type AuditContext } from "./authService";

// ─── Helpers ─────────────────────────────────────────────────

/** Fire-and-forget with error logging. */
function fireAndForget(label: string, promise: Promise<unknown>): void {
  promise.catch((err) => {
    console.error(`[CorporateService] ${label} failed:`, err instanceof Error ? err.message : String(err));
  });
}

/** Verify that the user is a CORPORATE_HOST for the given pool. */
export async function requireCorporateHost(userId: string, poolId: string): Promise<boolean> {
  const member = await prisma.poolMember.findUnique({
    where: { poolId_userId: { poolId, userId } },
    select: { role: true },
  });
  return member?.role === "CORPORATE_HOST";
}

// ─── Types ───────────────────────────────────────────────────

export type SubmitInquiryInput = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  employeeCount?: string;
  message?: string;
  locale: string;
};

export type SubmitInquiryResult = {
  id: string;
  message: string;
};

export type CreateCorporatePoolInput = {
  userId: string;
  companyName: string;
  logoBase64?: string;
  welcomeMessage?: string;
  invitationMessage?: string;
  tournamentInstanceId: string;
  poolName: string;
  poolDescription?: string;
  timeZone?: string;
  deadlineMinutesBeforeKickoff?: number;
  requireApproval?: boolean;
  pickTypesConfig?: string | Record<string, unknown>;
  maxParticipants?: number;
  emails?: string[];
};

export type CreateCorporatePoolResult = {
  pool: Record<string, unknown>;
  organization: { id: string; name: string };
  pendingInvites: number;
};

export type AddEmployeesInput = {
  userId: string;
  poolId: string;
  emails: string[];
};

export type AddEmployeesResult = {
  added: number;
  skipped: number;
  total: number;
};

export type ListEmployeesResult = {
  invites: Array<{
    id: string;
    email: string;
    name: string | null;
    status: string;
    activatedAt: Date | null;
    createdAtUtc: Date;
  }>;
  summary: {
    total: number;
    pending: number;
    sent: number;
    activated: number;
    failed: number;
  };
};

export type SendInvitationsInput = {
  userId: string;
  poolId: string;
};

export type SendInvitationsResult = {
  sent: number;
  activated: number;
  failed: number;
};

export type DeleteEmployeeInput = {
  userId: string;
  poolId: string;
  inviteId: string;
};

// ─── Service Functions ───────────────────────────────────────

// -- Submit Inquiry --

export async function submitInquiry(data: SubmitInquiryInput): Promise<SubmitInquiryResult> {
  const { companyName, contactName, contactEmail, contactPhone, employeeCount, message, locale } = data;

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

  fireAndForget("admin notification (inquiry)", sendAdminNotification({
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
  }));

  fireAndForget("inquiry confirmation email", sendCorporateInquiryConfirmationEmail({
    to: contactEmail,
    contactName,
    companyName,
    locale,
  }));

  return {
    id: inquiry.id,
    message: "Solicitud enviada exitosamente. Nos pondremos en contacto contigo pronto.",
  };
}

// -- Create Corporate Pool --

export async function createCorporatePool(
  data: CreateCorporatePoolInput,
  ctx: AuditContext,
): Promise<CreateCorporatePoolResult> {
  const {
    userId, companyName, logoBase64, welcomeMessage, invitationMessage,
    tournamentInstanceId, poolName, poolDescription,
    timeZone, deadlineMinutesBeforeKickoff, requireApproval,
    pickTypesConfig, maxParticipants, emails,
  } = data;

  // Verify the instance exists
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: tournamentInstanceId } });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);
  if (instance.status === "ARCHIVED") throw new ServiceError("INSTANCE_ARCHIVED", 409);

  // Process pickTypesConfig
  let finalPickTypesConfig: unknown = null;
  if (pickTypesConfig) {
    if (typeof pickTypesConfig === "string") {
      const instancePhases = extractPhases(instance.dataJson);
      let dynamicConfig = instancePhases.length > 0
        ? generateDynamicPresetConfig(pickTypesConfig, instancePhases)
        : null;
      if (!dynamicConfig) {
        const preset = getPresetByKey(pickTypesConfig);
        if (!preset) {
          throw new ServiceError("VALIDATION_ERROR", 400, { message: `Invalid preset key: ${pickTypesConfig}` });
        }
        dynamicConfig = preset.config;
      }
      finalPickTypesConfig = dynamicConfig;
    } else {
      const validation = validatePoolPickTypesConfig(pickTypesConfig as any);
      if (!validation.valid) {
        throw new ServiceError("VALIDATION_ERROR", 400, { message: "Invalid pick types configuration", errors: validation.errors });
      }
      finalPickTypesConfig = pickTypesConfig;
    }
  }

  // Get creator info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true },
  });

  // Transaction: create Organization + Pool + PoolMember + CorporateInvites
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
        createdByUserId: userId,
        scoringPresetKey: "CLASSIC",
        requireApproval: requireApproval ?? false,
        pickTypesConfig: finalPickTypesConfig as Prisma.InputJsonValue,
        fixtureSnapshot: instance.dataJson as Prisma.InputJsonValue,
        organizationId: org.id,
        maxParticipants: maxParticipants ?? 100,
        status: "ACTIVE",
      },
    });

    await tx.poolMember.create({
      data: {
        poolId: pool.id,
        userId,
        role: "CORPORATE_HOST",
        status: "ACTIVE",
      },
    });

    // Create pending invites if emails were provided
    let pendingInvites = 0;
    if (emails && emails.length > 0) {
      const uniqueEmails = [...new Set(emails.map((e) => e.toLowerCase()))];
      for (const email of uniqueEmails) {
        const token = crypto.randomBytes(CRYPTO_BYTES.TOKEN).toString("hex");
        await tx.corporateInvite.create({
          data: {
            poolId: pool.id,
            email,
            activationToken: token,
            activationTokenExpiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS.CORPORATE_INVITE),
            status: "PENDING",
          },
        });
        pendingInvites++;
      }
    }

    return { org, pool, pendingInvites };
  });

  // Admin notification (fire and forget)
  fireAndForget("admin notification (pool created)", sendAdminNotification({
    subject: `Nueva pool corporativa: ${companyName}`,
    type: "corporate_inquiry",
    body: `
      <p><strong>Empresa:</strong> ${companyName}</p>
      <p><strong>Creado por:</strong> ${user?.displayName || "—"} &lt;${user?.email || "—"}&gt;</p>
      <p><strong>Pool:</strong> ${poolName}</p>
      <p><strong>Empleados pendientes:</strong> ${result.pendingInvites}</p>
    `,
  }));

  fireAndForget("audit:corporate-pool-created", writeAuditEvent({
    actorUserId: userId,
    action: "CORPORATE_POOL_CREATED",
    entityType: "Pool",
    entityId: result.pool.id,
    poolId: result.pool.id,
    dataJson: { companyName, organizationId: result.org.id, pendingInvites: result.pendingInvites },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return {
    pool: result.pool as unknown as Record<string, unknown>,
    organization: { id: result.org.id, name: result.org.name },
    pendingInvites: result.pendingInvites,
  };
}

// -- Add Employees --

export async function addEmployees(data: AddEmployeesInput): Promise<AddEmployeesResult> {
  const { userId, poolId, emails } = data;

  if (!(await requireCorporateHost(userId, poolId))) {
    throw new ServiceError("FORBIDDEN", 403, { reason: "CORPORATE_HOST_ONLY" });
  }

  const uniqueEmails = [...new Set(emails.map((e) => e.toLowerCase()))];

  // Find existing invites for this pool
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
    const token = crypto.randomBytes(CRYPTO_BYTES.TOKEN).toString("hex");
    await prisma.corporateInvite.create({
      data: {
        poolId,
        email,
        activationToken: token,
        activationTokenExpiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS.CORPORATE_INVITE),
        status: "PENDING",
      },
    });
    added++;
  }

  const total = await prisma.corporateInvite.count({ where: { poolId } });

  return { added, skipped, total };
}

// -- List Employees --

export async function listEmployees(userId: string, poolId: string): Promise<ListEmployeesResult> {
  if (!(await requireCorporateHost(userId, poolId))) {
    throw new ServiceError("FORBIDDEN", 403, { reason: "CORPORATE_HOST_ONLY" });
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

  return { invites, summary };
}

// -- Send Invitations --

export async function sendInvitations(
  data: SendInvitationsInput,
  ctx: AuditContext,
): Promise<SendInvitationsResult> {
  const { userId, poolId } = data;

  if (!(await requireCorporateHost(userId, poolId))) {
    throw new ServiceError("FORBIDDEN", 403, { reason: "CORPORATE_HOST_ONLY" });
  }

  // Get pool and org for email data
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { organization: { select: { name: true, logoBase64: true, invitationMessage: true } } },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  const companyName = pool.organization?.name || "Empresa";
  const orgLogoBase64 = pool.organization?.logoBase64 || null;
  const orgInvitationMessage = pool.organization?.invitationMessage || null;

  // Find PENDING invites
  const pendingInvites = await prisma.corporateInvite.findMany({
    where: { poolId, status: "PENDING" },
  });

  if (pendingInvites.length === 0) {
    return { sent: 0, activated: 0, failed: 0 };
  }

  let sent = 0;
  let activated = 0;
  let failed = 0;

  for (const invite of pendingInvites) {
    try {
      // Check if email already has an account
      const existingUser = await prisma.user.findUnique({
        where: { email: invite.email },
        select: { id: true, displayName: true },
      });

      if (existingUser) {
        // User already exists — add directly to pool
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

        // Transition pool DRAFT -> ACTIVE if first PLAYER
        await transitionToActive(poolId, existingUser.id).catch((err) =>
          console.error("[CorporateService] transitionToActive error (send-invitations):", err instanceof Error ? err.message : String(err)),
        );

        activated++;
      } else {
        // User does not exist — send activation email
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
          console.error(`[CorporateService] Email failed for ${invite.email}: ${emailResult.error}`);
          await prisma.corporateInvite.update({
            where: { id: invite.id },
            data: { status: "FAILED" },
          });
          failed++;
        }
      }
    } catch (err) {
      console.error(`[CorporateService] Error processing invite ${invite.id}:`, err instanceof Error ? err.message : String(err));
      await prisma.corporateInvite.update({
        where: { id: invite.id },
        data: { status: "FAILED" },
      }).catch(() => {});
      failed++;
    }
  }

  fireAndForget("audit:invitations-sent", writeAuditEvent({
    actorUserId: userId,
    action: "CORPORATE_INVITATIONS_SENT",
    entityType: "Pool",
    entityId: poolId,
    poolId,
    dataJson: { sent, activated, failed, total: pendingInvites.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { sent, activated, failed };
}

// -- Delete Employee --

export async function deleteEmployee(data: DeleteEmployeeInput): Promise<void> {
  const { userId, poolId, inviteId } = data;

  if (!(await requireCorporateHost(userId, poolId))) {
    throw new ServiceError("FORBIDDEN", 403, { reason: "CORPORATE_HOST_ONLY" });
  }

  const invite = await prisma.corporateInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.poolId !== poolId) {
    throw new ServiceError("NOT_FOUND", 404);
  }

  if (invite.status === "ACTIVATED") {
    throw new ServiceError("ALREADY_ACTIVATED", 409);
  }

  await prisma.corporateInvite.delete({ where: { id: inviteId } });
}
