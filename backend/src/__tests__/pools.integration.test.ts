/**
 * Pool & Related Endpoints — Integration Tests
 *
 * These tests call the REAL API at api.picks4all.com.
 * All tests are READ-ONLY or test validation/auth errors.
 * The test user (e2e-test@picks4all.com) is a PLAYER with no admin permissions.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { api, loginTestUser } from "./api-helpers";

describe("Pool endpoints", () => {
  let cookie: string;
  let userId: string;

  beforeAll(async () => {
    const session = await loginTestUser();
    cookie = session.cookie;
    userId = session.userId;
  });

  // ─── POST /pools/join ───────────────────────────────────────

  describe("POST /pools/join", () => {
    it("returns 404 for invalid invite code", async () => {
      const res = await api("POST", "/pools/join", {
        cookie,
        body: { code: "INVALID_CODE_XYZ_99" },
      });
      expect(res.status).toBe(404);
      expect(res.data).toHaveProperty("error", "NOT_FOUND");
    });

    it("returns 400 for missing code", async () => {
      const res = await api("POST", "/pools/join", {
        cookie,
        body: {},
      });
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty("error", "VALIDATION_ERROR");
      expect(res.data).toHaveProperty("details");
    });

    it("returns 401 without auth", async () => {
      const res = await api("POST", "/pools/join", {
        body: { code: "TESTCODE" },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /me/pools ─────────────────────────────────────────

  describe("GET /me/pools", () => {
    it("returns the authenticated user's pool list", async () => {
      const res = await api("GET", "/me/pools", { cookie });
      expect(res.status).toBe(200);
      // sendData spreads directly: { pools: [...] }
      expect(res.data).toHaveProperty("pools");
      expect(Array.isArray(res.data.pools)).toBe(true);
    });

    it("each pool membership has expected shape", async () => {
      const res = await api("GET", "/me/pools", { cookie });
      expect(res.status).toBe(200);
      for (const membership of res.data.pools) {
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

  // ─── POST /pools (create — validation only) ────────────────

  describe("POST /pools (validation only)", () => {
    it("returns 400 for empty body", async () => {
      const res = await api("POST", "/pools", {
        cookie,
        body: {},
      });
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty("error", "VALIDATION_ERROR");
    });

    it("returns 400 for name too short", async () => {
      const res = await api("POST", "/pools", {
        cookie,
        body: {
          tournamentInstanceId: "nonexistent-id",
          name: "ab", // min 3
        },
      });
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty("error", "VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await api("POST", "/pools", {
        body: { tournamentInstanceId: "x", name: "Test Pool" },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /catalog/instances ────────────────────────────────

  describe("GET /catalog/instances", () => {
    it("returns a list of tournament instances", async () => {
      const res = await api("GET", "/catalog/instances", { cookie });
      expect(res.status).toBe(200);
      // sendData: { instances: [...] }
      expect(res.data).toHaveProperty("instances");
      expect(Array.isArray(res.data.instances)).toBe(true);
    });

    it("each instance has expected shape", async () => {
      const res = await api("GET", "/catalog/instances", { cookie });
      expect(res.status).toBe(200);
      if (res.data.instances.length > 0) {
        const instance = res.data.instances[0];
        expect(instance).toHaveProperty("id");
        expect(instance).toHaveProperty("name");
        expect(instance).toHaveProperty("status");
        expect(instance).toHaveProperty("template");
        expect(instance.template).toHaveProperty("key");
        expect(instance.template).toHaveProperty("name");
      }
    });

    it("returns 401 without auth", async () => {
      const res = await api("GET", "/catalog/instances");
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /legal/documents/:type ────────────────────────────

  describe("GET /legal/documents/:type", () => {
    it("returns terms of service document", async () => {
      const res = await api("GET", "/legal/documents/terms");
      // Public endpoint — may return 200 or 404 if no docs seeded
      expect(res.status).toBeLessThan(500);
    });

    it("returns privacy policy document", async () => {
      const res = await api("GET", "/legal/documents/privacy");
      expect(res.status).toBeLessThan(500);
    });

    it("returns 400 for invalid document type", async () => {
      const res = await api("GET", "/legal/documents/bogus");
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty("error", "INVALID_TYPE");
    });
  });

  // ─── POST /feedback (validation only) ──────────────────────

  describe("POST /feedback", () => {
    it("returns 400 for missing required fields", async () => {
      const res = await api("POST", "/feedback", {
        cookie,
        body: {},
      });
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty("error", "VALIDATION_ERROR");
    });

    it("returns 400 for message too short", async () => {
      const res = await api("POST", "/feedback", {
        cookie,
        body: { type: "BUG", message: "short" }, // min 10 chars
      });
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty("error", "VALIDATION_ERROR");
    });

    it("returns 400 for invalid type enum", async () => {
      const res = await api("POST", "/feedback", {
        cookie,
        body: { type: "INVALID_TYPE", message: "This is a long enough message for validation" },
      });
      expect(res.status).toBe(400);
    });
  });
});
