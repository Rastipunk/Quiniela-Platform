// backend/src/services/deadlineReminderService.ts
/**
 * Servicio de Recordatorios de Deadline
 *
 * Este servicio envía recordatorios a usuarios que tienen partidos
 * próximos sin pronósticos. Diseñado para ser ejecutado:
 * - Manualmente por admin via endpoint
 * - Por cron job (futuro)
 */

import { prisma } from "../db";
import { sendDeadlineReminderEmail, isEmailEnabled } from "../lib/email";

// =========================================================================
// TIPOS
// =========================================================================

export interface DeadlineReminderResult {
  success: boolean;
  poolsProcessed: number;
  usersNotified: number;
  emailsSent: number;
  emailsSkipped: number;
  emailsFailed: number;
  errors: string[];
  details: ReminderDetail[];
}

interface ReminderDetail {
  poolId: string;
  poolName: string;
  userId: string;
  userEmail: string;
  matchesCount: number;
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

interface MatchWithDeadline {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  group?: string;
}

interface TournamentData {
  teams?: Array<{ id: string; name: string; shortName?: string }>;
  matches?: MatchWithDeadline[];
}

// =========================================================================
// CONFIGURACIÓN
// =========================================================================

const DEFAULT_HOURS_BEFORE_DEADLINE = 24; // Enviar recordatorio 24 horas antes

// =========================================================================
// FUNCIONES AUXILIARES
// =========================================================================

/**
 * Obtiene el nombre del equipo por ID
 */
function getTeamName(
  teamId: string,
  teams: Array<{ id: string; name: string; shortName?: string }>
): string {
  const team = teams.find((t) => t.id === teamId);
  return team?.shortName || team?.name || teamId;
}

/**
 * Calcula el deadline de un partido basado en la configuración del pool
 */
function getMatchDeadline(
  kickoffTime: string,
  deadlineMinutesBeforeKickoff: number
): Date {
  const kickoff = new Date(kickoffTime);
  return new Date(kickoff.getTime() - deadlineMinutesBeforeKickoff * 60 * 1000);
}

/**
 * Formatea la hora del deadline para mostrar en el email
 */
function formatDeadlineTime(deadline: Date, timezone: string): string {
  try {
    return deadline.toLocaleString("es-MX", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    // Fallback si el timezone no es válido
    return deadline.toLocaleString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

// =========================================================================
// SERVICIO PRINCIPAL
// =========================================================================

/**
 * Procesa y envía recordatorios de deadline para todos los pools activos
 *
 * @param hoursBeforeDeadline - Horas antes del deadline para enviar recordatorio
 * @param dryRun - Si true, no envía emails ni guarda logs (solo simula)
 */
export async function processDeadlineReminders(
  hoursBeforeDeadline: number = DEFAULT_HOURS_BEFORE_DEADLINE,
  dryRun: boolean = false
): Promise<DeadlineReminderResult> {
  const result: DeadlineReminderResult = {
    success: true,
    poolsProcessed: 0,
    usersNotified: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    emailsFailed: 0,
    errors: [],
    details: [],
  };

  // Verificar si está habilitado a nivel de plataforma
  const { enabled, reason } = await isEmailEnabled("deadlineReminder");
  if (!enabled) {
    result.success = false;
    result.errors.push(`Deadline reminders disabled: ${reason}`);
    return result;
  }

  const now = new Date();
  const reminderWindowEnd = new Date(
    now.getTime() + hoursBeforeDeadline * 60 * 60 * 1000
  );

  console.log(
    `📧 Procesando recordatorios de deadline (${hoursBeforeDeadline}h antes)...`
  );
  console.log(`   Ventana: ${now.toISOString()} - ${reminderWindowEnd.toISOString()}`);
  if (dryRun) console.log("   🧪 MODO DRY RUN - No se enviarán emails");

  // Obtener todos los pools activos
  const activePools = await prisma.pool.findMany({
    where: { status: "ACTIVE" },
    include: {
      members: {
        where: { status: "ACTIVE" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              emailNotificationsEnabled: true,
              emailDeadlineReminders: true,
            },
          },
        },
      },
      predictions: {
        select: {
          userId: true,
          matchId: true,
        },
      },
      tournamentInstance: {
        select: {
          dataJson: true,
        },
      },
    },
  });

  console.log(`   Encontrados ${activePools.length} pools activos`);

  for (const pool of activePools) {
    result.poolsProcessed++;

    // Obtener datos del torneo (fixture)
    const instanceData = pool.fixtureSnapshot || pool.tournamentInstance.dataJson;
    const tournamentData = instanceData as TournamentData;
    const matches = tournamentData?.matches || [];
    const teams = tournamentData?.teams || [];

    if (matches.length === 0) continue;

    // Encontrar partidos cuyo deadline está dentro de la ventana
    const upcomingMatches = matches.filter((match) => {
      const deadline = getMatchDeadline(
        match.kickoffTime,
        pool.deadlineMinutesBeforeKickoff
      );
      return deadline > now && deadline <= reminderWindowEnd;
    });

    if (upcomingMatches.length === 0) continue;

    console.log(
      `   Pool "${pool.name}": ${upcomingMatches.length} partidos con deadline próximo`
    );

    // Para cada miembro activo
    for (const member of pool.members) {
      const user = member.user;

      // Verificar preferencias del usuario
      if (!user.emailNotificationsEnabled || !user.emailDeadlineReminders) {
        continue;
      }

      // Encontrar partidos sin pronóstico para este usuario
      const userPredictions = pool.predictions.filter(
        (p) => p.userId === user.id
      );
      const predictedMatchIds = new Set(userPredictions.map((p) => p.matchId));

      const matchesWithoutPick = upcomingMatches.filter(
        (match) => !predictedMatchIds.has(match.id)
      );

      if (matchesWithoutPick.length === 0) continue;

      // Verificar si ya enviamos recordatorio para estos partidos
      const existingReminders = await prisma.deadlineReminderLog.findMany({
        where: {
          poolId: pool.id,
          userId: user.id,
          matchId: { in: matchesWithoutPick.map((m) => m.id) },
        },
        select: { matchId: true },
      });

      const alreadyRemindedMatchIds = new Set(
        existingReminders.map((r) => r.matchId)
      );
      const matchesToRemind = matchesWithoutPick.filter(
        (m) => !alreadyRemindedMatchIds.has(m.id)
      );

      if (matchesToRemind.length === 0) continue;

      // Calcular el deadline más próximo para el email
      const firstMatch = matchesToRemind[0]!; // Safe: we already checked length > 0
      const nearestDeadline = matchesToRemind.reduce((nearest, match) => {
        const deadline = getMatchDeadline(
          match.kickoffTime,
          pool.deadlineMinutesBeforeKickoff
        );
        return deadline < nearest ? deadline : nearest;
      }, new Date(firstMatch.kickoffTime));

      const deadlineFormatted = formatDeadlineTime(nearestDeadline, pool.timeZone);

      // Preparar detalle
      const detail: ReminderDetail = {
        poolId: pool.id,
        poolName: pool.name,
        userId: user.id,
        userEmail: user.email,
        matchesCount: matchesToRemind.length,
        status: "sent",
      };

      if (dryRun) {
        detail.status = "skipped";
        detail.reason = "dry_run";
        result.emailsSkipped++;
        result.details.push(detail);
        continue;
      }

      // Enviar email
      try {
        const emailResult = await sendDeadlineReminderEmail({
          to: user.email,
          userId: user.id,
          displayName: user.displayName,
          poolName: pool.name,
          matchesCount: matchesToRemind.length,
          deadlineTime: deadlineFormatted,
          poolId: pool.id,
        });

        if (emailResult.skipped) {
          detail.status = "skipped";
          detail.reason = emailResult.reason;
          result.emailsSkipped++;
        } else if (emailResult.success) {
          detail.status = "sent";
          result.emailsSent++;
          result.usersNotified++;

          // Guardar logs para cada partido recordado
          for (const match of matchesToRemind) {
            await prisma.deadlineReminderLog.create({
              data: {
                poolId: pool.id,
                userId: user.id,
                matchId: match.id,
                sentToEmail: user.email,
                success: true,
                hoursBeforeDeadline,
              },
            });
          }
        } else {
          detail.status = "failed";
          detail.reason = emailResult.error;
          result.emailsFailed++;

          // Guardar log de fallo
          for (const match of matchesToRemind) {
            await prisma.deadlineReminderLog.create({
              data: {
                poolId: pool.id,
                userId: user.id,
                matchId: match.id,
                sentToEmail: user.email,
                success: false,
                error: emailResult.error,
                hoursBeforeDeadline,
              },
            });
          }
        }
      } catch (err) {
        detail.status = "failed";
        detail.reason = String(err);
        result.emailsFailed++;
        result.errors.push(`Error enviando a ${user.email}: ${err}`);
      }

      result.details.push(detail);
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   Pools procesados: ${result.poolsProcessed}`);
  console.log(`   Usuarios notificados: ${result.usersNotified}`);
  console.log(`   Emails enviados: ${result.emailsSent}`);
  console.log(`   Emails omitidos: ${result.emailsSkipped}`);
  console.log(`   Emails fallidos: ${result.emailsFailed}`);

  return result;
}

/**
 * Obtiene estadísticas de recordatorios enviados
 */
export async function getDeadlineReminderStats(
  poolId?: string,
  days: number = 7
): Promise<{
  totalSent: number;
  totalFailed: number;
  byPool: Array<{ poolId: string; poolName: string; count: number }>;
  recentLogs: Array<{
    sentAt: Date;
    poolId: string;
    userId: string;
    matchId: string;
    success: boolean;
  }>;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: { sentAt: { gte: Date }; poolId?: string } = {
    sentAt: { gte: since },
  };
  if (poolId) {
    where.poolId = poolId;
  }

  const [totalSent, totalFailed, recentLogs] = await Promise.all([
    prisma.deadlineReminderLog.count({
      where: { ...where, success: true },
    }),
    prisma.deadlineReminderLog.count({
      where: { ...where, success: false },
    }),
    prisma.deadlineReminderLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: 50,
      select: {
        sentAt: true,
        poolId: true,
        userId: true,
        matchId: true,
        success: true,
      },
    }),
  ]);

  // Agrupar por pool
  const logsByPool = await prisma.deadlineReminderLog.groupBy({
    by: ["poolId"],
    where,
    _count: { id: true },
  });

  // Obtener nombres de pools
  const poolIds = logsByPool.map((l) => l.poolId);
  const pools = await prisma.pool.findMany({
    where: { id: { in: poolIds } },
    select: { id: true, name: true },
  });

  const poolNameMap = new Map(pools.map((p) => [p.id, p.name]));

  const byPool = logsByPool.map((l) => ({
    poolId: l.poolId,
    poolName: poolNameMap.get(l.poolId) || "Unknown",
    count: l._count.id,
  }));

  return {
    totalSent,
    totalFailed,
    byPool,
    recentLogs,
  };
}
