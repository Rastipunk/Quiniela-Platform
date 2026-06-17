/**
 * Prediction Status Service — per-match "who has / hasn't submitted a pick".
 *
 * Privacy contract (ADR-045): this feature exposes ONLY the boolean fact of
 * whether a member submitted a prediction for a match — NEVER the contents of
 * the pick. The query below selects `userId` only; `pickJson` is never read.
 * That is what makes it safe to show before the deadline without leaking
 * scores (the existing "ver predicciones de otros" flow stays post-deadline).
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 */

import { prisma } from "../db";
import { extractMatches } from "../lib/fixture";
import { isPredictionStatusEnabled } from "../lib/featureFlags";
import { computeDeadlineUtc, requirePoolMemberReadAccess } from "./pickService";
import { ServiceError } from "./authService";

export type PredictionStatusMember = {
  userId: string;
  displayName: string;
  role: string;
  hasPredicted: boolean;
  isCurrentUser: boolean;
};

export type PredictionStatusResult = {
  matchId: string;
  deadlineUtc: string;
  isLocked: boolean;
  predictedCount: number;
  totalMembers: number;
  members: PredictionStatusMember[];
};

export async function getPredictionStatus(
  userId: string,
  poolId: string,
  matchId: string,
): Promise<PredictionStatusResult> {
  // READ access — allow ACTIVE and LEFT members to query (mirrors getMatchPicks).
  const isMember = await requirePoolMemberReadAccess(userId, poolId);
  if (!isMember) throw new ServiceError("FORBIDDEN", 403);

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      tournamentInstance: true,
      createdByUser: { select: { email: true } },
    },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  // Feature flag (rollout gate). Surface as 404 — never reveal the endpoint's
  // existence to pools outside the rollout.
  if (!isPredictionStatusEnabled(pool.createdByUser?.email ?? null)) {
    throw new ServiceError("NOT_FOUND", 404);
  }

  const fixtureData = pool.fixtureSnapshot || pool.tournamentInstance.dataJson;
  const match = extractMatches(fixtureData).find((m) => m.id === matchId);
  if (!match) throw new ServiceError("NOT_FOUND", 404, { message: "Match not found" });

  const deadlineUtc = computeDeadlineUtc(match.kickoffUtc, pool.deadlineMinutesBeforeKickoff);
  if (!deadlineUtc) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "Invalid kickoffUtc" });
  }

  const [members, predicted] = await Promise.all([
    prisma.poolMember.findMany({
      where: { poolId, status: "ACTIVE" },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { joinedAtUtc: "asc" },
    }),
    // PRIVACY: select ONLY userId — never pickJson (see file header / ADR-045).
    prisma.prediction.findMany({
      where: { poolId, matchId },
      select: { userId: true },
    }),
  ]);

  const predictedSet = new Set(predicted.map((p) => p.userId));

  const list: PredictionStatusMember[] = members.map((m) => ({
    userId: m.user.id,
    displayName: m.user.displayName,
    role: m.role,
    hasPredicted: predictedSet.has(m.user.id),
    isCurrentUser: m.user.id === userId,
  }));

  // Pending first (the actionable ones a host needs to ping), then alphabetical.
  list.sort((a, b) => {
    if (a.hasPredicted !== b.hasPredicted) return a.hasPredicted ? 1 : -1;
    return a.displayName.localeCompare(b.displayName);
  });

  const predictedCount = list.reduce((n, m) => n + (m.hasPredicted ? 1 : 0), 0);

  return {
    matchId,
    deadlineUtc: deadlineUtc.toISOString(),
    isLocked: Date.now() >= deadlineUtc.getTime(),
    predictedCount,
    totalMembers: members.length,
    members: list,
  };
}
