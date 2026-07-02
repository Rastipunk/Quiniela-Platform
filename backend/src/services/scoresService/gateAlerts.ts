/**
 * One-time admin alerts for the finalization gate + feed-health detectors
 * (ADR-086: R9, R11, R13, R2–R6 class). Same idempotency pattern as the
 * stale detector: an AuditEvent per (action, entityId) is the dedupe key,
 * so each condition emails the team exactly once per match.
 *
 * ALERT-ONLY by design — none of these mutate results. An API_CONFIRMED
 * result is human territory (reversion stays manual until the owner
 * decides otherwise).
 */

import { prisma } from "../../db";
import { sendAdminNotification } from "../../lib/email";
import { writeAuditEvent } from "../../lib/audit";
import type { LiveScore } from "./client";
import type { Incoherence } from "./finalizationGate";

export const SLOW_PATH_ALERT_ACTION = "RESULT_FINALIZED_SLOW_PATH";
export const FINALIZED_BUT_LIVE_ACTION = "FINALIZED_BUT_FEED_LIVE";
export const KICKOFF_DRIFT_ACTION = "KICKOFF_DRIFT_DETECTED";
export const INCOHERENCE_ACTION = "SCORE_INCOHERENCE_DETECTED";

interface MatchRef {
  tournamentInstanceId: string;
  internalMatchId: string;
}

/** Send `body` once per (action, key); returns true if it sent this time. */
async function alertOnce(
  action: string,
  key: string,
  subject: string,
  body: string,
  dataJson: Record<string, unknown>,
): Promise<boolean> {
  const already = await prisma.auditEvent.findFirst({
    where: { action, entityId: key },
    select: { id: true },
  });
  if (already) return false;

  await sendAdminNotification({ category: "error", subject, body });
  await writeAuditEvent({
    actorUserId: null,
    action,
    entityType: "MatchSyncState",
    entityId: key,
    dataJson,
  });
  return true;
}

const matchKey = (m: MatchRef): string =>
  `${m.tournamentInstanceId}:${m.internalMatchId}`;

/** R9 — a result finalized via the SLOW path (confidence MEDIUM). */
export async function alertSlowPathFinalize(
  m: MatchRef,
  score: LiveScore,
  minutesSinceKickoff: number,
): Promise<void> {
  await alertOnce(
    SLOW_PATH_ALERT_ACTION,
    matchKey(m),
    `Finalizado por camino lento: ${m.internalMatchId}`,
    `El partido <strong>${m.internalMatchId}</strong> finalizó por el ` +
      `<strong>camino lento</strong> del gate (confidence ${score.confidence}, ` +
      `${Math.round(minutesSinceKickoff)} min desde el kickoff).<br><br>` +
      `Marcador: <strong>${score.homeGoals}-${score.awayGoals}</strong> ` +
      `(pen ${score.penaltyHome ?? "—"}-${score.penaltyAway ?? "—"}, status ${score.status}).<br><br>` +
      `El resultado quedó publicado; dale un vistazo humano por si la fuente ` +
      `de consenso era débil.`,
    {
      ...m,
      status: score.status,
      confidence: score.confidence,
      homeGoals: score.homeGoals,
      awayGoals: score.awayGoals,
      minutesSinceKickoff: Math.round(minutesSinceKickoff),
    },
  );
}

/** R11 — lifecycle says COMPLETED but the feed reports the match live. */
export async function alertFinalizedButFeedLive(
  m: MatchRef,
  score: LiveScore,
): Promise<void> {
  await alertOnce(
    FINALIZED_BUT_LIVE_ACTION,
    matchKey(m),
    `⚠️ Finalizado pero el feed lo da EN VIVO: ${m.internalMatchId}`,
    `El partido <strong>${m.internalMatchId}</strong> está COMPLETED en la ` +
      `plataforma, pero el scraper lo reporta <strong>${score.status}</strong> ` +
      `minuto ${score.elapsed ?? "?"} (${score.homeGoals}-${score.awayGoals}, ` +
      `confidence ${score.confidence}).<br><br>` +
      `Es la clase de incidente Argentina–Argelia / Inglaterra–Congo (terminal ` +
      `falso). <strong>NO se revierte nada automáticamente</strong>: verifica el ` +
      `partido real y corrige vía override si aplica.`,
    {
      ...m,
      feedStatus: score.status,
      elapsed: score.elapsed,
      homeGoals: score.homeGoals,
      awayGoals: score.awayGoals,
      confidence: score.confidence,
    },
  );
}

/** R13 — sources observe a kickoff far from our registered one. */
export async function alertKickoffDrift(
  m: MatchRef,
  oursUtc: string,
  observedUtc: string,
  driftMinutes: number,
): Promise<void> {
  await alertOnce(
    KICKOFF_DRIFT_ACTION,
    matchKey(m),
    `Drift de kickoff: ${m.internalMatchId} (${driftMinutes} min)`,
    `Las fuentes observan el kickoff de <strong>${m.internalMatchId}</strong> en ` +
      `<strong>${observedUtc}</strong> pero la plataforma lo tiene registrado en ` +
      `<strong>${oursUtc}</strong> (drift ${driftMinutes} min — posible ` +
      `reprogramación).<br><br>Revisa deadlines/locks de predicciones de ese ` +
      `partido y corrige el fixture si aplica.`,
    { ...m, oursUtc, observedUtc, driftMinutes },
  );
}

/** R2–R6 class — feed incoherence (one alert per match+type). */
export async function alertIncoherences(
  m: MatchRef,
  score: LiveScore,
  incoherences: Incoherence[],
): Promise<void> {
  for (const type of incoherences) {
    await alertOnce(
      INCOHERENCE_ACTION,
      `${matchKey(m)}:${type}`,
      `Incoherencia de feed (${type}): ${m.internalMatchId}`,
      `Detectada <strong>${type}</strong> en <strong>${m.internalMatchId}</strong>.<br>` +
        `Payload: ${score.homeGoals}-${score.awayGoals} status=${score.status} ` +
        `pen=${score.penaltyHome ?? "—"}-${score.penaltyAway ?? "—"} ` +
        `confidence=${score.confidence}.<br><br>` +
        `Solo alerta (puede ser legítimo, p. ej. gol anulado por VAR) — ` +
        `verifica el partido real.`,
      {
        ...m,
        type,
        status: score.status,
        homeGoals: score.homeGoals,
        awayGoals: score.awayGoals,
        penaltyHome: score.penaltyHome,
        penaltyAway: score.penaltyAway,
      },
    );
  }
}
