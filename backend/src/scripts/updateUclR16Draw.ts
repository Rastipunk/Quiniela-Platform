/**
 * Update script: Champions League 2025-26 — Round of 16 Draw Results
 *
 * Executed after the R16 draw (Feb 27, 2026).
 * Fetches R16 fixtures from API-Football and updates:
 * - TournamentInstance.dataJson (R16 matches with real teams, fixture IDs, dates)
 * - TournamentTemplateVersion.dataJson (so new pools get updated data)
 * - All existing Pool.fixtureSnapshot (preserving R32 match data and results)
 * - Creates MatchExternalMapping for R16 fixtures
 * - Creates MatchSyncState for R16 fixtures
 *
 * SAFE: Only updates PLACEHOLDER matches. Never touches SCHEDULED/completed matches.
 *
 * Run: npx tsx src/scripts/updateUclR16Draw.ts
 */

import "dotenv/config";
import { prisma } from "../db";
import { ApiFootballClient } from "../services/apiFootball/client";

// ============================================================================
// CONSTANTS
// ============================================================================

const INSTANCE_ID = "ucl-2025-instance";
const TEMPLATE_ID = "ucl-2025-template";
const VERSION_ID = "ucl-2025-version";

// API-Football team ID → internal team ID mapping
const API_TO_INTERNAL: Record<number, string> = {
  // R32 teams
  645: "t_GAL", // Galatasaray
  496: "t_JUV", // Juventus
  91: "t_MON",  // Monaco
  85: "t_PSG",  // PSG
  165: "t_BVB", // Borussia Dortmund
  499: "t_ATA", // Atalanta
  211: "t_BEN", // Benfica
  541: "t_RMA", // Real Madrid
  556: "t_QAR", // Qarabag
  34: "t_NEW",  // Newcastle
  327: "t_BOD", // Bodo/Glimt
  505: "t_INT", // Inter
  553: "t_OLY", // Olympiacos
  168: "t_LEV", // Bayer Leverkusen
  569: "t_BRU", // Club Brugge
  530: "t_ATM", // Atletico Madrid
  // Top 8 (seeded)
  42: "t_ARS",  // Arsenal
  157: "t_BAY", // Bayern
  40: "t_LIV",  // Liverpool
  47: "t_TOT",  // Tottenham
  529: "t_BAR", // Barcelona
  49: "t_CHE",  // Chelsea
  228: "t_SPO", // Sporting CP
  50: "t_MCI",  // Manchester City
};

// ============================================================================
// TYPES
// ============================================================================

interface MatchData {
  id: string;
  phaseId: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  matchNumber: number;
  label: string;
  tieNumber?: number;
  leg?: number;
  status: "SCHEDULED" | "PLACEHOLDER";
}

interface TemplateData {
  meta: any;
  teams: any[];
  phases: any[];
  matches: MatchData[];
  advancement: any;
}

interface R16TieData {
  tieNumber: number;
  teamA: string; // home in leg 1 (R32 winner)
  teamB: string; // away in leg 1 (seeded team)
  leg1: { fixtureId: number; kickoffUtc: string };
  leg2: { fixtureId: number; kickoffUtc: string };
}

// ============================================================================
// FETCH AND MAP R16 DATA
// ============================================================================

async function fetchR16Fixtures(): Promise<R16TieData[]> {
  const client = new ApiFootballClient();

  console.log("   Fetching UCL 2025-26 fixtures from API-Football...");
  const allFixtures = await client.getFixtures({ league: 2, season: 2025 });

  // Filter R16 fixtures
  const r16Fixtures = allFixtures.filter((f: any) => f.league.round === "Round of 16");
  console.log(`   Found ${r16Fixtures.length} R16 fixtures`);

  if (r16Fixtures.length !== 16) {
    throw new Error(`Expected 16 R16 fixtures, got ${r16Fixtures.length}`);
  }

  // Group into ties (same two teams, different legs)
  const tieMap = new Map<string, any[]>();

  for (const f of r16Fixtures) {
    const homeApiId = f.teams.home.id;
    const awayApiId = f.teams.away.id;
    // Use sorted IDs as key to group both legs
    const key = [Math.min(homeApiId, awayApiId), Math.max(homeApiId, awayApiId)].join("-");
    if (!tieMap.has(key)) tieMap.set(key, []);
    tieMap.get(key)!.push(f);
  }

  if (tieMap.size !== 8) {
    throw new Error(`Expected 8 R16 ties, got ${tieMap.size}`);
  }

  // Convert to R16TieData
  const ties: R16TieData[] = [];
  let tieNum = 1;

  for (const [, legs] of tieMap.entries()) {
    // Sort by date → leg 1 is earlier
    legs.sort(
      (a: any, b: any) =>
        new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime()
    );

    const leg1 = legs[0];
    const leg2 = legs[1];

    const leg1HomeApiId = leg1.teams.home.id;
    const leg1AwayApiId = leg1.teams.away.id;

    const teamA = API_TO_INTERNAL[leg1HomeApiId];
    const teamB = API_TO_INTERNAL[leg1AwayApiId];

    if (!teamA) {
      throw new Error(
        `Unknown API team ID ${leg1HomeApiId} (${leg1.teams.home.name}). Add it to API_TO_INTERNAL.`
      );
    }
    if (!teamB) {
      throw new Error(
        `Unknown API team ID ${leg1AwayApiId} (${leg1.teams.away.name}). Add it to API_TO_INTERNAL.`
      );
    }

    ties.push({
      tieNumber: tieNum++,
      teamA,
      teamB,
      leg1: {
        fixtureId: leg1.fixture.id,
        kickoffUtc: new Date(leg1.fixture.date).toISOString(),
      },
      leg2: {
        fixtureId: leg2.fixture.id,
        kickoffUtc: new Date(leg2.fixture.date).toISOString(),
      },
    });
  }

  return ties;
}

// ============================================================================
// UPDATE LOGIC
// ============================================================================

function updateMatchesWithR16Data(
  data: TemplateData,
  r16Ties: R16TieData[]
): TemplateData {
  const teamName = (id: string) =>
    data.teams.find((t: any) => t.id === id)?.name ?? id;

  const updatedMatches = data.matches.map((match) => {
    // Only update PLACEHOLDER R16 matches
    if (match.status !== "PLACEHOLDER") return match;
    if (!match.phaseId.startsWith("r16_")) return match;

    // Find the original tieNumber to match with the new tie
    const originalTieNumber = match.tieNumber;
    if (!originalTieNumber) return match;

    // Match new tie data using the same tieNumber
    const tie = r16Ties.find((t) => t.tieNumber === originalTieNumber);
    if (!tie) return match;

    const isLeg1 = match.phaseId === "r16_leg1";
    const isLeg2 = match.phaseId === "r16_leg2";

    if (isLeg1) {
      const homeTeamId = tie.teamA;
      const awayTeamId = tie.teamB;
      return {
        ...match,
        homeTeamId,
        awayTeamId,
        kickoffUtc: tie.leg1.kickoffUtc,
        label: `${teamName(homeTeamId)} vs ${teamName(awayTeamId)}`,
        status: "SCHEDULED" as const,
      };
    }

    if (isLeg2) {
      const homeTeamId = tie.teamB;
      const awayTeamId = tie.teamA;
      return {
        ...match,
        homeTeamId,
        awayTeamId,
        kickoffUtc: tie.leg2.kickoffUtc,
        label: `${teamName(homeTeamId)} vs ${teamName(awayTeamId)}`,
        status: "SCHEDULED" as const,
      };
    }

    return match;
  });

  return { ...data, matches: updatedMatches };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("UCL 2025-26: Updating R16 with Draw Results");
  console.log("=".repeat(60));

  // 1. Fetch R16 data from API-Football
  console.log("\n1. Fetching R16 fixtures from API-Football...");
  const r16Ties = await fetchR16Fixtures();

  console.log("\n   R16 Draw Results:");
  for (const tie of r16Ties) {
    console.log(
      `   Tie ${tie.tieNumber}: ${tie.teamA} vs ${tie.teamB} | Leg1: #${tie.leg1.fixtureId} (${tie.leg1.kickoffUtc.slice(0, 16)}) | Leg2: #${tie.leg2.fixtureId} (${tie.leg2.kickoffUtc.slice(0, 16)})`
    );
  }

  // 2. Load current instance
  console.log("\n2. Loading tournament instance...");
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: INSTANCE_ID },
  });

  if (!instance) {
    throw new Error(`Instance ${INSTANCE_ID} not found`);
  }

  const currentData = instance.dataJson as TemplateData;
  const teamName = (id: string) =>
    currentData.teams.find((t: any) => t.id === id)?.name ?? id;

  // Show what R16 looks like BEFORE update
  const r16Before = currentData.matches.filter((m) => m.phaseId.startsWith("r16_"));
  console.log(`   Current R16 matches: ${r16Before.length}`);
  const placeholders = r16Before.filter((m) => m.status === "PLACEHOLDER");
  console.log(`   Placeholder matches: ${placeholders.length}`);

  if (placeholders.length === 0) {
    console.log("   All R16 matches are already SCHEDULED. Nothing to update.");
    await prisma.$disconnect();
    return;
  }

  // 3. Update instance dataJson
  console.log("\n3. Updating instance dataJson with R16 teams...");
  const updatedData = updateMatchesWithR16Data(currentData, r16Ties);

  await prisma.tournamentInstance.update({
    where: { id: INSTANCE_ID },
    data: { dataJson: updatedData as any },
  });
  console.log("   Instance updated");

  // 4. Update template version dataJson (for new pool creation)
  console.log("\n4. Updating template version...");
  const version = await prisma.tournamentTemplateVersion.findUnique({
    where: { id: VERSION_ID },
  });

  if (version) {
    const versionData = version.dataJson as TemplateData;
    const updatedVersionData = updateMatchesWithR16Data(versionData, r16Ties);
    await prisma.tournamentTemplateVersion.update({
      where: { id: VERSION_ID },
      data: { dataJson: updatedVersionData as any },
    });
    console.log("   Template version updated");
  }

  // 5. Create MatchExternalMapping for R16 fixtures
  console.log("\n5. Creating R16 fixture mappings...");
  let mappingCount = 0;

  for (const tie of r16Ties) {
    // Leg 1 mapping
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

    // Leg 2 mapping
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

    mappingCount += 2;
  }
  console.log(`   Created/updated ${mappingCount} fixture mappings`);

  // 6. Create MatchSyncState for R16 fixtures
  console.log("\n6. Creating R16 sync states...");
  let syncCount = 0;

  for (const tie of r16Ties) {
    for (const leg of [
      { matchId: `r16_${tie.tieNumber}_leg1`, kickoff: tie.leg1.kickoffUtc },
      { matchId: `r16_${tie.tieNumber}_leg2`, kickoff: tie.leg2.kickoffUtc },
    ]) {
      const kickoffUtc = new Date(leg.kickoff);
      await prisma.matchSyncState.upsert({
        where: {
          tournamentInstanceId_internalMatchId: {
            tournamentInstanceId: INSTANCE_ID,
            internalMatchId: leg.matchId,
          },
        },
        create: {
          tournamentInstanceId: INSTANCE_ID,
          internalMatchId: leg.matchId,
          syncStatus: "PENDING",
          kickoffUtc,
          firstCheckAtUtc: new Date(kickoffUtc.getTime() + 5 * 60 * 1000),
          finishCheckAtUtc: new Date(kickoffUtc.getTime() + 110 * 60 * 1000),
        },
        update: {
          kickoffUtc,
          firstCheckAtUtc: new Date(kickoffUtc.getTime() + 5 * 60 * 1000),
          finishCheckAtUtc: new Date(kickoffUtc.getTime() + 110 * 60 * 1000),
        },
      });
      syncCount++;
    }
  }
  console.log(`   Created/updated ${syncCount} sync states`);

  // 7. Update ALL existing pools' fixtureSnapshot
  console.log("\n7. Updating existing pools...");
  const pools = await prisma.pool.findMany({
    where: { tournamentInstanceId: INSTANCE_ID },
    select: { id: true, name: true, fixtureSnapshot: true },
  });

  console.log(`   Found ${pools.length} pool(s) to update`);

  for (const pool of pools) {
    const poolData = (pool.fixtureSnapshot ?? currentData) as TemplateData;

    // CRITICAL: Only update PLACEHOLDER matches, preserve everything else
    const updatedPoolData = updateMatchesWithR16Data(poolData, r16Ties);

    await prisma.pool.update({
      where: { id: pool.id },
      data: { fixtureSnapshot: updatedPoolData as any },
    });

    console.log(`   Updated pool: ${pool.name} (${pool.id})`);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("UPDATE COMPLETE");
  console.log("=".repeat(60));

  console.log("\nR16 Draw:");
  for (const tie of r16Ties) {
    console.log(
      `  ${tie.tieNumber}. ${teamName(tie.teamA)} vs ${teamName(tie.teamB)}`
    );
    console.log(
      `     Ida: ${tie.leg1.kickoffUtc.slice(0, 10)} #${tie.leg1.fixtureId} | Vuelta: ${tie.leg2.kickoffUtc.slice(0, 10)} #${tie.leg2.fixtureId}`
    );
  }

  console.log(`\nStats:`);
  console.log(`  Fixture mappings: ${mappingCount}`);
  console.log(`  Sync states: ${syncCount}`);
  console.log(`  Pools updated: ${pools.length}`);

  // Verify
  const verifyInstance = await prisma.tournamentInstance.findUnique({
    where: { id: INSTANCE_ID },
  });
  const verifyData = verifyInstance!.dataJson as TemplateData;
  const r16After = verifyData.matches.filter((m) => m.phaseId.startsWith("r16_"));
  const scheduled = r16After.filter((m) => m.status === "SCHEDULED");
  const stillPlaceholder = r16After.filter((m) => m.status === "PLACEHOLDER");

  console.log(`\nVerification:`);
  console.log(`  R16 SCHEDULED: ${scheduled.length}/16`);
  console.log(`  R16 PLACEHOLDER: ${stillPlaceholder.length}/16`);

  if (stillPlaceholder.length > 0) {
    console.log("  WARNING: Some R16 matches still PLACEHOLDER!");
    for (const m of stillPlaceholder) {
      console.log(`    ${m.id}: ${m.homeTeamId} vs ${m.awayTeamId}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
