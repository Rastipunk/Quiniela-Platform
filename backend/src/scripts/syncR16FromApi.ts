/**
 * Sync R16 (Round of 16) fixtures from API-Football into the UCL 2025-26 instance
 *
 * This script:
 * 1. Fetches all "Round of 16" fixtures from API-Football (league=2, season=2025)
 * 2. Maps API teams to our internal team IDs via apiFootballId
 * 3. Updates the instance's dataJson with real kickoff times, teams, and status
 * 4. Creates MatchExternalMapping records for Smart Sync
 * 5. Re-initializes MatchSyncState so automatic result polling works
 *
 * Safe to run multiple times (idempotent via upserts).
 *
 * Usage:
 *   npx tsx src/scripts/syncR16FromApi.ts
 *   npx tsx src/scripts/syncR16FromApi.ts --dry-run   # Preview without writing
 */

import "dotenv/config";
import { prisma } from "../db";
import { ApiFootballClient } from "../services/apiFootball/client";
import type { ApiFootballFixture } from "../services/apiFootball/types";

// ============================================================================
// CONFIG
// ============================================================================

const INSTANCE_ID = "ucl-2025-instance";
const UCL_LEAGUE_ID = 2;
const UCL_SEASON = 2025;
const R16_ROUND = "Round of 16";

const DRY_RUN = process.argv.includes("--dry-run");

// ============================================================================
// HELPERS
// ============================================================================

interface TieFromApi {
  tieNumber: number;
  teamAId: string;       // internal ID (e.g. "t_GAL")
  teamBId: string;       // internal ID (e.g. "t_LIV")
  teamAName: string;
  teamBName: string;
  leg1: { fixtureId: number; kickoffUtc: string; apiHomeTeamId: number };
  leg2: { fixtureId: number; kickoffUtc: string; apiHomeTeamId: number };
}

/**
 * Group R16 fixtures into ties (two legs per matchup).
 * API-Football returns individual fixtures; we pair them by team matchup.
 */
function groupIntoTies(
  fixtures: ApiFootballFixture[],
  teamMap: Map<number, { id: string; name: string }>
): TieFromApi[] {
  // Group by team pair key (sorted apiFootballIds)
  const pairMap = new Map<string, ApiFootballFixture[]>();

  for (const f of fixtures) {
    const homeApiId = f.teams.home.id;
    const awayApiId = f.teams.away.id;
    const key = [Math.min(homeApiId, awayApiId), Math.max(homeApiId, awayApiId)].join("-");
    if (!pairMap.has(key)) pairMap.set(key, []);
    pairMap.get(key)!.push(f);
  }

  const ties: TieFromApi[] = [];
  let tieNum = 1;

  // Sort pairs by first leg date for consistent tie numbering
  const sortedPairs = [...pairMap.values()].map((legs) => {
    legs.sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
    return legs;
  }).sort((a, b) => new Date(a[0].fixture.date).getTime() - new Date(b[0].fixture.date).getTime());

  for (const legs of sortedPairs) {
    if (legs.length !== 2) {
      console.warn(`⚠️  Expected 2 legs, got ${legs.length} for fixture pair. Skipping.`);
      continue;
    }

    const leg1 = legs[0];
    const leg2 = legs[1];

    // Leg 1: home team in API = unseeded team (teamA in our model)
    const leg1HomeApiId = leg1.teams.home.id;
    const leg1AwayApiId = leg1.teams.away.id;

    const teamA = teamMap.get(leg1HomeApiId);
    const teamB = teamMap.get(leg1AwayApiId);

    if (!teamA || !teamB) {
      console.warn(
        `⚠️  Unknown team(s): home=${leg1.teams.home.name} (API ID ${leg1HomeApiId}), ` +
        `away=${leg1.teams.away.name} (API ID ${leg1AwayApiId}). Skipping.`
      );
      continue;
    }

    ties.push({
      tieNumber: tieNum++,
      teamAId: teamA.id,
      teamBId: teamB.id,
      teamAName: teamA.name,
      teamBName: teamB.name,
      leg1: {
        fixtureId: leg1.fixture.id,
        kickoffUtc: new Date(leg1.fixture.date).toISOString(),
        apiHomeTeamId: leg1HomeApiId,
      },
      leg2: {
        fixtureId: leg2.fixture.id,
        kickoffUtc: new Date(leg2.fixture.date).toISOString(),
        apiHomeTeamId: leg2.teams.home.id,
      },
    });
  }

  return ties;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("🏆 Sync UCL 2025-26 R16 fixtures from API-Football\n");
  if (DRY_RUN) console.log("🔍 DRY RUN — no database writes\n");

  // 1. Load instance
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: INSTANCE_ID },
  });

  if (!instance) {
    console.error(`❌ Instance "${INSTANCE_ID}" not found`);
    process.exit(1);
  }

  const dataJson = instance.dataJson as {
    teams: Array<{ id: string; name: string; apiFootballId?: number | null }>;
    matches: Array<{
      id: string; phaseId: string; kickoffUtc: string;
      homeTeamId: string; awayTeamId: string;
      matchNumber: number; label: string;
      tieNumber?: number; leg?: number; status: string;
    }>;
    [key: string]: unknown;
  };

  // 2. Build apiFootballId → internal team mapping
  const teamMap = new Map<number, { id: string; name: string }>();
  for (const team of dataJson.teams) {
    if (team.apiFootballId) {
      teamMap.set(team.apiFootballId, { id: team.id, name: team.name });
    }
  }
  console.log(`📋 Loaded ${teamMap.size} teams with API-Football IDs\n`);

  // 3. Fetch R16 fixtures from API-Football
  console.log(`🌐 Fetching "${R16_ROUND}" fixtures (league=${UCL_LEAGUE_ID}, season=${UCL_SEASON})...`);
  const client = new ApiFootballClient();
  const r16Fixtures = await client.getFixtures({
    league: UCL_LEAGUE_ID,
    season: UCL_SEASON,
    round: R16_ROUND,
  });

  console.log(`   ✓ Got ${r16Fixtures.length} fixtures from API-Football\n`);

  if (r16Fixtures.length === 0) {
    console.log("⚠️  No R16 fixtures found. The round may not be available yet in API-Football.");
    process.exit(0);
  }

  // Print raw fixtures for transparency
  console.log("📡 Raw API fixtures:");
  for (const f of r16Fixtures) {
    const kickoff = new Date(f.fixture.date);
    console.log(
      `   #${f.fixture.id} | ${kickoff.toISOString().slice(0, 16)}Z | ` +
      `${f.teams.home.name} vs ${f.teams.away.name} [${f.fixture.status.short}]`
    );
  }
  console.log();

  // 4. Group into ties
  const ties = groupIntoTies(r16Fixtures, teamMap);
  console.log(`🔗 Grouped into ${ties.length} ties:\n`);

  for (const tie of ties) {
    const l1 = new Date(tie.leg1.kickoffUtc);
    const l2 = new Date(tie.leg2.kickoffUtc);
    console.log(`   Tie ${tie.tieNumber}: ${tie.teamAName} vs ${tie.teamBName}`);
    console.log(`     Leg 1: #${tie.leg1.fixtureId} | ${l1.toISOString().slice(0, 16)}Z | ${tie.teamAName} (H)`);
    console.log(`     Leg 2: #${tie.leg2.fixtureId} | ${l2.toISOString().slice(0, 16)}Z | ${tie.teamBName} (H)`);
  }
  console.log();

  if (DRY_RUN) {
    console.log("🔍 DRY RUN complete. No database changes made.");
    await prisma.$disconnect();
    return;
  }

  // 5. Update dataJson matches
  console.log("💾 Updating instance dataJson...");
  let matchesUpdated = 0;

  for (const tie of ties) {
    // Leg 1: teamA (unseeded) hosts
    const leg1Id = `r16_${tie.tieNumber}_leg1`;
    const leg1Match = dataJson.matches.find((m) => m.id === leg1Id);
    if (leg1Match) {
      leg1Match.kickoffUtc = tie.leg1.kickoffUtc;
      leg1Match.homeTeamId = tie.teamAId;
      leg1Match.awayTeamId = tie.teamBId;
      leg1Match.label = `${tie.teamAName} vs ${tie.teamBName}`;
      leg1Match.tieNumber = tie.tieNumber;
      leg1Match.leg = 1;
      leg1Match.status = "SCHEDULED";
      matchesUpdated++;
    } else {
      console.warn(`   ⚠️ Match ${leg1Id} not found in dataJson — will be appended`);
    }

    // Leg 2: teamB (seeded) hosts
    const leg2Id = `r16_${tie.tieNumber}_leg2`;
    const leg2Match = dataJson.matches.find((m) => m.id === leg2Id);
    if (leg2Match) {
      leg2Match.kickoffUtc = tie.leg2.kickoffUtc;
      leg2Match.homeTeamId = tie.teamBId;
      leg2Match.awayTeamId = tie.teamAId;
      leg2Match.label = `${tie.teamBName} vs ${tie.teamAName}`;
      leg2Match.tieNumber = tie.tieNumber;
      leg2Match.leg = 2;
      leg2Match.status = "SCHEDULED";
      matchesUpdated++;
    } else {
      console.warn(`   ⚠️ Match ${leg2Id} not found in dataJson — will be appended`);
    }
  }

  // Re-sort matches by kickoff
  dataJson.matches.sort(
    (a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime()
  );

  // Write back to DB
  await prisma.tournamentInstance.update({
    where: { id: INSTANCE_ID },
    data: { dataJson: dataJson as any },
  });

  // Also update the template version so new pools get the correct data
  const templateVersion = await prisma.tournamentTemplateVersion.findFirst({
    where: { templateId: instance.templateId },
    orderBy: { versionNumber: "desc" },
  });
  if (templateVersion) {
    await prisma.tournamentTemplateVersion.update({
      where: { id: templateVersion.id },
      data: { dataJson: dataJson as any },
    });
    console.log(`   ✓ Template version updated too`);
  }

  console.log(`   ✓ ${matchesUpdated} matches updated in dataJson\n`);

  // 6. Create MatchExternalMapping for R16
  console.log("🔗 Creating MatchExternalMappings...");
  let mappingCount = 0;

  for (const tie of ties) {
    // Leg 1
    await prisma.matchExternalMapping.upsert({
      where: {
        tournamentInstanceId_internalMatchId: {
          tournamentInstanceId: INSTANCE_ID,
          internalMatchId: `r16_${tie.tieNumber}_leg1`,
        },
      },
      create: {
        tournamentInstanceId: INSTANCE_ID,
        internalMatchId: `r16_${tie.tieNumber}_leg1`,
        apiFootballFixtureId: tie.leg1.fixtureId,
      },
      update: {
        apiFootballFixtureId: tie.leg1.fixtureId,
      },
    });
    mappingCount++;

    // Leg 2
    await prisma.matchExternalMapping.upsert({
      where: {
        tournamentInstanceId_internalMatchId: {
          tournamentInstanceId: INSTANCE_ID,
          internalMatchId: `r16_${tie.tieNumber}_leg2`,
        },
      },
      create: {
        tournamentInstanceId: INSTANCE_ID,
        internalMatchId: `r16_${tie.tieNumber}_leg2`,
        apiFootballFixtureId: tie.leg2.fixtureId,
      },
      update: {
        apiFootballFixtureId: tie.leg2.fixtureId,
      },
    });
    mappingCount++;
  }
  console.log(`   ✓ ${mappingCount} mappings created/updated\n`);

  // 7. Re-initialize MatchSyncState for R16 matches
  console.log("🔄 Re-initializing MatchSyncState for R16...");
  let syncCount = 0;

  for (const tie of ties) {
    for (const legInfo of [
      { leg: 1, kickoffUtc: tie.leg1.kickoffUtc, fixtureId: tie.leg1.fixtureId },
      { leg: 2, kickoffUtc: tie.leg2.kickoffUtc, fixtureId: tie.leg2.fixtureId },
    ]) {
      const matchId = `r16_${tie.tieNumber}_leg${legInfo.leg}`;
      const kickoff = new Date(legInfo.kickoffUtc);
      const firstCheckAt = new Date(kickoff.getTime() + 5 * 60 * 1000);
      const finishCheckAt = new Date(kickoff.getTime() + 110 * 60 * 1000);

      // Check if the match already has a COMPLETED sync state (don't overwrite)
      const existing = await prisma.matchSyncState.findUnique({
        where: {
          tournamentInstanceId_internalMatchId: {
            tournamentInstanceId: INSTANCE_ID,
            internalMatchId: matchId,
          },
        },
      });

      if (existing?.syncStatus === "COMPLETED") {
        console.log(`   ⏭️ ${matchId} already COMPLETED — skipping`);
        continue;
      }

      await prisma.matchSyncState.upsert({
        where: {
          tournamentInstanceId_internalMatchId: {
            tournamentInstanceId: INSTANCE_ID,
            internalMatchId: matchId,
          },
        },
        create: {
          tournamentInstanceId: INSTANCE_ID,
          internalMatchId: matchId,
          syncStatus: "PENDING",
          kickoffUtc: kickoff,
          firstCheckAtUtc: firstCheckAt,
          finishCheckAtUtc: finishCheckAt,
        },
        update: {
          syncStatus: "PENDING",
          kickoffUtc: kickoff,
          firstCheckAtUtc: firstCheckAt,
          finishCheckAtUtc: finishCheckAt,
          lastCheckedAtUtc: null,
          lastApiStatus: null,
          completedAtUtc: null,
        },
      });
      syncCount++;
    }
  }
  console.log(`   ✓ ${syncCount} sync states initialized as PENDING\n`);

  // 8. Verification summary
  console.log("=".repeat(60));
  console.log("✅ R16 SYNC COMPLETE");
  console.log("=".repeat(60));

  // Verify mappings
  const totalMappings = await prisma.matchExternalMapping.count({
    where: { tournamentInstanceId: INSTANCE_ID },
  });
  const r16Mappings = await prisma.matchExternalMapping.count({
    where: {
      tournamentInstanceId: INSTANCE_ID,
      internalMatchId: { startsWith: "r16_" },
    },
  });

  // Verify sync states
  const syncStates = await prisma.matchSyncState.groupBy({
    by: ["syncStatus"],
    where: { tournamentInstanceId: INSTANCE_ID },
    _count: { syncStatus: true },
  });

  console.log(`\n📊 Instance: ${instance.name}`);
  console.log(`   Total mappings: ${totalMappings} (R16: ${r16Mappings})`);
  console.log(`   Sync states:`);
  for (const s of syncStates) {
    console.log(`     ${s.syncStatus}: ${s._count.syncStatus}`);
  }

  console.log(`\n📅 R16 Matches (as stored in dataJson):`);
  const r16Matches = dataJson.matches.filter((m) => m.phaseId.startsWith("r16_"));
  for (const m of r16Matches) {
    const kickoff = new Date(m.kickoffUtc);
    const homeName = dataJson.teams.find((t) => t.id === m.homeTeamId)?.name ?? m.homeTeamId;
    const awayName = dataJson.teams.find((t) => t.id === m.awayTeamId)?.name ?? m.awayTeamId;
    console.log(`   ${m.id} | ${kickoff.toISOString().slice(0, 16)}Z | ${homeName} vs ${awayName} [${m.status}]`);
  }

  console.log(`\n💡 Timezone note: All times stored as UTC.`);
  console.log(`   Frontend converts to user's timezone via Intl.DateTimeFormat.`);
  console.log(`   User timezone is auto-detected on login and saved to profile.`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Error:", e);
    prisma.$disconnect();
    process.exit(1);
  });
