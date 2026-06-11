/**
 * Structural Auto-Publish Service
 *
 * For pools in Estratega (SIMPLE preset) mode, structural results
 * (GroupStandingsResult, StructuralPhaseResult.matches[].winnerId)
 * are not published manually by the host. Instead, this service
 * derives them automatically from the scraper-confirmed PoolMatchResult
 * data and writes them to the DB.
 *
 * It is invoked from two hook points:
 *
 *   1. liveScoresJob.finalizeResult()  — after a match's PoolMatchResult
 *      is upgraded SCRAPER_PROVISIONAL → API_CONFIRMED at the end of the
 *      grace period. This is the normal happy path.
 *
 *   2. resultService.publishResult()  — after the host writes a
 *      HOST_OVERRIDE for a match. Recomputes structural results so a
 *      host correction propagates without manual intervention.
 *
 * The function is idempotent: re-running on already-published structural
 * results that haven't changed is a no-op (Prisma upsert).
 *
 * Side effects:
 *   - Writes GroupStandingsResult / StructuralPhaseResult.
 *   - Audits POOL_AUTO_PUBLISHED_STANDINGS / POOL_AUTO_PUBLISHED_WINNER.
 *   - Does NOT send emails. The scraper is authoritative — emails are
 *     reserved for HOST overrides of an already-published structural
 *     result, which go through the dedicated PUT endpoints.
 *   - Does NOT trigger auto-advance. That responsibility stays with
 *     advancementTrigger.checkAndTriggerAdvancement(), which fires
 *     separately from the same hook points.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { extractMatches, parseFixtureData } from "../lib/fixture";
import { FINAL_RESULT_SOURCES } from "../lib/constants";
import { calculateGroupStandings } from "./tournamentAdvancement";
import { fireAndForget } from "../lib/asyncHelpers";
import { sendAdminNotification } from "../lib/email";

/** Audit action / once-per-match idempotency key for undecidable knockouts. */
const KNOCKOUT_UNDECIDABLE_ACTION = "KNOCKOUT_WINNER_UNDECIDABLE";

/**
 * A result source is authoritative (the match is officially over) when it
 * is API-confirmed or a host override. SCRAPER_PROVISIONAL / HOST_* draft
 * sources mean the match may still be live, so we stay silent.
 */
function isAuthoritativeSource(source: string): boolean {
  return source === "API_CONFIRMED" || source === "HOST_OVERRIDE";
}

/**
 * A knockout match has an authoritative result (officially over) but no
 * winner can be derived — a draw with no penalties, or penalties tied.
 * The bracket can't advance. Alert the team once so they can override.
 */
async function alertKnockoutUndecidable(
  poolId: string,
  phaseId: string,
  matchId: string,
  reason: string,
): Promise<void> {
  const key = `${poolId}:${matchId}`;
  const already = await prisma.auditEvent.findFirst({
    where: { action: KNOCKOUT_UNDECIDABLE_ACTION, entityId: key },
    select: { id: true },
  });
  if (already) return;

  await sendAdminNotification({
    category: "error",
    subject: `Eliminatoria sin ganador: ${matchId}`,
    body:
      `El partido de eliminatoria <strong>${matchId}</strong> (pool ${poolId}) ` +
      `tiene resultado oficial pero no se puede derivar un ganador: ` +
      `<strong>${reason}</strong>.<br><br>` +
      `El bracket no puede avanzar. Publica/override el resultado con los ` +
      `penales correctos para destrabarlo.`,
  });

  await writeAuditEvent({
    actorUserId: null,
    action: KNOCKOUT_UNDECIDABLE_ACTION,
    entityType: "PoolMatchResult",
    entityId: key,
    poolId,
    dataJson: { phaseId, matchId, reason },
  });
}

type PhaseConfig = {
  phaseId: string;
  requiresScore?: boolean;
  structuralPicks?: { type?: string };
};

/**
 * Top-level entry point. Given a poolId + matchId that just had its
 * PoolMatchResult confirmed (or overridden), publishes the structural
 * result for the phase containing that match if and only if:
 *   - The pool's pickTypesConfig marks that phase as structural.
 *   - Enough match data exists to derive the structural result.
 */
export async function autoPublishStructuralResults(
  poolId: string,
  matchId: string,
): Promise<void> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      pickTypesConfig: true,
      fixtureSnapshot: true,
      tournamentInstance: { select: { dataJson: true } },
    },
  });
  if (!pool) return;

  const fixtureSource = pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson;
  const matches = extractMatches(fixtureSource);
  const match = matches.find((m) => m.id === matchId);
  if (!match || !match.phaseId) return;

  const phaseConfigs = (pool.pickTypesConfig ?? []) as PhaseConfig[];
  const phaseConfig = phaseConfigs.find((p) => p.phaseId === match.phaseId);
  if (!phaseConfig || phaseConfig.requiresScore !== false) return;

  const structuralType = phaseConfig.structuralPicks?.type;

  try {
    if (structuralType === "GROUP_STANDINGS" && match.groupId) {
      await autoPublishGroupStandings(poolId, match.phaseId, match.groupId);
    } else if (structuralType === "KNOCKOUT_WINNER") {
      await autoPublishKnockoutWinner(poolId, match.phaseId, matchId);
    }
  } catch (err) {
    // Best-effort: log and swallow. The scraper hook should never
    // bubble an exception into liveScoresJob's tx — we'd block all
    // other pools' updates.
    console.error(
      `[autoPublishStructuralResults] poolId=${poolId} matchId=${matchId} failed:`,
      err,
    );
  }
}

/**
 * If every match in the given group has a PoolMatchResult.currentVersion,
 * compute the FIFA-tiebreaker standings and upsert the GroupStandingsResult
 * with the resulting team order.
 */
async function autoPublishGroupStandings(
  poolId: string,
  phaseId: string,
  groupId: string,
): Promise<void> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) return;

  const fixture = parseFixtureData(
    pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson,
  );
  const groupMatches = fixture.matches.filter((m) => m.groupId === groupId);
  if (groupMatches.length === 0) return;

  const groupTeamIds = fixture.teams
    .filter((t) => t.groupId === groupId)
    .map((t) => t.id);
  if (groupTeamIds.length === 0) return;

  const results = await prisma.poolMatchResult.findMany({
    where: { poolId, matchId: { in: groupMatches.map((m) => m.id) } },
    include: { currentVersion: true },
  });

  // Only FINAL results count (audit F3-3): a SCRAPER_PROVISIONAL
  // version is a snapshot of a match still in progress — deriving the
  // table from it published premature standings during simultaneous
  // last-matchday games (and Estratega scoring paid against them).
  const finalised = results.filter(
    (r) => r.currentVersion && FINAL_RESULT_SOURCES.has(r.currentVersion.source),
  );
  if (finalised.length < groupMatches.length) {
    // Group not complete yet (or some matches still live) — wait.
    return;
  }

  // Translate to the shape calculateGroupStandings expects.
  const standingsInput = finalised.map((r) => {
    const m = groupMatches.find((gm) => gm.id === r.matchId)!;
    return {
      matchId: r.matchId,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      // Use the 90' score if available so extra-time goals from a
      // hypothetical knockout-in-group format don't bias standings.
      // For pure round-robin group stages homeGoals === homeGoals90.
      homeGoals: r.currentVersion!.homeGoals90 ?? r.currentVersion!.homeGoals,
      awayGoals: r.currentVersion!.awayGoals90 ?? r.currentVersion!.awayGoals,
    };
  });

  const standings = calculateGroupStandings(groupId, groupTeamIds, standingsInput);
  const orderedTeamIds = standings.map((s) => s.teamId);

  // Idempotent skip: if the publication already matches what we'd
  // write, don't churn versions or audit noise.
  const existing = await prisma.groupStandingsResult.findUnique({
    where: { poolId_phaseId_groupId: { poolId, phaseId, groupId } },
  });
  if (existing && arraysEqual(existing.teamIds as string[], orderedTeamIds)) {
    return;
  }

  // Host-override protection (audit F3-5): a host errata always carries
  // a `reason` (mandatory in publishGroupStandingsResult) and the system
  // never writes one — so reason != null marks the row as host-authored
  // (e.g. a table fixed by fair-play/drawing-of-lots that the calculator
  // can't know). Never clobber it silently; leave an audit trail instead.
  if (existing && existing.reason != null) {
    fireAndForget(
      "audit:auto-recompute-skipped-host-override",
      writeAuditEvent({
        actorUserId: "SYSTEM",
        action: "GROUP_STANDINGS_AUTO_RECOMPUTE_SKIPPED",
        entityType: "GroupStandingsResult",
        entityId: existing.id,
        dataJson: {
          poolId, phaseId, groupId,
          reason: "host_override_protected",
          hostTeamIds: existing.teamIds,
          computedTeamIds: orderedTeamIds,
        },
        ip: null,
        userAgent: null,
      }),
    );
    return;
  }

  const isOverride = !!existing;

  const saved = await prisma.groupStandingsResult.upsert({
    where: { poolId_phaseId_groupId: { poolId, phaseId, groupId } },
    update: {
      teamIds: orderedTeamIds,
      publishedAtUtc: new Date(),
      version: { increment: 1 },
      // No createdByUserId: this is system-generated. Leave the
      // previous human creator (if any) in place by not touching it.
      // No reason: scraper recomputation is automatic.
    },
    create: {
      poolId,
      phaseId,
      groupId,
      teamIds: orderedTeamIds,
      version: 1,
      // Schema requires createdByUserId — attribute system-generated
      // rows to the pool creator so the FK stays valid.
      createdByUserId: pool.createdByUserId,
    },
  });

  fireAndForget(
    "audit:auto-published-standings",
    writeAuditEvent({
      actorUserId: "SYSTEM",
      action: isOverride ? "GROUP_STANDINGS_AUTO_RECOMPUTED" : "GROUP_STANDINGS_AUTO_PUBLISHED",
      entityType: "GroupStandingsResult",
      entityId: saved.id,
      dataJson: {
        poolId, phaseId, groupId,
        version: saved.version,
        teamIds: orderedTeamIds,
        source: "scraper",
      },
      ip: null,
      userAgent: null,
    }),
  );
}

/**
 * For one knockout match, if a PoolMatchResult.currentVersion exists
 * AND the winner is unambiguous (regulation+ET or resolved by penalties),
 * merge the derived winnerId into StructuralPhaseResult.resultJson.matches[].
 */
async function autoPublishKnockoutWinner(
  poolId: string,
  phaseId: string,
  matchId: string,
): Promise<void> {
  const result = await prisma.poolMatchResult.findUnique({
    where: { poolId_matchId: { poolId, matchId } },
    include: { currentVersion: true },
  });
  if (!result?.currentVersion) return;

  // Only FINAL results derive a winner (audit F3-3): with a
  // SCRAPER_PROVISIONAL version the match is still live — the old code
  // merged the currently-leading team as "advances" mid-match.
  if (!FINAL_RESULT_SOURCES.has(result.currentVersion.source)) return;

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) return;

  const matches = extractMatches(pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson);
  const match = matches.find((m) => m.id === matchId);
  if (!match) return;

  const cv = result.currentVersion;
  let winnerId: string | null = null;
  if (cv.homeGoals > cv.awayGoals) {
    winnerId = match.homeTeamId;
  } else if (cv.awayGoals > cv.homeGoals) {
    winnerId = match.awayTeamId;
  } else if (cv.homePenalties != null && cv.awayPenalties != null) {
    if (cv.homePenalties > cv.awayPenalties) {
      winnerId = match.homeTeamId;
    } else if (cv.awayPenalties > cv.homePenalties) {
      winnerId = match.awayTeamId;
    } else {
      // Tied on penalties — invalid state, can't derive a winner.
      if (isAuthoritativeSource(cv.source)) {
        fireAndForget(
          "structural:knockout-undecidable",
          alertKnockoutUndecidable(poolId, phaseId, matchId, "penales empatados"),
        );
      }
      return;
    }
  } else {
    // Tied at 90'+ET with no penalties recorded. During a live match
    // (SCRAPER_PROVISIONAL) this is normal — we just wait. But once the
    // result is authoritative (API_CONFIRMED / HOST_OVERRIDE) it means the
    // match is officially over with no decider → the bracket is stuck.
    if (isAuthoritativeSource(cv.source)) {
      fireAndForget(
        "structural:knockout-undecidable",
        alertKnockoutUndecidable(
          poolId,
          phaseId,
          matchId,
          "empate sin penales registrados",
        ),
      );
    }
    return;
  }

  // Merge into StructuralPhaseResult.resultJson.matches[] under a
  // per-(pool, phase) advisory lock (audit F3-2): the read→merge→upsert
  // used to run unlocked, so two matches of the same phase finalising
  // in the same poll cycle could each read the same array and the last
  // upsert silently dropped the other one's winner — unrecoverable
  // because the idempotent skip then prevented a re-publish.
  type WinnerEntry = { matchId: string; winnerId: string; source?: string };

  const outcome = await prisma.$transaction(async (tx) => {
    // pg_advisory_xact_lock releases automatically at tx end.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`structural:${poolId}:${phaseId}`}))`;

    const existing = await tx.structuralPhaseResult.findUnique({
      where: { poolId_phaseId: { poolId, phaseId } },
    });
    const existingMatches: WinnerEntry[] =
      ((existing?.resultJson as { matches?: WinnerEntry[] } | null)?.matches) ?? [];
    const previousEntry = existingMatches.find((m) => m.matchId === matchId);

    // Idempotent skip.
    if (previousEntry && previousEntry.winnerId === winnerId) return null;

    // Host-override protection (audit F3-5): entries written via the
    // dedicated PUT carry source:"HOST" — never clobber them silently.
    if (previousEntry?.source === "HOST") {
      return { skippedHostOverride: true, existingId: existing!.id, previousEntry } as const;
    }

    const mergedMatches: WinnerEntry[] = previousEntry
      ? existingMatches.map((m) => (m.matchId === matchId ? { matchId, winnerId } : m))
      : [...existingMatches, { matchId, winnerId }];

    const saved = await tx.structuralPhaseResult.upsert({
      where: { poolId_phaseId: { poolId, phaseId } },
      update: {
        resultJson: { matches: mergedMatches } as Prisma.InputJsonValue,
        publishedAtUtc: new Date(),
      },
      create: {
        poolId,
        phaseId,
        resultJson: { matches: mergedMatches } as Prisma.InputJsonValue,
        // createdByUserId is required by the schema in the create path;
        // we attribute system-generated rows to the pool creator so
        // audit foreign keys stay clean.
        createdByUserId: pool.createdByUserId,
      },
    });
    return { saved, isRecomputation: !!previousEntry, previousEntry } as const;
  });

  if (!outcome) return; // idempotent skip

  if ("skippedHostOverride" in outcome) {
    fireAndForget(
      "audit:auto-recompute-skipped-host-override",
      writeAuditEvent({
        actorUserId: "SYSTEM",
        action: "KNOCKOUT_WINNER_AUTO_RECOMPUTE_SKIPPED",
        entityType: "StructuralPhaseResult",
        entityId: outcome.existingId,
        dataJson: {
          poolId, phaseId, matchId,
          reason: "host_override_protected",
          hostWinnerId: outcome.previousEntry?.winnerId ?? null,
          computedWinnerId: winnerId,
        },
        ip: null,
        userAgent: null,
      }),
    );
    return;
  }

  fireAndForget(
    "audit:auto-published-winner",
    writeAuditEvent({
      actorUserId: "SYSTEM",
      action: outcome.isRecomputation ? "KNOCKOUT_WINNER_AUTO_RECOMPUTED" : "KNOCKOUT_WINNER_AUTO_PUBLISHED",
      entityType: "StructuralPhaseResult",
      entityId: outcome.saved.id,
      dataJson: {
        poolId, phaseId, matchId, winnerId,
        previousWinnerId: outcome.previousEntry?.winnerId ?? null,
        source: "scraper",
      },
      ip: null,
      userAgent: null,
    }),
  );

}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
