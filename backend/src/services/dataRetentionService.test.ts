import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({ prisma: {} }));

import { FUNCTIONAL_AUDIT_ACTIONS, runDataRetentionSweep } from "./dataRetentionService";
import { DATA_RETENTION, MS } from "../lib/constants";

function fakeDb() {
  return {
    auditEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
    deadlineReminderLog: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
    paymentEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

describe("dataRetentionService (ADR-090)", () => {
  const now = new Date("2026-09-21T00:00:00.000Z");

  it("never purges the audit markers the code reads back", async () => {
    const db = fakeDb();
    await runDataRetentionSweep(db as never, now);

    const where = db.auditEvent.deleteMany.mock.calls[0][0].where;
    expect(where.action.notIn).toEqual([...FUNCTIONAL_AUDIT_ACTIONS]);
    // Re-sending the phase recap to every member is the costliest regression.
    expect(where.action.notIn).toContain("PHASE_COMPLETION_RECAP_SENT");
    // transitionFromArchived depends on it.
    expect(where.action.notIn).toContain("POOL_STATUS_CHANGED");
    expect(where.createdAtUtc.lt).toEqual(
      new Date(now.getTime() - DATA_RETENTION.AUDIT_EVENT_DAYS * MS.DAY),
    );
  });

  it("only prunes superseded result versions of pools that are not ACTIVE", async () => {
    const db = fakeDb();
    await runDataRetentionSweep(db as never, now);

    const deleteSql = (db.$executeRaw.mock.calls[0][0] as readonly string[]).join("?");
    expect(deleteSql).toContain(`DELETE FROM "PoolMatchResultVersion"`);
    expect(deleteSql).toContain(`p.status <> 'ACTIVE'`);
    expect(deleteSql).toContain(`r."currentVersionId" IS DISTINCT FROM v.id`);
  });

  it("only deletes sessions that are already dead", async () => {
    const db = fakeDb();
    await runDataRetentionSweep(db as never, now);

    const cutoff = new Date(now.getTime() - DATA_RETENTION.DEAD_SESSION_GRACE_DAYS * MS.DAY);
    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ expiresAtUtc: { lt: cutoff } }, { revokedAtUtc: { lt: cutoff } }] },
    });
  });

  it("reports affected rows per category", async () => {
    const result = await runDataRetentionSweep(fakeDb() as never, now);
    expect(result).toEqual({
      auditEvents: 5,
      resultVersions: 1,
      resultSnapshots: 1,
      deadlineReminderLogs: 4,
      reconcilerNoops: 3,
      sessions: 2,
    });
  });
});
