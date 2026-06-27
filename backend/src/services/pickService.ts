/**
 * Pick Service — Pure business logic for pick (prediction) flows.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Audit context (ip, userAgent) passed as a separate object.
 *   - Side effects (audit) are fire-and-forget but logged on failure.
 */

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { canMakePicks } from "./poolStateMachine";
import { extractMatches, extractPhases } from "../lib/fixture";
import { PLACEHOLDER_TEAM_PREFIXES } from "../lib/constants";
import { fireAndForget } from "../lib/asyncHelpers";
import { ServiceError, type AuditContext } from "./authService";

// ─── Helpers ─────────────────────────────────────────────────

/** Compute the deadline UTC time for a match based on pool config. */
export function computeDeadlineUtc(kickoffUtcIso: string, minutesBefore: number): Date | null {
  const kickoff = new Date(kickoffUtcIso);
  if (Number.isNaN(kickoff.getTime())) return null;
  return new Date(kickoff.getTime() - minutesBefore * 60_000);
}

/** Check if a user is an ACTIVE member of the pool — required for writes
 *  (creating / editing picks). LEFT members must NOT pass this check. */
export async function requireActivePoolMember(userId: string, poolId: string): Promise<boolean> {
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  return member != null;
}

/** Check if a user can READ pool / match / pick data — looser than
 *  `requireActivePoolMember` because LEFT members retain read-only access
 *  to preserve their points and history (see CLAUDE.md §6 invariant 4).
 *  Use this for any endpoint that returns data, not mutates it. */
export async function requirePoolMemberReadAccess(userId: string, poolId: string): Promise<boolean> {
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: { in: ["ACTIVE", "LEFT"] } },
  });
  return member != null;
}

// ─── Types ───────────────────────────────────────────────────

export type PickData = {
  type: string;
  outcome?: string;
  homeGoals?: number;
  awayGoals?: number;
  winnerTeamId?: string;
};

export type GetPoolMatchesInput = {
  userId: string;
  poolId: string;
};

export type EnrichedMatch = {
  id: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  deadlineUtc: string | null;
  isLocked: boolean;
  [key: string]: unknown;
};

export type GetPoolMatchesResult = {
  pool: {
    id: string;
    name: string;
    timeZone: string;
    deadlineMinutesBeforeKickoff: number;
    tournamentInstanceId: string;
  };
  nowUtc: string;
  matches: EnrichedMatch[];
};

export type UpsertPickInput = {
  userId: string;
  poolId: string;
  matchId: string;
  pick: PickData;
};

export type UpsertPickResult = {
  prediction: Record<string, unknown>;
};

export type GetMatchPicksInput = {
  userId: string;
  poolId: string;
  matchId: string;
};

export type MatchPickEntry = {
  userId: string;
  displayName: string;
  pick: unknown;
  isCurrentUser: boolean;
};

export type GetMatchPicksResult = {
  matchId: string;
  deadlineUtc: string;
  isUnlocked: boolean;
  message?: string;
  picks: MatchPickEntry[];
};

export type GetMyPicksInput = {
  userId: string;
  poolId: string;
};

export type GetMyPicksResult = {
  picks: Record<string, unknown>[];
};

// ─── Service Functions ───────────────────────────────────────

// -- Get Pool Matches --

export async function getPoolMatches(data: GetPoolMatchesInput): Promise<GetPoolMatchesResult> {
  const { userId, poolId } = data;

  // READ access: LEFT members can still list matches (their picks stay
  // visible in read-only mode — see CLAUDE.md §6 invariant 4).
  const isMember = await requirePoolMemberReadAccess(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  // Pool independence (CLAUDE.md §6 invariant 6): every pool carries its
  // own fixtureSnapshot so per-pool customisations (custom kickoffs,
  // locally-generated knockout matches after auto-advance) stay
  // isolated from the master template. Fall back to instance.dataJson
  // for legacy pools that predate the snapshot.
  const fixtureData = pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson;
  const matches = extractMatches(fixtureData);
  const now = new Date();
  const lockedPhases = (pool.lockedPhases as string[] | null) ?? [];

  const enriched = matches.map((m) => {
    const deadlineUtc = computeDeadlineUtc(m.kickoffUtc, pool.deadlineMinutesBeforeKickoff);
    const isPhaseLocked = m.phaseId ? lockedPhases.includes(m.phaseId) : false;
    const isLocked = isPhaseLocked || (deadlineUtc ? now.getTime() >= deadlineUtc.getTime() : false);

    return {
      ...m,
      deadlineUtc: deadlineUtc ? deadlineUtc.toISOString() : null,
      isLocked,
    };
  });

  return {
    pool: {
      id: pool.id,
      name: pool.name,
      timeZone: pool.timeZone,
      deadlineMinutesBeforeKickoff: pool.deadlineMinutesBeforeKickoff,
      tournamentInstanceId: pool.tournamentInstanceId,
    },
    nowUtc: now.toISOString(),
    matches: enriched,
  };
}

// -- Upsert Pick --

export async function upsertPick(
  data: UpsertPickInput,
  ctx: AuditContext,
): Promise<UpsertPickResult> {
  const { userId, poolId, matchId, pick } = data;

  const isMember = await requireActivePoolMember(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  // Validate pool status allows picks
  if (!canMakePicks(pool.status)) {
    const code = pool.status === "DRAFT" ? "POOL_DRAFT" : "CONFLICT";
    throw new ServiceError(code, 409, { message: "Cannot make picks in this pool status", poolStatus: pool.status });
  }

  // Do not allow picks on archived instances
  if (pool.tournamentInstance.status === "ARCHIVED") {
    throw new ServiceError("CONFLICT", 409, { message: "TournamentInstance is ARCHIVED" });
  }

  // Read the per-pool snapshot first so this lookup matches what the
  // overview / matches list show — see getPoolMatches above and
  // CLAUDE.md §6 invariant 6.
  const fixtureData = pool.fixtureSnapshot ?? pool.tournamentInstance.dataJson;
  const matches = extractMatches(fixtureData);
  const match = matches.find((m) => m.id === matchId);
  if (!match) throw new ServiceError("NOT_FOUND", 404, { message: "Match not found in instance snapshot" });

  // Block picks on placeholder matches (teams not yet determined)
  const isPlaceholder = (teamId: string) =>
    PLACEHOLDER_TEAM_PREFIXES.some((p: string) => teamId === p || teamId.startsWith(p));
  if (isPlaceholder(match.homeTeamId) || isPlaceholder(match.awayTeamId)) {
    throw new ServiceError("MATCH_PENDING", 409, { message: "Cannot make picks on matches with teams not yet determined" });
  }

  // Host can manually lock a phase to freeze picks while preparing
  // errata results. The lock takes precedence over the kickoff
  // deadline — if the host locked a phase whose deadline hasn't yet
  // passed, this is the gate that catches it.
  const lockedPhases = (pool.lockedPhases as string[] | null) ?? [];
  if (match.phaseId && lockedPhases.includes(match.phaseId)) {
    throw new ServiceError("PHASE_LOCKED", 409, {
      message: "Phase is locked by the host",
      phaseId: match.phaseId,
    });
  }

  // Admin knockout-release gate (ADR-084): when enabled for the instance, a
  // knockout phase the admin hasn't released yet is closed to predictions
  // (instance-level; hosts cannot bypass). Default-off → other tournaments
  // are unaffected.
  if (pool.tournamentInstance.knockoutReleaseGateEnabled && match.phaseId) {
    const phase = extractPhases(fixtureData).find((p) => p.id === match.phaseId);
    const isKnockout = phase ? phase.type !== "GROUP" : match.phaseId !== "group_stage";
    const released = (pool.tournamentInstance.releasedKnockoutPhases as string[] | null) ?? [];
    // Canary: a phase can be test-released to specific pools before the global release.
    const testPools = (pool.tournamentInstance.knockoutPhaseTestPools as Record<string, string[]> | null) ?? {};
    const testOpenForThisPool = (testPools[match.phaseId] ?? []).includes(pool.id);
    if (isKnockout && !released.includes(match.phaseId) && !testOpenForThisPool) {
      throw new ServiceError("PHASE_NOT_RELEASED", 409, {
        message: "Knockout phase not yet released by the admin",
        phaseId: match.phaseId,
      });
    }
  }

  const deadlineUtc = computeDeadlineUtc(match.kickoffUtc, pool.deadlineMinutesBeforeKickoff);
  if (!deadlineUtc) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "Invalid kickoffUtc on match" });
  }

  const now = new Date();
  // Strict `>=` so a pick arriving at exactly the deadline millisecond is
  // rejected. The display-side `isLocked` flag below uses the same
  // operator, keeping UI and server agreement: once the deadline hits,
  // the form locks AND the save endpoint refuses.
  if (now.getTime() >= deadlineUtc.getTime()) {
    throw new ServiceError("DEADLINE_PASSED", 409, {
      deadlineUtc: deadlineUtc.toISOString(),
      nowUtc: now.toISOString(),
    });
  }

  const prediction = await prisma.prediction.upsert({
    where: {
      poolId_userId_matchId: {
        poolId,
        userId,
        matchId,
      },
    },
    update: {
      pickJson: pick as any,
    },
    create: {
      poolId,
      userId,
      matchId,
      pickJson: pick as any,
    },
  });

  fireAndForget("audit:prediction-upserted", writeAuditEvent({
    actorUserId: userId,
    action: "PREDICTION_UPSERTED",
    entityType: "Prediction",
    entityId: prediction.id,
    dataJson: { poolId, matchId, pickType: pick.type },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }));

  return { prediction: prediction as unknown as Record<string, unknown> };
}

// -- Get Match Picks --

export async function getMatchPicks(data: GetMatchPicksInput): Promise<GetMatchPicksResult> {
  const { userId, poolId, matchId } = data;

  // READ access — allow LEFT members (see `requirePoolMemberReadAccess`).
  const isMember = await requirePoolMemberReadAccess(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  // Use fixtureSnapshot if available (has custom kickoffs), otherwise instance dataJson
  const fixtureData = pool.fixtureSnapshot || pool.tournamentInstance.dataJson;
  const matches = extractMatches(fixtureData);
  const match = matches.find((m) => m.id === matchId);
  if (!match) throw new ServiceError("NOT_FOUND", 404, { message: "Match not found" });

  const deadlineUtc = computeDeadlineUtc(match.kickoffUtc, pool.deadlineMinutesBeforeKickoff);
  if (!deadlineUtc) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "Invalid kickoffUtc" });
  }

  const now = new Date();
  const isUnlocked = now.getTime() > deadlineUtc.getTime();

  // If deadline has not passed, only return the current user's pick
  if (!isUnlocked) {
    const myPick = await prisma.prediction.findFirst({
      where: { poolId, matchId, userId },
    });

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true },
    });

    return {
      matchId,
      deadlineUtc: deadlineUtc.toISOString(),
      isUnlocked: false,
      message: "Deadline not passed yet. Only your pick is visible.",
      picks: myPick && me ? [{
        userId: me.id,
        displayName: me.displayName,
        pick: myPick.pickJson,
        isCurrentUser: true,
      }] : [],
    };
  }

  // Deadline passed: return picks from all active members
  const members = await prisma.poolMember.findMany({
    where: { poolId, status: "ACTIVE" },
    include: { user: { select: { id: true, displayName: true } } },
  });

  const allPicks = await prisma.prediction.findMany({
    where: { poolId, matchId },
  });

  const picksByUser = new Map<string, unknown>();
  for (const p of allPicks) {
    picksByUser.set(p.userId, p.pickJson);
  }

  const picks: MatchPickEntry[] = members.map((m) => ({
    userId: m.user.id,
    displayName: m.user.displayName,
    pick: picksByUser.get(m.user.id) ?? null,
    isCurrentUser: m.user.id === userId,
  }));

  // Sort: current user first, then by displayName
  picks.sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return {
    matchId,
    deadlineUtc: deadlineUtc.toISOString(),
    isUnlocked: true,
    picks,
  };
}

// -- Get My Picks --

export async function getMyPicks(data: GetMyPicksInput): Promise<GetMyPicksResult> {
  const { userId, poolId } = data;

  // READ access — allow LEFT members to see their preserved picks.
  const isMember = await requirePoolMemberReadAccess(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const list = await prisma.prediction.findMany({
    where: { poolId, userId },
    orderBy: { updatedAtUtc: "desc" },
  });

  return { picks: list as unknown as Record<string, unknown>[] };
}
