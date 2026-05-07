/**
 * Fixture Verification Job
 *
 * Runs once a day (default 06:00 UTC) to verify that the kickoffs/venues
 * stored in our seed match what picks4all-scores observes from sources.
 *
 * Does NOT auto-update — only alerts admin if drift is detected,
 * because changing kickoffs would invalidate already-made picks.
 */

import * as cron from "node-cron";
import { prisma } from "../db";
import { getScoresServiceClient } from "../services/scoresService";
import { sendAdminNotification } from "../lib/email";

const CRON_SCHEDULE = process.env.FIXTURE_VERIFY_CRON || "0 6 * * *"; // 06:00 UTC daily

/** Drift threshold in milliseconds (default: 30 minutes) */
const DRIFT_THRESHOLD_MS = parseInt(
  process.env.FIXTURE_VERIFY_DRIFT_MS || String(30 * 60 * 1000),
  10
);

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

interface DriftReport {
  fixtureId: number;
  internalMatchId?: string;
  homeTeam: string;
  awayTeam: string;
  registeredKickoff: string;
  observedKickoff: string;
  driftMinutes: number;
  venue?: string | null;
}

async function runFixtureVerification(): Promise<void> {
  if (isRunning) {
    console.log("[FixtureVerifyJob] Skipping — previous run in progress");
    return;
  }
  isRunning = true;

  try {
    // Check platform toggle
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
    if (!settings?.scoresServiceEnabled) {
      return;
    }

    const client = getScoresServiceClient();
    if (!client.isAvailable()) {
      return;
    }

    // Get all AUTO instances with league/season configured
    const instances = await prisma.tournamentInstance.findMany({
      where: {
        resultSourceMode: "AUTO",
        syncEnabled: true,
        status: "ACTIVE",
        apiFootballLeagueId: { not: null },
        apiFootballSeasonId: { not: null },
      },
      select: {
        id: true,
        name: true,
        dataJson: true,
        apiFootballLeagueId: true,
        apiFootballSeasonId: true,
        matchMappings: {
          select: { internalMatchId: true, apiFootballFixtureId: true },
        },
      },
    });

    if (instances.length === 0) return;

    const allDrifts: DriftReport[] = [];

    for (const inst of instances) {
      try {
        const verifyResp = await client.getFixturesVerify({
          league: inst.apiFootballLeagueId!,
          season: inst.apiFootballSeasonId!,
        });

        const data = inst.dataJson as {
          matches?: Array<{ id: string; kickoffUtc?: string; homeTeamId: string; awayTeamId: string }>;
          teams?: Array<{ id: string; name: string }>;
        } | null;
        if (!data) continue;

        const teamName = (id: string): string =>
          data.teams?.find((t) => t.id === id)?.name ?? id;
        const matchByMappingId = new Map(
          data.matches?.map((m) => [m.id, m]) ?? []
        );
        const fixtureIdToInternal = new Map(
          inst.matchMappings.map((m) => [m.apiFootballFixtureId, m.internalMatchId])
        );

        for (const verified of verifyResp.fixtures) {
          const internalId = fixtureIdToInternal.get(verified.fixtureId);
          if (!internalId) continue;
          const ourMatch = matchByMappingId.get(internalId);
          if (!ourMatch?.kickoffUtc) continue;

          const ours = new Date(ourMatch.kickoffUtc).getTime();
          const observed = new Date(verified.kickoffUtc).getTime();
          const driftMs = Math.abs(observed - ours);

          if (driftMs > DRIFT_THRESHOLD_MS) {
            allDrifts.push({
              fixtureId: verified.fixtureId,
              internalMatchId: internalId,
              homeTeam: teamName(ourMatch.homeTeamId),
              awayTeam: teamName(ourMatch.awayTeamId),
              registeredKickoff: ourMatch.kickoffUtc,
              observedKickoff: verified.kickoffUtc,
              driftMinutes: Math.round(driftMs / 60_000),
              venue: verified.venue,
            });
          }
        }
      } catch (err) {
        console.error(
          `[FixtureVerifyJob] Failed to verify instance ${inst.id}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    if (allDrifts.length === 0) {
      console.log("[FixtureVerifyJob] All fixtures verified, no drift detected");
      return;
    }

    console.warn(
      `[FixtureVerifyJob] ${allDrifts.length} fixtures with kickoff drift > ${DRIFT_THRESHOLD_MS / 60_000}min`
    );

    const driftRows = allDrifts
      .map(
        (d) =>
          `<tr>
            <td>${d.homeTeam} vs ${d.awayTeam}</td>
            <td>${d.registeredKickoff}</td>
            <td>${d.observedKickoff}</td>
            <td>${d.driftMinutes} min</td>
            <td>${d.venue || "—"}</td>
          </tr>`
      )
      .join("");

    sendAdminNotification({
      subject: `Drift de kickoff detectado en ${allDrifts.length} fixtures`,
      body: `<p>The daily fixture verification job detected kickoffs that differ from our database.</p>
<p><strong>NO automatic update was performed</strong> — review and decide manually whether to update.</p>
<table border="1" cellpadding="6" style="border-collapse:collapse">
  <tr><th>Match</th><th>Our Kickoff (UTC)</th><th>Observed (UTC)</th><th>Drift</th><th>Venue</th></tr>
  ${driftRows}
</table>
<p>Threshold: ${DRIFT_THRESHOLD_MS / 60_000} minutes</p>`,
      category: "error",
    }).catch((err) => {
      console.error("[FixtureVerificationJob] sendAdminNotification failed:", err instanceof Error ? err.message : String(err));
    });
  } catch (err) {
    console.error(
      "[FixtureVerifyJob] Error:",
      err instanceof Error ? err.message : String(err)
    );
  } finally {
    isRunning = false;
  }
}

export function startFixtureVerificationJob(): void {
  if (scheduledTask) {
    console.log("[FixtureVerifyJob] Already running");
    return;
  }
  console.log(`[FixtureVerifyJob] Starting with cron: ${CRON_SCHEDULE}`);
  scheduledTask = cron.schedule(CRON_SCHEDULE, async () => {
    await runFixtureVerification();
  });
}

export function stopFixtureVerificationJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[FixtureVerifyJob] Stopped");
  }
}

export async function triggerFixtureVerification(): Promise<void> {
  await runFixtureVerification();
}
