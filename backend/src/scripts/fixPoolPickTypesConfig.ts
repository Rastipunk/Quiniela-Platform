/**
 * Fixes pickTypesConfig for pools that were created with a preset key string,
 * which resulted in hardcoded phaseIds that don't match the actual tournament data.
 *
 * Usage: npx tsx src/scripts/fixPoolPickTypesConfig.ts
 */
import "dotenv/config";
import { prisma } from "../db";
import { generateDynamicPresetConfig } from "../lib/pickPresets";

async function main() {
  // Find all pools that have pickTypesConfig with mismatched phaseIds
  const pools = await prisma.pool.findMany({
    where: {
      pickTypesConfig: { not: null },
    },
    include: {
      tournamentInstance: true,
    },
  });

  console.log(`Found ${pools.length} pools with pickTypesConfig`);

  let fixedCount = 0;

  for (const pool of pools) {
    const pickTypesConfig = pool.pickTypesConfig as any[];
    if (!pickTypesConfig || !Array.isArray(pickTypesConfig) || pickTypesConfig.length === 0) {
      continue;
    }

    // Get instance phases
    const dataJson = pool.fixtureSnapshot ?? pool.tournamentInstance?.dataJson;
    const instancePhases: Array<{ id: string; name: string; type: string }> =
      (dataJson as any)?.phases ?? [];

    if (instancePhases.length === 0) {
      console.log(`  ⚠️ Pool "${pool.name}" (${pool.id}): no phases in instance data, skipping`);
      continue;
    }

    // Check if phaseIds match
    const configPhaseIds = new Set(pickTypesConfig.map((p: any) => p.phaseId));
    const instancePhaseIds = new Set(instancePhases.map((p) => p.id));

    const hasMatch = [...configPhaseIds].some((id) => instancePhaseIds.has(id));

    if (hasMatch) {
      console.log(`  ✅ Pool "${pool.name}" (${pool.id}): phaseIds already match, skipping`);
      continue;
    }

    // PhaseIds don't match — detect the preset type and regenerate
    console.log(`  🔧 Pool "${pool.name}" (${pool.id}): phaseId MISMATCH detected`);
    console.log(`     Config phaseIds: ${[...configPhaseIds].join(", ")}`);
    console.log(`     Instance phaseIds: ${[...instancePhaseIds].join(", ")}`);

    // Detect preset type from the config
    const firstPhase = pickTypesConfig[0];
    let presetKey: string | null = null;

    if (firstPhase.requiresScore && firstPhase.matchPicks) {
      const enabledTypes = firstPhase.matchPicks.types?.filter((t: any) => t.enabled) ?? [];
      const hasCumulativeTypes = enabledTypes.some(
        (t: any) => t.key === "HOME_GOALS" || t.key === "AWAY_GOALS"
      );
      const hasExactScore = enabledTypes.some((t: any) => t.key === "EXACT_SCORE");

      if (hasCumulativeTypes) {
        presetKey = "CUMULATIVE";
      } else if (hasExactScore) {
        presetKey = "BASIC";
      }
    } else if (!firstPhase.requiresScore && firstPhase.structuralPicks) {
      presetKey = "SIMPLE";
    }

    if (!presetKey) {
      console.log(`     ❌ Could not detect preset type, skipping`);
      continue;
    }

    console.log(`     Detected preset: ${presetKey}`);

    // Generate dynamic config with correct phaseIds
    const newConfig = generateDynamicPresetConfig(presetKey, instancePhases);
    if (!newConfig) {
      console.log(`     ❌ Failed to generate dynamic config, skipping`);
      continue;
    }

    // Update the pool
    await prisma.pool.update({
      where: { id: pool.id },
      data: { pickTypesConfig: newConfig as any },
    });

    console.log(`     ✅ Updated pickTypesConfig with ${newConfig.length} phases`);
    fixedCount++;
  }

  console.log(`\nDone. Fixed ${fixedCount} pool(s).`);
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
