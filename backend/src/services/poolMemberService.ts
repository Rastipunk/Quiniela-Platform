/**
 * Pool Member Service — Pure business logic for pool membership management.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Audit context (ip, userAgent) passed as a separate object.
 *   - Side effects (audit) are fire-and-forget but logged on failure.
 */

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { requirePoolAdmin, isPoolOwner, NON_LEAVABLE_ROLES } from "../lib/roles";
import { transitionToActive } from "./poolStateMachine";
import { fireAndForget } from "../lib/asyncHelpers";
import { sendMemberRemovedEmail } from "../lib/email";
import { countryToLocale } from "../lib/constants";
import { ServiceError, type AuditContext } from "./authService";

// ─── Types ───────────────────────────────────────────────────

export type MemberEntry = {
  id: string;
  userId: string;
  displayName: string;
  role: string;
  status: string;
  joinedAtUtc: Date;
};

export type ListMembersResult = {
  members: MemberEntry[];
};

export type PendingMemberEntry = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  email: string;
  requestedAt: Date;
};

export type ListPendingMembersResult = {
  pendingMembers: PendingMemberEntry[];
};

export type ApproveMemberInput = {
  actorUserId: string;
  poolId: string;
  memberId: string;
};

export type RejectMemberInput = {
  actorUserId: string;
  poolId: string;
  memberId: string;
  reason?: string;
};

export type KickMemberInput = {
  actorUserId: string;
  poolId: string;
  memberId: string;
  reason?: string;
};

export type LeaveMemberInput = {
  userId: string;
  poolId: string;
};

export type BanMemberInput = {
  actorUserId: string;
  poolId: string;
  memberId: string;
  reason: string;
  deletePicks?: boolean;
};

export type BanMemberResult = {
  message: string;
  picksDeleted?: number;
};

export type PromoteMemberInput = {
  actorUserId: string;
  poolId: string;
  memberId: string;
};

export type PromoteMemberResult = {
  member: {
    id: string;
    role: string;
    user: { id: string; email: string; displayName: string };
  };
};

export type DemoteMemberInput = {
  actorUserId: string;
  poolId: string;
  memberId: string;
};

export type DemoteMemberResult = {
  member: {
    id: string;
    role: string;
    user: { id: string; email: string; displayName: string };
  };
};

// ─── Service Functions ───────────────────────────────────────

// -- List Members --

export async function listMembers(userId: string, poolId: string): Promise<ListMembersResult> {
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  if (!member) throw new ServiceError("FORBIDDEN", 403);

  const members = await prisma.poolMember.findMany({
    where: { poolId },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
    orderBy: { joinedAtUtc: "asc" },
  });

  return {
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.user.displayName,
      role: m.role,
      status: m.status,
      joinedAtUtc: m.joinedAtUtc,
    })),
  };
}

// -- List Pending Members --

export async function listPendingMembers(actorUserId: string, poolId: string): Promise<ListPendingMembersResult> {
  const isHostOrCoAdmin = await requirePoolAdmin(actorUserId, poolId);
  if (!isHostOrCoAdmin) throw new ServiceError("FORBIDDEN", 403);

  const pendingMembers = await prisma.poolMember.findMany({
    where: {
      poolId,
      status: "PENDING_APPROVAL",
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
        },
      },
    },
    orderBy: { joinedAtUtc: "asc" },
  });

  return {
    pendingMembers: pendingMembers.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      displayName: m.user.displayName,
      email: m.user.email,
      requestedAt: m.joinedAtUtc,
    })),
  };
}

// -- Approve Member --

export async function approveMember(
  data: ApproveMemberInput,
  ctx: AuditContext,
): Promise<{ message: string }> {
  const { actorUserId, poolId, memberId } = data;

  const isHostOrCoAdmin = await requirePoolAdmin(actorUserId, poolId);
  if (!isHostOrCoAdmin) throw new ServiceError("FORBIDDEN", 403);

  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
  });

  if (!member) throw new ServiceError("NOT_FOUND", 404, { message: "Member not found" });
  if (member.poolId !== poolId) throw new ServiceError("FORBIDDEN", 403);

  if (member.status !== "PENDING_APPROVAL") {
    throw new ServiceError("CONFLICT", 409, { message: "Member is not pending approval" });
  }

  await prisma.poolMember.update({
    where: { id: memberId },
    data: {
      status: "ACTIVE",
      approvedByUserId: actorUserId,
      approvedAtUtc: new Date(),
    },
  });

  fireAndForget("audit:member-approved", writeAuditEvent({
    actorUserId,
    action: "JOIN_REQUEST_APPROVED",
    entityType: "Pool",
    entityId: poolId,
    dataJson: {
      approvedUserId: member.userId,
      approvedUsername: member.user.username,
      approvedDisplayName: member.user.displayName,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  // Trigger DRAFT -> ACTIVE transition if first active player
  await transitionToActive(poolId, member.userId);

  return { message: "Member approved successfully" };
}

// -- Reject Member --

export async function rejectMember(
  data: RejectMemberInput,
  ctx: AuditContext,
): Promise<{ message: string }> {
  const { actorUserId, poolId, memberId, reason } = data;

  const isHostOrCoAdmin = await requirePoolAdmin(actorUserId, poolId);
  if (!isHostOrCoAdmin) throw new ServiceError("FORBIDDEN", 403);

  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
  });

  if (!member) throw new ServiceError("NOT_FOUND", 404, { message: "Member not found" });
  if (member.poolId !== poolId) throw new ServiceError("FORBIDDEN", 403);

  if (member.status !== "PENDING_APPROVAL") {
    throw new ServiceError("CONFLICT", 409, { message: "Member is not pending approval" });
  }

  // Reject = delete the record (user can try to join again)
  await prisma.poolMember.delete({
    where: { id: memberId },
  });

  fireAndForget("audit:member-rejected", writeAuditEvent({
    actorUserId,
    action: "JOIN_REQUEST_REJECTED",
    entityType: "Pool",
    entityId: poolId,
    dataJson: {
      rejectedUserId: member.userId,
      rejectedUsername: member.user.username,
      rejectedDisplayName: member.user.displayName,
      reason: reason ?? null,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { message: "Member rejected successfully" };
}

// -- Kick Member --

export async function kickMember(
  data: KickMemberInput,
  ctx: AuditContext,
): Promise<{ message: string }> {
  const { actorUserId, poolId, memberId, reason } = data;

  const isHostOrCoAdmin = await requirePoolAdmin(actorUserId, poolId);
  if (!isHostOrCoAdmin) throw new ServiceError("FORBIDDEN", 403);

  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { username: true, email: true, displayName: true, country: true } } },
  });

  if (!member || member.poolId !== poolId) {
    throw new ServiceError("NOT_FOUND", 404, { message: "Member not found" });
  }

  if (member.status !== "ACTIVE") {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "Can only kick active members" });
  }

  // Cannot kick yourself
  if (member.userId === actorUserId) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "You cannot kick yourself" });
  }

  // Cannot kick pool creator
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { createdByUserId: true, name: true },
  });

  if (member.userId === pool?.createdByUserId) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "Cannot kick the pool creator" });
  }

  // Set member to LEFT
  await prisma.poolMember.update({
    where: { id: memberId },
    data: {
      status: "LEFT",
      leftAtUtc: new Date(),
    },
  });

  fireAndForget("audit:member-kicked", writeAuditEvent({
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
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  if (member.user.email && pool?.name) {
    fireAndForget("kicked-email", sendMemberRemovedEmail({
      to: member.user.email,
      displayName: member.user.displayName || member.user.username,
      poolName: pool.name,
      reason: reason || undefined,
      type: "kicked",
      locale: countryToLocale(member.user.country),
    }));
  }

  return { message: "Member kicked successfully" };
}

// -- Leave Member (voluntary) --

export async function leaveMember(
  data: LeaveMemberInput,
  ctx: AuditContext,
): Promise<{ message: string }> {
  const { userId, poolId } = data;

  // Find active membership
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  if (!member) {
    throw new ServiceError("NOT_FOUND", 404, { message: "Not an active member of this pool" });
  }

  // Pool owners cannot leave
  if ((NON_LEAVABLE_ROLES as readonly string[]).includes(member.role)) {
    throw new ServiceError("FORBIDDEN", 403, { message: "Hosts cannot leave their own pool" });
  }

  // Set status to LEFT
  await prisma.poolMember.update({
    where: { id: member.id },
    data: { status: "LEFT", leftAtUtc: new Date() },
  });

  fireAndForget("audit:member-left", writeAuditEvent({
    actorUserId: userId,
    action: "MEMBER_LEFT",
    entityType: "PoolMember",
    entityId: member.id,
    poolId,
    dataJson: { reason: "Voluntary leave" },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { message: "Left pool successfully" };
}

// -- Ban Member --

export async function banMember(
  data: BanMemberInput,
  ctx: AuditContext,
): Promise<BanMemberResult> {
  const { actorUserId, poolId, memberId, reason, deletePicks } = data;

  const isHostOrCoAdmin = await requirePoolAdmin(actorUserId, poolId);
  if (!isHostOrCoAdmin) throw new ServiceError("FORBIDDEN", 403);

  const member = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { username: true, email: true, displayName: true, country: true } } },
  });

  if (!member || member.poolId !== poolId) {
    throw new ServiceError("NOT_FOUND", 404, { message: "Member not found" });
  }

  if (member.status !== "ACTIVE") {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "Can only ban active members" });
  }

  // Cannot ban yourself
  if (member.userId === actorUserId) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "You cannot ban yourself" });
  }

  // Cannot ban pool creator
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { createdByUserId: true, name: true },
  });

  if (member.userId === pool?.createdByUserId) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "Cannot ban the pool creator" });
  }

  // Atomic operation: delete picks (if requested) + ban member
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
        banExpiresAt: null, // Always permanent
      },
    });
  });

  fireAndForget("audit:member-banned", writeAuditEvent({
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
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  if (member.user.email && pool?.name) {
    fireAndForget("banned-email", sendMemberRemovedEmail({
      to: member.user.email,
      displayName: member.user.displayName || member.user.username,
      poolName: pool.name,
      reason,
      type: "banned",
      locale: countryToLocale(member.user.country),
    }));
  }

  return {
    message: deletePicks
      ? `Member permanently banned and ${picksDeleted} picks deleted`
      : "Member permanently banned",
    picksDeleted: deletePicks ? picksDeleted : undefined,
  };
}

// -- Promote Member --

export async function promoteMember(
  data: PromoteMemberInput,
  ctx: AuditContext,
): Promise<PromoteMemberResult> {
  const { actorUserId, poolId, memberId } = data;

  // Verify actor is HOST (owner)
  const actorMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: actorUserId, status: "ACTIVE" },
  });

  if (!actorMembership || !isPoolOwner(actorMembership.role)) {
    throw new ServiceError("OWNER_ONLY", 403);
  }

  // Find the member to promote
  const targetMember = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: true, pool: true },
  });

  if (!targetMember || targetMember.poolId !== poolId) {
    throw new ServiceError("NOT_FOUND", 404);
  }

  if (targetMember.status !== "ACTIVE") {
    throw new ServiceError("MEMBER_NOT_ACTIVE", 409);
  }

  if (targetMember.role !== "PLAYER") {
    throw new ServiceError("INVALID_ROLE", 409);
  }

  // Promote to CO_ADMIN
  const updated = await prisma.poolMember.update({
    where: { id: memberId },
    data: { role: "CO_ADMIN" },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
  });

  fireAndForget("audit:member-promoted", writeAuditEvent({
    action: "MEMBER_PROMOTED_TO_CO_ADMIN",
    actorUserId,
    poolId,
    entityType: "PoolMember",
    entityId: memberId,
    dataJson: {
      targetUserId: targetMember.userId,
      targetUserEmail: targetMember.user.email,
      fromRole: "PLAYER",
      toRole: "CO_ADMIN",
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return {
    member: {
      id: updated.id,
      role: updated.role,
      user: {
        id: updated.user.id,
        email: updated.user.email,
        displayName: updated.user.displayName,
      },
    },
  };
}

// -- Demote Member --

export async function demoteMember(
  data: DemoteMemberInput,
  ctx: AuditContext,
): Promise<DemoteMemberResult> {
  const { actorUserId, poolId, memberId } = data;

  // Verify actor is HOST (owner)
  const actorMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: actorUserId, status: "ACTIVE" },
  });

  if (!actorMembership || !isPoolOwner(actorMembership.role)) {
    throw new ServiceError("OWNER_ONLY", 403);
  }

  // Find the member to demote
  const targetMember = await prisma.poolMember.findUnique({
    where: { id: memberId },
    include: { user: true, pool: true },
  });

  if (!targetMember || targetMember.poolId !== poolId) {
    throw new ServiceError("NOT_FOUND", 404);
  }

  if (targetMember.status !== "ACTIVE") {
    throw new ServiceError("MEMBER_NOT_ACTIVE", 409);
  }

  if (targetMember.role !== "CO_ADMIN") {
    throw new ServiceError("INVALID_ROLE", 409);
  }

  // Demote to PLAYER
  const updated = await prisma.poolMember.update({
    where: { id: memberId },
    data: { role: "PLAYER" },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
  });

  fireAndForget("audit:member-demoted", writeAuditEvent({
    action: "MEMBER_DEMOTED_FROM_CO_ADMIN",
    actorUserId,
    poolId,
    entityType: "PoolMember",
    entityId: memberId,
    dataJson: {
      targetUserId: targetMember.userId,
      targetUserEmail: targetMember.user.email,
      fromRole: "CO_ADMIN",
      toRole: "PLAYER",
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return {
    member: {
      id: updated.id,
      role: updated.role,
      user: {
        id: updated.user.id,
        email: updated.user.email,
        displayName: updated.user.displayName,
      },
    },
  };
}
