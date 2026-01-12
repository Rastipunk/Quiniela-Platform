/**
 * Script para actualizar pickTypesConfig de una pool con preset SIMPLE
 * Agrega la fase round_of_32 que faltaba
 *
 * Uso: npx tsx src/scripts/updatePoolPickTypesConfig.ts <poolId>
 */

import { prisma } from "../db";
import { getPresetByKey } from "../lib/pickPresets";

async function main() {
  const poolId = process.argv[2];

  if (!poolId) {
    console.error("Usage: npx tsx src/scripts/updatePoolPickTypesConfig.ts <poolId>");
    console.error("\nPara ver todas las pools con preset SIMPLE:");

    const pools = await prisma.pool.findMany({
      where: {
        pickTypesConfig: { not: null }
      },
      select: {
        id: true,
        name: true,
        pickTypesConfig: true,
      }
    });

    console.log("\nPools con pickTypesConfig:");
    for (const pool of pools) {
      const config = pool.pickTypesConfig as any[];
      const hasRoundOf32 = config?.some((c: any) => c.phaseId === "round_of_32");
      console.log(`  - ${pool.id}: ${pool.name} (round_of_32: ${hasRoundOf32 ? "SI" : "NO"})`);
    }

    process.exit(1);
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      name: true,
      pickTypesConfig: true,
    }
  });

  if (!pool) {
    console.error(`Pool not found: ${poolId}`);
    process.exit(1);
  }

  console.log(`Pool: ${pool.name} (${pool.id})`);
  console.log("Current pickTypesConfig phases:",
    (pool.pickTypesConfig as any[])?.map((c: any) => c.phaseId).join(", "));

  // Obtener la configuración actualizada del preset SIMPLE
  const preset = getPresetByKey("SIMPLE");
  if (!preset) {
    console.error("SIMPLE preset not found");
    process.exit(1);
  }

  console.log("\nNew pickTypesConfig phases:",
    preset.config.map((c: any) => c.phaseId).join(", "));

  // Actualizar
  await prisma.pool.update({
    where: { id: poolId },
    data: {
      pickTypesConfig: preset.config as any,
    }
  });

  console.log("\n✅ Pool updated successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
