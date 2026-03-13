import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { requirePoolAdmin, HOST_NOTIFICATION_ROLES } from "../lib/roles";
import { makeInviteCode } from "../lib/poolHelpers";
import {
  transitionToActive,
  canJoinPool,
  canCreateInvites,
} from "../services/poolStateMachine";
import { sendPoolInvitationEmail, sendPoolFullNotificationEmail } from "../lib/email";
import { ensurePoolCapacity } from "../lib/poolCapacity";

export const poolInvitesRouter = Router();

const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(500).optional(),
  expiresAtUtc: z.string().datetime().optional(),
});

// POST /pools/:poolId/invites  (solo HOST)
poolInvitesRouter.post("/:poolId/invites", async (req, res) => {
  const { poolId } = req.params;

  const isHostOrCoAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = createInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) return res.status(404).json({ error: "NOT_FOUND" });

  // Validar que el pool permita crear invites según su estado
  if (!canCreateInvites(pool.status as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Cannot create invites in this pool status"
    });
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
      expiresAtUtc: parsed.data.expiresAtUtc ? new Date(parsed.data.expiresAtUtc) : null,
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

  return res.status(201).json(invite);
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
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = sendInviteEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { email, inviteCode } = parsed.data;

  // Obtener datos del pool y del invitador
  const [pool, inviter] = await Promise.all([
    prisma.pool.findUnique({ where: { id: poolId } }),
    prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { displayName: true } }),
  ]);

  if (!pool) return res.status(404).json({ error: "NOT_FOUND", message: "Pool not found" });
  if (!inviter) return res.status(404).json({ error: "NOT_FOUND", message: "Inviter not found" });

  // Verificar que el código de invitación existe y pertenece a este pool
  const invite = await prisma.poolInvite.findUnique({ where: { code: inviteCode } });
  if (!invite || invite.poolId !== poolId) {
    return res.status(400).json({ error: "INVALID_CODE", message: "Invalid invite code for this pool" });
  }

  // Buscar si el email corresponde a un usuario existente (para respetar preferencias)
  const targetUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // Enviar email de invitación
  const emailResult = await sendPoolInvitationEmail({
    to: email,
    userId: targetUser?.id,
    inviterName: inviter.displayName,
    poolName: pool.name,
    inviteCode,
    poolDescription: pool.description ?? undefined,
  });

  if (!emailResult.success && !emailResult.skipped) {
    console.error("Error sending pool invitation email:", emailResult.error);
    return res.status(500).json({
      error: "EMAIL_SEND_FAILED",
    });
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

  return res.json({
    success: true,
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
poolInvitesRouter.post("/join", async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const invite = await prisma.poolInvite.findUnique({
    where: { code: parsed.data.code },
    include: { pool: true },
  });

  if (!invite) return res.status(404).json({ error: "NOT_FOUND", message: "Invite not found" });

  // Validar que el pool acepte nuevos miembros según su estado
  if (!canJoinPool(invite.pool.status as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Pool is not accepting new members"
    });
  }

  if (invite.expiresAtUtc && invite.expiresAtUtc.getTime() < Date.now()) {
    return res.status(409).json({ error: "CONFLICT", message: "Invite expired" });
  }

  if (invite.maxUses != null && invite.uses >= invite.maxUses) {
    return res.status(409).json({ error: "CONFLICT", message: "Invite maxUses reached" });
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

    return { poolId: invite.poolId, status: initialStatus };
  });
  } catch (err: any) {
    if (err.message === "BANNED_FROM_POOL") {
      return res.status(403).json({
        error: "BANNED_FROM_POOL",
      });
    }
    if (err.message === "POOL_FULL") {
      return res.status(409).json({
        error: "POOL_FULL",
      });
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
      dataJson: { code: parsed.data.code },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    // Trigger transición DRAFT → ACTIVE solo si el join fue directo
    await transitionToActive(joined.poolId, req.auth!.userId);
  }

  // Notificar al host si el pool acaba de llenarse
  if (joined.status === "ACTIVE" && invite.pool.maxParticipants) {
    const currentCount = await prisma.poolMember.count({
      where: { poolId: invite.poolId, status: "ACTIVE" },
    });
    if (currentCount >= invite.pool.maxParticipants) {
      const host = await prisma.poolMember.findFirst({
        where: { poolId: invite.poolId, role: { in: [...HOST_NOTIFICATION_ROLES] } },
        include: { user: { select: { email: true, displayName: true } } },
      });
      if (host?.user?.email) {
        sendPoolFullNotificationEmail({
          to: host.user.email,
          hostName: host.user.displayName || "Host",
          poolName: invite.pool.name,
          poolId: invite.poolId,
          maxParticipants: invite.pool.maxParticipants,
        }).catch(() => {}); // fire and forget
      }
    }
  }

  return res.json({
    ok: true,
    poolId: joined.poolId,
    status: joined.status,
    message: joined.status === "PENDING_APPROVAL"
      ? "Join request submitted. Awaiting approval from pool administrator."
      : "Successfully joined the pool."
  });
});
