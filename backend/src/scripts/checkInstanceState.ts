import "dotenv/config";
import { prisma } from "../db";

async function main() {
  const instance = await prisma.tournamentInstance.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAtUtc: "desc" },
  });

  if (!instance) {
    console.log("❌ No instance found");
    return;
  }

  const data = instance.dataJson as any;
  const r32Matches = data.matches.filter((m: any) => m.phaseId === "round_of_32");

  console.log("📊 Instance:", instance.name);
  console.log("📊 Round of 32 matches:", r32Matches.length);
  console.log("📊 First R32 match:");
  console.log("   homeTeamId:", r32Matches[0]?.homeTeamId);
  console.log("   awayTeamId:", r32Matches[0]?.awayTeamId);

  const isPlaceholder =
    r32Matches[0]?.homeTeamId?.startsWith("winner_group_") ||
    r32Matches[0]?.homeTeamId?.startsWith("runner_up_group_");
  console.log("   Is placeholder?", isPlaceholder);

  // Check pool results
  const pool = await prisma.pool.findFirst({
    where: { name: "E2E Test Pool - Auto Advance" },
  });

  if (!pool) {
    console.log("❌ Pool not found");
    return;
  }

  const results = await prisma.poolMatchResult.findMany({
    where: {
      poolId: pool.id,
      currentVersion: { isNot: null },
    },
  });

  console.log("\n📊 Pool results count:", results.length);

  const groupResults = await prisma.poolMatchResult.findMany({
    where: {
      poolId: pool.id,
      currentVersion: { isNot: null },
      matchId: { in: data.matches.filter((m: any) => m.phaseId === "group_stage").map((m: any) => m.id) },
    },
  });

  console.log("📊 Group stage results:", groupResults.length, "/ 72");
}

main()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
