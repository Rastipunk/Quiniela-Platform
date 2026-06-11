/**
 * Advancement Trigger
 *
 * Watches for phase completion and triggers automatic advancement
 * (group_stage → R32 → R16 → QF → SF → Final) per pool.
 *
 * Called from:
 * - liveScoresJob.finalizeResult() — after a result becomes API_CONFIRMED
 * - resultService.publishResult() — after a host override
 *
 * Uses a configurable delay (ADVANCEMENT_DELAY_MS, default 10 min) to give
 * admins/hosts a window for manual corrections before the bracket fills.
 *
 * Idempotent: re-checking after advancement is a no-op.
 */

import { prisma } from "../db";
import { ADVANCEMENT, PHASE_DISPLAY_NAMES, resolveUserLocale, FINAL_RESULT_SOURCES } from "../lib/constants";
import { advanceToRoundOf32, advanceKnockoutPhase } from "./instanceAdvancement";
import { writeAuditEvent } from "../lib/audit";
import { sendAdminNotification, sendPhaseCompletionSummaryEmail, batchSendEmails } from "../lib/email";
import { typed, getNextPhaseId, type PickJson } from "../lib/fixture";

// In-memory map of pending advancement timers (per pool+phase).
// Key: `${poolId}:${phaseId}`
const pendingTimers = new Map<string, NodeJS.Timeout>();

// Next-phase resolution lives in lib/fixture.getNextPhaseId (derived
// from the fixture's own phases[].order). The hardcoded map that used
// to live here pointed semi_finals at "final" while the WC2026 fixture
// uses "finals" — auto-advancement into the final silently no-oped
// (audit F3-1).

interface PoolFixtureMatch {
  id: string;
  phaseId: string;
  homeTeamId: string;
  awayTeamId: string;
}

interface PoolFixtureSnapshot {
  matches?: PoolFixtureMatch[];
}

/**
 * Called after a match result becomes API_CONFIRMED or HOST_OVERRIDE.
 * Checks if the phase is now complete; if so, schedules an advancement
 * with the configured delay.
 */
export async function checkAndTriggerAdvancement(
  poolId: string,
  matchId: string,
  actorUserId: string | null = null
): Promise<{ scheduled: boolean; phase?: string; nextPhase?: string }> {
  try {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { id: true, name: true, fixtureSnapshot: true, tournamentInstanceId: true },
    });
    if (!pool) return { scheduled: false };

    const snapshot = pool.fixtureSnapshot as PoolFixtureSnapshot | null;
    if (!snapshot?.matches) return { scheduled: false };

    // Find the phase of the completed match
    const completedMatch = snapshot.matches.find((m) => m.id === matchId);
    if (!completedMatch) return { scheduled: false };
    const phaseId = completedMatch.phaseId;
    const nextPhaseId = getNextPhaseId(pool.fixtureSnapshot, phaseId);
    if (!nextPhaseId) return { scheduled: false }; // final or unknown phase

    // Check if all matches of this phase have a confirmed result
    const phaseMatches = snapshot.matches.filter((m) => m.phaseId === phaseId);
    const phaseMatchIds = phaseMatches.map((m) => m.id);

    // Skip if any match still has placeholder teams (phase not yet resolved)
    const hasPlaceholders = phaseMatches.some(
      (m) => isPlaceholder(m.homeTeamId) || isPlaceholder(m.awayTeamId)
    );
    if (hasPlaceholders) return { scheduled: false };

    const results = await prisma.poolMatchResult.findMany({
      where: { poolId, matchId: { in: phaseMatchIds } },
      include: { currentVersion: { select: { source: true } } },
    });

    const confirmedSources = FINAL_RESULT_SOURCES;
    const allConfirmed =
      results.length === phaseMatches.length &&
      results.every((r) => r.currentVersion && confirmedSources.has(r.currentVersion.source));

    if (!allConfirmed) return { scheduled: false };

    // Check if next phase already has resolved teams (advancement already happened)
    const nextPhaseMatches = snapshot.matches.filter((m) => m.phaseId === nextPhaseId);
    const nextPhaseAlreadyResolved =
      nextPhaseMatches.length > 0 &&
      nextPhaseMatches.every(
        (m) => !isPlaceholder(m.homeTeamId) && !isPlaceholder(m.awayTeamId)
      );
    if (nextPhaseAlreadyResolved) return { scheduled: false };

    // Schedule advancement with delay
    const timerKey = `${poolId}:${phaseId}`;
    if (pendingTimers.has(timerKey)) {
      // Already scheduled — keep the existing timer
      return { scheduled: true, phase: phaseId, nextPhase: nextPhaseId };
    }

    console.log(
      `[AdvancementTrigger] Phase ${phaseId} complete for pool ${poolId}. ` +
        `Scheduling advancement to ${nextPhaseId} in ${ADVANCEMENT.DELAY_MS / 60_000} minutes.`
    );

    const capturedActor = actorUserId;
    const timer = setTimeout(async () => {
      pendingTimers.delete(timerKey);
      await executeAdvancement(poolId, phaseId, nextPhaseId, capturedActor);
    }, ADVANCEMENT.DELAY_MS);

    pendingTimers.set(timerKey, timer);
    return { scheduled: true, phase: phaseId, nextPhase: nextPhaseId };
  } catch (err) {
    console.error("[AdvancementTrigger] Error in checkAndTriggerAdvancement:", err);
    return { scheduled: false };
  }
}

async function executeAdvancement(
  poolId: string,
  completedPhaseId: string,
  nextPhaseId: string,
  actorUserId: string | null
): Promise<void> {
  try {
    // Re-verify phase is still complete (in case of HOST_OVERRIDE during delay)
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { id: true, name: true, fixtureSnapshot: true, tournamentInstanceId: true },
    });
    if (!pool) return;

    const snapshot = pool.fixtureSnapshot as PoolFixtureSnapshot | null;
    if (!snapshot?.matches) return;

    const phaseMatches = snapshot.matches.filter((m) => m.phaseId === completedPhaseId);
    const results = await prisma.poolMatchResult.findMany({
      where: { poolId, matchId: { in: phaseMatches.map((m) => m.id) } },
      include: { currentVersion: { select: { source: true } } },
    });
    const confirmedSources = FINAL_RESULT_SOURCES;
    const stillComplete =
      results.length === phaseMatches.length &&
      results.every((r) => r.currentVersion && confirmedSources.has(r.currentVersion.source));

    if (!stillComplete) {
      console.log(
        `[AdvancementTrigger] Phase ${completedPhaseId} no longer complete for pool ${poolId}. Aborting advancement.`
      );
      return;
    }

    // Respect the same gates the host path honors (audit F3-7): the
    // timer path used to bypass pool.autoAdvanceEnabled AND the <24h
    // errata freeze, advancing pools whose hosts had explicitly opted
    // out or were mid-correction.
    const { validateCanAutoAdvance } = await import("./instanceAdvancement");
    const validation = await validateCanAutoAdvance(
      pool.tournamentInstanceId,
      completedPhaseId,
      poolId,
    );
    if (!validation.canAdvance) {
      console.log(
        `[AdvancementTrigger] Advancement blocked for pool ${poolId} (${completedPhaseId}): ${validation.reason}`
      );
      return;
    }

    // Execute advancement
    if (completedPhaseId === "group_stage") {
      await advanceToRoundOf32(pool.tournamentInstanceId, poolId);
    } else {
      await advanceKnockoutPhase(pool.tournamentInstanceId, completedPhaseId, nextPhaseId, poolId);
    }

    console.log(
      `[AdvancementTrigger] Successfully advanced pool ${poolId} from ${completedPhaseId} to ${nextPhaseId}`
    );

    // Audit + admin notification
    await writeAuditEvent({
      actorUserId,
      action: "PHASE_AUTO_ADVANCED",
      entityType: "Pool",
      entityId: poolId,
      poolId,
      dataJson: {
        completedPhase: completedPhaseId,
        nextPhase: nextPhaseId,
        triggeredBy: "advancementTrigger",
      },
    });

    sendAdminNotification({
      subject: `Pool "${pool.name}" avanzó: ${completedPhaseId} → ${nextPhaseId}`,
      body: `<p>Pool <strong>${pool.name}</strong> automatically advanced from <code>${completedPhaseId}</code> to <code>${nextPhaseId}</code>.</p>`,
      category: "system_event",
    }).catch(() => {});

    // Send phase completion summary emails to all members (fire-and-forget)
    sendPhaseCompletionNotifications(poolId, completedPhaseId, pool.name)
      .catch(() => {});

    // Cascade: check if the next phase is also already complete (rare but possible)
    // Pick any match from next phase to re-trigger
    const newSnapshot = (await prisma.pool.findUnique({
      where: { id: poolId },
      select: { fixtureSnapshot: true },
    }))?.fixtureSnapshot as PoolFixtureSnapshot | null;
    const nextMatches = newSnapshot?.matches?.filter((m) => m.phaseId === nextPhaseId);
    if (nextMatches && nextMatches.length > 0 && nextMatches[0]) {
      await checkAndTriggerAdvancement(poolId, nextMatches[0].id, actorUserId);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[AdvancementTrigger] Failed to advance pool ${poolId} from ${completedPhaseId}:`,
      errMsg
    );
    sendAdminNotification({
      subject: `Avance de fase falló: ${completedPhaseId} → ${nextPhaseId} (pool ${poolId})`,
      body: `<p>Pool <code>${poolId}</code> failed to advance automatically.</p><p><strong>Error:</strong> ${errMsg}</p><p>Manual intervention required.</p>`,
      category: "error",
    }).catch(() => {});
  }
}

/**
 * Re-arm advancement checks after a process restart (audit F3-7).
 * Timers live in memory: a deploy/restart inside the 10-min delay lost
 * the scheduled advancement, and if the lost timer belonged to the
 * phase's LAST match there was no later trigger — the bracket stayed
 * stuck until manual intervention. On boot we sweep ACTIVE pools of
 * AUTO instances with a cheap snapshot-only prefilter (phase fully
 * resolved + next phase still has placeholders) and delegate the real
 * completeness check + scheduling to checkAndTriggerAdvancement.
 */
export async function rearmPendingAdvancements(): Promise<void> {
  try {
    const pools = await prisma.pool.findMany({
      where: {
        status: "ACTIVE",
        tournamentInstance: { resultSourceMode: "AUTO", status: "ACTIVE" },
      },
      select: { id: true, fixtureSnapshot: true },
    });

    let rearmed = 0;
    for (const pool of pools) {
      const snapshot = pool.fixtureSnapshot as PoolFixtureSnapshot | null;
      if (!snapshot?.matches) continue;

      const byPhase = new Map<string, PoolFixtureMatch[]>();
      for (const m of snapshot.matches) {
        const arr = byPhase.get(m.phaseId) ?? [];
        arr.push(m);
        byPhase.set(m.phaseId, arr);
      }

      for (const [phaseId, matches] of byPhase) {
        const nextPhaseId = getNextPhaseId(pool.fixtureSnapshot, phaseId);
        if (!nextPhaseId) continue;

        const nextMatches = byPhase.get(nextPhaseId) ?? [];
        const nextStillUnresolved =
          nextMatches.length > 0 &&
          nextMatches.some((m) => isPlaceholder(m.homeTeamId) || isPlaceholder(m.awayTeamId));
        if (!nextStillUnresolved) continue;

        const thisPhaseResolved =
          matches.length > 0 &&
          matches.every((m) => !isPlaceholder(m.homeTeamId) && !isPlaceholder(m.awayTeamId));
        if (!thisPhaseResolved) continue;

        const res = await checkAndTriggerAdvancement(pool.id, matches[0]!.id, null);
        if (res.scheduled) rearmed++;
      }
    }

    if (rearmed > 0) {
      console.log(`[AdvancementTrigger] Re-armed ${rearmed} pending advancement(s) after boot`);
    }
  } catch (err) {
    console.error(
      "[AdvancementTrigger] rearmPendingAdvancements failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Cancel any pending advancement timer for a pool/phase.
 * Used when an admin wants to delay or prevent advancement.
 */
export function cancelPendingAdvancement(poolId: string, phaseId: string): boolean {
  const key = `${poolId}:${phaseId}`;
  const timer = pendingTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(key);
    return true;
  }
  return false;
}

async function sendPhaseCompletionNotifications(
  poolId: string,
  completedPhaseId: string,
  poolName: string,
): Promise<void> {
  try {
    const members = await prisma.poolMember.findMany({
      where: { poolId, status: "ACTIVE" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            country: true,
            emailNotificationsEnabled: true,
          },
        },
      },
      orderBy: { joinedAtUtc: "asc" },
    });
    if (members.length === 0) return;

    // Ranking delegated to getPoolOverview — the SAME function that
    // renders the leaderboard — so this email can never diverge from
    // the table (ADR-069; audit F2-3: this function used to score
    // inline with hardcoded 3/5 points against with-ET goals, ignoring
    // the pool's pickTypesConfig entirely).
    const { getPoolOverview } = await import("./poolOverviewService");
    const memberByUserId = new Map(members.map((m) => [m.userId, m]));
    const overview = await getPoolOverview(members[0]!.userId, poolId, false);
    const rankedRows = overview.leaderboard.rows;

    const top10 = rankedRows.slice(0, 10).map((row) => ({
      rank: row.rank,
      name: memberByUserId.get(row.userId)?.user.displayName ?? "—",
      points: row.points,
    }));

    const phaseNames = PHASE_DISPLAY_NAMES[completedPhaseId];

    // Recipients respect the user's email preference; the ranking
    // CONTENT still covers everyone.
    const emailItems = rankedRows
      .map((row) => ({ row, member: memberByUserId.get(row.userId) }))
      .filter(
        (x): x is { row: typeof x.row; member: NonNullable<typeof x.member> } =>
          !!x.member && x.member.user.emailNotificationsEnabled,
      );
    const { sent, failed } = await batchSendEmails(emailItems, (item) => {
      const locale = resolveUserLocale(item.member.user);
      const phaseName = phaseNames?.[locale] ?? phaseNames?.en ?? completedPhaseId;
      return sendPhaseCompletionSummaryEmail({
        to: item.member.user.email,
        userId: item.member.user.id,
        displayName: item.member.user.displayName,
        poolName,
        poolId,
        phaseName,
        userRank: item.row.rank,
        userPoints: item.row.points,
        totalParticipants: rankedRows.length,
        top10,
        locale,
      });
    });

    console.log(`📧 Phase completion emails for ${poolId} (${completedPhaseId}): ${sent} sent, ${failed} failed`);
  } catch (err) {
    console.error("[AdvancementTrigger] Error sending phase completion emails:", err);
  }
}

const PLACEHOLDER_PREFIXES = ["t_TBD", "W_", "L_", "RU_", "3rd_POOL_"];
function isPlaceholder(teamId: string): boolean {
  return PLACEHOLDER_PREFIXES.some((p) => teamId === "t_TBD" || teamId.startsWith(p));
}
