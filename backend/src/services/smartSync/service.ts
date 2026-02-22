/**
 * Smart Sync Service
 *
 * Optimized result synchronization that minimizes API calls by:
 * 1. Only checking matches 5 minutes after kickoff (to verify they started)
 * 2. Waiting until estimated end time (kickoff + 110min) before checking for results
 * 3. Polling only matches that should be finishing (not all matches)
 * 4. Never re-checking completed matches
 *
 * Expected API calls per match: 2-4 (vs unlimited with periodic polling)
 */

import { prisma } from "../../db";
import { MatchSyncStatus } from "@prisma/client";
import {
  ApiFootballClient,
  getApiFootballClient,
  isApiFootballEnabled,
  parseFixtureResult,
  isFixtureFinished,
  isFixtureInProgress,
} from "../apiFootball";
import { writeAuditEvent } from "../../lib/audit";

// ============================================================================
// Configuration
// ============================================================================

// Time after kickoff to first check if match started (in minutes)
const FIRST_CHECK_DELAY_MINUTES = 5;

// Time after kickoff to check if match finished (in minutes)
// A typical match: 45 + 15 (halftime) + 45 + ~5 (added time) = ~110 minutes
const FINISH_CHECK_DELAY_MINUTES = 110;

// Polling interval for matches awaiting finish (in minutes)
const AWAITING_FINISH_POLL_MINUTES = 5;

// Backoff intervals for PENDING matches that haven't started (in minutes)
// 0-30 min late: every 5 min | 30min-3h: every 60 min | 3h-10h: every 120 min | 10h+: every 1440 min (24h)
const PENDING_BACKOFF_TIERS = [
  { afterMinutes: 0,   pollEveryMinutes: 5 },
  { afterMinutes: 30,  pollEveryMinutes: 60 },
  { afterMinutes: 180, pollEveryMinutes: 120 },
  { afterMinutes: 600, pollEveryMinutes: 1440 },
];

/**
 * Returns the poll interval (in minutes) for a PENDING match based on
 * how long it has been since its firstCheckAtUtc.
 */
function getPendingPollInterval(firstCheckAtUtc: Date | null, now: Date): number {
  if (!firstCheckAtUtc) return PENDING_BACKOFF_TIERS[0]!.pollEveryMinutes;
  const minutesWaiting = (now.getTime() - firstCheckAtUtc.getTime()) / 60_000;
  // Walk tiers in reverse to find the highest matching tier
  for (let i = PENDING_BACKOFF_TIERS.length - 1; i >= 0; i--) {
    const tier = PENDING_BACKOFF_TIERS[i]!;
    if (minutesWaiting >= tier.afterMinutes) {
      return tier.pollEveryMinutes;
    }
  }
  return PENDING_BACKOFF_TIERS[0]!.pollEveryMinutes;
}

// ============================================================================
// Types
// ============================================================================

export interface SmartSyncResult {
  matchesProcessed: number;
  matchesStarted: number;
  matchesCompleted: number;
  matchesStillPlaying: number;
  errors: Array<{ matchId: string; error: string }>;
}

// ============================================================================
// Smart Sync Service
// ============================================================================

export class SmartSyncService {
  private client: ApiFootballClient | null;

  constructor() {
    this.client = getApiFootballClient();
  }

  isAvailable(): boolean {
    return this.client !== null && isApiFootballEnabled();
  }

  /**
   * Initialize sync states for all matches in an instance
   * Call this when an instance is created or when matches are added
   */
  async initializeMatchSyncStates(instanceId: string): Promise<number> {
    const instance = await prisma.tournamentInstance.findUnique({
      where: { id: instanceId },
      include: { matchMappings: true },
    });

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    const dataJson = instance.dataJson as {
      matches?: Array<{ id: string; kickoffUtc?: string }>;
    };

    if (!dataJson?.matches) {
      return 0;
    }

    let created = 0;

    for (const match of dataJson.matches) {
      if (!match.kickoffUtc) continue;

      // Check if there's a mapping for this match
      const hasMapping = instance.matchMappings.some(
        (m) => m.internalMatchId === match.id
      );

      const kickoffUtc = new Date(match.kickoffUtc);
      const firstCheckAtUtc = new Date(
        kickoffUtc.getTime() + FIRST_CHECK_DELAY_MINUTES * 60 * 1000
      );
      const finishCheckAtUtc = new Date(
        kickoffUtc.getTime() + FINISH_CHECK_DELAY_MINUTES * 60 * 1000
      );

      try {
        await prisma.matchSyncState.upsert({
          where: {
            tournamentInstanceId_internalMatchId: {
              tournamentInstanceId: instanceId,
              internalMatchId: match.id,
            },
          },
          create: {
            tournamentInstanceId: instanceId,
            internalMatchId: match.id,
            syncStatus: hasMapping ? "PENDING" : "SKIPPED",
            kickoffUtc,
            firstCheckAtUtc,
            finishCheckAtUtc,
          },
          update: {
            kickoffUtc,
            firstCheckAtUtc,
            finishCheckAtUtc,
            // Don't update syncStatus if already set (preserve state)
          },
        });
        created++;
      } catch (e) {
        console.error(`[SmartSync] Error initializing state for ${match.id}:`, e);
      }
    }

    console.log(`[SmartSync] Initialized ${created} match sync states for instance ${instanceId}`);
    return created;
  }

  /**
   * Main sync method - processes matches that need checking
   * This should be called by the cron job every minute
   */
  async processMatchesNeedingSync(instanceId: string): Promise<SmartSyncResult> {
    if (!this.client) {
      throw new Error("API-Football client not available");
    }

    const now = new Date();
    const result: SmartSyncResult = {
      matchesProcessed: 0,
      matchesStarted: 0,
      matchesCompleted: 0,
      matchesStillPlaying: 0,
      errors: [],
    };

    // Get instance with pools
    const instance = await prisma.tournamentInstance.findUnique({
      where: { id: instanceId },
      include: {
        pools: { select: { id: true } },
        matchMappings: true,
      },
    });

    if (!instance || instance.resultSourceMode !== "AUTO") {
      return result;
    }

    // Find matches that need checking based on their state and timing
    // PENDING matches use backoff tiers, so we fetch all eligible and filter in code
    const pendingCandidates = await prisma.matchSyncState.findMany({
      where: {
        tournamentInstanceId: instanceId,
        syncStatus: "PENDING",
        firstCheckAtUtc: { lte: now },
      },
    });

    // Apply backoff: only include PENDING matches whose lastCheckedAtUtc is old enough
    const pendingReady = pendingCandidates.filter((m) => {
      if (!m.lastCheckedAtUtc) return true; // never checked → check now
      const pollInterval = getPendingPollInterval(m.firstCheckAtUtc, now);
      const nextCheckAt = new Date(m.lastCheckedAtUtc.getTime() + pollInterval * 60_000);
      return now >= nextCheckAt;
    });

    const nonPendingToCheck = await prisma.matchSyncState.findMany({
      where: {
        tournamentInstanceId: instanceId,
        OR: [
          // Case 2: IN_PROGRESS matches where finishCheckAtUtc has passed
          {
            syncStatus: "IN_PROGRESS",
            finishCheckAtUtc: { lte: now },
          },
          // Case 3: AWAITING_FINISH matches (check every poll interval)
          {
            syncStatus: "AWAITING_FINISH",
            OR: [
              { lastCheckedAtUtc: null },
              {
                lastCheckedAtUtc: {
                  lte: new Date(now.getTime() - AWAITING_FINISH_POLL_MINUTES * 60 * 1000),
                },
              },
            ],
          },
        ],
      },
    });

    const matchesToCheck = [...pendingReady, ...nonPendingToCheck];

    if (matchesToCheck.length === 0) {
      return result;
    }

    console.log(`[SmartSync] Found ${matchesToCheck.length} matches to check`);

    // Process each match
    for (const matchState of matchesToCheck) {
      const mapping = instance.matchMappings.find(
        (m) => m.internalMatchId === matchState.internalMatchId
      );

      if (!mapping) {
        // No API mapping, mark as skipped
        await prisma.matchSyncState.update({
          where: { id: matchState.id },
          data: { syncStatus: "SKIPPED" },
        });
        continue;
      }

      try {
        const checkResult = await this.checkMatch(
          matchState,
          mapping.apiFootballFixtureId,
          instance.pools.map((p) => p.id)
        );

        result.matchesProcessed++;

        if (checkResult.started) result.matchesStarted++;
        if (checkResult.completed) result.matchesCompleted++;
        if (checkResult.stillPlaying) result.matchesStillPlaying++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        result.errors.push({
          matchId: matchState.internalMatchId,
          error: errorMessage,
        });
        console.error(`[SmartSync] Error checking ${matchState.internalMatchId}:`, errorMessage);
      }
    }

    // Update instance lastSyncAtUtc
    if (result.matchesProcessed > 0) {
      await prisma.tournamentInstance.update({
        where: { id: instanceId },
        data: { lastSyncAtUtc: now },
      });
    }

    console.log(
      `[SmartSync] Processed ${result.matchesProcessed} matches: ` +
        `${result.matchesStarted} started, ${result.matchesCompleted} completed, ` +
        `${result.matchesStillPlaying} still playing`
    );

    return result;
  }

  /**
   * Check a single match and update its state
   */
  private async checkMatch(
    matchState: {
      id: string;
      internalMatchId: string;
      syncStatus: MatchSyncStatus;
      tournamentInstanceId: string;
    },
    fixtureId: number,
    poolIds: string[]
  ): Promise<{ started: boolean; completed: boolean; stillPlaying: boolean }> {
    const fixture = await this.client!.getFixture(fixtureId);
    const now = new Date();

    if (!fixture) {
      throw new Error(`Fixture ${fixtureId} not found`);
    }

    const apiStatus = fixture.fixture.status.short;
    const result = { started: false, completed: false, stillPlaying: false };

    // Update last checked time
    await prisma.matchSyncState.update({
      where: { id: matchState.id },
      data: {
        lastCheckedAtUtc: now,
        lastApiStatus: apiStatus,
      },
    });

    // Handle based on current state
    if (matchState.syncStatus === "PENDING") {
      // First check - see if match started
      if (isFixtureInProgress(apiStatus) || isFixtureFinished(apiStatus)) {
        result.started = true;

        if (isFixtureFinished(apiStatus)) {
          // Match already finished (rare but possible)
          await this.publishResult(matchState, fixture, poolIds);
          await prisma.matchSyncState.update({
            where: { id: matchState.id },
            data: {
              syncStatus: "COMPLETED",
              completedAtUtc: now,
            },
          });
          result.completed = true;
        } else {
          // Match in progress
          await prisma.matchSyncState.update({
            where: { id: matchState.id },
            data: { syncStatus: "IN_PROGRESS" },
          });
          result.stillPlaying = true;
        }
      }
      // If not started yet, keep as PENDING (will check again next cycle)
    } else if (matchState.syncStatus === "IN_PROGRESS") {
      // Second check - see if match finished
      if (isFixtureFinished(apiStatus)) {
        await this.publishResult(matchState, fixture, poolIds);
        await prisma.matchSyncState.update({
          where: { id: matchState.id },
          data: {
            syncStatus: "COMPLETED",
            completedAtUtc: now,
          },
        });
        result.completed = true;
      } else {
        // Not finished yet, move to awaiting finish for polling
        await prisma.matchSyncState.update({
          where: { id: matchState.id },
          data: { syncStatus: "AWAITING_FINISH" },
        });
        result.stillPlaying = true;
      }
    } else if (matchState.syncStatus === "AWAITING_FINISH") {
      // Polling - check if finally finished
      if (isFixtureFinished(apiStatus)) {
        await this.publishResult(matchState, fixture, poolIds);
        await prisma.matchSyncState.update({
          where: { id: matchState.id },
          data: {
            syncStatus: "COMPLETED",
            completedAtUtc: now,
          },
        });
        result.completed = true;
      } else {
        result.stillPlaying = true;
      }
    }

    return result;
  }

  /**
   * Publish the result to all pools
   */
  private async publishResult(
    matchState: { internalMatchId: string; tournamentInstanceId: string },
    fixture: any,
    poolIds: string[]
  ): Promise<void> {
    const parsedResult = parseFixtureResult(fixture);

    if (!parsedResult || !parsedResult.isFinished) {
      return;
    }

    for (const poolId of poolIds) {
      // Check if result already exists
      const existingResult = await prisma.poolMatchResult.findUnique({
        where: { poolId_matchId: { poolId, matchId: matchState.internalMatchId } },
        include: { currentVersion: true },
      });

      // Skip if already has API_CONFIRMED result
      if (existingResult?.currentVersion?.source === "API_CONFIRMED") {
        continue;
      }

      // Skip if has HOST_OVERRIDE (host override is final)
      if (existingResult?.currentVersion?.source === "HOST_OVERRIDE") {
        continue;
      }

      // Create/update result
      await prisma.$transaction(async (tx) => {
        const header =
          existingResult ??
          (await tx.poolMatchResult.create({
            data: { poolId, matchId: matchState.internalMatchId },
          }));

        const lastVersion = await tx.poolMatchResultVersion.findFirst({
          where: { resultId: header.id },
          orderBy: { versionNumber: "desc" },
        });
        const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;

        const version = await tx.poolMatchResultVersion.create({
          data: {
            resultId: header.id,
            versionNumber: nextVersion,
            status: "PUBLISHED",
            homeGoals: parsedResult.homeGoals,
            awayGoals: parsedResult.awayGoals,
            homePenalties: parsedResult.penaltyHome,
            awayPenalties: parsedResult.penaltyAway,
            source: "API_CONFIRMED",
            externalFixtureId: fixture.fixture.id,
            externalDataJson: fixture,
            createdByUserId: null,
          },
        });

        await tx.poolMatchResult.update({
          where: { id: header.id },
          data: { currentVersionId: version.id },
        });
      });

      // Audit log
      await writeAuditEvent({
        actorUserId: null,
        action: "RESULT_SYNCED_FROM_API",
        entityType: "PoolMatchResult",
        entityId: matchState.internalMatchId,
        poolId,
        dataJson: {
          matchId: matchState.internalMatchId,
          fixtureId: fixture.fixture.id,
          homeGoals: parsedResult.homeGoals,
          awayGoals: parsedResult.awayGoals,
        },
      });
    }

    console.log(
      `[SmartSync] Published result for ${matchState.internalMatchId}: ` +
        `${parsedResult.homeGoals}-${parsedResult.awayGoals}`
    );
  }

  /**
   * Get current sync status for an instance
   */
  async getSyncStatus(instanceId: string): Promise<{
    pending: number;
    inProgress: number;
    awaitingFinish: number;
    completed: number;
    skipped: number;
  }> {
    const counts = await prisma.matchSyncState.groupBy({
      by: ["syncStatus"],
      where: { tournamentInstanceId: instanceId },
      _count: { syncStatus: true },
    });

    const result = {
      pending: 0,
      inProgress: 0,
      awaitingFinish: 0,
      completed: 0,
      skipped: 0,
    };

    for (const c of counts) {
      switch (c.syncStatus) {
        case "PENDING":
          result.pending = c._count.syncStatus;
          break;
        case "IN_PROGRESS":
          result.inProgress = c._count.syncStatus;
          break;
        case "AWAITING_FINISH":
          result.awaitingFinish = c._count.syncStatus;
          break;
        case "COMPLETED":
          result.completed = c._count.syncStatus;
          break;
        case "SKIPPED":
          result.skipped = c._count.syncStatus;
          break;
      }
    }

    return result;
  }

  /**
   * Get matches currently in progress (for UI display)
   */
  async getMatchesInProgress(instanceId: string): Promise<
    Array<{
      matchId: string;
      lastApiStatus: string | null;
      kickoffUtc: Date;
    }>
  > {
    const matches = await prisma.matchSyncState.findMany({
      where: {
        tournamentInstanceId: instanceId,
        syncStatus: { in: ["IN_PROGRESS", "AWAITING_FINISH"] },
      },
      select: {
        internalMatchId: true,
        lastApiStatus: true,
        kickoffUtc: true,
      },
    });

    return matches.map((m) => ({
      matchId: m.internalMatchId,
      lastApiStatus: m.lastApiStatus,
      kickoffUtc: m.kickoffUtc,
    }));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let serviceInstance: SmartSyncService | null = null;

export function getSmartSyncService(): SmartSyncService {
  if (!serviceInstance) {
    serviceInstance = new SmartSyncService();
  }
  return serviceInstance;
}
