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
      findUnique: vi.fn(),
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

import { sendInvitations, resendInvitation } from "./corporateService";
import { ServiceError } from "./authService";
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

describe("resendInvitation — single-invite resend with token rotation", () => {
  const HOST_USER_ID = "host-1";
  const POOL_ID = "pool-aaa";
  const INVITE_ID = "inv-1";

  const baseInvite = {
    id: INVITE_ID,
    poolId: POOL_ID,
    email: "lost@acme.com",
    name: null,
    activationToken: "OLD-TOKEN-abc123",
    activationTokenExpiresAt: new Date(Date.now() - 1000), // already expired
    status: "SENT",
    pool: {
      id: POOL_ID,
      name: "Mundial 2026 — Acme",
      organization: {
        name: "Acme Corp",
        logoBase64: null,
        invitationMessage: null,
        primaryColor: null,
        secondaryColor: null,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.poolMember.findUnique as any).mockResolvedValue({
      poolId_userId: { poolId: POOL_ID, userId: HOST_USER_ID },
      role: "CORPORATE_HOST",
    });
  });

  it("rotates the activation token (old token invalidated, new one in DB)", async () => {
    // Critical: a forwarded/leaked old email must NOT remain usable after a
    // resend was issued. The fix rotates the token in the same updateMany
    // claim that flips status back to PENDING, so the activation flow that
    // looks up by token will only recognise the new value.
    (prisma.corporateInvite.findUnique as any).mockResolvedValue(baseInvite);
    (prisma.corporateInvite.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.corporateInvite.update as any).mockResolvedValue({});
    (sendCorporateActivationEmail as any).mockResolvedValue({ success: true });

    const result = await resendInvitation({
      userId: HOST_USER_ID,
      poolId: POOL_ID,
      inviteId: INVITE_ID,
    });

    // The updateMany call must rotate to a fresh non-empty token distinct
    // from the original. We can't predict the random token but we can
    // assert it was passed AND it isn't the old one.
    const updateManyCall = (prisma.corporateInvite.updateMany as any).mock.calls[0][0];
    expect(updateManyCall.data.activationToken).toBeTruthy();
    expect(updateManyCall.data.activationToken).not.toBe(baseInvite.activationToken);
    expect(updateManyCall.data.activationTokenExpiresAt).toBeInstanceOf(Date);
    // Email is sent with the NEW token — not the stale one from the row.
    const emailCall = (sendCorporateActivationEmail as any).mock.calls[0][0];
    expect(emailCall.activationToken).toBe(updateManyCall.data.activationToken);
    expect(result).toEqual({ email: baseInvite.email, status: "SENT" });
  });

  it("rejects with FORBIDDEN when the caller is not the corporate host", async () => {
    (prisma.poolMember.findUnique as any).mockResolvedValue(null);

    await expect(
      resendInvitation({
        userId: "outsider",
        poolId: POOL_ID,
        inviteId: INVITE_ID,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusHint: 403 });
  });

  it("rejects with NOT_FOUND when the invite ID belongs to a different pool", async () => {
    // Defence against an attacker who is host of pool A and tries to
    // resend an invite ID that belongs to pool B.
    (prisma.corporateInvite.findUnique as any).mockResolvedValue({
      ...baseInvite,
      poolId: "different-pool",
    });

    await expect(
      resendInvitation({
        userId: HOST_USER_ID,
        poolId: POOL_ID,
        inviteId: INVITE_ID,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", statusHint: 404 });
  });

  it("rejects with ALREADY_ACTIVATED when the invite status is ACTIVATED", async () => {
    // The user already created an account and joined the pool — there's no
    // sensible re-send. Avoids the awkward UX of sending a "create your
    // account" email to someone who already has an account.
    (prisma.corporateInvite.findUnique as any).mockResolvedValue({
      ...baseInvite,
      status: "ACTIVATED",
    });

    await expect(
      resendInvitation({
        userId: HOST_USER_ID,
        poolId: POOL_ID,
        inviteId: INVITE_ID,
      }),
    ).rejects.toMatchObject({ code: "ALREADY_ACTIVATED", statusHint: 409 });
  });

  it("loses the atomic claim race (count=0) → ALREADY_ACTIVATED", async () => {
    // Race scenario: between the findUnique above (where status was PENDING)
    // and the updateMany, the user activated their account in another tab.
    // updateMany returns count=0 because the WHERE filter requires status
    // to still be PENDING/SENT/FAILED. Surface ALREADY_ACTIVATED rather
    // than silently sending an email with a token the activation flow
    // would now reject.
    (prisma.corporateInvite.findUnique as any).mockResolvedValue(baseInvite);
    (prisma.corporateInvite.updateMany as any).mockResolvedValue({ count: 0 });

    await expect(
      resendInvitation({
        userId: HOST_USER_ID,
        poolId: POOL_ID,
        inviteId: INVITE_ID,
      }),
    ).rejects.toMatchObject({ code: "ALREADY_ACTIVATED", statusHint: 409 });
    // No email send + no further DB writes when we lose the race.
    expect(sendCorporateActivationEmail).not.toHaveBeenCalled();
  });

  it("marks the invite FAILED when the email provider rejects the send", async () => {
    (prisma.corporateInvite.findUnique as any).mockResolvedValue(baseInvite);
    (prisma.corporateInvite.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.corporateInvite.update as any).mockResolvedValue({});
    (sendCorporateActivationEmail as any).mockResolvedValue({
      success: false,
      error: "Resend bounce",
    });

    const result = await resendInvitation({
      userId: HOST_USER_ID,
      poolId: POOL_ID,
      inviteId: INVITE_ID,
    });

    // The token rotation already committed (updateMany with status=PENDING)
    // so the host can retry. The follow-up update flips status to FAILED so
    // the UI shows it as failed and offers another resend.
    expect(prisma.corporateInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INVITE_ID },
        data: { status: "FAILED" },
      }),
    );
    expect(result).toEqual({ email: baseInvite.email, status: "FAILED" });
  });
});
