import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";

export const userProfileRouter = Router();

// Comentario en español: todos los endpoints requieren autenticación
userProfileRouter.use(requireAuth);

// Comentario en español: esquema de validación para actualización de perfil
const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric with underscores only")
    .optional(),
  firstName: z.string().min(1).max(50).optional().nullable(),
  lastName: z.string().min(1).max(50).optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable(), // ISO 8601 string
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional().nullable(),
  bio: z.string().max(200).optional().nullable(),
  country: z.string().length(2).optional().nullable(), // ISO 3166-1 alpha-2
  timezone: z.string().optional().nullable(), // IANA timezone
});

// GET /users/me/profile
// Comentario en español: obtiene el perfil completo del usuario actual
userProfileRouter.get("/me/profile", async (req, res) => {
  const userId = req.auth!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      platformRole: true,
      status: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      bio: true,
      country: true,
      timezone: true,
      lastUsernameChangeAt: true,
      createdAtUtc: true,
      updatedAtUtc: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "USER_NOT_FOUND" });
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      platformRole: user.platformRole,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      bio: user.bio,
      country: user.country,
      timezone: user.timezone,
      lastUsernameChangeAt: user.lastUsernameChangeAt,
      createdAtUtc: user.createdAtUtc,
      updatedAtUtc: user.updatedAtUtc,
    },
  });
});

// PATCH /users/me/profile
// Comentario en español: actualiza el perfil del usuario actual
userProfileRouter.patch("/me/profile", async (req, res) => {
  const userId = req.auth!.userId;

  // Validación del payload
  const parseResult = updateProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      details: parseResult.error.issues,
    });
  }

  const data = parseResult.data;

  // Comentario en español: obtener usuario actual para validaciones
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      lastUsernameChangeAt: true,
      dateOfBirth: true,
    },
  });

  if (!currentUser) {
    return res.status(404).json({ error: "USER_NOT_FOUND" });
  }

  // Comentario en español: validación de cambio de username (30 días)
  if (data.username && data.username !== currentUser.username) {
    // Verificar si el username ya existe
    const existingUser = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser) {
      return res.status(400).json({
        error: "USERNAME_TAKEN",
        message: "Este nombre de usuario ya está en uso",
      });
    }

    // Verificar límite de 30 días
    if (currentUser.lastUsernameChangeAt) {
      const daysSinceLastChange =
        (Date.now() - currentUser.lastUsernameChangeAt.getTime()) /
        (1000 * 60 * 60 * 24);

      if (daysSinceLastChange < 30) {
        const daysRemaining = Math.ceil(30 - daysSinceLastChange);
        return res.status(400).json({
          error: "USERNAME_CHANGE_TOO_SOON",
          message: `Puedes cambiar tu nombre de usuario en ${daysRemaining} días`,
          daysRemaining,
        });
      }
    }
  }

  // Comentario en español: validación de edad (mínimo 13 años)
  if (data.dateOfBirth !== undefined && data.dateOfBirth !== null) {
    const birthDate = new Date(data.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    // Ajustar edad si no ha cumplido años este año
    const actualAge =
      monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

    if (actualAge < 13) {
      return res.status(400).json({
        error: "AGE_TOO_YOUNG",
        message: "Debes tener al menos 13 años para usar esta plataforma",
      });
    }

    if (actualAge > 120) {
      return res.status(400).json({
        error: "AGE_INVALID",
        message: "Por favor verifica tu fecha de nacimiento",
      });
    }
  }

  // Comentario en español: construir objeto de actualización
  const updateData: any = {};

  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.country !== undefined) updateData.country = data.country;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.dateOfBirth !== undefined) {
    updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  }

  // Comentario en español: actualizar username y timestamp si cambió
  if (data.username && data.username !== currentUser.username) {
    updateData.username = data.username;
    updateData.lastUsernameChangeAt = new Date();

    // Auditar cambio de username
    await writeAuditEvent({
      actorUserId: userId,
      action: "USERNAME_CHANGED",
      entityType: "User",
      entityId: userId,
      dataJson: {
        oldUsername: currentUser.username,
        newUsername: data.username,
      },
    });
  }

  // Comentario en español: actualizar usuario
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      platformRole: true,
      status: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      bio: true,
      country: true,
      timezone: true,
      lastUsernameChangeAt: true,
      createdAtUtc: true,
      updatedAtUtc: true,
    },
  });

  // Auditar actualización de perfil
  await writeAuditEvent({
    actorUserId: userId,
    action: "PROFILE_UPDATED",
    entityType: "User",
    entityId: userId,
    dataJson: {
      updatedFields: Object.keys(updateData),
    },
  });

  return res.json({
    user: updatedUser,
  });
});
