/**
 * Knockout sync bootstrap (ADR-086, A2/A3 of the 2026-07-02 hardening).
 *
 * Two production bugs shared the same root: when a knockout slot resolves
 * (auto-advance) or the admin releases a reviewed bracket, downstream sync
 * plumbing was left inconsistent:
 *
 *  A3 — nobody created the `MatchSyncState` row, so trackStatusCheckerJob,
 *       staleDetector and the live-minute display were blind to the match
 *       (R32 rows had to be created by hand on 2026-06-28).
 *  A2 — `MatchExternalMapping.apiFootball*TeamId` kept the PREDICTED teams
 *       when the released bracket differed (5 corrupt rows found on
 *       2026-07-02). Benign today (the scraper matches by name) but corrupt
 *       data waiting to bite any future consumer of those ids.
 *
 * Both entry points (persistResolvedKnockoutFixtures + propagateBracketToInstance)
 * now call these helpers so EVERY resolved knockout match has a sync row
 * before kickoff and mapping teamIds that mirror the canonical dataJson.
 */

import { prisma } from "../db";
import { MATCH_SYNC } from "../lib/constants";

export interface ResolvedFixtureSync {
  internalMatchId: string;
  /** Canonical kickoff (ISO). Rows without a kickoff are skipped. */
  kickoffUtc: string | null | undefined;
  /** apiFootballId of the resolved teams (null when unknown). */
  apiFootballHomeTeamId: number | null;
  apiFootballAwayTeamId: number | null;
}

/**
 * Guarantee a PENDING `MatchSyncState` row per resolved match (A3) and
 * mapping teamIds that match the canonical bracket (A2). Idempotent; never
 * touches sync lifecycle on existing rows (only refreshes timing if the
 * kickoff drifted) and never creates mappings (that stays with the
 * advancement/tracking flow that owns fixture ids).
 */
export async function ensureKnockoutSyncPlumbing(
  tournamentInstanceId: string,
  fixtures: ResolvedFixtureSync[],
): Promise<{ syncRowsCreated: number; mappingsRepaired: number }> {
  let syncRowsCreated = 0;
  let mappingsRepaired = 0;

  for (const f of fixtures) {
    if (!f.kickoffUtc) continue;
    const kickoff = new Date(f.kickoffUtc);
    if (Number.isNaN(kickoff.getTime())) continue;

    // A3 — sync row (create PENDING; update only refreshes timing).
    const existing = await prisma.matchSyncState.findUnique({
      where: {
        tournamentInstanceId_internalMatchId: {
          tournamentInstanceId,
          internalMatchId: f.internalMatchId,
        },
      },
      select: { id: true, kickoffUtc: true },
    });
    if (!existing) {
      await prisma.matchSyncState.create({
        data: {
          tournamentInstanceId,
          internalMatchId: f.internalMatchId,
          syncStatus: "PENDING",
          kickoffUtc: kickoff,
          firstCheckAtUtc: new Date(kickoff.getTime() + MATCH_SYNC.FIRST_CHECK_MS),
          finishCheckAtUtc: new Date(kickoff.getTime() + MATCH_SYNC.FINISH_CHECK_MS),
        },
      });
      syncRowsCreated++;
    } else if (existing.kickoffUtc.getTime() !== kickoff.getTime()) {
      await prisma.matchSyncState.update({
        where: { id: existing.id },
        data: {
          kickoffUtc: kickoff,
          firstCheckAtUtc: new Date(kickoff.getTime() + MATCH_SYNC.FIRST_CHECK_MS),
          finishCheckAtUtc: new Date(kickoff.getTime() + MATCH_SYNC.FINISH_CHECK_MS),
        },
      });
    }

    // A2 — mapping teamIds must mirror the canonical bracket.
    const mapping = await prisma.matchExternalMapping.findUnique({
      where: {
        tournamentInstanceId_internalMatchId: {
          tournamentInstanceId,
          internalMatchId: f.internalMatchId,
        },
      },
      select: { id: true, apiFootballHomeTeamId: true, apiFootballAwayTeamId: true },
    });
    if (
      mapping &&
      (mapping.apiFootballHomeTeamId !== f.apiFootballHomeTeamId ||
        mapping.apiFootballAwayTeamId !== f.apiFootballAwayTeamId)
    ) {
      await prisma.matchExternalMapping.update({
        where: { id: mapping.id },
        data: {
          apiFootballHomeTeamId: f.apiFootballHomeTeamId,
          apiFootballAwayTeamId: f.apiFootballAwayTeamId,
        },
      });
      mappingsRepaired++;
    }
  }

  return { syncRowsCreated, mappingsRepaired };
}
