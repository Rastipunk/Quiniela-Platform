/**
 * Pool Overview Service — Pure business logic for the pool overview endpoint.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Side effects are fire-and-forget but logged on failure.
 */

import crypto from "crypto";
import { prisma } from "../db";
import { getScoringPreset } from "../lib/scoringPresets";
import { isPoolAdmin } from "../lib/roles";
import {
  extractMatches,
  extractTeams,
  extractPhases,
  typed,
  type PickJson,
  type StructuralPickJson,
} from "../lib/fixture";
import { scoreMatchPick } from "../lib/scoringAdvanced";
import { isCaprichoSanPool } from "../lib/caprichoSan";
import { rankLeaderboardRows } from "../lib/leaderboardRanking";
import { computeStructuralBreakdown, summarizeStructural, type StructuralStatsSummary } from "./structuralScoring";
import { outcomeFromScore } from "../lib/poolHelpers";
import { isPredictionStatusEnabled, isLeaderboardDeltaEnabledForPool, isBarRaceEnabledForPool, isExtraTimeConfigEnabled } from "../lib/featureFlags";
import { getKnockoutScorePhases, computeExtraTimeWindow } from "../lib/extraTimeConfig";
import { FINAL_RESULT_SOURCES } from "../lib/constants";
import { getOrComputeLeaderboard } from "./poolLeaderboardCache";
import type { PoolMemberRole } from "@prisma/client";
import { computeLastStep } from "./poolMatchDelta";
import { buildBarRaceSeries, curateBarRaceForViewer } from "./poolBarRace";
import type { PhasePickConfig } from "../types/pickConfig";
import { ServiceError } from "./authService";

// ─── Leaderboard fingerprint (ADR-079) ───────────────────────
// Cheap signature of every input the leaderboard depends on. When it changes,
// the per-pool leaderboard cache recomputes; otherwise the cached bundle is
// served. All aggregates are on poolId-indexed columns (ms-fast), vs the
// multi-second heavy computation they gate. `results` and `matchOverrides`
// are already loaded for the match cards, so they're fingerprinted in-memory
// (no extra query).
async function computeLeaderboardFingerprint(
  poolId: string,
  results: Array<{ updatedAtUtc: Date }>,
  matchOverrides: Array<{ scoringEnabled: boolean }>,
): Promise<string> {
  const [membersCount, predictionsCount, structuralPhase, groupStandings] = await Promise.all([
    // Membership set that forms the leaderboard rows (entries/leaves/bans).
    prisma.poolMember.count({ where: { poolId, status: { in: ["ACTIVE", "LEFT"] } } }),
    // New predictors (badge freshness + a member's first pick).
    prisma.prediction.count({ where: { poolId } }),
    prisma.structuralPhaseResult.aggregate({ where: { poolId }, _count: { _all: true }, _max: { updatedAtUtc: true } }),
    prisma.groupStandingsResult.aggregate({ where: { poolId }, _count: { _all: true }, _max: { updatedAtUtc: true } }),
  ]);

  const resultsCount = results.length;
  const resultsMaxUpdated = results.reduce((mx, r) => Math.max(mx, r.updatedAtUtc.getTime()), 0);
  const overridesCount = matchOverrides.length;
  const overridesDisabled = matchOverrides.reduce((n, o) => n + (o.scoringEnabled ? 0 : 1), 0);

  return [
    `r:${resultsCount}:${resultsMaxUpdated}`,
    `o:${overridesCount}:${overridesDisabled}`,
    `m:${membersCount}`,
    `p:${predictionsCount}`,
    `sp:${structuralPhase._count._all}:${structuralPhase._max.updatedAtUtc?.getTime() ?? 0}`,
    `gs:${groupStandings._count._all}:${groupStandings._max.updatedAtUtc?.getTime() ?? 0}`,
  ].join("|");
}

// ─── Pool Overview ───────────────────────────────────────────

export async function getPoolOverview(
  userId: string,
  poolId: string,
  leaderboardVerbose: boolean,
  includeBarRace = false,
  publicMode = false,
) {
  // 1) Permission: must be ACTIVE or LEFT (LEFT = read-only). publicMode (the
  // shared "Evolución" link) is an anonymous read-only view → skip the check
  // with a non-admin placeholder member (no emails exposed, no host powers).
  const myMembership = publicMode
    ? { id: "", userId: "", role: "PLAYER" as PoolMemberRole, status: "ACTIVE" as const, joinedAtUtc: new Date() }
    : await prisma.poolMember.findFirst({
        where: { poolId, userId, status: { in: ["ACTIVE", "LEFT"] } },
      });
  if (!myMembership) {
    // Check if user is pending approval — return a distinct code so the
    // frontend can show a friendly "waiting" message instead of an error.
    const pending = await prisma.poolMember.findFirst({
      where: { poolId, userId, status: "PENDING_APPROVAL" },
      include: { pool: { select: { name: true } } },
    });
    if (pending) {
      throw new ServiceError("PENDING_APPROVAL", 403, {
        poolName: pending.pool.name,
      });
    }
    throw new ServiceError("FORBIDDEN", 403);
  }

  // 2) Pool + instance
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      tournamentInstance: { include: { template: { select: { key: true } } } },
      organization: { select: { id: true, name: true, logoBase64: true, welcomeMessage: true, invitationMessage: true, primaryColor: true, secondaryColor: true, invitationLocale: true } },
      createdByUser: { select: { email: true } },
    },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);
  if (!pool.tournamentInstance) throw new ServiceError("CONFLICT", 409, { message: "Pool has no tournamentInstance" });

  const preset = getScoringPreset(pool.scoringPresetKey);
  const membersActive = await prisma.poolMember.count({ where: { poolId, status: "ACTIVE" } });

  // Prediction-status feature (ADR-077): per-pool gate by creator email.
  // Constant for every match card in this pool.
  const predictionStatusEnabled = isPredictionStatusEnabled(pool.createdByUser?.email ?? null);

  // 3) Snapshot
  const snapshot = pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson;
  const matches = extractMatches(snapshot);
  const teams = extractTeams(snapshot);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const matchIds = matches.map((m) => m.id);
  const now = new Date();

  // 4+5) My picks, results, overrides and sync states in parallel
  const [myPredictions, results, matchOverrides, syncStates] = await Promise.all([
    prisma.prediction.findMany({
      where: { poolId, userId, matchId: { in: matchIds } },
    }),
    prisma.poolMatchResult.findMany({
      where: { poolId, matchId: { in: matchIds } },
      include: { currentVersion: true },
    }),
    prisma.poolMatchOverride.findMany({ where: { poolId } }),
    prisma.matchSyncState.findMany({
      where: { tournamentInstanceId: pool.tournamentInstanceId, internalMatchId: { in: matchIds } },
      select: { internalMatchId: true, syncStatus: true, lastApiStatus: true, lastElapsed: true, lastExtra: true, lastLiveDataJson: true },
    }),
  ]);
  const overrideByMatchId = new Map(matchOverrides.map((o) => [o.matchId, o]));
  const syncByMatchId = new Map(syncStates.map((s) => [s.internalMatchId, s]));
  const myPickByMatchId = new Map(myPredictions.map((p) => [p.matchId, typed<PickJson>(p.pickJson)]));

  const resultByMatchId = new Map<string, {
    homeGoals: number;
    awayGoals: number;
    homeGoals90?: number | null;
    awayGoals90?: number | null;
    homePenalties?: number | null;
    awayPenalties?: number | null;
    version: number;
    reason?: string | null;
  }>();
  for (const r of results) {
    if (r.currentVersion) {
      resultByMatchId.set(r.matchId, {
        homeGoals: r.currentVersion.homeGoals,
        awayGoals: r.currentVersion.awayGoals,
        homeGoals90: r.currentVersion.homeGoals90,
        awayGoals90: r.currentVersion.awayGoals90,
        homePenalties: r.currentVersion.homePenalties,
        awayPenalties: r.currentVersion.awayPenalties,
        version: r.currentVersion.versionNumber,
        reason: r.currentVersion.reason,
      });
    }
  }

  // 6) Match cards for UI
  const matchCards = matches.map((m) => {
    const kickoff = new Date(m.kickoffUtc);
    const deadlineUtc = new Date(kickoff.getTime() - pool.deadlineMinutesBeforeKickoff * 60_000);
    const isLocked = now.getTime() >= deadlineUtc.getTime();
    const homeTeam = teamById.get(m.homeTeamId);
    const awayTeam = teamById.get(m.awayTeamId);
    const myPick = myPickByMatchId.get(m.id) ?? null;
    const result = resultByMatchId.get(m.id) ?? null;
    const override = overrideByMatchId.get(m.id);

    return {
      id: m.id,
      phaseId: m.phaseId,
      kickoffUtc: m.kickoffUtc,
      deadlineUtc: deadlineUtc.toISOString(),
      isLocked,
      matchNumber: m.matchNumber ?? null,
      roundLabel: m.roundLabel ?? null,
      label: m.label ?? null,
      venue: m.venue ?? null,
      groupId: m.groupId ?? null,
      homeTeam: { id: m.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
      awayTeam: { id: m.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
      myPick,
      result,
      scoringEnabled: override ? override.scoringEnabled : true,
      scoringOverrideReason: override?.reason ?? null,
      matchSyncStatus: syncByMatchId.get(m.id)?.syncStatus ?? null,
      resultSource: result ? (results.find(r => r.matchId === m.id)?.currentVersion?.source ?? null) : null,
      // Live data for real-time display
      elapsed: syncByMatchId.get(m.id)?.lastElapsed ?? null,
      extra: syncByMatchId.get(m.id)?.lastExtra ?? null,
      matchStatus: syncByMatchId.get(m.id)?.lastApiStatus ?? null,
      isLive: ["IN_PROGRESS", "AWAITING_FINISH"].includes(syncByMatchId.get(m.id)?.syncStatus ?? ""),
    };
  });

  // 7) Leaderboard — heavy, pool-global, IDENTICAL for every user of the pool.
  // Cached per pool (ADR-079): the fingerprint forces a recompute the moment
  // any match input changes (results/membership/picks/overrides); otherwise
  // the shared bundle is served instantly. Verbose (admin debug) bypasses the
  // cache so the per-row breakdown is always fresh.
  const leaderboardFingerprint = await computeLeaderboardFingerprint(poolId, results, matchOverrides);
  const computeLeaderboardBundle = async () => {
  const [members, allPredictions] = await Promise.all([
    prisma.poolMember.findMany({
      where: { poolId, status: { in: ["ACTIVE", "LEFT"] } },
      include: { user: { select: { id: true, email: true, username: true, displayName: true, platformRole: true } } },
      orderBy: { joinedAtUtc: "asc" },
    }),
    prisma.prediction.findMany({
      where: { poolId, matchId: { in: matchIds } },
    }),
  ]);

  const predsByUserMatch = new Map<string, Map<string, PickJson>>();
  for (const p of allPredictions) {
    const byMatch = predsByUserMatch.get(p.userId) ?? new Map<string, PickJson>();
    byMatch.set(p.matchId, typed<PickJson>(p.pickJson));
    predsByUserMatch.set(p.userId, byMatch);
  }

  // Prediction-status counts (ADR-077): how many ACTIVE members have submitted
  // a pick per match. Derived in-memory from data already loaded above — no
  // extra DB query. `allPredictions` also includes LEFT members' preserved
  // picks, so intersect with the ACTIVE set to keep numerator and denominator
  // (membersActive) consistent.
  const activeUserIds = new Set(
    members.filter((m) => m.status === "ACTIVE").map((m) => m.userId),
  );
  const predictedCountByMatch = new Map<string, number>();
  for (const p of allPredictions) {
    if (!activeUserIds.has(p.userId)) continue;
    predictedCountByMatch.set(p.matchId, (predictedCountByMatch.get(p.matchId) ?? 0) + 1);
  }

  // Load structural picks and results in parallel
  const [allStructuralPicks, allGroupStandingsPicks, allStructuralResults, allGroupStandingsResults] = await Promise.all([
    prisma.structuralPrediction.findMany({ where: { poolId } }),
    prisma.groupStandingsPrediction.findMany({ where: { poolId } }),
    prisma.structuralPhaseResult.findMany({ where: { poolId } }),
    prisma.groupStandingsResult.findMany({ where: { poolId } }),
  ]);

  const structuralPicksByUser = new Map<string, Array<{ phaseId: string; pickJson: StructuralPickJson }>>();
  for (const sp of allStructuralPicks) {
    const userPicks = structuralPicksByUser.get(sp.userId) ?? [];
    userPicks.push({ phaseId: sp.phaseId, pickJson: typed<StructuralPickJson>(sp.pickJson) });
    structuralPicksByUser.set(sp.userId, userPicks);
  }

  for (const gsp of allGroupStandingsPicks) {
    const userPicks = structuralPicksByUser.get(gsp.userId) ?? [];
    let existingPhasePick = userPicks.find((p) => p.phaseId === gsp.phaseId);
    if (!existingPhasePick) {
      existingPhasePick = { phaseId: gsp.phaseId, pickJson: { groups: [] } };
      userPicks.push(existingPhasePick);
      structuralPicksByUser.set(gsp.userId, userPicks);
    }
    if (!existingPhasePick.pickJson.groups) existingPhasePick.pickJson.groups = [];
    existingPhasePick.pickJson.groups.push({ groupId: gsp.groupId, teamIds: gsp.teamIds });
  }

  const structuralResults = allStructuralResults.map((sr) => ({
    phaseId: sr.phaseId,
    resultJson: typed<StructuralPickJson>(sr.resultJson),
  }));

  const groupResultsByPhase = new Map<string, Array<{ groupId: string; teamIds: string[] }>>();
  for (const gsr of allGroupStandingsResults) {
    const groups = groupResultsByPhase.get(gsr.phaseId) ?? [];
    groups.push({ groupId: gsr.groupId, teamIds: gsr.teamIds });
    groupResultsByPhase.set(gsr.phaseId, groups);
  }

  groupResultsByPhase.forEach((groups, phaseId) => {
    const existing = structuralResults.find((sr) => sr.phaseId === phaseId);
    if (!existing) structuralResults.push({ phaseId, resultJson: { groups } });
  });

  // Convert knockout match results to structural format
  const knockoutPhases = ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "finals"];
  const pickTypesConfig = pool.pickTypesConfig as PhasePickConfig[] | null;

  if (pickTypesConfig) {
    for (const phaseId of knockoutPhases) {
      const phaseConfig = pickTypesConfig.find((p) => p.phaseId === phaseId);
      if (!phaseConfig?.structuralPicks || phaseConfig.structuralPicks.type !== "KNOCKOUT_WINNER") continue;

      const existingResult = structuralResults.find((sr) => sr.phaseId === phaseId);
      if (existingResult) continue;

      const phaseMatches = matches.filter((m) => m.phaseId === phaseId);
      if (phaseMatches.length === 0) continue;

      const knockoutMatches: Array<{ matchId: string; winnerId: string }> = [];

      for (const match of phaseMatches) {
        const result = resultByMatchId.get(match.id);
        if (!result) continue;

        let winnerId: string | null = null;
        if (result.homeGoals > result.awayGoals) {
          winnerId = match.homeTeamId;
        } else if (result.awayGoals > result.homeGoals) {
          winnerId = match.awayTeamId;
        } else {
          const homePens = result.homePenalties ?? 0;
          const awayPens = result.awayPenalties ?? 0;
          // Tied penalties (or missing data) must NOT invent a winner —
          // the old ternary silently declared the AWAY team on a tie
          // (audit F3-4). Leave winnerId null; the authoritative path
          // (structuralAutoPublish) owns the undecidable alert.
          if (homePens !== awayPens) {
            winnerId = homePens > awayPens ? match.homeTeamId : match.awayTeamId;
          }
        }

        if (winnerId) knockoutMatches.push({ matchId: match.id, winnerId });
      }

      if (knockoutMatches.length > 0) {
        structuralResults.push({ phaseId, resultJson: { matches: knockoutMatches } });
      }
    }
  }

  function scorePick(pick: PickJson | null | undefined, actualHome: number, actualAway: number) {
    const actualOutcome = outcomeFromScore(actualHome, actualAway);

    if (pick?.type === "OUTCOME") {
      const ok = pick.outcome === actualOutcome;
      const outcomePoints = ok ? preset.outcomePoints : 0;
      return {
        outcomePoints,
        exactScoreBonus: 0,
        totalPoints: outcomePoints,
        details: leaderboardVerbose ? { actualOutcome } : undefined,
      };
    }

    if (pick?.type === "SCORE") {
      const predictedOutcome = outcomeFromScore(pick.homeGoals!, pick.awayGoals!);
      const outcomeCorrect = predictedOutcome === actualOutcome;
      const outcomePoints = outcomeCorrect ? preset.outcomePoints : 0;
      const exact = pick.homeGoals === actualHome && pick.awayGoals === actualAway;
      const exactScoreBonus = preset.allowScorePick && exact && outcomeCorrect ? preset.exactScoreBonus : 0;

      return {
        outcomePoints,
        exactScoreBonus,
        totalPoints: outcomePoints + exactScoreBonus,
        details: leaderboardVerbose
          ? {
              predictedScore: { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
              actualScore: { homeGoals: actualHome, awayGoals: actualAway },
              predictedOutcome,
              actualOutcome,
              outcomeCorrect,
              exact,
            }
          : undefined,
      };
    }

    return {
      outcomePoints: 0,
      exactScoreBonus: 0,
      totalPoints: 0,
      details: leaderboardVerbose ? { unsupportedPickType: pick?.type ?? null } : undefined,
    };
  }

  // Compute ordered phase list
  const phaseOrder: string[] = [];
  for (const m of matches) {
    if (!phaseOrder.includes(m.phaseId)) phaseOrder.push(m.phaseId);
  }

  // Build the structural universe once — group ids per GROUP_STANDINGS phase
  // and match ids per KNOCKOUT_WINNER phase. The breakdown helper uses these
  // to emit a row even when a user did not predict / a result is not yet
  // published, so the UI can show "Sin pick" / "Por jugar" placeholders
  // instead of dropping the row entirely.
  const knockoutMatchUniverse: Array<{ phaseId: string; matchId: string }> = [];
  const groupUniverse: Array<{ phaseId: string; groupId: string }> = [];
  if (pickTypesConfig) {
    for (const phaseConfig of pickTypesConfig) {
      const sp = phaseConfig.structuralPicks;
      if (!sp) continue;
      if (sp.type === "GROUP_STANDINGS") {
        const seen = new Set<string>();
        for (const mm of matches) {
          if (mm.phaseId !== phaseConfig.phaseId) continue;
          const gid = mm.groupId;
          if (!gid || seen.has(gid)) continue;
          seen.add(gid);
          groupUniverse.push({ phaseId: phaseConfig.phaseId, groupId: gid });
        }
      } else if (sp.type === "KNOCKOUT_WINNER") {
        for (const mm of matches) {
          if (mm.phaseId === phaseConfig.phaseId) {
            knockoutMatchUniverse.push({ phaseId: phaseConfig.phaseId, matchId: mm.id });
          }
        }
      }
    }
  }

  // Pool-level preset mode (used by the frontend to switch leaderboard /
  // PlayerSummary into Estratega rendering when every configured phase is
  // structural).
  let structuralPhaseCount = 0;
  let scorePhaseCount = 0;
  if (pickTypesConfig) {
    for (const phaseConfig of pickTypesConfig) {
      if (phaseConfig.structuralPicks) structuralPhaseCount += 1;
      if (phaseConfig.requiresScore && phaseConfig.matchPicks) scorePhaseCount += 1;
    }
  }
  const presetMode: "STRUCTURAL" | "SCORE" | "MIXED" =
    structuralPhaseCount > 0 && scorePhaseCount === 0
      ? "STRUCTURAL"
      : structuralPhaseCount === 0 && scorePhaseCount > 0
        ? "SCORE"
        : structuralPhaseCount > 0 && scorePhaseCount > 0
          ? "MIXED"
          : "SCORE"; // legacy pools with no pickTypesConfig fall back to score-based

  const emptyStructuralStats: StructuralStatsSummary = {
    positionsCorrect: 0,
    positionsTotal: 0,
    perfectGroups: 0,
    totalGroups: 0,
    winnersByPhase: {},
  };

  const scoringErrors: Array<{ userId: string; error: string }> = [];

  // ── Tiebreaker metrics (TIEBREAKER_PLAN.md) ───────────────────────────
  // "Perfect" = earned the MAX achievable for that match; "partial" =
  // earned >0 but < max. The per-match max is independent of the actual
  // result (a prediction equal to the result hits every criterion except
  // the XOR PARTIAL_SCORE), so we cache it per phaseId. `partialApplicable`
  // = the mode can produce a partial at all (else the column is hidden).
  const legacyMaxPerMatch =
    preset.outcomePoints + (preset.allowScorePick ? preset.exactScoreBonus : 0);
  const maxByPhaseId = new Map<string, number>();
  let partialApplicable = false;
  {
    const cfgs = (pool.pickTypesConfig as PhasePickConfig[] | null) ?? null;
    if (cfgs && cfgs.length > 0) {
      for (const pc of cfgs) {
        if (pc.requiresScore && pc.matchPicks) {
          const probe = { homeGoals: 1, awayGoals: 0 };
          maxByPhaseId.set(pc.phaseId, scoreMatchPick(probe, probe, pc).totalPoints);
          if (pc.matchPicks.types.filter((t) => t.enabled).length >= 2) {
            partialApplicable = true;
          }
        } else if (!pc.requiresScore && pc.structuralPicks?.type === "GROUP_STANDINGS") {
          partialApplicable = true; // a group can be partially correct
        }
      }
    } else if (preset.allowScorePick) {
      // Legacy preset pools: outcome-only hit (no exact) is a partial.
      partialApplicable = true;
    }
  }

  // ── Evolución capture (rides this same cached compute, ADR-079) ──────────
  // Record each member's per-MATCH points increment exactly as the loop below
  // computes it, so the Evolución chart's cumulative series uses the SAME
  // numbers as the leaderboard (zero divergence, zero extra scoring pass).
  // Structural (per-phase) points are NOT captured here. userId → matchId → pts.
  const matchPointsByUser = new Map<string, Map<string, number>>();
  const recordMatchPoints = (userId: string, matchId: string, pts: number) => {
    let byMatch = matchPointsByUser.get(userId);
    if (!byMatch) {
      byMatch = new Map<string, number>();
      matchPointsByUser.set(userId, byMatch);
    }
    byMatch.set(matchId, pts);
  };

  // The most recent finalized + scoring-enabled match(es) — the period the
  // leaderboard "puntos ganados / posiciones movidas" columns describe.
  const lastStep = computeLastStep({
    matches,
    teamById,
    finalizedMatchIds: new Set(resultByMatchId.keys()),
    scoringDisabledMatchIds: new Set(
      matchOverrides.filter((o) => !o.scoringEnabled).map((o) => o.matchId),
    ),
  });

  const leaderboardRows = members.map((m) => {
    let points = 0;
    let scoredMatches = 0;
    let perfectCount = 0;
    let partialCount = 0;
    const pointsByPhase: Record<string, number> = {};

    for (const ph of phaseOrder) pointsByPhase[ph] = 0;

    const byMatch = predsByUserMatch.get(m.userId) ?? new Map<string, PickJson>();
    const breakdown: Array<Record<string, unknown>> = [];

    for (const match of matches) {
      const pick = byMatch.get(match.id);
      const r = resultByMatchId.get(match.id);

      const matchOverride = overrideByMatchId.get(match.id);
      if (matchOverride && !matchOverride.scoringEnabled) {
        if (leaderboardVerbose) {
          breakdown.push({ matchId: match.id, status: "SCORING_DISABLED", reason: matchOverride.reason });
        }
        continue;
      }

      if (!r) {
        if (leaderboardVerbose) {
          breakdown.push({ matchId: match.id, status: pick ? "PICKED_NO_RESULT" : "NO_PICK_NO_RESULT" });
        }
        continue;
      }

      if (!pick) {
        if (leaderboardVerbose) {
          breakdown.push({
            matchId: match.id,
            status: "NO_PICK",
            result: r,
            points: { outcomePoints: 0, exactScoreBonus: 0, totalPoints: 0 },
          });
        }
        continue;
      }

      // Advanced scoring
      if (pool.pickTypesConfig && Array.isArray(pool.pickTypesConfig)) {
        const phaseConfigs = pool.pickTypesConfig as PhasePickConfig[];
        const phaseConfig = phaseConfigs.find((p) => p.phaseId === match.phaseId);

        if (phaseConfig && phaseConfig.requiresScore && phaseConfig.matchPicks) {
          if (pick.type === "SCORE" && typeof pick.homeGoals === "number" && typeof pick.awayGoals === "number") {
            try {
              const resultForScoring = {
                homeGoals: phaseConfig.includeExtraTime ? r.homeGoals : (r.homeGoals90 ?? r.homeGoals),
                awayGoals: phaseConfig.includeExtraTime ? r.awayGoals : (r.awayGoals90 ?? r.awayGoals),
              };
              const advancedResult = scoreMatchPick(
                { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
                resultForScoring,
                phaseConfig,
              );

              points += advancedResult.totalPoints;
              recordMatchPoints(m.userId, match.id, advancedResult.totalPoints);
              pointsByPhase[match.phaseId] = (pointsByPhase[match.phaseId] ?? 0) + advancedResult.totalPoints;
              scoredMatches += 1;

              const maxForMatch = maxByPhaseId.get(match.phaseId) ?? 0;
              if (maxForMatch > 0 && advancedResult.totalPoints >= maxForMatch) perfectCount++;
              else if (advancedResult.totalPoints > 0) partialCount++;

              if (leaderboardVerbose) {
                breakdown.push({
                  matchId: match.id,
                  pick,
                  result: r,
                  points: { totalPoints: advancedResult.totalPoints },
                  evaluations: advancedResult.evaluations,
                  status: "SCORED_ADVANCED",
                });
              }
              continue;
            } catch (err) {
              console.error(`Advanced scoring failed for match ${match.id}, falling back to legacy:`, err);
            }
          }
        }
      }

      // Legacy scoring
      const phaseConfigs2 = pool.pickTypesConfig as PhasePickConfig[] | null;
      const phaseConfig2 = phaseConfigs2?.find((p) => p.phaseId === match.phaseId);
      const legacyHome = phaseConfig2?.includeExtraTime ? r.homeGoals : (r.homeGoals90 ?? r.homeGoals);
      const legacyAway = phaseConfig2?.includeExtraTime ? r.awayGoals : (r.awayGoals90 ?? r.awayGoals);
      const scored = scorePick(pick, legacyHome, legacyAway);
      points += scored.totalPoints;
      recordMatchPoints(m.userId, match.id, scored.totalPoints);
      pointsByPhase[match.phaseId] = (pointsByPhase[match.phaseId] ?? 0) + scored.totalPoints;
      scoredMatches += 1;

      if (legacyMaxPerMatch > 0 && scored.totalPoints >= legacyMaxPerMatch) perfectCount++;
      else if (scored.totalPoints > 0) partialCount++;

      if (leaderboardVerbose) {
        breakdown.push({
          matchId: match.id,
          pick,
          result: r,
          points: { outcomePoints: scored.outcomePoints, exactScoreBonus: scored.exactScoreBonus, totalPoints: scored.totalPoints },
          details: scored.details,
          status: "SCORED",
        });
      }
    }

    // Structural points — desagregated by phase + summarized for the
    // leaderboard. The aggregated total is added to `points`, and each
    // phase's contribution lands in `pointsByPhase` (previously these
    // were lumped together at the row total, producing 0 in every phase
    // column for Estratega pools).
    let structuralPoints = 0;
    let structuralStats: StructuralStatsSummary = emptyStructuralStats;

    if (pickTypesConfig && pickTypesConfig.length > 0) {
      const userStructuralPicks = structuralPicksByUser.get(m.userId) || [];
      try {
        const breakdown = computeStructuralBreakdown(
          userStructuralPicks,
          structuralResults,
          pickTypesConfig,
          knockoutMatchUniverse,
          groupUniverse,
        );
        structuralPoints = breakdown.totalPoints;
        structuralStats = summarizeStructural(breakdown);
        for (const [phaseId, pts] of Object.entries(breakdown.pointsByPhase)) {
          pointsByPhase[phaseId] = (pointsByPhase[phaseId] ?? 0) + pts;
        }
        // Structural contribution to tiebreaker counts (D3): a fully-correct
        // group or a correct knockout winner = "perfect" unit; a group with
        // some (but not all) positions right = "partial" unit. Knockout is
        // binary, so it only ever adds perfects.
        for (const g of breakdown.groups) {
          if (g.positionsTotal > 0 && g.positionsCorrect === g.positionsTotal) perfectCount++;
          else if (g.positionsCorrect > 0) partialCount++;
        }
        for (const w of Object.values(breakdown.winnersByPhase)) {
          perfectCount += w.correct;
        }
      } catch (err) {
        console.error(
          `[SCORING_ERROR] Structural points failed for user ${m.userId} in pool ${pool.id}:`,
          err instanceof Error ? err.message : err,
        );
        scoringErrors.push({ userId: m.userId, error: err instanceof Error ? err.message : "Unknown scoring error" });
      }
    }

    return {
      userId: m.userId,
      memberId: m.id,
      displayName: m.user.displayName,
      email: m.user.email,
      role: m.role,
      memberStatus: m.status,
      points: points + structuralPoints,
      matchPickPoints: points,
      structuralPickPoints: structuralPoints,
      perfectCount,
      partialCount,
      structuralStats,
      pointsByPhase,
      scoredMatches,
      joinedAtUtc: m.joinedAtUtc,
      // Points this member earned in the most recent match(es) — for the
      // standings "puntos ganados / posiciones movidas" columns.
      lastGainPoints: lastStep
        ? lastStep.matchIds.reduce((s, mid) => s + (matchPointsByUser.get(m.userId)?.get(mid) ?? 0), 0)
        : 0,
      breakdown: leaderboardVerbose ? breakdown : undefined,
    };
  });

  // Single source of truth: sort by tiebreakers and assign shared ranks
  // (TIEBREAKER_PLAN.md). Same function used by the pool-completed email.
  const rankedRows = rankLeaderboardRows(leaderboardRows);

  // Rank each member as they stood BEFORE the last match(es), so the standings
  // can show how many positions they climbed/dropped. Reuses the canonical
  // ranker on a before-points snapshot (perfect/partial tiebreakers stay
  // current-state — close enough for a movement indicator).
  const rankBeforeByUser = new Map<string, number>();
  if (lastStep) {
    const beforeRanked = rankLeaderboardRows(
      leaderboardRows.map((r) => ({ ...r, points: r.points - r.lastGainPoints })),
    );
    for (const x of beforeRanked) rankBeforeByUser.set(x.row.userId, x.rank);
  }

  // Bar-chart-race series (cumulative points per finalized match) for the
  // animated "Evolución" view. Full + user-agnostic; curated per viewer at the
  // dedicated endpoint. Built from the same per-match increments (no extra pass).
  const barRace = buildBarRaceSeries({
    matches,
    teamById,
    finalizedMatchIds: new Set(resultByMatchId.keys()),
    scoringDisabledMatchIds: new Set(
      matchOverrides.filter((o) => !o.scoringEnabled).map((o) => o.matchId),
    ),
    members: members.map((m) => ({ userId: m.userId, displayName: m.user.displayName })),
    pointsByUserMatch: matchPointsByUser,
    resultByMatchId,
  });

    return { rankedRows, predictedCountByMatch, phaseOrder, presetMode, partialApplicable, lastStep, rankBeforeByUser, barRace };
  };
  const leaderboardBundle = leaderboardVerbose
    ? await computeLeaderboardBundle()
    : await getOrComputeLeaderboard(poolId, leaderboardFingerprint, computeLeaderboardBundle);

  // 7b) Knockout extra-time config (v2) — gated by the VIEWING user's email so
  // it ships to one host first. Computed from already-loaded data; the heavy
  // path (and the extra user lookup) is skipped entirely for everyone else.
  type ExtraTimeBlock = {
    enabled: boolean;
    isScorePool: boolean;
    windowOpen: boolean;
    windowReason: string;
    needsBanner: boolean;
    phases: Array<{ phaseId: string; phaseName: string; includeExtraTime: boolean }>;
  };
  let extraTime: ExtraTimeBlock = {
    enabled: false, isScorePool: false, windowOpen: false, windowReason: "OPEN", needsBanner: false, phases: [],
  };
  if (!publicMode) {
    // Avoid an extra user lookup on this hot endpoint unless the allowlist is a
    // specific list: ""→off and "*"→all both resolve without the viewer's email.
    const rawAllowlist = (process.env.EXTRA_TIME_CONFIG_ALLOWLIST ?? "").trim();
    let flagOn = rawAllowlist === "*";
    if (!flagOn && rawAllowlist !== "") {
      const viewerEmail = (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email ?? null;
      flagOn = isExtraTimeConfigEnabled(viewerEmail);
    }
    if (flagOn) {
      const etPhases = extractPhases(snapshot);
      const koScorePhases = getKnockoutScorePhases(etPhases, pool.pickTypesConfig as PhasePickConfig[] | null);
      if (koScorePhases.length > 0) {
        const finalizedMatchIds = new Set(
          results
            .filter((r) => r.currentVersion && FINAL_RESULT_SOURCES.has(r.currentVersion.source))
            .map((r) => r.matchId),
        );
        const win = computeExtraTimeWindow({ phases: etPhases, matches, finalizedMatchIds, now: now.getTime() });
        const isHost = isPoolAdmin(myMembership.role);
        const acked = !!(myMembership as { extraTimeBannerAckAt?: Date | null }).extraTimeBannerAckAt;
        extraTime = {
          enabled: true,
          isScorePool: true,
          windowOpen: win.open,
          windowReason: win.reason,
          needsBanner: isHost && win.open && !acked,
          phases: koScorePhases,
        };
      } else {
        extraTime = { ...extraTime, enabled: true };
      }
    }
  }

  // 8) Final response
  const includeEmails = isPoolAdmin(myMembership.role);
  return {
    extraTime,
    nowUtc: now.toISOString(),
    pool: {
      id: pool.id,
      name: pool.name,
      description: pool.description,
      visibility: pool.visibility,
      status: pool.status,
      timeZone: pool.timeZone,
      deadlineMinutesBeforeKickoff: pool.deadlineMinutesBeforeKickoff,
      tournamentInstanceId: pool.tournamentInstanceId,
      createdByUserId: pool.createdByUserId,
      createdAtUtc: pool.createdAtUtc,
      updatedAtUtc: pool.updatedAtUtc,
      scoringPresetKey: pool.scoringPresetKey ?? "CLASSIC",
      pickTypesConfig: pool.pickTypesConfig,
      autoAdvanceEnabled: pool.autoAdvanceEnabled,
      requireApproval: pool.requireApproval,
      // Capricho San (ADR-075): `available` is env-gated (gifted pools
      // only) — the host settings card renders only when true.
      caprichoSan: {
        available: isCaprichoSanPool(pool.id),
        enabled: pool.caprichoSanEnabled,
        min: pool.caprichoSanMin,
        max: pool.caprichoSanMax,
      },
      maxParticipants: pool.maxParticipants,
      lockedPhases: pool.lockedPhases as string[],
      organizationId: pool.organizationId ?? null,
      organization: pool.organization
        ? {
            id: pool.organization.id,
            name: pool.organization.name,
            logoBase64: pool.organization.logoBase64 ?? null,
            welcomeMessage: pool.organization.welcomeMessage ?? null,
            invitationMessage: pool.organization.invitationMessage ?? null,
            primaryColor: pool.organization.primaryColor ?? null,
            secondaryColor: pool.organization.secondaryColor ?? null,
            invitationLocale: pool.organization.invitationLocale as "es" | "en" | "pt",
          }
        : null,
    },
    myMembership: {
      id: myMembership.id,
      userId: myMembership.userId,
      role: myMembership.role,
      status: myMembership.status,
      joinedAtUtc: myMembership.joinedAtUtc,
    },
    counts: { membersActive },
    tournamentInstance: {
      id: pool.tournamentInstance.id,
      name: pool.tournamentInstance.name,
      status: pool.tournamentInstance.status,
      templateId: pool.tournamentInstance.templateId,
      templateVersionId: pool.tournamentInstance.templateVersionId,
      templateKey: pool.tournamentInstance.template?.key ?? null,
      dataJson: pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson,
      // Admin knockout-release gate (ADR-084): drives the player-facing phase
      // state (Pendiente / Confirmando / Abierta / Finalizada).
      knockoutRelease: {
        gateEnabled: pool.tournamentInstance.knockoutReleaseGateEnabled,
        releasedPhases: (pool.tournamentInstance.releasedKnockoutPhases as string[] | null) ?? [],
      },
    },
    permissions: {
      canManageResults: isPoolAdmin(myMembership.role),
      canInvite: isPoolAdmin(myMembership.role),
    },
    matches: matchCards.map((c) => ({
      ...c,
      // Prediction-status badge data (ADR-077). predictionStatusEnabled gates
      // visibility client-side; predictedCount is the badge numerator (the
      // denominator is counts.membersActive).
      predictedCount: leaderboardBundle.predictedCountByMatch.get(c.id) ?? 0,
      predictionStatusEnabled,
    })),
    leaderboard: {
      scoring: { outcomePoints: preset.outcomePoints, exactScoreBonus: preset.exactScoreBonus },
      scoringPreset: {
        key: preset.key,
        name: preset.name,
        description: preset.description,
        allowScorePick: preset.allowScorePick,
      },
      verbose: leaderboardVerbose,
      phases: leaderboardBundle.phaseOrder,
      presetMode: leaderboardBundle.presetMode,
      // Which tiebreaker columns are meaningful for this pool (D4).
      tiebreakers: { perfect: true, partial: leaderboardBundle.partialApplicable },
      // "Puntos ganados / posiciones movidas" in the most recent match(es).
      // Gated per-pool (LEADERBOARD_DELTA_ALLOWLIST) while in beta.
      deltaEnabled: isLeaderboardDeltaEnabledForPool(poolId),
      // Animated bar-chart-race "Evolución" — beta-gated per pool. Hidden for
      // structural-only (Estratega) pools: their points are per-phase, not
      // per-match, so the match-by-match race would be all zeros (review B1).
      barRaceEnabled: isBarRaceEnabledForPool(poolId) && leaderboardBundle.presetMode !== "STRUCTURAL",
      lastStep: leaderboardBundle.lastStep,
      rows: leaderboardBundle.rankedRows.map(({ row: r, rank, tiedGroupSize }) => ({
        rank,
        isTied: tiedGroupSize > 1,
        userId: r.userId,
        memberId: r.memberId,
        displayName: r.displayName,
        ...(includeEmails ? { email: r.email } : {}),
        role: r.role,
        memberStatus: r.memberStatus,
        points: r.points,
        matchPickPoints: r.matchPickPoints,
        structuralPickPoints: r.structuralPickPoints,
        perfectCount: r.perfectCount,
        partialCount: r.partialCount,
        structuralStats: r.structuralStats,
        pointsByPhase: r.pointsByPhase,
        scoredMatches: r.scoredMatches,
        joinedAtUtc: r.joinedAtUtc,
        // Last-match delta: points gained + positions climbed (+) / dropped (−).
        lastGainPoints: r.lastGainPoints,
        lastRankDelta: leaderboardBundle.lastStep
          ? (leaderboardBundle.rankBeforeByUser.get(r.userId) ?? rank) - rank
          : 0,
        ...(leaderboardVerbose ? { breakdown: r.breakdown } : {}),
      })),
    },
    // Full bar-race series (lazy — only when the dedicated endpoint asks). The
    // dedicated endpoint curates it per viewer before it reaches the client.
    ...(includeBarRace ? { barRace: leaderboardBundle.barRace } : {}),
  };
}

/**
 * Bar-chart-race series for a pool, curated for the viewer (everyone who ever
 * reached the top-N at any step, plus the viewer). Reuses the cached leaderboard
 * bundle (ADR-079) — no extra scoring pass. Permission / NOT_FOUND inherited
 * from getPoolOverview.
 */
export async function getPoolBarRace(userId: string, poolId: string) {
  const overview = await getPoolOverview(userId, poolId, false, true);
  // Structural (Estratega) pools have no per-match points → would be all zeros.
  if (!overview.barRace || overview.leaderboard.presetMode === "STRUCTURAL") return { barRace: null };
  return {
    barRace: curateBarRaceForViewer({ series: overview.barRace, viewerUserId: userId }),
  };
}

/**
 * Get-or-create the short public share code for a pool's "Evolución" link.
 * Member-only, and only when the bar race is enabled for the pool. Returns just
 * the code — the frontend builds the full `…/e/{code}` URL.
 */
export async function getOrCreateShareCode(userId: string, poolId: string): Promise<{ shareCode: string }> {
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: { in: ["ACTIVE", "LEFT"] } },
    select: { id: true },
  });
  if (!member) throw new ServiceError("FORBIDDEN", 403);
  if (!isBarRaceEnabledForPool(poolId)) throw new ServiceError("FORBIDDEN", 403, { message: "Bar race not enabled" });

  const pool = await prisma.pool.findUnique({ where: { id: poolId }, select: { shareCode: true } });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);
  if (pool.shareCode) return { shareCode: pool.shareCode };

  // Generate a unique short code (retry on the rare unique collision).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomBytes(6).toString("base64url"); // ~8 url-safe chars
    try {
      await prisma.pool.update({ where: { id: poolId }, data: { shareCode: code } });
      return { shareCode: code };
    } catch (e) {
      // Only a unique-constraint collision (P2002) is retryable; surface any
      // other DB error instead of masking it as a 409. Matches the
      // `(err as any)?.code === "P2002"` convention used in paymentService.
      if ((e as { code?: string })?.code !== "P2002") throw e;
      const fresh = await prisma.pool.findUnique({ where: { id: poolId }, select: { shareCode: true } });
      if (fresh?.shareCode) return { shareCode: fresh.shareCode }; // set concurrently
    }
  }
  throw new ServiceError("CONFLICT", 409, { message: "Could not allocate share code" });
}

/**
 * Public (no-auth) bar-race for a shared link. Resolves the pool by its share
 * code and returns the curated race (anonymous: top-N, no viewer highlight),
 * the pool name and tournament key (for flags). barRace=null when the feature
 * is off or the pool is structural-only.
 */
export async function getPublicBarRace(shareCode: string) {
  const pool = await prisma.pool.findUnique({ where: { shareCode }, select: { id: true } });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  const overview = await getPoolOverview("", pool.id, false, true, true);
  const enabled = isBarRaceEnabledForPool(pool.id) && overview.leaderboard.presetMode !== "STRUCTURAL";
  const curated = enabled && overview.barRace
    ? curateBarRaceForViewer({ series: overview.barRace, viewerUserId: "" })
    : null;
  // Anonymize: this is a no-auth payload, so strip real user IDs (used only as
  // an opaque animation/React key client-side) and replace with synthetic
  // indices. isViewer is always false in public mode, so nothing depends on them.
  const barRace = curated
    ? { ...curated, players: curated.players.map((p, i) => ({ ...p, userId: `p${i}` })) }
    : null;
  return {
    barRace,
    // Pool name / tournament key are intentionally public ONLY when the race is
    // available (for the OG/WhatsApp preview); a de-allowlisted or structural
    // pool with a stale shareCode discloses nothing.
    poolName: enabled ? overview.pool.name : "",
    tournamentKey: enabled ? overview.tournamentInstance.templateKey ?? "" : "",
  };
}
