import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { requirePoolAdmin, isPoolOwner, NON_LEAVABLE_ROLES } from "../lib/roles";
import { transitionToActive } from "../services/poolStateMachine";

export const poolMembersRouter = Router();

// GET /pools/:poolId/members  (solo miembros)
poolMembersRouter.get("/:poolId/members", async (req, res) => {
  const { poolId } = req.params;

  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });
  if (!member) return res.status(403).json({ error: "FORBIDDEN" });

  const members = await prisma.poolMember.findMany({
    where: { poolId },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
    orderBy: { joinedAtUtc: "asc" },
  });

  return res.json(members.map(m => ({
    id: m.id,
    userId: m.userId,
    displayName: m.user.displayName,
    role: m.role,
    status: m.status,
    joinedAtUtc: m.joinedAtUtc,
  })));
});

// GET /pools/:poolId/pending-members  (solo HOST/CO_ADMIN)
poolMembersRouter.get("/:poolId/pending-members", async (req, res) => {
  const { poolId } = req.params;

  const isHostOrCoAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const pendingMembers = await prisma.poolMember.findMany({
    where: {
      poolId,
      status: "PENDING_APPROVAL" // TypeScript no ha recargado tipos, pero Prisma sí lo soporta
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true
        }
      }
    },
    orderBy: { joinedAtUtc: "asc" },
  });

  return res.json({
    ok: true,
    pendingMembers: pendingMembers.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      displayName: m.user.displayName,
      email: m.user.email,
      requestedAt: m.joinedAtUtc,
    }))
  });
});

// POST /pools/:poolId/members/:memberId/approve  (solo HOST/CO_ADMIN)
poolMembersRouter.post("/:poolId/members/:memberId/approve", async (req, res) => {
  const { poolId, memberId } = req.params;

  const isHostOrCoAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } }
  });

  if (!member) return res.status(404).json({ error: "NOT_FOUND", message: "Member not found" });
  if (member.poolId !== poolId) return res.status(403).json({ error: "FORBIDDEN" });

  if (member.status !== ("PENDING_APPROVAL")) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Member is not pending approval"
    });
  }

  await prisma.poolMember.update({
    where: { id: memberId },
    data: {
      status: "ACTIVE",
      approvedByUserId: req.auth!.userId,
      approvedAtUtc: new Date(),
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "JOIN_REQUEST_APPROVED",
    entityType: "Pool",
    entityId: poolId,
    dataJson: {
      approvedUserId: member.userId,
      approvedUsername: member.user.username,
      approvedDisplayName: member.user.displayName,
    },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  // Trigger transición DRAFT → ACTIVE si es el primer jugador activo
  await transitionToActive(poolId, member.userId);

  return res.json({
    ok: true,
    message: "Member approved successfully"
  });
});

// POST /pools/:poolId/members/:memberId/reject  (solo HOST/CO_ADMIN)
const rejectMemberSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

poolMembersRouter.post("/:poolId/members/:memberId/reject", async (req, res) => {
  const { poolId, memberId } = req.params;

  const isHostOrCoAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = rejectMemberSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } }
  });

  if (!member) return res.status(404).json({ error: "NOT_FOUND", message: "Member not found" });
  if (member.poolId !== poolId) return res.status(403).json({ error: "FORBIDDEN" });

  if (member.status !== ("PENDING_APPROVAL")) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Member is not pending approval"
    });
  }

  // Rechazar = eliminar el registro (el usuario puede intentar unirse de nuevo)
  await prisma.poolMember.delete({
    where: { id: memberId },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "JOIN_REQUEST_REJECTED",
    entityType: "Pool",
    entityId: poolId,
    dataJson: {
      rejectedUserId: member.userId,
      rejectedUsername: member.user.username,
      rejectedDisplayName: member.user.displayName,
      reason: parsed.data.reason ?? null,
    },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({
    ok: true,
    message: "Member rejected successfully"
  });
});

const kickMemberSchema = z.object({
  reason: z.string().optional(), // Razón opcional para KICK
});

// POST /pools/:poolId/members/:memberId/kick  (solo HOST/CO_ADMIN)
// Comentario: Expulsa al jugador (LEFT), puede volver a solicitar acceso
poolMembersRouter.post("/:poolId/members/:memberId/kick", async (req, res) => {
  const { poolId, memberId } = req.params;
  const actorUserId = req.auth!.userId;

  const isHostOrCoAdmin = await requirePoolAdmin(actorUserId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = kickMemberSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { reason } = parsed.data;

  // Verificar que el miembro existe y está activo
  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { username: true } } }
  });

  if (!member || member.poolId !== poolId) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Member not found" });
  }

  if (member.status !== "ACTIVE") {
    return res.status(400).json({
      error: "INVALID_STATUS",
      message: "Can only kick active members"
    });
  }

  // No permitir que el host se expulse a sí mismo
  if (member.userId === actorUserId) {
    return res.status(400).json({
      error: "CANNOT_KICK_SELF",
      message: "You cannot kick yourself"
    });
  }

  // No permitir expulsar al creador del pool
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { createdByUserId: true }
  });

  if (member.userId === pool?.createdByUserId) {
    return res.status(400).json({
      error: "CANNOT_KICK_HOST",
      message: "Cannot kick the pool creator"
    });
  }

  // Actualizar el miembro a LEFT
  await prisma.poolMember.update({
    where: { id: memberId },
    data: {
      status: "LEFT",
      leftAtUtc: new Date(),
    },
  });

  // Auditoría
  await writeAuditEvent({
    actorUserId,
    action: "MEMBER_KICKED",
    entityType: "PoolMember",
    entityId: memberId,
    poolId,
    dataJson: {
      kickedUserId: member.userId,
      kickedUsername: member.user.username,
      reason: reason || "No reason provided",
    },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({
    ok: true,
    message: "Member kicked successfully"
  });
});

// POST /pools/:poolId/leave — Player voluntarily leaves a pool
// Hosts and Corporate Hosts cannot leave their own pools.
// The member keeps accumulated points but can no longer submit predictions.
poolMembersRouter.post("/:poolId/leave", async (req, res) => {
  const { poolId } = req.params;
  const userId = req.auth!.userId;

  // Find active membership
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  if (!member) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Not an active member of this pool" });
  }

  // Pool owners cannot leave
  if ((NON_LEAVABLE_ROLES as readonly string[]).includes(member.role)) {
    return res.status(403).json({ error: "HOST_CANNOT_LEAVE", message: "Hosts cannot leave their own pool" });
  }

  // Set status to LEFT
  await prisma.poolMember.update({
    where: { id: member.id },
    data: { status: "LEFT", leftAtUtc: new Date() },
  });

  // Audit
  await writeAuditEvent({
    actorUserId: userId,
    action: "MEMBER_LEFT",
    entityType: "PoolMember",
    entityId: member.id,
    poolId,
    dataJson: { reason: "Voluntary leave" },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({ ok: true, message: "Left pool successfully" });
});

const banMemberSchema = z.object({
  reason: z.string().min(1, "Reason is required"), // Razón OBLIGATORIA para BAN
  deletePicks: z.boolean().optional(), // Si true, elimina los picks del jugador
});

// POST /pools/:poolId/members/:memberId/ban  (solo HOST/CO_ADMIN)
// Comentario: Expulsa PERMANENTEMENTE (BANNED), NO puede volver, opcionalmente borra picks
poolMembersRouter.post("/:poolId/members/:memberId/ban", async (req, res) => {
  const { poolId, memberId } = req.params;
  const actorUserId = req.auth!.userId;

  const isHostOrCoAdmin = await requirePoolAdmin(actorUserId, poolId);
  if (!isHostOrCoAdmin) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = banMemberSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { reason, deletePicks } = parsed.data;

  // Verificar que el miembro existe y está activo
  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { username: true } } }
  });

  if (!member || member.poolId !== poolId) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Member not found" });
  }

  if (member.status !== "ACTIVE") {
    return res.status(400).json({
      error: "INVALID_STATUS",
      message: "Can only ban active members"
    });
  }

  // No permitir que el host se expulse a sí mismo
  if (member.userId === actorUserId) {
    return res.status(400).json({
      error: "CANNOT_BAN_SELF",
      message: "You cannot ban yourself"
    });
  }

  // No permitir expulsar al creador del pool
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { createdByUserId: true }
  });

  if (member.userId === pool?.createdByUserId) {
    return res.status(400).json({
      error: "CANNOT_BAN_HOST",
      message: "Cannot ban the pool creator"
    });
  }

  // Operación atómica: eliminar picks (si aplica) + banear miembro
  let picksDeleted = 0;
  await prisma.$transaction(async (tx) => {
    if (deletePicks) {
      const deleteResult = await tx.prediction.deleteMany({
        where: { poolId, userId: member.userId },
      });
      picksDeleted = deleteResult.count;
    }

    await tx.poolMember.update({
      where: { id: memberId },
      data: {
        status: "BANNED",
        bannedAt: new Date(),
        bannedByUserId: actorUserId,
        banReason: reason,
        banExpiresAt: null, // Siempre permanente
      },
    });
  });

  // Auditoría
  await writeAuditEvent({
    actorUserId,
    action: "MEMBER_BANNED",
    entityType: "PoolMember",
    entityId: memberId,
    poolId,
    dataJson: {
      bannedUserId: member.userId,
      bannedUsername: member.user.username,
      reason,
      deletePicks,
      picksDeleted,
    },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({
    ok: true,
    message: deletePicks
      ? `Member permanently banned and ${picksDeleted} picks deleted`
      : "Member permanently banned"
  });
});

// POST /pools/:poolId/members/:memberId/promote (solo HOST)
// Comentario en español: Promover un PLAYER a CO_ADMIN
const promoteMemberSchema = z.object({
  memberId: z.string().uuid(),
});

poolMembersRouter.post("/:poolId/members/:memberId/promote", async (req, res) => {
  const { poolId, memberId } = req.params;

  // Verificar que el actor es HOST
  const actorMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!actorMembership || !isPoolOwner(actorMembership.role)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      reason: "OWNER_ONLY",
    });
  }

  // Buscar el miembro a promover
  const targetMember = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: true, pool: true },
  });

  if (!targetMember || targetMember.poolId !== poolId) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  if (targetMember.status !== "ACTIVE") {
    return res.status(409).json({
      error: "MEMBER_NOT_ACTIVE",
    });
  }

  if (targetMember.role !== "PLAYER") {
    return res.status(409).json({
      error: "INVALID_ROLE",
    });
  }

  // Promover a CO_ADMIN
  const updated = await prisma.poolMember.update({
    where: { id: memberId },
    data: { role: "CO_ADMIN" },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
  });

  // Auditoría
  await writeAuditEvent({
    action: "MEMBER_PROMOTED_TO_CO_ADMIN",
    actorUserId: req.auth!.userId,
    poolId,
    entityType: "PoolMember",
    entityId: memberId,
    dataJson: {
      targetUserId: targetMember.userId,
      targetUserEmail: targetMember.user.email,
      fromRole: "PLAYER",
      toRole: "CO_ADMIN",
    },
  });

  return res.json({
    success: true,
    member: {
      id: updated.id,
      role: updated.role,
      user: {
        id: updated.user.id,
        email: updated.user.email,
        displayName: updated.user.displayName,
      },
    },
  });
});

// POST /pools/:poolId/members/:memberId/demote (solo HOST)
// Comentario en español: Degradar un CO_ADMIN a PLAYER
poolMembersRouter.post("/:poolId/members/:memberId/demote", async (req, res) => {
  const { poolId, memberId } = req.params;

  // Verificar que el actor es HOST
  const actorMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!actorMembership || !isPoolOwner(actorMembership.role)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      reason: "OWNER_ONLY",
    });
  }

  // Buscar el miembro a degradar
  const targetMember = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: true, pool: true },
  });

  if (!targetMember || targetMember.poolId !== poolId) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  if (targetMember.status !== "ACTIVE") {
    return res.status(409).json({
      error: "MEMBER_NOT_ACTIVE",
    });
  }

  if (targetMember.role !== "CO_ADMIN") {
    return res.status(409).json({
      error: "INVALID_ROLE",
    });
  }

  // Degradar a PLAYER
  const updated = await prisma.poolMember.update({
    where: { id: memberId },
    data: { role: "PLAYER" },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
  });

  // Auditoría
  await writeAuditEvent({
    action: "MEMBER_DEMOTED_FROM_CO_ADMIN",
    actorUserId: req.auth!.userId,
    poolId,
    entityType: "PoolMember",
    entityId: memberId,
    dataJson: {
      targetUserId: targetMember.userId,
      targetUserEmail: targetMember.user.email,
      fromRole: "CO_ADMIN",
      toRole: "PLAYER",
    },
  });

  return res.json({
    success: true,
    member: {
      id: updated.id,
      role: updated.role,
      user: {
        id: updated.user.id,
        email: updated.user.email,
        displayName: updated.user.displayName,
      },
    },
  });
});
