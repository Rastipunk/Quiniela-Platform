/**
 * Step 2: Crear sync states (fix checkCount) + buscar 3rd place match
 */

import { prisma } from "../db";
import { ApiFootballClient } from "../services/apiFootball/client";

const KNOCKOUT_MATCH_IDS = [
  "ko_r16_1", "ko_r16_2", "ko_r16_3", "ko_r16_4",
  "ko_r16_5", "ko_r16_6", "ko_r16_7", "ko_r16_8",
  "ko_qf_1", "ko_qf_2", "ko_qf_3", "ko_qf_4",
  "ko_sf_1", "ko_sf_2",
  "ko_3rd",
  "ko_final",
];

async function main() {
  // ============================================================
  // PARTE A: Buscar el 3rd place match con nombre alternativo
  // ============================================================
  console.log("📡 Buscando 3rd place match...\n");

  const client = new ApiFootballClient();

  // Probar diferentes nombres de ronda
  const roundNames = ["3rd Place", "Third-place", "Third Place", "3rd place"];
  let thirdPlaceFixtureId: number | null = null;

  for (const roundName of roundNames) {
    console.log(`   Probando ronda: "${roundName}"...`);
    try {
      const fixtures = await client.getFixtures({
        league: 1,
        season: 2022,
        round: roundName,
      });
      if (fixtures.length > 0) {
        const f = fixtures[0];
        thirdPlaceFixtureId = f.fixture.id;
        console.log(
          `   ✅ Encontrado: ${f.teams.home.name} vs ${f.teams.away.name} = ${f.goals.home}-${f.goals.away} → fixture #${thirdPlaceFixtureId}`
        );
        break;
      } else {
        console.log(`   → 0 resultados`);
      }
    } catch (e: any) {
      console.log(`   → Error: ${e.message}`);
    }
  }

  if (thirdPlaceFixtureId) {
    // Actualizar mapping
    const existing = await prisma.matchExternalMapping.findUnique({
      where: {
        tournamentInstanceId_internalMatchId: {
          tournamentInstanceId: "wc2022-autotest-instance",
          internalMatchId: "ko_3rd",
        },
      },
    });

    if (existing) {
      // Check for conflicting fixture ID
      const conflicting = await prisma.matchExternalMapping.findUnique({
        where: {
          tournamentInstanceId_apiFootballFixtureId: {
            tournamentInstanceId: "wc2022-autotest-instance",
            apiFootballFixtureId: thirdPlaceFixtureId,
          },
        },
      });
      if (conflicting && conflicting.id !== existing.id) {
        await prisma.matchExternalMapping.delete({ where: { id: conflicting.id } });
      }
      await prisma.matchExternalMapping.update({
        where: { id: existing.id },
        data: { apiFootballFixtureId: thirdPlaceFixtureId },
      });
      console.log(`   Mapping actualizado: ko_3rd → ${thirdPlaceFixtureId}`);
    }
  } else {
    console.log("   ⚠️ No se encontró el 3rd place match. Se omitirá.");
  }

  // ============================================================
  // PARTE B: Crear sync states para knockout matches
  // ============================================================
  console.log("\n🔄 Creando sync states...\n");

  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: "wc2022-autotest-instance" },
  });

  if (!instance) throw new Error("Instance not found");

  const dataJson = instance.dataJson as {
    matches: Array<{ id: string; kickoffUtc: string }>;
  };

  // Obtener los match IDs que tienen mapping válido
  const mappings = await prisma.matchExternalMapping.findMany({
    where: {
      tournamentInstanceId: "wc2022-autotest-instance",
      internalMatchId: { in: KNOCKOUT_MATCH_IDS },
    },
  });
  const mappedIds = new Set(mappings.map((m) => m.internalMatchId));

  let statesCreated = 0;
  for (const match of dataJson.matches) {
    if (KNOCKOUT_MATCH_IDS.includes(match.id) && mappedIds.has(match.id)) {
      // Verificar que no exista ya
      const existingState = await prisma.matchSyncState.findUnique({
        where: {
          tournamentInstanceId_internalMatchId: {
            tournamentInstanceId: "wc2022-autotest-instance",
            internalMatchId: match.id,
          },
        },
      });

      if (existingState) {
        console.log(`   ⏭️  ${match.id}: ya existe (${existingState.syncStatus})`);
        continue;
      }

      const kickoff = new Date(match.kickoffUtc);
      const firstCheck = new Date(kickoff.getTime() + 5 * 60 * 1000);
      const finishCheck = new Date(kickoff.getTime() + 110 * 60 * 1000);

      await prisma.matchSyncState.create({
        data: {
          tournamentInstanceId: "wc2022-autotest-instance",
          internalMatchId: match.id,
          syncStatus: "PENDING",
          kickoffUtc: kickoff,
          firstCheckAtUtc: firstCheck,
          finishCheckAtUtc: finishCheck,
        },
      });
      statesCreated++;
      console.log(`   ✅ ${match.id}: first check ${firstCheck.toLocaleTimeString()}`);
    }
  }

  console.log(`\n   Total sync states creados: ${statesCreated}`);

  // Verificar estado final
  const status = await prisma.matchSyncState.groupBy({
    by: ["syncStatus"],
    where: { tournamentInstanceId: "wc2022-autotest-instance" },
    _count: true,
  });
  console.log("\n📊 Estado total sync states:");
  status.forEach((s) => console.log(`   ${s.syncStatus}: ${s._count}`));

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
