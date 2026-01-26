import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";

export const meRouter = Router();

// Comentario en español: este router es para endpoints “mi cuenta”
meRouter.use(requireAuth);

// GET /me/pools
// Comentario en español: lista pools donde el usuario es miembro ACTIVO o PENDING_APPROVAL (para dashboard)
meRouter.get("/pools", async (req, res) => {
  const userId = req.auth!.userId;

  const memberships = await prisma.poolMember.findMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "PENDING_APPROVAL"] as any }
    },
    orderBy: { joinedAtUtc: "desc" },
    include: {
      pool: {
        include: {
          tournamentInstance: true,
        },
      },
    },
  });

  return res.json(
    memberships.map((m) => ({
      poolId: m.poolId,
      role: m.role,
      status: m.status,
      joinedAtUtc: m.joinedAtUtc,
      pool: {
        id: m.pool.id,
        name: m.pool.name,
        description: m.pool.description,
        visibility: m.pool.visibility,
        status: m.pool.status,
        timeZone: m.pool.timeZone,
        deadlineMinutesBeforeKickoff: m.pool.deadlineMinutesBeforeKickoff,
        tournamentInstanceId: m.pool.tournamentInstanceId,
        createdAtUtc: m.pool.createdAtUtc,
        updatedAtUtc: m.pool.updatedAtUtc,
        scoringPresetKey: m.pool.scoringPresetKey ?? "CLASSIC",

      },
      tournamentInstance: m.pool.tournamentInstance
        ? {
            id: m.pool.tournamentInstance.id,
            name: m.pool.tournamentInstance.name,
            status: m.pool.tournamentInstance.status,
            templateId: m.pool.tournamentInstance.templateId,
            templateVersionId: m.pool.tournamentInstance.templateVersionId,
            createdAtUtc: m.pool.tournamentInstance.createdAtUtc,
            updatedAtUtc: m.pool.tournamentInstance.updatedAtUtc,
          }
        : null,
    }))
  );
});

// =========================================================================
// EMAIL PREFERENCES
// =========================================================================

const updateEmailPreferencesSchema = z.object({
  emailNotificationsEnabled: z.boolean().optional(),
  emailPoolInvitations: z.boolean().optional(),
  emailDeadlineReminders: z.boolean().optional(),
  emailResultNotifications: z.boolean().optional(),
  emailPoolCompletions: z.boolean().optional(),
});

// GET /me/email-preferences
// Obtiene las preferencias de email del usuario actual
// También incluye qué emails están habilitados a nivel de plataforma
meRouter.get("/email-preferences", async (req, res) => {
  const userId = req.auth!.userId;

  // Obtener preferencias del usuario y configuración de plataforma en paralelo
  const [user, platformSettings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailNotificationsEnabled: true,
        emailPoolInvitations: true,
        emailDeadlineReminders: true,
        emailResultNotifications: true,
        emailPoolCompletions: true,
      },
    }),
    prisma.platformSettings.findUnique({
      where: { id: "singleton" },
      select: {
        emailWelcomeEnabled: true,
        emailPoolInvitationEnabled: true,
        emailDeadlineReminderEnabled: true,
        emailResultPublishedEnabled: true,
        emailPoolCompletedEnabled: true,
      },
    }),
  ]);

  if (!user) {
    return res.status(404).json({
      error: "USER_NOT_FOUND",
      message: "Usuario no encontrado.",
    });
  }

  // Mapeo de preferencias de usuario a configuración de plataforma
  const platformEnabled = {
    emailPoolInvitations: platformSettings?.emailPoolInvitationEnabled ?? true,
    emailDeadlineReminders: platformSettings?.emailDeadlineReminderEnabled ?? true,
    emailResultNotifications: platformSettings?.emailResultPublishedEnabled ?? true,
    emailPoolCompletions: platformSettings?.emailPoolCompletedEnabled ?? true,
  };

  return res.json({
    preferences: {
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      emailPoolInvitations: user.emailPoolInvitations,
      emailDeadlineReminders: user.emailDeadlineReminders,
      emailResultNotifications: user.emailResultNotifications,
      emailPoolCompletions: user.emailPoolCompletions,
    },
    // Indica qué tipos de email están habilitados a nivel de plataforma
    // Si un tipo está deshabilitado por admin, el usuario no puede recibirlo
    platformEnabled,
    descriptions: {
      emailNotificationsEnabled:
        "Recibir notificaciones por email (excepto recuperación de contraseña)",
      emailPoolInvitations: "Invitaciones a quinielas",
      emailDeadlineReminders: "Recordatorios de deadline para hacer pronósticos",
      emailResultNotifications: "Notificaciones de resultados publicados",
      emailPoolCompletions: "Notificaciones de quinielas finalizadas",
    },
  });
});

// PUT /me/email-preferences
// Actualiza las preferencias de email del usuario actual
meRouter.put("/email-preferences", async (req, res) => {
  const userId = req.auth!.userId;

  // Validar body
  const parseResult = updateEmailPreferencesSchema.safeParse(req.body);
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

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        emailNotificationsEnabled: true,
        emailPoolInvitations: true,
        emailDeadlineReminders: true,
        emailResultNotifications: true,
        emailPoolCompletions: true,
      },
    });

    return res.json({
      message: "Preferencias de email actualizadas exitosamente.",
      preferences: {
        emailNotificationsEnabled: updatedUser.emailNotificationsEnabled,
        emailPoolInvitations: updatedUser.emailPoolInvitations,
        emailDeadlineReminders: updatedUser.emailDeadlineReminders,
        emailResultNotifications: updatedUser.emailResultNotifications,
        emailPoolCompletions: updatedUser.emailPoolCompletions,
      },
    });
  } catch (error) {
    console.error("Error updating email preferences:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error al actualizar preferencias de email.",
    });
  }
});
