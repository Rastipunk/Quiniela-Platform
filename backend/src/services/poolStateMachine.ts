/**
 * Pool State Machine Service
 *
 * Maneja las transiciones de estado del pool y validaciones.
 *
 * Estados: DRAFT → ACTIVE → COMPLETED → ARCHIVED
 */

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { sendPoolCompletedEmail } from "../lib/email";

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

  // ========== SEND POOL COMPLETED EMAILS ==========
  // Calcular leaderboard y enviar notificaciones (async, no bloquea)
  (async () => {
    try {
      // Obtener miembros con sus picks puntuados
      const members = await prisma.poolMember.findMany({
        where: { poolId, status: "ACTIVE" },
        include: {
          user: { select: { id: true, email: true, displayName: true } }
        },
        orderBy: { joinedAtUtc: "asc" }
      });

      // Obtener predicciones y calcular puntos
      const predictions = await prisma.prediction.findMany({
        where: { poolId }
      });

      // Obtener resultados
      const poolResults = await prisma.poolMatchResult.findMany({
        where: { poolId },
        include: { currentVersion: true }
      });

      const resultByMatchId = new Map<string, { homeGoals: number; awayGoals: number }>();
      for (const r of poolResults) {
        if (r.currentVersion) {
          resultByMatchId.set(r.matchId, {
            homeGoals: r.currentVersion.homeGoals,
            awayGoals: r.currentVersion.awayGoals
          });
        }
      }

      // Calcular puntos por usuario
      const userPoints = new Map<string, number>();
      for (const member of members) {
        userPoints.set(member.userId, 0);
      }

      for (const pred of predictions) {
        const result = resultByMatchId.get(pred.matchId);
        if (!result) continue;

        const pick = pred.pickJson as any;
        let points = 0;

        if (pick?.type === "OUTCOME") {
          const actualOutcome = result.homeGoals > result.awayGoals ? "HOME" :
                                result.homeGoals < result.awayGoals ? "AWAY" : "DRAW";
          if (pick.outcome === actualOutcome) points = 3;
        } else if (pick?.type === "SCORE") {
          const actualOutcome = result.homeGoals > result.awayGoals ? "HOME" :
                                result.homeGoals < result.awayGoals ? "AWAY" : "DRAW";
          const predOutcome = pick.homeGoals > pick.awayGoals ? "HOME" :
                              pick.homeGoals < pick.awayGoals ? "AWAY" : "DRAW";
          if (predOutcome === actualOutcome) {
            points = 3;
            if (pick.homeGoals === result.homeGoals && pick.awayGoals === result.awayGoals) {
              points = 5; // Exact score bonus
            }
          }
        }

        const current = userPoints.get(pred.userId) ?? 0;
        userPoints.set(pred.userId, current + points);
      }

      // Ordenar por puntos (desc) y fecha de join (asc) para ranking
      const sortedMembers = members
        .map(m => ({ ...m, points: userPoints.get(m.userId) ?? 0 }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return new Date(a.joinedAtUtc).getTime() - new Date(b.joinedAtUtc).getTime();
        });

      // Calcular exact scores por usuario
      const userExactScores = new Map<string, number>();
      for (const pred of predictions) {
        const result = resultByMatchId.get(pred.matchId);
        if (!result) continue;
        const pick = pred.pickJson as any;
        if (pick?.type === "SCORE" &&
            pick.homeGoals === result.homeGoals &&
            pick.awayGoals === result.awayGoals) {
          const current = userExactScores.get(pred.userId) ?? 0;
          userExactScores.set(pred.userId, current + 1);
        }
      }

      // Enviar emails con ranking
      const emailPromises = sortedMembers.map((member, idx) =>
        sendPoolCompletedEmail({
          to: member.user.email,
          userId: member.user.id,
          displayName: member.user.displayName,
          poolName: pool.name,
          poolId: poolId,
          finalRank: idx + 1,
          totalParticipants: sortedMembers.length,
          totalPoints: member.points,
          exactScores: userExactScores.get(member.userId) ?? 0,
        }).catch((err) => {
          console.error(`Error sending pool completed email to ${member.user.email}:`, err);
        })
      );

      await Promise.allSettled(emailPromises);
      console.log(`📧 Pool completed emails sent for pool ${poolId}`);
    } catch (emailError) {
      console.error("Error sending pool completed emails:", emailError);
    }
  })();
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
