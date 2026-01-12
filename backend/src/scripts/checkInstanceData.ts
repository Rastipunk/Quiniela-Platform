import { prisma } from "../db";

async function main() {
  const instance = await prisma.tournamentInstance.findFirst({
    where: { name: { contains: "WC 2026" } },
    select: { id: true, name: true, dataJson: true }
  });

  if (!instance) {
    console.log("No instance found");
    return;
  }

  const data = instance.dataJson as any;
  const r32Matches = data.matches?.filter((m: any) => m.phaseId === "round_of_32") || [];
  
  console.log("=== Round of 32 Matches (first 3) ===");
  r32Matches.slice(0, 3).forEach((m: any) => {
    console.log(`${m.id}: ${m.homeTeamId} vs ${m.awayTeamId}`);
  });

  process.exit(0);
}

main();
