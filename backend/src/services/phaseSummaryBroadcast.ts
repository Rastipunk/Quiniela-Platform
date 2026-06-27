/**
 * Phase-summary email broadcast (ADR-084).
 *
 * When the admin RELEASES a knockout phase in the Gestor de Fases, every active
 * player of every pool in that instance gets ONE email: a recap of the phase
 * that just ended (rank, podium, points, perfect/partial or positions/groups)
 * plus a prominent "you can now predict <next phase>" banner.
 *
 * Design:
 *  - Generic by phase ORDER (works for any template): the released phase is the
 *    one being opened; the phase summarized is the one immediately before it.
 *  - One getPoolOverview() per pool (the leaderboard is viewer-independent), then
 *    personalized per member — same pattern as the pool-completed broadcast.
 *  - Bounded concurrency (4) to protect the Postgres connection pool across the
 *    457-pool World Cup fan-out (2026-06-10 connection-pool incident).
 *  - Idempotent per pool via Pool.phaseSummaryEmailedPhases — re-releasing the
 *    same phase does not re-send.
 *  - dryRun / restrictToEmail / onlyPoolIds make it safe to rehearse against
 *    real pools without emailing real players.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ServiceError } from "./authService";
import { getPoolOverview } from "./poolOverviewService";
import { calculateMaxPointsForPool } from "../lib/scoringAdvanced";
import { sendPhaseSummaryEmail, batchSendEmails } from "../lib/email";
import { resolveUserLocale, PHASE_DISPLAY_NAMES } from "../lib/constants";
import { extractPhases } from "../lib/fixture";
import { createLimiter } from "../lib/asyncHelpers";
import type { PhasePickConfig } from "../types/pickConfig";

/** Concurrency cap for the cross-pool fan-out. */
const POOL_CONCURRENCY = 4;
/** Cap on how many per-pool samples we return in dryRun (keeps output bounded). */
const MAX_SAMPLES = 60;

const GENERIC_PREV_PHASE: Record<string, string> = {
  es: "la fase anterior",
  en: "the previous phase",
  pt: "a fase anterior",
};

/** Localized phase label by id, falling back to the template name, then a generic phrase. */
export function localizedPhaseName(
  phaseId: string | undefined,
  fallbackName: string | undefined,
  locale: string,
): string {
  if (phaseId && PHASE_DISPLAY_NAMES[phaseId]?.[locale]) return PHASE_DISPLAY_NAMES[phaseId][locale]!;
  if (fallbackName && fallbackName.trim()) return fallbackName;
  return GENERIC_PREV_PHASE[locale] ?? GENERIC_PREV_PHASE.es!;
}

type OverviewLite = {
  pool: { name: string; pickTypesConfig: unknown };
  matches: Array<{ phaseId: string; result: unknown }>;
  leaderboard: {
    presetMode: string;
    rows: Array<{
      userId: string;
      rank: number;
      displayName: string;
      points: number;
      perfectCount?: number;
      partialCount?: number;
      structuralStats?: unknown;
    }>;
  };
};

export interface PhaseSummaryBroadcastOptions {
  /** Compute everything but DON'T send or mark — returns samples for inspection. */
  dryRun?: boolean;
  /** Ignore the per-pool idempotency marker (re-send). */
  force?: boolean;
  /** Only send to this exact email (testing) — never marks the pool. */
  restrictToEmail?: string;
  /** Restrict the broadcast to these pool ids (testing). */
  onlyPoolIds?: string[];
}

export interface PhaseSummaryBroadcastResult {
  instanceId: string;
  releasedPhaseId: string;
  endedPhaseId: string | null;
  poolsConsidered: number;
  poolsProcessed: number;
  poolsSkippedAlreadySent: number;
  poolsNoMembers: number;
  emailsSent: number;
  emailsFailed: number;
  dryRun: boolean;
  samples: Array<{
    poolId: string;
    poolName: string;
    mode: "score" | "structural";
    members: number;
    totalPossible: number;
    sampleLocale: string;
    samplePhaseName: string;
    sampleNextPhaseName: string | null;
    sampleRank: number;
    samplePoints: number;
    samplePointsBehind: number;
    sampleStats: string;
  }>;
}

/**
 * Broadcast the phase-summary email for a freshly-released knockout phase to all
 * active players of all pools in the instance. Idempotent + bounded.
 */
export async function sendPhaseSummaryBroadcast(
  instanceId: string,
  releasedPhaseId: string,
  opts: PhaseSummaryBroadcastOptions = {},
): Promise<PhaseSummaryBroadcastResult> {
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, dataJson: true },
  });
  if (!instance) throw new ServiceError("NOT_FOUND", 404);

  const orderedPhases = extractPhases(instance.dataJson).sort((a, b) => a.order - b.order);
  const relIdx = orderedPhases.findIndex((p) => p.id === releasedPhaseId);
  if (relIdx < 0) throw new ServiceError("INVALID_PHASE", 400, { phaseId: releasedPhaseId });
  const releasedPhase = orderedPhases[relIdx]!;
  const endedPhase = relIdx > 0 ? orderedPhases[relIdx - 1]! : null;

  const pools = await prisma.pool.findMany({
    where: {
      tournamentInstanceId: instanceId,
      status: "ACTIVE",
      ...(opts.onlyPoolIds ? { id: { in: opts.onlyPoolIds } } : {}),
    },
    select: { id: true, name: true, phaseSummaryEmailedPhases: true },
  });

  const result: PhaseSummaryBroadcastResult = {
    instanceId,
    releasedPhaseId,
    endedPhaseId: endedPhase?.id ?? null,
    poolsConsidered: pools.length,
    poolsProcessed: 0,
    poolsSkippedAlreadySent: 0,
    poolsNoMembers: 0,
    emailsSent: 0,
    emailsFailed: 0,
    dryRun: !!opts.dryRun,
    samples: [],
  };

  const limit = createLimiter(POOL_CONCURRENCY);
  await Promise.all(
    pools.map((pool) =>
      limit(async () => {
        const alreadySent = ((pool.phaseSummaryEmailedPhases as string[] | null) ?? []).includes(
          releasedPhaseId,
        );
        if (alreadySent && !opts.force) {
          result.poolsSkippedAlreadySent++;
          return;
        }

        // Active members who accept email notifications.
        const members = await prisma.poolMember.findMany({
          where: { poolId: pool.id, status: "ACTIVE", user: { emailNotificationsEnabled: true } },
          include: { user: { select: { id: true, email: true, displayName: true, locale: true, country: true } } },
          orderBy: { joinedAtUtc: "asc" },
        });
        if (members.length === 0) {
          result.poolsNoMembers++;
          // Mark so we don't reconsider this empty pool on a future re-release.
          if (!opts.dryRun && !opts.restrictToEmail) await markPoolEmailed(pool.id, releasedPhaseId);
          return;
        }

        // One overview per pool (leaderboard is viewer-independent).
        const ov = (await getPoolOverview(members[0]!.userId, pool.id, false)) as unknown as OverviewLite;
        const rows = ov.leaderboard.rows;
        if (rows.length === 0) {
          result.poolsNoMembers++;
          if (!opts.dryRun && !opts.restrictToEmail) await markPoolEmailed(pool.id, releasedPhaseId);
          return;
        }
        const mode: "score" | "structural" =
          ov.leaderboard.presetMode === "STRUCTURAL" ? "structural" : "score";

        const countByPhase = new Map<string, number>();
        for (const m of ov.matches) if (m.result) countByPhase.set(m.phaseId, (countByPhase.get(m.phaseId) ?? 0) + 1);
        const totalPossible = calculateMaxPointsForPool(
          (ov.pool.pickTypesConfig ?? []) as PhasePickConfig[],
          countByPhase,
        );

        const leader = rows.find((r) => r.rank === 1) ?? rows[0]!;
        const podiumBase = rows.slice(0, 3);
        const memberByUserId = new Map(members.map((m) => [m.userId, m]));

        let items = rows
          .map((row) => ({ row, member: memberByUserId.get(row.userId) }))
          .filter((x): x is { row: (typeof rows)[number]; member: NonNullable<typeof x.member> } => !!x.member);
        if (opts.restrictToEmail) {
          items = items.filter((x) => x.member.user.email.toLowerCase() === opts.restrictToEmail!.toLowerCase());
        }

        const buildParams = (item: (typeof items)[number]) => {
          const loc = resolveUserLocale(item.member.user);
          return {
            to: item.member.user.email,
            userId: item.member.userId,
            memberName: item.member.user.displayName ?? "Jugador",
            poolName: ov.pool.name,
            poolId: pool.id,
            phaseName: localizedPhaseName(endedPhase?.id, endedPhase?.name, loc),
            nextPhaseName: localizedPhaseName(releasedPhase.id, releasedPhase.name, loc),
            rank: item.row.rank,
            totalMembers: rows.length,
            points: item.row.points,
            pointsBehindLeader: Math.max(0, leader.points - item.row.points),
            totalPossible,
            podium: podiumBase.map((r) => ({
              name: r.displayName,
              points: r.points,
              isViewer: r.userId === item.member.userId,
            })),
            mode,
            score: { perfect: item.row.perfectCount ?? 0, partial: item.row.partialCount ?? 0 },
            structural: item.row.structuralStats as
              | { positionsCorrect: number; positionsTotal: number; perfectGroups: number; totalGroups: number }
              | undefined,
            locale: loc,
          };
        };

        // Collect a bounded sample for dryRun inspection.
        if (opts.dryRun && result.samples.length < MAX_SAMPLES && items[0]) {
          const p = buildParams(items[0]);
          const st = p.structural;
          result.samples.push({
            poolId: pool.id,
            poolName: ov.pool.name,
            mode,
            members: members.length,
            totalPossible,
            sampleLocale: p.locale,
            samplePhaseName: p.phaseName,
            sampleNextPhaseName: p.nextPhaseName,
            sampleRank: p.rank,
            samplePoints: p.points,
            samplePointsBehind: p.pointsBehindLeader,
            sampleStats:
              mode === "structural" && st
                ? `pos ${st.positionsCorrect}/${st.positionsTotal}, grupos ${st.perfectGroups}/${st.totalGroups}`
                : `exactos ${p.score.perfect}, parciales ${p.score.partial}`,
          });
        }

        if (opts.dryRun) {
          result.poolsProcessed++;
          return;
        }

        const { sent, failed, failures } = await batchSendEmails(items, (item) =>
          sendPhaseSummaryEmail(buildParams(item)),
        );
        result.emailsSent += sent;
        result.emailsFailed += failed;
        for (const { item, error } of failures) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(
            `[PhaseSummary] email failed pool=${pool.id} userId=${item.member.userId} email=${item.member.user.email}: ${msg}`,
          );
        }
        // Mark the pool as emailed (only on a full, real broadcast).
        if (!opts.restrictToEmail) await markPoolEmailed(pool.id, releasedPhaseId);
        result.poolsProcessed++;
      }),
    ),
  );

  console.log(
    `📧 [PhaseSummary] instance=${instanceId} phase=${releasedPhaseId} dryRun=${!!opts.dryRun} ` +
      `pools=${result.poolsProcessed}/${result.poolsConsidered} skipped=${result.poolsSkippedAlreadySent} ` +
      `noMembers=${result.poolsNoMembers} sent=${result.emailsSent} failed=${result.emailsFailed}`,
  );
  return result;
}

/** Append a phaseId to Pool.phaseSummaryEmailedPhases (idempotent, no duplicates). */
async function markPoolEmailed(poolId: string, phaseId: string): Promise<void> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { phaseSummaryEmailedPhases: true },
  });
  const current = new Set(((pool?.phaseSummaryEmailedPhases as string[] | null) ?? []));
  current.add(phaseId);
  await prisma.pool.update({
    where: { id: poolId },
    data: { phaseSummaryEmailedPhases: [...current] as Prisma.InputJsonValue },
  });
}
