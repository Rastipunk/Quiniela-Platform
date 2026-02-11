/**
 * Script para:
 * 1. Consultar los fixture IDs reales del WC2022 knockout en API-Football
 * 2. Borrar resultados de knockout
 * 3. Actualizar mappings con IDs reales
 * 4. Ajustar kickoff times al futuro cercano
 * 5. Resetear sync states para que Smart Sync los re-consulte
 */

import { prisma } from "../db";
import { ApiFootballClient } from "../services/apiFootball/client";

// Knockout match IDs internos (del addKnockoutPhases.ts)
const KNOCKOUT_MATCH_IDS = [
  "ko_r16_1", "ko_r16_2", "ko_r16_3", "ko_r16_4",
  "ko_r16_5", "ko_r16_6", "ko_r16_7", "ko_r16_8",
  "ko_qf_1", "ko_qf_2", "ko_qf_3", "ko_qf_4",
  "ko_sf_1", "ko_sf_2",
  "ko_3rd",
  "ko_final",
];

// Partidos reales del WC2022 knockout que queremos mapear
// Formato: { internalId, round (para buscar en API), homeTeam, awayTeam, description }
const KNOCKOUT_REAL_MATCHES = [
  // Round of 16
  { id: "ko_r16_1", round: "Round of 16", home: "Netherlands", away: "USA" },
  { id: "ko_r16_2", round: "Round of 16", home: "Argentina", away: "Australia" },
  { id: "ko_r16_3", round: "Round of 16", home: "France", away: "Poland" },
  { id: "ko_r16_4", round: "Round of 16", home: "England", away: "Senegal" },
  { id: "ko_r16_5", round: "Round of 16", home: "Japan", away: "Croatia" },
  { id: "ko_r16_6", round: "Round of 16", home: "Brazil", away: "South Korea" },
  { id: "ko_r16_7", round: "Round of 16", home: "Morocco", away: "Spain" },
  { id: "ko_r16_8", round: "Round of 16", home: "Portugal", away: "Switzerland" },
  // Quarter Finals
  { id: "ko_qf_1", round: "Quarter-finals", home: "Croatia", away: "Brazil" },
  { id: "ko_qf_2", round: "Quarter-finals", home: "Netherlands", away: "Argentina" },
  { id: "ko_qf_3", round: "Quarter-finals", home: "Morocco", away: "Portugal" },
  { id: "ko_qf_4", round: "Quarter-finals", home: "England", away: "France" },
  // Semi Finals
  { id: "ko_sf_1", round: "Semi-finals", home: "Argentina", away: "Croatia" },
  { id: "ko_sf_2", round: "Semi-finals", home: "France", away: "Morocco" },
  // Third Place
  { id: "ko_3rd", round: "3rd Place", home: "Croatia", away: "Morocco" },
  // Final
  { id: "ko_final", round: "Final", home: "Argentina", away: "France" },
];

// Agrupar por ronda para minimizar API calls
const ROUNDS_TO_QUERY = [
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "3rd Place",
  "Final",
];

async function main() {
  console.log("🔧 Fix Knockout Fixture IDs - WC2022 Auto-Test\n");

  // ============================================================
  // PASO 1: Consultar fixture IDs reales de API-Football
  // ============================================================
  console.log("📡 Paso 1: Consultando fixture IDs reales del WC2022 knockout...\n");

  const client = new ApiFootballClient();
  const fixtureMap = new Map<string, number>(); // internalId -> real fixtureId

  for (const round of ROUNDS_TO_QUERY) {
    console.log(`   Consultando ronda: ${round}...`);
    const fixtures = await client.getFixtures({
      league: 1,    // World Cup
      season: 2022,
      round: round,
    });

    console.log(`   → ${fixtures.length} partidos encontrados`);

    // Mapear cada fixture al internal ID basándose en equipos
    for (const fixture of fixtures) {
      const homeTeam = fixture.teams.home.name;
      const awayTeam = fixture.teams.away.name;
      const fixtureId = fixture.fixture.id;
      const status = fixture.fixture.status.short;
      const homeGoals = fixture.goals.home;
      const awayGoals = fixture.goals.away;
      const penHome = fixture.score?.penalty?.home;
      const penAway = fixture.score?.penalty?.away;

      // Buscar el internal match que corresponde
      const match = KNOCKOUT_REAL_MATCHES.find(
        (m) => m.round === round && m.home === homeTeam && m.away === awayTeam
      );

      if (match) {
        fixtureMap.set(match.id, fixtureId);
        const penStr = penHome !== null && penHome !== undefined ? ` (PEN: ${penHome}-${penAway})` : "";
        console.log(
          `     ✅ ${match.id}: ${homeTeam} vs ${awayTeam} = ${homeGoals}-${awayGoals}${penStr} [${status}] → fixture #${fixtureId}`
        );
      } else {
        console.log(
          `     ⚠️  No match found for: ${homeTeam} vs ${awayTeam} (fixture #${fixtureId})`
        );
      }
    }
  }

  console.log(`\n   Total mapeados: ${fixtureMap.size}/16`);

  if (fixtureMap.size < 16) {
    // Intentar con nombres alternativos
    console.log("\n   ⚠️  Algunos partidos no se mapearon. Mostrando fixtures sin mapear:");
    for (const m of KNOCKOUT_REAL_MATCHES) {
      if (!fixtureMap.has(m.id)) {
        console.log(`     ❌ ${m.id}: ${m.home} vs ${m.away} (${m.round})`);
      }
    }
    console.log("\n   Continuando con los que sí se encontraron...\n");
  }

  // ============================================================
  // PASO 2: Borrar resultados y versiones de knockout
  // ============================================================
  console.log("🗑️  Paso 2: Borrando resultados de knockout...\n");

  // Primero obtener los result IDs
  const knockoutResults = await prisma.poolMatchResult.findMany({
    where: {
      poolId: "wc2022-autotest-pool",
      matchId: { in: KNOCKOUT_MATCH_IDS },
    },
    select: { id: true, matchId: true },
  });

  console.log(`   Resultados de knockout encontrados: ${knockoutResults.length}`);

  if (knockoutResults.length > 0) {
    const resultIds = knockoutResults.map((r) => r.id);

    // Desvincular currentVersion de PoolMatchResult (para evitar FK constraint)
    await prisma.poolMatchResult.updateMany({
      where: { id: { in: resultIds } },
      data: { currentVersionId: null },
    });

    // Borrar versiones
    const deletedVersions = await prisma.poolMatchResultVersion.deleteMany({
      where: { resultId: { in: resultIds } },
    });
    console.log(`   Versiones borradas: ${deletedVersions.count}`);

    // Borrar resultados
    const deletedResults = await prisma.poolMatchResult.deleteMany({
      where: { id: { in: resultIds } },
    });
    console.log(`   Resultados borrados: ${deletedResults.count}`);
  }

  // ============================================================
  // PASO 3: Actualizar mappings con fixture IDs reales
  // ============================================================
  console.log("\n🔄 Paso 3: Actualizando mappings con fixture IDs reales...\n");

  let mappingsUpdated = 0;
  for (const [internalId, realFixtureId] of fixtureMap.entries()) {
    // Primero intentar borrar mapping existente por internalMatchId
    const existing = await prisma.matchExternalMapping.findUnique({
      where: {
        tournamentInstanceId_internalMatchId: {
          tournamentInstanceId: "wc2022-autotest-instance",
          internalMatchId: internalId,
        },
      },
    });

    if (existing) {
      // También verificar si ya hay otro mapping con este fixtureId (para evitar unique constraint)
      const conflicting = await prisma.matchExternalMapping.findUnique({
        where: {
          tournamentInstanceId_apiFootballFixtureId: {
            tournamentInstanceId: "wc2022-autotest-instance",
            apiFootballFixtureId: realFixtureId,
          },
        },
      });

      if (conflicting && conflicting.id !== existing.id) {
        // Borrar el conflictivo primero
        await prisma.matchExternalMapping.delete({ where: { id: conflicting.id } });
      }

      await prisma.matchExternalMapping.update({
        where: { id: existing.id },
        data: { apiFootballFixtureId: realFixtureId },
      });
      mappingsUpdated++;
      console.log(`   ✅ ${internalId}: ${existing.apiFootballFixtureId} → ${realFixtureId}`);
    } else {
      // Crear nuevo
      await prisma.matchExternalMapping.create({
        data: {
          tournamentInstanceId: "wc2022-autotest-instance",
          internalMatchId: internalId,
          apiFootballFixtureId: realFixtureId,
        },
      });
      mappingsUpdated++;
      console.log(`   ✅ ${internalId}: NEW → ${realFixtureId}`);
    }
  }
  console.log(`   Total actualizados: ${mappingsUpdated}`);

  // ============================================================
  // PASO 4: Ajustar kickoff times al futuro cercano
  // ============================================================
  console.log("\n⏰ Paso 4: Ajustando kickoff times...\n");

  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: "wc2022-autotest-instance" },
  });

  if (!instance) throw new Error("Instance not found");

  const dataJson = instance.dataJson as {
    phases: Array<{ id: string; name: string; type?: string }>;
    matches: Array<{
      id: string;
      phaseId: string;
      homeTeamId: string;
      awayTeamId: string;
      kickoffUtc: string;
      label?: string;
    }>;
  };

  // Nuevo base time: ahora + 2 minutos
  const now = new Date();
  const baseTime = new Date(now.getTime() + 2 * 60 * 1000);
  console.log(`   Base time: ${baseTime.toLocaleTimeString()} (ahora + 2 min)`);

  const phaseOffsets: Record<string, number> = {
    round_of_16: 0,      // base + 0 min
    quarter_finals: 5,    // base + 5 min
    semi_finals: 10,      // base + 10 min
    third_place: 15,      // base + 15 min
    final: 15,            // base + 15 min (junto con 3rd place)
  };

  let matchesUpdated = 0;
  for (const match of dataJson.matches) {
    if (KNOCKOUT_MATCH_IDS.includes(match.id)) {
      const offset = phaseOffsets[match.phaseId] ?? 0;
      // Dentro de cada fase, agregar 1 min por partido
      const matchIndex = dataJson.matches
        .filter((m) => m.phaseId === match.phaseId && KNOCKOUT_MATCH_IDS.includes(m.id))
        .findIndex((m) => m.id === match.id);

      const kickoff = new Date(baseTime.getTime() + (offset + matchIndex) * 60 * 1000);
      match.kickoffUtc = kickoff.toISOString();
      matchesUpdated++;
      console.log(`   ${match.id}: ${kickoff.toLocaleTimeString()}`);
    }
  }

  await prisma.tournamentInstance.update({
    where: { id: "wc2022-autotest-instance" },
    data: { dataJson: dataJson as any },
  });
  console.log(`   Matches actualizados: ${matchesUpdated}`);

  // ============================================================
  // PASO 5: Resetear sync states para knockout
  // ============================================================
  console.log("\n🔄 Paso 5: Reseteando sync states de knockout...\n");

  // Borrar sync states existentes de knockout
  const deletedStates = await prisma.matchSyncState.deleteMany({
    where: {
      tournamentInstanceId: "wc2022-autotest-instance",
      internalMatchId: { in: KNOCKOUT_MATCH_IDS },
    },
  });
  console.log(`   Sync states borrados: ${deletedStates.count}`);

  // Crear nuevos sync states con los kickoff times actualizados
  let statesCreated = 0;
  for (const match of dataJson.matches) {
    if (KNOCKOUT_MATCH_IDS.includes(match.id) && fixtureMap.has(match.id)) {
      const kickoff = new Date(match.kickoffUtc);
      const firstCheck = new Date(kickoff.getTime() + 5 * 60 * 1000); // kickoff + 5 min
      const finishCheck = new Date(kickoff.getTime() + 110 * 60 * 1000); // kickoff + 110 min

      await prisma.matchSyncState.create({
        data: {
          tournamentInstanceId: "wc2022-autotest-instance",
          internalMatchId: match.id,
          syncStatus: "PENDING",
          kickoffUtc: kickoff,
          firstCheckAtUtc: firstCheck,
          finishCheckAtUtc: finishCheck,
          checkCount: 0,
        },
      });
      statesCreated++;
    }
  }
  console.log(`   Sync states creados: ${statesCreated}`);

  // ============================================================
  // RESUMEN
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMEN");
  console.log("=".repeat(60));
  console.log(`   Fixture IDs mapeados: ${fixtureMap.size}/16`);
  console.log(`   Resultados borrados: ${knockoutResults.length}`);
  console.log(`   Mappings actualizados: ${mappingsUpdated}`);
  console.log(`   Kickoffs ajustados: ${matchesUpdated}`);
  console.log(`   Sync states creados: ${statesCreated}`);
  console.log(`\n   ⏰ Smart Sync empezará a consultar en ~7 minutos`);
  console.log(`   (kickoff + 5 min de delay para primer check)`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
