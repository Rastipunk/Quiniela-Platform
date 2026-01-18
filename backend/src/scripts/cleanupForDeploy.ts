/**
 * Script de limpieza para deploy
 * Elimina todos los usuarios y pools excepto los 3 usuarios de prueba
 *
 * Usuarios de prueba a conservar:
 * - quiniela.admin@example.com
 * - quiniela.host@example.com
 * - quiniela.player@example.com
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_USERS_TO_KEEP = [
  "quiniela.admin@example.com",
  "quiniela.host@example.com",
  "quiniela.player@example.com",
];

async function cleanupForDeploy() {
  console.log("🧹 Iniciando limpieza de base de datos para deploy...\n");

  // 1. Listar usuarios que se conservarán
  const testUsers = await prisma.user.findMany({
    where: { email: { in: TEST_USERS_TO_KEEP } },
    select: { id: true, email: true, username: true, displayName: true },
  });

  console.log("✅ Usuarios de prueba que se conservarán:");
  testUsers.forEach((u) => {
    console.log(`   - ${u.email} (${u.displayName})`);
  });

  const testUserIds = testUsers.map((u) => u.id);

  if (testUserIds.length !== 3) {
    console.error("\n❌ Error: No se encontraron los 3 usuarios de prueba esperados.");
    console.log("   Encontrados:", testUsers.length);
    console.log("   Esperados:", TEST_USERS_TO_KEEP);
    process.exit(1);
  }

  // 2. Contar registros antes de eliminar
  const countsBefore = {
    pools: await prisma.pool.count(),
    poolMembers: await prisma.poolMember.count(),
    poolInvites: await prisma.poolInvite.count(),
    predictions: await prisma.prediction.count(),
    structuralPredictions: await prisma.structuralPrediction.count(),
    groupStandingsPredictions: await prisma.groupStandingsPrediction.count(),
    poolMatchResults: await prisma.poolMatchResult.count(),
    poolMatchResultVersions: await prisma.poolMatchResultVersion.count(),
    structuralPhaseResults: await prisma.structuralPhaseResult.count(),
    groupStandingsResults: await prisma.groupStandingsResult.count(),
    users: await prisma.user.count(),
    auditEvents: await prisma.auditEvent.count(),
  };

  console.log("\n📊 Registros actuales (antes de limpieza):");
  Object.entries(countsBefore).forEach(([key, count]) => {
    console.log(`   ${key}: ${count}`);
  });

  // 3. Eliminar en orden correcto (respetando foreign keys)
  console.log("\n🗑️ Eliminando registros...\n");

  // 3.1 Eliminar PoolMatchResultVersions (depende de PoolMatchResult y User)
  const deletedResultVersions = await prisma.poolMatchResultVersion.deleteMany({});
  console.log(`   PoolMatchResultVersions eliminados: ${deletedResultVersions.count}`);

  // 3.2 Eliminar PoolMatchResults (depende de Pool)
  const deletedResults = await prisma.poolMatchResult.deleteMany({});
  console.log(`   PoolMatchResults eliminados: ${deletedResults.count}`);

  // 3.3 Eliminar Predictions (depende de Pool y User)
  const deletedPredictions = await prisma.prediction.deleteMany({});
  console.log(`   Predictions eliminados: ${deletedPredictions.count}`);

  // 3.4 Eliminar StructuralPredictions (depende de Pool y User)
  const deletedStructuralPredictions = await prisma.structuralPrediction.deleteMany({});
  console.log(`   StructuralPredictions eliminados: ${deletedStructuralPredictions.count}`);

  // 3.5 Eliminar GroupStandingsPredictions (depende de Pool y User)
  const deletedGroupStandingsPredictions = await prisma.groupStandingsPrediction.deleteMany({});
  console.log(`   GroupStandingsPredictions eliminados: ${deletedGroupStandingsPredictions.count}`);

  // 3.6 Eliminar StructuralPhaseResults (depende de Pool y User)
  const deletedStructuralPhaseResults = await prisma.structuralPhaseResult.deleteMany({});
  console.log(`   StructuralPhaseResults eliminados: ${deletedStructuralPhaseResults.count}`);

  // 3.7 Eliminar GroupStandingsResults (depende de Pool y User)
  const deletedGroupStandingsResults = await prisma.groupStandingsResult.deleteMany({});
  console.log(`   GroupStandingsResults eliminados: ${deletedGroupStandingsResults.count}`);

  // 3.8 Eliminar PoolInvites (depende de Pool y User)
  const deletedInvites = await prisma.poolInvite.deleteMany({});
  console.log(`   PoolInvites eliminados: ${deletedInvites.count}`);

  // 3.9 Eliminar PoolMembers (depende de Pool y User)
  const deletedMembers = await prisma.poolMember.deleteMany({});
  console.log(`   PoolMembers eliminados: ${deletedMembers.count}`);

  // 3.10 Eliminar Pools
  const deletedPools = await prisma.pool.deleteMany({});
  console.log(`   Pools eliminados: ${deletedPools.count}`);

  // 3.11 Eliminar AuditEvents (independiente)
  const deletedAuditEvents = await prisma.auditEvent.deleteMany({});
  console.log(`   AuditEvents eliminados: ${deletedAuditEvents.count}`);

  // 3.12 Eliminar usuarios excepto los de prueba
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { notIn: testUserIds } },
  });
  console.log(`   Users eliminados: ${deletedUsers.count}`);

  // 4. Verificar estado final
  const countsAfter = {
    pools: await prisma.pool.count(),
    poolMembers: await prisma.poolMember.count(),
    poolInvites: await prisma.poolInvite.count(),
    predictions: await prisma.prediction.count(),
    structuralPredictions: await prisma.structuralPrediction.count(),
    groupStandingsPredictions: await prisma.groupStandingsPrediction.count(),
    poolMatchResults: await prisma.poolMatchResult.count(),
    poolMatchResultVersions: await prisma.poolMatchResultVersion.count(),
    structuralPhaseResults: await prisma.structuralPhaseResult.count(),
    groupStandingsResults: await prisma.groupStandingsResult.count(),
    users: await prisma.user.count(),
    auditEvents: await prisma.auditEvent.count(),
  };

  console.log("\n📊 Registros finales (después de limpieza):");
  Object.entries(countsAfter).forEach(([key, count]) => {
    console.log(`   ${key}: ${count}`);
  });

  // 5. Verificar que los templates e instances siguen intactos
  const templateCount = await prisma.tournamentTemplate.count();
  const instanceCount = await prisma.tournamentInstance.count();
  const versionCount = await prisma.tournamentTemplateVersion.count();

  console.log("\n✅ Templates e Instances (NO eliminados - verificación):");
  console.log(`   TournamentTemplates: ${templateCount}`);
  console.log(`   TournamentTemplateVersions: ${versionCount}`);
  console.log(`   TournamentInstances: ${instanceCount}`);

  console.log("\n✨ Limpieza completada exitosamente!");
  console.log("   Los 3 usuarios de prueba han sido conservados.");
  console.log("   Los templates e instances están intactos.");
}

cleanupForDeploy()
  .catch((e) => {
    console.error("Error durante la limpieza:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
