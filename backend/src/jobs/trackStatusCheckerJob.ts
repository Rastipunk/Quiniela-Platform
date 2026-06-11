/**
 * Track Status Checker Job
 *
 * Runs every minute. For each match starting in the next 5-10 minutes,
 * verifies that picks4all-scores has it tracked AND has at least one
 * source already reporting data. If not, re-sends the track request
 * and alerts the admin.
 *
 * This is the "last line of defense" — if a match is about to start
 * and the scraper isn't ready, we want to know NOW, not after kickoff.
 */

import * as cron from "node-cron";
import { prisma } from "../db";
import { recordHeartbeat } from "../lib/cronHeartbeat";
import { getScoresServiceClient, TrackFixture } from "../services/scoresService";
import { sendAdminNotification } from "../lib/email";

const CRON_SCHEDULE = process.env.TRACK_STATUS_CHECK_CRON || "* * * * *"; // every minute
const CHECK_WINDOW_MIN = parseInt(
  process.env.TRACK_STATUS_CHECK_WINDOW_MIN || "10",
  10
);
const CHECK_WINDOW_BEFORE_MIN = parseInt(
  process.env.TRACK_STATUS_CHECK_WINDOW_BEFORE_MIN || "5",
  10
);

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;
const recentlyAlerted = new Set<number>(); // dedupe alerts per process lifetime

async function runTrackStatusCheck(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    if (!settings?.scoresServiceEnabled) return;

    const client = getScoresServiceClient();
    if (!client.isAvailable()) return;

    // Find matches starting in the next CHECK_WINDOW_MIN minutes (or that just started)
    const now = Date.now();
    const windowStart = new Date(now - CHECK_WINDOW_BEFORE_MIN * 60_000);
    const windowEnd = new Date(now + CHECK_WINDOW_MIN * 60_000);

    const upcomingStates = await prisma.matchSyncState.findMany({
      where: {
        kickoffUtc: { gte: windowStart, lte: windowEnd },
        syncStatus: { in: ["PENDING", "IN_PROGRESS"] },
      },
      include: {
        tournamentInstance: {
          select: {
            id: true,
            name: true,
            dataJson: true,
            apiFootballLeagueId: true,
            apiFootballSeasonId: true,
            matchMappings: true,
          },
        },
      },
    });

    if (upcomingStates.length === 0) return;

    // Build map: fixtureId → {state, instance, mapping}
    const fixturesById = new Map<
      number,
      {
        state: typeof upcomingStates[0];
        mapping: typeof upcomingStates[0]["tournamentInstance"]["matchMappings"][0];
      }
    >();
    for (const state of upcomingStates) {
      const mapping = state.tournamentInstance.matchMappings.find(
        (m) => m.internalMatchId === state.internalMatchId
      );
      if (!mapping) continue;
      fixturesById.set(mapping.apiFootballFixtureId, { state, mapping });
    }

    if (fixturesById.size === 0) return;

    const fixtureIds = Array.from(fixturesById.keys());
    const trackStatus = await client.getTrackStatus(fixtureIds);

    const trackedSet = new Set(trackStatus.tracked.map((t) => t.fixtureId));
    const trackedWithData = new Set(
      trackStatus.tracked.filter((t) => t.sources.length > 0).map((t) => t.fixtureId)
    );
    const untracked = trackStatus.untracked;

    // Identify problematic fixtures
    const problemFixtures: Array<{
      fixtureId: number;
      issue: "UNTRACKED" | "NO_SOURCES";
      state: typeof upcomingStates[0];
      mapping: typeof upcomingStates[0]["tournamentInstance"]["matchMappings"][0];
    }> = [];

    for (const fixtureId of untracked) {
      const entry = fixturesById.get(fixtureId);
      if (entry) {
        problemFixtures.push({ fixtureId, issue: "UNTRACKED", ...entry });
      }
    }

    // Tracked but no sources reporting: only flag if very close to kickoff (< 5 min)
    for (const fixtureId of trackedSet) {
      if (trackedWithData.has(fixtureId)) continue;
      const entry = fixturesById.get(fixtureId);
      if (!entry) continue;
      const minutesToKickoff = (entry.state.kickoffUtc.getTime() - now) / 60_000;
      if (minutesToKickoff < 5) {
        problemFixtures.push({ fixtureId, issue: "NO_SOURCES", ...entry });
      }
    }

    if (problemFixtures.length === 0) return;

    // Re-track UNTRACKED fixtures
    const toRetrack = problemFixtures.filter((p) => p.issue === "UNTRACKED");
    if (toRetrack.length > 0) {
      const retrackPayload: TrackFixture[] = [];
      for (const p of toRetrack) {
        const data = p.state.tournamentInstance.dataJson as {
          matches?: Array<{ id: string; homeTeamId: string; awayTeamId: string; kickoffUtc?: string }>;
          teams?: Array<{ id: string; name: string }>;
        } | null;
        const match = data?.matches?.find((m) => m.id === p.state.internalMatchId);
        if (!match?.kickoffUtc) continue;
        const teamName = (id: string) => data?.teams?.find((t) => t.id === id)?.name ?? id;

        retrackPayload.push({
          fixtureId: p.fixtureId,
          homeTeamName: teamName(match.homeTeamId),
          awayTeamName: teamName(match.awayTeamId),
          homeTeamId: p.mapping.apiFootballHomeTeamId ?? 0,
          awayTeamId: p.mapping.apiFootballAwayTeamId ?? 0,
          kickoffUtc: match.kickoffUtc,
          ...(p.state.tournamentInstance.apiFootballLeagueId
            ? { leagueId: p.state.tournamentInstance.apiFootballLeagueId }
            : {}),
          ...(p.state.tournamentInstance.apiFootballSeasonId
            ? { season: p.state.tournamentInstance.apiFootballSeasonId }
            : {}),
        });
      }

      if (retrackPayload.length > 0) {
        try {
          const result = await client.trackFixtures(retrackPayload);
          console.log(
            `[TrackStatusCheck] Re-tracked ${result.tracked} fixtures, ${result.rejected} rejected`
          );
        } catch (err) {
          console.error("[TrackStatusCheck] Re-track failed:", err);
        }
      }
    }

    // Alert admin (deduped per process)
    const newAlerts = problemFixtures.filter((p) => !recentlyAlerted.has(p.fixtureId));
    if (newAlerts.length > 0) {
      newAlerts.forEach((p) => recentlyAlerted.add(p.fixtureId));
      const rows = newAlerts
        .map(
          (p) =>
            `<li>Fixture ${p.fixtureId} (${p.state.internalMatchId}) — kickoff ${p.state.kickoffUtc.toISOString()} — issue: <strong>${p.issue}</strong></li>`
        )
        .join("");
      sendAdminNotification({
        subject: `Track status: ${newAlerts.length} fixtures con problemas`,
        body: `<p>The pre-match track status check found fixtures that are not properly tracked:</p><ul>${rows}</ul><p>UNTRACKED fixtures were automatically re-tracked. NO_SOURCES means the scraper has the fixture registered but no source is reporting data yet (problem if kickoff is &lt; 5 min away).</p>`,
        category: "error",
      }).catch(() => {});
    }
    recordHeartbeat("TrackStatusCheckerJob");
  } catch (err) {
    console.error(
      "[TrackStatusCheck] Error:",
      err instanceof Error ? err.message : String(err)
    );
  } finally {
    isRunning = false;
  }
}

export function startTrackStatusCheckerJob(): void {
  if (scheduledTask) return;
  console.log(`[TrackStatusCheck] Starting with cron: ${CRON_SCHEDULE}`);
  scheduledTask = cron.schedule(CRON_SCHEDULE, async () => {
    await runTrackStatusCheck();
  });
}

export function stopTrackStatusCheckerJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[TrackStatusCheck] Stopped");
  }
}
