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

/**
 * `EXPIRED` is a derived state — an invite is `EXPIRED` when its
 * native status is `SENT`, the activation token's window has lapsed,
 * and the invitee never completed activation. The DB never stores
 * "EXPIRED" so we don't need a status migration or a cron job; we
 * compute it on read everywhere it's surfaced.
 */
export type DerivedInviteStatus =
  | "PENDING"
  | "SENT"
  | "ACTIVATED"
  | "FAILED"
  | "EXPIRED";

export type ListEmployeesInput = {
  userId: string;
  poolId: string;
  search?: string;
  /** Multi-select. Empty/undefined = no filter. */
  statusFilter?: ReadonlyArray<DerivedInviteStatus>;
  /** 0-based page index. */
  page?: number;
  /** Default 25, max 100. */
  limit?: number;
};

export type ListEmployeesResult = {
  invites: Array<{
    id: string;
    email: string;
    name: string | null;
    /**
     * Status as displayed to the host — may be `EXPIRED` even though
     * the DB row is still `SENT`. Use this for UI; never persist back.
     */
    status: DerivedInviteStatus;
    activatedAt: Date | null;
    createdAtUtc: Date;
    activationTokenExpiresAt: Date;
  }>;
  summary: {
    total: number;
    pending: number;
    sent: number;
    activated: number;
    failed: number;
    expired: number;
  };
  /** Echoed query state for the client to pin its UI to. */
  page: number;
  limit: number;
  totalFiltered: number;
  totalPages: number;
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

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function listEmployees(input: ListEmployeesInput): Promise<ListEmployeesResult> {
  const { userId, poolId } = input;
  if (!(await requireCorporateHost(userId, poolId))) {
    throw new ServiceError("FORBIDDEN", 403, { reason: "CORPORATE_HOST_ONLY" });
  }

  const search = input.search?.trim() || "";
  const statusFilter = input.statusFilter ?? [];
  const page = Math.max(0, Math.floor(input.page ?? 0));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(input.limit ?? DEFAULT_LIMIT)));
  const now = new Date();

  // Build the WHERE clause. The status filter combines native enum
  // values (PENDING/ACTIVATED/FAILED) with the derived EXPIRED branch
  // (status=SENT AND token expired). When both SENT and EXPIRED are
  // selected, we just match all SENT rows.
  const statusConditions = buildStatusConditions(statusFilter, now);
  const searchCondition: Prisma.CorporateInviteWhereInput | null =
    search.length > 0
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        }
      : null;

  const filterClauses: Prisma.CorporateInviteWhereInput[] = [];
  if (statusConditions) filterClauses.push(statusConditions);
  if (searchCondition) filterClauses.push(searchCondition);

  const baseWhere: Prisma.CorporateInviteWhereInput = { poolId };
  const where: Prisma.CorporateInviteWhereInput =
    filterClauses.length > 0 ? { ...baseWhere, AND: filterClauses } : baseWhere;

  // Summary counts cover the WHOLE pool (not the current filter) so
  // the chip badges always show the overall picture even when the
  // host has narrowed the list to "Expirados", say.
  const [statusGroups, expiredCount, totalFiltered, rawInvites] = await Promise.all([
    prisma.corporateInvite.groupBy({
      by: ["status"],
      where: { poolId },
      _count: { _all: true },
    }),
    prisma.corporateInvite.count({
      where: {
        poolId,
        status: "SENT",
        activationTokenExpiresAt: { lt: now },
        activatedUserId: null,
      },
    }),
    prisma.corporateInvite.count({ where }),
    prisma.corporateInvite.findMany({
      where,
      orderBy: { createdAtUtc: "desc" },
      skip: page * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        activatedAt: true,
        createdAtUtc: true,
        activationTokenExpiresAt: true,
        activatedUserId: true,
      },
    }),
  ]);

  const totalSent = statusGroups.find((g) => g.status === "SENT")?._count._all ?? 0;
  const summary = {
    total:
      (statusGroups.find((g) => g.status === "PENDING")?._count._all ?? 0) +
      (statusGroups.find((g) => g.status === "SENT")?._count._all ?? 0) +
      (statusGroups.find((g) => g.status === "ACTIVATED")?._count._all ?? 0) +
      (statusGroups.find((g) => g.status === "FAILED")?._count._all ?? 0),
    pending: statusGroups.find((g) => g.status === "PENDING")?._count._all ?? 0,
    // "sent" in the summary means "sent and still actionable for the
    // recipient" — it excludes the expired tail so the chip badges
    // line up with the rows the host can act on.
    sent: Math.max(0, totalSent - expiredCount),
    activated: statusGroups.find((g) => g.status === "ACTIVATED")?._count._all ?? 0,
    failed: statusGroups.find((g) => g.status === "FAILED")?._count._all ?? 0,
    expired: expiredCount,
  };

  const invites = rawInvites.map((row) => {
    const isExpired =
      row.status === "SENT" &&
      row.activationTokenExpiresAt < now &&
      row.activatedUserId === null;
    const status: DerivedInviteStatus = isExpired
      ? "EXPIRED"
      : (row.status as DerivedInviteStatus);
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      status,
      activatedAt: row.activatedAt,
      createdAtUtc: row.createdAtUtc,
      activationTokenExpiresAt: row.activationTokenExpiresAt,
    };
  });

  const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));

  return {
    invites,
    summary,
    page,
    limit,
    totalFiltered,
    totalPages,
  };
}

/**
 * Translate the host's status filter selection into a Prisma WHERE
 * clause that combines native enum values with the EXPIRED branch.
 * Returns null when no filter is requested.
 */
function buildStatusConditions(
  filter: ReadonlyArray<DerivedInviteStatus>,
  now: Date,
): Prisma.CorporateInviteWhereInput | null {
  if (filter.length === 0) return null;

  const wantsPending = filter.includes("PENDING");
  const wantsActivated = filter.includes("ACTIVATED");
  const wantsFailed = filter.includes("FAILED");
  const wantsSent = filter.includes("SENT");
  const wantsExpired = filter.includes("EXPIRED");

  const branches: Prisma.CorporateInviteWhereInput[] = [];

  if (wantsPending) branches.push({ status: "PENDING" });
  if (wantsActivated) branches.push({ status: "ACTIVATED" });
  if (wantsFailed) branches.push({ status: "FAILED" });

  if (wantsSent && wantsExpired) {
    // Both selected → all SENT rows regardless of expiry.
    branches.push({ status: "SENT" });
  } else if (wantsSent) {
    branches.push({
      status: "SENT",
      OR: [
        { activationTokenExpiresAt: { gte: now } },
        // An already-activated row would have status=ACTIVATED, but
        // be defensive in case future writes leave SENT+activated.
        { activatedUserId: { not: null } },
      ],
    });
  } else if (wantsExpired) {
    branches.push({
      status: "SENT",
      activationTokenExpiresAt: { lt: now },
      activatedUserId: null,
    });
  }

  if (branches.length === 0) return null;
  if (branches.length === 1) return branches[0]!;
  return { OR: branches };
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

// ─── Bulk resend to expired invites ─────────────────────────────────────────

export type BulkResendExpiredInput = {
  userId: string;
  poolId: string;
};

export type BulkResendExpiredResult = {
  attempted: number;
  sent: number;
  failed: number;
  /** True when more expired rows existed than this single call processed. */
  hasMore: boolean;
};

/**
 * Reissue invitation emails to every expired invite in the pool.
 *
 * "Expired" mirrors the derived state used by listEmployees: status=SENT,
 * token expired, never activated. Each row gets a fresh token and a new
 * 30-day expiry — same logic as the single-invite resend, just batched.
 *
 * The HTTP route fronts this with the existing per-host invite send rate
 * limiter (200/hour, 1000/day) so a malicious host can't use this path to
 * blast emails. We additionally cap each call at MAX_BULK_RESEND so a
 * single click on a 1k-pool can't tie up the request for 30+ seconds; the
 * client is told via `hasMore` to call again if needed.
 */
const MAX_BULK_RESEND = 100;

export async function bulkResendExpired(
  data: BulkResendExpiredInput,
): Promise<BulkResendExpiredResult> {
  const { userId, poolId } = data;

  if (!(await requireCorporateHost(userId, poolId))) {
    throw new ServiceError("FORBIDDEN", 403, { reason: "CORPORATE_HOST_ONLY" });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
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
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  const now = new Date();
  const expired = await prisma.corporateInvite.findMany({
    where: {
      poolId,
      status: "SENT",
      activationTokenExpiresAt: { lt: now },
      activatedUserId: null,
    },
    orderBy: { createdAtUtc: "asc" }, // oldest expired first — those are the ones the user has been waiting on the longest
    take: MAX_BULK_RESEND + 1, // +1 to detect hasMore without a separate count
  });

  const hasMore = expired.length > MAX_BULK_RESEND;
  const batch = hasMore ? expired.slice(0, MAX_BULK_RESEND) : expired;

  const companyName = pool.organization?.name || "Empresa";
  const orgLogoBase64 = pool.organization?.logoBase64 || null;
  const orgInvitationMessage = pool.organization?.invitationMessage || null;
  const orgPrimaryColor = pool.organization?.primaryColor || null;
  const orgSecondaryColor = pool.organization?.secondaryColor || null;

  let sent = 0;
  let failed = 0;

  for (const invite of batch) {
    const newToken = crypto.randomBytes(CRYPTO_BYTES.TOKEN).toString("hex");
    const newExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS.CORPORATE_INVITE);

    // Same defensive update as resendInvitation: only rotate the token if the
    // row is still in a resendable state. Skips rows that just got activated
    // by a concurrent request between the SELECT above and this UPDATE.
    const claim = await prisma.corporateInvite.updateMany({
      where: { id: invite.id, status: { in: ["PENDING", "SENT", "FAILED"] } },
      data: {
        status: "PENDING",
        activationToken: newToken,
        activationTokenExpiresAt: newExpiry,
      },
    });
    if (claim.count === 0) continue;

    try {
      const emailResult = await sendCorporateActivationEmail({
        to: invite.email,
        employeeName: invite.name || undefined,
        companyName,
        poolName: pool.name,
        activationToken: newToken,
        logoBase64: orgLogoBase64,
        invitationMessage: orgInvitationMessage,
        primaryColor: orgPrimaryColor,
        secondaryColor: orgSecondaryColor,
      });

      if (emailResult.success) {
        await prisma.corporateInvite.update({
          where: { id: invite.id },
          data: { status: "SENT" },
        });
        sent++;
      } else {
        await prisma.corporateInvite.update({
          where: { id: invite.id },
          data: { status: "FAILED" },
        });
        failed++;
      }
    } catch {
      await prisma.corporateInvite.update({
        where: { id: invite.id },
        data: { status: "FAILED" },
      }).catch(() => {});
      failed++;
    }
  }

  fireAndForget("audit:bulk-resend-expired", writeAuditEvent({
    actorUserId: userId,
    action: "CORPORATE_BULK_RESEND_EXPIRED",
    entityType: "Pool",
    entityId: poolId,
    poolId,
    dataJson: { attempted: batch.length, sent, failed, hasMore },
  }));

  return { attempted: batch.length, sent, failed, hasMore };
}
