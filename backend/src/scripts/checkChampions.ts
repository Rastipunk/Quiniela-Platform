/**
 * Check Champions League availability in API-Football
 */
import "dotenv/config";
import { ApiFootballClient } from "../services/apiFootball/client";

async function main() {
  const client = new ApiFootballClient();

  // Champions League = league ID 2 in API-Football
  console.log("🏆 Checking Champions League availability...\n");

  // Check 2025-26 season
  const leagues = await client.getLeagues({ id: 2, season: 2025 });

  if (leagues.length > 0) {
    const league = leagues[0] as any;
    console.log(`League: ${league.league.name}`);
    console.log(`Country: ${league.country.name}`);
    console.log(`Season: 2025`);
    console.log(`Current: ${league.seasons?.[0]?.current}`);
    console.log(`Coverage:`, JSON.stringify(league.seasons?.[0]?.coverage, null, 2));
  } else {
    console.log("No Champions League 2025 season found. Trying 2024...");
    const leagues2024 = await client.getLeagues({ id: 2, season: 2024 });
    if (leagues2024.length > 0) {
      const league = leagues2024[0] as any;
      console.log(`League: ${league.league.name}`);
      console.log(`Season: 2024`);
    }
  }

  // Check available fixtures
  console.log("\n📅 Checking available fixtures...");
  const fixtures = await client.getFixtures({ league: 2, season: 2025 });
  console.log(`Total fixtures found: ${fixtures.length}`);

  if (fixtures.length > 0) {
    // Group by round
    const rounds = new Map<string, number>();
    const statuses = new Map<string, number>();

    for (const f of fixtures) {
      const round = f.league.round;
      rounds.set(round, (rounds.get(round) || 0) + 1);
      const status = f.fixture.status.short;
      statuses.set(status, (statuses.get(status) || 0) + 1);
    }

    console.log("\nRondas disponibles:");
    for (const [round, count] of rounds.entries()) {
      console.log(`  ${round}: ${count} fixtures`);
    }

    console.log("\nEstados:");
    for (const [status, count] of statuses.entries()) {
      console.log(`  ${status}: ${count}`);
    }

    // Show upcoming/not started fixtures
    const upcoming = fixtures
      .filter((f) => f.fixture.status.short === "NS" || f.fixture.status.short === "TBD")
      .slice(0, 10);

    if (upcoming.length > 0) {
      console.log("\nPróximos partidos (primeros 10):");
      for (const f of upcoming) {
        console.log(
          `  ${f.fixture.date?.substring(0, 10)} | ${f.teams.home.name} vs ${f.teams.away.name} (${f.league.round}) [${f.fixture.status.short}]`
        );
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
