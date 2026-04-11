/**
 * Pool Overview Service — Pure business logic for the pool overview endpoint.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Side effects are fire-and-forget but logged on failure.
 */

import { prisma } from "../db";
import { getScoringPreset } from "../lib/scoringPresets";
import { isPoolAdmin } from "../lib/roles";
import {
  extractMatches,
  extractTeams,
  typed,
  type PickJson,
  type StructuralPickJson,
} from "../lib/fixture";
import { scoreMatchPick } from "../lib/scoringAdvanced";
import { scoreUserStructuralPicks } from "./structuralScoring";
import { outcomeFromScore } from "../lib/poolHelpers";
import type { PhasePickConfig } from "../types/pickConfig";
import { ServiceError } from "./authService";

// ─── Pool Overview ───────────────────────────────────────────

export async function getPoolOverview(
  userId: string,
  poolId: string,
  leaderboardVerbose: boolean,
) {
  // 1) Permission: must be ACTIVE or LEFT (LEFT = read-only)
  const myMembership = await prisma.poolMember.findFirst({
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
      organization: { select: { id: true, name: true, logoBase64: true, welcomeMessage: true } },
    },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);
  if (!pool.tournamentInstance) throw new ServiceError("CONFLICT", 409, { message: "Pool has no tournamentInstance" });

  const preset = getScoringPreset(pool.scoringPresetKey);
  const membersActive = await prisma.poolMember.count({ where: { poolId, status: "ACTIVE" } });

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

  // 7) Leaderboard
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
          if (homePens > 0 || awayPens > 0) {
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

  const scoringErrors: Array<{ userId: string; error: string }> = [];

  const leaderboardRows = members.map((m) => {
    let points = 0;
    let scoredMatches = 0;
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
              pointsByPhase[match.phaseId] = (pointsByPhase[match.phaseId] ?? 0) + advancedResult.totalPoints;
              scoredMatches += 1;

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
      pointsByPhase[match.phaseId] = (pointsByPhase[match.phaseId] ?? 0) + scored.totalPoints;
      scoredMatches += 1;

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

    // Structural points
    let structuralPoints = 0;

    if (pool.pickTypesConfig && Array.isArray(pool.pickTypesConfig) && structuralResults.length > 0) {
      const userStructuralPicks = structuralPicksByUser.get(m.userId) || [];
      if (userStructuralPicks.length > 0) {
        try {
          structuralPoints = scoreUserStructuralPicks(
            userStructuralPicks,
            structuralResults,
            pool.pickTypesConfig as PhasePickConfig[],
          );
        } catch (err) {
          console.error(`[SCORING_ERROR] Structural points failed for user ${m.userId} in pool ${pool.id}:`, err instanceof Error ? err.message : err);
          scoringErrors.push({ userId: m.userId, error: err instanceof Error ? err.message : "Unknown scoring error" });
        }
      }
    }

    return {
      userId: m.userId,
      memberId: m.id,
      displayName: m.user.displayName,
      role: m.role,
      memberStatus: m.status,
      points: points + structuralPoints,
      matchPickPoints: points,
      structuralPickPoints: structuralPoints,
      pointsByPhase,
      scoredMatches,
      joinedAtUtc: m.joinedAtUtc,
      breakdown: leaderboardVerbose ? breakdown : undefined,
    };
  });

  leaderboardRows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aTime = a.joinedAtUtc instanceof Date ? a.joinedAtUtc.getTime() : new Date(a.joinedAtUtc).getTime();
    const bTime = b.joinedAtUtc instanceof Date ? b.joinedAtUtc.getTime() : new Date(b.joinedAtUtc).getTime();
    return aTime - bTime;
  });

  // 8) Final response
  return {
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
      maxParticipants: pool.maxParticipants,
      lockedPhases: pool.lockedPhases as string[],
      organizationId: pool.organizationId ?? null,
      organization: pool.organization
        ? {
            id: pool.organization.id,
            name: pool.organization.name,
            logoBase64: pool.organization.logoBase64 ?? null,
            welcomeMessage: pool.organization.welcomeMessage ?? null,
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
    },
    permissions: {
      canManageResults: isPoolAdmin(myMembership.role),
      canInvite: isPoolAdmin(myMembership.role),
    },
    matches: matchCards,
    leaderboard: {
      scoring: { outcomePoints: preset.outcomePoints, exactScoreBonus: preset.exactScoreBonus },
      scoringPreset: {
        key: preset.key,
        name: preset.name,
        description: preset.description,
        allowScorePick: preset.allowScorePick,
      },
      verbose: leaderboardVerbose,
      phases: phaseOrder,
      rows: leaderboardRows.map((r, idx) => ({
        rank: idx + 1,
        userId: r.userId,
        memberId: r.memberId,
        displayName: r.displayName,
        role: r.role,
        memberStatus: r.memberStatus,
        points: r.points,
        pointsByPhase: r.pointsByPhase,
        scoredMatches: r.scoredMatches,
        joinedAtUtc: r.joinedAtUtc,
        ...(leaderboardVerbose ? { breakdown: r.breakdown } : {}),
      })),
    },
  };
}
