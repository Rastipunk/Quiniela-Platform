import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signToken, verifyToken } from "./jwt";

const TEST_SECRET = "test-jwt-secret-for-unit-tests";

describe("JWT helpers", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("signToken", () => {
    it("returns a string with 3 dot-separated parts (JWT format)", () => {
      const token = signToken({ userId: "u1", platformRole: "USER" });
      expect(token.split(".")).toHaveLength(3);
    });

    it("embeds userId and platformRole in the payload", () => {
      const token = signToken({ userId: "u1", platformRole: "ADMIN" });
      const payload = verifyToken(token);

      expect(payload.userId).toBe("u1");
      expect(payload.platformRole).toBe("ADMIN");
    });

    it("throws if JWT_SECRET is missing", () => {
      vi.stubEnv("JWT_SECRET", "");

      expect(() => signToken({ userId: "u1", platformRole: "USER" })).toThrow(
        "JWT_SECRET is missing"
      );
    });
  });

  describe("verifyToken", () => {
    it("decodes a valid token", () => {
      const token = signToken({ userId: "u42", platformRole: "USER" });
      const payload = verifyToken(token);

      expect(payload.userId).toBe("u42");
      expect(payload.platformRole).toBe("USER");
    });

    it("throws on tampered token", () => {
      const token = signToken({ userId: "u1", platformRole: "USER" });
      const tampered = token.slice(0, -5) + "XXXXX";

      expect(() => verifyToken(tampered)).toThrow();
    });

    it("throws on completely invalid token", () => {
      expect(() => verifyToken("not.a.jwt")).toThrow();
    });

    it("throws if JWT_SECRET is missing", () => {
      const token = signToken({ userId: "u1", platformRole: "USER" });
      vi.stubEnv("JWT_SECRET", "");

      expect(() => verifyToken(token)).toThrow("JWT_SECRET is missing");
    });
  });
});
