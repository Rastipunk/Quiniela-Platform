/**
 * Script para verificar el template original vs fixtureSnapshot
 */

import { prisma } from "../db";

async function main() {
  const poolId = process.argv[2] || "6613bf57-4d07-4852-8e9a-002cd0e84382";

  const pool = await prisma.pool.findFirst({
    where: { id: poolId },
    include: { tournamentInstance: true }
  });

  if (!pool) {
    console.log("Pool no encontrada:", poolId);
    return;
  }

  console.log("=== Pool:", pool.name, "===\n");

  const instanceData = pool.tournamentInstance.dataJson as any;
  const snapshotData = pool.fixtureSnapshot as any;

  // Verificar partidos de finals en el template original
  const originalFinalMatches = instanceData?.matches?.filter((m: any) => m.phaseId === "finals") || [];
  console.log("=== Finals matches in ORIGINAL tournamentInstance.dataJson ===");
  console.log("Count:", originalFinalMatches.length);
  originalFinalMatches.forEach((m: any) => {
    console.log(`  ${m.id}: ${m.homeTeamId} vs ${m.awayTeamId}`);
  });

  // Verificar partidos de finals en snapshot
  const snapshotFinalMatches = snapshotData?.matches?.filter((m: any) => m.phaseId === "finals") || [];
  console.log("\n=== Final matches in fixtureSnapshot ===");
  console.log("Count:", snapshotFinalMatches.length);
  snapshotFinalMatches.forEach((m: any) => {
    console.log(`  ${m.id}: ${m.homeTeamId} vs ${m.awayTeamId}`);
  });

  // Verificar todas las fases en el template original
  console.log("\n=== All phases in ORIGINAL template ===");
  const phases = instanceData?.phases || [];
  phases.forEach((p: any) => {
    const matchCount = instanceData?.matches?.filter((m: any) => m.phaseId === p.id).length || 0;
    console.log(`  ${p.id}: ${p.name} (${matchCount} matches)`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
