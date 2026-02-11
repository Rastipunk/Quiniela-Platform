/**
 * Find the 3rd place WC2022 match by date
 * Dec 17, 2022: Croatia vs Morocco
 */
import { ApiFootballClient } from "../services/apiFootball/client";
import { prisma } from "../db";

async function main() {
  const client = new ApiFootballClient();

  // 3rd place was Dec 17, 2022
  console.log("Buscando partidos WC2022 del 17 dic 2022...");
  const fixtures = await client.getFixtures({
    league: 1,
    season: 2022,
    date: "2022-12-17",
  });

  console.log(`Encontrados: ${fixtures.length}`);
  for (const f of fixtures) {
    const pen = f.score?.penalty?.home !== null ? ` (PEN: ${f.score.penalty.home}-${f.score.penalty.away})` : "";
    console.log(
      `  #${f.fixture.id}: ${f.teams.home.name} vs ${f.teams.away.name} = ${f.goals.home}-${f.goals.away}${pen} [${f.fixture.status.short}] round="${f.league.round}"`
    );
  }

  // If we find Croatia vs Morocco, update the mapping
  const thirdPlace = fixtures.find(
    (f) => f.teams.home.name === "Croatia" && f.teams.away.name === "Morocco"
  );

  if (thirdPlace) {
    console.log(`\n✅ 3rd place found: fixture #${thirdPlace.fixture.id}`);

    // Update mapping
    const existing = await prisma.matchExternalMapping.findUnique({
      where: {
        tournamentInstanceId_internalMatchId: {
          tournamentInstanceId: "wc2022-autotest-instance",
          internalMatchId: "ko_3rd",
        },
      },
    });

    if (existing) {
      const conflicting = await prisma.matchExternalMapping.findUnique({
        where: {
          tournamentInstanceId_apiFootballFixtureId: {
            tournamentInstanceId: "wc2022-autotest-instance",
            apiFootballFixtureId: thirdPlace.fixture.id,
          },
        },
      });
      if (conflicting && conflicting.id !== existing.id) {
        await prisma.matchExternalMapping.delete({ where: { id: conflicting.id } });
      }
      await prisma.matchExternalMapping.update({
        where: { id: existing.id },
        data: { apiFootballFixtureId: thirdPlace.fixture.id },
      });
      console.log(`Mapping actualizado: ko_3rd → ${thirdPlace.fixture.id}`);
    }
  } else {
    console.log("\n❌ 3rd place no encontrado, eliminando mapping falso...");
    // Delete the fake mapping and sync state
    await prisma.matchSyncState.deleteMany({
      where: {
        tournamentInstanceId: "wc2022-autotest-instance",
        internalMatchId: "ko_3rd",
      },
    });
    await prisma.matchExternalMapping.deleteMany({
      where: {
        tournamentInstanceId: "wc2022-autotest-instance",
        internalMatchId: "ko_3rd",
      },
    });
    console.log("Mapping y sync state de ko_3rd eliminados.");
  }

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
