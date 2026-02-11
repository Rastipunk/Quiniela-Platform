/**
 * Script para obtener los fixture IDs reales de TODOS los partidos del WC2022
 * (fase de grupos) desde API-Football y actualizar los mappings.
 *
 * Consulta por grupo (8 queries) para obtener los 48 partidos de grupos.
 * Luego borra resultados, actualiza mappings, ajusta kickoffs y resetea sync states.
 */

import { prisma } from "../db";
import { ApiFootballClient } from "../services/apiFootball/client";

// Datos de grupos - replicados del seed script
const WC2022_GROUPS: Record<string, { teams: string[]; teamCodes: string[] }> = {
  A: { teams: ["Qatar", "Ecuador", "Senegal", "Netherlands"], teamCodes: ["QAT", "ECU", "SEN", "NED"] },
  B: { teams: ["England", "Iran", "USA", "Wales"], teamCodes: ["ENG", "IRN", "USA", "WAL"] },
  C: { teams: ["Argentina", "Saudi Arabia", "Mexico", "Poland"], teamCodes: ["ARG", "KSA", "MEX", "POL"] },
  D: { teams: ["France", "Australia", "Denmark", "Tunisia"], teamCodes: ["FRA", "AUS", "DEN", "TUN"] },
  E: { teams: ["Spain", "Costa Rica", "Germany", "Japan"], teamCodes: ["ESP", "CRC", "GER", "JPN"] },
  F: { teams: ["Belgium", "Canada", "Morocco", "Croatia"], teamCodes: ["BEL", "CAN", "MAR", "CRO"] },
  G: { teams: ["Brazil", "Serbia", "Switzerland", "Cameroon"], teamCodes: ["BRA", "SRB", "SUI", "CMR"] },
  H: { teams: ["Portugal", "Ghana", "Uruguay", "South Korea"], teamCodes: ["POR", "GHA", "URU", "KOR"] },
};

// Pairings del seed script (índices de equipos en el grupo)
const MATCH_PAIRINGS = [
  { home: 0, away: 1, round: 1 }, // Jornada 1
  { home: 2, away: 3, round: 1 },
  { home: 0, away: 2, round: 2 }, // Jornada 2
  { home: 1, away: 3, round: 2 },
  { home: 0, away: 3, round: 3 }, // Jornada 3
  { home: 1, away: 2, round: 3 },
];

// Internal match ID format: m_{group}_{round}_{matchInRound}
function getInternalMatchId(group: string, pairingIndex: number): string {
  const pairing = MATCH_PAIRINGS[pairingIndex];
  const roundMatches = MATCH_PAIRINGS.filter((p, i) => p.round === pairing.round && i <= pairingIndex);
  const matchInRound = roundMatches.length;
  return `m_${group}_${pairing.round}_${matchInRound}`;
}

// Map team names from API-Football to our team codes
// API-Football may use different names than what we have
const TEAM_NAME_MAP: Record<string, string> = {
  // Standard mappings (API name -> our code)
  "Qatar": "QAT",
  "Ecuador": "ECU",
  "Senegal": "SEN",
  "Netherlands": "NED",
  "England": "ENG",
  "Iran": "IRN",
  "USA": "USA",
  "Wales": "WAL",
  "Argentina": "ARG",
  "Saudi Arabia": "KSA",
  "Mexico": "MEX",
  "Poland": "POL",
  "France": "FRA",
  "Australia": "AUS",
  "Denmark": "DEN",
  "Tunisia": "TUN",
  "Spain": "ESP",
  "Costa Rica": "CRC",
  "Germany": "GER",
  "Japan": "JPN",
  "Belgium": "BEL",
  "Canada": "CAN",
  "Morocco": "MAR",
  "Croatia": "CRO",
  "Brazil": "BRA",
  "Serbia": "SRB",
  "Switzerland": "SUI",
  "Cameroon": "CMR",
  "Portugal": "POR",
  "Ghana": "GHA",
  "Uruguay": "URU",
  "South Korea": "KOR",
  // Possible API-Football variations
  "Korea Republic": "KOR",
  "Korea": "KOR",
  "Saudi": "KSA",
};

function getTeamCode(apiName: string): string | null {
  return TEAM_NAME_MAP[apiName] || null;
}

async function main() {
  console.log("🔧 Fix ALL Fixture IDs - WC2022 Auto-Test\n");

  const client = new ApiFootballClient();

  // ============================================================
  // PASO 1: Consultar todos los partidos de grupo del WC2022
  // ============================================================
  console.log("📡 Paso 1: Consultando partidos de grupo reales...\n");

  // Determine API round names for groups
  // API-Football uses: "Group A - 1", "Group A - 2", etc.
  // Or: "Group Stage - 1", etc.
  // Let's try first with one group to see the format

  // Try querying Group A round 1
  console.log("   Detectando formato de rondas...");
  let roundFormat = "";

  // Try "Group A - 1" format
  let testFixtures = await client.getFixtures({
    league: 1,
    season: 2022,
    round: "Group A - 1",
  });

  if (testFixtures.length > 0) {
    roundFormat = "Group {G} - {R}";
    console.log(`   Formato detectado: "Group A - 1" (${testFixtures.length} fixtures)\n`);
  } else {
    // Try "Group Stage - 1"
    testFixtures = await client.getFixtures({
      league: 1,
      season: 2022,
      round: "Group Stage - 1",
    });

    if (testFixtures.length > 0) {
      roundFormat = "Group Stage - {R}";
      console.log(`   Formato detectado: "Group Stage - 1" (${testFixtures.length} fixtures)\n`);
    }
  }

  if (!roundFormat) {
    // List all available rounds
    console.log("   No se detectó formato. Probando obtener todos los fixtures del WC2022...");
    const allFixtures = await client.getFixtures({
      league: 1,
      season: 2022,
    });
    console.log(`   Total fixtures: ${allFixtures.length}`);

    // Show unique rounds
    const rounds = new Set(allFixtures.map((f) => f.league.round));
    console.log("   Rondas disponibles:");
    rounds.forEach((r) => console.log(`     - "${r}"`));

    // Try to work with all fixtures
    if (allFixtures.length > 0) {
      await processAllFixtures(allFixtures);
    }
    return;
  }

  // Query all group rounds
  const allGroupFixtures: any[] = [];

  if (roundFormat === "Group {G} - {R}") {
    // Need 24 queries (8 groups × 3 rounds) - too many
    // Better: query by round number which includes all groups
    // Actually, let's check if "Group A - 1" gives just Group A matches
    console.log(`   "Group A - 1" dio ${testFixtures.length} fixtures.`);

    if (testFixtures.length <= 2) {
      // It's per group per round - too many queries
      // Let's try just querying all at once without round filter
      console.log("   Demasiadas queries necesarias. Consultando todos los fixtures...");
      const allFixtures = await client.getFixtures({
        league: 1,
        season: 2022,
      });
      await processAllFixtures(allFixtures);
      return;
    }

    // Query 3 rounds × 8 groups
    for (const group of Object.keys(WC2022_GROUPS)) {
      for (let round = 1; round <= 3; round++) {
        const roundName = `Group ${group} - ${round}`;
        const fixtures = await client.getFixtures({
          league: 1,
          season: 2022,
          round: roundName,
        });
        allGroupFixtures.push(...fixtures);
      }
    }
  } else if (roundFormat === "Group Stage - {R}") {
    // 3 queries (one per round, each contains all groups)
    for (let round = 1; round <= 3; round++) {
      const roundName = `Group Stage - ${round}`;
      const fixtures = await client.getFixtures({
        league: 1,
        season: 2022,
        round: roundName,
      });
      console.log(`   ${roundName}: ${fixtures.length} fixtures`);
      allGroupFixtures.push(...fixtures);
    }
  }

  if (allGroupFixtures.length > 0) {
    await processAllFixtures(allGroupFixtures);
  }
}

async function processAllFixtures(fixtures: any[]) {
  console.log(`\n📊 Total fixtures recibidos: ${fixtures.length}\n`);

  // Build a mapping: for each fixture, determine which internal match ID it corresponds to
  const fixtureMap = new Map<string, { fixtureId: number; homeGoals: number; awayGoals: number; status: string }>();
  const unmapped: string[] = [];

  for (const fixture of fixtures) {
    const homeTeam = fixture.teams.home.name;
    const awayTeam = fixture.teams.away.name;
    const homeCode = getTeamCode(homeTeam);
    const awayCode = getTeamCode(awayTeam);

    if (!homeCode || !awayCode) {
      unmapped.push(`${homeTeam} vs ${awayTeam} (unknown team: ${!homeCode ? homeTeam : awayTeam})`);
      continue;
    }

    // Find which group both teams belong to
    let matchGroup: string | null = null;
    for (const [group, data] of Object.entries(WC2022_GROUPS)) {
      if (data.teamCodes.includes(homeCode) && data.teamCodes.includes(awayCode)) {
        matchGroup = group;
        break;
      }
    }

    if (!matchGroup) {
      // Might be a knockout match - skip
      continue;
    }

    // Find which pairing this is
    const groupData = WC2022_GROUPS[matchGroup];
    const homeIdx = groupData.teamCodes.indexOf(homeCode);
    const awayIdx = groupData.teamCodes.indexOf(awayCode);

    const pairingIdx = MATCH_PAIRINGS.findIndex(
      (p) => p.home === homeIdx && p.away === awayIdx
    );

    if (pairingIdx === -1) {
      // Teams might be swapped (home/away reversed)
      const reversePairingIdx = MATCH_PAIRINGS.findIndex(
        (p) => p.home === awayIdx && p.away === homeIdx
      );
      if (reversePairingIdx !== -1) {
        const internalId = getInternalMatchId(matchGroup, reversePairingIdx);
        fixtureMap.set(internalId, {
          fixtureId: fixture.fixture.id,
          homeGoals: fixture.goals.home,
          awayGoals: fixture.goals.away,
          status: fixture.fixture.status.short,
        });
        console.log(
          `   ⚠️  ${internalId}: ${homeTeam} vs ${awayTeam} = ${fixture.goals.home}-${fixture.goals.away} [${fixture.fixture.status.short}] → #${fixture.fixture.id} (HOME/AWAY SWAPPED in API)`
        );
      } else {
        unmapped.push(`${homeTeam}(${homeIdx}) vs ${awayTeam}(${awayIdx}) in Group ${matchGroup} - no pairing found`);
      }
      continue;
    }

    const internalId = getInternalMatchId(matchGroup, pairingIdx);
    fixtureMap.set(internalId, {
      fixtureId: fixture.fixture.id,
      homeGoals: fixture.goals.home,
      awayGoals: fixture.goals.away,
      status: fixture.fixture.status.short,
    });
    console.log(
      `   ✅ ${internalId}: ${homeTeam} vs ${awayTeam} = ${fixture.goals.home}-${fixture.goals.away} [${fixture.fixture.status.short}] → #${fixture.fixture.id}`
    );
  }

  console.log(`\n   Mapeados: ${fixtureMap.size}/48`);
  if (unmapped.length > 0) {
    console.log(`   Sin mapear: ${unmapped.length}`);
    unmapped.forEach((u) => console.log(`     ❌ ${u}`));
  }

  if (fixtureMap.size === 0) {
    console.log("   No se encontraron mappings. Abortando.");
    await prisma.$disconnect();
    return;
  }

  // ============================================================
  // PASO 2: Borrar resultados de grupo existentes
  // ============================================================
  console.log("\n🗑️  Paso 2: Borrando resultados de grupo...\n");

  const groupMatchIds = Array.from(fixtureMap.keys());
  const groupResults = await prisma.poolMatchResult.findMany({
    where: {
      poolId: "wc2022-autotest-pool",
      matchId: { in: groupMatchIds },
    },
    select: { id: true, matchId: true },
  });

  console.log(`   Resultados de grupo encontrados: ${groupResults.length}`);

  if (groupResults.length > 0) {
    const resultIds = groupResults.map((r) => r.id);

    await prisma.poolMatchResult.updateMany({
      where: { id: { in: resultIds } },
      data: { currentVersionId: null },
    });

    const deletedVersions = await prisma.poolMatchResultVersion.deleteMany({
      where: { resultId: { in: resultIds } },
    });
    console.log(`   Versiones borradas: ${deletedVersions.count}`);

    const deletedResults = await prisma.poolMatchResult.deleteMany({
      where: { id: { in: resultIds } },
    });
    console.log(`   Resultados borrados: ${deletedResults.count}`);
  }

  // ============================================================
  // PASO 3: Actualizar mappings
  // ============================================================
  console.log("\n🔄 Paso 3: Actualizando mappings...\n");

  let updated = 0;
  for (const [internalId, data] of fixtureMap.entries()) {
    const existing = await prisma.matchExternalMapping.findUnique({
      where: {
        tournamentInstanceId_internalMatchId: {
          tournamentInstanceId: "wc2022-autotest-instance",
          internalMatchId: internalId,
        },
      },
    });

    if (existing) {
      // Check for conflicting fixtureId
      const conflicting = await prisma.matchExternalMapping.findUnique({
        where: {
          tournamentInstanceId_apiFootballFixtureId: {
            tournamentInstanceId: "wc2022-autotest-instance",
            apiFootballFixtureId: data.fixtureId,
          },
        },
      });
      if (conflicting && conflicting.id !== existing.id) {
        await prisma.matchExternalMapping.delete({ where: { id: conflicting.id } });
      }

      await prisma.matchExternalMapping.update({
        where: { id: existing.id },
        data: { apiFootballFixtureId: data.fixtureId },
      });
      updated++;
    } else {
      await prisma.matchExternalMapping.create({
        data: {
          tournamentInstanceId: "wc2022-autotest-instance",
          internalMatchId: internalId,
          apiFootballFixtureId: data.fixtureId,
        },
      });
      updated++;
    }
  }
  console.log(`   Mappings actualizados: ${updated}`);

  // ============================================================
  // PASO 4: Ajustar kickoff times
  // ============================================================
  console.log("\n⏰ Paso 4: Ajustando kickoff times...\n");

  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: "wc2022-autotest-instance" },
  });

  if (!instance) throw new Error("Instance not found");

  const dataJson = instance.dataJson as {
    matches: Array<{ id: string; phaseId: string; kickoffUtc: string }>;
    phases: any[];
  };

  // Base time: now + 2 minutes
  const now = new Date();
  const baseTime = new Date(now.getTime() + 2 * 60 * 1000);
  console.log(`   Base time: ${baseTime.toLocaleTimeString()} (ahora + 2 min)`);

  // Group matches: 3 rounds, 5 min apart
  // Round 1: base + 0, Round 2: base + 5, Round 3: base + 10
  let matchesUpdated = 0;
  for (const match of dataJson.matches) {
    if (fixtureMap.has(match.id)) {
      // Parse round from match ID: m_{group}_{round}_{matchInRound}
      const parts = match.id.split("_");
      const round = parseInt(parts[2]);
      const matchInRound = parseInt(parts[3]);
      const offset = (round - 1) * 5 + (matchInRound - 1); // minutes from base

      const kickoff = new Date(baseTime.getTime() + offset * 60 * 1000);
      match.kickoffUtc = kickoff.toISOString();
      matchesUpdated++;
    }
  }

  // Also update knockout kickoffs (they need to be after groups)
  const knockoutBase = new Date(baseTime.getTime() + 15 * 60 * 1000); // 15 min after group base
  const knockoutPhaseOffsets: Record<string, number> = {
    round_of_16: 0,
    quarter_finals: 5,
    semi_finals: 10,
    third_place: 15,
    final: 15,
  };

  for (const match of dataJson.matches) {
    if (match.id.startsWith("ko_")) {
      const offset = knockoutPhaseOffsets[match.phaseId] ?? 0;
      const matchesInPhase = dataJson.matches.filter(
        (m) => m.phaseId === match.phaseId && m.id.startsWith("ko_")
      );
      const idx = matchesInPhase.findIndex((m) => m.id === match.id);
      const kickoff = new Date(knockoutBase.getTime() + (offset + idx) * 60 * 1000);
      match.kickoffUtc = kickoff.toISOString();
      matchesUpdated++;
    }
  }

  await prisma.tournamentInstance.update({
    where: { id: "wc2022-autotest-instance" },
    data: { dataJson: dataJson as any },
  });
  console.log(`   Matches actualizados: ${matchesUpdated}`);

  // ============================================================
  // PASO 5: Resetear sync states de grupo
  // ============================================================
  console.log("\n🔄 Paso 5: Reseteando sync states de grupo...\n");

  // Delete existing group sync states
  const deletedGroupStates = await prisma.matchSyncState.deleteMany({
    where: {
      tournamentInstanceId: "wc2022-autotest-instance",
      internalMatchId: { in: groupMatchIds },
    },
  });
  console.log(`   Sync states borrados: ${deletedGroupStates.count}`);

  // Create new sync states
  let statesCreated = 0;
  for (const match of dataJson.matches) {
    if (fixtureMap.has(match.id)) {
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
  console.log(`   Sync states creados: ${statesCreated}`);

  // Also reset knockout sync states with new kickoff times
  console.log("\n   Reseteando sync states de knockout...");
  const knockoutMatchIds = dataJson.matches
    .filter((m) => m.id.startsWith("ko_") && m.id !== "ko_3rd")
    .map((m) => m.id);

  const deletedKoStates = await prisma.matchSyncState.deleteMany({
    where: {
      tournamentInstanceId: "wc2022-autotest-instance",
      internalMatchId: { in: knockoutMatchIds },
    },
  });
  console.log(`   Sync states knockout borrados: ${deletedKoStates.count}`);

  for (const match of dataJson.matches) {
    if (knockoutMatchIds.includes(match.id)) {
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
    }
  }
  console.log(`   Sync states knockout creados: ${knockoutMatchIds.length}`);

  // ============================================================
  // RESUMEN
  // ============================================================
  const finalStatus = await prisma.matchSyncState.groupBy({
    by: ["syncStatus"],
    where: { tournamentInstanceId: "wc2022-autotest-instance" },
    _count: true,
  });

  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMEN FINAL");
  console.log("=".repeat(60));
  console.log(`   Grupo fixtures mapeados: ${fixtureMap.size}/48`);
  console.log(`   Mappings actualizados: ${updated}`);
  console.log(`   Kickoffs ajustados: ${matchesUpdated}`);
  console.log(`   Sync states creados: ${statesCreated}`);
  console.log("\n   Estado sync states:");
  finalStatus.forEach((s) => console.log(`     ${s.syncStatus}: ${s._count}`));
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
