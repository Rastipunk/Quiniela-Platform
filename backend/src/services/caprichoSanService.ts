/**
 * "Capricho San" service (ADR-075).
 *
 * For pools with the feature enabled (env-allowlisted + host toggle):
 * once a match's pick deadline passes, every ACTIVE member without a
 * prediction gets a RANDOM score pick — uniform integer in the host's
 * configured [min, max] per team — clearly marked as auto-assigned in
 * the pickJson so every player can see it was not a human pick.
 *
 * Safety rails:
 *  - Only matches in requiresScore phases (never structural picks).
 *  - Only inside the window [deadline, deadline + LOOKBACK]: enabling
 *    the feature mid-tournament never backfills old matches.
 *  - Skips matches that already have ANY result version (never assigns
 *    once a score is known — not even a provisional one).
 *  - Skips placeholder fixtures (knockout pairings not yet defined).
 *  - Idempotent: the (poolId, userId, matchId) unique constraint plus a
 *    createMany skipDuplicates makes re-runs and races harmless. A real
 *    pre-deadline pick always wins (the route rejects post-deadline
 *    saves, and the job only runs post-deadline).
 */

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { parseFixtureData } from "../lib/fixture";
import { isCaprichoSanPool, randomGoals } from "../lib/caprichoSan";
import { MS } from "../lib/constants";

/** How far back past a deadline we still assign (covers downtime). */
const LOOKBACK_MS =
  parseInt(process.env.CAPRICHO_SAN_LOOKBACK_HOURS || "6", 10) * MS.HOUR;

export interface CaprichoSanRunSummary {
  poolsProcessed: number;
  picksAssigned: number;
}

/** Sweep all enabled pools and assign random picks for due matches. */
export async function assignRandomPicksForDuePools(): Promise<CaprichoSanRunSummary> {
  const summary: CaprichoSanRunSummary = { poolsProcessed: 0, picksAssigned: 0 };

  const pools = await prisma.pool.findMany({
    where: { caprichoSanEnabled: true, status: "ACTIVE" },
    select: {
      id: true,
      caprichoSanMin: true,
      caprichoSanMax: true,
      deadlineMinutesBeforeKickoff: true,
      fixtureSnapshot: true,
      pickTypesConfig: true,
      tournamentInstance: { select: { dataJson: true } },
    },
  });

  for (const pool of pools) {
    // Defence in depth: the DB flag should never be on outside the
    // allowlist (the settings route enforces it), but never trust it.
    if (!isCaprichoSanPool(pool.id)) continue;
    summary.poolsProcessed++;

    try {
      summary.picksAssigned += await assignForPool(pool);
    } catch (err) {
      console.error(
        `[CaprichoSan] Pool ${pool.id} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return summary;
}

type PoolRow = {
  id: string;
  caprichoSanMin: number;
  caprichoSanMax: number;
  deadlineMinutesBeforeKickoff: number;
  fixtureSnapshot: unknown;
  pickTypesConfig: unknown;
  tournamentInstance: { dataJson: unknown };
};

async function assignForPool(pool: PoolRow): Promise<number> {
  const data = parseFixtureData(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
  const phases = Array.isArray(pool.pickTypesConfig)
    ? (pool.pickTypesConfig as Array<{ phaseId: string; requiresScore?: boolean }>)
    : [];
  const scorePhaseIds = new Set(
    phases.filter((p) => p.requiresScore).map((p) => p.phaseId),
  );

  const now = Date.now();
  const dueMatches = (data.matches ?? []).filter((m) => {
    if (!m.kickoffUtc || !m.phaseId || !scorePhaseIds.has(m.phaseId)) return false;
    // Knockout pairings not defined yet → nobody could have picked.
    if (!m.homeTeamId || !m.awayTeamId) return false;
    const deadline =
      new Date(m.kickoffUtc).getTime() -
      pool.deadlineMinutesBeforeKickoff * MS.MINUTE;
    return deadline <= now && now - deadline <= LOOKBACK_MS;
  });
  if (dueMatches.length === 0) return 0;

  const dueIds = dueMatches.map((m) => m.id);

  // Never assign once a score is known — not even a provisional one.
  const withResult = new Set(
    (
      await prisma.poolMatchResult.findMany({
        where: { poolId: pool.id, matchId: { in: dueIds }, currentVersionId: { not: null } },
        select: { matchId: true },
      })
    ).map((r) => r.matchId),
  );
  const targets = dueIds.filter((id) => !withResult.has(id));
  if (targets.length === 0) return 0;

  const members = await prisma.poolMember.findMany({
    where: { poolId: pool.id, status: "ACTIVE" },
    select: { userId: true },
  });
  if (members.length === 0) return 0;

  const existing = await prisma.prediction.findMany({
    where: { poolId: pool.id, matchId: { in: targets } },
    select: { userId: true, matchId: true },
  });
  const hasPick = new Set(existing.map((p) => `${p.userId}|${p.matchId}`));

  let assigned = 0;
  for (const matchId of targets) {
    const missing = members.filter((m) => !hasPick.has(`${m.userId}|${matchId}`));
    if (missing.length === 0) continue;

    const rows = missing.map((m) => ({
      poolId: pool.id,
      userId: m.userId,
      matchId,
      pickJson: {
        type: "SCORE",
        homeGoals: randomGoals(pool.caprichoSanMin, pool.caprichoSanMax),
        awayGoals: randomGoals(pool.caprichoSanMin, pool.caprichoSanMax),
        autoAssigned: true,
        autoSource: "CAPRICHO_SAN",
      },
    }));

    // skipDuplicates: a pick that slipped in concurrently always wins.
    const created = await prisma.prediction.createMany({
      data: rows,
      skipDuplicates: true,
    });
    assigned += created.count;

    if (created.count > 0) {
      await writeAuditEvent({
        actorUserId: null,
        action: "CAPRICHO_SAN_ASSIGNED",
        entityType: "Pool",
        entityId: pool.id,
        poolId: pool.id,
        dataJson: {
          matchId,
          count: created.count,
          userIds: missing.map((m) => m.userId),
          range: { min: pool.caprichoSanMin, max: pool.caprichoSanMax },
        },
      }).catch(() => {});

      console.log(
        `[CaprichoSan] Pool ${pool.id}: assigned ${created.count} random pick(s) for ${matchId}`,
      );
    }
  }

  return assigned;
}
