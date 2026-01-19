// Script para configurar escenario de prueba de notificaciones
// Modifica la pool "Los 10" para tener:
// - 2 partidos de cuartos con deadline en 6 horas (sin picks para algunos usuarios)
// - 1 solicitud de join pendiente
// - 1 fase lista para avanzar (si aplica)

import "dotenv/config";
import { prisma } from "../db";
import { hashPassword } from "../lib/password";

async function main() {
  console.log("🔔 Configurando escenario de prueba de notificaciones...\n");

  // 1. Buscar la pool de prueba
  const pool = await prisma.pool.findFirst({
    where: { name: "Pool de Prueba WC2026" },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    throw new Error("❌ No se encontró la pool 'Pool de Prueba WC2026'. Ejecuta primero seedFullTestScenario.ts");
  }

  console.log(`✓ Pool encontrada: ${pool.id}`);

  // 2. Modificar fixture para que 2 partidos de cuartos tengan deadline en ~6 horas
  const now = new Date();
  const in6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000 + 10 * 60 * 1000); // 6h + 10min (para que deadline sea en 6h)
  const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000 + 10 * 60 * 1000);
  const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const fixtureData = pool.fixtureSnapshot as any;

  const modifiedMatches = fixtureData.matches.map((m: any) => {
    // Poner m_QF_1 y m_QF_2 con kickoff en 6 y 12 horas
    if (m.id === "m_QF_1") {
      return { ...m, kickoffUtc: in6Hours.toISOString() };
    }
    if (m.id === "m_QF_2") {
      return { ...m, kickoffUtc: in12Hours.toISOString() };
    }
    // Semifinales y final en el futuro lejano
    if (m.phaseId === "semi_finals" || m.phaseId === "finals" || m.phaseId === "third_place") {
      return { ...m, kickoffUtc: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() };
    }
    // El resto en el pasado
    return { ...m, kickoffUtc: pastDate.toISOString() };
  });

  await prisma.pool.update({
    where: { id: pool.id },
    data: {
      fixtureSnapshot: { ...fixtureData, matches: modifiedMatches },
    },
  });

  console.log("✓ Kickoffs actualizados:");
  console.log(`   - m_QF_1: deadline en ~6 horas`);
  console.log(`   - m_QF_2: deadline en ~12 horas`);

  // 3. Eliminar picks de algunos usuarios para m_QF_1 y m_QF_2
  // Buscar usuarios
  const members = await prisma.poolMember.findMany({
    where: { poolId: pool.id, status: "ACTIVE" },
    include: { user: true },
    orderBy: { joinedAtUtc: "asc" },
  });

  // Eliminar picks de m_QF_1 y m_QF_2 para los primeros 3 jugadores (no el host)
  const playersToRemovePicks = members.filter(m => m.role !== "HOST").slice(0, 3);

  for (const member of playersToRemovePicks) {
    await prisma.prediction.deleteMany({
      where: {
        poolId: pool.id,
        userId: member.userId,
        matchId: { in: ["m_QF_1", "m_QF_2"] },
      },
    });
    console.log(`✓ Picks eliminados para ${(member as any).user.displayName} en m_QF_1 y m_QF_2`);
  }

  // 4. Eliminar resultados de m_QF_1 y m_QF_2 (para que el host vea "partidos sin resultado")
  await prisma.poolMatchResultVersion.deleteMany({
    where: {
      result: {
        poolId: pool.id,
        matchId: { in: ["m_QF_1", "m_QF_2"] },
      },
    },
  });
  await prisma.poolMatchResult.deleteMany({
    where: {
      poolId: pool.id,
      matchId: { in: ["m_QF_1", "m_QF_2"] },
    },
  });
  console.log("✓ Resultados eliminados de m_QF_1 y m_QF_2");

  // 5. Crear un usuario pendiente de aprobación
  const pendingUserEmail = "pending@quiniela.test";
  let pendingUser = await prisma.user.findUnique({ where: { email: pendingUserEmail } });

  if (!pendingUser) {
    pendingUser = await prisma.user.create({
      data: {
        email: pendingUserEmail,
        username: "pending_user",
        displayName: "Usuario Pendiente",
        passwordHash: await hashPassword("Test1234!"),
        platformRole: "PLAYER",
        status: "ACTIVE",
      },
    });
    console.log("✓ Usuario pendiente creado: pending@quiniela.test");
  }

  // Verificar si ya existe membership
  const existingMembership = await prisma.poolMember.findFirst({
    where: { poolId: pool.id, userId: pendingUser.id },
  });

  if (existingMembership) {
    // Actualizar a PENDING
    await prisma.poolMember.update({
      where: { id: existingMembership.id },
      data: { status: "PENDING_APPROVAL" },
    });
  } else {
    // Crear nuevo
    await prisma.poolMember.create({
      data: {
        poolId: pool.id,
        userId: pendingUser.id,
        role: "PLAYER",
        status: "PENDING_APPROVAL",
      },
    });
  }
  console.log("✓ Solicitud de join pendiente creada");

  // 6. Habilitar requireApproval en la pool
  await prisma.pool.update({
    where: { id: pool.id },
    data: { requireApproval: true },
  });
  console.log("✓ Pool configurada para requerir aprobación");

  // Resumen
  console.log("\n" + "═".repeat(60));
  console.log("✅ ESCENARIO DE NOTIFICACIONES CONFIGURADO");
  console.log("═".repeat(60));
  console.log("\n📋 NOTIFICACIONES QUE VERÁS:");
  console.log("\n👤 Como PLAYER (ej: player1@quiniela.test):");
  console.log("   - Badge en 'Partidos' con 2 (picks pendientes urgentes)");
  console.log("   - Banner: '2 partidos sin pick que cierran en las próximas horas (2 en Cuartos de Final)'");

  console.log("\n👑 Como HOST (host@quiniela.test):");
  console.log("   - Badge en 'Partidos' (si no tiene picks)");
  console.log("   - Badge en 'Administración' con 1 (solicitud pendiente)");
  console.log("   - Banner en Admin: 'Tienes 1 solicitud de ingreso pendiente'");

  console.log("\n🔑 CREDENCIALES:");
  console.log("   - Host: host@quiniela.test / Test1234!");
  console.log("   - Player sin picks: player1@quiniela.test / Test1234!");
  console.log("   - Usuario pendiente: pending@quiniela.test / Test1234!");
}

main()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
