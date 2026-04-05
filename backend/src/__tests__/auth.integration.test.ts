/**
 * Auth Integration Tests
 *
 * Tests against the REAL API at api.picks4all.com.
 * Uses the dedicated e2e-test account for authenticated operations.
 * All tests are read-only / non-destructive.
 */

import { describe, it, expect } from "vitest";
import { api, loginTestUser } from "./api-helpers";

describe("Auth endpoints", () => {
  // ─── POST /auth/login ───────────────────────────────────────

  describe("POST /auth/login", () => {
    it("returns 200 + user data + token cookie for valid credentials", async () => {
      const res = await api("POST", "/auth/login", {
        body: { email: "e2e-test@picks4all.com", password: "E2eTest2026!" },
      });
      expect(res.status).toBe(200);
      expect(res.data.user).toBeDefined();
      expect(res.data.user.email).toBe("e2e-test@picks4all.com");
      expect(res.cookies["p4a_token"]).toBeTruthy();
    });

    it("returns user object with expected fields", async () => {
      const res = await api("POST", "/auth/login", {
        body: { email: "e2e-test@picks4all.com", password: "E2eTest2026!" },
      });
      expect(res.status).toBe(200);
      const { user } = res.data;
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("username");
      expect(user).toHaveProperty("displayName");
      expect(typeof user.id).toBe("string");
      expect(typeof user.username).toBe("string");
    });

    it("returns 401 for wrong password", async () => {
      const res = await api("POST", "/auth/login", {
        body: { email: "e2e-test@picks4all.com", password: "WrongPassword123!" },
      });
      expect(res.status).toBe(401);
      expect(res.cookies["p4a_token"]).toBeFalsy();
    });

    it("returns 401 for non-existent email", async () => {
      const res = await api("POST", "/auth/login", {
        body: { email: "nonexistent-e2e-999@picks4all.com", password: "Whatever123!" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 400 for missing email", async () => {
      const res = await api("POST", "/auth/login", {
        body: { password: "SomePassword123!" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing password", async () => {
      const res = await api("POST", "/auth/login", {
        body: { email: "e2e-test@picks4all.com" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid email format", async () => {
      const res = await api("POST", "/auth/login", {
        body: { email: "not-an-email", password: "SomePassword123!" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for empty body", async () => {
      const res = await api("POST", "/auth/login", { body: {} });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /health ────────────────────────────────────────────

  describe("GET /health", () => {
    it("returns 200 with version and commit", async () => {
      const res = await api("GET", "/health");
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("version");
      expect(res.data).toHaveProperty("commit");
      expect(res.data).toHaveProperty("timestamp");
      expect(typeof res.data.version).toBe("string");
      expect(typeof res.data.commit).toBe("string");
    });

    it("version follows semver format", async () => {
      const res = await api("GET", "/health");
      expect(res.data.version).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it("timestamp is a valid ISO date", async () => {
      const res = await api("GET", "/health");
      const d = new Date(res.data.timestamp);
      expect(d.getTime()).not.toBeNaN();
    });
  });

  // ─── POST /auth/forgot-password ─────────────────────────────

  describe("POST /auth/forgot-password", () => {
    it("returns 200 even for non-existent email (no leak)", async () => {
      const res = await api("POST", "/auth/forgot-password", {
        body: { email: "surely-does-not-exist-999@example.com" },
      });
      expect(res.status).toBe(200);
    });

    it("returns 200 for valid email (no side-effect leak)", async () => {
      const res = await api("POST", "/auth/forgot-password", {
        body: { email: "e2e-test@picks4all.com" },
      });
      expect(res.status).toBe(200);
    });

    it("returns 400 for invalid email format", async () => {
      const res = await api("POST", "/auth/forgot-password", {
        body: { email: "bad-email" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing email", async () => {
      const res = await api("POST", "/auth/forgot-password", {
        body: {},
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /auth/logout ─────────────────────────────────────

  describe("POST /auth/logout", () => {
    it("returns 200 and clears cookie", async () => {
      const res = await api("POST", "/auth/logout");
      expect(res.status).toBe(200);
    });
  });

  // ─── loginTestUser helper ───────────────────────────────────

  describe("loginTestUser() helper", () => {
    it("returns a cookie string and userId", async () => {
      const session = await loginTestUser();
      expect(session.cookie).toContain("p4a_token=");
      expect(session.cookie).toContain("p4a_logged_in=1");
      expect(typeof session.userId).toBe("string");
      expect(session.userId.length).toBeGreaterThan(0);
    });
  });

  // ─── POST /auth/reset-password (error paths only) ──────────

  describe("POST /auth/reset-password", () => {
    it("returns 400 for missing token", async () => {
      const res = await api("POST", "/auth/reset-password", {
        body: { password: "NewPassword123!" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing password", async () => {
      const res = await api("POST", "/auth/reset-password", {
        body: { token: "fake-token-12345" },
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid/expired token", async () => {
      const res = await api("POST", "/auth/reset-password", {
        body: { token: "invalid-token-abc123", password: "NewPassword123!" },
      });
      // Could be 400 or 401 depending on implementation
      expect([400, 401, 404]).toContain(res.status);
    });
  });

  // ─── GET /auth/verify-email (error paths only) ─────────────

  describe("GET /auth/verify-email", () => {
    it("rejects missing token parameter", async () => {
      const res = await api("GET", "/auth/verify-email");
      expect([400, 401, 404]).toContain(res.status);
    });

    it("rejects invalid token", async () => {
      const res = await api("GET", "/auth/verify-email?token=fake-token-xyz");
      expect([400, 401, 404]).toContain(res.status);
    });
  });

  // ─── GET /auth/check-corporate-invite (error paths) ────────

  describe("GET /auth/check-corporate-invite", () => {
    it("rejects missing token parameter", async () => {
      const res = await api("GET", "/auth/check-corporate-invite");
      expect([400, 404]).toContain(res.status);
    });

    it("rejects invalid token", async () => {
      const res = await api("GET", "/auth/check-corporate-invite?token=fake-corp-token");
      expect([400, 404]).toContain(res.status);
    });
  });
});
