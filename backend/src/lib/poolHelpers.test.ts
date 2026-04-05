import { describe, it, expect } from "vitest";
import { outcomeFromScore, makeInviteCode } from "./poolHelpers";

describe("poolHelpers", () => {
  // ── outcomeFromScore ──────────────────────────────────────

  describe("outcomeFromScore", () => {
    it("returns HOME when home scores more", () => {
      expect(outcomeFromScore(3, 1)).toBe("HOME");
    });

    it("returns AWAY when away scores more", () => {
      expect(outcomeFromScore(0, 2)).toBe("AWAY");
    });

    it("returns DRAW when scores are equal", () => {
      expect(outcomeFromScore(1, 1)).toBe("DRAW");
    });

    it("returns DRAW for 0-0", () => {
      expect(outcomeFromScore(0, 0)).toBe("DRAW");
    });

    it("returns HOME for 1-0", () => {
      expect(outcomeFromScore(1, 0)).toBe("HOME");
    });

    it("returns AWAY for 0-1", () => {
      expect(outcomeFromScore(0, 1)).toBe("AWAY");
    });

    it("handles high scores correctly", () => {
      expect(outcomeFromScore(7, 1)).toBe("HOME");
      expect(outcomeFromScore(2, 9)).toBe("AWAY");
      expect(outcomeFromScore(5, 5)).toBe("DRAW");
    });
  });

  // ── makeInviteCode ────────────────────────────────────────

  describe("makeInviteCode", () => {
    it("returns a hex string", () => {
      const code = makeInviteCode();
      expect(code).toMatch(/^[0-9a-f]+$/);
    });

    it("returns a string of 12 characters (6 bytes = 12 hex chars)", () => {
      const code = makeInviteCode();
      expect(code).toHaveLength(12);
    });

    it("generates different codes on successive calls", () => {
      const codes = new Set(Array.from({ length: 20 }, () => makeInviteCode()));
      expect(codes.size).toBe(20);
    });

    it("returns a string type", () => {
      expect(typeof makeInviteCode()).toBe("string");
    });
  });
});
