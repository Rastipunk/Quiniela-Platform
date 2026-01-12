// backend/src/scripts/seedTestReview.ts
// Script de reset para revisión: Pool con 71/72 partidos publicados en fase de grupos
import "dotenv/config";
import { prisma } from "../db";
import { hashPassword } from "../lib/password";

/**
 * Estado final deseado:
 * - WC2026 template/version/instance activos
 * - 3 usuarios: admin, host, player
 * - 1 Pool llamada "Pool de Revisión" creada por host
 * - Host y Player son miembros
 * - 71/72 partidos de fase de grupos tienen resultado publicado
 * - Último partido (m_L_3_6) sin resultado
 * - Algunos picks del player publicados
 */

async function main() {
  console.log("🔄 Iniciando reset de estado de revisión...\n");

  // 1) Limpiar datos relacionados con pools anteriores
  console.log("🧹 Limpiando pools, predictions, results anteriores...");
  await prisma.prediction.deleteMany({});
  await prisma.poolMatchResultVersion.deleteMany({});
  await prisma.poolMatchResult.deleteMany({});
  await prisma.poolMember.deleteMany({});
  await prisma.poolInvite.deleteMany({});
  await prisma.pool.deleteMany({});
  await prisma.auditEvent.deleteMany({});

  // 2) Usuarios de prueba
  console.log("\n👥 Creando usuarios de prueba...");

  const adminEmail = process.env.TEST_ADMIN_EMAIL || "admin@test.com";
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || "admin123";
  const hostEmail = process.env.TEST_HOST_EMAIL || "host@test.com";
  const hostPassword = process.env.TEST_HOST_PASSWORD || "host123";
  const playerEmail = process.env.TEST_PLAYER_EMAIL || "player@test.com";
  const playerPassword = process.env.TEST_PLAYER_PASSWORD || "player123";

  const adminHash = await hashPassword(adminPassword);
  const hostHash = await hashPassword(hostPassword);
  const playerHash = await hashPassword(playerPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      displayName: "Admin QA",
      passwordHash: adminHash,
      platformRole: "ADMIN",
      status: "ACTIVE",
    },
    update: { passwordHash: adminHash, displayName: "Admin QA" },
  });

  const host = await prisma.user.upsert({
    where: { email: hostEmail },
    create: {
      email: hostEmail,
      displayName: "Host Revisor",
      passwordHash: hostHash,
      platformRole: "PLAYER",
      status: "ACTIVE",
    },
    update: { passwordHash: hostHash, displayName: "Host Revisor" },
  });

  const player = await prisma.user.upsert({
    where: { email: playerEmail },
    create: {
      email: playerEmail,
      displayName: "Player Prueba",
      passwordHash: playerHash,
      platformRole: "PLAYER",
      status: "ACTIVE",
    },
    update: { passwordHash: playerHash, displayName: "Player Prueba" },
  });

  console.log(`   ✅ Admin: ${admin.email}`);
  console.log(`   ✅ Host: ${host.email}`);
  console.log(`   ✅ Player: ${player.email}`);

  // 3) Obtener instance WC2026 Sandbox
  console.log("\n🏆 Buscando instance WC2026 Sandbox...");
  const instance = await prisma.tournamentInstance.findFirst({
    where: { name: "WC 2026 (Sandbox Instance)" },
  });

  if (!instance) {
    console.error("❌ No se encontró la instance WC2026. Ejecuta 'npm run seed:wc2026-sandbox' primero.");
    process.exit(1);
  }

  console.log(`   ✅ Instance: ${instance.name} (${instance.id})`);

  const templateData = instance.dataJson as any;
  const groupMatches = templateData.matches.filter((m: any) => m.phaseId === "group_stage");

  console.log(`   📊 Total partidos en fase de grupos: ${groupMatches.length}`);

  // 4) Crear Pool de Revisión
  console.log("\n🎱 Creando Pool de Revisión...");

  const pool = await prisma.pool.create({
    data: {
      name: "Pool de Revisión",
      tournamentInstanceId: instance.id,
      createdByUserId: host.id,
      visibility: "PRIVATE",
      timeZone: "America/Mexico_City",
      deadlineMinutesBeforeKickoff: 10,
      scoringPresetKey: "CLASSIC",
      autoAdvanceEnabled: true,
    },
  });

  console.log(`   ✅ Pool creada: ${pool.name} (ID: ${pool.id})`);

  // 5) Crear código de invitación
  const invite = await prisma.poolInvite.create({
    data: {
      poolId: pool.id,
      code: `REV-${Date.now().toString(36).toUpperCase()}`,
      createdByUserId: host.id,
    },
  });

  console.log(`   ✅ Código de invitación: ${invite.code}`);

  // 6) Membresías
  console.log("\n👫 Agregando miembros a la pool...");

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
      userId: player.id,
      role: "PLAYER",
      status: "ACTIVE",
    },
  });

  console.log(`   ✅ Host agregado`);
  console.log(`   ✅ Player agregado`);

  // 7) Publicar resultados para 71/72 partidos
  console.log(`\n📝 Publicando resultados para ${groupMatches.length - 1}/${groupMatches.length} partidos...`);

  const now = new Date();
  let publishedCount = 0;

  for (let i = 0; i < groupMatches.length - 1; i++) {
    const match = groupMatches[i];

    // Generar un resultado aleatorio simple
    const homeGoals = Math.floor(Math.random() * 4);
    const awayGoals = Math.floor(Math.random() * 4);

    // Crear PoolMatchResult header
    const matchResult = await prisma.poolMatchResult.create({
      data: {
        poolId: pool.id,
        matchId: match.id,
      },
    });

    // Crear versión inicial del resultado
    const resultVersion = await prisma.poolMatchResultVersion.create({
      data: {
        resultId: matchResult.id,
        versionNumber: 1,
        homeGoals,
        awayGoals,
        createdByUserId: host.id,
        publishedAtUtc: now,
      },
    });

    // Actualizar puntero a versión actual
    await prisma.poolMatchResult.update({
      where: { id: matchResult.id },
      data: { currentVersionId: resultVersion.id },
    });

    publishedCount++;
  }

  const lastMatch = groupMatches[groupMatches.length - 1];
  console.log(`   ✅ ${publishedCount} resultados publicados`);
  console.log(`   ⏳ Partido sin resultado: ${lastMatch.id} (${lastMatch.roundLabel})`);

  // 8) Crear algunos picks para el player
  console.log("\n🎯 Creando picks de prueba para player...");

  let picksCount = 0;
  for (let i = 0; i < Math.min(10, groupMatches.length); i++) {
    const match = groupMatches[i];

    await prisma.prediction.create({
      data: {
        poolId: pool.id,
        userId: player.id,
        matchId: match.id,
        pickJson: {
          type: "SCORE",
          homeGoals: Math.floor(Math.random() * 3),
          awayGoals: Math.floor(Math.random() * 3),
        },
      },
    });

    picksCount++;
  }

  console.log(`   ✅ ${picksCount} predictions creadas para player`);

  // 9) Resumen final
  console.log("\n" + "=".repeat(60));
  console.log("✅ ESTADO DE REVISIÓN LISTO");
  console.log("=".repeat(60));
  console.log("\n📋 CREDENCIALES:");
  console.log(`   Host: ${hostEmail} / ${hostPassword}`);
  console.log(`   Player: ${playerEmail} / ${playerPassword}`);
  console.log(`   Admin: ${adminEmail} / ${adminPassword}`);
  console.log("\n🎱 POOL:");
  console.log(`   Nombre: ${pool.name}`);
  console.log(`   Código: ${invite.code}`);
  console.log(`   ID: ${pool.id}`);
  console.log("\n📊 ESTADO:");
  console.log(`   Resultados publicados: ${publishedCount}/${groupMatches.length}`);
  console.log(`   Partido pendiente: ${lastMatch.id}`);
  console.log(`   Picks del player: ${picksCount}`);
  console.log("\n🚀 PRÓXIMO PASO:");
  console.log(`   1. Inicia el backend: cd backend && npm run dev`);
  console.log(`   2. Inicia el frontend: cd frontend && npm run dev`);
  console.log(`   3. Login como Host para publicar el último resultado`);
  console.log("\n" + "=".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Error en seedTestReview:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
