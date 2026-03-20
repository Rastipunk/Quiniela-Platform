/**
 * Phase Sync Job
 *
 * Runs every 12 hours to check if any pending phase syncs can be resolved.
 * When a knockout phase completes and the next phase's fixtures aren't yet
 * available in API-Football (e.g., draw not made yet), a PendingPhaseSync
 * record is created. This job retries those until resolved.
 *
 * Cost: 1 API call per pending phase per run = max ~2 calls/day.
 */

import * as cron from "node-cron";
import { prisma } from "../db";
import { syncNextPhaseFromApi } from "../services/adminInstanceService";
import { sendAdminNotification } from "../lib/email";

// Every 12 hours: at 08:00 and 20:00 UTC (3:00 AM and 3:00 PM Colombia)
const PHASE_SYNC_CRON = process.env.PHASE_SYNC_CRON || "0 8,20 * * *";

let scheduledTask: cron.ScheduledTask | null = null;

async function runPhaseSyncCheck(): Promise<void> {
  try {
    const pending = await prisma.pendingPhaseSync.findMany({
      where: { status: "PENDING" },
      include: { tournamentInstance: { select: { name: true } } },
    });

    if (pending.length === 0) return;

    console.log(`[PhaseSyncJob] Found ${pending.length} pending phase sync(s)`);

    for (const record of pending) {
      console.log(`[PhaseSyncJob] Retrying ${record.nextPhase} (${record.apiRoundName}) for ${record.tournamentInstance.name}`);

      const result = await syncNextPhaseFromApi(record.tournamentInstanceId, record.nextPhase);

      if (result.success) {
        await prisma.pendingPhaseSync.update({
          where: { id: record.id },
          data: {
            status: "RESOLVED",
            attempts: { increment: 1 },
            lastAttemptAtUtc: new Date(),
            resolvedAtUtc: new Date(),
            errorMessage: null,
          },
        });

        console.log(`[PhaseSyncJob] ✅ ${record.nextPhase} resolved! ${result.summary?.matchesUpdated} matches configured`);

        try {
          await sendAdminNotification({
            subject: `Phase Sync resuelto: ${record.nextPhase.toUpperCase()}`,
            body: `${record.apiRoundName} para ${record.tournamentInstance.name} fue configurado automáticamente desde API-Football.\n\nMatches: ${result.summary?.matchesUpdated}\nPools actualizados: ${result.summary?.poolsUpdated}\nIntentos totales: ${record.attempts + 1}`,
            type: "error",
          });
        } catch { /* best-effort */ }
      } else {
        const newAttempts = record.attempts + 1;

        // After 14 days (~28 attempts), mark as FAILED for manual intervention
        if (newAttempts >= 28) {
          await prisma.pendingPhaseSync.update({
            where: { id: record.id },
            data: {
              status: "FAILED",
              attempts: newAttempts,
              lastAttemptAtUtc: new Date(),
              errorMessage: `Gave up after ${newAttempts} attempts. Last: ${result.message}`,
            },
          });

          console.log(`[PhaseSyncJob] ❌ ${record.nextPhase} FAILED after ${newAttempts} attempts`);

          try {
            await sendAdminNotification({
              subject: `Phase Sync FALLIDO: ${record.nextPhase.toUpperCase()}`,
              body: `No se pudo configurar ${record.apiRoundName} para ${record.tournamentInstance.name} después de ${newAttempts} intentos.\n\nÚltimo error: ${result.message}\n\nSe requiere intervención manual.`,
              type: "error",
            });
          } catch { /* best-effort */ }
        } else {
          await prisma.pendingPhaseSync.update({
            where: { id: record.id },
            data: {
              attempts: newAttempts,
              lastAttemptAtUtc: new Date(),
              errorMessage: result.message,
            },
          });

          console.log(`[PhaseSyncJob] ${record.nextPhase} still pending (attempt ${newAttempts}): ${result.message}`);
        }
      }
    }
  } catch (error) {
    console.error("[PhaseSyncJob] Error:", error instanceof Error ? error.message : error);
  }
}

export function startPhaseSyncJob(): void {
  if (scheduledTask) return;

  scheduledTask = cron.schedule(PHASE_SYNC_CRON, async () => {
    await runPhaseSyncCheck();
  });

  console.log(`[PhaseSyncJob] Scheduled phase sync check: ${PHASE_SYNC_CRON} (every 12h)`);
}

export function stopPhaseSyncJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[PhaseSyncJob] Job stopped");
  }
}

/** Manual trigger for testing */
export async function triggerPhaseSyncCheck(): Promise<void> {
  await runPhaseSyncCheck();
}
