/**
 * User / Me Integration Tests
 *
 * Tests against the REAL API at api.picks4all.com.
 * All tests that modify state are safely reversible (toggle on → toggle off).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { api, loginTestUser } from "./api-helpers";

describe("User endpoints", () => {
  let cookie: string;
  let userId: string;

  beforeAll(async () => {
    const session = await loginTestUser();
    cookie = session.cookie;
    userId = session.userId;
  });

  // ─── GET /users/me/profile ──────────────────────────────────

  describe("GET /users/me/profile", () => {
    it("returns user profile with expected fields", async () => {
      const res = await api("GET", "/users/me/profile", { cookie });
      expect(res.status).toBe(200);
      const { user } = res.data;
      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
      expect(user.email).toBe("e2e-test@picks4all.com");
      expect(user).toHaveProperty("username");
      expect(user).toHaveProperty("displayName");
      expect(user).toHaveProperty("platformRole");
      expect(user).toHaveProperty("status");
      expect(user).toHaveProperty("createdAtUtc");
    });

    it("includes optional profile fields (may be null)", async () => {
      const res = await api("GET", "/users/me/profile", { cookie });
      const { user } = res.data;
      // These fields exist but may be null for the test account
      expect(user).toHaveProperty("firstName");
      expect(user).toHaveProperty("lastName");
      expect(user).toHaveProperty("bio");
      expect(user).toHaveProperty("country");
      expect(user).toHaveProperty("timezone");
    });

    it("returns 401 without auth cookie", async () => {
      const res = await api("GET", "/users/me/profile");
      expect(res.status).toBe(401);
    });

    it("returns 401 with invalid cookie", async () => {
      const res = await api("GET", "/users/me/profile", {
        cookie: "p4a_token=invalid-jwt-garbage; p4a_logged_in=1",
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /me/pools ─────────────────────────────────────────

  describe("GET /me/pools", () => {
    it("returns pool list (array)", async () => {
      const res = await api("GET", "/me/pools", { cookie });
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("pools");
      expect(Array.isArray(res.data.pools)).toBe(true);
    });

    it("each pool has expected shape", async () => {
      const res = await api("GET", "/me/pools", { cookie });
      if (res.data.pools.length > 0) {
        const membership = res.data.pools[0];
        expect(membership).toHaveProperty("poolId");
        expect(membership).toHaveProperty("role");
        expect(membership).toHaveProperty("status");
        expect(membership).toHaveProperty("pool");
        expect(membership.pool).toHaveProperty("id");
        expect(membership.pool).toHaveProperty("name");
        expect(membership.pool).toHaveProperty("status");
      }
    });

    it("returns 401 without auth", async () => {
      const res = await api("GET", "/me/pools");
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /me/email-preferences ─────────────────────────────

  describe("GET /me/email-preferences", () => {
    it("returns email preferences with all expected fields", async () => {
      const res = await api("GET", "/me/email-preferences", { cookie });
      expect(res.status).toBe(200);
      const { preferences } = res.data;
      expect(preferences).toBeDefined();
      expect(typeof preferences.emailNotificationsEnabled).toBe("boolean");
      expect(typeof preferences.emailPoolInvitations).toBe("boolean");
      expect(typeof preferences.emailDeadlineReminders).toBe("boolean");
      expect(typeof preferences.emailResultNotifications).toBe("boolean");
      expect(typeof preferences.emailPoolCompletions).toBe("boolean");
      expect(typeof preferences.predictionUpdates).toBe("boolean");
    });

    it("includes platformEnabled flags", async () => {
      const res = await api("GET", "/me/email-preferences", { cookie });
      const { platformEnabled } = res.data;
      expect(platformEnabled).toBeDefined();
      expect(typeof platformEnabled.emailPoolInvitations).toBe("boolean");
      expect(typeof platformEnabled.emailDeadlineReminders).toBe("boolean");
      expect(typeof platformEnabled.emailResultNotifications).toBe("boolean");
      expect(typeof platformEnabled.emailPoolCompletions).toBe("boolean");
    });

    it("includes descriptions object", async () => {
      const res = await api("GET", "/me/email-preferences", { cookie });
      const { descriptions } = res.data;
      expect(descriptions).toBeDefined();
      expect(typeof descriptions.emailNotificationsEnabled).toBe("string");
      expect(typeof descriptions.predictionUpdates).toBe("string");
    });

    it("returns 401 without auth", async () => {
      const res = await api("GET", "/me/email-preferences");
      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /me/prediction-subscription ───────────────────────

  describe("PUT /me/prediction-subscription", () => {
    it("toggles subscription on and returns enabled: true", async () => {
      const res = await api("PUT", "/me/prediction-subscription", {
        cookie,
        body: { enabled: true },
      });
      expect(res.status).toBe(200);
      expect(res.data.enabled).toBe(true);
    });

    it("toggles subscription off and returns enabled: false", async () => {
      const res = await api("PUT", "/me/prediction-subscription", {
        cookie,
        body: { enabled: false },
      });
      expect(res.status).toBe(200);
      expect(res.data.enabled).toBe(false);
    });

    it("returns 400 for invalid body (missing enabled)", async () => {
      const res = await api("PUT", "/me/prediction-subscription", {
        cookie,
        body: {},
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for non-boolean enabled", async () => {
      const res = await api("PUT", "/me/prediction-subscription", {
        cookie,
        body: { enabled: "yes" as any },
      });
      expect(res.status).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const res = await api("PUT", "/me/prediction-subscription", {
        body: { enabled: true },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /me/prediction-subscription ───────────────────────

  describe("GET /me/prediction-subscription", () => {
    it("returns current subscription status", async () => {
      const res = await api("GET", "/me/prediction-subscription", { cookie });
      expect(res.status).toBe(200);
      expect(typeof res.data.enabled).toBe("boolean");
    });

    it("returns 401 without auth", async () => {
      const res = await api("GET", "/me/prediction-subscription");
      expect(res.status).toBe(401);
    });
  });
});
