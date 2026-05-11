import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the surface poolAdminService.updatePoolScoringConfig depends on.
// We only stub what the function actually touches, not the whole module.
vi.mock("../db", () => ({
  prisma: {
    pool: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    poolMember: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../lib/audit", () => ({
  writeAuditEvent: vi.fn(),
}));

vi.mock("../lib/asyncHelpers", () => ({
  fireAndForget: vi.fn((_name: string, p: Promise<unknown> | unknown) => p),
}));

vi.mock("../lib/roles", async () => {
  const actual = await vi.importActual<typeof import("../lib/roles")>("../lib/roles");
  return {
    ...actual,
    requirePoolAdmin: vi.fn(),
  };
});

vi.mock("../lib/pickPresets", () => ({
  generateDynamicPresetConfig: vi.fn(),
  getPresetByKey: vi.fn(),
}));

vi.mock("../validation/pickConfig", () => ({
  validatePoolPickTypesConfig: vi.fn(),
}));

vi.mock("../lib/fixture", () => ({
  extractPhases: vi.fn(() => []),
  extractMatches: vi.fn(() => []),
  extractTeams: vi.fn(() => []),
  parseFixtureData: vi.fn(() => ({ teams: [], phases: [], matches: [] })),
  typed: vi.fn((x: unknown) => x),
}));

import { prisma } from "../db";
import { requirePoolAdmin } from "../lib/roles";
import { generateDynamicPresetConfig, getPresetByKey } from "../lib/pickPresets";
import { validatePoolPickTypesConfig } from "../validation/pickConfig";
import { writeAuditEvent } from "../lib/audit";
import { extractPhases } from "../lib/fixture";
import { updatePoolScoringConfig } from "./poolAdminService";
import { ServiceError } from "./authService";

beforeEach(() => {
  vi.clearAllMocks();
});

const auditCtx = { ip: null, userAgent: null };

describe("updatePoolScoringConfig", () => {
  it("throws FORBIDDEN when the actor is not a pool admin", async () => {
    (requirePoolAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await expect(
      updatePoolScoringConfig("user-1", "pool-1", "BASIC", auditCtx),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusHint: 403 });
  });

  it("throws NOT_FOUND when the pool does not exist", async () => {
    (requirePoolAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      updatePoolScoringConfig("user-1", "pool-x", "BASIC", auditCtx),
    ).rejects.toMatchObject({ code: "NOT_FOUND", statusHint: 404 });
  });

  it("throws CONFLICT when the pool is not in DRAFT", async () => {
    (requirePoolAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      status: "ACTIVE",
      pickTypesConfig: [],
      tournamentInstance: { dataJson: {} },
    });

    await expect(
      updatePoolScoringConfig("user-1", "pool-1", "BASIC", auditCtx),
    ).rejects.toMatchObject({ code: "CONFLICT", statusHint: 409 });
  });

  it("expands a preset key into a dynamic config and saves it", async () => {
    (requirePoolAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      status: "DRAFT",
      pickTypesConfig: [{ old: true }],
      tournamentInstance: { dataJson: {} },
    });
    // Need a non-empty phases array so the service follows the
    // "generateDynamicPresetConfig" path instead of the fallback.
    (extractPhases as ReturnType<typeof vi.fn>).mockReturnValue([
      { id: "group_stage", name: "Grupos", type: "GROUP" },
    ]);
    const expanded = [{ phaseId: "group_stage", requiresScore: true, matchPicks: { types: [] } }];
    (generateDynamicPresetConfig as ReturnType<typeof vi.fn>).mockReturnValue(expanded);
    (prisma.pool.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      pickTypesConfig: expanded,
    });

    const result = await updatePoolScoringConfig("user-1", "pool-1", "BASIC", auditCtx);

    expect(generateDynamicPresetConfig).toHaveBeenCalledWith("BASIC", expect.anything());
    expect(prisma.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { pickTypesConfig: expanded },
    });
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "POOL_RULES_CHANGED",
        dataJson: expect.objectContaining({ to: expanded }),
      }),
    );
    expect(result.pool.pickTypesConfig).toBe(expanded);
  });

  it("falls back to the hardcoded preset when the instance has no phases", async () => {
    (requirePoolAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      status: "DRAFT",
      pickTypesConfig: null,
      tournamentInstance: { dataJson: {} },
    });
    (generateDynamicPresetConfig as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const hardcoded = [{ phaseId: "x", requiresScore: true, matchPicks: { types: [] } }];
    (getPresetByKey as ReturnType<typeof vi.fn>).mockReturnValue({ config: hardcoded });
    (prisma.pool.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      pickTypesConfig: hardcoded,
    });

    await updatePoolScoringConfig("user-1", "pool-1", "SIMPLE", auditCtx);

    expect(getPresetByKey).toHaveBeenCalledWith("SIMPLE");
    expect(prisma.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { pickTypesConfig: hardcoded },
    });
  });

  it("throws VALIDATION_ERROR for an unknown preset key", async () => {
    (requirePoolAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      status: "DRAFT",
      pickTypesConfig: null,
      tournamentInstance: { dataJson: {} },
    });
    (generateDynamicPresetConfig as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (getPresetByKey as ReturnType<typeof vi.fn>).mockReturnValue(null);

    await expect(
      updatePoolScoringConfig("user-1", "pool-1", "UNKNOWN_KEY", auditCtx),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a malformed detailed config", async () => {
    (requirePoolAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      status: "DRAFT",
      pickTypesConfig: null,
      tournamentInstance: { dataJson: {} },
    });
    (validatePoolPickTypesConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      valid: false,
      errors: ["bad phase"],
    });

    await expect(
      updatePoolScoringConfig(
        "user-1",
        "pool-1",
        [{ phaseId: "x" }] as never,
        auditCtx,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it("accepts a valid detailed config", async () => {
    (requirePoolAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      status: "DRAFT",
      pickTypesConfig: null,
      tournamentInstance: { dataJson: {} },
    });
    const detailed = [{ phaseId: "group_stage", phaseName: "Grupos", requiresScore: true, matchPicks: { types: [{ key: "EXACT_SCORE", enabled: true, points: 20 }] } }];
    (validatePoolPickTypesConfig as ReturnType<typeof vi.fn>).mockReturnValue({ valid: true, errors: [] });
    (prisma.pool.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      pickTypesConfig: detailed,
    });

    const result = await updatePoolScoringConfig("user-1", "pool-1", detailed as never, auditCtx);
    expect(prisma.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { pickTypesConfig: detailed },
    });
    expect(result.pool.pickTypesConfig).toBe(detailed);
  });
});
