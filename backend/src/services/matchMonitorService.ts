/**
 * Match Monitor Service (admin) — SCORE_PIPELINE_AUDIT §6, Etapa 3A.
 *
 * Read-only operational view of every match in the live window across
 * AUTO instances: scraper state (from MatchSyncState.lastLiveDataJson,
 * refreshed every poll), tracking freshness, grace countdown and the
 * per-source distribution of published results across ACTIVE pools.
 *
 * Deliberately DB-only (no live scraper calls): lastLiveDataJson is at
 * most one poll interval (15s) old, which is fresher than any extra
 * round-trip would justify and keeps this endpoint cheap enough to
 * poll from the admin UI.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { parseFixtureData } from "../lib/fixture";
import { writeAuditEvent } from "../lib/audit";
import { createLimiter } from "../lib/asyncHelpers";
import { autoPublishStructuralResults } from "./structuralAutoPublish";
import { checkAndTriggerAdvancement } from "./advancementTrigger";
import { transitionToCompleted } from "./poolStateMachine";

/** Monitor window relative to now: covers the operational match day. */
const WINDOW_BEFORE_HOURS = 12;
const WINDOW_AFTER_HOURS = 36;

export interface MatchMonitorRow {
  instanceId: string;
  instanceName: string;
  matchId: string;
  fixtureId: number | null;
  phaseId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffUtc: string;
  // Sync state
  syncStatus: string | null;
  lastApiStatus: string | null;
  elapsed: number | null;
  extra: number | null;
  graceEndUtc: string | null;
  trackedAtUtc: string | null;
  lastCheckedAtUtc: string | null;
  // Live snapshot (from lastLiveDataJson — ≤1 poll old)
  live: {
    homeGoals: number;
    awayGoals: number;
    penaltyHome: number | null;
    penaltyAway: number | null;
    status: string;
    confidence: string;
    sourcesAgreeing: number;
    sourcesTotal: number;
    lastUpdated: string | null;
  } | null;
  // Result propagation across ACTIVE pools of the instance
  activePools: number;
  resultsBySource: Record<string, number>;
}

interface LiveDataJson {
  homeGoals?: number;
  awayGoals?: number;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  status?: string;
  confidence?: string;
  sourcesAgreeing?: number;
  sourcesTotal?: number;
  lastUpdated?: string;
}

export async function getMatchMonitor(): Promise<MatchMonitorRow[]> {
  const instances = await prisma.tournamentInstance.findMany({
    where: { resultSourceMode: "AUTO", syncEnabled: true, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      dataJson: true,
      matchMappings: {
        select: { internalMatchId: true, apiFootballFixtureId: true },
      },
    },
  });

  const now = Date.now();
  const windowStart = now - WINDOW_BEFORE_HOURS * 3600_000;
  const windowEnd = now + WINDOW_AFTER_HOURS * 3600_000;

  const rows: MatchMonitorRow[] = [];

  for (const inst of instances) {
    const fixture = parseFixtureData(inst.dataJson);
    const teamName = (id: string): string =>
      fixture.teams.find((t) => t.id === id)?.name ?? id;
    const fixtureIdByMatch = new Map(
      inst.matchMappings.map((m) => [m.internalMatchId, m.apiFootballFixtureId]),
    );

    const windowMatches = fixture.matches.filter((m) => {
      if (!m.kickoffUtc) return false;
      const ko = new Date(m.kickoffUtc).getTime();
      return !Number.isNaN(ko) && ko >= windowStart && ko <= windowEnd;
    });
    if (windowMatches.length === 0) continue;

    const matchIds = windowMatches.map((m) => m.id);

    const [syncStates, activePools, sourceCounts] = await Promise.all([
      prisma.matchSyncState.findMany({
        where: {
          tournamentInstanceId: inst.id,
          internalMatchId: { in: matchIds },
        },
      }),
      prisma.pool.count({
        where: { tournamentInstanceId: inst.id, status: "ACTIVE" },
      }),
      // Per-source distribution of CURRENT result versions across the
      // instance's ACTIVE pools — "311/311 API_CONFIRMED" at a glance.
      prisma.$queryRaw<Array<{ matchId: string; source: string; n: number }>>`
        SELECT r."matchId" AS "matchId", v.source::text AS source, COUNT(*)::int AS n
        FROM "PoolMatchResult" r
        JOIN "PoolMatchResultVersion" v ON v.id = r."currentVersionId"
        JOIN "Pool" p ON p.id = r."poolId"
        WHERE p."tournamentInstanceId" = ${inst.id}
          AND p.status = 'ACTIVE'
          AND r."matchId" IN (${Prisma.join(matchIds)})
        GROUP BY 1, 2`.catch(() => [] as Array<{ matchId: string; source: string; n: number }>),
    ]);

    const stateByMatch = new Map(syncStates.map((s) => [s.internalMatchId, s]));
    const sourcesByMatch = new Map<string, Record<string, number>>();
    for (const sc of sourceCounts) {
      const entry = sourcesByMatch.get(sc.matchId) ?? {};
      entry[sc.source] = sc.n;
      sourcesByMatch.set(sc.matchId, entry);
    }

    for (const m of windowMatches) {
      const state = stateByMatch.get(m.id);
      const liveJson = (state?.lastLiveDataJson ?? null) as LiveDataJson | null;
      rows.push({
        instanceId: inst.id,
        instanceName: inst.name,
        matchId: m.id,
        fixtureId: fixtureIdByMatch.get(m.id) ?? null,
        phaseId: m.phaseId,
        homeTeamName: teamName(m.homeTeamId),
        awayTeamName: teamName(m.awayTeamId),
        kickoffUtc: m.kickoffUtc,
        syncStatus: state?.syncStatus ?? null,
        lastApiStatus: state?.lastApiStatus ?? null,
        elapsed: state?.lastElapsed ?? null,
        extra: state?.lastExtra ?? null,
        graceEndUtc: state?.graceEndUtc?.toISOString() ?? null,
        trackedAtUtc: state?.trackedAtUtc?.toISOString() ?? null,
        lastCheckedAtUtc: state?.lastCheckedAtUtc?.toISOString() ?? null,
        live: liveJson && typeof liveJson.homeGoals === "number"
          ? {
              homeGoals: liveJson.homeGoals,
              awayGoals: liveJson.awayGoals ?? 0,
              penaltyHome: liveJson.penaltyHome ?? null,
              penaltyAway: liveJson.penaltyAway ?? null,
              status: liveJson.status ?? "?",
              confidence: liveJson.confidence ?? "?",
              sourcesAgreeing: liveJson.sourcesAgreeing ?? 0,
              sourcesTotal: liveJson.sourcesTotal ?? 0,
              lastUpdated: liveJson.lastUpdated ?? null,
            }
          : null,
        activePools,
        resultsBySource: sourcesByMatch.get(m.id) ?? {},
      });
    }
  }

  rows.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  return rows;
}

// ============================================================================
// Master override (Etapa 3B — audit §6)
// ============================================================================

export interface MasterOverrideInput {
  instanceId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  homeGoals90?: number | null;
  awayGoals90?: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  reason: string;
  /** When false (default), pools whose host already overrode keep their value. */
  overwriteHostOverrides?: boolean;
  actorUserId: string;
}

export interface MasterOverrideSummary {
  totalPools: number;
  updated: number;
  unchanged: number;
  skippedHostOverride: string[];
  failed: Array<{ poolId: string; error: string }>;
}

type CurrentVersionLike = {
  source: string;
  homeGoals: number;
  awayGoals: number;
  homeGoals90: number | null;
  awayGoals90: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
} | null;

/**
 * Per-pool decision, pure and unit-tested:
 * - "skip_host": the pool's host already overrode and the admin didn't
 *   opt into overwriting — the host's judgment wins by default.
 * - "unchanged": an identical HOST_OVERRIDE already exists — no churn.
 * - "write": create a new HOST_OVERRIDE version (also when the values
 *   match a non-override source: the override FREEZES the result
 *   against any further scraper write per the source hierarchy).
 */
export function decideMasterOverrideAction(
  cv: CurrentVersionLike,
  input: Pick<MasterOverrideInput, "homeGoals" | "awayGoals" | "homeGoals90" | "awayGoals90" | "homePenalties" | "awayPenalties" | "overwriteHostOverrides">,
): "skip_host" | "unchanged" | "write" {
  if (!cv) return "write";
  const identical =
    cv.homeGoals === input.homeGoals &&
    cv.awayGoals === input.awayGoals &&
    cv.homeGoals90 === (input.homeGoals90 ?? null) &&
    cv.awayGoals90 === (input.awayGoals90 ?? null) &&
    cv.homePenalties === (input.homePenalties ?? null) &&
    cv.awayPenalties === (input.awayPenalties ?? null);
  if (cv.source === "HOST_OVERRIDE") {
    if (identical) return "unchanged";
    if (!input.overwriteHostOverrides) return "skip_host";
  }
  return "write";
}

/** Post-write hooks run with bounded concurrency: unbounded fan-out
 *  across hundreds of pools exhausted Postgres connections before
 *  (admin-dashboard incident, 2026-06-10). */
const HOOK_CONCURRENCY = 4;

/**
 * Applies an admin result override to EVERY ACTIVE pool of an instance
 * in one operation — the "master override" the per-pool host flow never
 * had (audit F1-10). Writes source=HOST_OVERRIDE (top of the hierarchy:
 * the scraper will never overwrite it), reason mandatory, NO member
 * emails by design (this is the scraper-correction path — precedent:
 * the silent 30-may override; hosts who override answer to their own
 * members, the platform admin does not mass-email 300 pools).
 */
export async function applyMasterOverride(
  input: MasterOverrideInput,
): Promise<MasterOverrideSummary> {
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: input.instanceId },
    select: { id: true, name: true, dataJson: true },
  });
  if (!instance) throw new Error("INSTANCE_NOT_FOUND");

  const fixture = parseFixtureData(instance.dataJson);
  const match = fixture.matches.find((m) => m.id === input.matchId);
  if (!match) throw new Error("MATCH_NOT_FOUND_IN_INSTANCE");

  const pools = await prisma.pool.findMany({
    where: { tournamentInstanceId: input.instanceId, status: "ACTIVE" },
    select: { id: true },
  });

  const summary: MasterOverrideSummary = {
    totalPools: pools.length,
    updated: 0,
    unchanged: 0,
    skippedHostOverride: [],
    failed: [],
  };
  const updatedPoolIds: string[] = [];

  // Sequential writes: each tx is tiny; parallelizing hundreds of
  // row-locked transactions buys little and risks the connection pool.
  for (const pool of pools) {
    try {
      const action = await prisma.$transaction(async (tx) => {
        let header = await tx.poolMatchResult.findUnique({
          where: { poolId_matchId: { poolId: pool.id, matchId: input.matchId } },
          include: { currentVersion: true },
        });

        const decision = decideMasterOverrideAction(
          header?.currentVersion ?? null,
          input,
        );
        if (decision !== "write") return decision;

        if (header) {
          await tx.$queryRaw`SELECT id FROM "PoolMatchResult" WHERE id = ${header.id} FOR UPDATE`;
        } else {
          // Emergency path: the scraper never published for this pool —
          // the master override must still be able to set the result.
          header = await tx.poolMatchResult.create({
            data: { poolId: pool.id, matchId: input.matchId },
            include: { currentVersion: true },
          });
        }

        const lastVersion = await tx.poolMatchResultVersion.findFirst({
          where: { resultId: header.id },
          orderBy: { versionNumber: "desc" },
          select: { versionNumber: true },
        });

        const version = await tx.poolMatchResultVersion.create({
          data: {
            resultId: header.id,
            versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
            status: "PUBLISHED",
            homeGoals: input.homeGoals,
            awayGoals: input.awayGoals,
            homeGoals90: input.homeGoals90 ?? null,
            awayGoals90: input.awayGoals90 ?? null,
            homePenalties: input.homePenalties ?? null,
            awayPenalties: input.awayPenalties ?? null,
            source: "HOST_OVERRIDE",
            reason: input.reason,
            createdByUserId: input.actorUserId,
          },
        });
        await tx.poolMatchResult.update({
          where: { id: header.id },
          data: { currentVersionId: version.id },
        });
        return "write" as const;
      });

      if (action === "skip_host") summary.skippedHostOverride.push(pool.id);
      else if (action === "unchanged") summary.unchanged++;
      else {
        summary.updated++;
        updatedPoolIds.push(pool.id);
      }
    } catch (err) {
      summary.failed.push({
        poolId: pool.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Downstream hooks for every updated pool (structural derivations,
  // advancement, pool completion) — bounded concurrency.
  const limit = createLimiter(HOOK_CONCURRENCY);
  await Promise.all(
    updatedPoolIds.map((poolId) =>
      limit(async () => {
        try {
          await autoPublishStructuralResults(poolId, input.matchId);
          await checkAndTriggerAdvancement(poolId, input.matchId, input.actorUserId);
          await transitionToCompleted(poolId, input.actorUserId);
        } catch (err) {
          console.error(
            `[MasterOverride] post-hooks failed for pool ${poolId}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }),
    ),
  );

  await writeAuditEvent({
    actorUserId: input.actorUserId,
    action: "MASTER_RESULT_OVERRIDE",
    entityType: "TournamentInstance",
    entityId: input.instanceId,
    dataJson: {
      matchId: input.matchId,
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      homeGoals90: input.homeGoals90 ?? null,
      awayGoals90: input.awayGoals90 ?? null,
      homePenalties: input.homePenalties ?? null,
      awayPenalties: input.awayPenalties ?? null,
      reason: input.reason,
      overwriteHostOverrides: !!input.overwriteHostOverrides,
      summary: {
        totalPools: summary.totalPools,
        updated: summary.updated,
        unchanged: summary.unchanged,
        skippedHostOverride: summary.skippedHostOverride.length,
        failed: summary.failed.length,
      },
    },
  });

  return summary;
}

// ============================================================================
// Quick actions (Etapa 3C — audit §6)
// ============================================================================

/**
 * Force re-registration of one fixture with picks4all-scores: clears
 * the trackedAtUtc stamp (so the monitor reflects reality) and runs
 * the real fixtureTrackingJob immediately. Since f7f27f0 the hourly
 * job re-sends idempotently anyway — this button buys IMMEDIACY when
 * the scraper lost a fixture mid-match.
 */
export async function retrackMatch(
  instanceId: string,
  matchId: string,
  actorUserId: string,
): Promise<{ triggered: true }> {
  await prisma.matchSyncState.updateMany({
    where: { tournamentInstanceId: instanceId, internalMatchId: matchId },
    data: { trackedAtUtc: null },
  });

  const { triggerFixtureTracking } = await import("../jobs/fixtureTrackingJob");
  await triggerFixtureTracking();

  await writeAuditEvent({
    actorUserId,
    action: "MATCH_RETRACK_TRIGGERED",
    entityType: "MatchSyncState",
    entityId: matchId,
    dataJson: { instanceId, matchId },
  });

  return { triggered: true };
}

/**
 * Instance-wide scoring exclusion (the ABD tool — audit F1-6): apply
 * PoolMatchOverride.scoringEnabled=false to EVERY ACTIVE pool of the
 * instance (or lift it everywhere). Per-pool overrides set by hosts are
 * replaced — this is deliberate: an abandoned/annulled match is a
 * tournament-level fact, not a per-pool opinion.
 */
export async function applyMasterScoringExclusion(input: {
  instanceId: string;
  matchId: string;
  scoringEnabled: boolean;
  reason: string;
  actorUserId: string;
}): Promise<{ totalPools: number; applied: number }> {
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: input.instanceId },
    select: { id: true, dataJson: true },
  });
  if (!instance) throw new Error("INSTANCE_NOT_FOUND");
  const fixture = parseFixtureData(instance.dataJson);
  if (!fixture.matches.some((m) => m.id === input.matchId)) {
    throw new Error("MATCH_NOT_FOUND_IN_INSTANCE");
  }

  const pools = await prisma.pool.findMany({
    where: { tournamentInstanceId: input.instanceId, status: "ACTIVE" },
    select: { id: true },
  });
  const poolIds = pools.map((p) => p.id);

  let applied = 0;
  if (poolIds.length > 0) {
    // Reset existing rows first so enable/disable are both idempotent.
    await prisma.poolMatchOverride.deleteMany({
      where: { matchId: input.matchId, poolId: { in: poolIds } },
    });
    if (!input.scoringEnabled) {
      const created = await prisma.poolMatchOverride.createMany({
        data: poolIds.map((poolId) => ({
          poolId,
          matchId: input.matchId,
          scoringEnabled: false,
          reason: input.reason,
          setByUserId: input.actorUserId,
        })),
      });
      applied = created.count;
    } else {
      applied = poolIds.length;
    }
  }

  await writeAuditEvent({
    actorUserId: input.actorUserId,
    action: input.scoringEnabled ? "MASTER_SCORING_ENABLED" : "MASTER_SCORING_DISABLED",
    entityType: "TournamentInstance",
    entityId: input.instanceId,
    dataJson: {
      matchId: input.matchId,
      scoringEnabled: input.scoringEnabled,
      reason: input.reason,
      totalPools: poolIds.length,
    },
  });

  return { totalPools: poolIds.length, applied };
}
