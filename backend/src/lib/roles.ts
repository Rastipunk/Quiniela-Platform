import { PoolMemberRole } from "@prisma/client";
import { prisma } from "../db";

// ─── Role Groups ──────────────────────────────────────────────
// Single source of truth for role-based access control across the app.
// When a new role is added, update these arrays and all checks propagate automatically.

/** Roles that can administer a pool: manage members, publish results, send invites, etc. */
export const POOL_ADMIN_ROLES: readonly PoolMemberRole[] = [
  PoolMemberRole.HOST,
  PoolMemberRole.CO_ADMIN,
  PoolMemberRole.CORPORATE_HOST,
] as const;

/** Roles that own a pool: change settings, advance phases, archive, promote/demote members. */
export const POOL_OWNER_ROLES: readonly PoolMemberRole[] = [
  PoolMemberRole.HOST,
  PoolMemberRole.CORPORATE_HOST,
] as const;

/** Roles that cannot leave a pool (they are the owner). */
export const NON_LEAVABLE_ROLES: readonly PoolMemberRole[] = POOL_OWNER_ROLES;

/** Roles to notify when a pool reaches capacity. */
export const HOST_NOTIFICATION_ROLES: readonly PoolMemberRole[] = POOL_OWNER_ROLES;

// ─── Role Predicates ──────────────────────────────────────────

/** Returns true if the given role has admin-level permissions on a pool. */
export function isPoolAdmin(role: PoolMemberRole): boolean {
  return (POOL_ADMIN_ROLES as readonly PoolMemberRole[]).includes(role);
}

/** Returns true if the given role is a pool owner (HOST or CORPORATE_HOST). */
export function isPoolOwner(role: PoolMemberRole): boolean {
  return (POOL_OWNER_ROLES as readonly PoolMemberRole[]).includes(role);
}

// ─── DB-Backed Checks ─────────────────────────────────────────

/**
 * Verifies the user is an active admin of the pool (HOST, CO_ADMIN, or CORPORATE_HOST).
 * Use for: managing members, publishing results, sending invites, scoring overrides.
 */
export async function requirePoolAdmin(userId: string, poolId: string): Promise<boolean> {
  const member = await prisma.poolMember.findFirst({
    where: {
      poolId,
      userId,
      status: "ACTIVE",
      role: { in: [...POOL_ADMIN_ROLES] },
    },
  });
  return member != null;
}

/**
 * Verifies the user is an active owner of the pool (HOST or CORPORATE_HOST).
 * Use for: settings, phase advancement, archive, promote/demote.
 */
export async function requirePoolOwner(userId: string, poolId: string): Promise<boolean> {
  const member = await prisma.poolMember.findFirst({
    where: {
      poolId,
      userId,
      status: "ACTIVE",
      role: { in: [...POOL_OWNER_ROLES] },
    },
  });
  return member != null;
}
