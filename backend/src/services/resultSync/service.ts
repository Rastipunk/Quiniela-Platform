/**
 * Result Sync Service
 *
 * Servicio para sincronizar resultados automáticos desde API-Football
 * para instancias configuradas en modo AUTO.
 */

import { prisma } from "../../db";
import { writeAuditEvent } from "../../lib/audit";
import {
  ApiFootballClient,
  getApiFootballClient,
  isApiFootballEnabled,
  ApiFootballFixture,
  parseFixtureResult,
  isFixtureFinished,
} from "../apiFootball";
import { ResultSource, SyncStatus } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface SyncSummary {
  instancesChecked: number;
  instancesUpdated: number;
  totalFixturesChecked: number;
  totalFixturesUpdated: number;
  errors: SyncError[];
}

export interface InstanceSyncResult {
  instanceId: string;
  instanceName: string;
  fixturesChecked: number;
  fixturesUpdated: number;
  fixturesSkipped: number;
  errors: SyncError[];
  status: SyncStatus;
}

export interface MatchSyncResult {
  matchId: string;
  fixtureId: number;
  status: "CREATED" | "UPDATED" | "CONFIRMED" | "SKIPPED" | "ERROR";
  previousScore?: { home: number; away: number };
  newScore?: { home: number; away: number };
  error?: string;
}

export interface SyncError {
  instanceId?: string;
  matchId?: string;
  fixtureId?: number;
  message: string;
  code: string;
}

// ============================================================================
// Result Sync Service
// ============================================================================

export class ResultSyncService {
  private client: ApiFootballClient | null;

  constructor() {
    this.client = getApiFootballClient();
  }

  /**
   * Check if sync is available (API enabled and configured)
   */
  isAvailable(): boolean {
    return this.client !== null && isApiFootballEnabled();
  }

  /**
   * Sync all AUTO instances that have pending matches
   */
  async syncAllAutoInstances(): Promise<SyncSummary> {
    if (!this.client) {
      return {
        instancesChecked: 0,
        instancesUpdated: 0,
        totalFixturesChecked: 0,
        totalFixturesUpdated: 0,
        errors: [{ message: "API-Football client not available", code: "CLIENT_NOT_AVAILABLE" }],
      };
    }

    const summary: SyncSummary = {
      instancesChecked: 0,
      instancesUpdated: 0,
      totalFixturesChecked: 0,
      totalFixturesUpdated: 0,
      errors: [],
    };

    // Get all AUTO instances with sync enabled
    const instances = await prisma.tournamentInstance.findMany({
      where: {
        resultSourceMode: "AUTO",
        syncEnabled: true,
        status: { in: ["ACTIVE", "COMPLETED"] }, // Only sync active/completed instances
        apiFootballLeagueId: { not: null },
        apiFootballSeasonId: { not: null },
      },
      include: {
        matchMappings: true,
      },
    });

    console.log(`[ResultSync] Found ${instances.length} AUTO instances to sync`);

    for (const instance of instances) {
      summary.instancesChecked++;

      try {
        const result = await this.syncInstance(instance.id);
        summary.totalFixturesChecked += result.fixturesChecked;
        summary.totalFixturesUpdated += result.fixturesUpdated;

        if (result.fixturesUpdated > 0) {
          summary.instancesUpdated++;
        }

        summary.errors.push(...result.errors);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        summary.errors.push({
          instanceId: instance.id,
          message: errorMessage,
          code: "INSTANCE_SYNC_ERROR",
        });
        console.error(`[ResultSync] Error syncing instance ${instance.id}:`, errorMessage);
      }
    }

    console.log(
      `[ResultSync] Completed: ${summary.instancesUpdated}/${summary.instancesChecked} instances updated, ${summary.totalFixturesUpdated} fixtures updated`
    );

    return summary;
  }

  /**
   * Sync a specific instance
   */
  async syncInstance(instanceId: string): Promise<InstanceSyncResult> {
    if (!this.client) {
      throw new Error("API-Football client not available");
    }

    // Get instance with mappings
    const instance = await prisma.tournamentInstance.findUnique({
      where: { id: instanceId },
      include: {
        matchMappings: true,
        pools: { select: { id: true } },
      },
    });

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    if (instance.resultSourceMode !== "AUTO") {
      throw new Error(`Instance ${instanceId} is not in AUTO mode`);
    }

    if (!instance.syncEnabled) {
      throw new Error(`Sync is disabled for instance ${instanceId}`);
    }

    if (!instance.apiFootballLeagueId || !instance.apiFootballSeasonId) {
      throw new Error(`Instance ${instanceId} missing API-Football configuration`);
    }

    // Create sync log entry
    const syncLog = await prisma.resultSyncLog.create({
      data: {
        tournamentInstanceId: instanceId,
        status: "RUNNING",
      },
    });

    const result: InstanceSyncResult = {
      instanceId,
      instanceName: instance.name,
      fixturesChecked: 0,
      fixturesUpdated: 0,
      fixturesSkipped: 0,
      errors: [],
      status: "RUNNING",
    };

    try {
      // Parse dataJson to get match kickoff times
      const dataJson = instance.dataJson as {
        matches?: Array<{ id: string; kickoffUtc?: string }>;
      };
      const matchesMap = new Map<string, Date>();

      if (dataJson?.matches) {
        for (const match of dataJson.matches) {
          if (match.kickoffUtc) {
            matchesMap.set(match.id, new Date(match.kickoffUtc));
          }
        }
      }

      const now = new Date();

      // Filter mappings: only include matches where kickoff has passed
      // This allows testing with historical data (e.g., WC2022) using fictional future dates
      const kickoffEligibleMappings = instance.matchMappings.filter((m) => {
        const kickoff = matchesMap.get(m.internalMatchId);
        if (!kickoff) {
          // If no kickoff defined, include it (backwards compatibility)
          return true;
        }
        return kickoff <= now;
      });

      // OPTIMIZATION: Skip matches that already have API_CONFIRMED results
      // This dramatically reduces API calls for ongoing tournaments
      const existingResults = await prisma.poolMatchResult.findMany({
        where: {
          poolId: { in: instance.pools.map((p) => p.id) },
          matchId: { in: kickoffEligibleMappings.map((m) => m.internalMatchId) },
        },
        include: { currentVersion: true },
      });

      const confirmedMatchIds = new Set(
        existingResults
          .filter((r) => r.currentVersion?.source === "API_CONFIRMED")
          .map((r) => r.matchId)
      );

      const eligibleMappings = kickoffEligibleMappings.filter(
        (m) => !confirmedMatchIds.has(m.internalMatchId)
      );

      console.log(
        `[ResultSync] Instance ${instance.name}: ${eligibleMappings.length} pending (${kickoffEligibleMappings.length} kickoff passed, ${confirmedMatchIds.size} already confirmed)`
      );

      // Get fixture IDs that have mappings and are eligible
      const fixtureIds = eligibleMappings.map((m) => m.apiFootballFixtureId);

      if (fixtureIds.length === 0) {
        result.status = "COMPLETED";
        await this.completeSyncLog(syncLog.id, result);
        return result;
      }

      // Fetch fixtures from API-Football
      const startTime = Date.now();
      const fixtures = await this.client.getFixturesByIds(fixtureIds);
      const apiResponseTime = Date.now() - startTime;

      result.fixturesChecked = fixtures.length;

      // Process each fixture
      for (const fixture of fixtures) {
        const mapping = eligibleMappings.find(
          (m) => m.apiFootballFixtureId === fixture.fixture.id
        );

        if (!mapping) continue;

        // Only process finished fixtures
        if (!isFixtureFinished(fixture.fixture.status.short)) {
          result.fixturesSkipped++;
          continue;
        }

        // Process the fixture for all pools using this instance
        for (const pool of instance.pools) {
          try {
            const matchResult = await this.processFixtureForPool(
              pool.id,
              mapping.internalMatchId,
              fixture
            );

            if (matchResult.status === "CREATED" || matchResult.status === "UPDATED") {
              result.fixturesUpdated++;
            } else if (matchResult.status === "SKIPPED") {
              result.fixturesSkipped++;
            } else if (matchResult.status === "ERROR") {
              result.errors.push({
                instanceId,
                matchId: mapping.internalMatchId,
                fixtureId: fixture.fixture.id,
                message: matchResult.error || "Unknown error",
                code: "FIXTURE_PROCESS_ERROR",
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            result.errors.push({
              instanceId,
              matchId: mapping.internalMatchId,
              fixtureId: fixture.fixture.id,
              message: errorMessage,
              code: "FIXTURE_PROCESS_ERROR",
            });
          }
        }
      }

      // Update instance lastSyncAtUtc
      await prisma.tournamentInstance.update({
        where: { id: instanceId },
        data: { lastSyncAtUtc: new Date() },
      });

      result.status = result.errors.length > 0 ? "PARTIAL" : "COMPLETED";

      // Update sync log
      await this.completeSyncLog(syncLog.id, result, apiResponseTime);

      console.log(
        `[ResultSync] Instance ${instance.name}: ${result.fixturesUpdated}/${result.fixturesChecked} fixtures updated`
      );

      return result;
    } catch (error) {
      result.status = "FAILED";
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      result.errors.push({
        instanceId,
        message: errorMessage,
        code: "SYNC_FAILED",
      });

      await this.completeSyncLog(syncLog.id, result);
      throw error;
    }
  }

  /**
   * Process a single fixture for a specific pool
   */
  private async processFixtureForPool(
    poolId: string,
    matchId: string,
    fixture: ApiFootballFixture
  ): Promise<MatchSyncResult> {
    const parsedResult = parseFixtureResult(fixture);

    if (!parsedResult || !parsedResult.isFinished) {
      return {
        matchId,
        fixtureId: fixture.fixture.id,
        status: "SKIPPED",
      };
    }

    // Check if there's an existing result
    const existingResult = await prisma.poolMatchResult.findUnique({
      where: { poolId_matchId: { poolId, matchId } },
      include: { currentVersion: true },
    });

    // If there's already a HOST_OVERRIDE, skip (host override is final)
    if (existingResult?.currentVersion?.source === "HOST_OVERRIDE") {
      return {
        matchId,
        fixtureId: fixture.fixture.id,
        status: "SKIPPED",
        previousScore: {
          home: existingResult.currentVersion.homeGoals,
          away: existingResult.currentVersion.awayGoals,
        },
      };
    }

    // If there's already an API_CONFIRMED with same score, skip
    if (existingResult?.currentVersion?.source === "API_CONFIRMED") {
      if (
        existingResult.currentVersion.homeGoals === parsedResult.homeGoals &&
        existingResult.currentVersion.awayGoals === parsedResult.awayGoals
      ) {
        return {
          matchId,
          fixtureId: fixture.fixture.id,
          status: "SKIPPED",
          previousScore: {
            home: existingResult.currentVersion.homeGoals,
            away: existingResult.currentVersion.awayGoals,
          },
        };
      }
    }

    // Determine what action to take
    let status: "CREATED" | "UPDATED" | "CONFIRMED";
    let previousScore: { home: number; away: number } | undefined;

    if (!existingResult) {
      status = "CREATED";
    } else if (existingResult.currentVersion?.source === "HOST_PROVISIONAL") {
      // Check if provisional matches API
      if (
        existingResult.currentVersion.homeGoals === parsedResult.homeGoals &&
        existingResult.currentVersion.awayGoals === parsedResult.awayGoals
      ) {
        status = "CONFIRMED";
      } else {
        status = "UPDATED";
      }
      previousScore = {
        home: existingResult.currentVersion.homeGoals,
        away: existingResult.currentVersion.awayGoals,
      };
    } else {
      status = "UPDATED";
      if (existingResult.currentVersion) {
        previousScore = {
          home: existingResult.currentVersion.homeGoals,
          away: existingResult.currentVersion.awayGoals,
        };
      }
    }

    // Create the result in a transaction
    await prisma.$transaction(async (tx) => {
      // Get or create header
      const header =
        existingResult ??
        (await tx.poolMatchResult.create({ data: { poolId, matchId } }));

      // Get next version number
      const lastVersion = await tx.poolMatchResultVersion.findFirst({
        where: { resultId: header.id },
        orderBy: { versionNumber: "desc" },
      });
      const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;

      // Create new version
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
          externalDataJson: fixture as any,
          createdByUserId: null, // API doesn't have a user
        },
      });

      // Update header
      await tx.poolMatchResult.update({
        where: { id: header.id },
        data: { currentVersionId: version.id },
      });
    });

    // Write audit event
    await writeAuditEvent({
      actorUserId: null, // System action
      action: "RESULT_SYNCED_FROM_API",
      entityType: "PoolMatchResult",
      entityId: matchId,
      poolId,
      dataJson: {
        matchId,
        fixtureId: fixture.fixture.id,
        homeGoals: parsedResult.homeGoals,
        awayGoals: parsedResult.awayGoals,
        previousScore,
        status,
      },
    });

    return {
      matchId,
      fixtureId: fixture.fixture.id,
      status,
      previousScore,
      newScore: {
        home: parsedResult.homeGoals,
        away: parsedResult.awayGoals,
      },
    };
  }

  /**
   * Complete a sync log entry
   */
  private async completeSyncLog(
    syncLogId: string,
    result: InstanceSyncResult,
    apiResponseTimeMs?: number
  ): Promise<void> {
    await prisma.resultSyncLog.update({
      where: { id: syncLogId },
      data: {
        completedAtUtc: new Date(),
        status: result.status,
        fixturesChecked: result.fixturesChecked,
        fixturesUpdated: result.fixturesUpdated,
        fixturesSkipped: result.fixturesSkipped,
        errors: result.errors.length > 0 ? JSON.parse(JSON.stringify(result.errors)) : undefined,
        apiResponseTimeMs,
        apiRateLimitRemaining: this.client?.getRateLimitRemaining(),
      },
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let serviceInstance: ResultSyncService | null = null;

export function getResultSyncService(): ResultSyncService {
  if (!serviceInstance) {
    serviceInstance = new ResultSyncService();
  }
  return serviceInstance;
}
