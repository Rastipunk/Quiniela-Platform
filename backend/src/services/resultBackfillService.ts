/**
 * Result Backfill Service (ADR-074)
 *
 * A pool that transitions DRAFT → ACTIVE after matches of its tournament
 * already finished never receives those results: liveScoresJob only fans
 * out to ACTIVE pools, and only while the match sits inside the polling
 * window (kickoff −pre/+post hours) — so the gap is permanent. Group
 * tables stay incomplete forever and the pool can never reach COMPLETED.
 *
 * On activation we seed PoolMatchResult rows for every match the scraper
 * pipeline itself finalized (MatchSyncState.syncStatus === "COMPLETED"),
 * from the confirmed LiveScore snapshot persisted in lastLiveDataJson —
 * the same payload finalizeResult wrote into the sibling pools, so the
 * seeded version is source API_CONFIRMED and goals90 derives from the
 * timeline. Matches resolved ONLY via admin master override while the
 * scraper was stuck are NOT seeded (their MatchSyncState never reached
 * COMPLETED and carries no trustworthy snapshot); the master override
 * panel remains the tool for those.
 *
 * Guarantees:
 *  - Idempotent: matches that already have a result version (any source)
 *    are never touched; re-running is a no-op.
 *  - Non-blocking: callers invoke it fire-and-forget — a backfill error
 *    must never make the activation fail.
 *  - Silent: no member emails. One audit event summarizes the seeding.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { parseFixtureData } from "../lib/fixture";
import { deriveNinetyMinuteScore } from "./scoresService/timeline";
import type { LiveScore } from "./scoresService";
import { autoPublishStructuralResults } from "./structuralAutoPublish";
import { transitionToCompleted } from "./poolStateMachine";

export interface BackfillSummary {
  seeded: number;
  skippedExisting: number;
  skippedNoPayload: number;
}

/**
 * Seed confirmed results for every already-finalized match of the pool's
 * instance that this pool is missing. Returns a summary for logging.
 */
export async function backfillConfirmedResultsForPool(
  poolId: string,
): Promise<BackfillSummary> {
  const summary: BackfillSummary = { seeded: 0, skippedExisting: 0, skippedNoPayload: 0 };

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      tournamentInstanceId: true,
      fixtureSnapshot: true,
      tournamentInstance: { select: { dataJson: true, resultSourceMode: true } },
    },
  });
  if (!pool) return summary;
  // MANUAL-mode instances have no scraper pipeline to backfill from.
  if (pool.tournamentInstance.resultSourceMode !== "AUTO") return summary;

  const data = parseFixtureData(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
  const matchIds = (data.matches ?? []).map((m) => m.id);
  if (matchIds.length === 0) return summary;

  // Matches the scraper pipeline finalized at the instance level.
  const completedStates = await prisma.matchSyncState.findMany({
    where: {
      tournamentInstanceId: pool.tournamentInstanceId,
      internalMatchId: { in: matchIds },
      syncStatus: "COMPLETED",
    },
    select: { internalMatchId: true, lastLiveDataJson: true },
  });
  if (completedStates.length === 0) return summary;

  // Results this pool already has (any source) — never touched.
  const existing = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: completedStates.map((s) => s.internalMatchId) },
    },
    select: { matchId: true, currentVersionId: true },
  });
  const hasResult = new Set(
    existing.filter((e) => e.currentVersionId != null).map((e) => e.matchId),
  );

  const seededMatchIds: string[] = [];

  for (const state of completedStates) {
    const matchId = state.internalMatchId;
    if (hasResult.has(matchId)) {
      summary.skippedExisting++;
      continue;
    }

    const score = state.lastLiveDataJson as unknown as LiveScore | null;
    if (
      !score ||
      typeof score.homeGoals !== "number" ||
      typeof score.awayGoals !== "number"
    ) {
      summary.skippedNoPayload++;
      continue;
    }

    const { homeGoals90, awayGoals90 } = deriveNinetyMinuteScore(
      score.timeline,
      score.status,
    );

    try {
      await prisma.$transaction(async (tx) => {
        // Header may exist without a current version (revert-to-draft
        // keeps results, but those carry a version and were skipped
        // above — this covers partially-created headers).
        let header = await tx.poolMatchResult.findUnique({
          where: { poolId_matchId: { poolId, matchId } },
        });
        if (header) {
          await tx.$queryRaw`SELECT id FROM "PoolMatchResult" WHERE id = ${header.id} FOR UPDATE`;
        } else {
          header = await tx.poolMatchResult.create({
            data: { poolId, matchId },
          });
        }

        const lastVersion = await tx.poolMatchResultVersion.findFirst({
          where: { resultId: header.id },
          orderBy: { versionNumber: "desc" },
        });

        const version = await tx.poolMatchResultVersion.create({
          data: {
            resultId: header.id,
            versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
            status: "PUBLISHED",
            homeGoals: score.homeGoals,
            awayGoals: score.awayGoals,
            homeGoals90,
            awayGoals90,
            homePenalties: score.penaltyHome ?? null,
            awayPenalties: score.penaltyAway ?? null,
            source: "API_CONFIRMED",
            externalFixtureId: score.apiFootballFixtureId ?? null,
            externalDataJson: score as unknown as Prisma.InputJsonValue,
            createdByUserId: null,
          },
        });

        await tx.poolMatchResult.update({
          where: { id: header.id },
          data: { currentVersionId: version.id },
        });
      });

      summary.seeded++;
      seededMatchIds.push(matchId);
    } catch (err) {
      // A concurrent liveScoresJob publish for the same match can win the
      // unique (poolId, matchId) race — that result is just as good.
      console.error(
        `[ResultBackfill] Failed to seed ${matchId} for pool ${poolId}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  if (seededMatchIds.length > 0) {
    await writeAuditEvent({
      actorUserId: null,
      action: "RESULTS_BACKFILLED_ON_ACTIVATION",
      entityType: "Pool",
      entityId: poolId,
      poolId,
      dataJson: { count: seededMatchIds.length, matchIds: seededMatchIds },
    }).catch(() => {});

    // Derive structural artifacts (Estratega group tables / knockout
    // winners) for the seeded matches. Sequential on purpose: the
    // group-complete check is per group and the advisory lock in the
    // publisher serializes anyway. Idempotent and silent.
    for (const matchId of seededMatchIds) {
      await autoPublishStructuralResults(poolId, matchId).catch((err) =>
        console.error(
          `[ResultBackfill] autoPublishStructuralResults(${matchId}) failed:`,
          err instanceof Error ? err.message : String(err),
        ),
      );
    }

    // If the tournament is actually over, the freshly-activated pool can
    // complete immediately. Idempotent — returns unless ALL matches have
    // FINAL results.
    await transitionToCompleted(poolId, null).catch(() => {});

    console.log(
      `[ResultBackfill] Pool ${poolId}: seeded ${summary.seeded} confirmed result(s) ` +
        `(${summary.skippedExisting} existing, ${summary.skippedNoPayload} without payload)`,
    );
  }

  return summary;
}
