/**
 * Script para inicializar los estados de Smart Sync para una instancia
 */

import { prisma } from "../db";
import { getSmartSyncService } from "../services/smartSync";

async function initSmartSyncStates() {
  const instanceId = process.argv[2] || "wc2022-autotest-instance";

  console.log(`\n🔄 Inicializando Smart Sync States para: ${instanceId}\n`);

  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: instanceId },
    include: { matchMappings: true },
  });

  if (!instance) {
    console.error("❌ Instance not found");
    process.exit(1);
  }

  console.log(`   Instance: ${instance.name}`);
  console.log(`   Mode: ${instance.resultSourceMode}`);
  console.log(`   Mappings: ${instance.matchMappings.length}`);

  const service = getSmartSyncService();
  const created = await service.initializeMatchSyncStates(instanceId);

  console.log(`\n✅ Inicializados ${created} estados de sincronización`);

  // Show status
  const status = await service.getSyncStatus(instanceId);
  console.log("\n📊 Estado actual:");
  console.log(`   PENDING: ${status.pending}`);
  console.log(`   IN_PROGRESS: ${status.inProgress}`);
  console.log(`   AWAITING_FINISH: ${status.awaitingFinish}`);
  console.log(`   COMPLETED: ${status.completed}`);
  console.log(`   SKIPPED: ${status.skipped}`);

  // Show next checks
  const nextChecks = await prisma.matchSyncState.findMany({
    where: {
      tournamentInstanceId: instanceId,
      syncStatus: "PENDING",
    },
    orderBy: { firstCheckAtUtc: "asc" },
    take: 5,
  });

  if (nextChecks.length > 0) {
    console.log("\n⏰ Próximos checks (PENDING):");
    nextChecks.forEach((m) => {
      console.log(
        `   ${m.internalMatchId}: kickoff ${m.kickoffUtc.toLocaleTimeString()}, ` +
          `first check ${m.firstCheckAtUtc?.toLocaleTimeString()}`
      );
    });
  }

  await prisma.$disconnect();
}

initSmartSyncStates()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
