import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../db";

// ── Mocks ──────────────────────────────────────────────────────
// Keeping a separate test file (not authService.security.test.ts) so the
// minimal prisma mocks of that file don't get polluted with the broader
// surface needed for activateCorporateAccount.

vi.mock("../db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    corporateInvite: { findUnique: vi.fn(), updateMany: vi.fn() },
    poolMember: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    pool: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("../lib/audit", () => ({ writeAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/email", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendPasswordChangedEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("../lib/asyncHelpers", () => ({ fireAndForget: vi.fn() }));
vi.mock("./poolStateMachine", () => ({ transitionToActive: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/poolCapacity", () => ({
  ensurePoolCapacity: vi.fn().mockResolvedValue(undefined),
  checkAndNotifyCapacityThresholds: vi.fn().mockResolvedValue({ state: "none", emailSent: false }),
  notifyHostOfBlockedAttempt: vi.fn().mockResolvedValue({ emailSent: false }),
}));
vi.mock("../lib/googleAuth", () => ({ verifyGoogleToken: vi.fn() }));
vi.mock("../lib/metaCapi", () => ({ sendCapiEvent: vi.fn() }));
vi.mock("../lib/ga4", () => ({ sendGa4Event: vi.fn() }));

import { activateCorporateAccount, ServiceError } from "./authService";

const AUDIT_CTX = { ip: "127.0.0.1", userAgent: "vitest" };

const VALID_INVITE = {
  id: "inv-1",
  poolId: "pool-aaa",
  email: "bob@empresa.com",
  status: "PENDING",
  activationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  pool: {
    id: "pool-aaa",
    name: "Mundial 2026",
    maxParticipants: 100,
    organization: { name: "Acme Corp" },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default $transaction passthrough so any inner write hits the mocked prisma.
  (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
});

describe("activateCorporateAccount — SESSION_MISMATCH defence", () => {
  it("throws SESSION_MISMATCH when current cookie user has a different email than the invite", async () => {
    // Scenario: Alice is logged in (currentUserId = alice's id) and opens
    // an invitation link addressed to bob@empresa.com. The previous
    // implementation would silently overwrite Alice's session with Bob's.
    // The fix: refuse with 409 SESSION_MISMATCH so the frontend can show
    // a clear "you're signed in as X, this is for Y" panel.
    (prisma.corporateInvite.findUnique as any).mockResolvedValue(VALID_INVITE);
    (prisma.user.findUnique as any).mockResolvedValueOnce({
      email: "alice@empresa.com",
    });

    await expect(
      activateCorporateAccount(
        { activationToken: "tok-x", currentUserId: "alice-id" },
        AUDIT_CTX,
      ),
    ).rejects.toMatchObject({
      code: "SESSION_MISMATCH",
      statusHint: 409,
      extra: expect.objectContaining({
        currentUserEmail: "alice@empresa.com",
        inviteEmail: "bob@empresa.com",
      }),
    });
  });

  // Helper: drive the existing-user happy path far enough that we can prove
  // the SESSION_MISMATCH check did NOT fire. We don't assert the final
  // result (the rest of the activation flow has its own tests) — we only
  // assert that the SESSION_MISMATCH error was not thrown.
  function setupHappyExistingUser(currentUserEmail: string | null) {
    (prisma.corporateInvite.findUnique as any).mockResolvedValue(VALID_INVITE);
    if (currentUserEmail !== null) {
      // current session lookup — same email as invite, NO mismatch
      (prisma.user.findUnique as any).mockResolvedValueOnce({ email: currentUserEmail });
    }
    // existing-user-by-email lookup
    (prisma.user.findUnique as any).mockResolvedValueOnce({
      id: "bob-id",
      email: "bob@empresa.com",
      platformRole: "PLAYER",
    });
    // Inside the tx: claim invite + check membership.
    (prisma.corporateInvite.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.poolMember.findUnique as any).mockResolvedValue({ id: "mem-1" }); // already member, no create
  }

  it("matches case-insensitively (Bob@Empresa.com === bob@empresa.com → no SESSION_MISMATCH)", async () => {
    // Email comparison must normalise case. Otherwise a legitimate Bob who
    // signed up with mixed case would get blocked from his own invite.
    setupHappyExistingUser("Bob@Empresa.com");

    let thrown: unknown = null;
    try {
      await activateCorporateAccount(
        { activationToken: "tok-x", currentUserId: "bob-id" },
        AUDIT_CTX,
      );
    } catch (err) {
      thrown = err;
    }
    // Whatever happens after the SESSION_MISMATCH check is fine — we only
    // assert that error code did NOT come up.
    if (thrown && (thrown as ServiceError).code === "SESSION_MISMATCH") {
      throw new Error("SESSION_MISMATCH was thrown for case-insensitive match — bug");
    }
  });

  it("no currentUserId (anonymous browser) skips the check entirely", async () => {
    // Most legitimate users open the invite link without a session — that's
    // the common case. The check must no-op when currentUserId is null,
    // and the service must NOT call user.findUnique for the session check.
    setupHappyExistingUser(null);

    let thrown: unknown = null;
    try {
      await activateCorporateAccount(
        { activationToken: "tok-x", currentUserId: null },
        AUDIT_CTX,
      );
    } catch (err) {
      thrown = err;
    }
    if (thrown && (thrown as ServiceError).code === "SESSION_MISMATCH") {
      throw new Error("SESSION_MISMATCH was thrown without a current session — bug");
    }
  });

  it("currentUserId pointing at a deleted/non-existent user (stale cookie) skips the check", async () => {
    // Edge: user was deleted (or DB out of sync with JWT). currentUser lookup
    // returns null. We treat that as no-mismatch and proceed normally — the
    // worst-case outcome is the user gets a fresh session as the invitee,
    // which is the intended magic-link semantics.
    (prisma.corporateInvite.findUnique as any).mockResolvedValue(VALID_INVITE);
    (prisma.user.findUnique as any)
      .mockResolvedValueOnce(null) // currentUserId lookup → not found
      .mockResolvedValueOnce({ id: "bob-id", email: "bob@empresa.com", platformRole: "PLAYER" });
    (prisma.corporateInvite.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.poolMember.findUnique as any).mockResolvedValue({ id: "mem-1" });

    let thrown: unknown = null;
    try {
      await activateCorporateAccount(
        { activationToken: "tok-x", currentUserId: "stale-id" },
        AUDIT_CTX,
      );
    } catch (err) {
      thrown = err;
    }
    if (thrown && (thrown as ServiceError).code === "SESSION_MISMATCH") {
      throw new Error("SESSION_MISMATCH was thrown for stale cookie — bug");
    }
  });
});
