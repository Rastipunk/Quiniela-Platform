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
