import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../db", () => ({
  prisma: {
    pool: { findMany: vi.fn() },
    poolMatchResult: { findMany: vi.fn() },
    poolMember: { findMany: vi.fn() },
    prediction: { findMany: vi.fn(), createMany: vi.fn() },
  },
}));

vi.mock("../lib/audit", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/fixture", () => ({
  parseFixtureData: vi.fn(),
}));

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { parseFixtureData } from "../lib/fixture";
import { assignRandomPicksForDuePools } from "./caprichoSanService";

const POOL_ID = "pool-capricho";
const NOW = Date.now();

/** A match whose deadline (kickoff − 10 min) passed 5 minutes ago. */
const DUE_MATCH = {
  id: "m1",
  phaseId: "group_stage",
  homeTeamId: "t1",
  awayTeamId: "t2",
  kickoffUtc: new Date(NOW + 5 * 60_000).toISOString(), // kickoff in 5min, deadline 10min before → passed
};

function basePool(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: POOL_ID,
    caprichoSanMin: 0,
    caprichoSanMax: 4,
    deadlineMinutesBeforeKickoff: 10,
    fixtureSnapshot: {},
    pickTypesConfig: [{ phaseId: "group_stage", requiresScore: true }],
    tournamentInstance: { dataJson: {} },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CAPRICHO_SAN_POOL_IDS = POOL_ID;
  (prisma.pool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([basePool()]);
  (parseFixtureData as ReturnType<typeof vi.fn>).mockReturnValue({ matches: [DUE_MATCH] });
  (prisma.poolMatchResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.poolMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
    { userId: "u1" }, { userId: "u2" }, { userId: "u3" },
  ]);
  (prisma.prediction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
    { userId: "u1", matchId: "m1" }, // u1 already picked
  ]);
  (prisma.prediction.createMany as ReturnType<typeof vi.fn>).mockImplementation(
    ({ data }: { data: unknown[] }) => Promise.resolve({ count: data.length }),
  );
});

afterEach(() => {
  delete process.env.CAPRICHO_SAN_POOL_IDS;
});

describe("assignRandomPicksForDuePools", () => {
  it("assigns random SCORE picks only to members without a pick, marked autoAssigned", async () => {
    const summary = await assignRandomPicksForDuePools();

    expect(summary.picksAssigned).toBe(2); // u2 + u3
    const call = (prisma.prediction.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data).toHaveLength(2);
    for (const row of call.data) {
      expect(["u2", "u3"]).toContain(row.userId);
      expect(row.matchId).toBe("m1");
      expect(row.pickJson.type).toBe("SCORE");
      expect(row.pickJson.autoAssigned).toBe(true);
      expect(row.pickJson.autoSource).toBe("CAPRICHO_SAN");
      expect(row.pickJson.homeGoals).toBeGreaterThanOrEqual(0);
      expect(row.pickJson.homeGoals).toBeLessThanOrEqual(4);
      expect(row.pickJson.awayGoals).toBeGreaterThanOrEqual(0);
      expect(row.pickJson.awayGoals).toBeLessThanOrEqual(4);
      expect(Number.isInteger(row.pickJson.homeGoals)).toBe(true);
      expect(Number.isInteger(row.pickJson.awayGoals)).toBe(true);
    }
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CAPRICHO_SAN_ASSIGNED", poolId: POOL_ID }),
    );
  });

  it("respects the host's custom range", async () => {
    (prisma.pool.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      basePool({ caprichoSanMin: 2, caprichoSanMax: 2 }),
    ]);

    await assignRandomPicksForDuePools();

    const call = (prisma.prediction.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    for (const row of call.data) {
      expect(row.pickJson.homeGoals).toBe(2);
      expect(row.pickJson.awayGoals).toBe(2);
    }
  });

  it("does nothing before the deadline", async () => {
    (parseFixtureData as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: [{ ...DUE_MATCH, kickoffUtc: new Date(NOW + 60 * 60_000).toISOString() }],
    });

    const summary = await assignRandomPicksForDuePools();

    expect(summary.picksAssigned).toBe(0);
    expect(prisma.prediction.createMany).not.toHaveBeenCalled();
  });

  it("skips matches outside the lookback window (no backfill of old matches)", async () => {
    (parseFixtureData as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: [{ ...DUE_MATCH, kickoffUtc: new Date(NOW - 48 * 60 * 60_000).toISOString() }],
    });

    const summary = await assignRandomPicksForDuePools();
    expect(summary.picksAssigned).toBe(0);
  });

  it("never assigns once the match has a result version", async () => {
    (prisma.poolMatchResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { matchId: "m1" },
    ]);

    const summary = await assignRandomPicksForDuePools();
    expect(summary.picksAssigned).toBe(0);
    expect(prisma.prediction.createMany).not.toHaveBeenCalled();
  });

  it("skips structural phases and placeholder fixtures", async () => {
    (parseFixtureData as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: [
        { ...DUE_MATCH, id: "m-struct", phaseId: "knockout_picks" }, // not requiresScore
        { ...DUE_MATCH, id: "m-tbd", homeTeamId: null },             // pairing not defined
      ],
    });

    const summary = await assignRandomPicksForDuePools();
    expect(summary.picksAssigned).toBe(0);
  });

  it("ignores enabled pools that are NOT in the env allowlist (defence in depth)", async () => {
    process.env.CAPRICHO_SAN_POOL_IDS = "some-other-pool";

    const summary = await assignRandomPicksForDuePools();

    expect(summary.poolsProcessed).toBe(0);
    expect(prisma.prediction.createMany).not.toHaveBeenCalled();
  });
});
