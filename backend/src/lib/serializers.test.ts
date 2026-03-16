import { describe, it, expect } from "vitest";
import { serializeUser } from "./serializers";

describe("serializeUser", () => {
  const fullUser = {
    id: "user-123",
    email: "test@example.com",
    username: "testuser",
    displayName: "Test User",
    platformRole: "USER" as const,
    status: "ACTIVE",
    // Simulated sensitive fields that should NOT appear in output
    passwordHash: "$2b$12$secrethash",
    emailVerificationToken: "abc123secret",
    createdAt: new Date("2026-01-01"),
  };

  it("returns only safe fields", () => {
    const result = serializeUser(fullUser);

    expect(result).toEqual({
      id: "user-123",
      email: "test@example.com",
      username: "testuser",
      displayName: "Test User",
      platformRole: "USER",
      status: "ACTIVE",
    });
  });

  it("strips sensitive fields (passwordHash, tokens, dates)", () => {
    const result = serializeUser(fullUser);

    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("emailVerificationToken");
    expect(result).not.toHaveProperty("createdAt");
  });

  it("returns exactly 6 keys", () => {
    const result = serializeUser(fullUser);
    expect(Object.keys(result)).toHaveLength(6);
  });
});
