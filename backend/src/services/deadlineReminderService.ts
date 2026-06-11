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
import { resolveUserLocale } from "../lib/constants";
import { buildPhaseTakesMatchPicks, buildGroupLockTimes } from "../lib/poolHelpers";
import { typed, type StructuralPickJson } from "../lib/fixture";
import type { PhasePickConfig } from "../types/pickConfig";

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
  groupsCount?: number;
  knockoutsCount?: number;
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

interface MatchWithDeadline {
  id: string;
  phaseId?: string;
  label?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  kickoffUtc?: string;
  groupId?: string;
  // Legacy field names (fallback)
  homeTeam?: string;
  awayTeam?: string;
  kickoffTime?: string;
  group?: string;
}

/** Structural pick unit (Estratega) whose deadline falls in the window. */
interface StructuralUnitWithDeadline {
  /** DeadlineReminderLog.matchId value — real matchId for knockouts, synthetic key for groups. */
  reminderKey: string;
  phaseId: string;
  groupId?: string;
  matchId?: string;
  deadline: Date;
}

interface TournamentData {
  teams?: Array<{ id: string; name: string; shortName?: string }>;
  matches?: MatchWithDeadline[];
}

// =========================================================================
// CONFIGURACIÓN
// =========================================================================

const DEFAULT_HOURS_BEFORE_DEADLINE = parseInt(
  process.env.DEADLINE_REMINDER_HOURS_BEFORE || "48",
  10,
);

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
 * Obtiene el kickoff time de un match (soporta kickoffUtc y kickoffTime)
 */
function getKickoff(match: MatchWithDeadline): string | undefined {
  return match.kickoffUtc || match.kickoffTime;
}

/**
 * Obtiene el label descriptivo de un match
 */
function getMatchLabel(
  match: MatchWithDeadline,
  teams: Array<{ id: string; name: string; shortName?: string }>
): string {
  if (match.label) return match.label;
  if (match.homeTeam && match.awayTeam) return `${match.homeTeam} vs ${match.awayTeam}`;
  if (match.homeTeamId && match.awayTeamId) {
    return `${getTeamName(match.homeTeamId, teams)} vs ${getTeamName(match.awayTeamId, teams)}`;
  }
  return match.id;
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
 * Synthetic DeadlineReminderLog.matchId for group units (ADR-070 / D1).
 * Group reminders dedupe on (poolId, userId, "group:{phaseId}:{groupId}")
 * via the existing unique index — no migration. No collision with real
 * matchIds: knockout structural units use the matchId itself, and a
 * phase is either match-based or structural, never both.
 */
function groupReminderKey(phaseId: string, groupId: string): string {
  return `group:${phaseId}:${groupId}`;
}

/** Placeholder teams (W_A, RU_B, L_x, 3rd_*) cannot be picked yet. */
function isPlaceholderTeam(teamId: string | undefined): boolean {
  if (!teamId) return false;
  return (
    teamId.startsWith("W_") ||
    teamId.startsWith("RU_") ||
    teamId.startsWith("L_") ||
    teamId.startsWith("3rd_")
  );
}

/**
 * Formatea la hora del deadline para mostrar en el email
 */
function formatDeadlineTime(deadline: Date, timezone: string, locale: string = "en"): string {
  const bcp47 = locale === "pt" ? "pt-BR" : locale === "es" ? "es-MX" : "en-US";
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  };
  try {
    return deadline.toLocaleString(bcp47, { ...opts, timeZone: timezone });
  } catch {
    return deadline.toLocaleString(bcp47, opts);
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
    where: { status: "ACTIVE", muteReminders: false },
    include: {
      members: {
        where: { status: "ACTIVE" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              country: true,
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

    // Structural phases (Estratega) take group/knockout picks, not
    // per-match Prediction rows — including their matches here would
    // email users about "missing" picks that cannot exist.
    const phaseTakesMatchPicks = buildPhaseTakesMatchPicks(pool.pickTypesConfig);

    // Encontrar partidos cuyo deadline está dentro de la ventana
    const upcomingMatches = matches.filter((match) => {
      if (!phaseTakesMatchPicks(match.phaseId)) return false;
      const kickoff = getKickoff(match);
      if (!kickoff) return false;
      const deadline = getMatchDeadline(
        kickoff,
        pool.deadlineMinutesBeforeKickoff
      );
      return deadline > now && deadline <= reminderWindowEnd;
    });

    // ── Structural units (Estratega — ADR-070) ────────────────
    // Groups whose lock falls in the window + knockout matches whose
    // deadline falls in the window. "Saved" consults BOTH storages
    // because both score (GroupStandingsPrediction rows +
    // StructuralPrediction.pickJson.groups).
    const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;
    const structuralConfigs = (pickTypesConfig ?? []).filter((pc) => pc.structuralPicks);

    const upcomingGroupUnits: StructuralUnitWithDeadline[] = [];
    const upcomingKnockoutUnits: StructuralUnitWithDeadline[] = [];
    const savedGroupKeysByUser = new Map<string, Set<string>>();
    const pickedWinnersByUser = new Map<string, Set<string>>();

    if (structuralConfigs.length > 0) {
      const groupLocks = buildGroupLockTimes(
        matches.map((m) => ({ groupId: m.groupId, kickoffUtc: getKickoff(m) ?? "" })),
        pool.deadlineMinutesBeforeKickoff,
      );

      for (const phaseConfig of structuralConfigs) {
        const sp = phaseConfig.structuralPicks!;
        if (sp.type === "GROUP_STANDINGS") {
          const seen = new Set<string>();
          for (const match of matches) {
            if (match.phaseId !== phaseConfig.phaseId) continue;
            const gid = match.groupId;
            if (!gid || seen.has(gid)) continue;
            seen.add(gid);
            const lock = groupLocks.get(gid);
            if (!lock || !Number.isFinite(lock.lockTimeMs)) continue;
            const deadline = new Date(lock.lockTimeMs);
            if (deadline > now && deadline <= reminderWindowEnd) {
              upcomingGroupUnits.push({
                reminderKey: groupReminderKey(phaseConfig.phaseId, gid),
                phaseId: phaseConfig.phaseId,
                groupId: gid,
                deadline,
              });
            }
          }
        } else if (sp.type === "KNOCKOUT_WINNER") {
          for (const match of matches) {
            if (match.phaseId !== phaseConfig.phaseId) continue;
            if (isPlaceholderTeam(match.homeTeamId) || isPlaceholderTeam(match.awayTeamId)) continue;
            const kickoff = getKickoff(match);
            if (!kickoff) continue;
            const deadline = getMatchDeadline(kickoff, pool.deadlineMinutesBeforeKickoff);
            if (deadline > now && deadline <= reminderWindowEnd) {
              upcomingKnockoutUnits.push({
                reminderKey: match.id,
                phaseId: phaseConfig.phaseId,
                matchId: match.id,
                deadline,
              });
            }
          }
        }
      }

      if (upcomingGroupUnits.length > 0 || upcomingKnockoutUnits.length > 0) {
        const [groupRows, structRows] = await Promise.all([
          prisma.groupStandingsPrediction.findMany({
            where: { poolId: pool.id },
            select: { userId: true, phaseId: true, groupId: true },
          }),
          prisma.structuralPrediction.findMany({
            where: { poolId: pool.id },
            select: { userId: true, phaseId: true, pickJson: true },
          }),
        ]);
        for (const row of groupRows) {
          const set = savedGroupKeysByUser.get(row.userId) ?? new Set<string>();
          set.add(`${row.phaseId}:${row.groupId}`);
          savedGroupKeysByUser.set(row.userId, set);
        }
        for (const row of structRows) {
          const pickJson = typed<StructuralPickJson>(row.pickJson);
          if (pickJson.groups) {
            const set = savedGroupKeysByUser.get(row.userId) ?? new Set<string>();
            for (const g of pickJson.groups) set.add(`${row.phaseId}:${g.groupId}`);
            savedGroupKeysByUser.set(row.userId, set);
          }
          if (pickJson.matches) {
            const set = pickedWinnersByUser.get(row.userId) ?? new Set<string>();
            for (const m of pickJson.matches) {
              if (m.winnerId) set.add(m.matchId);
            }
            pickedWinnersByUser.set(row.userId, set);
          }
        }
      }
    }

    if (
      upcomingMatches.length === 0 &&
      upcomingGroupUnits.length === 0 &&
      upcomingKnockoutUnits.length === 0
    ) {
      continue;
    }

    console.log(
      `   Pool "${pool.name}": ${upcomingMatches.length} partidos, ${upcomingGroupUnits.length} grupos, ${upcomingKnockoutUnits.length} eliminatorias con deadline próximo`
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

      // Unidades estructurales sin pick para este usuario
      const userSavedGroupKeys = savedGroupKeysByUser.get(user.id) ?? new Set<string>();
      const groupsWithoutPick = upcomingGroupUnits.filter(
        (u) => !userSavedGroupKeys.has(`${u.phaseId}:${u.groupId}`)
      );
      const userPickedWinners = pickedWinnersByUser.get(user.id) ?? new Set<string>();
      const knockoutsWithoutPick = upcomingKnockoutUnits.filter(
        (u) => !userPickedWinners.has(u.matchId!)
      );

      const pendingUnitKeys = [
        ...matchesWithoutPick.map((m) => m.id),
        ...groupsWithoutPick.map((u) => u.reminderKey),
        ...knockoutsWithoutPick.map((u) => u.reminderKey),
      ];
      if (pendingUnitKeys.length === 0) continue;

      // Verificar si ya enviamos recordatorio para estas unidades
      const existingReminders = await prisma.deadlineReminderLog.findMany({
        where: {
          poolId: pool.id,
          userId: user.id,
          matchId: { in: pendingUnitKeys },
        },
        select: { matchId: true },
      });

      const alreadyReminded = new Set(
        existingReminders.map((r) => r.matchId)
      );
      const matchesToRemind = matchesWithoutPick.filter(
        (m) => !alreadyReminded.has(m.id)
      );
      const groupsToRemind = groupsWithoutPick.filter(
        (u) => !alreadyReminded.has(u.reminderKey)
      );
      const knockoutsToRemind = knockoutsWithoutPick.filter(
        (u) => !alreadyReminded.has(u.reminderKey)
      );
      const unitKeysToLog = [
        ...matchesToRemind.map((m) => m.id),
        ...groupsToRemind.map((u) => u.reminderKey),
        ...knockoutsToRemind.map((u) => u.reminderKey),
      ];

      if (unitKeysToLog.length === 0) continue;

      // Calcular el deadline más próximo entre TODAS las unidades
      const candidateDeadlines: Date[] = [];
      for (const match of matchesToRemind) {
        const kickoff = getKickoff(match);
        if (kickoff) {
          candidateDeadlines.push(getMatchDeadline(kickoff, pool.deadlineMinutesBeforeKickoff));
        }
      }
      for (const u of groupsToRemind) candidateDeadlines.push(u.deadline);
      for (const u of knockoutsToRemind) candidateDeadlines.push(u.deadline);
      let nearestDeadline: Date | null = null;
      for (const d of candidateDeadlines) {
        if (!nearestDeadline || d < nearestDeadline) nearestDeadline = d;
      }
      if (!nearestDeadline) continue; // defensive: every unit lacked a parseable deadline

      const userLocale = resolveUserLocale(user);
      const deadlineFormatted = formatDeadlineTime(nearestDeadline, pool.timeZone, userLocale);

      // Preparar detalle
      const detail: ReminderDetail = {
        poolId: pool.id,
        poolName: pool.name,
        userId: user.id,
        userEmail: user.email,
        matchesCount: matchesToRemind.length,
        groupsCount: groupsToRemind.length,
        knockoutsCount: knockoutsToRemind.length,
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
          groupsCount: groupsToRemind.length,
          knockoutsCount: knockoutsToRemind.length,
          deadlineTime: deadlineFormatted,
          poolId: pool.id,
          locale: userLocale,
        });

        if (emailResult.skipped) {
          detail.status = "skipped";
          detail.reason = emailResult.reason;
          result.emailsSkipped++;
        } else if (emailResult.success) {
          detail.status = "sent";
          result.emailsSent++;
          result.usersNotified++;

          // Guardar logs para cada unidad recordada (partido, grupo
          // sintético o eliminatoria — ver groupReminderKey)
          for (const unitKey of unitKeysToLog) {
            await prisma.deadlineReminderLog.create({
              data: {
                poolId: pool.id,
                userId: user.id,
                matchId: unitKey,
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
          for (const unitKey of unitKeysToLog) {
            await prisma.deadlineReminderLog.create({
              data: {
                poolId: pool.id,
                userId: user.id,
                matchId: unitKey,
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
