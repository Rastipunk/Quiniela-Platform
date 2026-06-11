/**
 * Stale-match detector.
 *
 * The scores service deliberately never closes a match by time — that is
 * our responsibility (FOR-PICKS4ALL-INTEGRATION §3). A match that should
 * have ended long ago but whose sync state is still not COMPLETED was the
 * silent failure behind the 30-may final (SCORING_RESULTS_AUDIT §8): the
 * result sat as SCRAPER_PROVISIONAL forever with nobody alerted.
 *
 * This module scans for such matches and notifies the team exactly once
 * per match (idempotent via an audit event), so a human can override /
 * investigate.
 *
 * ⚠️ THIS ALERT IS THE LAST LINE OF DEFENSE — there is NO automatic
 * recovery path behind it. API-Football is no longer used (smartSync is
 * inert), so a stale match is resolved by exactly one thing: a human
 * acting on this alert (host override / investigation). If this email
 * goes nowhere, nothing closes the match. Keep the recipient list alive.
 */

import { MatchSyncStatus } from "@prisma/client";
import { prisma } from "../../db";
import { SCORES } from "../../lib/constants";
import { sendAdminNotification } from "../../lib/email";
import { writeAuditEvent } from "../../lib/audit";

/** Audit action used as the once-per-match idempotency key for alerts. */
export const MATCH_STALE_ALERT_ACTION = "MATCH_STALE_DETECTED";

/** Sync states that mean the match has NOT been finalized yet. */
const UNFINALIZED_SYNC_STATUSES: MatchSyncStatus[] = [
  MatchSyncStatus.PENDING,
  MatchSyncStatus.IN_PROGRESS,
  MatchSyncStatus.AWAITING_FINISH,
];

/**
 * Pure predicate: has the match been going long enough past its kickoff
 * that it should have finished (90' + HT + stoppage + full ET + penalties
 * + margin)?
 */
export function isMatchStale(
  kickoffUtc: Date,
  now: Date,
  thresholdMs: number = SCORES.STALE_THRESHOLD_MS,
): boolean {
  return now.getTime() - kickoffUtc.getTime() > thresholdMs;
}

/** Stable dedupe key so we alert once per (instance, match). */
function dedupeKey(tournamentInstanceId: string, internalMatchId: string): string {
  return `${tournamentInstanceId}:${internalMatchId}`;
}

/**
 * Find AUTO-mode matches that are past the stale threshold but whose sync
 * state never reached COMPLETED, and send a one-time admin alert for each.
 *
 * @returns number of NEW alerts sent this run.
 */
export async function detectAndAlertStaleMatches(
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - SCORES.STALE_THRESHOLD_MS);

  const stale = await prisma.matchSyncState.findMany({
    where: {
      kickoffUtc: { lt: cutoff },
      syncStatus: { in: UNFINALIZED_SYNC_STATUSES },
      tournamentInstance: {
        resultSourceMode: "AUTO",
        syncEnabled: true,
        status: "ACTIVE",
      },
    },
    select: {
      tournamentInstanceId: true,
      internalMatchId: true,
      kickoffUtc: true,
      lastApiStatus: true,
      syncStatus: true,
    },
  });

  if (stale.length === 0) return 0;

  let alerted = 0;
  for (const m of stale) {
    const key = dedupeKey(m.tournamentInstanceId, m.internalMatchId);

    // Idempotency: skip if we already alerted for this match.
    const already = await prisma.auditEvent.findFirst({
      where: { action: MATCH_STALE_ALERT_ACTION, entityId: key },
      select: { id: true },
    });
    if (already) continue;

    const minutesPast = Math.round(
      (now.getTime() - m.kickoffUtc.getTime()) / 60_000,
    );

    await sendAdminNotification({
      category: "error",
      subject: `Partido sin resultado final: ${m.internalMatchId}`,
      body:
        `El partido <strong>${m.internalMatchId}</strong> (instancia ` +
        `${m.tournamentInstanceId}) arrancó hace ${minutesPast} min y todavía ` +
        `no tiene resultado final.<br><br>` +
        `Estado de sync: <strong>${m.syncStatus}</strong><br>` +
        `Último estado reportado: <strong>${m.lastApiStatus ?? "—"}</strong><br><br>` +
        `El fallback de API-Football debería haberlo cerrado; revisa si hace ` +
        `falta publicar/override el resultado manualmente.`,
    });

    await writeAuditEvent({
      actorUserId: null,
      action: MATCH_STALE_ALERT_ACTION,
      entityType: "MatchSyncState",
      entityId: key,
      dataJson: {
        tournamentInstanceId: m.tournamentInstanceId,
        internalMatchId: m.internalMatchId,
        kickoffUtc: m.kickoffUtc.toISOString(),
        minutesPast,
        syncStatus: m.syncStatus,
        lastApiStatus: m.lastApiStatus,
      },
    });

    alerted++;
  }

  return alerted;
}
