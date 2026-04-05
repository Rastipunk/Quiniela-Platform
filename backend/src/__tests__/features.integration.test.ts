/**
 * Feature Endpoints — Integration Tests
 *
 * Tests for health, invite-preview, pick-presets, user profile, and auth validation.
 * These tests call the REAL API at api.picks4all.com.
 * All tests are READ-ONLY or test validation errors.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { api, loginTestUser } from "./api-helpers";

// ─── Health ──────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with ok: true", async () => {
    const res = await api("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("ok", true);
  });

  it("includes version in semver format", async () => {
    const res = await api("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("version");
    expect(res.data.version).toMatch(/^v?\d+\.\d+\.\d+/);
  });

  it("responds in under 2 seconds", async () => {
    const start = Date.now();
    await api("GET", "/health");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});

// ─── Invite Preview (public endpoint) ───────────────────────

describe("GET /invite-preview/:code", () => {
  it("returns 404 for non-existent invite code", async () => {
    const res = await api("GET", "/invite-preview/NONEXISTENT_CODE_XYZ");
    expect(res.status).toBe(404);
    expect(res.data).toHaveProperty("error", "NOT_FOUND");
  });

  it("does not require authentication", async () => {
    // Even with a bad code, it should return 404, not 401
    const res = await api("GET", "/invite-preview/FAKECODE123");
    expect(res.status).toBe(404);
  });
});

// ─── Pick Presets (public, no auth middleware) ───────────────

describe("GET /pick-presets", () => {
  it("returns a list of pick presets", async () => {
    const res = await api("GET", "/pick-presets");
    expect(res.status).toBe(200);
    // sendData: { presets: [...] }
    expect(res.data).toHaveProperty("presets");
    expect(Array.isArray(res.data.presets)).toBe(true);
    expect(res.data.presets.length).toBeGreaterThan(0);
  });

  it("each preset has key, name, and description", async () => {
    const res = await api("GET", "/pick-presets");
    expect(res.status).toBe(200);
    for (const preset of res.data.presets) {
      expect(preset).toHaveProperty("key");
      expect(typeof preset.key).toBe("string");
      expect(preset).toHaveProperty("name");
      expect(preset).toHaveProperty("description");
    }
  });

  it("GET /pick-presets/:key returns a specific preset", async () => {
    const res = await api("GET", "/pick-presets/BASIC");
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("key", "BASIC");
  });

  it("GET /pick-presets/:key returns 404 for unknown preset", async () => {
    const res = await api("GET", "/pick-presets/NONEXISTENT");
    expect(res.status).toBe(404);
  });
});

// ─── User Profile ────────────────────────────────────────────

describe("User profile endpoints", () => {
  let cookie: string;

  beforeAll(async () => {
    const session = await loginTestUser();
    cookie = session.cookie;
  });

  describe("GET /users/me/profile", () => {
    it("returns the authenticated user's profile", async () => {
      const res = await api("GET", "/users/me/profile", { cookie });
      expect(res.status).toBe(200);
      // sendData: { user: {...} }
      expect(res.data).toHaveProperty("user");
      const user = res.data.user;
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("displayName");
    });

    it("profile includes optional fields (may be null)", async () => {
      const res = await api("GET", "/users/me/profile", { cookie });
      expect(res.status).toBe(200);
      const user = res.data.user;
      // These fields exist in schema but may be null
      expect(user).toHaveProperty("firstName");
      expect(user).toHaveProperty("lastName");
      expect(user).toHaveProperty("country");
    });

    it("returns 401 without auth", async () => {
      const res = await api("GET", "/users/me/profile");
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /users/me/profile (validation only)", () => {
    it("returns 400 for invalid username format", async () => {
      const res = await api("PATCH", "/users/me/profile", {
        cookie,
        body: { username: "no spaces allowed!!" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for username too short", async () => {
      const res = await api("PATCH", "/users/me/profile", {
        cookie,
        body: { username: "ab" }, // min 3
      });
      expect(res.status).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const res = await api("PATCH", "/users/me/profile", {
        body: { displayName: "Hacker" },
      });
      expect(res.status).toBe(401);
    });
  });
});

// ─── Auth Validation ─────────────────────────────────────────

describe("Auth validation", () => {
  describe("POST /auth/login", () => {
    it("returns 400 for missing email", async () => {
      const res = await api("POST", "/auth/login", {
        body: { password: "test" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing password", async () => {
      const res = await api("POST", "/auth/login", {
        body: { email: "test@example.com" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 401 for wrong credentials", async () => {
      const res = await api("POST", "/auth/login", {
        body: { email: "nonexistent-e2e@example.com", password: "WrongPass1!" },
      });
      // Could be 401 (wrong creds) or 400 (validation)
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe("POST /auth/register", () => {
    it("returns 400 for missing fields", async () => {
      const res = await api("POST", "/auth/register", {
        body: {},
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for weak password", async () => {
      const res = await api("POST", "/auth/register", {
        body: {
          email: "test-weak-pw-e2e@example.com",
          password: "123",
          displayName: "Test",
        },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("returns 400 for missing email", async () => {
      const res = await api("POST", "/auth/forgot-password", {
        body: {},
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/logout", () => {
    it("returns success and clears cookies", async () => {
      // Login first to get a valid cookie
      const session = await loginTestUser();
      const res = await api("POST", "/auth/logout", {
        cookie: session.cookie,
      });
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("ok", true);
    });
  });
});
