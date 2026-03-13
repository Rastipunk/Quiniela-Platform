import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../lib/password";
import { signToken } from "../lib/jwt";
import { writeAuditEvent } from "../lib/audit";
import { validateUsername, normalizeUsername } from "../lib/username";
import { sendPasswordResetEmail, sendWelcomeEmail, sendVerificationEmail, sendPoolFullNotificationEmail } from "../lib/email";
import { requireAuth } from "../middleware/requireAuth";
import { verifyGoogleToken } from "../lib/googleAuth";
import { transitionToActive } from "../services/poolStateMachine";
import { ensurePoolCapacity } from "../lib/poolCapacity";
import { CURRENT_LEGAL_VERSIONS } from "./legal";
import { HOST_NOTIFICATION_ROLES } from "../lib/roles";

export const authRouter = Router();

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
    email: rawEmail,
    username: rawUsername,
    displayName,
    password,
    timezone,
    acceptTerms,
    acceptPrivacy,
    acceptAge,
    acceptMarketing,
  } = parsed.data;
  const email = rawEmail.trim().toLowerCase();

  // Validar consentimiento legal obligatorio
  if (!acceptTerms) {
    return res.status(400).json({
      error: "CONSENT_REQUIRED",
      reason: "TERMS_REQUIRED",
    });
  }

  if (!acceptPrivacy) {
    return res.status(400).json({
      error: "CONSENT_REQUIRED",
      reason: "PRIVACY_REQUIRED",
    });
  }

  if (!acceptAge) {
    return res.status(400).json({
      error: "AGE_VERIFICATION_REQUIRED",
    });
  }

  // Validar username
  const usernameValidation = validateUsername(rawUsername);
  if (!usernameValidation.valid) {
    return res.status(400).json({ error: "VALIDATION_ERROR", reason: usernameValidation.error });
  }

  const username = normalizeUsername(rawUsername);

  // Verificar email único
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return res.status(409).json({ error: "EMAIL_TAKEN" });
  }

  // Verificar username único
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return res.status(409).json({ error: "USERNAME_TAKEN" });
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

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

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

  const email = parsed.data.email.trim().toLowerCase();

  // Buscar usuario
  const user = await prisma.user.findUnique({ where: { email } });

  // Por seguridad, siempre retornamos éxito (no revelamos si el email existe)
  if (!user || user.status !== "ACTIVE") {
    return res.json({ ok: true });
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

  return res.json({ ok: true });
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
    return res.status(400).json({ error: "INVALID_TOKEN" });
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

  return res.json({ ok: true });
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
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }

  // Normalize Google email for consistent matching
  const normalizedGoogleEmail = googleUser.email.trim().toLowerCase();

  // Buscar usuario existente por email o googleId
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedGoogleEmail }, { googleId: googleUser.googleId }],
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
      return res.status(403).json({ error: "ACCOUNT_INACTIVE" });
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
      reason: "TERMS_REQUIRED",
      requiresConsent: true,
    });
  }

  if (!acceptPrivacy) {
    return res.status(400).json({
      error: "CONSENT_REQUIRED",
      reason: "PRIVACY_REQUIRED",
      requiresConsent: true,
    });
  }

  if (!acceptAge) {
    return res.status(400).json({
      error: "AGE_VERIFICATION_REQUIRED",
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
      email: normalizedGoogleEmail,
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
    return res.status(400).json({ error: "VALIDATION_ERROR", reason: "TOKEN_REQUIRED" });
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
    });
  }

  // Ya está verificado
  if (user.emailVerified) {
    return res.json({
      alreadyVerified: true,
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
    verified: true,
  });
});

// ========== CORPORATE ACTIVATION ==========

// GET /auth/check-corporate-invite — Verify token and check if user already exists
authRouter.get("/check-corporate-invite", async (req, res) => {
  const { token: activationToken } = req.query;

  if (!activationToken || typeof activationToken !== "string") {
    return res.status(400).json({ error: "MISSING_TOKEN" });
  }

  const invite = await prisma.corporateInvite.findUnique({
    where: { activationToken },
    include: {
      pool: {
        select: {
          id: true,
          name: true,
          organization: { select: { name: true } },
        },
      },
    },
  });

  if (!invite) {
    return res.status(400).json({ error: "INVALID_TOKEN" });
  }

  if (invite.activationTokenExpiresAt < new Date()) {
    return res.status(400).json({ error: "TOKEN_EXPIRED" });
  }

  if (invite.status === "ACTIVATED") {
    return res.status(409).json({ error: "ALREADY_ACTIVATED" });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  });

  return res.json({
    email: invite.email,
    alreadyExists: !!existingUser,
    poolName: invite.pool.name,
    companyName: invite.pool.organization?.name ?? null,
  });
});

const activateCorporateSchema = z.object({
  activationToken: z.string().min(1),
  displayName: z.string().min(2).max(50).optional(),
  username: z.string().min(3).max(20).optional(),
  password: z.string().min(8).max(200).optional(),
  acceptTerms: z.boolean().optional(),
  acceptPrivacy: z.boolean().optional(),
  acceptAge: z.boolean().optional(),
});

// POST /auth/activate-corporate — Activar cuenta de empleado invitado a pool corporativa
authRouter.post("/activate-corporate", async (req, res) => {
  const parsed = activateCorporateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const {
    activationToken,
    displayName,
    username: rawUsername,
    password,
    acceptTerms,
    acceptPrivacy,
    acceptAge,
  } = parsed.data;

  // Buscar invite por token
  const invite = await prisma.corporateInvite.findUnique({
    where: { activationToken },
    include: { pool: { select: { id: true, name: true, maxParticipants: true, organization: { select: { name: true } } } } },
  });

  if (!invite) {
    return res.status(400).json({ error: "INVALID_TOKEN" });
  }

  if (invite.activationTokenExpiresAt < new Date()) {
    return res.status(400).json({ error: "TOKEN_EXPIRED" });
  }

  if (invite.status === "ACTIVATED") {
    return res.status(409).json({ error: "ALREADY_ACTIVATED" });
  }

  // Verificar si ya existe un usuario con ese email
  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existingUser) {
    // Edge case: el usuario se registró por otra vía entre la invitación y la activación.
    // Lo agregamos al pool directamente y marcamos como activado.
    await prisma.$transaction(async (tx) => {
      // Atomically claim the invite — prevents double-activation race condition.
      // If another concurrent request already activated, updateMany returns count=0.
      const claimed = await tx.corporateInvite.updateMany({
        where: { id: invite.id, status: "PENDING" },
        data: { status: "ACTIVATED", activatedUserId: existingUser.id, activatedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new Error("ALREADY_ACTIVATED");
      }

      const existingMember = await tx.poolMember.findUnique({
        where: { poolId_userId: { poolId: invite.poolId, userId: existingUser.id } },
      });

      if (!existingMember) {
        // Lock Pool row + verify capacity (prevents race condition)
        await ensurePoolCapacity(tx, invite.poolId, invite.pool.maxParticipants);
        await tx.poolMember.create({
          data: { poolId: invite.poolId, userId: existingUser.id, role: "PLAYER", status: "ACTIVE" },
        });
      }
    }).catch((err) => {
      if (err.message === "ALREADY_ACTIVATED") {
        return res.status(409).json({ error: "ALREADY_ACTIVATED" });
      }
      if (err.message === "POOL_FULL") {
        return res.status(409).json({ error: "POOL_FULL" });
      }
      throw err;
    });

    if (res.headersSent) return;

    // Transicionar pool DRAFT→ACTIVE si es el primer PLAYER
    await transitionToActive(invite.poolId, existingUser.id).catch((err) =>
      console.error("transitionToActive error (existing user):", err)
    );

    // Notificar al host si el pool acaba de llenarse
    if (invite.pool.maxParticipants) {
      const curCount = await prisma.poolMember.count({ where: { poolId: invite.poolId, status: "ACTIVE" } });
      if (curCount >= invite.pool.maxParticipants) {
        const host = await prisma.poolMember.findFirst({
          where: { poolId: invite.poolId, role: { in: [...HOST_NOTIFICATION_ROLES] } },
          include: { user: { select: { email: true, displayName: true } } },
        });
        if (host?.user?.email) {
          sendPoolFullNotificationEmail({
            to: host.user.email,
            hostName: host.user.displayName || "Host",
            poolName: invite.pool.name,
            poolId: invite.poolId,
            maxParticipants: invite.pool.maxParticipants,
          }).catch(() => {});
        }
      }
    }

    const token = signToken({ userId: existingUser.id, platformRole: existingUser.platformRole });
    return res.json({
      token,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        username: existingUser.username,
        displayName: existingUser.displayName,
        platformRole: existingUser.platformRole,
        status: existingUser.status,
      },
      poolId: invite.poolId,
      poolName: invite.pool.name,
      companyName: invite.pool.organization?.name ?? null,
      alreadyExisted: true,
    });
  }

  // Nuevo usuario: campos de registro son obligatorios
  if (!displayName || !rawUsername || !password) {
    return res.status(400).json({ error: "VALIDATION_ERROR", reason: "MISSING_REQUIRED_FIELDS" });
  }
  if (!acceptTerms || !acceptPrivacy || !acceptAge) {
    return res.status(400).json({ error: "CONSENT_REQUIRED" });
  }

  // Validar username
  const usernameValidation = validateUsername(rawUsername);
  if (!usernameValidation.valid) {
    return res.status(400).json({ error: "VALIDATION_ERROR", reason: usernameValidation.error });
  }

  const username = normalizeUsername(rawUsername);

  // Verificar username único
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return res.status(409).json({ error: "USERNAME_TAKEN" });
  }

  // Crear usuario y asignar al pool en transacción
  const passwordHash = await hashPassword(password);
  const now = new Date();

  let result;
  try {
  result = await prisma.$transaction(async (tx) => {
    // Atomically claim the invite — prevents double-activation race condition
    const claimed = await tx.corporateInvite.updateMany({
      where: { id: invite.id, status: "PENDING" },
      data: { status: "ACTIVATED", activatedAt: now },
    });
    if (claimed.count === 0) {
      throw new Error("ALREADY_ACTIVATED");
    }

    const newUser = await tx.user.create({
      data: {
        email: invite.email,
        username,
        displayName,
        passwordHash,
        platformRole: "PLAYER",
        status: "ACTIVE",
        emailVerified: true, // Corporate: email pre-verificado
        acceptedTermsAt: now,
        acceptedTermsVersion: CURRENT_LEGAL_VERSIONS.TERMS_OF_SERVICE,
        acceptedPrivacyAt: now,
        acceptedPrivacyVersion: CURRENT_LEGAL_VERSIONS.PRIVACY_POLICY,
        ageVerifiedAt: now,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        platformRole: true,
        status: true,
      },
    });

    // Lock Pool row + verify capacity (prevents race condition)
    await ensurePoolCapacity(tx, invite.poolId, invite.pool.maxParticipants);
    await tx.poolMember.create({
      data: {
        poolId: invite.poolId,
        userId: newUser.id,
        role: "PLAYER",
        status: "ACTIVE",
      },
    });

    // Set the activated user on the invite
    await tx.corporateInvite.update({
      where: { id: invite.id },
      data: { activatedUserId: newUser.id },
    });

    return newUser;
  });
  } catch (err: any) {
    if (err.message === "ALREADY_ACTIVATED") {
      return res.status(409).json({ error: "ALREADY_ACTIVATED" });
    }
    if (err.message === "POOL_FULL") {
      return res.status(409).json({ error: "POOL_FULL" });
    }
    throw err;
  }

  // Transicionar pool DRAFT→ACTIVE si es el primer PLAYER
  await transitionToActive(invite.poolId, result.id).catch((err) =>
    console.error("transitionToActive error (new user):", err)
  );

  // Notificar al host si el pool acaba de llenarse
  if (invite.pool.maxParticipants) {
    const curCount = await prisma.poolMember.count({ where: { poolId: invite.poolId, status: "ACTIVE" } });
    if (curCount >= invite.pool.maxParticipants) {
      const host = await prisma.poolMember.findFirst({
        where: { poolId: invite.poolId, role: { in: [...HOST_NOTIFICATION_ROLES] } },
        include: { user: { select: { email: true, displayName: true } } },
      });
      if (host?.user?.email) {
        sendPoolFullNotificationEmail({
          to: host.user.email,
          hostName: host.user.displayName || "Host",
          poolName: invite.pool.name,
          poolId: invite.poolId,
          maxParticipants: invite.pool.maxParticipants,
        }).catch(() => {});
      }
    }
  }

  await writeAuditEvent({
    actorUserId: result.id,
    action: "CORPORATE_ACCOUNT_ACTIVATED",
    entityType: "User",
    entityId: result.id,
    dataJson: { poolId: invite.poolId, email: invite.email },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  // Enviar welcome email (fire and forget)
  sendWelcomeEmail({
    to: result.email,
    userId: result.id,
    displayName: result.displayName,
  }).catch((err) => console.error("Error sending welcome email:", err));

  const jwtToken = signToken({ userId: result.id, platformRole: result.platformRole });

  return res.status(201).json({
    token: jwtToken,
    user: result,
    poolId: invite.poolId,
    poolName: invite.pool.name,
    companyName: invite.pool.organization?.name ?? null,
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
    return res.status(404).json({ error: "USER_NOT_FOUND" });
  }

  if (user.emailVerified) {
    return res.status(400).json({
      error: "ALREADY_VERIFIED",
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

  return res.json({ ok: true });
});
