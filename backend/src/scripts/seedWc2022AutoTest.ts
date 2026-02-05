// backend/src/scripts/seedWc2022AutoTest.ts
// Script de seeding para probar Auto-Results con WC2022
// Ejecutar: npx ts-node src/scripts/seedWc2022AutoTest.ts
//
// CONFIGURACIÓN: Modificar START_TIME antes de ejecutar para ajustar el horario de inicio

import "dotenv/config";
import { prisma } from "../db";
import { hashPassword } from "../lib/password";

// ============================================================================
// CONFIGURACIÓN - MODIFICAR SEGÚN NECESIDAD
// ============================================================================

// Hora de inicio del primer partido (ajustar a tu zona horaria)
// Formato: new Date("YYYY-MM-DDTHH:MM:SS")
// Ejemplo para Colombia (UTC-5): 10:45 PM del 4 de febrero 2026
const START_TIME = new Date("2026-02-04T22:45:00"); // ← CAMBIAR ESTO

// Intervalo entre jornadas (en minutos)
const ROUND_INTERVAL_MINUTES = 5;

// Contraseña común para todos los usuarios de prueba
const COMMON_PASSWORD = "Test1234!";

// ============================================================================
// DATOS DE WORLD CUP 2022 - EQUIPOS REALES
// ============================================================================

// Grupos del Mundial 2022
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

// Fixture IDs de API-Football para WC2022 (grupo stage)
// Obtenidos de: https://www.api-football.com/documentation-v3#tag/Fixtures/operation/get-fixtures
// League ID: 1 (World Cup), Season: 2022
const WC2022_FIXTURE_IDS: Record<string, number[]> = {
  // Grupo A: Qatar, Ecuador, Senegal, Netherlands
  A: [855736, 855746, 855756, 855766, 855773, 855777],
  // Grupo B: England, Iran, USA, Wales
  B: [855737, 855747, 855757, 855767, 855774, 855778],
  // Grupo C: Argentina, Saudi Arabia, Mexico, Poland
  C: [855738, 855748, 855758, 855768, 855775, 855779],
  // Grupo D: France, Australia, Denmark, Tunisia
  D: [855739, 855749, 855759, 855769, 855776, 855780],
  // Grupo E: Spain, Costa Rica, Germany, Japan
  E: [855740, 855750, 855760, 855770, 855781, 855785],
  // Grupo F: Belgium, Canada, Morocco, Croatia
  F: [855741, 855751, 855761, 855771, 855782, 855786],
  // Grupo G: Brazil, Serbia, Switzerland, Cameroon
  G: [855742, 855752, 855762, 855772, 855783, 855787],
  // Grupo H: Portugal, Ghana, Uruguay, South Korea
  H: [855743, 855753, 855763, 855764, 855784, 855788],
};

// Emparejamientos por jornada (índices 0-3 de equipos en cada grupo)
const MATCH_PAIRINGS = [
  // Jornada 1
  { home: 0, away: 1, round: 1 },
  { home: 2, away: 3, round: 1 },
  // Jornada 2
  { home: 0, away: 2, round: 2 },
  { home: 1, away: 3, round: 2 },
  // Jornada 3
  { home: 0, away: 3, round: 3 },
  { home: 1, away: 2, round: 3 },
];

// ============================================================================
// USUARIOS DE PRUEBA
// ============================================================================

const TEST_USERS = [
  { email: "autotest_host@quiniela.test", username: "autotest_host", displayName: "Host AutoTest", isHost: true },
  { email: "autotest_p1@quiniela.test", username: "autotest_maria", displayName: "María García" },
  { email: "autotest_p2@quiniela.test", username: "autotest_juan", displayName: "Juan Pérez" },
  { email: "autotest_p3@quiniela.test", username: "autotest_ana", displayName: "Ana Rodríguez" },
  { email: "autotest_p4@quiniela.test", username: "autotest_luis", displayName: "Luis Martínez" },
  { email: "autotest_p5@quiniela.test", username: "autotest_sofia", displayName: "Sofía López" },
  { email: "autotest_p6@quiniela.test", username: "autotest_diego", displayName: "Diego Hernández" },
  { email: "autotest_p7@quiniela.test", username: "autotest_laura", displayName: "Laura Sánchez" },
  { email: "autotest_p8@quiniela.test", username: "autotest_pablo", displayName: "Pablo Torres" },
  { email: "autotest_p9@quiniela.test", username: "autotest_carmen", displayName: "Carmen Ruiz" },
];

// ============================================================================
// FUNCIONES DE GENERACIÓN DE DATOS
// ============================================================================

function buildWc2022TemplateData(startTime: Date) {
  const groups = Object.keys(WC2022_GROUPS);

  // Crear equipos
  const teams = groups.flatMap((g) => {
    const groupData = WC2022_GROUPS[g];
    return groupData.teams.map((name, i) => ({
      id: `t_${groupData.teamCodes[i]}`,
      name,
      shortName: groupData.teamCodes[i],
      code: groupData.teamCodes[i],
      groupId: g,
    }));
  });

  // Crear fases
  const phases = [
    { id: "group_stage", name: "Fase de Grupos", type: "GROUP" as const, order: 1 },
  ];

  // Crear partidos con kickoffs ficticios escalonados
  let matchSeq = 1;
  const matches: Array<{
    id: string;
    phaseId: string;
    kickoffUtc: string;
    homeTeamId: string;
    awayTeamId: string;
    matchNumber: number;
    roundLabel: string;
    venue: string;
    groupId: string;
  }> = [];

  // Distribuir partidos: cada grupo tiene sus 6 partidos
  // Los organizamos por jornada para que el test sea más realista
  for (let round = 1; round <= 3; round++) {
    const roundPairings = MATCH_PAIRINGS.filter(p => p.round === round);

    for (const g of groups) {
      const groupData = WC2022_GROUPS[g];

      for (let pairingIdx = 0; pairingIdx < roundPairings.length; pairingIdx++) {
        const pairing = roundPairings[pairingIdx];

        // Calcular kickoff: cada jornada empieza ROUND_INTERVAL_MINUTES después de la anterior
        // Dentro de cada jornada, los partidos están separados por 2 minutos
        const roundOffset = (round - 1) * ROUND_INTERVAL_MINUTES;
        const groupOffset = groups.indexOf(g) * 2; // 2 minutos entre grupos
        const pairingOffset = pairingIdx * 1; // 1 minuto entre partidos del mismo grupo/jornada

        const kickoff = new Date(startTime.getTime() + (roundOffset + groupOffset + pairingOffset) * 60 * 1000);

        const matchIndex = MATCH_PAIRINGS.findIndex(p =>
          p.home === pairing.home && p.away === pairing.away && p.round === round
        );

        matches.push({
          id: `m_${g}_${round}_${pairingIdx + 1}`,
          phaseId: "group_stage",
          kickoffUtc: kickoff.toISOString(),
          homeTeamId: `t_${groupData.teamCodes[pairing.home]}`,
          awayTeamId: `t_${groupData.teamCodes[pairing.away]}`,
          matchNumber: matchSeq++,
          roundLabel: `Grupo ${g} - Jornada ${round}`,
          venue: `Estadio ${round}`,
          groupId: g,
        });
      }
    }
  }

  return {
    meta: {
      name: "WC 2022 Auto-Test",
      competition: "FIFA World Cup",
      seasonYear: 2022,
      sport: "football",
    },
    teams,
    phases,
    matches,
    note: "Instancia de prueba para Auto-Results con datos de WC2022",
  };
}

// Generar picks aleatorios reales (para simular comportamiento real de pool)
function generateRandomPick(): { homeGoals: number; awayGoals: number } {
  // Distribución realista de goles:
  // - 0-2 goles: más común (70%)
  // - 3-4 goles: menos común (30%)
  const rand = Math.random();
  const homeGoals = rand < 0.4 ? Math.floor(Math.random() * 2) : // 0-1 (40%)
                    rand < 0.7 ? 2 : // 2 (30%)
                    rand < 0.9 ? 3 : // 3 (20%)
                    4; // 4 (10%)

  const rand2 = Math.random();
  const awayGoals = rand2 < 0.4 ? Math.floor(Math.random() * 2) :
                    rand2 < 0.7 ? 2 :
                    rand2 < 0.9 ? 3 :
                    4;

  return { homeGoals, awayGoals };
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE SEEDING
// ============================================================================

async function seedWc2022AutoTest() {
  console.log("🏆 Iniciando seed WC2022 Auto-Results Test...\n");
  console.log(`⏰ Hora de inicio configurada: ${START_TIME.toLocaleString()}`);
  console.log(`⏱️  Intervalo entre jornadas: ${ROUND_INTERVAL_MINUTES} minutos\n`);

  // 1. Crear usuarios
  console.log("👥 Creando usuarios...");
  const passwordHash = await hashPassword(COMMON_PASSWORD);
  const users: Array<{ id: string; email: string; username: string; displayName: string; isHost?: boolean }> = [];

  for (const userData of TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: { displayName: userData.displayName },
      create: {
        email: userData.email,
        username: userData.username,
        displayName: userData.displayName,
        passwordHash,
        status: "ACTIVE",
        platformRole: "PLAYER",
      },
    });
    users.push({ ...user, isHost: userData.isHost });
    console.log(`   ✓ ${userData.displayName} (${userData.email})`);
  }

  const hostUser = users.find(u => u.isHost)!;
  const playerUsers = users.filter(u => !u.isHost);

  // 2. Crear template
  console.log("\n📋 Creando template WC2022...");
  const templateData = buildWc2022TemplateData(START_TIME);

  const template = await prisma.tournamentTemplate.upsert({
    where: { id: "wc2022-autotest-template" },
    update: {
      name: "World Cup 2022 (Auto-Test)",
      description: "Template para pruebas de Auto-Results",
    },
    create: {
      id: "wc2022-autotest-template",
      key: "wc2022-autotest",
      name: "World Cup 2022 (Auto-Test)",
      description: "Template para pruebas de Auto-Results",
    },
  });
  console.log(`   ✓ Template: ${template.name}`);

  // 3. Crear versión publicada
  console.log("\n📦 Creando versión del template...");
  const version = await prisma.tournamentTemplateVersion.upsert({
    where: { id: "wc2022-autotest-version" },
    update: {
      dataJson: templateData as any,
      status: "PUBLISHED",
    },
    create: {
      id: "wc2022-autotest-version",
      templateId: template.id,
      versionNumber: 1,
      dataJson: templateData as any,
      status: "PUBLISHED",
      publishedAtUtc: new Date(),
    },
  });

  // Actualizar template con versión publicada
  await prisma.tournamentTemplate.update({
    where: { id: template.id },
    data: { currentPublishedVersionId: version.id },
  });
  console.log(`   ✓ Versión: ${version.versionLabel}`);

  // 4. Crear instancia en modo AUTO
  console.log("\n🎮 Creando instancia en modo AUTO...");
  const instance = await prisma.tournamentInstance.upsert({
    where: { id: "wc2022-autotest-instance" },
    update: {
      name: "WC 2022 Auto-Test Instance",
      dataJson: templateData as any,
      resultSourceMode: "AUTO",
      apiFootballLeagueId: 1, // World Cup
      apiFootballSeasonId: 2022,
      syncEnabled: true,
      status: "ACTIVE",
    },
    create: {
      id: "wc2022-autotest-instance",
      templateId: template.id,
      templateVersionId: version.id,
      name: "WC 2022 Auto-Test Instance",
      dataJson: templateData as any,
      resultSourceMode: "AUTO",
      apiFootballLeagueId: 1,
      apiFootballSeasonId: 2022,
      syncEnabled: true,
      status: "ACTIVE",
    },
  });
  console.log(`   ✓ Instancia: ${instance.name}`);
  console.log(`   ✓ Modo: AUTO (API-Football League: 1, Season: 2022)`);

  // 5. Crear mapeos de partidos a API-Football
  console.log("\n🔗 Creando mapeos de fixtures...");
  let mappingCount = 0;

  // Limpiar mapeos existentes
  await prisma.matchExternalMapping.deleteMany({
    where: { tournamentInstanceId: instance.id },
  });

  for (const group of Object.keys(WC2022_FIXTURE_IDS)) {
    const fixtureIds = WC2022_FIXTURE_IDS[group];

    for (let i = 0; i < fixtureIds.length; i++) {
      const pairingIdx = i % 2; // 0 o 1 dentro de cada jornada
      const round = Math.floor(i / 2) + 1;
      const matchId = `m_${group}_${round}_${pairingIdx + 1}`;

      await prisma.matchExternalMapping.create({
        data: {
          tournamentInstanceId: instance.id,
          internalMatchId: matchId,
          apiFootballFixtureId: fixtureIds[i],
        },
      });
      mappingCount++;
    }
  }
  console.log(`   ✓ ${mappingCount} mapeos creados`);

  // 6. Crear pool
  console.log("\n🏊 Creando pool...");
  const pool = await prisma.pool.upsert({
    where: { id: "wc2022-autotest-pool" },
    update: {
      name: "Pool Auto-Test WC2022",
      tournamentInstanceId: instance.id,
    },
    create: {
      id: "wc2022-autotest-pool",
      name: "Pool Auto-Test WC2022",
      tournamentInstanceId: instance.id,
      createdByUserId: hostUser.id,
      visibility: "PRIVATE",
      status: "ACTIVE",
      timeZone: "America/Bogota",
      deadlineMinutesBeforeKickoff: 10,
      scoringPresetKey: "CUMULATIVE",
      pickTypesConfig: [
        {
          phaseId: "group_stage",
          phaseName: "Fase de Grupos",
          requiresScore: true,
          matchPickTypes: {
            MATCH_OUTCOME_90MIN: { enabled: true, points: 5 },
            HOME_GOALS: { enabled: true, points: 2 },
            AWAY_GOALS: { enabled: true, points: 2 },
            GOAL_DIFFERENCE: { enabled: true, points: 1 },
          },
        },
      ] as any,
    },
  });
  console.log(`   ✓ Pool: ${pool.name}`);

  // 7. Agregar miembros al pool
  console.log("\n👥 Agregando miembros al pool...");

  // Host
  await prisma.poolMember.upsert({
    where: { poolId_userId: { poolId: pool.id, userId: hostUser.id } },
    update: { role: "HOST", status: "ACTIVE" },
    create: {
      poolId: pool.id,
      userId: hostUser.id,
      role: "HOST",
      status: "ACTIVE",
    },
  });
  console.log(`   ✓ ${hostUser.displayName} (HOST)`);

  // Players
  for (const player of playerUsers) {
    await prisma.poolMember.upsert({
      where: { poolId_userId: { poolId: pool.id, userId: player.id } },
      update: { role: "PLAYER", status: "ACTIVE" },
      create: {
        poolId: pool.id,
        userId: player.id,
        role: "PLAYER",
        status: "ACTIVE",
      },
    });
    console.log(`   ✓ ${player.displayName} (PLAYER)`);
  }

  // 8. Crear picks para todos los usuarios
  console.log("\n🎯 Creando picks...");
  const matches = templateData.matches;

  for (let userIdx = 0; userIdx < users.length; userIdx++) {
    const user = users[userIdx];
    let pickCount = 0;

    for (const match of matches) {
      const pick = generateRandomPick();

      await prisma.prediction.upsert({
        where: {
          poolId_userId_matchId: {
            poolId: pool.id,
            matchId: match.id,
            userId: user.id,
          },
        },
        update: {
          pickJson: {
            type: "SCORE",
            homeGoals: pick.homeGoals,
            awayGoals: pick.awayGoals,
          },
        },
        create: {
          poolId: pool.id,
          matchId: match.id,
          userId: user.id,
          pickJson: {
            type: "SCORE",
            homeGoals: pick.homeGoals,
            awayGoals: pick.awayGoals,
          },
        },
      });
      pickCount++;
    }
    console.log(`   ✓ ${user.displayName}: ${pickCount} picks`);
  }

  // 9. Resumen final
  console.log("\n" + "=".repeat(60));
  console.log("✅ SEED COMPLETADO\n");

  console.log("📊 RESUMEN:");
  console.log(`   • Template: ${template.name}`);
  console.log(`   • Instancia: ${instance.name} (modo AUTO)`);
  console.log(`   • Pool: ${pool.name}`);
  console.log(`   • Pool ID: ${pool.id}`);
  console.log(`   • Usuarios: ${users.length} (1 host + ${playerUsers.length} players)`);
  console.log(`   • Partidos: ${matches.length}`);
  console.log(`   • Mapeos API-Football: ${mappingCount}`);
  console.log(`   • Picks: ${users.length * matches.length}`);

  console.log("\n📅 HORARIO DE PARTIDOS:");
  const rounds = [1, 2, 3];
  for (const round of rounds) {
    const roundMatches = matches.filter(m => m.id.includes(`_${round}_`));
    if (roundMatches.length > 0) {
      const firstKickoff = new Date(roundMatches[0].kickoffUtc);
      console.log(`   • Jornada ${round}: ${firstKickoff.toLocaleTimeString()} (${roundMatches.length} partidos)`);
    }
  }

  console.log("\n🔐 CREDENCIALES:");
  console.log(`   • Contraseña común: ${COMMON_PASSWORD}`);
  console.log("\n   USUARIOS:");
  for (const user of users) {
    console.log(`   • ${user.email} - ${user.displayName}${user.isHost ? " (HOST)" : ""}`);
  }

  console.log("\n📝 PRÓXIMOS PASOS:");
  console.log("   1. Iniciar el backend: npm run dev");
  console.log("   2. Verificar que API_FOOTBALL_ENABLED=true y RESULT_SYNC_ENABLED=true en .env");
  console.log("   3. Observar logs cuando pasen los kickoffs");
  console.log("   4. O disparar sync manual: POST /admin/instances/wc2022-autotest-instance/sync");
  console.log("\n" + "=".repeat(60));
}

// Ejecutar
seedWc2022AutoTest()
  .then(() => {
    console.log("\n🎉 ¡Listo!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
