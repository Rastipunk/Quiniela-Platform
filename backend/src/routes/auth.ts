import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../lib/password";
import { signToken } from "../lib/jwt";
import { writeAuditEvent } from "../lib/audit";
import { validateUsername, normalizeUsername } from "../lib/username";
import { sendPasswordResetEmail } from "../lib/email";
import { verifyGoogleToken } from "../lib/googleAuth";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  displayName: z.string().min(2).max(50),
  password: z.string().min(8).max(200),
  timezone: z.string().optional(), // IANA timezone auto-detectado del navegador
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { email, username: rawUsername, displayName, password, timezone } = parsed.data;

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

  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName,
      passwordHash,
      platformRole: "PLAYER",
      status: "ACTIVE",
      timezone: timezone || null, // Auto-detect del navegador o null
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

  const token = signToken({ userId: user.id, platformRole: user.platformRole });

  return res.status(201).json({ token, user });
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
});

authRouter.post("/google", async (req, res) => {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { idToken, timezone } = parsed.data;

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
  // Auto-generar username desde email
  const emailLocalPart = googleUser.email.split("@")[0];
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
