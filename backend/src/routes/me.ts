import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { sendData, sendOk, sendNotFound, sendBadRequest, sendInternal } from "../lib/apiResponse";
import { writeAuditEvent } from "../lib/audit";
import { fireAndForget } from "../lib/asyncHelpers";

export const meRouter = Router();

// Comentario en español: este router es para endpoints “mi cuenta”
meRouter.use(requireAuth);

// GET /me/pools
// Comentario en español: lista pools donde el usuario es miembro ACTIVO, PENDING_APPROVAL o LEFT (para dashboard tabs)
meRouter.get("/pools", async (req, res) => {
  const userId = req.auth!.userId;

  const memberships = await prisma.poolMember.findMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "PENDING_APPROVAL", "LEFT"] }
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

  const pools = memberships.map((m) => ({
      poolId: m.poolId,
      role: m.role,
      status: m.status,
      joinedAtUtc: m.joinedAtUtc,
      leftAtUtc: m.leftAtUtc,
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
        organizationId: m.pool.organizationId ?? null,
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
    }));

  return sendData(res, { pools });
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
  emailNewMemberDigest: z.boolean().optional(),
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
        emailNewMemberDigest: true,
        predictionUpdates: true,
      },
    }),
    prisma.platformSettings.findUnique({
      where: { id: "singleton" },
      select: {
        emailWelcomeEnabled: true,
        emailDeadlineReminderEnabled: true,
        emailResultPublishedEnabled: true,
        emailPoolCompletedEnabled: true,
      },
    }),
  ]);

  if (!user) {
    return sendNotFound(res, "USER_NOT_FOUND", { message: "Usuario no encontrado." });
  }

  // Mapeo de preferencias de usuario a configuración de plataforma
  const platformEnabled = {
    emailDeadlineReminders: platformSettings?.emailDeadlineReminderEnabled ?? true,
    emailResultNotifications: platformSettings?.emailResultPublishedEnabled ?? true,
    emailPoolCompletions: platformSettings?.emailPoolCompletedEnabled ?? true,
  };

  return sendData(res, {
    preferences: {
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      emailPoolInvitations: user.emailPoolInvitations,
      emailDeadlineReminders: user.emailDeadlineReminders,
      emailResultNotifications: user.emailResultNotifications,
      emailPoolCompletions: user.emailPoolCompletions,
      emailNewMemberDigest: user.emailNewMemberDigest,
      predictionUpdates: user.predictionUpdates,
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
      emailNewMemberDigest: "Resumen diario de nuevos miembros en tus pools (para hosts)",
      predictionUpdates: "Actualizaciones de predicciones AI del Mundial 2026",
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
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parseResult.error.flatten().fieldErrors });
  }

  const updates = parseResult.data;

  // Verificar que hay al menos un campo para actualizar
  if (Object.keys(updates).length === 0) {
    return sendBadRequest(res, "VALIDATION_ERROR", { message: "Debe especificar al menos un campo para actualizar." });
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
        emailNewMemberDigest: true,
      },
    });

    return sendOk(res, {
      message: "Preferencias de email actualizadas exitosamente.",
      preferences: {
        emailNotificationsEnabled: updatedUser.emailNotificationsEnabled,
        emailPoolInvitations: updatedUser.emailPoolInvitations,
        emailDeadlineReminders: updatedUser.emailDeadlineReminders,
        emailResultNotifications: updatedUser.emailResultNotifications,
        emailPoolCompletions: updatedUser.emailPoolCompletions,
        emailNewMemberDigest: updatedUser.emailNewMemberDigest,
      },
    });
  } catch (error) {
    console.error("Error updating email preferences:", error);
    return sendInternal(res, "INTERNAL_ERROR", { message: "Error al actualizar preferencias de email." });
  }
});

// =========================================================================
// PREDICTION SUBSCRIPTION
// =========================================================================

const predictionSubscriptionSchema = z.object({
  enabled: z.boolean(),
});

// GET /me/prediction-subscription
// Returns current prediction subscription status
meRouter.get("/prediction-subscription", async (req, res) => {
  const userId = req.auth!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { predictionUpdates: true },
  });

  if (!user) {
    return sendNotFound(res, "USER_NOT_FOUND", { message: "Usuario no encontrado." });
  }

  return sendData(res, { enabled: user.predictionUpdates });
});

// PUT /me/prediction-subscription
// Toggle prediction update subscription
meRouter.put("/prediction-subscription", async (req, res) => {
  const userId = req.auth!.userId;

  const parseResult = predictionSubscriptionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parseResult.error.flatten().fieldErrors });
  }

  const { enabled } = parseResult.data;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { predictionUpdates: enabled },
      select: { predictionUpdates: true },
    });

    // Audit event for subscription change
    fireAndForget("audit:prediction-subscription", writeAuditEvent({
      actorUserId: userId,
      action: enabled ? "prediction_subscription_enabled" : "prediction_subscription_disabled",
      entityType: "User",
      entityId: userId,
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    }));

    return sendData(res, { enabled: updatedUser.predictionUpdates });
  } catch (error) {
    console.error("Error updating prediction subscription:", error);
    return sendInternal(res, "INTERNAL_ERROR", { message: "Error al actualizar suscripción de predicciones." });
  }
});
