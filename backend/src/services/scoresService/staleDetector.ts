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

/** R14 (ADR-086): once-per-match key for feed-silent alerts. */
export const MATCH_FEED_SILENT_ACTION = "MATCH_FEED_SILENT";

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
        `<strong>NO existe ningún fallback automático</strong> (API-Football está ` +
        `desactivado): si el scraper no finaliza este partido, la única vía es ` +
        `el override manual del host/admin. Revisa el scraper ` +
        `(/fixtures/tracked, /scrapers/status) y publica el resultado si es necesario.`,
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

/**
 * R14 (ADR-086) — feed-silent detector. A tracked match whose kickoff passed
 * FEED_SILENT_AFTER_KICKOFF_MS ago but that the live poll hasn't processed
 * recently (lastCheckedAtUtc null or older than FEED_SILENT_STALE_MS) means
 * the scraper isn't reporting it — or only below MIN_CONFIDENCE, which the
 * poll skips. Either way nobody is scoring that match: alert once so a human
 * checks the scraper (/fixtures/tracked) well before the 210-min stale alarm.
 *
 * Only looks at matches that kicked off within the live window (last 6h) —
 * older unfinalized matches are the stale detector's territory.
 */
export async function detectAndAlertSilentMatches(
  now: Date = new Date(),
): Promise<number> {
  const kickoffBefore = new Date(now.getTime() - SCORES.FEED_SILENT_AFTER_KICKOFF_MS);
  const kickoffAfter = new Date(now.getTime() - 6 * 60 * 60_000);
  const checkedBefore = new Date(now.getTime() - SCORES.FEED_SILENT_STALE_MS);

  const silent = await prisma.matchSyncState.findMany({
    where: {
      kickoffUtc: { lt: kickoffBefore, gt: kickoffAfter },
      syncStatus: { in: UNFINALIZED_SYNC_STATUSES },
      OR: [{ lastCheckedAtUtc: null }, { lastCheckedAtUtc: { lt: checkedBefore } }],
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
      lastCheckedAtUtc: true,
      lastApiStatus: true,
      syncStatus: true,
    },
  });

  if (silent.length === 0) return 0;

  let alerted = 0;
  for (const m of silent) {
    const key = dedupeKey(m.tournamentInstanceId, m.internalMatchId);
    const already = await prisma.auditEvent.findFirst({
      where: { action: MATCH_FEED_SILENT_ACTION, entityId: key },
      select: { id: true },
    });
    if (already) continue;

    const minutesPast = Math.round((now.getTime() - m.kickoffUtc.getTime()) / 60_000);
    const lastChecked = m.lastCheckedAtUtc
      ? `${Math.round((now.getTime() - m.lastCheckedAtUtc.getTime()) / 60_000)} min`
      : "nunca";

    await sendAdminNotification({
      category: "error",
      subject: `Feed mudo: ${m.internalMatchId} (kickoff hace ${minutesPast} min)`,
      body:
        `El partido <strong>${m.internalMatchId}</strong> (instancia ` +
        `${m.tournamentInstanceId}) arrancó hace ${minutesPast} min pero el feed ` +
        `en vivo no lo reporta (último procesamiento: ${lastChecked}; puede estar ` +
        `ausente del scraper o atascado en confidence LOW/NONE).<br><br>` +
        `Sin feed no hay marcador ni finalización. Revisa el scraper ` +
        `(/fixtures/tracked, /scrapers/status) y re-registra el fixture si falta.`,
    });

    await writeAuditEvent({
      actorUserId: null,
      action: MATCH_FEED_SILENT_ACTION,
      entityType: "MatchSyncState",
      entityId: key,
      dataJson: {
        tournamentInstanceId: m.tournamentInstanceId,
        internalMatchId: m.internalMatchId,
        kickoffUtc: m.kickoffUtc.toISOString(),
        minutesPast,
        lastCheckedAtUtc: m.lastCheckedAtUtc?.toISOString() ?? null,
        syncStatus: m.syncStatus,
        lastApiStatus: m.lastApiStatus,
      },
    });
    alerted++;
  }
  return alerted;
}
