import "dotenv/config";
import { prisma } from "../db";
import { hashPassword } from "../lib/password";

/**
 * Script de prueba para auto-advance:
 * 1. Crea 3 usuarios de prueba (host + 2 players)
 * 2. Crea una pool con la instancia WC2026
 * 3. Publica resultados en 71 de 72 partidos de grupos
 * 4. Deja 1 partido sin resultado para probar avance manual
 */

async function main() {
  console.log("🚀 Iniciando seed de prueba auto-advance...\n");

  // 1. CREAR USUARIOS
  console.log("📝 Creando usuarios de prueba...");

  const hostPassword = await hashPassword("test123");
  const host = await prisma.user.upsert({
    where: { email: "host@quiniela.test" },
    create: {
      email: "host@quiniela.test",
      displayName: "Ana Host",
      passwordHash: hostPassword,
      platformRole: "PLAYER",
      status: "ACTIVE",
    },
    update: {
      passwordHash: hostPassword,
      displayName: "Ana Host",
    },
  });

  const player1Password = await hashPassword("test123");
  const player1 = await prisma.user.upsert({
    where: { email: "player1@quiniela.test" },
    create: {
      email: "player1@quiniela.test",
      displayName: "Carlos Player",
      passwordHash: player1Password,
      platformRole: "PLAYER",
      status: "ACTIVE",
    },
    update: {
      passwordHash: player1Password,
      displayName: "Carlos Player",
    },
  });

  const player2Password = await hashPassword("test123");
  const player2 = await prisma.user.upsert({
    where: { email: "player2@quiniela.test" },
    create: {
      email: "player2@quiniela.test",
      displayName: "María Player",
      passwordHash: player2Password,
      platformRole: "PLAYER",
      status: "ACTIVE",
    },
    update: {
      passwordHash: player2Password,
      displayName: "María Player",
    },
  });

  console.log("✅ Usuarios creados:");
  console.log(`   🎯 Host: ${host.email} / test123`);
  console.log(`   👤 Player 1: ${player1.email} / test123`);
  console.log(`   👤 Player 2: ${player2.email} / test123\n`);

  // 2. BUSCAR INSTANCIA WC2026
  console.log("🔍 Buscando instancia WC 2026...");
  const instance = await prisma.tournamentInstance.findFirst({
    where: {
      status: "ACTIVE",
    },
    orderBy: {
      createdAtUtc: "desc",
    },
  });

  if (!instance) {
    throw new Error("No se encontró una instancia activa. Ejecuta el seed sandbox primero.");
  }
  console.log(`✅ Instancia encontrada: ${instance.name}\n`);

  // 3. LIMPIAR POOLS ANTIGUAS
  console.log("🧹 Limpiando pools de prueba antiguas...");
  const oldPools = await prisma.pool.findMany({
    where: {
      name: "E2E Test Pool - Auto Advance",
    },
  });

  for (const oldPool of oldPools) {
    // Eliminar miembros
    await prisma.poolMember.deleteMany({ where: { poolId: oldPool.id } });
    // Eliminar resultados y versiones
    const oldResults = await prisma.poolMatchResult.findMany({ where: { poolId: oldPool.id } });
    for (const result of oldResults) {
      await prisma.poolMatchResultVersion.deleteMany({ where: { resultId: result.id } });
    }
    await prisma.poolMatchResult.deleteMany({ where: { poolId: oldPool.id } });
    // Eliminar pool
    await prisma.pool.delete({ where: { id: oldPool.id } });
  }
  console.log(`✅ ${oldPools.length} pool(s) antigua(s) eliminada(s)\n`);

  // 4. CREAR POOL
  console.log("🏊 Creando pool de prueba...");
  const pool = await prisma.pool.create({
    data: {
      name: "E2E Test Pool - Auto Advance",
      description: "Pool de prueba con 71/72 partidos completados",
      tournamentInstanceId: instance.id,
      createdByUserId: host.id,
      visibility: "PRIVATE",
      timeZone: "America/New_York",
      deadlineMinutesBeforeKickoff: 10,
      scoringPresetKey: "CLASSIC",
      autoAdvanceEnabled: true, // IMPORTANTE: Auto-advance habilitado
    },
  });
  console.log(`✅ Pool creada: ${pool.name} (ID: ${pool.id})\n`);

  // 4. AGREGAR MIEMBROS
  console.log("👥 Agregando miembros...");
  await prisma.poolMember.create({
    data: {
      poolId: pool.id,
      userId: host.id,
      role: "HOST",
      status: "ACTIVE",
    },
  });

  await prisma.poolMember.create({
    data: {
      poolId: pool.id,
      userId: player1.id,
      role: "PLAYER",
      status: "ACTIVE",
    },
  });

  await prisma.poolMember.create({
    data: {
      poolId: pool.id,
      userId: player2.id,
      role: "PLAYER",
      status: "ACTIVE",
    },
  });
  console.log("✅ Miembros agregados\n");

  // 5. OBTENER PARTIDOS DE GRUPOS
  const data = instance.dataJson as any;
  const groupMatches = data.matches.filter((m: any) => m.phaseId === "group_stage");

  console.log(`📊 Total de partidos de grupos: ${groupMatches.length}`);
  console.log(`   Publicando resultados en: ${groupMatches.length - 1} partidos`);
  console.log(`   Dejando SIN resultado: 1 partido\n`);

  // 6. PUBLICAR RESULTADOS EN 71 DE 72 PARTIDOS
  console.log("⚽ Publicando resultados...");

  // Dejar el ÚLTIMO partido sin resultado
  const matchesToComplete = groupMatches.slice(0, -1);
  const matchWithoutResult = groupMatches[groupMatches.length - 1];

  let count = 0;
  for (const match of matchesToComplete) {
    // Generar resultado aleatorio pero realista (0-4 goles)
    const homeGoals = Math.floor(Math.random() * 5);
    const awayGoals = Math.floor(Math.random() * 5);

    // Crear o actualizar resultado
    const poolMatchResult = await prisma.poolMatchResult.upsert({
      where: {
        poolId_matchId: {
          poolId: pool.id,
          matchId: match.id,
        },
      },
      create: {
        poolId: pool.id,
        matchId: match.id,
      },
      update: {},
    });

    // Limpiar versiones anteriores si existen
    await prisma.poolMatchResultVersion.deleteMany({
      where: {
        resultId: poolMatchResult.id,
      },
    });

    // Crear primera versión del resultado
    await prisma.poolMatchResultVersion.create({
      data: {
        result: {
          connect: { id: poolMatchResult.id },
        },
        createdBy: {
          connect: { id: host.id },
        },
        versionNumber: 1,
        homeGoals,
        awayGoals,
        publishedAtUtc: new Date(),
      },
    });

    // Actualizar currentVersionId
    const currentVersion = await prisma.poolMatchResultVersion.findFirst({
      where: {
        resultId: poolMatchResult.id,
        versionNumber: 1,
      },
    });

    await prisma.poolMatchResult.update({
      where: { id: poolMatchResult.id },
      data: { currentVersionId: currentVersion!.id },
    });

    count++;
    if (count % 10 === 0) {
      console.log(`   ✓ ${count}/${matchesToComplete.length} partidos completados`);
    }
  }

  console.log(`✅ ${matchesToComplete.length} resultados publicados\n`);

  // 7. INFORMACIÓN DEL PARTIDO FALTANTE
  console.log("⏳ Partido sin resultado (para prueba manual):");
  console.log(`   Match ID: ${matchWithoutResult.id}`);
  console.log(`   Equipos: ${matchWithoutResult.homeTeamId} vs ${matchWithoutResult.awayTeamId}`);
  console.log(`   Grupo: ${matchWithoutResult.groupId || "N/A"}\n`);

  // 8. RESUMEN FINAL
  console.log("=" .repeat(60));
  console.log("✅ SEED COMPLETADO - ESCENARIO DE PRUEBA LISTO\n");
  console.log("📋 CREDENCIALES:");
  console.log("   Host: host@quiniela.test / test123");
  console.log("   Player 1: player1@quiniela.test / test123");
  console.log("   Player 2: player2@quiniela.test / test123\n");
  console.log("📊 ESTADO:");
  console.log(`   Pool ID: ${pool.id}`);
  console.log(`   Pool Name: ${pool.name}`);
  console.log(`   Auto-Advance: ${pool.autoAdvanceEnabled ? "HABILITADO ✅" : "DESHABILITADO ❌"}`);
  console.log(`   Partidos completados: ${matchesToComplete.length}/${groupMatches.length}`);
  console.log(`   Partidos faltantes: 1\n`);
  console.log("🧪 PRUEBAS A REALIZAR:");
  console.log("   1. Login como Host");
  console.log("   2. Ir al tab 'Administración'");
  console.log("   3. Verificar que fase de grupos muestra 71/72 (98%)");
  console.log("   4. Publicar el último resultado manualmente");
  console.log("   5. Verificar que auto-advance funciona (o probar botón manual)");
  console.log("=" .repeat(60));
}

main()
  .catch((err) => {
    console.error("❌ Error en seed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
