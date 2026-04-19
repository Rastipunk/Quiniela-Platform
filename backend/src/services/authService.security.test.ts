import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../db";

// ── Mocks ──────────────────────────────────────────────────────

vi.mock("../db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../lib/audit", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../lib/asyncHelpers", () => ({
  fireAndForget: vi.fn(),
}));

import { requestPasswordReset } from "./authService";

const AUDIT_CTX = { ip: "127.0.0.1", userAgent: "test" };

// ── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestPasswordReset — security", () => {
  it("returns { sent: false } for non-existent email (no enumeration)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await requestPasswordReset("nobody@example.com", AUDIT_CTX);

    expect(result).toEqual({ sent: false });
  });

  it("returns { sent: false, isGoogleOnly: true } for Google-only account (no throw)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-google",
      email: "google@example.com",
      googleId: "goog-123",
      passwordHash: null,
      status: "ACTIVE",
      username: "googleuser",
      country: null,
    });

    const result = await requestPasswordReset("google@example.com", AUDIT_CTX);

    expect(result).toEqual({ sent: false, isGoogleOnly: true });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns { sent: true } for normal user with password", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-normal",
      email: "normal@example.com",
      googleId: null,
      passwordHash: "$2b$10$hashedpassword",
      status: "ACTIVE",
      username: "normaluser",
      country: null,
    });
    (prisma.user.update as any).mockResolvedValue({});

    const result = await requestPasswordReset("normal@example.com", AUDIT_CTX);

    expect(result.sent).toBe(true);
  });

  it("returns { sent: false } for suspended user", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-suspended",
      email: "suspended@example.com",
      googleId: null,
      passwordHash: "$2b$10$hashedpassword",
      status: "SUSPENDED",
      username: "suspendeduser",
    });

    const result = await requestPasswordReset("suspended@example.com", AUDIT_CTX);

    expect(result).toEqual({ sent: false });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("normalizes email to lowercase", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await requestPasswordReset("  UPPER@Example.COM  ", AUDIT_CTX);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "upper@example.com" },
    });
  });
});
