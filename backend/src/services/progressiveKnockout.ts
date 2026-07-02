/**
 * Progressive knockout opening (ADR-087).
 *
 * From round_of_16 onward the bracket is fully deterministic (each slot is
 * "winner/loser of match X"), so the moment a knockout match FINALIZES the
 * dependent slot(s) of the next phase resolve and predictions open for that
 * match — players don't wait for the whole round to end.
 *
 * This module is a thin orchestrator over the battle-tested ADR-084 release
 * machinery (single source of truth):
 *   - `getKnockoutBracketPreview` now chains W_/L_ resolution off majority
 *     FINAL results (knockoutBracketAdmin.ts), so…
 *   - …`setKnockoutPhaseReleased(true, {broadcast:false})` (first resolved
 *     match of a phase: bakes bracket into instance + pools and opens the
 *     ADR-084 gate — SILENTLY: owner policy 2026-07-02, the tab states
 *     announce the opening) and
 *   - …`propagateBracketToInstance/Pools` (subsequent matches: fill the newly
 *     resolved slots everywhere + mapping/sync plumbing via ADR-086)
 *   are the ONLY writers. Per-match prediction gating stays with the existing
 *   guards (MATCH_PENDING for placeholders, phase gate, deadlines).
 *
 * Scope: gate-enabled instances only (the WC). Legacy instances (gate off)
 * keep the per-pool phase-complete advancement flow untouched.
 * group_stage → round_of_32 is NOT handled here (best-thirds allocation needs
 * the admin review that ADR-084 was built for).
 */

import { prisma } from "../db";
import { extractMatches, extractPhases } from "../lib/fixture";
import { sendAdminNotification } from "../lib/email";
import { writeAuditEvent } from "../lib/audit";
import { createLimiter } from "../lib/asyncHelpers";
import { FINAL_RESULT_SOURCES } from "../lib/constants";
import {
  propagateBracketToInstance,
  propagateBracketToPools,
  setKnockoutPhaseReleased,
} from "./knockoutBracketAdmin";
import { sendPhaseCompletionNotifications } from "./advancementTrigger";

/** Once-per-(instance, phase) idempotency key for the completion recap. */
export const PHASE_COMPLETION_RECAP_ACTION = "PHASE_COMPLETION_RECAP_SENT";

/**
 * Pure: phases containing at least one match that feeds off `matchId`
 * (homeTeamId/awayTeamId === W_<suffix> or L_<suffix>). Normally the next
 * phase; for a semifinal it's the finals phase (m_FINAL via W_, m_3RD via L_).
 */
export function findDependentPhaseIds(
  matches: Array<{ id: string; phaseId: string; homeTeamId: string; awayTeamId: string }>,
  matchId: string,
): string[] {
  const suffix = matchId.replace(/^m_/, "");
  const refs = new Set([`W_${suffix}`, `L_${suffix}`]);
  const phaseIds = new Set<string>();
  for (const m of matches) {
    if (refs.has(m.homeTeamId) || refs.has(m.awayTeamId)) phaseIds.add(m.phaseId);
  }
  return [...phaseIds];
}

// Serialize resolver runs per instance — two matches finalizing close together
// (or finalize + master override) must not interleave propagation writes.
const inFlightByInstance = new Map<string, Promise<void>>();

/**
 * Entry point — call whenever a match reaches a FINAL result (scraper
 * finalization or admin master override). Cheap no-op for group-stage
 * matches, gate-off instances, and matches nothing depends on.
 */
export async function onKnockoutMatchFinalized(
  tournamentInstanceId: string,
  internalMatchId: string,
): Promise<void> {
  const prev = inFlightByInstance.get(tournamentInstanceId) ?? Promise.resolve();
  const run = prev
    .catch(() => undefined) // a failed predecessor must not wedge the chain
    .then(() => resolveDependents(tournamentInstanceId, internalMatchId));
  inFlightByInstance.set(tournamentInstanceId, run);
  try {
    await run;
  } finally {
    if (inFlightByInstance.get(tournamentInstanceId) === run) {
      inFlightByInstance.delete(tournamentInstanceId);
    }
  }
}

async function resolveDependents(
  tournamentInstanceId: string,
  internalMatchId: string,
): Promise<void> {
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: tournamentInstanceId },
    select: {
      dataJson: true,
      status: true,
      knockoutReleaseGateEnabled: true,
      releasedKnockoutPhases: true,
    },
  });
  if (!instance || instance.status !== "ACTIVE") return;
  if (!instance.knockoutReleaseGateEnabled) return; // legacy flow owns gate-off instances

  const phases = extractPhases(instance.dataJson);
  const matches = extractMatches(instance.dataJson);
  const finalized = matches.find((m) => m.id === internalMatchId);
  if (!finalized) return;
  const finalizedPhase = phases.find((p) => p.id === finalized.phaseId);
  if (!finalizedPhase || finalizedPhase.type === "GROUP") return; // group→R32 stays with ADR-084 review

  const dependentPhaseIds = findDependentPhaseIds(matches, internalMatchId);
  if (dependentPhaseIds.length === 0) return; // e.g. the final itself

  const released = new Set((instance.releasedKnockoutPhases as string[] | null) ?? []);

  for (const phaseId of dependentPhaseIds) {
    try {
      if (!released.has(phaseId)) {
        // First resolved match of the phase → release flow WITHOUT email:
        // bake bracket into instance + every pool and open the prediction
        // gate. The only player email is the completion recap below.
        const res = await setKnockoutPhaseReleased(tournamentInstanceId, phaseId, true, {
          broadcast: false, // owner policy: opening is SILENT (tabs tell the story)
        });
        console.log(
          `[ProgressiveKnockout] AUTO-RELEASED ${phaseId} (trigger=${internalMatchId}) ` +
            `pools=${res.poolsPropagated} broadcast=${res.broadcastStarted}`,
        );
      } else {
        // Phase already open → just fill the newly resolved slot(s)
        // everywhere (idempotent; ADR-086 plumbing runs inside).
        const inst = await propagateBracketToInstance(tournamentInstanceId, phaseId);
        const pools = await propagateBracketToPools(tournamentInstanceId, phaseId);
        console.log(
          `[ProgressiveKnockout] ${phaseId} updated (trigger=${internalMatchId}) ` +
            `instanceChanged=${inst.updated} poolsUpdated=${pools.poolsUpdated}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[ProgressiveKnockout] FAILED phase=${phaseId} trigger=${internalMatchId}:`,
        msg,
      );
      // A stalled opening is user-visible (players can't predict) — tell a
      // human immediately rather than waiting for complaints.
      sendAdminNotification({
        category: "error",
        subject: `Apertura progresiva falló: ${phaseId} (tras ${internalMatchId})`,
        body:
          `La resolución progresiva de <strong>${phaseId}</strong> tras finalizar ` +
          `<strong>${internalMatchId}</strong> falló: <code>${msg}</code>.<br><br>` +
          `Los jugadores no verán el cruce hasta que se resuelva. Reintento: el ` +
          `próximo partido finalizado de la fase re-dispara la propagación; también ` +
          `puedes propagar manualmente desde el panel de fases (/admin/fases).`,
      }).catch(() => undefined);
    }
  }

  // Completion recap — the ONLY player email of the progressive flow (owner
  // policy 2026-07-02): when the finalized match's OWN phase is now complete,
  // send the classic "Terminó la fase + tu resumen + top 10" to every pool.
  // The legacy path that used to send it (executeAdvancement) is blocked by
  // the release guard on progressive instances, so it fires from here.
  await maybeSendPhaseCompletionRecap(
    tournamentInstanceId,
    finalized.phaseId,
    matches.filter((m) => m.phaseId === finalized.phaseId).map((m) => m.id),
    Boolean(dependentPhaseIds.length) || hasLaterPhase(phases, finalized.phaseId),
  );
}

/** Any phase with a higher order than `phaseId` exists (mirror of the legacy
 *  rule: the FINAL phase never sends a completion recap — pool-completion
 *  emails own the end of the tournament). */
function hasLaterPhase(
  phases: Array<{ id: string; order: number }>,
  phaseId: string,
): boolean {
  const current = phases.find((p) => p.id === phaseId);
  if (!current) return false;
  return phases.some((p) => p.order > current.order);
}

async function maybeSendPhaseCompletionRecap(
  tournamentInstanceId: string,
  phaseId: string,
  phaseMatchIds: string[],
  hasNextPhase: boolean,
): Promise<void> {
  if (!hasNextPhase || phaseMatchIds.length === 0) return;

  // Complete = every match of the phase has a FINAL result (reference pool —
  // scraper finalization writes identically to all pools).
  const refPool = await prisma.pool.findFirst({
    where: { tournamentInstanceId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!refPool) return;
  const rows = await prisma.poolMatchResult.findMany({
    where: { poolId: refPool.id, matchId: { in: phaseMatchIds } },
    select: { matchId: true, currentVersion: { select: { source: true } } },
  });
  const finalCount = rows.filter(
    (r) => r.currentVersion && FINAL_RESULT_SOURCES.has(r.currentVersion.source),
  ).length;
  if (finalCount !== phaseMatchIds.length) return;

  // Once per (instance, phase) — claimed BEFORE the fanout so a concurrent
  // re-finalization can never double-email 5k users. Trade-off: a crash
  // mid-fanout won't retry (admin alert below covers it).
  const key = `${tournamentInstanceId}:${phaseId}`;
  const already = await prisma.auditEvent.findFirst({
    where: { action: PHASE_COMPLETION_RECAP_ACTION, entityId: key },
    select: { id: true },
  });
  if (already) return;
  await writeAuditEvent({
    actorUserId: null,
    action: PHASE_COMPLETION_RECAP_ACTION,
    entityType: "TournamentInstance",
    entityId: key,
    dataJson: { tournamentInstanceId, phaseId, matches: phaseMatchIds.length },
  });

  const pools = await prisma.pool.findMany({
    where: { tournamentInstanceId, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  console.log(
    `[ProgressiveKnockout] Phase ${phaseId} COMPLETE — sending completion recap to ${pools.length} pools`,
  );
  const limit = createLimiter(3);
  let failedPools = 0;
  await Promise.all(
    pools.map((pool) =>
      limit(() =>
        sendPhaseCompletionNotifications(pool.id, phaseId, pool.name).catch((err) => {
          failedPools++;
          console.error(
            `[ProgressiveKnockout] completion recap failed pool=${pool.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }),
      ),
    ),
  );
  if (failedPools > 0) {
    sendAdminNotification({
      category: "error",
      subject: `Recap de cierre de ${phaseId}: ${failedPools} pools fallaron`,
      body:
        `El envío del resumen de cierre de <strong>${phaseId}</strong> falló en ` +
        `<strong>${failedPools}</strong> pools (ver logs). El marcador de idempotencia ya ` +
        `quedó puesto — para reenviar a las pools fallidas hay que hacerlo manualmente.`,
    }).catch(() => undefined);
  }
}
