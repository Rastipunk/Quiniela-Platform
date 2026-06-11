import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("../db", () => ({
  prisma: {
    pool: { findUnique: vi.fn() },
    matchSyncState: { findMany: vi.fn() },
    poolMatchResult: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../lib/audit", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/fixture", () => ({
  parseFixtureData: vi.fn(),
}));

vi.mock("./structuralAutoPublish", () => ({
  autoPublishStructuralResults: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./poolStateMachine", () => ({
  transitionToCompleted: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { parseFixtureData } from "../lib/fixture";
import { autoPublishStructuralResults } from "./structuralAutoPublish";
import { transitionToCompleted } from "./poolStateMachine";
import { backfillConfirmedResultsForPool } from "./resultBackfillService";

const POOL = {
  id: "pool-1",
  tournamentInstanceId: "inst-1",
  fixtureSnapshot: { matches: [] },
  tournamentInstance: { dataJson: {}, resultSourceMode: "AUTO" },
};

/** Confirmed FT payload as liveScoresJob persists it in lastLiveDataJson. */
function ftPayload(home: number, away: number, extra: Partial<Record<string, unknown>> = {}) {
  return {
    apiFootballFixtureId: 12345,
    homeGoals: home,
    awayGoals: away,
    penaltyHome: null,
    penaltyAway: null,
    status: "FT",
    timeline: [],
    ...extra,
  };
}

/** Wire the $transaction mock with a recording tx. */
function mockTransaction() {
  const created: any[] = [];
  const tx = {
    poolMatchResult: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `hdr-${data.matchId}`, ...data })),
      update: vi.fn().mockResolvedValue({}),
    },
    poolMatchResultVersion: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: any) => {
        created.push(data);
        return Promise.resolve({ id: `ver-${data.resultId}`, ...data });
      }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  );
  return { tx, created };
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(POOL);
  (parseFixtureData as ReturnType<typeof vi.fn>).mockReturnValue({
    matches: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
  });
});

describe("backfillConfirmedResultsForPool", () => {
  it("seeds an API_CONFIRMED version for a COMPLETED match the pool is missing", async () => {
    (prisma.matchSyncState.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { internalMatchId: "m1", lastLiveDataJson: ftPayload(2, 0) },
    ]);
    (prisma.poolMatchResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { created } = mockTransaction();

    const summary = await backfillConfirmedResultsForPool("pool-1");

    expect(summary.seeded).toBe(1);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      versionNumber: 1,
      status: "PUBLISHED",
      homeGoals: 2,
      awayGoals: 0,
      source: "API_CONFIRMED",
      createdByUserId: null,
    });
    // Query must only consider pipeline-finalized matches
    expect(prisma.matchSyncState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ syncStatus: "COMPLETED" }),
      }),
    );
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RESULTS_BACKFILLED_ON_ACTIVATION" }),
    );
    expect(autoPublishStructuralResults).toHaveBeenCalledWith("pool-1", "m1");
    expect(transitionToCompleted).toHaveBeenCalledWith("pool-1", null);
  });

  it("derives goals90 from the timeline for an AET match", async () => {
    (prisma.matchSyncState.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        internalMatchId: "m2",
        lastLiveDataJson: ftPayload(3, 2, {
          status: "AET",
          timeline: [
            { status: "ET", homeGoals: 2, awayGoals: 2, confirmations: 3 },
            { status: "AET", homeGoals: 3, awayGoals: 2, confirmations: 3 },
          ],
        }),
      },
    ]);
    (prisma.poolMatchResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { created } = mockTransaction();

    const summary = await backfillConfirmedResultsForPool("pool-1");

    expect(summary.seeded).toBe(1);
    expect(created[0]).toMatchObject({
      homeGoals: 3,
      awayGoals: 2,
      homeGoals90: 2,
      awayGoals90: 2,
    });
  });

  it("never touches matches that already have a result (any source)", async () => {
    (prisma.matchSyncState.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { internalMatchId: "m1", lastLiveDataJson: ftPayload(2, 0) },
      { internalMatchId: "m2", lastLiveDataJson: ftPayload(1, 1) },
    ]);
    (prisma.poolMatchResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { matchId: "m1", currentVersionId: "v-existing" },
    ]);
    const { created } = mockTransaction();

    const summary = await backfillConfirmedResultsForPool("pool-1");

    expect(summary.seeded).toBe(1);
    expect(summary.skippedExisting).toBe(1);
    expect(created).toHaveLength(1);
    expect(created[0].homeGoals).toBe(1); // only m2
  });

  it("skips COMPLETED states without a usable payload", async () => {
    (prisma.matchSyncState.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { internalMatchId: "m1", lastLiveDataJson: null },
      { internalMatchId: "m2", lastLiveDataJson: { status: "FT" } }, // no goals
    ]);
    (prisma.poolMatchResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    mockTransaction();

    const summary = await backfillConfirmedResultsForPool("pool-1");

    expect(summary.seeded).toBe(0);
    expect(summary.skippedNoPayload).toBe(2);
    expect(writeAuditEvent).not.toHaveBeenCalled();
    expect(transitionToCompleted).not.toHaveBeenCalled();
  });

  it("is a no-op for MANUAL-mode instances", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...POOL,
      tournamentInstance: { dataJson: {}, resultSourceMode: "MANUAL" },
    });

    const summary = await backfillConfirmedResultsForPool("pool-1");

    expect(summary.seeded).toBe(0);
    expect(prisma.matchSyncState.findMany).not.toHaveBeenCalled();
  });

  it("a single failing match does not abort the rest", async () => {
    (prisma.matchSyncState.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { internalMatchId: "m1", lastLiveDataJson: ftPayload(2, 0) },
      { internalMatchId: "m2", lastLiveDataJson: ftPayload(0, 3) },
    ]);
    (prisma.poolMatchResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { tx, created } = mockTransaction();
    // First tx call explodes (e.g. unique race with liveScoresJob), second succeeds
    let call = 0;
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: any) => {
      call++;
      if (call === 1) throw new Error("unique violation");
      return cb(tx);
    });

    const summary = await backfillConfirmedResultsForPool("pool-1");

    expect(summary.seeded).toBe(1);
    expect(created).toHaveLength(1);
  });
});
