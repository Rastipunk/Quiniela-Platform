import "dotenv/config";
import { prisma } from "../db";

async function main() {
  const pool = await prisma.pool.findFirst({
    where: { tournamentInstanceId: "ucl-2025-instance" },
    orderBy: { createdAtUtc: "desc" },
    select: { id: true, name: true, pickTypesConfig: true },
  });

  if (!pool) {
    console.log("No pool found");
    await prisma.$disconnect();
    return;
  }

  console.log(`Pool: "${pool.name}" (${pool.id})`);
  const config = pool.pickTypesConfig as any[];
  console.log(`Phases: ${config?.length ?? 0}`);
  config?.forEach((p: any) => {
    const enabled = p.matchPicks?.types
      ?.filter((t: any) => t.enabled)
      ?.map((t: any) => `${t.key}:${t.points}`);
    console.log(`  ${p.phaseId} - ${p.phaseName} - [${enabled?.join(", ")}]`);
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
