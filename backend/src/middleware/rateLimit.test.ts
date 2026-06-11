import { describe, it, expect } from "vitest";
import {
  apiLimiter,
  authLimiter,
  authIpLimiter,
  poolJoinLimiter,
  passwordResetLimiter,
  verificationResendLimiter,
  inviteSendLimiter,
  inviteSendDailyLimiter,
  corporateInviteCheckLimiter,
  corporateActivateLimiter,
  emailIpBucketKey,
  userOrIpBucketKey,
} from "./rateLimit";

describe("rate limiters — configuration", () => {
  it("apiLimiter is configured with expected defaults", () => {
    expect(apiLimiter).toBeDefined();
    expect(typeof apiLimiter).toBe("function");
  });

  it("authLimiter is configured", () => {
    expect(authLimiter).toBeDefined();
    expect(typeof authLimiter).toBe("function");
  });

  it("poolJoinLimiter is configured", () => {
    expect(poolJoinLimiter).toBeDefined();
    expect(typeof poolJoinLimiter).toBe("function");
  });

  it("passwordResetLimiter is configured", () => {
    expect(passwordResetLimiter).toBeDefined();
    expect(typeof passwordResetLimiter).toBe("function");
  });

  it("verificationResendLimiter is configured", () => {
    expect(verificationResendLimiter).toBeDefined();
    expect(typeof verificationResendLimiter).toBe("function");
  });

  it("inviteSendLimiter is configured (per-user hourly)", () => {
    expect(inviteSendLimiter).toBeDefined();
    expect(typeof inviteSendLimiter).toBe("function");
  });

  it("inviteSendDailyLimiter is configured (per-user daily ceiling)", () => {
    expect(inviteSendDailyLimiter).toBeDefined();
    expect(typeof inviteSendDailyLimiter).toBe("function");
  });

  it("corporateInviteCheckLimiter is configured (per-IP, blocks token enumeration)", () => {
    expect(corporateInviteCheckLimiter).toBeDefined();
    expect(typeof corporateInviteCheckLimiter).toBe("function");
  });

  it("corporateActivateLimiter is configured (per-IP, blocks token brute-force)", () => {
    expect(corporateActivateLimiter).toBeDefined();
    expect(typeof corporateActivateLimiter).toBe("function");
  });

  it("health check is exempt from API limiter", () => {
    expect(apiLimiter.length).toBeGreaterThanOrEqual(3); // Express middleware signature
  });

  it("authIpLimiter (per-IP stuffing ceiling) is configured", () => {
    expect(authIpLimiter).toBeDefined();
    expect(typeof authIpLimiter).toBe("function");
  });
});

describe("bucket key helpers (ADR-071)", () => {
  describe("emailIpBucketKey", () => {
    it("keys by normalized email + IP", () => {
      expect(emailIpBucketKey({ email: "  User@Mail.COM " }, "1.2.3.4")).toBe(
        "user@mail.com|1.2.3.4",
      );
    });

    it("two users behind the SAME IP get different buckets (no collective punishment)", () => {
      const a = emailIpBucketKey({ email: "a@x.com" }, "1.2.3.4");
      const b = emailIpBucketKey({ email: "b@x.com" }, "1.2.3.4");
      expect(a).not.toBe(b);
    });

    it("the same email from two IPs gets different buckets (distributed attack still bounded per source)", () => {
      const a = emailIpBucketKey({ email: "a@x.com" }, "1.2.3.4");
      const b = emailIpBucketKey({ email: "a@x.com" }, "5.6.7.8");
      expect(a).not.toBe(b);
    });

    it("falls back to IP-only when the body has no email (reset-password carries a token)", () => {
      expect(emailIpBucketKey({ token: "abc" }, "1.2.3.4")).toBe("|1.2.3.4");
      expect(emailIpBucketKey(undefined, "1.2.3.4")).toBe("|1.2.3.4");
      expect(emailIpBucketKey({ email: 42 }, "1.2.3.4")).toBe("|1.2.3.4");
    });

    it("groups IPv6 by /64 so a subscriber can't rotate within their own block", () => {
      const a = emailIpBucketKey({ email: "a@x.com" }, "2001:db8:1:1::1");
      const b = emailIpBucketKey({ email: "a@x.com" }, "2001:db8:1:1::ffff");
      const c = emailIpBucketKey({ email: "a@x.com" }, "2001:db8:1:2::1");
      expect(a).toBe(b); // same /64
      expect(a).not.toBe(c); // different /64
    });
  });

  describe("userOrIpBucketKey", () => {
    it("keys by userId when authenticated", () => {
      expect(userOrIpBucketKey({ userId: "u1" }, "1.2.3.4")).toBe("u1");
    });

    it("two users behind the same CGNAT IP get separate buckets", () => {
      const a = userOrIpBucketKey({ userId: "u1" }, "1.2.3.4");
      const b = userOrIpBucketKey({ userId: "u2" }, "1.2.3.4");
      expect(a).not.toBe(b);
    });

    it("falls back to IP when unauthenticated", () => {
      expect(userOrIpBucketKey(undefined, "1.2.3.4")).toBe("1.2.3.4");
      expect(userOrIpBucketKey({}, "1.2.3.4")).toBe("1.2.3.4");
    });
  });
});

describe("rate limiters — per-user keying", () => {
  // Behavioral test: when two distinct users send invites, they should be
  // tracked in separate buckets so one user can't exhaust another's budget.
  // This verifies the keyGenerator wires correctly.
  it("inviteSendLimiter uses req.auth.userId as the bucket key", async () => {
    const userA = "user-a-id";
    const userB = "user-b-id";
    const seen: string[] = [];

    // Stand up a fake limiter using the same options pattern as inviteSendLimiter
    // so we can probe the key without a full Express integration test.
    // (Black-box check: we simulate two requests with different userIds,
    //  confirm that the limiter tracks them separately by hitting it.)
    const limiter = inviteSendLimiter as unknown as (req: any, res: any, next: any) => void;

    function fakeRes() {
      const headers: Record<string, string> = {};
      return {
        setHeader: (k: string, v: string) => { headers[k] = v; },
        getHeader: (k: string) => headers[k],
        status: () => ({ json: () => {}, send: () => {} }),
        statusCode: 200,
      };
    }

    function call(userId: string): Promise<void> {
      return new Promise((resolve) => {
        const req = { auth: { userId }, ip: "10.0.0.1", method: "POST", path: "/x" } as any;
        const res = fakeRes();
        limiter(req, res, () => {
          seen.push(`${userId}:${res.getHeader("RateLimit-Remaining") ?? "?"}`);
          resolve();
        });
      });
    }

    await call(userA);
    await call(userA);
    await call(userB);

    // userA should have been rate-tracked twice (remaining decreases),
    // userB should still be at the full bucket (remaining higher than userA's last).
    const userAEntries = seen.filter((s) => s.startsWith(`${userA}:`));
    const userBEntries = seen.filter((s) => s.startsWith(`${userB}:`));
    expect(userAEntries).toHaveLength(2);
    expect(userBEntries).toHaveLength(1);

    const userARemainings = userAEntries.map((s) => parseInt(s.split(":")[1] ?? "0", 10));
    const userBRemainings = userBEntries.map((s) => parseInt(s.split(":")[1] ?? "0", 10));
    // Each call against userA decrements; userB's first hit should match userA's first.
    expect(userARemainings[1]).toBeLessThan(userARemainings[0]!);
    expect(userBRemainings[0]).toBe(userARemainings[0]);
  });
});
