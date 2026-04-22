/**
 * Pool State Machine Service
 *
 * Maneja las transiciones de estado del pool y validaciones.
 *
 * Estados: DRAFT → ACTIVE → COMPLETED → ARCHIVED
 */

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { sendPoolCompletedEmail, batchSendEmails } from "../lib/email";
import { countryToLocale } from "../lib/constants";
import { extractMatches, typed, type PickJson } from "../lib/fixture";

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
  const allMatches = extractMatches(pool.tournamentInstance.dataJson);

  // Only count results that actually have a PUBLISHED version. A
  // PoolMatchResult header row can legitimately exist with
  // `currentVersionId = null` (e.g. erratum that reverted every
  // version), and if we count it as "done" the pool transitions to
  // COMPLETED while the scoring loop below silently ignores the match
  // (`if (r.currentVersion)` guard) — producing a completed pool with
  // wrong leaderboard.
  const results = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: allMatches.map((m) => m.id) },
      currentVersionId: { not: null },
    }
  });

  if (results.length !== allMatches.length) {
    // Some matches don't have a published result yet — remain ACTIVE.
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
          user: { select: { id: true, email: true, displayName: true, country: true } }
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

        const pick = typed<PickJson>(pred.pickJson);
        let points = 0;

        if (pick?.type === "OUTCOME") {
          const actualOutcome = result.homeGoals > result.awayGoals ? "HOME" :
                                result.homeGoals < result.awayGoals ? "AWAY" : "DRAW";
          if (pick.outcome === actualOutcome) points = 3;
        } else if (pick?.type === "SCORE") {
          const actualOutcome = result.homeGoals > result.awayGoals ? "HOME" :
                                result.homeGoals < result.awayGoals ? "AWAY" : "DRAW";
          const predOutcome = pick.homeGoals! > pick.awayGoals! ? "HOME" :
                              pick.homeGoals! < pick.awayGoals! ? "AWAY" : "DRAW";
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
        const pick2 = typed<PickJson>(pred.pickJson);
        if (pick2?.type === "SCORE" &&
            pick2.homeGoals === result.homeGoals &&
            pick2.awayGoals === result.awayGoals) {
          const current = userExactScores.get(pred.userId) ?? 0;
          userExactScores.set(pred.userId, current + 1);
        }
      }

      // Enviar emails con ranking (batched to avoid hitting Resend rate limits)
      const emailItems = sortedMembers.map((member, idx) => ({ member, rank: idx + 1 }));
      const { sent, failed, failures } = await batchSendEmails(emailItems, (item) =>
        sendPoolCompletedEmail({
          to: item.member.user.email,
          userId: item.member.user.id,
          displayName: item.member.user.displayName,
          poolName: pool.name,
          poolId,
          finalRank: item.rank,
          totalParticipants: sortedMembers.length,
          totalPoints: item.member.points,
          exactScores: userExactScores.get(item.member.userId) ?? 0,
          locale: countryToLocale(item.member.user.country),
        }),
      );
      console.log(`📧 Pool completed emails for ${poolId}: ${sent} sent, ${failed} failed`);
      // Per-failure logging. Without this, a silent 30% failure rate
      // (e.g. all @yahoo.com bouncing after a DKIM rotation) looks
      // identical to a healthy run. Automated retry lives in the
      // post-mundial TECH_DEBT backlog.
      if (failures.length > 0) {
        for (const { item, error } of failures) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(
            `[PoolCompleted] email failed pool=${poolId} userId=${item.member.userId} email=${item.member.user.email}: ${msg}`,
          );
        }
      }
    } catch (emailError) {
      console.error("Error sending pool completed emails:", emailError instanceof Error ? emailError.message : String(emailError));
    }
  })();
}

/**
 * Transición → ARCHIVED
 *
 * Trigger: Manual por HOST
 * Condiciones: Pool debe estar en DRAFT, ACTIVE, o COMPLETED
 * - DRAFT: se elimina el pool y sus datos dependientes (no hay valor)
 * - ACTIVE/COMPLETED: se archiva (conserva datos para historial)
 */
export async function transitionToArchived(poolId: string, actorUserId: string) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { status: true }
  });

  if (!pool) {
    throw new Error("Pool not found");
  }

  const allowedStatuses = ["DRAFT", "ACTIVE", "COMPLETED"];
  if (!allowedStatuses.includes(pool.status)) {
    throw new Error("Pool is already archived");
  }

  const previousStatus = pool.status;

  // DRAFT pools: delete entirely (no valuable data)
  if (pool.status === "DRAFT") {
    await prisma.$transaction([
      prisma.poolPayment.deleteMany({ where: { poolId } }),
      prisma.poolInvite.deleteMany({ where: { poolId } }),
      prisma.corporateInvite.deleteMany({ where: { poolId } }),
      prisma.auditEvent.deleteMany({ where: { poolId } }),
      prisma.poolMember.deleteMany({ where: { poolId } }),
      prisma.pool.delete({ where: { id: poolId } }),
    ]);

    await writeAuditEvent({
      actorUserId,
      action: "POOL_STATUS_CHANGED",
      entityType: "Pool",
      entityId: poolId,
      dataJson: {
        from: "DRAFT",
        to: "DELETED",
        reason: "Draft pool deleted by host"
      }
    });
    return;
  }

  // ACTIVE/COMPLETED → ARCHIVED
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
      from: previousStatus,
      to: "ARCHIVED",
      reason: "Manually archived by host"
    }
  });
}

/**
 * Validaciones por estado
 */

export function canJoinPool(poolStatus: string): boolean {
  // Solo se puede unir a pools en DRAFT o ACTIVE
  return poolStatus === "DRAFT" || poolStatus === "ACTIVE";
}

export function canMakePicks(poolStatus: string): boolean {
  // Solo se pueden hacer picks en ACTIVE
  return poolStatus === "ACTIVE";
}

export function canPublishResults(poolStatus: string): boolean {
  // Solo se pueden publicar resultados en ACTIVE o COMPLETED
  // (COMPLETED permite erratas)
  return poolStatus === "ACTIVE" || poolStatus === "COMPLETED";
}

export function canEditPoolSettings(poolStatus: string): boolean {
  // Solo se pueden editar configuraciones en DRAFT
  return poolStatus === "DRAFT";
}

export function canCreateInvites(poolStatus: string): boolean {
  // Solo se pueden crear invites en DRAFT o ACTIVE
  return poolStatus === "DRAFT" || poolStatus === "ACTIVE";
}
