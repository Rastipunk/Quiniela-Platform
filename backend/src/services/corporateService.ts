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
import { fireAndForget } from "../lib/asyncHelpers";
import { isValidTimezone } from "../lib/timezone";
import { ServiceError, type AuditContext } from "./authService";
import { CORPORATE_FREE_LIMIT } from "../lib/pricing";

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
  country?: string;
  currency?: "COP" | "USD";
  poolsConfig?: number[];
  numberOfPools?: number;
  slotsPerPool?: number;
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
  primaryColor?: string;
  secondaryColor?: string;
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
  const {
    companyName, contactName, contactEmail, contactPhone, employeeCount,
    country, currency, poolsConfig, message, locale,
  } = data;

  // When the quote panel sends poolsConfig, treat it as the source of
  // truth: derive numberOfPools from its length, and only set the legacy
  // scalar slotsPerPool when every pool has the same size (so back-compat
  // reports still get a meaningful value).
  let numberOfPools = data.numberOfPools ?? null;
  let slotsPerPool = data.slotsPerPool ?? null;
  let poolsConfigJson: string | null = null;

  if (poolsConfig && poolsConfig.length > 0) {
    numberOfPools = poolsConfig.length;
    const allEqual = poolsConfig.every((n) => n === poolsConfig[0]);
    slotsPerPool = allEqual ? (poolsConfig[0] as number) : null;
    poolsConfigJson = JSON.stringify(poolsConfig);
  }

  const inquiry = await prisma.organizationInquiry.create({
    data: {
      companyName,
      contactName,
      contactEmail,
      contactPhone: contactPhone || null,
      employeeCount: employeeCount || null,
      country: country || null,
      currency: currency || null,
      numberOfPools,
      slotsPerPool,
      poolsConfigJson,
      message: message || null,
      locale,
    },
  });

  // Build a scannable breakdown for the admin email.
  let quoteSummary = "";
  if (poolsConfig && poolsConfig.length > 0) {
    const total = poolsConfig.reduce((sum, n) => sum + n, 0);
    if (poolsConfig.length === 1) {
      quoteSummary = `<p><strong>Cotización solicitada:</strong> 1 polla × ${poolsConfig[0]} cupos</p>`;
    } else {
      const lines = poolsConfig
        .map((n, i) => `<li>Polla ${i + 1}: ${n} cupos</li>`)
        .join("");
      quoteSummary = `
        <p><strong>Cotización solicitada:</strong> ${poolsConfig.length} pollas, ${total} cupos totales</p>
        <ul style="margin: 4px 0 12px 20px; padding: 0;">${lines}</ul>
      `;
    }
  } else if (numberOfPools && slotsPerPool) {
    quoteSummary = `<p><strong>Cotización solicitada:</strong> ${numberOfPools} pollas × ${slotsPerPool} cupos = ${numberOfPools * slotsPerPool} cupos totales</p>`;
  }

  fireAndForget("admin notification (inquiry)", sendAdminNotification({
    subject: `${escapeHtml(companyName)} — ${escapeHtml(contactName)}`,
    type: "corporate_inquiry",
    body: `
      <p><strong>Empresa:</strong> ${escapeHtml(companyName)}</p>
      <p><strong>Contacto:</strong> ${escapeHtml(contactName)} &lt;${escapeHtml(contactEmail)}&gt;</p>
      ${contactPhone ? `<p><strong>Teléfono:</strong> ${escapeHtml(contactPhone)}</p>` : ""}
      ${country ? `<p><strong>País:</strong> ${escapeHtml(country)}</p>` : ""}
      ${quoteSummary}
      ${currency ? `<p><strong>Moneda:</strong> ${escapeHtml(currency)}</p>` : ""}
      ${employeeCount ? `<p><strong>Empleados (legacy):</strong> ${employeeCount}</p>` : ""}
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
    primaryColor, secondaryColor,
    tournamentInstanceId, poolName, poolDescription,
    timeZone, deadlineMinutesBeforeKickoff, requireApproval,
    pickTypesConfig, maxParticipants, emails,
  } = data;

  // Validate timezone if provided
  if (timeZone && !isValidTimezone(timeZone)) {
    throw new ServiceError("INVALID_TIMEZONE", 400);
  }

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
        welcomeMessage: welcomeMessage ? escapeHtml(welcomeMessage) : null,
        invitationMessage: invitationMessage ? escapeHtml(invitationMessage) : null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
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
        // SECURITY GATE: pool is always created at the corporate free tier
        // (CORPORATE_FREE_LIMIT, default 2). When the wizard requested a paid
        // tier, it captures the requested value in PoolPayment.toCapacity and
        // initiates checkout immediately after creation. On confirmed payment,
        // paymentService.handleOrderPaid raises Pool.maxParticipants to the
        // paid value. Without this cap, a malicious caller could POST any
        // maxParticipants and create a high-capacity pool without paying —
        // the wizard's pre-payment value is treated as "intent", never trust.
        maxParticipants: Math.min(maxParticipants ?? CORPORATE_FREE_LIMIT, CORPORATE_FREE_LIMIT),
        status: "DRAFT",
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
    include: { organization: { select: { name: true, logoBase64: true, invitationMessage: true, primaryColor: true, secondaryColor: true } } },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  const companyName = pool.organization?.name || "Empresa";
  const orgLogoBase64 = pool.organization?.logoBase64 || null;
  const orgInvitationMessage = pool.organization?.invitationMessage || null;
  const orgPrimaryColor = pool.organization?.primaryColor || null;
  const orgSecondaryColor = pool.organization?.secondaryColor || null;

  // Find PENDING invites
  const pendingInvites = await prisma.corporateInvite.findMany({
    where: { poolId, status: "PENDING" },
  });

  if (pendingInvites.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const invite of pendingInvites) {
    // Atomic claim: only this caller proceeds with sending if the invite is
    // still PENDING. If two `sendInvitations` calls land at the same time
    // (host double-clicked, or a tab restored), both findMany() see the same
    // PENDING set, but only the first updateMany WHERE status=PENDING flips
    // each row — the second sees count=0 and silently skips, so each
    // employee receives exactly one email.
    // Optimistically marking as SENT before the email is the standard
    // claim-then-confirm pattern: if the email actually fails, we revert to
    // FAILED in the catch path. The window where "SENT" is set but the email
    // hasn't actually left is the same window the previous code had between
    // sendEmail and update — no worse, but now race-safe.
    const claim = await prisma.corporateInvite.updateMany({
      where: { id: invite.id, status: "PENDING" },
      data: { status: "SENT" },
    });
    if (claim.count === 0) continue; // another concurrent call already claimed this invite

    try {
      // Always send the invitation email — even if the user already has an account.
      // The activation link handles both cases (new account creation or existing user joining).
      // This ensures every invitee sees the branded welcome experience.
      const emailResult = await sendCorporateActivationEmail({
        to: invite.email,
        employeeName: invite.name || undefined,
        companyName,
        poolName: pool.name,
        activationToken: invite.activationToken,
        logoBase64: orgLogoBase64,
        invitationMessage: orgInvitationMessage,
        primaryColor: orgPrimaryColor,
        secondaryColor: orgSecondaryColor,
      });

      if (emailResult.success) {
        sent++; // status already SENT from the claim above
      } else {
        console.error(`[CorporateService] Email failed for ${invite.email}: ${emailResult.error}`);
        await prisma.corporateInvite.update({
          where: { id: invite.id },
          data: { status: "FAILED" },
        });
        failed++;
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
    dataJson: { sent, failed, total: pendingInvites.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { sent, failed };
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

// ─── Resend single invitation ───────────────────────────────────────────────

export type ResendInvitationInput = {
  userId: string;
  poolId: string;
  inviteId: string;
};

export type ResendInvitationResult = {
  email: string;
  status: "SENT" | "FAILED";
};

/**
 * Resend an activation email for a single corporate invitation. Useful when
 * the original email was lost (spam, deleted, typo at activation time, etc.).
 *
 * Generates a FRESH activation token and 30-day expiry — the previous token
 * is invalidated, so an old email forwarded to the wrong inbox can no longer
 * be used after a resend was requested. Refuses to resend if the invite has
 * already been ACTIVATED (the user has an account, no further invite makes sense).
 */
export async function resendInvitation(
  data: ResendInvitationInput,
): Promise<ResendInvitationResult> {
  const { userId, poolId, inviteId } = data;

  if (!(await requireCorporateHost(userId, poolId))) {
    throw new ServiceError("FORBIDDEN", 403, { reason: "CORPORATE_HOST_ONLY" });
  }

  const invite = await prisma.corporateInvite.findUnique({
    where: { id: inviteId },
    include: {
      pool: {
        include: {
          organization: {
            select: {
              name: true,
              logoBase64: true,
              invitationMessage: true,
              primaryColor: true,
              secondaryColor: true,
            },
          },
        },
      },
    },
  });
  if (!invite || invite.poolId !== poolId) {
    throw new ServiceError("NOT_FOUND", 404);
  }
  if (invite.status === "ACTIVATED") {
    throw new ServiceError("ALREADY_ACTIVATED", 409);
  }

  // Fresh token + reset expiry. Atomically rotate so a concurrent activation
  // race against the OLD token can't slip through after the resend was issued.
  const newToken = crypto.randomBytes(CRYPTO_BYTES.TOKEN).toString("hex");
  const newExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS.CORPORATE_INVITE);

  // Optimistic update — only proceed if the invite is still in a resendable
  // state (anything except ACTIVATED). If it just got activated by a
  // concurrent request, surface ALREADY_ACTIVATED rather than send a useless
  // email with a token that the activation flow will reject.
  const claim = await prisma.corporateInvite.updateMany({
    where: { id: inviteId, status: { in: ["PENDING", "SENT", "FAILED"] } },
    data: {
      status: "PENDING",
      activationToken: newToken,
      activationTokenExpiresAt: newExpiry,
    },
  });
  if (claim.count === 0) {
    throw new ServiceError("ALREADY_ACTIVATED", 409);
  }

  const companyName = invite.pool.organization?.name || "Empresa";
  const orgLogoBase64 = invite.pool.organization?.logoBase64 || null;
  const orgInvitationMessage = invite.pool.organization?.invitationMessage || null;
  const orgPrimaryColor = invite.pool.organization?.primaryColor || null;
  const orgSecondaryColor = invite.pool.organization?.secondaryColor || null;

  const emailResult = await sendCorporateActivationEmail({
    to: invite.email,
    employeeName: invite.name || undefined,
    companyName,
    poolName: invite.pool.name,
    activationToken: newToken,
    logoBase64: orgLogoBase64,
    invitationMessage: orgInvitationMessage,
    primaryColor: orgPrimaryColor,
    secondaryColor: orgSecondaryColor,
  });

  if (!emailResult.success) {
    await prisma.corporateInvite.update({
      where: { id: inviteId },
      data: { status: "FAILED" },
    });
    return { email: invite.email, status: "FAILED" };
  }

  await prisma.corporateInvite.update({
    where: { id: inviteId },
    data: { status: "SENT" },
  });

  fireAndForget("audit:invitation-resent", writeAuditEvent({
    actorUserId: userId,
    action: "CORPORATE_INVITATION_RESENT",
    entityType: "CorporateInvite",
    entityId: inviteId,
    poolId,
    dataJson: { email: invite.email },
  }));

  return { email: invite.email, status: "SENT" };
}
