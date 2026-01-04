// backend/src/scripts/seedTestScenario.ts
import "dotenv/config";
import { prisma } from "../db";
import { hashPassword } from "../lib/password";

/**
 * Script para crear escenario completo de testing E2E
 *
 * Crea:
 * - 3 usuarios: host@test.com, player1@test.com, player2@test.com
 * - 1 pool activa con WC2026 Sandbox
 * - Player1 y Player2 unidos a la pool
 * - Algunos picks ya guardados
 * - Algunos resultados ya publicados
 * - Leaderboard con puntos calculados
 */

async function main() {
  console.log("🎬 Creando escenario de testing E2E...\n");

  // Credenciales de prueba (password: "test123" para todos)
  const testPassword = await hashPassword("test123");

  const users = {
    host: { email: "host@test.com", displayName: "Host Test", passwordHash: testPassword },
    player1: { email: "player1@test.com", displayName: "Player One", passwordHash: testPassword },
    player2: { email: "player2@test.com", displayName: "Player Two", passwordHash: testPassword },
  };

  // 1) Crear usuarios (o actualizar si ya existen)
  console.log("👤 Creando usuarios...");
  const host = await prisma.user.upsert({
    where: { email: users.host.email },
    update: {},
    create: users.host,
  });

  const player1 = await prisma.user.upsert({
    where: { email: users.player1.email },
    update: {},
    create: users.player1,
  });

  const player2 = await prisma.user.upsert({
    where: { email: users.player2.email },
    update: {},
    create: users.player2,
  });

  console.log(`   ✅ Host: ${host.email} (ID: ${host.id})`);
  console.log(`   ✅ Player1: ${player1.email} (ID: ${player1.id})`);
  console.log(`   ✅ Player2: ${player2.email} (ID: ${player2.id})\n`);

  // 2) Buscar instancia WC2026 Sandbox
  console.log("🏆 Buscando instancia WC2026 Sandbox...");
  const instance = await prisma.tournamentInstance.findFirst({
    where: { name: { contains: "WC 2026" } },
  });

  if (!instance) {
    throw new Error("❌ No se encontró instancia WC2026. Ejecuta primero: npm run seed:wc2026-sandbox");
  }
  console.log(`   ✅ Instance: ${instance.name} (ID: ${instance.id})\n`);

  // 3) Crear pool (o limpiar si ya existe)
  console.log("🎱 Creando pool de prueba...");

  // Eliminar pool anterior si existe
  const existingPool = await prisma.pool.findFirst({
    where: { name: "E2E Test Pool" },
  });

  if (existingPool) {
    console.log("   🧹 Limpiando pool anterior...");
    // Eliminar en orden correcto por dependencias
    const existingResults = await prisma.poolMatchResult.findMany({
      where: { poolId: existingPool.id },
      select: { id: true },
    });
    for (const r of existingResults) {
      await prisma.poolMatchResultVersion.deleteMany({ where: { resultId: r.id } });
    }
    await prisma.poolMatchResult.deleteMany({ where: { poolId: existingPool.id } });
    await prisma.prediction.deleteMany({ where: { poolId: existingPool.id } });
    await prisma.poolMember.deleteMany({ where: { poolId: existingPool.id } });
    await prisma.pool.delete({ where: { id: existingPool.id } });
  }

  const pool = await prisma.pool.create({
    data: {
      name: "E2E Test Pool",
      description: "Pool de prueba para testing end-to-end",
      tournamentInstanceId: instance.id,
      visibility: "PRIVATE",
      scoringPresetKey: "CLASSIC",
      deadlineMinutesBeforeKickoff: 10,
      timeZone: "America/New_York",
      createdByUserId: host.id,
    },
  });

  console.log(`   ✅ Pool: ${pool.name} (ID: ${pool.id})\n`);

  // 4) Agregar miembros a la pool
  console.log("👥 Agregando miembros a la pool...");

  const hostMember = await prisma.poolMember.create({
    data: {
      poolId: pool.id,
      userId: host.id,
      role: "HOST",
      status: "ACTIVE",
      joinedAtUtc: new Date(),
    },
  });

  const player1Member = await prisma.poolMember.create({
    data: {
      poolId: pool.id,
      userId: player1.id,
      role: "PLAYER",
      status: "ACTIVE",
      joinedAtUtc: new Date(Date.now() + 1000), // 1 segundo después
    },
  });

  const player2Member = await prisma.poolMember.create({
    data: {
      poolId: pool.id,
      userId: player2.id,
      role: "PLAYER",
      status: "ACTIVE",
      joinedAtUtc: new Date(Date.now() + 2000), // 2 segundos después
    },
  });

  console.log(`   ✅ Host agregado (${hostMember.role})`);
  console.log(`   ✅ Player1 agregado (${player1Member.role})`);
  console.log(`   ✅ Player2 agregado (${player2Member.role})\n`);

  // 5) Crear algunos picks para distintos partidos
  console.log("⚽ Creando picks de prueba...");

  const instanceData = instance.dataJson as any;
  const matches = instanceData.matches || [];

  // Partido 1: México vs Corea del Sur (Grupo A, J1)
  const match1 = matches.find((m: any) => m.id === "m_A_1_1");
  if (match1) {
    // Player1 predice: México 2-1 Corea del Sur
    await prisma.prediction.create({
      data: {
        poolId: pool.id,
        userId: player1.id,
        matchId: match1.id,
        pickJson: { type: "SCORE", homeGoals: 2, awayGoals: 1 },
      },
    });

    // Player2 predice: México 1-1 Corea del Sur
    await prisma.prediction.create({
      data: {
        poolId: pool.id,
        userId: player2.id,
        matchId: match1.id,
        pickJson: { type: "SCORE", homeGoals: 1, awayGoals: 1 },
      },
    });

    console.log(`   ✅ Picks creados para: ${match1.id} (México vs Corea del Sur)`);
  }

  // Partido 2: Sudáfrica vs TBD (Grupo A, J1)
  const match2 = matches.find((m: any) => m.id === "m_A_1_2");
  if (match2) {
    // Solo Player1 hace pick
    await prisma.prediction.create({
      data: {
        poolId: pool.id,
        userId: player1.id,
        matchId: match2.id,
        pickJson: { type: "SCORE", homeGoals: 0, awayGoals: 2 },
      },
    });

    console.log(`   ✅ Pick creado para: ${match2.id} (Sudáfrica vs TBD)`);
  }

  // Partido 3: México vs Sudáfrica (Grupo A, J2)
  const match3 = matches.find((m: any) => m.id === "m_A_2_1");
  if (match3) {
    // Player2 hace pick
    await prisma.prediction.create({
      data: {
        poolId: pool.id,
        userId: player2.id,
        matchId: match3.id,
        pickJson: { type: "SCORE", homeGoals: 3, awayGoals: 0 },
      },
    });

    console.log(`   ✅ Pick creado para: ${match3.id} (México vs Sudáfrica)\n`);
  }

  // 6) Publicar algunos resultados
  console.log("📊 Publicando resultados oficiales...");

  if (match1) {
    // Resultado oficial: México 2-1 Corea del Sur
    const result1 = await prisma.poolMatchResult.create({
      data: {
        poolId: pool.id,
        matchId: match1.id,
      },
    });

    const version1 = await prisma.poolMatchResultVersion.create({
      data: {
        resultId: result1.id,
        versionNumber: 1,
        status: "PUBLISHED",
        homeGoals: 2,
        awayGoals: 1,
        createdByUserId: host.id,
        publishedAtUtc: new Date(),
      },
    });

    await prisma.poolMatchResult.update({
      where: { id: result1.id },
      data: { currentVersionId: version1.id },
    });

    console.log(`   ✅ Resultado publicado: ${match1.id} → 2-1`);
  }

  if (match2) {
    // Resultado oficial: Sudáfrica 1-2 TBD
    const result2 = await prisma.poolMatchResult.create({
      data: {
        poolId: pool.id,
        matchId: match2.id,
      },
    });

    const version2 = await prisma.poolMatchResultVersion.create({
      data: {
        resultId: result2.id,
        versionNumber: 1,
        status: "PUBLISHED",
        homeGoals: 1,
        awayGoals: 2,
        createdByUserId: host.id,
        publishedAtUtc: new Date(),
      },
    });

    await prisma.poolMatchResult.update({
      where: { id: result2.id },
      data: { currentVersionId: version2.id },
    });

    console.log(`   ✅ Resultado publicado: ${match2.id} → 1-2\n`);
  }

  // 7) Resumen final
  console.log("✨ Escenario de testing creado exitosamente!\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("📋 CREDENCIALES DE PRUEBA");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log("🔑 HOST (puede publicar resultados):");
  console.log(`   Email:    ${users.host.email}`);
  console.log(`   Password: test123`);
  console.log("");
  console.log("🔑 PLAYER 1:");
  console.log(`   Email:    ${users.player1.email}`);
  console.log(`   Password: test123`);
  console.log("");
  console.log("🔑 PLAYER 2:");
  console.log(`   Email:    ${users.player2.email}`);
  console.log(`   Password: test123`);
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🎱 POOL DE PRUEBA");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log(`   Nombre: ${pool.name}`);
  console.log(`   ID: ${pool.id}`);
  console.log(`   Miembros: 3 (1 HOST + 2 PLAYERS)`);
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("📊 ESTADO ACTUAL");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log("Picks creados:");
  console.log("   • Player1: 2 picks (m_A_1_1, m_A_1_2)");
  console.log("   • Player2: 2 picks (m_A_1_1, m_A_2_1)");
  console.log("");
  console.log("Resultados publicados:");
  console.log("   • m_A_1_1: México 2-1 Corea del Sur ✅");
  console.log("   • m_A_1_2: Sudáfrica 1-2 TBD ✅");
  console.log("");
  console.log("Puntos esperados (CLASSIC preset: 5pts exact, 3pts outcome):");
  console.log("   • Player1: 5 pts (acertó m_A_1_1 exacto) + 0 pts (falló m_A_1_2) = 5 pts");
  console.log("   • Player2: 3 pts (acertó m_A_1_1 outcome)");
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🚀 SIGUIENTE PASO");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log("1. Abre http://localhost:5173");
  console.log("2. Login con cualquiera de las 3 cuentas");
  console.log("3. Verás la pool 'E2E Test Pool' en el dashboard");
  console.log("4. Click en la pool para ver:");
  console.log("   - Partidos con banderas reales");
  console.log("   - Picks ya guardados (modo lectura)");
  console.log("   - Resultados oficiales publicados");
  console.log("   - Leaderboard con puntos calculados");
  console.log("5. Prueba hacer un nuevo pick en partido sin resultado");
  console.log("6. (Como HOST) Publica un nuevo resultado");
  console.log("7. Verifica que el leaderboard se actualiza");
  console.log("");
  console.log("═══════════════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Error creando escenario de testing:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
