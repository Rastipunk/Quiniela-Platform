import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Migration script: Set includeExtraTime=true for phases with existing results.
 *
 * Existing pool results were stored with homeGoals = total score (including ET).
 * Since we can't retroactively separate the 90-minute score for these results,
 * phases with published results must be locked to includeExtraTime=true.
 */

const prisma = new PrismaClient();

async function main() {
  // Find all pools with pickTypesConfig
  const pools = await prisma.pool.findMany({
    where: { pickTypesConfig: { not: null } },
    select: {
      id: true,
      name: true,
      pickTypesConfig: true,
    },
  });

  console.log(`Found ${pools.length} pools with pickTypesConfig\n`);

  let updated = 0;

  for (const pool of pools) {
    const phaseConfigs = pool.pickTypesConfig as any[];
    if (!Array.isArray(phaseConfigs)) continue;

    // Get all results for this pool
    const results = await prisma.poolMatchResult.findMany({
      where: { poolId: pool.id },
      select: { matchId: true, currentVersionId: true },
    });

    if (results.length === 0) {
      console.log(`  [${pool.name}] No results — skipping`);
      continue;
    }

    const matchIdsWithResults = new Set(
      results.filter((r) => r.currentVersionId).map((r) => r.matchId)
    );

    // Get tournament data to map matches → phases
    const poolFull = await prisma.pool.findUnique({
      where: { id: pool.id },
      select: {
        fixtureSnapshot: true,
        tournamentInstance: { select: { dataJson: true } },
      },
    });

    const dataJson = (poolFull?.fixtureSnapshot ?? poolFull?.tournamentInstance?.dataJson) as any;
    if (!dataJson?.phases) continue;

    // Build matchId → phaseId mapping
    const matchToPhase = new Map<string, string>();
    for (const phase of dataJson.phases) {
      for (const group of phase.groups ?? []) {
        for (const match of group.matches ?? []) {
          matchToPhase.set(match.id, phase.id);
        }
      }
    }

    // Find phases that have at least one result
    const phasesWithResults = new Set<string>();
    for (const matchId of matchIdsWithResults) {
      const phaseId = matchToPhase.get(matchId);
      if (phaseId) phasesWithResults.add(phaseId);
    }

    // Update config: set includeExtraTime=true for phases with results
    let changed = false;
    const updatedConfig = phaseConfigs.map((pc) => {
      if (phasesWithResults.has(pc.phaseId) && !pc.includeExtraTime) {
        changed = true;
        return { ...pc, includeExtraTime: true };
      }
      return pc;
    });

    if (changed) {
      await prisma.pool.update({
        where: { id: pool.id },
        data: { pickTypesConfig: updatedConfig as any },
      });
      updated++;
      const affected = [...phasesWithResults].join(", ");
      console.log(`  [${pool.name}] Updated phases: ${affected}`);
    } else {
      console.log(`  [${pool.name}] No changes needed`);
    }
  }

  console.log(`\nDone. Updated ${updated} pool(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
