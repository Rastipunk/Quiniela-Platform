import { prisma } from "../db";

async function main() {
  // Sync status summary
  const states = await prisma.matchSyncState.groupBy({
    by: ["syncStatus"],
    where: { tournamentInstanceId: "wc2022-autotest-instance" },
    _count: true,
  });
  console.log("Sync Status Summary:");
  states.forEach((s) => console.log(`  ${s.syncStatus}: ${s._count}`));

  // Total results
  const results = await prisma.poolMatchResult.count({
    where: { poolId: "wc2022-autotest-pool" },
  });
  console.log(`\nTotal results published: ${results}`);

  const versions = await prisma.poolMatchResultVersion.count({
    where: { result: { poolId: "wc2022-autotest-pool" } },
  });
  console.log(`Total result versions: ${versions}`);

  // Find all results
  const allResults = await prisma.poolMatchResultVersion.findMany({
    where: {
      result: { poolId: "wc2022-autotest-pool" },
    },
    select: {
      result: { select: { matchId: true } },
      homeGoals: true,
      awayGoals: true,
      homePenalties: true,
      awayPenalties: true,
    },
  });

  // Find draws
  const draws = allResults.filter((r) => r.homeGoals === r.awayGoals);
  console.log(`\nDraws found: ${draws.length}`);
  draws.forEach((d) => {
    const matchId = d.result.matchId;
    const isKnockout =
      matchId.startsWith("m_R16") ||
      matchId.startsWith("m_QF") ||
      matchId.startsWith("m_SF") ||
      matchId.startsWith("m_F");
    const pen =
      d.homePenalties !== null
        ? ` (PEN: ${d.homePenalties}-${d.awayPenalties})`
        : "";
    const phase = isKnockout ? "[KNOCKOUT]" : "[GROUP]";
    console.log(
      `  ${phase} ${matchId}: ${d.homeGoals}-${d.awayGoals}${pen}`
    );
  });

  // Sync log summary
  const syncLogs = await prisma.resultSyncLog.findMany({
    where: { tournamentInstanceId: "wc2022-autotest-instance" },
    orderBy: { startedAtUtc: "desc" },
    take: 5,
  });
  console.log(`\nRecent sync logs (last 5):`);
  syncLogs.forEach((log) => {
    console.log(
      `  ${log.startedAtUtc.toISOString()} - ${log.status} - checked: ${log.fixturesChecked}, updated: ${log.fixturesUpdated}`
    );
  });

  // Total API requests made
  const totalChecked = await prisma.resultSyncLog.aggregate({
    where: { tournamentInstanceId: "wc2022-autotest-instance" },
    _sum: { fixturesChecked: true, fixturesUpdated: true },
    _count: true,
  });
  console.log(`\nTotal sync runs: ${totalChecked._count}`);
  console.log(
    `Total API requests (fixtures checked): ${totalChecked._sum.fixturesChecked}`
  );
  console.log(
    `Total fixtures updated: ${totalChecked._sum.fixturesUpdated}`
  );

  await prisma.$disconnect();
}

main();
