/**
 * Step 2: Recrear TODOS los mappings desde cero con fixture IDs reales
 * (Los fixture IDs ya fueron obtenidos en el paso anterior)
 * También ajustar kickoffs y resetear sync states.
 */

import { prisma } from "../db";

// Real fixture IDs obtained from API-Football
const REAL_FIXTURE_MAP: Record<string, number> = {
  // Group A
  "m_A_1_1": 855736,  // Qatar vs Ecuador = 0-2
  "m_A_1_2": 855734,  // Senegal vs Netherlands = 0-2
  "m_A_2_1": 855747,  // Qatar vs Senegal = 1-3
  "m_A_2_2": 855748,  // Ecuador vs Netherlands = 1-1
  "m_A_3_1": 855760,  // Qatar vs Netherlands = 2-0 (swapped)
  "m_A_3_2": 855761,  // Ecuador vs Senegal = 1-2
  // Group B
  "m_B_1_1": 855735,  // England vs Iran = 6-2
  "m_B_1_2": 866681,  // USA vs Wales = 1-1
  "m_B_2_1": 855749,  // England vs USA = 0-0
  "m_B_2_2": 866682,  // Iran vs Wales = 2-0 (swapped)
  "m_B_3_1": 866683,  // England vs Wales = 3-0 (swapped)
  "m_B_3_2": 855762,  // Iran vs USA = 0-1
  // Group C
  "m_C_1_1": 855737,  // Argentina vs Saudi Arabia = 1-2
  "m_C_1_2": 855739,  // Mexico vs Poland = 0-0
  "m_C_2_1": 855752,  // Argentina vs Mexico = 2-0
  "m_C_2_2": 855750,  // Saudi Arabia vs Poland = 0-2 (swapped)
  "m_C_3_1": 855764,  // Argentina vs Poland = 2-0 (swapped)
  "m_C_3_2": 855765,  // Saudi Arabia vs Mexico = 1-2
  // Group D
  "m_D_1_1": 871850,  // France vs Australia = 4-1
  "m_D_1_2": 855738,  // Denmark vs Tunisia = 0-0
  "m_D_2_1": 855751,  // France vs Denmark = 2-1
  "m_D_2_2": 871852,  // Australia vs Tunisia = 1-0 (swapped)
  "m_D_3_1": 855763,  // France vs Tunisia = 0-1 (swapped)
  "m_D_3_2": 871854,  // Australia vs Denmark = 1-0
  // Group E
  "m_E_1_1": 871851,  // Spain vs Costa Rica = 7-0
  "m_E_1_2": 855741,  // Germany vs Japan = 1-2
  "m_E_2_1": 855755,  // Spain vs Germany = 1-1
  "m_E_2_2": 871853,  // Costa Rica vs Japan = 1-0 (swapped)
  "m_E_3_1": 855768,  // Spain vs Japan = 1-2 (swapped)
  "m_E_3_2": 871855,  // Costa Rica vs Germany = 2-4
  // Group F
  "m_F_1_1": 855742,  // Belgium vs Canada = 1-0
  "m_F_1_2": 855740,  // Morocco vs Croatia = 0-0
  "m_F_2_1": 855753,  // Belgium vs Morocco = 0-2
  "m_F_2_2": 855754,  // Canada vs Croatia = 1-4 (swapped)
  "m_F_3_1": 855766,  // Belgium vs Croatia = 0-0 (swapped)
  "m_F_3_2": 855767,  // Canada vs Morocco = 1-2
  // Group G
  "m_G_1_1": 855746,  // Brazil vs Serbia = 2-0
  "m_G_1_2": 855743,  // Switzerland vs Cameroon = 1-0
  "m_G_2_1": 855758,  // Brazil vs Switzerland = 1-0
  "m_G_2_2": 855756,  // Serbia vs Cameroon = 3-3 (swapped)
  "m_G_3_1": 855771,  // Brazil vs Cameroon = 0-1 (swapped)
  "m_G_3_2": 855772,  // Serbia vs Switzerland = 2-3
  // Group H
  "m_H_1_1": 855745,  // Portugal vs Ghana = 3-2
  "m_H_1_2": 855744,  // Uruguay vs South Korea = 0-0
  "m_H_2_1": 855759,  // Portugal vs Uruguay = 2-0
  "m_H_2_2": 855757,  // Ghana vs South Korea = 3-2 (swapped)
  "m_H_3_1": 855769,  // Portugal vs South Korea = 1-2 (swapped)
  "m_H_3_2": 855770,  // Ghana vs Uruguay = 0-2
  // Knockout (already mapped correctly from previous script)
  "ko_r16_1": 976533,  // Netherlands vs USA = 3-1
  "ko_r16_2": 976642,  // Argentina vs Australia = 2-1
  "ko_r16_3": 976643,  // France vs Poland = 3-1
  "ko_r16_4": 976534,  // England vs Senegal = 3-0
  "ko_r16_5": 977344,  // Japan vs Croatia = 1-1 (PEN 1-3)
  "ko_r16_6": 977705,  // Brazil vs South Korea = 4-1
  "ko_r16_7": 977345,  // Morocco vs Spain = 0-0 (PEN 3-0)
  "ko_r16_8": 977706,  // Portugal vs Switzerland = 6-1
  "ko_qf_1": 978072,   // Croatia vs Brazil = 1-1 (PEN 4-2)
  "ko_qf_2": 977794,   // Netherlands vs Argentina = 2-2 (PEN 3-4)
  "ko_qf_3": 978088,   // Morocco vs Portugal = 1-0
  "ko_qf_4": 978036,   // England vs France = 1-2
  "ko_sf_1": 978279,   // Argentina vs Croatia = 3-0
  "ko_sf_2": 978488,   // France vs Morocco = 2-0
  "ko_final": 979139,  // Argentina vs France = 3-3 (PEN 4-2)
};

async function main() {
  console.log("🔧 Recreando TODOS los mappings con fixture IDs reales\n");

  // ============================================================
  // PASO 1: Borrar TODOS los mappings existentes
  // ============================================================
  console.log("🗑️  Borrando todos los mappings existentes...");
  const deleted = await prisma.matchExternalMapping.deleteMany({
    where: { tournamentInstanceId: "wc2022-autotest-instance" },
  });
  console.log(`   Borrados: ${deleted.count}\n`);

  // ============================================================
  // PASO 2: Crear nuevos mappings
  // ============================================================
  console.log("✅ Creando nuevos mappings...");
  let created = 0;
  for (const [internalId, fixtureId] of Object.entries(REAL_FIXTURE_MAP)) {
    await prisma.matchExternalMapping.create({
      data: {
        tournamentInstanceId: "wc2022-autotest-instance",
        internalMatchId: internalId,
        apiFootballFixtureId: fixtureId,
      },
    });
    created++;
  }
  console.log(`   Creados: ${created}\n`);

  // ============================================================
  // PASO 3: Borrar TODOS los resultados
  // ============================================================
  console.log("🗑️  Borrando todos los resultados existentes...");
  const allResults = await prisma.poolMatchResult.findMany({
    where: { poolId: "wc2022-autotest-pool" },
    select: { id: true },
  });

  if (allResults.length > 0) {
    const resultIds = allResults.map((r) => r.id);

    await prisma.poolMatchResult.updateMany({
      where: { id: { in: resultIds } },
      data: { currentVersionId: null },
    });

    const dv = await prisma.poolMatchResultVersion.deleteMany({
      where: { resultId: { in: resultIds } },
    });
    const dr = await prisma.poolMatchResult.deleteMany({
      where: { id: { in: resultIds } },
    });
    console.log(`   Versiones borradas: ${dv.count}`);
    console.log(`   Resultados borrados: ${dr.count}\n`);
  } else {
    console.log("   No hay resultados existentes.\n");
  }

  // ============================================================
  // PASO 4: Ajustar kickoff times
  // ============================================================
  console.log("⏰ Ajustando kickoff times...");

  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: "wc2022-autotest-instance" },
  });
  if (!instance) throw new Error("Instance not found");

  const dataJson = instance.dataJson as {
    matches: Array<{ id: string; phaseId: string; kickoffUtc: string }>;
    phases: any[];
  };

  const now = new Date();
  const baseTime = new Date(now.getTime() + 2 * 60 * 1000);
  console.log(`   Base time: ${baseTime.toLocaleTimeString()} (ahora + 2 min)`);

  // Group matches: 3 rounds, 5 min apart
  let matchesUpdated = 0;
  for (const match of dataJson.matches) {
    const parts = match.id.split("_");

    if (match.id.startsWith("m_") && parts.length === 4) {
      // Group match: m_{group}_{round}_{matchInRound}
      const round = parseInt(parts[2]);
      const matchInRound = parseInt(parts[3]);
      const offset = (round - 1) * 5 + (matchInRound - 1);
      match.kickoffUtc = new Date(baseTime.getTime() + offset * 60 * 1000).toISOString();
      matchesUpdated++;
    }
  }

  // Knockout matches
  const knockoutBase = new Date(baseTime.getTime() + 15 * 60 * 1000);
  const phaseOffsets: Record<string, number> = {
    round_of_16: 0,
    quarter_finals: 5,
    semi_finals: 10,
    third_place: 15,
    final: 15,
  };

  for (const match of dataJson.matches) {
    if (match.id.startsWith("ko_")) {
      const offset = phaseOffsets[match.phaseId] ?? 0;
      const matchesInPhase = dataJson.matches.filter(
        (m) => m.phaseId === match.phaseId && m.id.startsWith("ko_")
      );
      const idx = matchesInPhase.findIndex((m) => m.id === match.id);
      match.kickoffUtc = new Date(knockoutBase.getTime() + (offset + idx) * 60 * 1000).toISOString();
      matchesUpdated++;
    }
  }

  await prisma.tournamentInstance.update({
    where: { id: "wc2022-autotest-instance" },
    data: { dataJson: dataJson as any },
  });
  console.log(`   Matches actualizados: ${matchesUpdated}\n`);

  // ============================================================
  // PASO 5: Resetear TODOS los sync states
  // ============================================================
  console.log("🔄 Reseteando sync states...");

  await prisma.matchSyncState.deleteMany({
    where: { tournamentInstanceId: "wc2022-autotest-instance" },
  });

  let statesCreated = 0;
  for (const match of dataJson.matches) {
    if (REAL_FIXTURE_MAP[match.id]) {
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
    }
  }
  console.log(`   States creados: ${statesCreated}\n`);

  // ============================================================
  // RESUMEN
  // ============================================================
  console.log("=".repeat(60));
  console.log("📊 RESUMEN FINAL");
  console.log("=".repeat(60));
  console.log(`   Mappings: ${created} (${Object.keys(REAL_FIXTURE_MAP).length} partidos)`);
  console.log(`   Kickoffs ajustados: ${matchesUpdated}`);
  console.log(`   Sync states: ${statesCreated} PENDING`);

  // Print schedule
  console.log("\n   📅 HORARIO:");
  console.log(`   Grupos Jornada 1: ${baseTime.toLocaleTimeString()}`);
  console.log(`   Grupos Jornada 2: ${new Date(baseTime.getTime() + 5 * 60 * 1000).toLocaleTimeString()}`);
  console.log(`   Grupos Jornada 3: ${new Date(baseTime.getTime() + 10 * 60 * 1000).toLocaleTimeString()}`);
  console.log(`   R16:              ${knockoutBase.toLocaleTimeString()}`);
  console.log(`   Quarter Finals:   ${new Date(knockoutBase.getTime() + 5 * 60 * 1000).toLocaleTimeString()}`);
  console.log(`   Semi Finals:      ${new Date(knockoutBase.getTime() + 10 * 60 * 1000).toLocaleTimeString()}`);
  console.log(`   Final:            ${new Date(knockoutBase.getTime() + 15 * 60 * 1000).toLocaleTimeString()}`);

  console.log(`\n   ⏰ Primer check: ~${new Date(baseTime.getTime() + 5 * 60 * 1000).toLocaleTimeString()} (base + 5 min)`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
