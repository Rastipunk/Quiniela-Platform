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
import { calculateGroupStandings } from "./tournamentAdvancement";
import { fireAndForget } from "../lib/asyncHelpers";

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

  const finalised = results.filter((r) => r.currentVersion);
  if (finalised.length < groupMatches.length) {
    // Group not complete yet — wait for more matches to confirm.
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
      return;
    }
  } else {
    // Tied at 90'+ET with no penalties recorded yet — wait.
    return;
  }

  // Merge into StructuralPhaseResult.resultJson.matches[].
  type WinnerEntry = { matchId: string; winnerId: string };
  const existing = await prisma.structuralPhaseResult.findUnique({
    where: { poolId_phaseId: { poolId, phaseId } },
  });
  const existingMatches: WinnerEntry[] =
    ((existing?.resultJson as { matches?: WinnerEntry[] } | null)?.matches) ?? [];
  const previousEntry = existingMatches.find((m) => m.matchId === matchId);

  // Idempotent skip.
  if (previousEntry && previousEntry.winnerId === winnerId) return;

  const isRecomputation = !!previousEntry;
  const mergedMatches: WinnerEntry[] = previousEntry
    ? existingMatches.map((m) => (m.matchId === matchId ? { matchId, winnerId } : m))
    : [...existingMatches, { matchId, winnerId }];

  const saved = await prisma.structuralPhaseResult.upsert({
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

  fireAndForget(
    "audit:auto-published-winner",
    writeAuditEvent({
      actorUserId: "SYSTEM",
      action: isRecomputation ? "KNOCKOUT_WINNER_AUTO_RECOMPUTED" : "KNOCKOUT_WINNER_AUTO_PUBLISHED",
      entityType: "StructuralPhaseResult",
      entityId: saved.id,
      dataJson: {
        poolId, phaseId, matchId, winnerId,
        previousWinnerId: previousEntry?.winnerId ?? null,
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
