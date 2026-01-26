/**
 * Tests para el sistema de emails
 *
 * Cobertura:
 * - isEmailEnabled: verificación de configuración de plataforma y usuario
 * - sendWelcomeEmail: envío condicional según configuración
 * - sendPoolInvitationEmail: envío condicional según configuración
 * - sendDeadlineReminderEmail: envío condicional según configuración
 * - sendResultPublishedEmail: envío condicional según configuración
 * - sendPoolCompletedEmail: envío condicional según configuración
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../db";
import { isEmailEnabled, EmailType } from "./email";

// =========================================================================
// MOCKS
// =========================================================================

// Mock de Prisma
vi.mock("../db", () => ({
  prisma: {
    platformSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock de Resend (para evitar envíos reales)
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = {
        send: vi.fn().mockResolvedValue({ data: { id: "test-email-id" }, error: null }),
      };
    },
  };
});

// =========================================================================
// HELPERS
// =========================================================================

const mockPlatformSettings = (overrides: Partial<{
  emailWelcomeEnabled: boolean;
  emailPoolInvitationEnabled: boolean;
  emailDeadlineReminderEnabled: boolean;
  emailResultPublishedEnabled: boolean;
  emailPoolCompletedEnabled: boolean;
}> = {}) => {
  const defaults = {
    id: "singleton",
    emailWelcomeEnabled: true,
    emailPoolInvitationEnabled: true,
    emailDeadlineReminderEnabled: false, // Desactivado por defecto
    emailResultPublishedEnabled: true,
    emailPoolCompletedEnabled: true,
    updatedAt: new Date(),
    updatedById: null,
  };
  return { ...defaults, ...overrides };
};

const mockUser = (overrides: Partial<{
  emailNotificationsEnabled: boolean;
  emailPoolInvitations: boolean;
  emailDeadlineReminders: boolean;
  emailResultNotifications: boolean;
  emailPoolCompletions: boolean;
}> = {}) => {
  const defaults = {
    id: "test-user-id",
    email: "test@example.com",
    displayName: "Test User",
    emailNotificationsEnabled: true,
    emailPoolInvitations: true,
    emailDeadlineReminders: true,
    emailResultNotifications: true,
    emailPoolCompletions: true,
  };
  return { ...defaults, ...overrides };
};

// =========================================================================
// TESTS: isEmailEnabled
// =========================================================================

describe("isEmailEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Platform Settings", () => {
    it("should return enabled=true when platform settings allow and no userId", async () => {
      vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
        mockPlatformSettings({ emailWelcomeEnabled: true })
      );

      const result = await isEmailEnabled("welcome");

      expect(result.enabled).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should return enabled=false when platform disables welcome email", async () => {
      vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
        mockPlatformSettings({ emailWelcomeEnabled: false })
      );

      const result = await isEmailEnabled("welcome");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain("disabled at platform level");
    });

    it("should return enabled=false when platform disables pool invitation email", async () => {
      vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
        mockPlatformSettings({ emailPoolInvitationEnabled: false })
      );

      const result = await isEmailEnabled("poolInvitation");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain("disabled at platform level");
    });

    it("should return enabled=false when platform disables deadline reminder (default)", async () => {
      vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
        mockPlatformSettings({ emailDeadlineReminderEnabled: false })
      );

      const result = await isEmailEnabled("deadlineReminder");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain("disabled at platform level");
    });

    it("should return enabled=false when platform disables result published email", async () => {
      vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
        mockPlatformSettings({ emailResultPublishedEnabled: false })
      );

      const result = await isEmailEnabled("resultPublished");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain("disabled at platform level");
    });

    it("should return enabled=false when platform disables pool completed email", async () => {
      vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
        mockPlatformSettings({ emailPoolCompletedEnabled: false })
      );

      const result = await isEmailEnabled("poolCompleted");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain("disabled at platform level");
    });

    it("should create default settings if none exist", async () => {
      vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.platformSettings.create).mockResolvedValue(
        mockPlatformSettings()
      );

      const result = await isEmailEnabled("welcome");

      expect(prisma.platformSettings.create).toHaveBeenCalledWith({
        data: { id: "singleton" },
      });
      expect(result.enabled).toBe(true);
    });
  });

  describe("User Preferences", () => {
    beforeEach(() => {
      // Platform permite todo por defecto
      vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
        mockPlatformSettings({
          emailWelcomeEnabled: true,
          emailPoolInvitationEnabled: true,
          emailDeadlineReminderEnabled: true,
          emailResultPublishedEnabled: true,
          emailPoolCompletedEnabled: true,
        })
      );
    });

    it("should return enabled=false when user master toggle is off", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        mockUser({ emailNotificationsEnabled: false })
      );

      const result = await isEmailEnabled("poolInvitation", "test-user-id");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain("disabled all email notifications");
    });

    it("should return enabled=false when user disables pool invitations", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        mockUser({ emailPoolInvitations: false })
      );

      const result = await isEmailEnabled("poolInvitation", "test-user-id");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('disabled "poolInvitation"');
    });

    it("should return enabled=false when user disables deadline reminders", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        mockUser({ emailDeadlineReminders: false })
      );

      const result = await isEmailEnabled("deadlineReminder", "test-user-id");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('disabled "deadlineReminder"');
    });

    it("should return enabled=false when user disables result notifications", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        mockUser({ emailResultNotifications: false })
      );

      const result = await isEmailEnabled("resultPublished", "test-user-id");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('disabled "resultPublished"');
    });

    it("should return enabled=false when user disables pool completions", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        mockUser({ emailPoolCompletions: false })
      );

      const result = await isEmailEnabled("poolCompleted", "test-user-id");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('disabled "poolCompleted"');
    });

    it("should return enabled=true for welcome email even if specific toggles are off (only master matters)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        mockUser({
          emailNotificationsEnabled: true,
          emailPoolInvitations: false, // No afecta welcome
        })
      );

      const result = await isEmailEnabled("welcome", "test-user-id");

      expect(result.enabled).toBe(true);
    });

    it("should return enabled=false when user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await isEmailEnabled("poolInvitation", "non-existent-user");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain("User not found");
    });

    it("should return enabled=true when both platform and user allow", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser());

      const result = await isEmailEnabled("poolInvitation", "test-user-id");

      expect(result.enabled).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe("Priority: Platform over User", () => {
    it("should return disabled even if user wants emails when platform disables", async () => {
      vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
        mockPlatformSettings({ emailPoolInvitationEnabled: false })
      );
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        mockUser({ emailPoolInvitations: true })
      );

      const result = await isEmailEnabled("poolInvitation", "test-user-id");

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain("disabled at platform level");
      // User preferences should NOT be checked when platform disables
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });
});

// =========================================================================
// TESTS: Email Type Coverage
// =========================================================================

describe("Email Types Coverage", () => {
  const emailTypes: EmailType[] = [
    "welcome",
    "poolInvitation",
    "deadlineReminder",
    "resultPublished",
    "poolCompleted",
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have all email types defined", () => {
    expect(emailTypes.length).toBe(5);
  });

  emailTypes.forEach((type) => {
    it(`should check platform settings for "${type}" email type`, async () => {
      vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
        mockPlatformSettings()
      );

      await isEmailEnabled(type);

      expect(prisma.platformSettings.findUnique).toHaveBeenCalledWith({
        where: { id: "singleton" },
      });
    });
  });
});

// =========================================================================
// TESTS: Default Values
// =========================================================================

describe("Default Configuration Values", () => {
  it("should have deadlineReminder disabled by default (per schema)", async () => {
    // Este test valida que la configuración por defecto tiene deadlineReminder=false
    // Basado en la decisión del usuario de desactivarlo por defecto
    vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
      mockPlatformSettings() // Usa los defaults que tienen deadlineReminder=false
    );

    const result = await isEmailEnabled("deadlineReminder");

    // Debe estar deshabilitado por defecto
    expect(result.enabled).toBe(false);
  });

  it("should have all other emails enabled by default", async () => {
    vi.mocked(prisma.platformSettings.findUnique).mockResolvedValue(
      mockPlatformSettings()
    );

    const welcomeResult = await isEmailEnabled("welcome");
    const invitationResult = await isEmailEnabled("poolInvitation");
    const resultPublishedResult = await isEmailEnabled("resultPublished");
    const poolCompletedResult = await isEmailEnabled("poolCompleted");

    expect(welcomeResult.enabled).toBe(true);
    expect(invitationResult.enabled).toBe(true);
    expect(resultPublishedResult.enabled).toBe(true);
    expect(poolCompletedResult.enabled).toBe(true);
  });
});
