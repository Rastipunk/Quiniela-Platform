import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../lib/password";
import { signToken } from "../lib/jwt";
import { writeAuditEvent } from "../lib/audit";
import { validateUsername, normalizeUsername } from "../lib/username";
import { sendPasswordResetEmail, sendWelcomeEmail, sendVerificationEmail } from "../lib/email";
import { requireAuth } from "../middleware/requireAuth";
import { verifyGoogleToken } from "../lib/googleAuth";

export const authRouter = Router();

// Versiones actuales de documentos legales (importadas desde legal.ts)
const CURRENT_LEGAL_VERSIONS = {
  TERMS_OF_SERVICE: "2026-01-25",
  PRIVACY_POLICY: "2026-01-25",
} as const;

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  displayName: z.string().min(2).max(50),
  password: z.string().min(8).max(200),
  timezone: z.string().optional(), // IANA timezone auto-detectado del navegador
  // Legal consent fields (requeridos para registro)
  acceptTerms: z.boolean(),
  acceptPrivacy: z.boolean(),
  acceptAge: z.boolean(), // Confirma tener 13+ años
  acceptMarketing: z.boolean().optional().default(false),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const {
    email,
    username: rawUsername,
    displayName,
    password,
    timezone,
    acceptTerms,
    acceptPrivacy,
    acceptAge,
    acceptMarketing,
  } = parsed.data;

  // Validar consentimiento legal obligatorio
  if (!acceptTerms) {
    return res.status(400).json({
      error: "CONSENT_REQUIRED",
      message: "Debes aceptar los Términos de Servicio para crear una cuenta.",
    });
  }

  if (!acceptPrivacy) {
    return res.status(400).json({
      error: "CONSENT_REQUIRED",
      message: "Debes aceptar la Política de Privacidad para crear una cuenta.",
    });
  }

  if (!acceptAge) {
    return res.status(400).json({
      error: "AGE_VERIFICATION_REQUIRED",
      message: "Debes confirmar que tienes al menos 13 años de edad.",
    });
  }

  // Validar username
  const usernameValidation = validateUsername(rawUsername);
  if (!usernameValidation.valid) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: usernameValidation.error });
  }

  const username = normalizeUsername(rawUsername);

  // Verificar email único
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return res.status(409).json({ error: "CONFLICT", message: "Email already exists" });
  }

  // Verificar username único
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return res.status(409).json({ error: "CONFLICT", message: "Username already exists" });
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  // Generar token de verificación de email
  const emailVerificationToken = crypto.randomBytes(32).toString("hex");
  const emailVerificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName,
      passwordHash,
      platformRole: "PLAYER",
      status: "ACTIVE",
      timezone: timezone || null, // Auto-detect del navegador o null
      // Email verification
      emailVerified: false,
      emailVerificationToken,
      emailVerificationTokenExpiresAt,
      // Legal consent tracking
      acceptedTermsAt: now,
      acceptedTermsVersion: CURRENT_LEGAL_VERSIONS.TERMS_OF_SERVICE,
      acceptedPrivacyAt: now,
      acceptedPrivacyVersion: CURRENT_LEGAL_VERSIONS.PRIVACY_POLICY,
      ageVerifiedAt: now,
      marketingConsent: acceptMarketing || false,
      marketingConsentAt: acceptMarketing ? now : null,
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      platformRole: true,
      status: true,
      timezone: true,
      createdAtUtc: true,
    },
  });

  await writeAuditEvent({
    actorUserId: user.id,
    action: "USER_REGISTERED",
    entityType: "User",
    entityId: user.id,
    dataJson: { email: user.email },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  // Enviar email de verificación (async, no bloquea la respuesta)
  // El welcome email se enviará cuando el usuario verifique su email
  sendVerificationEmail({
    to: user.email,
    displayName: user.displayName,
    verificationToken: emailVerificationToken,
  }).catch((err) => {
    console.error("Error sending verification email:", err);
  });

  const token = signToken({ userId: user.id, platformRole: user.platformRole });

  return res.status(201).json({
    token,
    user,
    emailVerificationSent: true,
    message: "Te hemos enviado un email de verificación. Por favor revisa tu bandeja de entrada."
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }

  await writeAuditEvent({
    actorUserId: user.id,
    action: "USER_LOGGED_IN",
    entityType: "User",
    entityId: user.id,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  const token = signToken({ userId: user.id, platformRole: user.platformRole });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      platformRole: user.platformRole,
      status: user.status,
    },
  });
});

// ========== FORGOT PASSWORD ==========

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { email } = parsed.data;

  // Buscar usuario
  const user = await prisma.user.findUnique({ where: { email } });

  // Por seguridad, siempre retornamos éxito (no revelamos si el email existe)
  if (!user || user.status !== "ACTIVE") {
    return res.json({ message: "Si el email existe, recibirás un enlace para restablecer tu contraseña" });
  }

  // Verificar si es cuenta de Google sin contraseña local
  // Una cuenta es "solo Google" si tiene googleId Y no tiene passwordHash válido
  const isGoogleOnlyAccount = user.googleId && (!user.passwordHash || user.passwordHash === "");

  if (isGoogleOnlyAccount) {
    // Retornar error específico para que el frontend muestre mensaje apropiado
    // Esto revela que el email existe, pero es necesario para buena UX
    // y las cuentas de Google ya son "públicas" por naturaleza
    return res.status(400).json({
      error: "GOOGLE_ACCOUNT",
      message: "Esta cuenta utiliza Google para iniciar sesión. Por favor, usa el botón 'Iniciar con Google' en la página de login.",
    });
  }

  // Generar token de reset
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  // Guardar token en DB
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiresAt,
    },
  });

  // Enviar email
  const emailResult = await sendPasswordResetEmail({
    to: user.email,
    username: user.username,
    resetToken,
  });

  if (!emailResult.success) {
    console.error("Error sending reset email:", emailResult.error);
    // No revelamos el error al usuario por seguridad
  }

  await writeAuditEvent({
    actorUserId: user.id,
    action: "PASSWORD_RESET_REQUESTED",
    entityType: "User",
    entityId: user.id,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({ message: "Si el email existe, recibirás un enlace para restablecer tu contraseña" });
});

// ========== RESET PASSWORD ==========

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { token, newPassword } = parsed.data;

  // Buscar usuario por token válido
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiresAt: { gte: new Date() },
      status: "ACTIVE",
    },
  });

  if (!user) {
    return res.status(400).json({ error: "INVALID_TOKEN", message: "Token inválido o expirado" });
  }

  // Hash nueva password
  const passwordHash = await hashPassword(newPassword);

  // Actualizar password y limpiar token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  });

  await writeAuditEvent({
    actorUserId: user.id,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "User",
    entityId: user.id,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({ message: "Contraseña actualizada exitosamente" });
});

// ========== GOOGLE OAUTH ==========

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
  timezone: z.string().optional(), // IANA timezone auto-detectado del navegador
  // Legal consent fields (requeridos para nuevos usuarios)
  acceptTerms: z.boolean().optional(),
  acceptPrivacy: z.boolean().optional(),
  acceptAge: z.boolean().optional(),
  acceptMarketing: z.boolean().optional().default(false),
});

authRouter.post("/google", async (req, res) => {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { idToken, timezone, acceptTerms, acceptPrivacy, acceptAge, acceptMarketing } = parsed.data;

  // Verificar token con Google
  const googleUser = await verifyGoogleToken(idToken);

  if (!googleUser) {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "Token de Google inválido" });
  }

  // Buscar usuario existente por email o googleId
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ email: googleUser.email }, { googleId: googleUser.googleId }],
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      platformRole: true,
      status: true,
      googleId: true,
    },
  });

  // Si el usuario existe
  if (user) {
    // Verificar que esté activo
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "FORBIDDEN", message: "User account is not active" });
    }

    // Si existe por email pero no tiene googleId, vincular cuenta
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.googleId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          platformRole: true,
          status: true,
          googleId: true,
        },
      });

      await writeAuditEvent({
        actorUserId: user.id,
        action: "GOOGLE_ACCOUNT_LINKED",
        entityType: "User",
        entityId: user.id,
        ip: req.ip,
        userAgent: req.get("user-agent") ?? null,
      });
    }

    // Login exitoso
    await writeAuditEvent({
      actorUserId: user.id,
      action: "LOGIN_GOOGLE",
      entityType: "User",
      entityId: user.id,
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });

    const token = signToken({ userId: user.id, platformRole: user.platformRole });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        platformRole: user.platformRole,
        status: user.status,
      },
    });
  }

  // Usuario nuevo: crear cuenta
  // Validar consentimiento legal obligatorio para nuevos usuarios
  if (!acceptTerms) {
    return res.status(400).json({
      error: "CONSENT_REQUIRED",
      message: "Debes aceptar los Términos de Servicio para crear una cuenta.",
      requiresConsent: true,
    });
  }

  if (!acceptPrivacy) {
    return res.status(400).json({
      error: "CONSENT_REQUIRED",
      message: "Debes aceptar la Política de Privacidad para crear una cuenta.",
      requiresConsent: true,
    });
  }

  if (!acceptAge) {
    return res.status(400).json({
      error: "AGE_VERIFICATION_REQUIRED",
      message: "Debes confirmar que tienes al menos 13 años de edad.",
      requiresConsent: true,
    });
  }

  // Auto-generar username desde email
  const emailLocalPart = googleUser.email.split("@")[0] ?? "user";
  let baseUsername = emailLocalPart.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();

  // Asegurar longitud válida
  if (baseUsername.length < 3) {
    baseUsername = `user_${baseUsername}`;
  }
  if (baseUsername.length > 20) {
    baseUsername = baseUsername.substring(0, 20);
  }

  // Verificar unicidad y agregar número si es necesario
  let username = baseUsername;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${baseUsername}${suffix}`;
    if (username.length > 20) {
      // Si se pasa de 20, acortar base
      const maxBaseLength = 20 - String(suffix).length;
      username = `${baseUsername.substring(0, maxBaseLength)}${suffix}`;
    }
    suffix++;
  }

  // Crear nuevo usuario
  // Google ya verifica el email, así que lo marcamos como verificado automáticamente
  const registrationTime = new Date();
  const newUser = await prisma.user.create({
    data: {
      email: googleUser.email,
      username,
      displayName: googleUser.name || username,
      passwordHash: "", // OAuth users no tienen password
      googleId: googleUser.googleId,
      platformRole: "PLAYER",
      status: "ACTIVE",
      timezone: timezone || null, // Auto-detect del navegador o null
      emailVerified: true, // Google ya verificó el email
      // Legal consent tracking
      acceptedTermsAt: registrationTime,
      acceptedTermsVersion: CURRENT_LEGAL_VERSIONS.TERMS_OF_SERVICE,
      acceptedPrivacyAt: registrationTime,
      acceptedPrivacyVersion: CURRENT_LEGAL_VERSIONS.PRIVACY_POLICY,
      ageVerifiedAt: registrationTime,
      marketingConsent: acceptMarketing || false,
      marketingConsentAt: acceptMarketing ? registrationTime : null,
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      platformRole: true,
      status: true,
      googleId: true,
    },
  });

  await writeAuditEvent({
    actorUserId: newUser.id,
    action: "REGISTER_GOOGLE",
    entityType: "User",
    entityId: newUser.id,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  // Enviar email de bienvenida (async, no bloquea la respuesta)
  sendWelcomeEmail({
    to: newUser.email,
    userId: newUser.id,
    displayName: newUser.displayName,
  }).catch((err) => {
    console.error("Error sending welcome email:", err);
  });

  const token = signToken({ userId: newUser.id, platformRole: newUser.platformRole });

  return res.json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      displayName: newUser.displayName,
      platformRole: newUser.platformRole,
      status: newUser.status,
    },
  });
});

// ========== EMAIL VERIFICATION ==========

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

// GET /auth/verify-email?token=xxx
// Verifica el email del usuario usando el token
authRouter.get("/verify-email", async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Token requerido" });
  }

  const { token } = parsed.data;

  // Buscar usuario por token válido
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationTokenExpiresAt: { gte: new Date() },
    },
  });

  if (!user) {
    return res.status(400).json({
      error: "INVALID_TOKEN",
      message: "El enlace de verificación es inválido o ha expirado. Solicita un nuevo enlace desde tu perfil."
    });
  }

  // Ya está verificado
  if (user.emailVerified) {
    return res.json({
      message: "Tu email ya estaba verificado.",
      alreadyVerified: true
    });
  }

  // Marcar como verificado
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  await writeAuditEvent({
    actorUserId: user.id,
    action: "EMAIL_VERIFIED",
    entityType: "User",
    entityId: user.id,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({
    message: "¡Email verificado exitosamente! Ya puedes disfrutar de todas las funciones.",
    verified: true
  });
});

// POST /auth/resend-verification
// Reenvía el email de verificación (requiere autenticación)
authRouter.post("/resend-verification", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      emailVerified: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "USER_NOT_FOUND", message: "Usuario no encontrado" });
  }

  if (user.emailVerified) {
    return res.status(400).json({
      error: "ALREADY_VERIFIED",
      message: "Tu email ya está verificado."
    });
  }

  // Generar nuevo token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  // Guardar token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiresAt: verificationTokenExpiresAt,
    },
  });

  // Enviar email
  const emailResult = await sendVerificationEmail({
    to: user.email,
    displayName: user.displayName,
    verificationToken,
  });

  if (!emailResult.success) {
    console.error("Error sending verification email:", emailResult.error);
    return res.status(500).json({
      error: "EMAIL_SEND_FAILED",
      message: "No se pudo enviar el email de verificación. Intenta de nuevo más tarde."
    });
  }

  await writeAuditEvent({
    actorUserId: user.id,
    action: "VERIFICATION_EMAIL_RESENT",
    entityType: "User",
    entityId: user.id,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json({
    message: "Email de verificación enviado. Revisa tu bandeja de entrada (y spam)."
  });
});
