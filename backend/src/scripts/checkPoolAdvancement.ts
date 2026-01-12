/**
 * Script para diagnosticar el estado del advancement en una pool SIMPLE
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

  console.log("=== Pool:", pool.name, "===");
  console.log("autoAdvanceEnabled:", pool.autoAdvanceEnabled);
  console.log("Has fixtureSnapshot:", !!pool.fixtureSnapshot);

  // Check GroupStandingsResult
  const gsr = await prisma.groupStandingsResult.findMany({
    where: { poolId: pool.id }
  });
  console.log("GroupStandingsResult count:", gsr.length);
  if (gsr.length > 0) {
    console.log("Groups with results:", gsr.map(g => g.groupId).join(", "));
  }

  // Datos a usar (fixtureSnapshot tiene prioridad)
  const data = (pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson) as any;

  // Ver partidos R32
  const r32 = data.matches?.filter((m: any) => m.phaseId === "round_of_32") || [];
  console.log("\nR32 matches:", r32.length);
  if (r32.length > 0) {
    console.log("First 5 R32 matches:");
    r32.slice(0, 5).forEach((m: any) => {
      const home = data.teams?.find((t: any) => t.id === m.homeTeamId);
      const away = data.teams?.find((t: any) => t.id === m.awayTeamId);
      const homeResolved = home?.name ? "✅" : "❌";
      const awayResolved = away?.name ? "✅" : "❌";
      console.log(`  ${m.id}: ${homeResolved} ${m.homeTeamId} (${home?.name || "TBD"}) vs ${awayResolved} ${m.awayTeamId} (${away?.name || "TBD"})`);
    });
  }

  // Verificar cuántos grupos hay y cuántos tienen resultado
  const allGroups = [...new Set(data.teams?.map((t: any) => t.groupId).filter(Boolean))] as string[];
  console.log("\n=== Group Stage Status ===");
  console.log("Total groups:", allGroups.length);
  console.log("Groups with standings published:", gsr.length);
  console.log("Missing:", allGroups.filter(g => !gsr.some(r => r.groupId === g)).join(", ") || "None");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
