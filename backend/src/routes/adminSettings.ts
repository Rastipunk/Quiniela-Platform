/**
 * Admin Settings API
 *
 * Endpoints para gestionar la configuración de la plataforma.
 * Solo accesible por usuarios con rol ADMIN.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { writeAuditEvent } from "../lib/audit";
import { PlatformRole } from "@prisma/client";
import {
  sendWelcomeEmail,
  sendPoolInvitationEmail,
  sendDeadlineReminderEmail,
  sendResultPublishedEmail,
  sendPoolCompletedEmail,
} from "../lib/email";
import {
  processDeadlineReminders,
  getDeadlineReminderStats,
} from "../services/deadlineReminderService";

// Tipo extendido de Request con autenticación
interface AuthenticatedRequest extends Request {
  auth?: { userId: string; platformRole: PlatformRole };
}

const router = Router();

// Aplicar middleware de autenticación y admin a todas las rutas
router.use(requireAuth, requireAdmin);

// =========================================================================
// Schemas de validación
// =========================================================================

const updateEmailSettingsSchema = z.object({
  emailWelcomeEnabled: z.boolean().optional(),
  emailPoolInvitationEnabled: z.boolean().optional(),
  emailDeadlineReminderEnabled: z.boolean().optional(),
  emailResultPublishedEnabled: z.boolean().optional(),
  emailPoolCompletedEnabled: z.boolean().optional(),
});

// =========================================================================
// GET /admin/settings/email
// Obtiene la configuración actual de emails de la plataforma
// =========================================================================

router.get("/email", async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Obtener o crear configuración
    let settings = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: { id: "singleton" },
      });
    }

    // Obtener info del admin que hizo el último cambio (si existe)
    let updatedByUser = null;
    if (settings.updatedById) {
      updatedByUser = await prisma.user.findUnique({
        where: { id: settings.updatedById },
        select: { displayName: true, email: true },
      });
    }

    return res.json({
      settings: {
        emailWelcomeEnabled: settings.emailWelcomeEnabled,
        emailPoolInvitationEnabled: settings.emailPoolInvitationEnabled,
        emailDeadlineReminderEnabled: settings.emailDeadlineReminderEnabled,
        emailResultPublishedEnabled: settings.emailResultPublishedEnabled,
        emailPoolCompletedEnabled: settings.emailPoolCompletedEnabled,
      },
      metadata: {
        updatedAt: settings.updatedAt,
        updatedBy: updatedByUser
          ? {
              displayName: updatedByUser.displayName,
              email: updatedByUser.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching email settings:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error al obtener configuración de emails.",
    });
  }
});

// =========================================================================
// PUT /admin/settings/email
// Actualiza la configuración de emails de la plataforma
// =========================================================================

router.put("/email", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth!.userId;

    // Validar body
    const parseResult = updateEmailSettingsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Datos inválidos.",
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const updates = parseResult.data;

    // Verificar que hay al menos un campo para actualizar
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Debe especificar al menos un campo para actualizar.",
      });
    }

    // Obtener configuración actual para comparar cambios
    const currentSettings = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });

    // Construir objeto de cambios para audit log
    const changes: Record<string, { from: boolean; to: boolean }> = {};
    for (const [key, newValue] of Object.entries(updates)) {
      if (newValue !== undefined) {
        const oldValue =
          currentSettings?.[key as keyof typeof currentSettings] ?? true;
        if (oldValue !== newValue) {
          changes[key] = { from: oldValue as boolean, to: newValue };
        }
      }
    }

    // Si no hay cambios reales, retornar sin actualizar
    if (Object.keys(changes).length === 0) {
      return res.json({
        message: "No hay cambios que aplicar.",
        settings: currentSettings,
      });
    }

    // Actualizar configuración
    const updatedSettings = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        ...updates,
        updatedById: userId,
      },
      update: {
        ...updates,
        updatedById: userId,
      },
    });

    // Registrar en audit log
    await writeAuditEvent({
      actorUserId: userId,
      action: "PLATFORM_EMAIL_SETTINGS_UPDATED",
      entityType: "PlatformSettings",
      entityId: "singleton",
      dataJson: {
        changes,
        newSettings: {
          emailWelcomeEnabled: updatedSettings.emailWelcomeEnabled,
          emailPoolInvitationEnabled: updatedSettings.emailPoolInvitationEnabled,
          emailDeadlineReminderEnabled:
            updatedSettings.emailDeadlineReminderEnabled,
          emailResultPublishedEnabled:
            updatedSettings.emailResultPublishedEnabled,
          emailPoolCompletedEnabled: updatedSettings.emailPoolCompletedEnabled,
        },
      },
    });

    return res.json({
      message: "Configuración de emails actualizada exitosamente.",
      settings: {
        emailWelcomeEnabled: updatedSettings.emailWelcomeEnabled,
        emailPoolInvitationEnabled: updatedSettings.emailPoolInvitationEnabled,
        emailDeadlineReminderEnabled:
          updatedSettings.emailDeadlineReminderEnabled,
        emailResultPublishedEnabled: updatedSettings.emailResultPublishedEnabled,
        emailPoolCompletedEnabled: updatedSettings.emailPoolCompletedEnabled,
      },
      changes,
    });
  } catch (error) {
    console.error("Error updating email settings:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error al actualizar configuración de emails.",
    });
  }
});

// =========================================================================
// GET /admin/settings/email/stats
// Obtiene estadísticas de uso de emails (opcional, para dashboard)
// =========================================================================

router.get("/email/stats", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // Por ahora retornamos datos básicos
    // TODO: Implementar tracking real de emails enviados
    return res.json({
      stats: {
        message:
          "Estadísticas de emails no implementadas. Consulta el dashboard de Resend.",
        resendDashboard: "https://resend.com/emails",
      },
    });
  } catch (error) {
    console.error("Error fetching email stats:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error al obtener estadísticas de emails.",
    });
  }
});

// =========================================================================
// POST /admin/settings/email/test
// Envía un email de prueba del tipo especificado
// Solo para admins - útil para verificar que los templates funcionan
// =========================================================================

const testEmailSchema = z.object({
  type: z.enum([
    "welcome",
    "poolInvitation",
    "deadlineReminder",
    "resultPublished",
    "poolCompleted",
  ]),
  to: z.string().email(),
});

router.post("/email/test", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth!.userId;

    // Validar body
    const parseResult = testEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Datos inválidos. Especifica 'type' y 'to' (email válido).",
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { type, to } = parseResult.data;

    // Obtener datos del admin para usar como ejemplo
    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true },
    });

    let result;
    const testPoolName = "Quiniela Mundial 2026 (PRUEBA)";
    const testPoolId = "test-pool-id";

    switch (type) {
      case "welcome":
        result = await sendWelcomeEmail({
          to,
          userId, // Usa el userId del admin para bypasear checks
          displayName: adminUser?.displayName || "Usuario de Prueba",
        });
        break;

      case "poolInvitation":
        result = await sendPoolInvitationEmail({
          to,
          userId,
          inviterName: adminUser?.displayName || "Admin",
          poolName: testPoolName,
          inviteCode: "TEST123",
          poolDescription: "Esta es una invitación de prueba para verificar el template de email.",
        });
        break;

      case "deadlineReminder":
        result = await sendDeadlineReminderEmail({
          to,
          userId,
          displayName: adminUser?.displayName || "Usuario",
          poolName: testPoolName,
          matchesCount: 3,
          deadlineTime: "Hoy a las 8:00 PM",
          poolId: testPoolId,
        });
        break;

      case "resultPublished":
        result = await sendResultPublishedEmail({
          to,
          userId,
          displayName: adminUser?.displayName || "Usuario",
          poolName: testPoolName,
          matchDescription: "México vs Argentina",
          result: "2 - 1",
          pointsEarned: 8,
          currentRank: 3,
          totalParticipants: 15,
          poolId: testPoolId,
        });
        break;

      case "poolCompleted":
        result = await sendPoolCompletedEmail({
          to,
          userId,
          displayName: adminUser?.displayName || "Usuario",
          poolName: testPoolName,
          finalRank: 2,
          totalPoints: 145,
          totalParticipants: 15,
          exactScores: 5,
          poolId: testPoolId,
        });
        break;

      default:
        return res.status(400).json({
          error: "INVALID_TYPE",
          message: `Tipo de email no válido: ${type}`,
        });
    }

    // Log del test
    await writeAuditEvent({
      actorUserId: userId,
      action: "TEST_EMAIL_SENT",
      entityType: "Email",
      entityId: type,
      dataJson: { type, to, result },
    });

    if (result.success) {
      return res.json({
        message: `Email de prueba "${type}" enviado exitosamente a ${to}`,
        type,
        to,
        skipped: result.skipped,
        skipReason: result.reason,
      });
    } else {
      return res.status(500).json({
        error: "EMAIL_SEND_FAILED",
        message: `Error al enviar email de prueba: ${result.error}`,
        type,
        to,
      });
    }
  } catch (error) {
    console.error("Error sending test email:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error al enviar email de prueba.",
    });
  }
});

// =========================================================================
// POST /admin/settings/email/reminders/run
// Ejecuta manualmente el proceso de envío de recordatorios de deadline
// =========================================================================

const runRemindersSchema = z.object({
  hoursBeforeDeadline: z.number().min(1).max(168).optional().default(24), // 1h - 7 días
  dryRun: z.boolean().optional().default(false),
});

router.post(
  "/email/reminders/run",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth!.userId;

      // Validar body
      const parseResult = runRemindersSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Datos inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const { hoursBeforeDeadline, dryRun } = parseResult.data;

      console.log(
        `📧 Admin ${userId} ejecutando recordatorios de deadline (hours=${hoursBeforeDeadline}, dryRun=${dryRun})`
      );

      // Ejecutar proceso de recordatorios
      const result = await processDeadlineReminders(hoursBeforeDeadline, dryRun);

      // Log de auditoría
      await writeAuditEvent({
        actorUserId: userId,
        action: "DEADLINE_REMINDERS_EXECUTED",
        entityType: "DeadlineReminder",
        entityId: "manual",
        dataJson: {
          hoursBeforeDeadline,
          dryRun,
          poolsProcessed: result.poolsProcessed,
          usersNotified: result.usersNotified,
          emailsSent: result.emailsSent,
          emailsSkipped: result.emailsSkipped,
          emailsFailed: result.emailsFailed,
        },
      });

      return res.json({
        message: dryRun
          ? "Simulación de recordatorios completada (no se enviaron emails)"
          : "Proceso de recordatorios completado",
        result,
      });
    } catch (error) {
      console.error("Error running deadline reminders:", error);
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Error al ejecutar proceso de recordatorios.",
      });
    }
  }
);

// =========================================================================
// GET /admin/settings/email/reminders/stats
// Obtiene estadísticas de recordatorios enviados
// =========================================================================

router.get(
  "/email/reminders/stats",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const poolId = req.query.poolId as string | undefined;
      const days = parseInt(req.query.days as string) || 7;

      const stats = await getDeadlineReminderStats(poolId, days);

      return res.json({
        stats,
        period: {
          days,
          poolId: poolId || "all",
        },
      });
    } catch (error) {
      console.error("Error fetching reminder stats:", error);
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Error al obtener estadísticas de recordatorios.",
      });
    }
  }
);

export default router;
