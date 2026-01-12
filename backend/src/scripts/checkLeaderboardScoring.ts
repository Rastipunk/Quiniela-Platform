/**
 * Script para diagnosticar el scoring del leaderboard en pools SIMPLE
 */

import { prisma } from "../db";

async function main() {
  const poolId = process.argv[2] || "6613bf57-4d07-4852-8e9a-002cd0e84382";

  const pool = await prisma.pool.findFirst({
    where: { id: poolId }
  });

  if (!pool) {
    console.log("Pool no encontrada:", poolId);
    return;
  }

  console.log("=== Pool:", pool.name, "===\n");

  // 1. pickTypesConfig
  console.log("=== pickTypesConfig ===");
  const config = pool.pickTypesConfig as any[];
  config?.forEach(c => {
    console.log(`  ${c.phaseId}: ${c.structuralPicks?.type || "NO STRUCTURAL"} (requiresScore: ${c.requiresScore})`);
  });

  // 2. StructuralPhaseResult (para knockout)
  const structResults = await prisma.structuralPhaseResult.findMany({
    where: { poolId: pool.id }
  });
  console.log("\n=== StructuralPhaseResult (knockout results) ===");
  console.log("Count:", structResults.length);
  structResults.forEach(r => {
    const data = r.resultJson as any;
    console.log(`  ${r.phaseId}: ${data?.matches?.length || 0} matches`);
  });

  // 3. GroupStandingsResult (para grupos)
  const groupResults = await prisma.groupStandingsResult.findMany({
    where: { poolId: pool.id }
  });
  console.log("\n=== GroupStandingsResult (group results) ===");
  console.log("Count:", groupResults.length);
  const groupsByPhase = new Map<string, string[]>();
  groupResults.forEach(r => {
    const groups = groupsByPhase.get(r.phaseId) || [];
    groups.push(r.groupId);
    groupsByPhase.set(r.phaseId, groups);
  });
  groupsByPhase.forEach((groups, phaseId) => {
    console.log(`  ${phaseId}: ${groups.length} groups`);
  });

  // 4. StructuralPrediction (picks de usuarios)
  const preds = await prisma.structuralPrediction.findMany({
    where: { poolId: pool.id }
  });
  console.log("\n=== StructuralPrediction (user picks) ===");
  console.log("Count:", preds.length);
  const picksByPhase = new Map<string, number>();
  preds.forEach(p => {
    picksByPhase.set(p.phaseId, (picksByPhase.get(p.phaseId) || 0) + 1);
  });
  picksByPhase.forEach((count, phaseId) => {
    console.log(`  ${phaseId}: ${count} picks`);
  });

  // 5. GroupStandingsPrediction (picks de grupos)
  const groupPreds = await prisma.groupStandingsPrediction.findMany({
    where: { poolId: pool.id }
  });
  console.log("\n=== GroupStandingsPrediction (group picks) ===");
  console.log("Count:", groupPreds.length);
  const groupPicksByPhase = new Map<string, number>();
  groupPreds.forEach(p => {
    groupPicksByPhase.set(p.phaseId, (groupPicksByPhase.get(p.phaseId) || 0) + 1);
  });
  groupPicksByPhase.forEach((count, phaseId) => {
    console.log(`  ${phaseId}: ${count} group picks`);
  });

  // 6. Verificar si hay resultados de partidos para knockout
  const snapshot = (pool.fixtureSnapshot as any) || {};
  const knockoutPhases = ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"];

  console.log("\n=== PoolMatchResult por fase (para knockout scoring) ===");
  for (const phase of knockoutPhases) {
    const phaseMatches = snapshot.matches?.filter((m: any) => m.phaseId === phase) || [];
    if (phaseMatches.length === 0) continue;

    const matchIds = phaseMatches.map((m: any) => m.id);
    const results = await prisma.poolMatchResult.findMany({
      where: { poolId, matchId: { in: matchIds } },
      include: { currentVersion: true }
    });

    const withResult = results.filter(r => r.currentVersion).length;
    console.log(`  ${phase}: ${withResult}/${phaseMatches.length} matches with results`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
