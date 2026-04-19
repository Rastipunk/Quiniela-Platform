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
import { ADVANCEMENT, PHASE_DISPLAY_NAMES, countryToLocale } from "../lib/constants";
import { advanceToRoundOf32, advanceKnockoutPhase } from "./instanceAdvancement";
import { writeAuditEvent } from "../lib/audit";
import { sendAdminNotification, sendPhaseCompletionSummaryEmail, batchSendEmails } from "../lib/email";
import { typed, type PickJson } from "../lib/fixture";

// In-memory map of pending advancement timers (per pool+phase).
// Key: `${poolId}:${phaseId}`
const pendingTimers = new Map<string, NodeJS.Timeout>();

const NEXT_PHASE_MAP: Record<string, string | null> = {
  group_stage: "round_of_32",
  round_of_32: "round_of_16",
  round_of_16: "quarter_finals",
  quarter_finals: "semi_finals",
  semi_finals: "final",
  final: null, // tournament complete
};

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
    const nextPhaseId = NEXT_PHASE_MAP[phaseId];
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

    const confirmedSources = new Set(["API_CONFIRMED", "HOST_OVERRIDE", "HOST_MANUAL"]);
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
    const confirmedSources = new Set(["API_CONFIRMED", "HOST_OVERRIDE", "HOST_MANUAL"]);
    const stillComplete =
      results.length === phaseMatches.length &&
      results.every((r) => r.currentVersion && confirmedSources.has(r.currentVersion.source));

    if (!stillComplete) {
      console.log(
        `[AdvancementTrigger] Phase ${completedPhaseId} no longer complete for pool ${poolId}. Aborting advancement.`
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
      subject: `Phase advanced: ${completedPhaseId} → ${nextPhaseId}`,
      body: `<p>Pool <strong>${pool.name}</strong> automatically advanced from ${completedPhaseId} to ${nextPhaseId}.</p>`,
      type: "feedback",
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
      subject: `Phase advancement FAILED: ${completedPhaseId} → ${nextPhaseId}`,
      body: `<p>Pool ${poolId} failed to advance automatically.</p><p><strong>Error:</strong> ${errMsg}</p><p>Manual intervention required.</p>`,
      type: "error",
    }).catch(() => {});
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
        user: { select: { id: true, email: true, displayName: true, country: true } },
      },
      orderBy: { joinedAtUtc: "asc" },
    });

    const predictions = await prisma.prediction.findMany({
      where: { poolId },
    });

    const poolResults = await prisma.poolMatchResult.findMany({
      where: { poolId },
      include: { currentVersion: true },
    });

    const resultByMatchId = new Map<string, { homeGoals: number; awayGoals: number }>();
    for (const r of poolResults) {
      if (r.currentVersion) {
        resultByMatchId.set(r.matchId, {
          homeGoals: r.currentVersion.homeGoals,
          awayGoals: r.currentVersion.awayGoals,
        });
      }
    }

    // Calculate points per user (same logic as poolStateMachine)
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
            points = 5;
          }
        }
      }

      const current = userPoints.get(pred.userId) ?? 0;
      userPoints.set(pred.userId, current + points);
    }

    const sortedMembers = members
      .map((m) => ({ ...m, points: userPoints.get(m.userId) ?? 0 }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return new Date(a.joinedAtUtc).getTime() - new Date(b.joinedAtUtc).getTime();
      });

    const top10 = sortedMembers.slice(0, 10).map((m, idx) => ({
      rank: idx + 1,
      name: m.user.displayName,
      points: m.points,
    }));

    const phaseNames = PHASE_DISPLAY_NAMES[completedPhaseId];

    const emailItems = sortedMembers.map((member, idx) => ({ member, rank: idx + 1 }));
    const { sent, failed } = await batchSendEmails(emailItems, (item) => {
      const locale = countryToLocale(item.member.user.country);
      const phaseName = phaseNames?.[locale] ?? phaseNames?.en ?? completedPhaseId;
      return sendPhaseCompletionSummaryEmail({
        to: item.member.user.email,
        userId: item.member.user.id,
        displayName: item.member.user.displayName,
        poolName,
        poolId,
        phaseName,
        userRank: item.rank,
        userPoints: item.member.points,
        totalParticipants: sortedMembers.length,
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
