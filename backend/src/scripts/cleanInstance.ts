import "dotenv/config";
import { prisma } from "../db";

/**
 * Limpia completamente la instancia WC2026 y todas sus pools asociadas
 */
async function main() {
  console.log("🧹 Iniciando limpieza completa...\n");

  // 1. Buscar todas las instancias activas
  const instances = await prisma.tournamentInstance.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAtUtc: "desc" },
  });

  console.log(`📊 Encontradas ${instances.length} instancia(s) activa(s)\n`);

  for (const instance of instances) {
    console.log(`🗑️  Eliminando instancia: ${instance.name} (${instance.id})`);

    // Buscar todas las pools asociadas
    const pools = await prisma.pool.findMany({
      where: { tournamentInstanceId: instance.id },
    });

    console.log(`   📋 Pools asociadas: ${pools.length}`);

    // Eliminar cada pool y sus datos relacionados
    for (const pool of pools) {
      console.log(`      - Eliminando pool: ${pool.name}`);

      // Eliminar miembros
      await prisma.poolMember.deleteMany({ where: { poolId: pool.id } });

      // Eliminar predictions
      await prisma.prediction.deleteMany({ where: { poolId: pool.id } });

      // Eliminar resultados y sus versiones
      const results = await prisma.poolMatchResult.findMany({ where: { poolId: pool.id } });
      for (const result of results) {
        await prisma.poolMatchResultVersion.deleteMany({ where: { resultId: result.id } });
      }
      await prisma.poolMatchResult.deleteMany({ where: { poolId: pool.id } });

      // Eliminar audit events de la pool
      await prisma.auditEvent.deleteMany({ where: { poolId: pool.id } });

      // Eliminar invites
      await prisma.poolInvite.deleteMany({ where: { poolId: pool.id } });

      // Eliminar pool
      await prisma.pool.delete({ where: { id: pool.id } });
    }

    // Eliminar la instancia
    await prisma.tournamentInstance.delete({ where: { id: instance.id } });
    console.log(`   ✅ Instancia eliminada\n`);
  }

  console.log("✅ Limpieza completa terminada");
}

main()
  .catch((err) => {
    console.error("❌ Error en limpieza:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
