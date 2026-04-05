import { describe, it, expect } from "vitest";
import { validateUsername, normalizeUsername } from "./username";

describe("username utilities", () => {
  // ── validateUsername ───────────────────────────────────────

  describe("validateUsername", () => {
    it("accepts a valid simple username", () => {
      expect(validateUsername("carlos")).toEqual({ valid: true });
    });

    it("accepts a username with numbers", () => {
      expect(validateUsername("player42")).toEqual({ valid: true });
    });

    it("accepts a username with hyphens in the middle", () => {
      expect(validateUsername("my-user")).toEqual({ valid: true });
    });

    it("accepts a username with underscores in the middle", () => {
      expect(validateUsername("my_user")).toEqual({ valid: true });
    });

    it("accepts a 3-character username (minimum)", () => {
      expect(validateUsername("abc")).toEqual({ valid: true });
    });

    it("accepts a 20-character username (maximum)", () => {
      expect(validateUsername("a".repeat(20))).toEqual({ valid: true });
    });

    it("rejects a username shorter than 3 characters", () => {
      const result = validateUsername("ab");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("rejects an empty string", () => {
      const result = validateUsername("");
      expect(result.valid).toBe(false);
    });

    it("rejects a username longer than 20 characters", () => {
      const result = validateUsername("a".repeat(21));
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("rejects a username with spaces", () => {
      const result = validateUsername("my user");
      expect(result.valid).toBe(false);
    });

    it("rejects a username with special characters", () => {
      expect(validateUsername("user@name").valid).toBe(false);
      expect(validateUsername("user!name").valid).toBe(false);
      expect(validateUsername("user.name").valid).toBe(false);
    });

    it("rejects a username starting with a hyphen", () => {
      const result = validateUsername("-myuser");
      expect(result.valid).toBe(false);
    });

    it("rejects a username ending with a hyphen", () => {
      const result = validateUsername("myuser-");
      expect(result.valid).toBe(false);
    });

    it("rejects a username starting with an underscore", () => {
      const result = validateUsername("_myuser");
      expect(result.valid).toBe(false);
    });

    it("rejects a username ending with an underscore", () => {
      const result = validateUsername("myuser_");
      expect(result.valid).toBe(false);
    });

    it("rejects reserved usernames (admin)", () => {
      const result = validateUsername("admin");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("reservado");
    });

    it("rejects reserved usernames case-insensitively", () => {
      expect(validateUsername("Admin").valid).toBe(false);
      expect(validateUsername("ROOT").valid).toBe(false);
      expect(validateUsername("System").valid).toBe(false);
    });

    it("rejects all reserved words: root, system, quiniela, api, www", () => {
      for (const word of ["root", "system", "quiniela", "api", "www"]) {
        expect(validateUsername(word).valid).toBe(false);
      }
    });

    it("trims whitespace before validation", () => {
      expect(validateUsername("  carlos  ")).toEqual({ valid: true });
    });

    it("lowercases before validation", () => {
      expect(validateUsername("Carlos")).toEqual({ valid: true });
    });
  });

  // ── normalizeUsername ─────────────────────────────────────

  describe("normalizeUsername", () => {
    it("trims whitespace", () => {
      expect(normalizeUsername("  hello  ")).toBe("hello");
    });

    it("lowercases the username", () => {
      expect(normalizeUsername("Hello")).toBe("hello");
    });

    it("trims and lowercases together", () => {
      expect(normalizeUsername("  MyUser  ")).toBe("myuser");
    });

    it("returns already normalized usernames unchanged", () => {
      expect(normalizeUsername("carlos")).toBe("carlos");
    });
  });
});
