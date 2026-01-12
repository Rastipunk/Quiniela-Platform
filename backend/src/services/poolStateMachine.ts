/**
 * Pool State Machine Service
 *
 * Maneja las transiciones de estado del pool y validaciones.
 *
 * Estados: DRAFT → ACTIVE → COMPLETED → ARCHIVED
 */

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";

export type PoolStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

/**
 * Transición DRAFT → ACTIVE
 *
 * Trigger: Cuando el primer PLAYER se une al pool
 * Condiciones: Pool debe estar en DRAFT
 */
export async function transitionToActive(poolId: string, actorUserId: string) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { status: true }
  });

  if (!pool) {
    throw new Error("Pool not found");
  }

  if (pool.status !== "DRAFT") {
    // Ya está en ACTIVE o posterior, no hacer nada
    return;
  }

  // Transición a ACTIVE
  await prisma.pool.update({
    where: { id: poolId },
    data: { status: "ACTIVE" }
  });

  await writeAuditEvent({
    actorUserId,
    action: "POOL_STATUS_CHANGED",
    entityType: "Pool",
    entityId: poolId,
    poolId,
    dataJson: {
      from: "DRAFT",
      to: "ACTIVE",
      reason: "First player joined"
    }
  });
}

/**
 * Transición ACTIVE → COMPLETED
 *
 * Trigger: Todos los partidos del torneo tienen resultado
 * Condiciones: Pool debe estar en ACTIVE
 */
export async function transitionToCompleted(poolId: string, actorUserId: string | null = null) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      tournamentInstance: {
        select: { dataJson: true }
      }
    }
  });

  if (!pool) {
    throw new Error("Pool not found");
  }

  if (pool.status !== "ACTIVE") {
    // Solo se puede completar desde ACTIVE
    return;
  }

  // Verificar que todos los partidos tengan resultado
  const tournamentData = pool.tournamentInstance.dataJson as any;
  const allMatches = tournamentData.matches || [];

  // Contar resultados publicados
  const results = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: allMatches.map((m: any) => m.id) }
    }
  });

  if (results.length !== allMatches.length) {
    // No todos los partidos tienen resultado
    return;
  }

  // Transición a COMPLETED
  await prisma.pool.update({
    where: { id: poolId },
    data: { status: "COMPLETED" }
  });

  await writeAuditEvent({
    actorUserId: actorUserId || "SYSTEM",
    action: "POOL_STATUS_CHANGED",
    entityType: "Pool",
    entityId: poolId,
    poolId,
    dataJson: {
      from: "ACTIVE",
      to: "COMPLETED",
      reason: "All matches have results"
    }
  });
}

/**
 * Transición COMPLETED → ARCHIVED
 *
 * Trigger: Manual por HOST
 * Condiciones: Pool debe estar en COMPLETED
 */
export async function transitionToArchived(poolId: string, actorUserId: string) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { status: true }
  });

  if (!pool) {
    throw new Error("Pool not found");
  }

  if (pool.status !== "COMPLETED") {
    throw new Error("Pool must be COMPLETED to archive");
  }

  // Transición a ARCHIVED
  await prisma.pool.update({
    where: { id: poolId },
    data: { status: "ARCHIVED" }
  });

  await writeAuditEvent({
    actorUserId,
    action: "POOL_STATUS_CHANGED",
    entityType: "Pool",
    entityId: poolId,
    poolId,
    dataJson: {
      from: "COMPLETED",
      to: "ARCHIVED",
      reason: "Manually archived by host"
    }
  });
}

/**
 * Validaciones por estado
 */

export function canJoinPool(poolStatus: PoolStatus): boolean {
  // Solo se puede unir a pools en DRAFT o ACTIVE
  return poolStatus === "DRAFT" || poolStatus === "ACTIVE";
}

export function canMakePicks(poolStatus: PoolStatus): boolean {
  // Solo se pueden hacer picks en ACTIVE
  return poolStatus === "ACTIVE";
}

export function canPublishResults(poolStatus: PoolStatus): boolean {
  // Solo se pueden publicar resultados en ACTIVE o COMPLETED
  // (COMPLETED permite erratas)
  return poolStatus === "ACTIVE" || poolStatus === "COMPLETED";
}

export function canEditPoolSettings(poolStatus: PoolStatus): boolean {
  // Solo se pueden editar configuraciones en DRAFT
  return poolStatus === "DRAFT";
}

export function canCreateInvites(poolStatus: PoolStatus): boolean {
  // Solo se pueden crear invites en DRAFT o ACTIVE
  return poolStatus === "DRAFT" || poolStatus === "ACTIVE";
}

/**
 * Helper para obtener el badge de estado (UI)
 */
export function getStatusBadge(status: PoolStatus): {
  label: string;
  color: string;
  emoji: string;
} {
  switch (status) {
    case "DRAFT":
      return {
        label: "Borrador",
        color: "#f59e0b", // amber-500
        emoji: "📝"
      };
    case "ACTIVE":
      return {
        label: "En curso",
        color: "#10b981", // green-500
        emoji: "⚽"
      };
    case "COMPLETED":
      return {
        label: "Finalizada",
        color: "#3b82f6", // blue-500
        emoji: "🏆"
      };
    case "ARCHIVED":
      return {
        label: "Archivada",
        color: "#6b7280", // gray-500
        emoji: "📦"
      };
    default:
      return {
        label: "Desconocido",
        color: "#9ca3af",
        emoji: "❓"
      };
  }
}
