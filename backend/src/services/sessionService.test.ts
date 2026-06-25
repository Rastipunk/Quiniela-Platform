import { describe, it, expect } from "vitest";
import { generateRefreshToken, hashRefreshToken } from "./sessionService";

describe("sessionService refresh-token crypto (ADR-081)", () => {
  it("generateRefreshToken yields distinct, URL-safe tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url — no +,/,= so it's cookie/URL safe
    expect(a.length).toBeGreaterThan(40); // 48 bytes → ~64 chars
  });

  it("hashRefreshToken is a deterministic sha256 hex digest, never the raw token", () => {
    const token = generateRefreshToken();
    const h1 = hashRefreshToken(token);
    const h2 = hashRefreshToken(token);
    expect(h1).toBe(h2); // deterministic → lookups by hash work
    expect(h1).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(h1).not.toBe(token); // only the hash is stored; a DB leak can't be replayed
  });

  it("different tokens hash to different digests", () => {
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(
      hashRefreshToken(generateRefreshToken()),
    );
  });
});
