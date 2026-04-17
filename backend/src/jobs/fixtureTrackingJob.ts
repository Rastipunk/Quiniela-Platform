/**
 * Fixture Tracking Job
 *
 * Runs every hour via node-cron. Sends upcoming fixtures to the
 * picks4all-scores service so it knows which matches to scrape.
 *
 * Flow:
 * 1. Check PlatformSettings.scoresServiceEnabled — skip if false
 * 2. Check ScoresServiceClient availability — skip if not configured
 * 3. Query MatchExternalMapping for matches with kickoff in next N hours
 * 4. POST fixtures to /api/v1/track
 */

import * as cron from "node-cron";
import { prisma } from "../db";
import { getScoresServiceClient, TrackFixture } from "../services/scoresService";
import { sendAdminNotification } from "../lib/email";

// ============================================================================
// Configuration
// ============================================================================

const FIXTURE_TRACKING_CRON =
  process.env.FIXTURE_TRACKING_CRON || "0 * * * *"; // every hour

const envInt = (key: string, fallback: number): number =>
  parseInt(process.env[key] || String(fallback), 10);

/** How many hours ahead to look for upcoming matches */
const SCORES_TRACK_WINDOW_HOURS = envInt("SCORES_TRACK_WINDOW_HOURS", 24);

/** Unresolved knockout team placeholders (see tournamentAdvancement). */
function isPlaceholderTeamId(id: string): boolean {
  return id.startsWith("W_") || id.startsWith("RU_") || id.startsWith("3rd_");
}

// ============================================================================
// Job State
// ============================================================================

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

// ============================================================================
// Job Implementation
// ============================================================================

async function runFixtureTracking(): Promise<void> {
  if (isRunning) {
    console.log("[FixtureTrackingJob] Skipping — previous run still in progress");
    return;
  }

  isRunning = true;

  try {
    // 1. Check platform toggle
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    if (!settings?.scoresServiceEnabled) {
      return;
    }

    // 2. Check client availability
    const client = getScoresServiceClient();
    if (!client.isAvailable()) {
      console.log("[FixtureTrackingJob] Scores service not configured, skipping");
      return;
    }

    // 3. Query AUTO instances with sync enabled
    const instances = await prisma.tournamentInstance.findMany({
      where: {
        resultSourceMode: "AUTO",
        syncEnabled: true,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        dataJson: true,
        apiFootballLeagueId: true,
        apiFootballSeasonId: true,
        matchMappings: {
          select: {
            internalMatchId: true,
            apiFootballFixtureId: true,
            apiFootballHomeTeamId: true,
            apiFootballAwayTeamId: true,
          },
        },
      },
    });

    if (instances.length === 0) {
      return;
    }

    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + SCORES_TRACK_WINDOW_HOURS * 60 * 60_000
    );
    // Also include matches that started up to 3h ago (may still be in progress)
    const windowStart = new Date(now.getTime() - 3 * 60 * 60_000);

    const fixtures: (TrackFixture & { _internalMatchId: string })[] = [];

    for (const inst of instances) {
      const data = inst.dataJson as {
        matches?: Array<{
          id: string;
          homeTeamId: string;
          awayTeamId: string;
          kickoffUtc?: string;
        }>;
        teams?: Array<{ id: string; name: string; apiFootballId?: number }>;
      } | null;

      if (!data) continue;

      const teams = data.teams || [];
      const matches = data.matches || [];

      const teamName = (id: string): string =>
        teams.find((t) => t.id === id)?.name ?? id;

      const teamApiId = (id: string): number => {
        const team = teams.find((t) => t.id === id);
        return team?.apiFootballId ?? 0;
      };

      for (const mapping of inst.matchMappings) {
        const match = matches.find((m) => m.id === mapping.internalMatchId);
        if (!match?.kickoffUtc) continue;

        const kickoff = new Date(match.kickoffUtc);
        if (kickoff < windowStart || kickoff > windowEnd) continue;

        // Skip knockout matches whose teams haven't been resolved yet by advancement.
        // Placeholder IDs (W_A, RU_B, 3rd_POOL_*) can't be matched by the scraper.
        if (isPlaceholderTeamId(match.homeTeamId) || isPlaceholderTeamId(match.awayTeamId)) {
          continue;
        }

        // Get team IDs: prefer mapping, fallback to dataJson
        const homeTeamId =
          mapping.apiFootballHomeTeamId ?? teamApiId(match.homeTeamId);
        const awayTeamId =
          mapping.apiFootballAwayTeamId ?? teamApiId(match.awayTeamId);

        fixtures.push({
          fixtureId: mapping.apiFootballFixtureId,
          homeTeamName: teamName(match.homeTeamId),
          awayTeamName: teamName(match.awayTeamId),
          homeTeamId,
          awayTeamId,
          kickoffUtc: match.kickoffUtc,
          ...(inst.apiFootballLeagueId ? { leagueId: inst.apiFootballLeagueId } : {}),
          ...(inst.apiFootballSeasonId ? { season: inst.apiFootballSeasonId } : {}),
          _internalMatchId: mapping.internalMatchId,
        } as TrackFixture & { _internalMatchId: string });
      }
    }

    if (fixtures.length === 0) {
      return;
    }

    // 4. Dedup: skip fixtures already tracked (trackedAtUtc is set)
    const alreadyTracked = await prisma.matchSyncState.findMany({
      where: {
        internalMatchId: { in: fixtures.map((f) => f._internalMatchId!) },
        trackedAtUtc: { not: null },
      },
      select: { internalMatchId: true },
    });
    const trackedSet = new Set(alreadyTracked.map((s) => s.internalMatchId));
    const newFixtures = fixtures.filter((f) => !trackedSet.has(f._internalMatchId!));

    // Clean internal-only field before sending to external API
    const toSend: TrackFixture[] = newFixtures.map(({ _internalMatchId, ...rest }) => rest);

    if (toSend.length === 0) {
      console.log(`[FixtureTrackingJob] All ${fixtures.length} fixtures already tracked, skipping`);
      return;
    }

    // 5. Send to scores service
    const result = await client.trackFixtures(toSend);
    console.log(
      `[FixtureTrackingJob] Sent ${toSend.length} fixtures: ` +
        `${result.tracked} new, ${result.alreadyTracking} already tracking, ${result.rejected} rejected`
    );

    // 6. Process per-fixture details — only mark fixtures that were actually accepted
    const fixtureIdToInternalId = new Map(
      newFixtures.map((f) => [f.fixtureId, f._internalMatchId!])
    );
    const acceptedInternalIds: string[] = [];
    const rejectedDetails: Array<{ fixtureId: number; reason: string; internalId?: string }> = [];

    for (const detail of result.details ?? []) {
      const internalId = fixtureIdToInternalId.get(detail.fixtureId);
      if (detail.status === "TRACKING" || detail.status === "ALREADY_TRACKING") {
        if (internalId) acceptedInternalIds.push(internalId);
      } else if (detail.status === "REJECTED") {
        rejectedDetails.push({
          fixtureId: detail.fixtureId,
          reason: detail.reason || "Unknown reason",
          internalId,
        });
      }
    }

    // 7. Mark accepted fixtures as tracked
    if (acceptedInternalIds.length > 0) {
      await prisma.matchSyncState.updateMany({
        where: { internalMatchId: { in: acceptedInternalIds } },
        data: { trackedAtUtc: new Date() },
      });
    }

    // 8. Alert admin if any fixtures were rejected
    if (rejectedDetails.length > 0) {
      console.error(
        `[FixtureTrackingJob] ${rejectedDetails.length} fixtures REJECTED by scores service`
      );
      const rejectedList = rejectedDetails
        .map((r) => `<li>Fixture ${r.fixtureId} (${r.internalId || "unknown"}): ${r.reason}</li>`)
        .join("");
      sendAdminNotification({
        subject: `Fixtures rejected by scores service (${rejectedDetails.length})`,
        body: `<p>The following fixtures were rejected by picks4all-scores and will NOT be tracked:</p><ul>${rejectedList}</ul><p>Investigate why and re-track them manually if needed.</p>`,
        type: "error",
      }).catch(() => {});
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[FixtureTrackingJob] Error:", errMsg);

    // Notify admin on tracking failure
    sendAdminNotification({
      subject: "Fixture tracking failed",
      body: `<p>The fixture tracking job failed to register fixtures with picks4all-scores.</p><p><strong>Error:</strong> ${errMsg}</p><p>Check the scores service health and retry manually if needed.</p>`,
      type: "error",
    }).catch(() => {}); // fire-and-forget
  } finally {
    isRunning = false;
  }
}

// ============================================================================
// Public API
// ============================================================================

export function startFixtureTrackingJob(): void {
  if (scheduledTask) {
    console.log("[FixtureTrackingJob] Job already running");
    return;
  }

  console.log(
    `[FixtureTrackingJob] Starting with cron: ${FIXTURE_TRACKING_CRON}`
  );

  scheduledTask = cron.schedule(FIXTURE_TRACKING_CRON, async () => {
    await runFixtureTracking();
  });

  // Also run immediately on startup
  runFixtureTracking().catch((err) =>
    console.error(
      "[FixtureTrackingJob] Startup run error:",
      err instanceof Error ? err.message : String(err)
    )
  );

  console.log("[FixtureTrackingJob] Job started — runs every hour");
}

export function stopFixtureTrackingJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[FixtureTrackingJob] Job stopped");
  }
}

/**
 * Manually trigger a fixture tracking run (for admin panel).
 * Returns when the run completes (or skips if another run is in progress).
 */
export async function triggerFixtureTracking(): Promise<void> {
  await runFixtureTracking();
}
