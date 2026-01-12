import { prisma } from "../db";

async function main() {
  console.log("🔄 Migrando pools existentes para agregar fixtureSnapshot...");

  const pools = await prisma.pool.findMany({
    include: { tournamentInstance: true },
  });

  // Filtrar solo las que no tienen fixtureSnapshot
  const poolsToMigrate = pools.filter(p => !p.fixtureSnapshot);

  console.log(`📊 Encontradas ${poolsToMigrate.length} pools sin fixtureSnapshot`);

  for (const pool of poolsToMigrate) {
    console.log(`  Migrando pool: ${pool.name} (${pool.id})`);
    
    await prisma.pool.update({
      where: { id: pool.id },
      data: {
        fixtureSnapshot: pool.tournamentInstance.dataJson,
      },
    });
  }

  console.log("✅ Migración completada!");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error en migración:", e);
  process.exit(1);
});
