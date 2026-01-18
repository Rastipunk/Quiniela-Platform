// backend/src/scripts/seedFullTestScenario.ts
// Script completo de seeding para pruebas: 10 usuarios, pool WC2026, picks y resultados
// Ejecutar: npx ts-node src/scripts/seedFullTestScenario.ts

import "dotenv/config";
import { prisma } from "../db";
import { hashPassword } from "../lib/password";

// ========== CONFIGURACIÓN DE USUARIOS ==========
// Contraseña común para todos: Test1234!
const COMMON_PASSWORD = "Test1234!";

const TEST_USERS = [
  { email: "host@quiniela.test", username: "host_carlos", displayName: "Carlos (Host)", isHost: true },
  { email: "player1@quiniela.test", username: "player_maria", displayName: "María García" },
  { email: "player2@quiniela.test", username: "player_juan", displayName: "Juan Pérez" },
  { email: "player3@quiniela.test", username: "player_ana", displayName: "Ana Rodríguez" },
  { email: "player4@quiniela.test", username: "player_luis", displayName: "Luis Martínez" },
  { email: "player5@quiniela.test", username: "player_sofia", displayName: "Sofía López" },
  { email: "player6@quiniela.test", username: "player_diego", displayName: "Diego Hernández" },
  { email: "player7@quiniela.test", username: "player_laura", displayName: "Laura Sánchez" },
  { email: "player8@quiniela.test", username: "player_pablo", displayName: "Pablo Torres" },
  { email: "player9@quiniela.test", username: "player_carmen", displayName: "Carmen Ruiz" },
];

// ========== RESULTADOS PREDEFINIDOS ==========
// Resultados hasta cuartos de final (para que semifinal y final estén pendientes)
// Formato: matchId -> { homeGoals, awayGoals }
const PREDEFINED_RESULTS: Record<string, { homeGoals: number; awayGoals: number }> = {};

// Generar resultados aleatorios pero determinísticos para fase de grupos
const groups = "ABCDEFGHIJKL".split("");
const pairings = [
  { round: 1, a: 1, b: 2 },
  { round: 1, a: 3, b: 4 },
  { round: 2, a: 1, b: 3 },
  { round: 2, a: 2, b: 4 },
  { round: 3, a: 1, b: 4 },
  { round: 3, a: 2, b: 3 },
];

// Resultados de fase de grupos (72 partidos)
let seed = 42; // Seed para resultados pseudo-aleatorios pero reproducibles
function pseudoRandom(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed;
}

for (const g of groups) {
  for (let k = 0; k < pairings.length; k++) {
    const p = pairings[k];
    const matchId = `m_${g}_${p.round}_${k + 1}`;
    PREDEFINED_RESULTS[matchId] = {
      homeGoals: pseudoRandom() % 4,
      awayGoals: pseudoRandom() % 3,
    };
  }
}

// Resultados de Round of 32 (16 partidos)
for (let i = 1; i <= 16; i++) {
  PREDEFINED_RESULTS[`m_R32_${i}`] = {
    homeGoals: 1 + (pseudoRandom() % 3),
    awayGoals: pseudoRandom() % 2,
  };
}

// Resultados de Round of 16 (8 partidos)
for (let i = 1; i <= 8; i++) {
  PREDEFINED_RESULTS[`m_R16_${i}`] = {
    homeGoals: pseudoRandom() % 3,
    awayGoals: pseudoRandom() % 3,
  };
  // Asegurar que no hay empates en eliminatorias
  if (PREDEFINED_RESULTS[`m_R16_${i}`].homeGoals === PREDEFINED_RESULTS[`m_R16_${i}`].awayGoals) {
    PREDEFINED_RESULTS[`m_R16_${i}`].homeGoals += 1;
  }
}

// Resultados de Cuartos de Final (4 partidos)
for (let i = 1; i <= 4; i++) {
  PREDEFINED_RESULTS[`m_QF_${i}`] = {
    homeGoals: 1 + (pseudoRandom() % 2),
    awayGoals: pseudoRandom() % 2,
  };
}

// Semifinales y Final NO tienen resultados (para probar deadline futuro)

// ========== CONFIGURACIÓN ACUMULATIVA DE PICKS POR FASE ==========
// Sistema acumulativo: Los puntos se SUMAN por cada criterio cumplido
// Marcador exacto = Resultado + Goles Local + Goles Visitante + Diferencia = 10 pts (grupos) / 20 pts (eliminatorias)
const PICK_TYPES_CONFIG = [
  {
    phaseId: "group_stage",
    phaseName: "Fase de Grupos",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 1 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 5 },
        { key: "HOME_GOALS", enabled: true, points: 2 },
        { key: "AWAY_GOALS", enabled: true, points: 2 },
      ],
    },
  },
  {
    phaseId: "round_of_32",
    phaseName: "Dieciseisavos de Final",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
  {
    phaseId: "round_of_16",
    phaseName: "Octavos de Final",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
  {
    phaseId: "quarter_finals",
    phaseName: "Cuartos de Final",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
  {
    phaseId: "semi_finals",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
  {
    phaseId: "finals",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
  },
];

// ========== FUNCIONES AUXILIARES ==========

async function createOrUpdateUser(params: {
  email: string;
  username: string;
  displayName: string;
  password: string;
}) {
  const passwordHash = await hashPassword(params.password);

  return prisma.user.upsert({
    where: { email: params.email },
    create: {
      email: params.email,
      username: params.username,
      displayName: params.displayName,
      passwordHash,
      platformRole: "PLAYER",
      status: "ACTIVE",
    },
    update: {
      displayName: params.displayName,
      passwordHash,
      status: "ACTIVE",
    },
  });
}

// Generar pick variado para un partido
function generatePick(userIndex: number, matchId: string, actualResult?: { homeGoals: number; awayGoals: number }) {
  // Cada usuario tiene un estilo de predicción diferente
  const styles = [
    // Usuario 0 (host): intenta acertar exacto más seguido
    () => actualResult ? { ...actualResult } : { homeGoals: 2, awayGoals: 1 },
    // Usuario 1: favorece al local
    () => ({ homeGoals: 2 + (pseudoRandom() % 2), awayGoals: pseudoRandom() % 2 }),
    // Usuario 2: favorece empates
    () => {
      const goals = pseudoRandom() % 3;
      return { homeGoals: goals, awayGoals: goals };
    },
    // Usuario 3: favorece al visitante
    () => ({ homeGoals: pseudoRandom() % 2, awayGoals: 1 + (pseudoRandom() % 2) }),
    // Usuario 4: marcadores altos
    () => ({ homeGoals: 2 + (pseudoRandom() % 3), awayGoals: 1 + (pseudoRandom() % 3) }),
    // Usuario 5: marcadores bajos
    () => ({ homeGoals: pseudoRandom() % 2, awayGoals: pseudoRandom() % 2 }),
    // Usuario 6: siempre 2-1
    () => ({ homeGoals: 2, awayGoals: 1 }),
    // Usuario 7: siempre 1-0
    () => ({ homeGoals: 1, awayGoals: 0 }),
    // Usuario 8: aleatorio total
    () => ({ homeGoals: pseudoRandom() % 5, awayGoals: pseudoRandom() % 4 }),
    // Usuario 9: copia resultado con variación
    () => {
      if (actualResult) {
        return {
          homeGoals: Math.max(0, actualResult.homeGoals + (pseudoRandom() % 3) - 1),
          awayGoals: Math.max(0, actualResult.awayGoals + (pseudoRandom() % 3) - 1),
        };
      }
      return { homeGoals: 1, awayGoals: 1 };
    },
  ];

  const style = styles[userIndex % styles.length];
  const pick = style();

  return {
    type: "SCORE",
    homeGoals: pick.homeGoals,
    awayGoals: pick.awayGoals,
  };
}

// ========== FUNCIÓN PRINCIPAL ==========

async function main() {
  console.log("🚀 Iniciando seeding completo de escenario de prueba...\n");

  // 1. Crear usuarios
  console.log("👥 Creando 10 usuarios de prueba...");
  const users: { id: string; email: string; displayName: string; isHost?: boolean }[] = [];

  for (const userData of TEST_USERS) {
    const user = await createOrUpdateUser({
      email: userData.email,
      username: userData.username,
      displayName: userData.displayName,
      password: COMMON_PASSWORD,
    });
    users.push({ ...user, isHost: userData.isHost });
    console.log(`   ✓ ${userData.displayName} (${userData.email})`);
  }

  const hostUser = users.find(u => u.isHost)!;
  const playerUsers = users.filter(u => !u.isHost);

  // 2. Obtener instancia WC2026
  console.log("\n🏆 Buscando instancia WC 2026 Sandbox...");
  const instance = await prisma.tournamentInstance.findFirst({
    where: { name: "WC 2026 (Sandbox Instance)" },
  });

  if (!instance) {
    throw new Error("❌ No se encontró la instancia WC 2026 Sandbox. Ejecuta primero: npm run seed:wc2026-sandbox");
  }
  console.log(`   ✓ Instancia encontrada: ${instance.id}`);

  // 3. Crear pool
  console.log("\n🎱 Creando pool de prueba...");

  // Eliminar pool existente si hay
  const existingPool = await prisma.pool.findFirst({
    where: { name: "Pool de Prueba WC2026" },
  });

  if (existingPool) {
    console.log("   ⚠ Pool existente encontrada, eliminando datos anteriores...");
    // Eliminar en orden correcto por foreign keys
    await prisma.poolMatchResultVersion.deleteMany({ where: { result: { poolId: existingPool.id } } });
    await prisma.poolMatchResult.deleteMany({ where: { poolId: existingPool.id } });
    await prisma.prediction.deleteMany({ where: { poolId: existingPool.id } });
    await prisma.structuralPrediction.deleteMany({ where: { poolId: existingPool.id } });
    await prisma.poolInvite.deleteMany({ where: { poolId: existingPool.id } });
    await prisma.poolMember.deleteMany({ where: { poolId: existingPool.id } });
    await prisma.pool.delete({ where: { id: existingPool.id } });
    console.log("   ✓ Datos anteriores eliminados");
  }

  // Obtener el fixture del torneo
  const tournamentData = instance.dataJson as any;

  // Modificar kickoffs para que todos los partidos excepto semifinal y final tengan deadline vencido
  const now = new Date();
  const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 horas atrás
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 días adelante

  const modifiedMatches = tournamentData.matches.map((m: any) => {
    // Semifinales y Final tienen kickoff futuro
    if (m.phaseId === "semi_finals" || m.phaseId === "finals") {
      return {
        ...m,
        kickoffUtc: futureDate.toISOString(),
      };
    }
    // Todo lo demás tiene kickoff pasado
    return {
      ...m,
      kickoffUtc: pastDate.toISOString(),
    };
  });

  const fixtureSnapshot = {
    ...tournamentData,
    matches: modifiedMatches,
  };

  const pool = await prisma.pool.create({
    data: {
      name: "Pool de Prueba WC2026",
      description: "Pool completa para testing con 10 usuarios, picks variados y resultados hasta cuartos",
      tournamentInstanceId: instance.id,
      createdByUserId: hostUser.id,
      status: "ACTIVE",
      visibility: "PRIVATE",
      timeZone: "America/Mexico_City",
      deadlineMinutesBeforeKickoff: 10,
      pickTypesConfig: PICK_TYPES_CONFIG,
      fixtureSnapshot: fixtureSnapshot,
    },
  });
  console.log(`   ✓ Pool creada: ${pool.id}`);

  // 4. Agregar miembros
  console.log("\n👥 Agregando miembros a la pool...");

  // Host
  await prisma.poolMember.create({
    data: {
      poolId: pool.id,
      userId: hostUser.id,
      role: "HOST",
      status: "ACTIVE",
    },
  });
  console.log(`   ✓ ${hostUser.displayName} como HOST`);

  // Players
  for (const player of playerUsers) {
    await prisma.poolMember.create({
      data: {
        poolId: pool.id,
        userId: player.id,
        role: "PLAYER",
        status: "ACTIVE",
      },
    });
    console.log(`   ✓ ${player.displayName} como PLAYER`);
  }

  // 5. Generar picks para todos los partidos
  console.log("\n⚽ Generando picks para todos los partidos...");

  const allMatches = modifiedMatches as any[];
  let picksCreated = 0;

  for (const match of allMatches) {
    // Solo crear picks para partidos con kickoff pasado o para mostrar que aún no hay picks
    const actualResult = PREDEFINED_RESULTS[match.id];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      // Para algunos partidos futuros, algunos usuarios no hacen pick (simular realidad)
      const isFutureMatch = match.phaseId === "semi_finals" || match.phaseId === "finals";

      // En partidos futuros, solo 60% de usuarios hacen pick
      if (isFutureMatch && pseudoRandom() % 10 > 6) {
        continue;
      }

      const pick = generatePick(i, match.id, actualResult);

      await prisma.prediction.create({
        data: {
          poolId: pool.id,
          userId: user.id,
          matchId: match.id,
          pickJson: pick,
        },
      });
      picksCreated++;
    }
  }
  console.log(`   ✓ ${picksCreated} picks creados`);

  // 6. Publicar resultados hasta cuartos de final
  console.log("\n📊 Publicando resultados hasta cuartos de final...");

  let resultsPublished = 0;

  for (const [matchId, result] of Object.entries(PREDEFINED_RESULTS)) {
    // Crear PoolMatchResult
    const matchResult = await prisma.poolMatchResult.create({
      data: {
        poolId: pool.id,
        matchId,
      },
    });

    // Crear versión del resultado
    const version = await prisma.poolMatchResultVersion.create({
      data: {
        result: { connect: { id: matchResult.id } },
        versionNumber: 1,
        status: "PUBLISHED",
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        createdBy: { connect: { id: hostUser.id } },
        publishedAtUtc: new Date(),
      },
    });

    // Actualizar currentVersion
    await prisma.poolMatchResult.update({
      where: { id: matchResult.id },
      data: { currentVersionId: version.id },
    });

    resultsPublished++;
  }
  console.log(`   ✓ ${resultsPublished} resultados publicados`);

  // 7. Resumen final
  console.log("\n" + "═".repeat(60));
  console.log("✅ SEEDING COMPLETADO EXITOSAMENTE");
  console.log("═".repeat(60));
  console.log("\n📋 CREDENCIALES DE ACCESO:");
  console.log("   Contraseña común: Test1234!");
  console.log("\n👤 USUARIOS:");
  for (const user of users) {
    console.log(`   • ${user.displayName}`);
    console.log(`     Email: ${user.email}`);
    console.log(`     Rol: ${user.isHost ? "HOST" : "PLAYER"}`);
  }
  console.log("\n🎱 POOL:");
  console.log(`   Nombre: Pool de Prueba WC2026`);
  console.log(`   ID: ${pool.id}`);
  console.log(`   Estado: ACTIVE`);
  console.log(`   Partidos con deadline pasado: ${Object.keys(PREDEFINED_RESULTS).length}`);
  console.log(`   Partidos con deadline futuro: 4 (2 semifinales + tercer lugar + final)`);
  console.log("\n📊 ESTADÍSTICAS:");
  console.log(`   Total usuarios: ${users.length}`);
  console.log(`   Total picks: ${picksCreated}`);
  console.log(`   Total resultados: ${resultsPublished}`);
  console.log("\n💡 TIPS PARA TESTING:");
  console.log("   1. Login con cualquier email + Test1234!");
  console.log("   2. El host puede publicar resultados de semifinales/final");
  console.log("   3. Los jugadores pueden ver picks de otros en partidos pasados");
  console.log("   4. La pestaña 'Mi Resumen' muestra estadísticas detalladas");
  console.log("   5. Click en leaderboard abre modal con resumen del jugador");
}

main()
  .catch((err) => {
    console.error("❌ Error en seeding:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
