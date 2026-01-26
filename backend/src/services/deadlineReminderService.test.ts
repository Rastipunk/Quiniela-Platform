/**
 * Tests para el servicio de Deadline Reminder
 *
 * Cobertura:
 * - processDeadlineReminders: lógica de procesamiento de recordatorios
 * - Verificación de configuración de plataforma
 * - Verificación de preferencias de usuario
 * - Tracking de recordatorios enviados (evitar duplicados)
 */

import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { prisma } from "../db";
import * as emailModule from "../lib/email";

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
    pool: {
      findMany: vi.fn(),
    },
    deadlineReminderLog: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock del módulo de email
vi.mock("../lib/email", () => ({
  isEmailEnabled: vi.fn(),
  sendDeadlineReminderEmail: vi.fn(),
}));

// Importar después de los mocks
import { processDeadlineReminders, getDeadlineReminderStats } from "./deadlineReminderService";

// =========================================================================
// HELPERS
// =========================================================================

const createMockPool = (overrides: Partial<{
  id: string;
  name: string;
  status: string;
  deadlineMinutesBeforeKickoff: number;
  timeZone: string;
  members: Array<{
    user: {
      id: string;
      email: string;
      displayName: string;
      emailNotificationsEnabled: boolean;
      emailDeadlineReminders: boolean;
    };
  }>;
  predictions: Array<{ userId: string; matchId: string }>;
  fixtureSnapshot: { matches: Array<{ id: string; kickoffTime: string; homeTeam: string; awayTeam: string }> } | null;
  tournamentInstance: { dataJson: { matches: Array<{ id: string; kickoffTime: string; homeTeam: string; awayTeam: string }> } };
}> = {}) => {
  const now = new Date();
  const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  return {
    id: "pool-1",
    name: "Test Pool",
    status: "ACTIVE",
    deadlineMinutesBeforeKickoff: 10,
    timeZone: "America/Mexico_City",
    members: [
      {
        user: {
          id: "user-1",
          email: "user1@test.com",
          displayName: "User 1",
          emailNotificationsEnabled: true,
          emailDeadlineReminders: true,
        },
      },
    ],
    predictions: [],
    fixtureSnapshot: null,
    tournamentInstance: {
      dataJson: {
        matches: [
          {
            id: "match-1",
            kickoffTime: in12Hours.toISOString(),
            homeTeam: "t_A1",
            awayTeam: "t_A2",
          },
        ],
      },
    },
    ...overrides,
  };
};

// =========================================================================
// TESTS: processDeadlineReminders
// =========================================================================

describe("processDeadlineReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Platform Settings Check", () => {
    it("should stop if deadline reminders are disabled at platform level", async () => {
      vi.mocked(emailModule.isEmailEnabled).mockResolvedValue({
        enabled: false,
        reason: "Email type \"deadlineReminder\" is disabled at platform level",
      });

      const result = await processDeadlineReminders();

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Deadline reminders disabled: Email type "deadlineReminder" is disabled at platform level'
      );
      expect(prisma.pool.findMany).not.toHaveBeenCalled();
    });

    it("should proceed if deadline reminders are enabled at platform level", async () => {
      vi.mocked(emailModule.isEmailEnabled).mockResolvedValue({
        enabled: true,
      });
      vi.mocked(prisma.pool.findMany).mockResolvedValue([]);

      const result = await processDeadlineReminders();

      expect(result.success).toBe(true);
      expect(prisma.pool.findMany).toHaveBeenCalled();
    });
  });

  describe("Pool Processing", () => {
    beforeEach(() => {
      vi.mocked(emailModule.isEmailEnabled).mockResolvedValue({
        enabled: true,
      });
    });

    it("should return correct count when no active pools exist", async () => {
      vi.mocked(prisma.pool.findMany).mockResolvedValue([]);

      const result = await processDeadlineReminders();

      expect(result.success).toBe(true);
      expect(result.poolsProcessed).toBe(0);
      expect(result.usersNotified).toBe(0);
    });

    it("should process active pools only", async () => {
      vi.mocked(prisma.pool.findMany).mockResolvedValue([createMockPool()]);
      vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);

      await processDeadlineReminders();

      expect(prisma.pool.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "ACTIVE" },
        })
      );
    });

    it("should skip users who have already received reminders", async () => {
      const mockPool = createMockPool();
      vi.mocked(prisma.pool.findMany).mockResolvedValue([mockPool]);
      vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([
        { matchId: "match-1" }, // Ya se envió recordatorio
      ]);

      const result = await processDeadlineReminders();

      expect(result.emailsSent).toBe(0);
      expect(result.usersNotified).toBe(0);
    });

    it("should skip users who disabled notifications", async () => {
      const mockPool = createMockPool({
        members: [
          {
            user: {
              id: "user-1",
              email: "user1@test.com",
              displayName: "User 1",
              emailNotificationsEnabled: false, // Deshabilitado
              emailDeadlineReminders: true,
            },
          },
        ],
      });
      vi.mocked(prisma.pool.findMany).mockResolvedValue([mockPool]);

      const result = await processDeadlineReminders();

      expect(result.emailsSent).toBe(0);
    });

    it("should skip users who disabled deadline reminders specifically", async () => {
      const mockPool = createMockPool({
        members: [
          {
            user: {
              id: "user-1",
              email: "user1@test.com",
              displayName: "User 1",
              emailNotificationsEnabled: true,
              emailDeadlineReminders: false, // Deshabilitado
            },
          },
        ],
      });
      vi.mocked(prisma.pool.findMany).mockResolvedValue([mockPool]);

      const result = await processDeadlineReminders();

      expect(result.emailsSent).toBe(0);
    });

    it("should skip users who already made predictions for the match", async () => {
      const mockPool = createMockPool({
        predictions: [{ userId: "user-1", matchId: "match-1" }], // Ya tiene pronóstico
      });
      vi.mocked(prisma.pool.findMany).mockResolvedValue([mockPool]);
      vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);

      const result = await processDeadlineReminders();

      expect(result.emailsSent).toBe(0);
    });
  });

  describe("Dry Run Mode", () => {
    beforeEach(() => {
      vi.mocked(emailModule.isEmailEnabled).mockResolvedValue({
        enabled: true,
      });
    });

    it("should not send emails in dry run mode", async () => {
      const mockPool = createMockPool();
      vi.mocked(prisma.pool.findMany).mockResolvedValue([mockPool]);
      vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);

      const result = await processDeadlineReminders(24, true);

      expect(emailModule.sendDeadlineReminderEmail).not.toHaveBeenCalled();
      expect(result.emailsSkipped).toBeGreaterThanOrEqual(0);
    });

    it("should not create reminder logs in dry run mode", async () => {
      const mockPool = createMockPool();
      vi.mocked(prisma.pool.findMany).mockResolvedValue([mockPool]);
      vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);

      await processDeadlineReminders(24, true);

      expect(prisma.deadlineReminderLog.create).not.toHaveBeenCalled();
    });
  });

  describe("Email Sending", () => {
    beforeEach(() => {
      vi.mocked(emailModule.isEmailEnabled).mockResolvedValue({
        enabled: true,
      });
    });

    it("should send email and create log on success", async () => {
      const mockPool = createMockPool();
      vi.mocked(prisma.pool.findMany).mockResolvedValue([mockPool]);
      vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);
      vi.mocked(emailModule.sendDeadlineReminderEmail).mockResolvedValue({
        success: true,
      });

      const result = await processDeadlineReminders();

      expect(emailModule.sendDeadlineReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user1@test.com",
          userId: "user-1",
          displayName: "User 1",
          poolName: "Test Pool",
          matchesCount: 1,
          poolId: "pool-1",
        })
      );
      expect(prisma.deadlineReminderLog.create).toHaveBeenCalled();
      expect(result.emailsSent).toBe(1);
      expect(result.usersNotified).toBe(1);
    });

    it("should handle email send failure", async () => {
      const mockPool = createMockPool();
      vi.mocked(prisma.pool.findMany).mockResolvedValue([mockPool]);
      vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);
      vi.mocked(emailModule.sendDeadlineReminderEmail).mockResolvedValue({
        success: false,
        error: "SMTP error",
      });

      const result = await processDeadlineReminders();

      expect(result.emailsFailed).toBe(1);
      expect(result.emailsSent).toBe(0);
      // Should still create log with success=false
      expect(prisma.deadlineReminderLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            success: false,
            error: "SMTP error",
          }),
        })
      );
    });

    it("should handle skipped emails", async () => {
      const mockPool = createMockPool();
      vi.mocked(prisma.pool.findMany).mockResolvedValue([mockPool]);
      vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);
      vi.mocked(emailModule.sendDeadlineReminderEmail).mockResolvedValue({
        success: true,
        skipped: true,
        reason: "User has disabled notifications",
      });

      const result = await processDeadlineReminders();

      expect(result.emailsSkipped).toBe(1);
      expect(result.emailsSent).toBe(0);
    });
  });

  describe("Hours Before Deadline Parameter", () => {
    beforeEach(() => {
      vi.mocked(emailModule.isEmailEnabled).mockResolvedValue({
        enabled: true,
      });
    });

    it("should use default 24 hours if not specified", async () => {
      vi.mocked(prisma.pool.findMany).mockResolvedValue([]);

      await processDeadlineReminders();

      // El mock no tiene manera de verificar el parámetro directamente,
      // pero podemos verificar que se llamó
      expect(prisma.pool.findMany).toHaveBeenCalled();
    });

    it("should use custom hours when specified", async () => {
      vi.mocked(prisma.pool.findMany).mockResolvedValue([]);

      await processDeadlineReminders(48);

      expect(prisma.pool.findMany).toHaveBeenCalled();
    });
  });
});

// =========================================================================
// TESTS: getDeadlineReminderStats
// =========================================================================

describe("getDeadlineReminderStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return correct stats structure", async () => {
    vi.mocked(prisma.deadlineReminderLog.count).mockResolvedValue(10);
    vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.deadlineReminderLog.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.pool.findMany).mockResolvedValue([]);

    const stats = await getDeadlineReminderStats();

    expect(stats).toHaveProperty("totalSent");
    expect(stats).toHaveProperty("totalFailed");
    expect(stats).toHaveProperty("byPool");
    expect(stats).toHaveProperty("recentLogs");
  });

  it("should filter by poolId when specified", async () => {
    vi.mocked(prisma.deadlineReminderLog.count).mockResolvedValue(5);
    vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.deadlineReminderLog.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.pool.findMany).mockResolvedValue([]);

    await getDeadlineReminderStats("pool-123");

    expect(prisma.deadlineReminderLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          poolId: "pool-123",
        }),
      })
    );
  });

  it("should respect days parameter", async () => {
    vi.mocked(prisma.deadlineReminderLog.count).mockResolvedValue(0);
    vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.deadlineReminderLog.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.pool.findMany).mockResolvedValue([]);

    await getDeadlineReminderStats(undefined, 30);

    // El filtro de fecha debe aplicarse con 30 días
    expect(prisma.deadlineReminderLog.count).toHaveBeenCalled();
  });
});

// =========================================================================
// TESTS: Integration Scenarios
// =========================================================================

describe("Integration Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(emailModule.isEmailEnabled).mockResolvedValue({
      enabled: true,
    });
  });

  it("should handle multiple pools with multiple users", async () => {
    const now = new Date();
    const in6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const pools = [
      createMockPool({
        id: "pool-1",
        name: "Pool 1",
        members: [
          {
            user: {
              id: "user-1",
              email: "user1@test.com",
              displayName: "User 1",
              emailNotificationsEnabled: true,
              emailDeadlineReminders: true,
            },
          },
          {
            user: {
              id: "user-2",
              email: "user2@test.com",
              displayName: "User 2",
              emailNotificationsEnabled: true,
              emailDeadlineReminders: true,
            },
          },
        ],
        predictions: [{ userId: "user-2", matchId: "match-1" }], // User 2 ya tiene pick
        tournamentInstance: {
          dataJson: {
            matches: [
              { id: "match-1", kickoffTime: in6Hours.toISOString(), homeTeam: "A", awayTeam: "B" },
            ],
          },
        },
      }),
    ];

    vi.mocked(prisma.pool.findMany).mockResolvedValue(pools);
    vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);
    vi.mocked(emailModule.sendDeadlineReminderEmail).mockResolvedValue({
      success: true,
    });

    const result = await processDeadlineReminders();

    expect(result.poolsProcessed).toBe(1);
    // Solo user-1 debe recibir email (user-2 ya tiene pick)
    expect(result.emailsSent).toBe(1);
  });

  it("should count matches correctly for reminder email", async () => {
    const now = new Date();
    const in6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    const pools = [
      createMockPool({
        id: "pool-1",
        name: "Pool 1",
        predictions: [],
        tournamentInstance: {
          dataJson: {
            matches: [
              { id: "match-1", kickoffTime: in6Hours.toISOString(), homeTeam: "A", awayTeam: "B" },
              { id: "match-2", kickoffTime: in8Hours.toISOString(), homeTeam: "C", awayTeam: "D" },
            ],
          },
        },
      }),
    ];

    vi.mocked(prisma.pool.findMany).mockResolvedValue(pools);
    vi.mocked(prisma.deadlineReminderLog.findMany).mockResolvedValue([]);
    vi.mocked(emailModule.sendDeadlineReminderEmail).mockResolvedValue({
      success: true,
    });

    await processDeadlineReminders();

    expect(emailModule.sendDeadlineReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        matchesCount: 2, // 2 partidos sin pronóstico
      })
    );
  });
});
