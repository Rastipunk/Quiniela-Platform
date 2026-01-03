import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../lib/password";
import { signToken } from "../lib/jwt";
import { writeAuditEvent } from "../lib/audit";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(50),
  password: z.string().min(8).max(200),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { email, displayName, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "CONFLICT", message: "Email already exists" });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      platformRole: "PLAYER",
      status: "ACTIVE",
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      platformRole: true,
      status: true,
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
      displayName: user.displayName,
      platformRole: user.platformRole,
      status: user.status,
    },
  });
});
