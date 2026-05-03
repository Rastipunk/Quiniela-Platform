import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../db";

// ── Mocks ──────────────────────────────────────────────────────

vi.mock("../db", () => ({
  prisma: {
    pool: {
      findUnique: vi.fn(),
    },
    poolMember: {
      findUnique: vi.fn(),
    },
    corporateInvite: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../lib/email", () => ({
  sendCorporateActivationEmail: vi.fn(),
}));

vi.mock("../lib/audit", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/asyncHelpers", () => ({
  fireAndForget: vi.fn(),
}));

import { sendInvitations } from "./corporateService";
import { sendCorporateActivationEmail } from "../lib/email";

const HOST_USER_ID = "host-1";
const POOL_ID = "pool-aaa";

const POOL_RECORD = {
  id: POOL_ID,
  name: "Mundial 2026 — Acme",
  organization: {
    name: "Acme Corp",
    logoBase64: null,
    invitationMessage: null,
    primaryColor: null,
    secondaryColor: null,
  },
};

const HOST_MEMBERSHIP = {
  poolId_userId: { poolId: POOL_ID, userId: HOST_USER_ID },
  role: "CORPORATE_HOST",
};

function inviteFixture(id: string, email: string) {
  return {
    id,
    poolId: POOL_ID,
    email,
    name: null,
    activationToken: `tok-${id}`,
    status: "PENDING",
  };
}

const AUDIT_CTX = { ip: "10.0.0.1", userAgent: "vitest" };

describe("sendInvitations — atomic per-invite claim (race safety)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.pool.findUnique as any).mockResolvedValue(POOL_RECORD);
    (prisma.poolMember.findUnique as any).mockResolvedValue(HOST_MEMBERSHIP);
  });

  it("sends one email per invite when claim succeeds (count=1)", async () => {
    const invites = [inviteFixture("inv-1", "a@acme.com"), inviteFixture("inv-2", "b@acme.com")];
    (prisma.corporateInvite.findMany as any).mockResolvedValue(invites);
    // Every claim attempt wins — both invites are still PENDING.
    (prisma.corporateInvite.updateMany as any).mockResolvedValue({ count: 1 });
    (sendCorporateActivationEmail as any).mockResolvedValue({ success: true });

    const result = await sendInvitations(
      { userId: HOST_USER_ID, poolId: POOL_ID },
      AUDIT_CTX,
    );

    expect(sendCorporateActivationEmail).toHaveBeenCalledTimes(2);
    expect(prisma.corporateInvite.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.corporateInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING" }),
        data: { status: "SENT" },
      }),
    );
    expect(result).toEqual({ sent: 2, failed: 0 });
  });

  it("SKIPS each invite a concurrent caller already claimed (count=0) — no double email", async () => {
    // The bug we're fixing: a host double-clicks "Enviar invitaciones".
    // Both server invocations findMany the same PENDING set. Without atomic
    // claiming, both would call sendCorporateActivationEmail for every invite,
    // doubling the email volume per employee. With the claim, the SECOND
    // invocation sees count=0 on every updateMany and skips silently.
    const invites = [inviteFixture("inv-1", "a@acme.com"), inviteFixture("inv-2", "b@acme.com")];
    (prisma.corporateInvite.findMany as any).mockResolvedValue(invites);
    // Simulate this caller LOST every race — the other concurrent call
    // already flipped each invite to SENT in between findMany and updateMany.
    (prisma.corporateInvite.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await sendInvitations(
      { userId: HOST_USER_ID, poolId: POOL_ID },
      AUDIT_CTX,
    );

    expect(sendCorporateActivationEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  it("reverts claim to FAILED when the email send actually fails", async () => {
    const invites = [inviteFixture("inv-1", "bad@acme.com")];
    (prisma.corporateInvite.findMany as any).mockResolvedValue(invites);
    (prisma.corporateInvite.updateMany as any).mockResolvedValue({ count: 1 });
    (sendCorporateActivationEmail as any).mockResolvedValue({
      success: false,
      error: "Resend rejected: invalid recipient",
    });
    (prisma.corporateInvite.update as any).mockResolvedValue({});

    const result = await sendInvitations(
      { userId: HOST_USER_ID, poolId: POOL_ID },
      AUDIT_CTX,
    );

    // Optimistic claim moved status to SENT, then revert.update flipped to FAILED.
    expect(prisma.corporateInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SENT" } }),
    );
    expect(prisma.corporateInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: { status: "FAILED" },
      }),
    );
    expect(result).toEqual({ sent: 0, failed: 1 });
  });

  it("a thrown email error also reverts claim to FAILED", async () => {
    const invites = [inviteFixture("inv-1", "bad@acme.com")];
    (prisma.corporateInvite.findMany as any).mockResolvedValue(invites);
    (prisma.corporateInvite.updateMany as any).mockResolvedValue({ count: 1 });
    (sendCorporateActivationEmail as any).mockRejectedValue(new Error("Resend timeout"));
    (prisma.corporateInvite.update as any).mockResolvedValue({});

    const result = await sendInvitations(
      { userId: HOST_USER_ID, poolId: POOL_ID },
      AUDIT_CTX,
    );

    expect(prisma.corporateInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: { status: "FAILED" },
      }),
    );
    expect(result).toEqual({ sent: 0, failed: 1 });
  });

  it("mixed scenario: one wins claim and sends OK, another loses claim", async () => {
    const invites = [
      inviteFixture("inv-1", "winner@acme.com"),
      inviteFixture("inv-2", "loser@acme.com"),
    ];
    (prisma.corporateInvite.findMany as any).mockResolvedValue(invites);
    // First claim: wins. Second claim: loses (raced by another invocation).
    (prisma.corporateInvite.updateMany as any)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    (sendCorporateActivationEmail as any).mockResolvedValue({ success: true });

    const result = await sendInvitations(
      { userId: HOST_USER_ID, poolId: POOL_ID },
      AUDIT_CTX,
    );

    expect(sendCorporateActivationEmail).toHaveBeenCalledTimes(1);
    expect(sendCorporateActivationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "winner@acme.com" }),
    );
    expect(result).toEqual({ sent: 1, failed: 0 });
  });
});
