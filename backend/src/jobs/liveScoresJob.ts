/**
 * Live Scores Job
 *
 * THE CORE integration with picks4all-scores.
 * Polls every 15 seconds (configurable) for live scores from the scraping service,
 * and publishes SCRAPER_PROVISIONAL results to pools.
 *
 * Guard: isRunning flag prevents overlapping polls.
 * Each poll checks PlatformSettings.scoresServiceEnabled before proceeding.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getScoresServiceClient, LiveScore } from "../services/scoresService";
import { recordHeartbeat } from "../lib/cronHeartbeat";
import {
  deriveNinetyMinuteScore,
  terminalConfirmationCount,
} from "../services/scoresService/timeline";
import { writeAuditEvent } from "../lib/audit";
import { fireAndForget } from "../lib/asyncHelpers";
import { FINISHED_STATUSES } from "../services/apiFootball/types";
import { SCORES } from "../lib/constants";
import { checkAndTriggerAdvancement } from "../services/advancementTrigger";
import { transitionToCompleted } from "../services/poolStateMachine";
import { autoPublishStructuralResults } from "../services/structuralAutoPublish";
import { detectAndAlertStaleMatches } from "../services/scoresService/staleDetector";

// ============================================================================
// Configuration
// ============================================================================

const envInt = (key: string, fallback: number): number =>
  parseInt(process.env[key] || String(fallback), 10);

const envStr = (key: string, fallback: string): string =>
  process.env[key] || fallback;

const POLL_INTERVAL_MS = envInt("SCORES_POLL_INTERVAL_MS", 15_000);
const MIN_CONFIDENCE = envStr("SCORES_MIN_CONFIDENCE", "MEDIUM") as LiveScore["confidence"];

/**
 * Active polling window relative to a match's kickoff.
 *
 * - PRE: Only poll matches whose kickoff has already passed (or is within
 *        a small buffer). Default: 0h + 5min buffer.
 *        The scraper only returns data for matches that have actually started,
 *        so polling before kickoff is wasteful.
 * - POST: how many hours AFTER kickoff we keep polling, to catch late
 *         finishers, ET, penalties, and source disagreements. Default: 3h.
 *
 * Both are env-configurable so we can widen/tighten without redeploying code.
 */
const WINDOW_PRE_HOURS_MS = envInt("SCORES_WINDOW_PRE_HOURS", 0) * 60 * 60_000;
const WINDOW_PRE_MINUTES_MS = envInt("SCORES_WINDOW_PRE_MINUTES", 5) * 60_000;
const WINDOW_PRE_MS = Math.max(WINDOW_PRE_HOURS_MS, WINDOW_PRE_MINUTES_MS);
const WINDOW_POST_MS = envInt("SCORES_WINDOW_POST_HOURS", 3) * 60 * 60_000;

/** Confidence hierarchy for comparison */
const CONFIDENCE_LEVELS: Record<LiveScore["confidence"], number> = {
  VERY_HIGH: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  NONE: 0,
};

// ============================================================================
// Job State
// ============================================================================

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Stale-match scan cadence. The stale horizon is hours, so we don't need
 * to scan on every 15s poll — throttle it. Env-configurable.
 */
const STALE_SCAN_INTERVAL_MS = envInt("SCORES_STALE_SCAN_INTERVAL_MS", 5 * 60_000);
let lastStaleScanAtMs = 0;

// ============================================================================
// Types
// ============================================================================

interface FixtureMapEntry {
  internalMatchId: string;
  tournamentInstanceId: string;
  poolIds: string[];
  kickoffUtc: string;
}

// ============================================================================
// Core: Build Fixture Map
// ============================================================================

/**
 * Build a Map<apiFootballFixtureId, FixtureMapEntry> for all matches
 * in the active window (-3h to +4h from now).
 */
async function buildFixtureMap(): Promise<Map<number, FixtureMapEntry>> {
  const map = new Map<number, FixtureMapEntry>();

  // 1. Get all AUTO, syncEnabled, ACTIVE instances
  const instances = await prisma.tournamentInstance.findMany({
    where: {
      resultSourceMode: "AUTO",
      syncEnabled: true,
      status: "ACTIVE",
    },
    select: {
      id: true,
      dataJson: true,
      matchMappings: {
        select: {
          internalMatchId: true,
          apiFootballFixtureId: true,
        },
      },
      pools: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
  });

  const now = Date.now();
  // A fixture is "active" if its kickoff is within the polling window:
  // from WINDOW_POST_MS hours ago (catch late finishers / ET) up to
  // WINDOW_PRE_MS hours ahead (start tracking before kickoff).
  const windowStart = now - WINDOW_POST_MS;
  const windowEnd = now + WINDOW_PRE_MS;

  for (const inst of instances) {
    const poolIds = inst.pools.map((p) => p.id);
    if (poolIds.length === 0) continue;

    const data = inst.dataJson as {
      matches?: Array<{
        id: string;
        kickoffUtc?: string;
      }>;
    } | null;

    if (!data?.matches) continue;

    // Index matches by id for fast lookup
    const matchByIdMap = new Map<string, string>();
    for (const m of data.matches) {
      if (m.kickoffUtc) {
        matchByIdMap.set(m.id, m.kickoffUtc);
      }
    }

    for (const mapping of inst.matchMappings) {
      const kickoffUtc = matchByIdMap.get(mapping.internalMatchId);
      if (!kickoffUtc) continue;

      const kickoff = new Date(kickoffUtc).getTime();
      if (kickoff < windowStart || kickoff > windowEnd) continue;

      map.set(mapping.apiFootballFixtureId, {
        internalMatchId: mapping.internalMatchId,
        tournamentInstanceId: inst.id,
        poolIds,
        kickoffUtc,
      });
    }
  }

  return map;
}

// ============================================================================
// Core: Process a Live Score
// ============================================================================

async function processLiveScore(
  entry: FixtureMapEntry,
  score: LiveScore
): Promise<void> {
  const isFinished = FINISHED_STATUSES.includes(score.status as typeof FINISHED_STATUSES[number]);
  const now = new Date();

  // Read current MatchSyncState (needed for grace period logic)
  const syncState = await prisma.matchSyncState.findFirst({
    where: {
      tournamentInstanceId: entry.tournamentInstanceId,
      internalMatchId: entry.internalMatchId,
    },
  });

  // Real-time drift detection: compare actualKickoffUtc (from sources) with our registered kickoff
  if (score.actualKickoffUtc && entry.kickoffUtc) {
    const ours = new Date(entry.kickoffUtc).getTime();
    const observed = new Date(score.actualKickoffUtc).getTime();
    const driftMs = Math.abs(observed - ours);
    // Alert if drift > 30 minutes — likely a reschedule
    if (driftMs > 30 * 60_000) {
      console.warn(
        `[LiveScoresJob] Kickoff drift detected for ${entry.internalMatchId}: ` +
          `ours=${entry.kickoffUtc} observed=${score.actualKickoffUtc} diff=${Math.round(driftMs / 60_000)}min`
      );
    }
  }

  // Determine new sync status based on grace period logic
  let newSyncStatus: string;
  let newGraceEndUtc: Date | null = syncState?.graceEndUtc ?? null;
  let newCompletedAtUtc: Date | null = null;
  let shouldFinalize = false;

  if (isFinished) {
    // Require enough independent sources to have confirmed the terminal
    // milestone before we treat the match as finalizable. Below the
    // threshold we keep polling. ⚠️ If it never reaches the threshold the
    // ONLY backstops are the stale-detector ALERT (email at 210 min) and a
    // manual HOST_OVERRIDE — there is NO automatic fallback: API-Football
    // is no longer used and smartSync is inert (isAvailable() === false).
    const confirmations = terminalConfirmationCount(
      score.timeline,
      score.sourcesAgreeing,
    );
    const enoughConfirmations =
      confirmations >= SCORES.MIN_CONFIRMATIONS_TO_FINALIZE;

    if (!enoughConfirmations) {
      // Terminal status but not yet enough confirmations — hold in
      // AWAITING_FINISH without arming the grace period.
      newSyncStatus = "AWAITING_FINISH";
    } else if (!syncState?.graceEndUtc) {
      // FT detected (and confirmed) for the first time → start grace period
      newSyncStatus = "AWAITING_FINISH";
      newGraceEndUtc = new Date(now.getTime() + SCORES.GRACE_PERIOD_MS);
    } else if (now.getTime() >= syncState.graceEndUtc.getTime()) {
      // Grace period expired → finalize
      newSyncStatus = "COMPLETED";
      newCompletedAtUtc = now;
      shouldFinalize = true;
    } else {
      // Still within grace period — keep polling
      newSyncStatus = "AWAITING_FINISH";
    }
  } else {
    // Match still in progress
    newSyncStatus = "IN_PROGRESS";
    // If score changes during grace period, reset it
    if (syncState?.graceEndUtc) {
      newGraceEndUtc = null; // score changed → match not actually finished
    }
  }

  // Update MatchSyncState with live data + status
  try {
    await prisma.matchSyncState.updateMany({
      where: {
        tournamentInstanceId: entry.tournamentInstanceId,
        internalMatchId: entry.internalMatchId,
      },
      data: {
        lastApiStatus: score.status,
        lastCheckedAtUtc: now,
        lastElapsed: score.elapsed,
        lastExtra: score.extra,
        lastLiveDataJson: score as unknown as Prisma.InputJsonValue,
        syncStatus: newSyncStatus as any,
        graceEndUtc: newGraceEndUtc,
        ...(newCompletedAtUtc ? { completedAtUtc: newCompletedAtUtc } : {}),
      },
    });
  } catch {
    // MatchSyncState may not exist for all matches — non-critical
  }

  // A match that hasn't kicked off yet (NS — the scraper reports
  // tracked fixtures from kickoff−5min) must NOT create a provisional
  // 0-0 result row: it rendered as "Resultado oficial 0-0" before the
  // game started (audit A4). MatchSyncState was already updated above,
  // so the live badge / window logic is unaffected.
  if (score.status === "NS") return;

  // For each pool, create/update result
  for (const poolId of entry.poolIds) {
    try {
      if (shouldFinalize) {
        // Grace period expired — upgrade SCRAPER_PROVISIONAL → API_CONFIRMED
        await finalizeResult(poolId, entry, score);
      } else {
        // Match in progress or grace period ongoing — publish provisional
        await publishScraperResult(poolId, entry, score, isFinished);
      }
    } catch (error) {
      console.error(
        `[LiveScoresJob] Error publishing result for pool ${poolId}, match ${entry.internalMatchId}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

async function publishScraperResult(
  poolId: string,
  entry: FixtureMapEntry,
  score: LiveScore,
  isFinished: boolean
): Promise<void> {
  // a. Get existing PoolMatchResult
  const existingResult = await prisma.poolMatchResult.findUnique({
    where: {
      poolId_matchId: { poolId, matchId: entry.internalMatchId },
    },
    include: { currentVersion: true },
  });

  // b. Skip if already has API_CONFIRMED or HOST_OVERRIDE (authoritative sources)
  if (existingResult?.currentVersion?.source === "API_CONFIRMED") {
    return;
  }
  if (existingResult?.currentVersion?.source === "HOST_OVERRIDE") {
    return;
  }

  // c. Skip if SCRAPER_PROVISIONAL with same score already exists (no change)
  if (existingResult?.currentVersion?.source === "SCRAPER_PROVISIONAL") {
    const cv = existingResult.currentVersion;
    if (
      cv.homeGoals === score.homeGoals &&
      cv.awayGoals === score.awayGoals &&
      cv.homePenalties === score.penaltyHome &&
      cv.awayPenalties === score.penaltyAway
    ) {
      return; // Score unchanged — no new version needed
    }
  }

  // d. For matches that went to extra time, store the minute-90 score
  //    separately. The scores service no longer fills fulltime/extratime
  //    (always null) — derive end-of-regulation from the timeline[] (the
  //    `ET` milestone carries the score with which ET began). See
  //    FOR-PICKS4ALL-INTEGRATION §4-§5 and scoresService/timeline.ts.
  const { homeGoals90, awayGoals90 } = deriveNinetyMinuteScore(
    score.timeline,
    score.status,
  );

  // Build externalDataJson snapshot
  const externalDataJson: Prisma.InputJsonValue = {
    apiFootballFixtureId: score.apiFootballFixtureId,
    status: score.status,
    elapsed: score.elapsed,
    extra: score.extra,
    confidence: score.confidence,
    sourcesAgreeing: score.sourcesAgreeing,
    sourcesTotal: score.sourcesTotal,
    lastUpdated: score.lastUpdated,
    homeTeamName: score.homeTeamName,
    awayTeamName: score.awayTeamName,
    score: {
      halftime: { home: score.halftimeHome, away: score.halftimeAway },
      fulltime: { home: score.fulltimeHome, away: score.fulltimeAway },
      extratime: { home: score.extratimeHome, away: score.extratimeAway },
      penalty: { home: score.penaltyHome, away: score.penaltyAway },
    },
    isFinished,
  };

  // e. Create version in transaction (same pattern as SmartSync publishResult)
  await prisma.$transaction(async (tx) => {
    let headerId: string;

    if (existingResult) {
      // Lock the header row to serialize concurrent result publications
      await tx.$queryRaw`SELECT id FROM "PoolMatchResult" WHERE id = ${existingResult.id} FOR UPDATE`;
      headerId = existingResult.id;
    } else {
      const created = await tx.poolMatchResult.create({
        data: { poolId, matchId: entry.internalMatchId },
      });
      headerId = created.id;
    }

    const lastVersion = await tx.poolMatchResultVersion.findFirst({
      where: { resultId: headerId },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;

    const version = await tx.poolMatchResultVersion.create({
      data: {
        resultId: headerId,
        versionNumber: nextVersion,
        status: "PUBLISHED",
        homeGoals: score.homeGoals,
        awayGoals: score.awayGoals,
        homeGoals90,
        awayGoals90,
        homePenalties: score.penaltyHome,
        awayPenalties: score.penaltyAway,
        source: "SCRAPER_PROVISIONAL",
        externalFixtureId: score.apiFootballFixtureId,
        externalDataJson,
        createdByUserId: null,
      },
    });

    await tx.poolMatchResult.update({
      where: { id: headerId },
      data: { currentVersionId: version.id },
    });
  });

  // f. Fire-and-forget audit event
  fireAndForget(
    "LiveScoresJob:audit",
    writeAuditEvent({
      actorUserId: null,
      action: "RESULT_SYNCED_FROM_SCRAPER",
      entityType: "PoolMatchResult",
      entityId: entry.internalMatchId,
      poolId,
      dataJson: {
        matchId: entry.internalMatchId,
        fixtureId: score.apiFootballFixtureId,
        homeGoals: score.homeGoals,
        awayGoals: score.awayGoals,
        confidence: score.confidence,
        status: score.status,
        sourcesAgreeing: score.sourcesAgreeing,
        sourcesTotal: score.sourcesTotal,
        isFinished,
      },
    })
  );

  console.log(
    `[LiveScoresJob] Published SCRAPER_PROVISIONAL for ${entry.internalMatchId} ` +
      `(pool ${poolId}): ${score.homeGoals}-${score.awayGoals} ` +
      `[${score.status}, confidence=${score.confidence}]`
  );

  // The host-publish path (resultService.handleAutoAdvance) calls
  // transitionToCompleted after every result; the scraper path used to
  // skip this entirely, so AUTO-mode pools were stuck in ACTIVE forever
  // once the scraper finalised the last match. transitionToCompleted is
  // idempotent (it returns immediately if status !== ACTIVE or any
  // match still has no result), so calling it on every publish is
  // safe.
  if (isFinished) {
    fireAndForget(
      "LiveScoresJob:check-pool-completed",
      transitionToCompleted(poolId, null),
    );
  }
}

// ============================================================================
// Core: Finalize Result (grace period expired → upgrade to API_CONFIRMED)
// ============================================================================

/**
 * After the 5-minute grace period, upgrade the last SCRAPER_PROVISIONAL
 * to API_CONFIRMED — making it the authoritative result.
 */
async function finalizeResult(
  poolId: string,
  entry: FixtureMapEntry,
  score: LiveScore
): Promise<void> {
  const existingResult = await prisma.poolMatchResult.findUnique({
    where: {
      poolId_matchId: { poolId, matchId: entry.internalMatchId },
    },
    include: { currentVersion: true },
  });

  // Only finalize if current source is SCRAPER_PROVISIONAL
  if (!existingResult?.currentVersion) return;
  if (existingResult.currentVersion.source !== "SCRAPER_PROVISIONAL") return;

  const cv = existingResult.currentVersion;

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PoolMatchResult" WHERE id = ${existingResult.id} FOR UPDATE`;

    const lastVersion = await tx.poolMatchResultVersion.findFirst({
      where: { resultId: existingResult.id },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;

    const version = await tx.poolMatchResultVersion.create({
      data: {
        resultId: existingResult.id,
        versionNumber: nextVersion,
        status: "PUBLISHED",
        homeGoals: cv.homeGoals,
        awayGoals: cv.awayGoals,
        homeGoals90: cv.homeGoals90,
        awayGoals90: cv.awayGoals90,
        homePenalties: cv.homePenalties,
        awayPenalties: cv.awayPenalties,
        source: "API_CONFIRMED",
        externalFixtureId: cv.externalFixtureId,
        externalDataJson: score as unknown as Prisma.InputJsonValue,
        createdByUserId: null,
      },
    });

    await tx.poolMatchResult.update({
      where: { id: existingResult.id },
      data: { currentVersionId: version.id },
    });
  });

  fireAndForget(
    "LiveScoresJob:finalize-audit",
    writeAuditEvent({
      actorUserId: null,
      action: "RESULT_FINALIZED_BY_SCRAPER",
      entityType: "PoolMatchResult",
      entityId: entry.internalMatchId,
      poolId,
      dataJson: {
        matchId: entry.internalMatchId,
        homeGoals: cv.homeGoals,
        awayGoals: cv.awayGoals,
        status: score.status,
        confidence: score.confidence,
      },
    })
  );

  console.log(
    `[LiveScoresJob] Finalized ${entry.internalMatchId} ` +
      `(pool ${poolId}): ${cv.homeGoals}-${cv.awayGoals} → API_CONFIRMED ` +
      `[grace period complete]`
  );

  // Auto-publish structural results (Estratega): if this pool's
  // phase is GROUP_STANDINGS and the group is now complete, derive
  // the FIFA table and upsert GroupStandingsResult. If KNOCKOUT_WINNER,
  // merge the winnerId into StructuralPhaseResult.matches[]. No-op
  // for score-based presets. Runs BEFORE the advancement trigger so
  // validateCanAutoAdvance sees the freshly-published structural
  // result when the 10-minute window elapses.
  fireAndForget(
    "LiveScoresJob:auto-publish-structural",
    autoPublishStructuralResults(poolId, entry.internalMatchId),
  );

  // Check if this completes the phase and trigger advancement
  fireAndForget(
    "LiveScoresJob:advancement-trigger",
    checkAndTriggerAdvancement(poolId, entry.internalMatchId, null)
  );

  // Same completion check as in publishScraperResult — finalize is
  // an upgrade of a provisional result, but if the provisional check
  // missed (race, transient DB error) this is the second chance.
  // Idempotent.
  fireAndForget(
    "LiveScoresJob:check-pool-completed-finalize",
    transitionToCompleted(poolId, null),
  );
}

// ============================================================================
// Core: Poll Loop
// ============================================================================

async function pollLiveScores(): Promise<void> {
  // 0. Stale-match safety net (throttled). Runs even when the scraper is
  //    unavailable — an outage is exactly when matches go stale. Errors
  //    here must never break the poll loop.
  const nowMs = Date.now();
  if (nowMs - lastStaleScanAtMs >= STALE_SCAN_INTERVAL_MS) {
    lastStaleScanAtMs = nowMs;
    fireAndForget(
      "LiveScoresJob:stale-scan",
      detectAndAlertStaleMatches().then((n) => {
        if (n > 0) {
          console.warn(`[LiveScoresJob] Stale-match alert sent for ${n} match(es)`);
        }
      }),
    );
  }

  // 1. Check platform toggle
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings?.scoresServiceEnabled) {
    return;
  }

  // 2. Get client
  const client = getScoresServiceClient();
  if (!client.isAvailable()) {
    return;
  }

  // 3. Build fixtureId -> match mapping
  const fixtureMap = await buildFixtureMap();
  if (fixtureMap.size === 0) {
    return;
  }

  // 4. Fetch live scores
  const response = await client.getLiveScores();

  // 5. Process each match
  let processed = 0;
  for (const score of response.matches) {
    // Skip scores below minimum confidence
    if (
      CONFIDENCE_LEVELS[score.confidence] <
      CONFIDENCE_LEVELS[MIN_CONFIDENCE]
    ) {
      continue;
    }

    const entry = fixtureMap.get(score.apiFootballFixtureId);
    if (!entry) continue;

    await processLiveScore(entry, score);
    processed++;
  }

  if (processed > 0) {
    console.log(
      `[LiveScoresJob] Processed ${processed}/${response.matches.length} scores ` +
        `(sources: ${response.activeSources}/${response.totalSources})`
    );
  }

  recordHeartbeat("LiveScoresJob");
}

// ============================================================================
// Public API
// ============================================================================

export function startLiveScoresJob(): void {
  if (intervalId) {
    console.log("[LiveScoresJob] Already running");
    return;
  }

  intervalId = setInterval(() => {
    if (isRunning) return; // Skip if previous run still active
    isRunning = true;
    pollLiveScores()
      .catch((err) =>
        console.error(
          "[LiveScoresJob] Error:",
          err instanceof Error ? err.message : String(err)
        )
      )
      .finally(() => {
        isRunning = false;
      });
  }, POLL_INTERVAL_MS);

  console.log(
    `[LiveScoresJob] Started — polling every ${POLL_INTERVAL_MS}ms ` +
      `(min confidence: ${MIN_CONFIDENCE})`
  );
}

export function stopLiveScoresJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[LiveScoresJob] Stopped");
  }
}

/**
 * Trigger a single poll manually (for admin/testing).
 */
export async function triggerManualPoll(): Promise<void> {
  console.log("[LiveScoresJob] Manual poll triggered");
  await pollLiveScores();
}
