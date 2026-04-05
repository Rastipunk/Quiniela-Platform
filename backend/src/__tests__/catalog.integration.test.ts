/**
 * Catalog & Public Endpoints Integration Tests
 *
 * Tests against the REAL API at api.picks4all.com.
 * Covers catalog (authenticated), pick-presets (public-ish), and invite-preview.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { api, loginTestUser } from "./api-helpers";

describe("Catalog endpoints", () => {
  let cookie: string;

  beforeAll(async () => {
    const session = await loginTestUser();
    cookie = session.cookie;
  });

  // ─── GET /catalog/instances ─────────────────────────────────

  describe("GET /catalog/instances", () => {
    it("returns active instances array", async () => {
      const res = await api("GET", "/catalog/instances", { cookie });
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("instances");
      expect(Array.isArray(res.data.instances)).toBe(true);
      expect(res.data.instances.length).toBeGreaterThan(0);
    });

    it("each instance has id, name, status, and template", async () => {
      const res = await api("GET", "/catalog/instances", { cookie });
      const instance = res.data.instances[0];
      expect(instance).toHaveProperty("id");
      expect(instance).toHaveProperty("name");
      expect(instance).toHaveProperty("status");
      expect(instance).toHaveProperty("template");
      expect(typeof instance.id).toBe("string");
      expect(typeof instance.name).toBe("string");
      expect(instance.status).toBe("ACTIVE");
    });

    it("template object has key and name", async () => {
      const res = await api("GET", "/catalog/instances", { cookie });
      const { template } = res.data.instances[0];
      expect(template).toHaveProperty("id");
      expect(template).toHaveProperty("key");
      expect(template).toHaveProperty("name");
      expect(typeof template.key).toBe("string");
    });

    it("returns 401 without auth", async () => {
      const res = await api("GET", "/catalog/instances");
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /catalog/instances/:id/phases ──────────────────────

  describe("GET /catalog/instances/:id/phases", () => {
    it("returns phases for a valid instance", async () => {
      // First get an instance id
      const listRes = await api("GET", "/catalog/instances", { cookie });
      const instanceId = listRes.data.instances[0]?.id;
      if (!instanceId) return; // skip if no instances

      const res = await api("GET", `/catalog/instances/${instanceId}/phases`, { cookie });
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("phases");
      expect(Array.isArray(res.data.phases)).toBe(true);
    });

    it("returns 404 for non-existent instance", async () => {
      const res = await api("GET", "/catalog/instances/non-existent-id/phases", { cookie });
      expect(res.status).toBe(404);
    });
  });
});

describe("Pick presets endpoints", () => {
  // ─── GET /pick-presets ──────────────────────────────────────

  describe("GET /pick-presets", () => {
    it("returns preset list with key, name, description", async () => {
      const res = await api("GET", "/pick-presets");
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("presets");
      expect(Array.isArray(res.data.presets)).toBe(true);
      expect(res.data.presets.length).toBeGreaterThan(0);
    });

    it("includes expected preset keys", async () => {
      const res = await api("GET", "/pick-presets");
      const keys = res.data.presets.map((p: any) => p.key);
      // At minimum these presets should exist
      expect(keys).toContain("BASIC");
      expect(keys).toContain("CUMULATIVE");
      expect(keys).toContain("SIMPLE");
    });

    it("each preset has key, name, and description", async () => {
      const res = await api("GET", "/pick-presets");
      for (const preset of res.data.presets) {
        expect(preset).toHaveProperty("key");
        expect(preset).toHaveProperty("name");
        expect(preset).toHaveProperty("description");
        expect(typeof preset.key).toBe("string");
        expect(typeof preset.name).toBe("string");
        expect(typeof preset.description).toBe("string");
      }
    });
  });

  // ─── GET /pick-presets/:key ─────────────────────────────────

  describe("GET /pick-presets/:key", () => {
    it("returns full config for BASIC preset", async () => {
      const res = await api("GET", "/pick-presets/BASIC");
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("key");
      expect(res.data.key).toBe("BASIC");
    });

    it("returns 404 for non-existent preset", async () => {
      const res = await api("GET", "/pick-presets/NON_EXISTENT_PRESET_XYZ");
      expect(res.status).toBe(404);
    });

    it("is case-insensitive (basic → BASIC)", async () => {
      const res = await api("GET", "/pick-presets/basic");
      expect(res.status).toBe(200);
      expect(res.data.key).toBe("BASIC");
    });
  });
});

describe("Invite preview endpoint", () => {
  // ─── GET /invite-preview/:code ──────────────────────────────

  describe("GET /invite-preview/:code", () => {
    it("returns 404 for invalid invite code (no auth needed)", async () => {
      const res = await api("GET", "/invite-preview/INVALID_CODE_12345");
      expect(res.status).toBe(404);
    });

    it("404 response includes error info", async () => {
      const res = await api("GET", "/invite-preview/NONEXISTENT");
      expect(res.status).toBe(404);
      // Should have some error indication in the body
      expect(res.data).toBeDefined();
    });
  });
});
