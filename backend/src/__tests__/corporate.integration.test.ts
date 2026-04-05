/**
 * Corporate & Admin Endpoints — Integration Tests
 *
 * These tests call the REAL API at api.picks4all.com.
 * Corporate inquiry tests only validate errors — they never create real inquiries.
 * Admin tests verify that the test user (PLAYER role) is properly rejected with 403.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { api, loginTestUser } from "./api-helpers";

describe("Corporate endpoints", () => {
  // ─── POST /corporate/inquiry (validation errors only) ─────

  describe("POST /corporate/inquiry", () => {
    it("returns 400 for empty body", async () => {
      const res = await api("POST", "/corporate/inquiry", {
        body: {},
      });
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty("error", "VALIDATION_ERROR");
      expect(res.data).toHaveProperty("details");
    });

    it("returns 400 for invalid email format", async () => {
      const res = await api("POST", "/corporate/inquiry", {
        body: {
          companyName: "Test Corp",
          contactName: "Test User",
          contactEmail: "not-an-email",
        },
      });
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty("error", "VALIDATION_ERROR");
    });

    it("returns 400 for company name too short", async () => {
      const res = await api("POST", "/corporate/inquiry", {
        body: {
          companyName: "X", // min 2
          contactName: "Test User",
          contactEmail: "test@example.com",
        },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for contact name too short", async () => {
      const res = await api("POST", "/corporate/inquiry", {
        body: {
          companyName: "Test Corp",
          contactName: "X", // min 2
          contactEmail: "test@example.com",
        },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid employeeCount enum value", async () => {
      const res = await api("POST", "/corporate/inquiry", {
        body: {
          companyName: "Test Corp",
          contactName: "Test User",
          contactEmail: "test@example.com",
          employeeCount: "999999", // not in enum
        },
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /auth/activate-corporate (validation) ───────────

  describe("POST /auth/activate-corporate", () => {
    it("returns 400 for missing token", async () => {
      const res = await api("POST", "/auth/activate-corporate", {
        body: {},
      });
      expect(res.status).toBe(400);
    });

    it("returns error for invalid token", async () => {
      const res = await api("POST", "/auth/activate-corporate", {
        body: {
          token: "nonexistent-token-abc123",
          password: "ValidPass1!",
          displayName: "Test User",
        },
      });
      // Should be 400 or 404 depending on implementation
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });
});

describe("Admin endpoints (require ADMIN role)", () => {
  let cookie: string;

  beforeAll(async () => {
    const session = await loginTestUser();
    cookie = session.cookie;
  });

  // ─── GET /admin/settings/email ─────────────────────────────

  it("GET /admin/settings/email returns 403 for non-admin user", async () => {
    const res = await api("GET", "/admin/settings/email", { cookie });
    expect(res.status).toBe(403);
    expect(res.data).toHaveProperty("error");
  });

  // ─── POST /admin/prediction-update ─────────────────────────

  it("POST /admin/prediction-update returns 403 for non-admin", async () => {
    const res = await api("POST", "/admin/prediction-update", {
      cookie,
      body: { changes: [{ type: "TEST", description: "test" }] },
    });
    expect(res.status).toBe(403);
  });

  // ─── GET /admin/templates ──────────────────────────────────

  it("GET /admin/templates returns 403 for non-admin", async () => {
    const res = await api("GET", "/admin/templates", { cookie });
    expect(res.status).toBe(403);
  });

  // ─── GET /admin/instances ──────────────────────────────────

  it("GET /admin/instances returns 403 for non-admin", async () => {
    const res = await api("GET", "/admin/instances", { cookie });
    expect(res.status).toBe(403);
  });

  // ─── Admin endpoints require auth at all ───────────────────

  it("GET /admin/settings/email returns 401 without auth", async () => {
    const res = await api("GET", "/admin/settings/email");
    expect(res.status).toBe(401);
  });
});
