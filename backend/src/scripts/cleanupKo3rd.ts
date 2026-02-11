import { prisma } from "../db";

async function main() {
  await prisma.matchSyncState.deleteMany({
    where: {
      tournamentInstanceId: "wc2022-autotest-instance",
      internalMatchId: "ko_3rd",
    },
  });
  await prisma.matchExternalMapping.deleteMany({
    where: {
      tournamentInstanceId: "wc2022-autotest-instance",
      internalMatchId: "ko_3rd",
    },
  });
  console.log("ko_3rd mapping y sync state eliminados");

  const status = await prisma.matchSyncState.groupBy({
    by: ["syncStatus"],
    where: { tournamentInstanceId: "wc2022-autotest-instance" },
    _count: true,
  });
  console.log("\nEstado sync:");
  status.forEach((s) => console.log(`  ${s.syncStatus}: ${s._count}`));

  await prisma.$disconnect();
}

main();
