/**
 * Fetch all UCL 2025-26 fixture data from API-Football
 * Save to a JSON file for analysis and seed script creation
 */
import "dotenv/config";
import { ApiFootballClient } from "../services/apiFootball/client";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const client = new ApiFootballClient();

  console.log("🏆 Fetching all UCL 2025-26 fixtures...\n");

  // One API call to get everything
  const fixtures = await client.getFixtures({ league: 2, season: 2025 });
  console.log(`Total fixtures: ${fixtures.length}\n`);

  // Group by round
  const byRound = new Map<string, any[]>();
  for (const f of fixtures) {
    const round = f.league.round;
    if (!byRound.has(round)) byRound.set(round, []);
    byRound.get(round)!.push(f);
  }

  // Show rounds summary
  console.log("📊 Rounds:");
  for (const [round, fxs] of byRound.entries()) {
    const statuses = fxs.map((f: any) => f.fixture.status.short);
    const statusCounts: Record<string, number> = {};
    statuses.forEach((s: string) => (statusCounts[s] = (statusCounts[s] || 0) + 1));
    console.log(`  ${round}: ${fxs.length} fixtures (${JSON.stringify(statusCounts)})`);
  }

  // Focus on Round of 32 (the upcoming matches)
  const r32 = byRound.get("Round of 32") || [];
  console.log(`\n🎯 Round of 32: ${r32.length} fixtures\n`);

  // Group by tie (same two teams, different legs)
  const ties = new Map<string, any[]>();
  for (const f of r32) {
    const homeId = f.teams.home.id;
    const awayId = f.teams.away.id;
    // Key: sorted team IDs to group both legs together
    const key = [Math.min(homeId, awayId), Math.max(homeId, awayId)].join("-");
    if (!ties.has(key)) ties.set(key, []);
    ties.get(key)!.push(f);
  }

  console.log(`Ties (matchups): ${ties.size}\n`);

  for (const [key, legs] of ties.entries()) {
    // Sort by date to determine leg 1 and leg 2
    legs.sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());

    const leg1 = legs[0];
    const leg2 = legs[1];

    console.log(`  TIE: ${leg1.teams.home.name} vs ${leg1.teams.away.name}`);
    if (leg1) {
      console.log(`    Leg 1: #${leg1.fixture.id} | ${leg1.fixture.date} | ${leg1.teams.home.name} (H) vs ${leg1.teams.away.name} (A) [${leg1.fixture.status.short}]`);
    }
    if (leg2) {
      console.log(`    Leg 2: #${leg2.fixture.id} | ${leg2.fixture.date} | ${leg2.teams.home.name} (H) vs ${leg2.teams.away.name} (A) [${leg2.fixture.status.short}]`);
    }
    console.log();
  }

  // Also check for future rounds that might already have fixtures
  const futureRounds = ["Round of 16", "Quarter-finals", "Semi-finals", "Final"];
  for (const roundName of futureRounds) {
    const roundFixtures = byRound.get(roundName);
    if (roundFixtures && roundFixtures.length > 0) {
      console.log(`\n📅 ${roundName}: ${roundFixtures.length} fixtures`);
      for (const f of roundFixtures) {
        console.log(`  #${f.fixture.id} | ${f.fixture.date} | ${f.teams.home.name} vs ${f.teams.away.name} [${f.fixture.status.short}]`);
      }
    }
  }

  // Save raw data for reference
  const outputPath = path.join(__dirname, "ucl_2025_fixtures.json");
  const outputData = {
    fetchedAt: new Date().toISOString(),
    totalFixtures: fixtures.length,
    roundOf32: r32.map((f: any) => ({
      fixtureId: f.fixture.id,
      date: f.fixture.date,
      status: f.fixture.status.short,
      round: f.league.round,
      homeTeam: {
        id: f.teams.home.id,
        name: f.teams.home.name,
        logo: f.teams.home.logo,
      },
      awayTeam: {
        id: f.teams.away.id,
        name: f.teams.away.name,
        logo: f.teams.away.logo,
      },
      goals: f.goals,
      score: f.score,
    })),
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`\n💾 Data saved to: ${outputPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
