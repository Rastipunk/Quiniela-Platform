import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { requirePoolAdmin } from "../lib/roles";
import { makeInviteCode } from "../lib/poolHelpers";
import {
  transitionToActive,
  canJoinPool,
  canCreateInvites,
} from "../services/poolStateMachine";
import { sendPoolInvitationEmail } from "../lib/email";
import { ensurePoolCapacity, checkAndNotifyCapacityThresholds } from "../lib/poolCapacity";
import { TOKEN_EXPIRY_MS, countryToLocale } from "../lib/constants";
import { poolJoinLimiter } from "../middleware/rateLimit";
import { sendOk, sendCreated, sendBadRequest, sendForbidden, sendNotFound, sendConflict, sendInternal } from "../lib/apiResponse";
import { fireAndForget } from "../lib/asyncHelpers";
import { sendGa4Event } from "../lib/ga4";
import { sendCapiEvent } from "../lib/metaCapi";

export const poolInvitesRouter = Router();

const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(500).optional(),
  expiresAtUtc: z.string().datetime().optional(),
});

// POST /pools/:poolId/invites  (solo HOST)
poolInvitesRouter.post("/:poolId/invites", async (req, res) => {
  const { poolId } = req.params;

  const isHostOrCoAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return sendForbidden(res, "FORBIDDEN");

  const parsed = createInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) return sendNotFound(res, "NOT_FOUND");

  // Validar que el pool permita crear invites según su estado
  if (!canCreateInvites(pool.status)) {
    return sendConflict(res, "CONFLICT", { message: "Cannot create invites in this pool status" });
  }

  // Comentario en español: generamos code y reintentamos si colisiona (muy raro)
  let code = makeInviteCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.poolInvite.findUnique({ where: { code } });
    if (!exists) break;
    code = makeInviteCode();
  }

  const invite = await prisma.poolInvite.create({
    data: {
      poolId,
      code,
      createdByUserId: req.auth!.userId,
      maxUses: parsed.data.maxUses ?? null,
      expiresAtUtc: parsed.data.expiresAtUtc
        ? new Date(parsed.data.expiresAtUtc)
        : new Date(Date.now() + TOKEN_EXPIRY_MS.POOL_INVITE_DEFAULT), // Default: 30 days
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "POOL_INVITE_CREATED",
    entityType: "PoolInvite",
    entityId: invite.id,
    dataJson: { poolId, code },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return sendCreated(res, invite as unknown as Record<string, unknown>);
});

// POST /pools/:poolId/send-invite-email
// Envía una invitación por email a una persona específica
const sendInviteEmailSchema = z.object({
  email: z.string().email(),
  inviteCode: z.string().min(6).max(64),
});

poolInvitesRouter.post("/:poolId/send-invite-email", async (req, res) => {
  const { poolId } = req.params;

  const isHostOrCoAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return sendForbidden(res, "FORBIDDEN");

  const parsed = sendInviteEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  const { email, inviteCode } = parsed.data;

  // Obtener datos del pool y del invitador
  const [pool, inviter] = await Promise.all([
    prisma.pool.findUnique({ where: { id: poolId } }),
    prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { displayName: true } }),
  ]);

  if (!pool) return sendNotFound(res, "NOT_FOUND", { message: "Pool not found" });
  if (!inviter) return sendNotFound(res, "NOT_FOUND", { message: "Inviter not found" });

  // Verificar que el código de invitación existe y pertenece a este pool
  const invite = await prisma.poolInvite.findUnique({ where: { code: inviteCode } });
  if (!invite || invite.poolId !== poolId) {
    return sendBadRequest(res, "INVALID_CODE", { message: "Invalid invite code for this pool" });
  }

  // Buscar si el email corresponde a un usuario existente (para respetar preferencias + locale)
  const targetUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, country: true },
  });

  // Enviar email de invitación
  const emailResult = await sendPoolInvitationEmail({
    to: email,
    userId: targetUser?.id,
    inviterName: inviter.displayName,
    poolName: pool.name,
    inviteCode,
    poolDescription: pool.description ?? undefined,
    locale: countryToLocale(targetUser?.country),
  });

  if (!emailResult.success && !emailResult.skipped) {
    console.error("Error sending pool invitation email:", emailResult.error);
    return sendInternal(res, "EMAIL_SEND_FAILED");
  }

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "POOL_INVITE_EMAIL_SENT",
    entityType: "Pool",
    entityId: poolId,
    dataJson: { email, inviteCode, skipped: emailResult.skipped },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return sendOk(res, {
    message: emailResult.skipped
      ? "El email no fue enviado porque el usuario tiene deshabilitadas las notificaciones."
      : "Invitación enviada exitosamente.",
    skipped: emailResult.skipped,
  });
});

const joinSchema = z.object({
  code: z.string().min(6).max(64),
});

// POST /pools/join  (por invite code)
poolInvitesRouter.post("/join", poolJoinLimiter, async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  const invite = await prisma.poolInvite.findUnique({
    where: { code: parsed.data.code },
    include: { pool: true },
  });

  if (!invite) return sendNotFound(res, "NOT_FOUND", { message: "Invite not found" });

  // Validar que el pool acepte nuevos miembros según su estado
  if (!canJoinPool(invite.pool.status)) {
    return sendConflict(res, "CONFLICT", { message: "Pool is not accepting new members" });
  }

  if (invite.expiresAtUtc && invite.expiresAtUtc.getTime() < Date.now()) {
    return sendConflict(res, "CONFLICT", { message: "Invite expired" });
  }

  if (invite.maxUses != null && invite.uses >= invite.maxUses) {
    return sendConflict(res, "CONFLICT", { message: "Invite maxUses reached" });
  }

  // Determinar el status inicial según si requireApproval está activado
  const initialStatus = invite.pool.requireApproval ? ("PENDING_APPROVAL" as const) : ("ACTIVE" as const);

  let joined;
  try {
    joined = await prisma.$transaction(async (tx) => {
      // Comentario en español: si ya es miembro, no duplicamos
      const existing = await tx.poolMember.findFirst({
        where: { poolId: invite.poolId, userId: req.auth!.userId },
      });

      // CRITICAL: Si el usuario está BANNED, rechazar el join inmediatamente
      if (existing && existing.status === "BANNED") {
        throw new Error("BANNED_FROM_POOL");
      }

    // Referral graph capture: fire only for first-time members. LEFT
    // re-joins re-use the existing membership and MUST NOT overwrite the
    // user's original referrer — a returning user is not a new referral.
    let isFirstTimeReferral = false;

    if (!existing) {
      // Lock Pool row + verify capacity (prevents race condition)
      await ensurePoolCapacity(tx, invite.poolId, invite.pool.maxParticipants);
      await tx.poolMember.create({
        data: {
          poolId: invite.poolId,
          userId: req.auth!.userId,
          role: "PLAYER",
          status: initialStatus,
        },
      });
      isFirstTimeReferral = true;
    } else if (existing.status === "LEFT") {
      // Verify capacity before reactivating (LEFT user doesn't count toward capacity)
      await ensurePoolCapacity(tx, invite.poolId, invite.pool.maxParticipants);
      await tx.poolMember.update({
        where: { id: existing.id },
        data: {
          status: initialStatus,
          leftAtUtc: null,
          rejectionReason: null,
          approvedByUserId: null,
          approvedAtUtc: null
        },
      });
    } else if (existing.status === "PENDING_APPROVAL") {
      // Ya tiene una solicitud pendiente
      return { poolId: invite.poolId, status: "PENDING_APPROVAL" };
    } else {
      // Ya es miembro activo o baneado
      return { poolId: invite.poolId, status: existing.status };
    }

    await tx.poolInvite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } },
    });

    let referrerUserId: string | null = null;
    if (isFirstTimeReferral) {
      // Record the FIRST redeemer on the invite (multi-use invites keep
      // the headline referrer, later joiners are still enumerable from
      // the audit log). updateMany with `acceptedByUserId: null` makes
      // the write atomic against concurrent redeemers.
      await tx.poolInvite.updateMany({
        where: { id: invite.id, acceptedByUserId: null },
        data: { acceptedByUserId: req.auth!.userId, acceptedAtUtc: new Date() },
      });

      // Populate User.referredByUserId only if still null AND the
      // inviter is not the joiner themselves (self-invites should not
      // count as referrals for cohort analysis).
      if (invite.createdByUserId !== req.auth!.userId) {
        const updated = await tx.user.updateMany({
          where: { id: req.auth!.userId, referredByUserId: null },
          data: { referredByUserId: invite.createdByUserId },
        });
        if (updated.count > 0) referrerUserId = invite.createdByUserId;
      }
    }

    return { poolId: invite.poolId, status: initialStatus, referrerUserId };
  });
  } catch (err: any) {
    if (err.message === "BANNED_FROM_POOL") {
      return sendForbidden(res, "BANNED_FROM_POOL");
    }
    if (err.message === "POOL_FULL") {
      return sendConflict(res, "POOL_FULL");
    }
    throw err; // Re-throw if it's another error
  }

  // Auditoría según el status inicial
  if (joined.status === "PENDING_APPROVAL") {
    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "JOIN_REQUEST_SUBMITTED",
      entityType: "Pool",
      entityId: joined.poolId,
      dataJson: { code: parsed.data.code },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });
  } else if (joined.status === "ACTIVE") {
    await writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "POOL_JOINED",
      entityType: "Pool",
      entityId: joined.poolId,
      dataJson: {
        code: parsed.data.code,
        referrerUserId: joined.referrerUserId,
      },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    // Referral attribution fan-out: server-side analytics emission for
    // any ACTIVE join that came from someone else's invite. Custom event
    // on both GA4 and Meta CAPI; it's a signal, not a standard purchase.
    if (joined.referrerUserId) {
      fireAndForget("ga4mp:referral_conversion", sendGa4Event({
        userId: req.auth!.userId,
        ipOverride: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
        events: [{
          name: "referral_conversion",
          params: {
            referrer_user_id: joined.referrerUserId,
            pool_id: joined.poolId,
            invite_code: parsed.data.code,
          },
        }],
      }));
      fireAndForget("capi:referral_conversion", sendCapiEvent({
        eventName: "Lead",
        userData: { externalId: req.auth!.userId },
        customData: {
          content_name: "referral_conversion",
          referrer_user_id: joined.referrerUserId,
          invite_code: parsed.data.code,
        },
      }));
    }

    // Trigger transición DRAFT → ACTIVE solo si el join fue directo
    await transitionToActive(joined.poolId, req.auth!.userId);

  }

  // Threshold notifications (warning at configurable %, full at 100%) — runs
  // for both ACTIVE and PENDING_APPROVAL joins because both count toward capacity.
  await checkAndNotifyCapacityThresholds({
    poolId: invite.poolId,
    actorUserId: req.auth!.userId,
  });

  return sendOk(res, {
    poolId: joined.poolId,
    status: joined.status,
    message: joined.status === "PENDING_APPROVAL"
      ? "Join request submitted. Awaiting approval from pool administrator."
      : "Successfully joined the pool."
  });
});
