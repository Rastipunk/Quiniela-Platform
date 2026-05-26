import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { sendData, sendOk, sendBadRequest, sendNotFound } from "../lib/apiResponse";
import { USER_RULES, SUPPORTED_LOCALES, type SupportedLocale } from "../lib/constants";
import { sendVerificationEmail, sendWelcomeEmail } from "../lib/email";
import { fireAndForget } from "../lib/asyncHelpers";

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
      emailVerified: true,
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
      googleId: true, // Para saber si es cuenta Google
      locale: true,
      requestedLocale: true,
      localePromptCompletedAt: true,
    },
  });

  if (!user) {
    return sendNotFound(res, "USER_NOT_FOUND");
  }

  return sendData(res, {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
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
      isGoogleAccount: !!user.googleId,
      locale: user.locale,
      requestedLocale: user.requestedLocale,
      // Frontend gate for the first-login modal. True until the user
      // confirms their language preference via POST /me/locale-preference.
      needsLocalePrompt: user.localePromptCompletedAt === null,
    },
  });
});

// =========================================================================
// LOCALE PREFERENCE (first-login modal)
// =========================================================================
// `locale` is required (we won't accept null — the modal forces a choice).
// `country` is optional. `requestedLocale` is an unsupported ISO 639-1 code
// the user speaks; saved for product analytics, never used for render.

const localePreferenceSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  country: z.string().length(2).regex(/^[A-Za-z]{2}$/).optional().nullable(),
  // ISO 639-1 (2 chars) or 639-3 (3 chars). 8 chars max in DB to leave
  // room for hyphenated regional codes ("pt-BR", "zh-CN") in the future
  // without another migration. We accept letters + hyphen.
  requestedLocale: z.string().regex(/^[a-zA-Z-]{2,8}$/).optional().nullable(),
});

userProfileRouter.post("/me/locale-preference", async (req, res) => {
  const userId = req.auth!.userId;
  const parsed = localePreferenceSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.issues });
  }

  const data = parsed.data;
  const now = new Date();

  // Snapshot pre-update for the verification-email side-effect: only
  // send the verification mail when the user hadn't completed the prompt
  // before AND their email isn't yet verified AND they have a pending
  // token. This delivers the welcome/verification mail in the locale
  // they just chose, instead of the platform default that fired at
  // signup-time.
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      displayName: true,
      emailVerified: true,
      emailVerificationToken: true,
      localePromptCompletedAt: true,
      welcomeEmailSentAt: true,
    },
  });
  if (!before) return sendNotFound(res, "USER_NOT_FOUND");

  await prisma.user.update({
    where: { id: userId },
    data: {
      locale: data.locale,
      country: data.country ? data.country.toUpperCase() : undefined,
      requestedLocale: data.requestedLocale ? data.requestedLocale.toLowerCase() : undefined,
      localePromptCompletedAt: now,
      // Set inside the same update so the fallback job (which only
      // looks at welcomeEmailSentAt IS NULL) never duplicates the
      // welcome below. If the actual sendWelcomeEmail fails, we accept
      // the welcome is lost — the user has completed the modal and
      // seen the dashboard, so support recovery is cheaper than a
      // retry-with-counter mechanism. See EMAIL_LOCALE_HANDOFF_AUDIT.md §6.
      welcomeEmailSentAt:
        before.welcomeEmailSentAt === null ? now : undefined,
    },
  });

  fireAndForget("audit:locale-preference", writeAuditEvent({
    actorUserId: userId,
    action: "LOCALE_PREFERENCE_SET",
    entityType: "User",
    entityId: userId,
    dataJson: {
      locale: data.locale,
      country: data.country ?? null,
      requestedLocale: data.requestedLocale ?? null,
      firstTime: before.localePromptCompletedAt === null,
    },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  }));

  // Deferred verification email: fires here, in the locale the user
  // just chose, so the first mail they receive isn't in the platform
  // default. Only when this was a first-time completion AND the email
  // is still pending verification AND a token already exists.
  if (
    before.localePromptCompletedAt === null &&
    !before.emailVerified &&
    before.emailVerificationToken
  ) {
    fireAndForget("locale-prompt: deferred verification email", sendVerificationEmail({
      to: before.email,
      displayName: before.displayName,
      verificationToken: before.emailVerificationToken,
      locale: data.locale,
    }));
  }

  // Deferred welcome email — the single trigger point for the happy
  // path. Fires only when the user has not yet been welcomed
  // (welcomeEmailSentAt was NULL pre-update). Ships in the locale
  // the user just picked. The 24h fallback job covers users who
  // never reach this endpoint. See EMAIL_LOCALE_HANDOFF_AUDIT.md §3.1.
  if (before.welcomeEmailSentAt === null) {
    fireAndForget("locale-prompt: deferred welcome email", sendWelcomeEmail({
      to: before.email,
      userId,
      displayName: before.displayName,
      locale: data.locale,
    }));
  }

  return sendOk(res, { locale: data.locale });
});

// =========================================================================
// COUNTRY DETECTION (helper for the locale-preference modal)
// =========================================================================
// The modal pre-fills the country dropdown from this signal so the user
// only confirms instead of scrolling through 200+ options. Best-effort:
// returns null if Cloudflare didn't tag the request, never blocks.

userProfileRouter.get("/me/detect-country", (req, res) => {
  const raw = req.headers["cf-ipcountry"];
  const country = typeof raw === "string" && /^[A-Z]{2}$/.test(raw) ? raw : null;
  return sendData(res, { country });
});

// PATCH /users/me/profile
// Comentario en español: actualiza el perfil del usuario actual
userProfileRouter.patch("/me/profile", async (req, res) => {
  const userId = req.auth!.userId;

  // Validación del payload
  const parseResult = updateProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parseResult.error.issues });
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
    return sendNotFound(res, "USER_NOT_FOUND");
  }

  // Comentario en español: validación de cambio de username (30 días)
  if (data.username && data.username !== currentUser.username) {
    // Verificar si el username ya existe
    const existingUser = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser) {
      return sendBadRequest(res, "USERNAME_TAKEN");
    }

    // Verificar límite de 30 días
    if (currentUser.lastUsernameChangeAt) {
      const daysSinceLastChange =
        (Date.now() - currentUser.lastUsernameChangeAt.getTime()) /
        (1000 * 60 * 60 * 24);

      if (daysSinceLastChange < USER_RULES.USERNAME_CHANGE_COOLDOWN_DAYS) {
        const daysRemaining = Math.ceil(USER_RULES.USERNAME_CHANGE_COOLDOWN_DAYS - daysSinceLastChange);
        return sendBadRequest(res, "USERNAME_CHANGE_TOO_SOON", { daysRemaining });
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

    if (actualAge < USER_RULES.MIN_AGE) {
      return sendBadRequest(res, "AGE_TOO_YOUNG");
    }

    if (actualAge > USER_RULES.MAX_AGE) {
      return sendBadRequest(res, "AGE_INVALID", { message: "Por favor verifica tu fecha de nacimiento" });
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

  return sendOk(res, { user: updatedUser });
});
