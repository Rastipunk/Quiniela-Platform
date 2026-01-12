/**
 * Script para verificar la fase Final en una pool
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

  const snapshot = pool.fixtureSnapshot as any;

  // Verificar todas las fases knockout
  const knockoutPhases = ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "finals"];

  for (const phaseId of knockoutPhases) {
    const phaseMatches = snapshot?.matches?.filter((m: any) => m.phaseId === phaseId) || [];
    console.log(`=== ${phaseId} (${phaseMatches.length} matches) ===`);

    phaseMatches.forEach((m: any) => {
      const home = snapshot?.teams?.find((t: any) => t.id === m.homeTeamId);
      const away = snapshot?.teams?.find((t: any) => t.id === m.awayTeamId);
      const homeResolved = home?.name ? "✅" : "❌";
      const awayResolved = away?.name ? "✅" : "❌";
      console.log(`  ${m.id}: ${homeResolved} ${m.homeTeamId} (${home?.name || "TBD"}) vs ${awayResolved} ${m.awayTeamId} (${away?.name || "TBD"})`);
    });
    console.log();
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
