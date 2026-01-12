/**
 * Script para verificar pools con configuración personalizada
 */

import { prisma } from "../db";

async function main() {
  // Buscar pools recientes con pickTypesConfig
  const pools = await prisma.pool.findMany({
    where: { pickTypesConfig: { not: null } },
    orderBy: { createdAtUtc: "desc" },
    take: 10,
    select: { id: true, name: true, pickTypesConfig: true, createdAtUtc: true }
  });

  for (const pool of pools) {
    console.log("=== Pool:", pool.name, "===");
    console.log("ID:", pool.id);
    console.log("Created:", pool.createdAtUtc);
    const config = pool.pickTypesConfig as any[];
    config?.forEach((c, i) => {
      const type = c.structuralPicks?.type || (c.requiresScore ? "MATCH_SCORE" : "UNKNOWN");
      console.log(`  Phase ${i + 1}: ${c.phaseId} (${c.phaseName})`);
      console.log(`    Type: ${type} | requiresScore: ${c.requiresScore}`);
      if (c.structuralPicks) {
        console.log(`    structuralPicks.type: ${c.structuralPicks.type}`);
        console.log(`    config:`, JSON.stringify(c.structuralPicks.config));
      }
      if (c.matchPicks) {
        const enabledTypes = c.matchPicks.types?.filter((t: any) => t.enabled).map((t: any) => t.key);
        console.log(`    matchPicks enabled:`, enabledTypes?.join(", "));
      }
    });
    console.log("");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
