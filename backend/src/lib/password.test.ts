import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password helpers", () => {
  describe("hashPassword", () => {
    it("returns a bcrypt hash (starts with $2b$)", async () => {
      const hash = await hashPassword("MyPassword123");
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it("produces different hashes for the same input (unique salt)", async () => {
      const hash1 = await hashPassword("same-password");
      const hash2 = await hashPassword("same-password");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("returns true for correct password", async () => {
      const hash = await hashPassword("correct-password");
      const result = await verifyPassword("correct-password", hash);
      expect(result).toBe(true);
    });

    it("returns false for wrong password", async () => {
      const hash = await hashPassword("correct-password");
      const result = await verifyPassword("wrong-password", hash);
      expect(result).toBe(false);
    });
  });
});
