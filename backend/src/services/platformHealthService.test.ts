/**
 * Tests for the platform-health service.
 *
 * Focus on the layered contract that admin alerts depend on:
 *   - evaluateSnapshot maps numeric values to OK/WARN/CRITICAL correctly
 *   - processSnapshotAlerts fires on entry, dedupes inside cooldown,
 *     and emits a resolution email when the metric returns to OK.
 *
 * Collectors are integration concerns (DB / Node / scores service) and
 * are not exercised here; only the deterministic core is asserted.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({
  prisma: {
    platformHealthAlert: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../lib/email", () => ({
  sendAdminNotification: vi.fn().mockResolvedValue({ success: true }),
}));

import { prisma } from "../db";
import { sendAdminNotification } from "../lib/email";
import {
  evaluateSnapshot,
  processSnapshotAlerts,
  type HealthSnapshot,
  type MetricResult,
} from "./platformHealthService";

const baseMetric = (over: Partial<MetricResult> = {}): MetricResult => ({
  key: "db_connections",
  label: "Conexiones a Postgres",
  unit: "pct",
  value: 0,
  warnThreshold: 65,
  criticalThreshold: 85,
  ...over,
});

const snapshot = (metrics: MetricResult[]): HealthSnapshot => ({
  generatedAtUtc: "2026-06-11T00:00:00Z",
  metrics,
});

describe("evaluateSnapshot", () => {
  it("flags WARN when value crosses warnThreshold but stays under critical", () => {
    const s = evaluateSnapshot(snapshot([baseMetric({ value: 70 })]));
    expect(s.metrics[0]?.severity).toBe("WARN");
  });

  it("flags CRITICAL when value reaches criticalThreshold exactly", () => {
    const s = evaluateSnapshot(snapshot([baseMetric({ value: 85 })]));
    expect(s.metrics[0]?.severity).toBe("CRITICAL");
  });

  it("returns OK when value sits below the warn threshold", () => {
    const s = evaluateSnapshot(snapshot([baseMetric({ value: 30 })]));
    expect(s.metrics[0]?.severity).toBe("OK");
  });

  it("treats a 'scores service no configurado' metric as OK regardless of value", () => {
    const s = evaluateSnapshot(
      snapshot([
        baseMetric({
          key: "scores_service",
          value: 99999,
          details: "scores service no configurado (skip)",
        }),
      ]),
    );
    expect(s.metrics[0]?.severity).toBe("OK");
  });
});

describe("processSnapshotAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires the alert + sends email on FIRST observation of WARN", async () => {
    vi.mocked(prisma.platformHealthAlert.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.platformHealthAlert.findMany).mockResolvedValue([]);
    vi.mocked(prisma.platformHealthAlert.create).mockResolvedValue({} as never);

    const s = evaluateSnapshot(snapshot([baseMetric({ value: 70 })])); // WARN
    const result = await processSnapshotAlerts(s);

    expect(result.fired).toBe(1);
    expect(prisma.platformHealthAlert.create).toHaveBeenCalledOnce();
    expect(sendAdminNotification).toHaveBeenCalledOnce();
  });

  it("suppresses re-notification while inside cooldown", async () => {
    const existing = {
      id: "a1",
      notifiedAt: new Date(), // just notified
    };
    vi.mocked(prisma.platformHealthAlert.findFirst).mockResolvedValue(existing as never);
    vi.mocked(prisma.platformHealthAlert.findMany).mockResolvedValue([]);
    vi.mocked(prisma.platformHealthAlert.update).mockResolvedValue({} as never);

    const s = evaluateSnapshot(snapshot([baseMetric({ value: 70 })]));
    const result = await processSnapshotAlerts(s);

    expect(result.fired).toBe(0);
    expect(result.suppressedByCooldown).toBe(1);
    expect(sendAdminNotification).not.toHaveBeenCalled();
    expect(prisma.platformHealthAlert.update).toHaveBeenCalledOnce();
  });

  it("re-notifies once the cooldown elapses", async () => {
    // Pretend the last notification was 7h ago, default cooldown is 6h.
    const existing = {
      id: "a1",
      notifiedAt: new Date(Date.now() - 7 * 3600 * 1000),
    };
    vi.mocked(prisma.platformHealthAlert.findFirst).mockResolvedValue(existing as never);
    vi.mocked(prisma.platformHealthAlert.findMany).mockResolvedValue([]);
    vi.mocked(prisma.platformHealthAlert.update).mockResolvedValue({} as never);

    const s = evaluateSnapshot(snapshot([baseMetric({ value: 90 })])); // CRITICAL
    const result = await processSnapshotAlerts(s);

    expect(result.fired).toBe(1);
    expect(result.suppressedByCooldown).toBe(0);
    expect(sendAdminNotification).toHaveBeenCalledOnce();
  });

  it("resolves an open alert when the metric returns to OK + sends recovery email", async () => {
    vi.mocked(prisma.platformHealthAlert.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.platformHealthAlert.findMany).mockResolvedValue([
      { id: "a1", severity: "WARN" } as never,
    ]);
    vi.mocked(prisma.platformHealthAlert.update).mockResolvedValue({} as never);

    const s = evaluateSnapshot(snapshot([baseMetric({ value: 30 })])); // OK
    const result = await processSnapshotAlerts(s);

    expect(result.resolved).toBe(1);
    expect(sendAdminNotification).toHaveBeenCalledOnce();
    expect(prisma.platformHealthAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "a1" },
        data: expect.objectContaining({
          resolvedAt: expect.any(Date),
          resolutionNotifiedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("does NOT fire or resolve when a metric is marked skip (no measurement)", async () => {
    // dashboard_build returns skip:true when getLastDashboardBuildMs is 0
    // (the post-boot sentinel). Without skip semantics, every deploy
    // produced a redundant resolve-on-boot then fire-on-first-build
    // pair of emails — the test below would have caught that.
    vi.mocked(prisma.platformHealthAlert.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.platformHealthAlert.findMany).mockResolvedValue([
      // Stage an existing OPEN alert. If skip were broken, this would
      // get resolved against a non-measurement, producing a fake
      // recovery email.
      { id: "open-1", severity: "WARN" } as never,
    ]);

    const m = baseMetric({
      key: "dashboard_build",
      unit: "ms",
      warnThreshold: 45_000,
      criticalThreshold: 70_000,
      value: 0,
      skip: true,
    });
    const s = evaluateSnapshot(snapshot([m]));

    // Skipped metric leaves severity undefined (not OK).
    expect(s.metrics[0]?.severity).toBeUndefined();

    const result = await processSnapshotAlerts(s);
    expect(result.fired).toBe(0);
    expect(result.resolved).toBe(0);
    expect(result.suppressedByCooldown).toBe(0);
    expect(sendAdminNotification).not.toHaveBeenCalled();
    expect(prisma.platformHealthAlert.update).not.toHaveBeenCalled();
    expect(prisma.platformHealthAlert.create).not.toHaveBeenCalled();
  });

  it("does nothing when a metric is OK and no open alert exists", async () => {
    vi.mocked(prisma.platformHealthAlert.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.platformHealthAlert.findMany).mockResolvedValue([]);

    const s = evaluateSnapshot(snapshot([baseMetric({ value: 10 })]));
    const result = await processSnapshotAlerts(s);

    expect(result.fired).toBe(0);
    expect(result.resolved).toBe(0);
    expect(sendAdminNotification).not.toHaveBeenCalled();
    expect(prisma.platformHealthAlert.create).not.toHaveBeenCalled();
    expect(prisma.platformHealthAlert.update).not.toHaveBeenCalled();
  });
});
