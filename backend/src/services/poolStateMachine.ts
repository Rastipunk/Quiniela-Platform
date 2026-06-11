/**
 * Pool State Machine Service
 *
 * Maneja las transiciones de estado del pool y validaciones.
 *
 * Estados: DRAFT → ACTIVE → COMPLETED → ARCHIVED
 *
 * ACTIVE → DRAFT (revert) is allowed when the last non-host member
 * leaves/is removed, so the host can re-edit the scoring rules. The
 * revert deletes player predictions (their picks are no longer
 * meaningful) but preserves match results and overrides (those are
 * tournament data, not player data).
 */

import type { PoolMemberRole } from "@prisma/client";
import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import {
  sendPoolCompletedEmail,
  sendPoolRevertedToDraftEmail,
  batchSendEmails,
} from "../lib/email";
import { resolveUserLocale, FINAL_RESULT_SOURCES } from "../lib/constants";
import { extractMatches, typed, type PickJson } from "../lib/fixture";
import { fireAndForget } from "../lib/asyncHelpers";
import { getPoolOverview } from "./poolOverviewService";
// Circular at load time (resultBackfillService imports transitionToCompleted
// from this file) — safe: both sides only dereference at call time.
import { backfillConfirmedResultsForPool } from "./resultBackfillService";

export type PoolStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

/**
 * Roles whose ACTIVE membership keeps the pool in ACTIVE state.
 * If none of these remain, the pool can revert to DRAFT.
 *
 * HOST and CORPORATE_HOST are NOT in this list — the host alone is
 * not enough to keep the pool "in play". CO_ADMIN IS in the list:
 * even if there are no PLAYERs yet, an active CO_ADMIN means there
 * is staff actively administering, and the host must demote/kick
 * them explicitly before reverting.
 */
const ROLES_THAT_KEEP_POOL_ACTIVE: PoolMemberRole[] = ["PLAYER", "CO_ADMIN"];

/**
 * Transición DRAFT → ACTIVE
 *
 * Trigger: Cuando el primer PLAYER/CO_ADMIN se une al pool.
 *
 * Pre-condition: the pool MUST have at least one ACTIVE member with role
 * PLAYER or CO_ADMIN. Without this guard, any flow that calls this
 * function "optimistically" (e.g. a host clicking their own invite link
 * via [poolInvites.ts], or a corporate activation by a user who is
 * already a member) silently flips DRAFT→ACTIVE without a real player
 * present — and the pool gets stuck because the revert trigger fires
 * only when the *last* non-host member leaves, which never happens if
 * none was ever added. This guard makes the transition idempotent and
 * truthful for every caller. See incident: cocholo@gmail.com /
 * "Mundial en familia" (pool d17c0223).
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

  // Guard: only transition when at least one PLAYER/CO_ADMIN is actually
  // ACTIVE on the pool. Callers writing the new PoolMember row inside a
  // transaction must commit it before invoking this function.
  const activeNonHost = await prisma.poolMember.count({
    where: {
      poolId,
      status: "ACTIVE",
      role: { in: ROLES_THAT_KEEP_POOL_ACTIVE },
    },
  });
  if (activeNonHost === 0) return;

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

  // A pool activating mid-tournament missed every match the scraper
  // already finalized (the live job only feeds ACTIVE pools, inside the
  // polling window) — seed those confirmed results now so group tables
  // and completion work (ADR-074). Fire-and-forget: activation must
  // never fail because of the backfill.
  fireAndForget(
    "PoolStateMachine:backfill-results",
    backfillConfirmedResultsForPool(poolId),
  );
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
  //
  // The version must also be a FINAL source (audit F3-6): a
  // SCRAPER_PROVISIONAL is a live snapshot — counting it could close
  // the pool (and email everyone) while the last match is still being
  // played.
  const results = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: allMatches.map((m) => m.id) },
      currentVersionId: { not: null },
    },
    include: { currentVersion: { select: { source: true } } },
  });

  const finalResults = results.filter(
    (r) => r.currentVersion && FINAL_RESULT_SOURCES.has(r.currentVersion.source),
  );
  if (finalResults.length !== allMatches.length) {
    // Some matches don't have a FINAL published result yet — remain ACTIVE.
    return;
  }

  // Transición a COMPLETED — conditional update (audit F3-6): two
  // concurrent invocations (e.g. two matches finalising together) used
  // to both pass the read check and double-send the completion emails.
  // updateMany WHERE status=ACTIVE lets exactly one win.
  const transitioned = await prisma.pool.updateMany({
    where: { id: poolId, status: "ACTIVE" },
    data: { status: "COMPLETED" }
  });
  if (transitioned.count === 0) {
    return; // another invocation completed the pool first
  }

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
      // Obtener miembros con sus picks puntuados. Solo se emaila a
      // quienes tienen las notificaciones habilitadas (audit F3-6 —
      // antes se ignoraba la preferencia del usuario).
      const members = await prisma.poolMember.findMany({
        where: {
          poolId,
          status: "ACTIVE",
          user: { emailNotificationsEnabled: true },
        },
        include: {
          user: { select: { id: true, email: true, displayName: true, country: true } }
        },
        orderBy: { joinedAtUtc: "asc" }
      });
      if (members.length === 0) return; // nothing to rank / notify

      // Obtener predicciones (para el conteo de marcadores exactos del email)
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

      // Ranking: delegar en la MISMA función que produce el leaderboard
      // (getPoolOverview) para que el email nunca diverja de la tabla —
      // puntos correctos por config + desempates + posición compartida.
      // Se llama como cualquier miembro activo (el ranking es el mismo;
      // unimos por userId con `members` para email/displayName/locale).
      const memberByUserId = new Map(members.map((m) => [m.userId, m]));
      const overview = await getPoolOverview(members[0]!.userId, poolId, false);
      const rankedRows = overview.leaderboard.rows;

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

      // Enviar emails con ranking (batched to avoid hitting Resend rate limits).
      // Usa el rank compartido del leaderboard (puede repetirse en empate).
      const emailItems = rankedRows
        .map((row) => ({ row, member: memberByUserId.get(row.userId) }))
        .filter((x): x is { row: typeof x.row; member: NonNullable<typeof x.member> } => !!x.member);
      const { sent, failed, failures } = await batchSendEmails(emailItems, (item) =>
        sendPoolCompletedEmail({
          to: item.member.user.email,
          userId: item.member.user.id,
          displayName: item.member.user.displayName,
          poolName: pool.name,
          poolId,
          finalRank: item.row.rank,
          totalParticipants: rankedRows.length,
          totalPoints: item.row.points,
          exactScores: userExactScores.get(item.member.userId) ?? 0,
          locale: resolveUserLocale(item.member.user),
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
 * Transición ACTIVE → DRAFT (revert)
 *
 * Trigger: el último miembro no-host (PLAYER o CO_ADMIN) fue removido.
 * Side effects:
 *   - Borra Prediction, StructuralPrediction, GroupStandingsPrediction
 *     (las picks de jugadores que se fueron ya no son significativas).
 *   - Conserva PoolMatchResult/Version y PoolMatchOverride (data del
 *     torneo, no de los players).
 *   - Email al host con CTA al panel de "Administrar reglas" (opt-out
 *     via `options.sendNotification = false`, used by the orphaned-pools
 *     rescue migration where we want to silently revert state and
 *     coordinate the host-facing message separately).
 *
 * Esta función es idempotente: si la pool ya está en DRAFT o el cleanup
 * ya corrió, no hace nada y no lanza error.
 */
export async function revertPoolToDraft(
  poolId: string,
  actorUserId: string,
  reason: string,
  options: { sendNotification?: boolean } = {},
) {
  const { sendNotification = true } = options;
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      status: true,
      name: true,
      createdByUser: { select: { id: true, email: true, displayName: true, country: true } },
    },
  });

  if (!pool) throw new Error("Pool not found");
  if (pool.status !== "ACTIVE") return; // idempotent — only ACTIVE can revert

  let deletedPredictions = 0;
  let deletedStructural = 0;
  let deletedGroupStandings = 0;

  await prisma.$transaction(async (tx) => {
    const d1 = await tx.prediction.deleteMany({ where: { poolId } });
    const d2 = await tx.structuralPrediction.deleteMany({ where: { poolId } });
    const d3 = await tx.groupStandingsPrediction.deleteMany({ where: { poolId } });
    deletedPredictions = d1.count;
    deletedStructural = d2.count;
    deletedGroupStandings = d3.count;

    await tx.pool.update({
      where: { id: poolId },
      data: { status: "DRAFT" },
    });
  });

  await writeAuditEvent({
    actorUserId,
    action: "POOL_STATUS_CHANGED",
    entityType: "Pool",
    entityId: poolId,
    poolId,
    dataJson: {
      from: "ACTIVE",
      to: "DRAFT",
      reason,
      deletedPredictions,
      deletedStructural,
      deletedGroupStandings,
    },
  });

  // Notify the host so they know the rules editor is now unlocked.
  // Skipped when sendNotification=false (orphan rescue migration where
  // we coordinate the message separately).
  if (sendNotification && pool.createdByUser?.email) {
    fireAndForget(
      "pool-reverted-email",
      sendPoolRevertedToDraftEmail({
        to: pool.createdByUser.email,
        userId: pool.createdByUser.id,
        displayName: pool.createdByUser.displayName,
        poolName: pool.name,
        poolId,
        locale: resolveUserLocale(pool.createdByUser),
      }),
    );
  }
}

/**
 * Returns true when removing/leaving `excludingMemberId` would leave
 * the pool without any ACTIVE PLAYER/CO_ADMIN. The pool must be in
 * ACTIVE state for revert to be possible. Used by member ops to
 * decide whether to ask for `confirmRevert` and whether to actually
 * trigger the revert after the op.
 */
export async function wouldCauseRevert(
  poolId: string,
  excludingMemberId: string,
): Promise<boolean> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { status: true },
  });
  if (!pool || pool.status !== "ACTIVE") return false;

  const remaining = await prisma.poolMember.count({
    where: {
      poolId,
      status: "ACTIVE",
      role: { in: ROLES_THAT_KEEP_POOL_ACTIVE },
      NOT: { id: excludingMemberId },
    },
  });
  return remaining === 0;
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

/**
 * Scoring rules can only be edited while the pool is DRAFT — same
 * constraint as other settings, exposed under a more specific name
 * so the "Administrar reglas" endpoint can read clearly.
 */
export function canEditScoringConfig(poolStatus: string): boolean {
  return poolStatus === "DRAFT";
}

export function canCreateInvites(poolStatus: string): boolean {
  // Solo se pueden crear invites en DRAFT o ACTIVE
  return poolStatus === "DRAFT" || poolStatus === "ACTIVE";
}
