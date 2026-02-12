import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import rateLimit from "express-rate-limit";

export const feedbackRouter = Router();

// Rate limit: 5 feedback submissions per minute per IP
const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "RATE_LIMITED", message: "Demasiados envíos. Intenta en un minuto." },
});

const submitFeedbackSchema = z.object({
  type: z.enum(["BUG", "SUGGESTION"]),
  message: z.string().min(10, "El mensaje debe tener al menos 10 caracteres").max(2000),
  imageBase64: z.string().max(700_000).optional(), // ~500KB image → ~700KB base64
  wantsContact: z.boolean().default(false),
  contactName: z.string().max(100).optional(),
  phoneNumber: z.string().max(20).optional(),
  currentUrl: z.string().max(500).optional(),
});

// POST /feedback — submit feedback (auth optional)
feedbackRouter.post("/", feedbackLimiter, async (req, res) => {
  const parsed = submitFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const { type, message, imageBase64, wantsContact, contactName, phoneNumber, currentUrl } = parsed.data;

  // Try to extract user info from optional auth header
  let userId: string | null = null;
  let userEmail: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { verifyToken } = await import("../lib/jwt");
      const payload = verifyToken(authHeader.slice(7));
      userId = payload.userId;
      // Get email from DB
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true },
      });
      userEmail = user?.email ?? null;
    } catch {
      // Invalid token — proceed as anonymous
    }
  }

  const feedback = await prisma.betaFeedback.create({
    data: {
      type,
      message,
      imageBase64: imageBase64 || null,
      wantsContact,
      contactName: wantsContact ? (contactName || null) : null,
      phoneNumber: wantsContact ? (phoneNumber || null) : null,
      userId,
      userEmail,
      currentUrl: currentUrl || null,
      userAgent: req.get("user-agent") || null,
    },
  });

  return res.status(201).json({
    success: true,
    message: "Feedback enviado exitosamente. Gracias por tu ayuda!",
    id: feedback.id,
  });
});

// GET /feedback/admin — list all feedback (admin only)
feedbackRouter.get("/admin", requireAuth, requireAdmin, async (req, res) => {
  const { type, wantsContact, page = "1", limit = "50" } = req.query;

  const where: any = {};
  if (type === "BUG" || type === "SUGGESTION") {
    where.type = type;
  }
  if (wantsContact === "true") {
    where.wantsContact = true;
  }

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [feedbacks, total] = await Promise.all([
    prisma.betaFeedback.findMany({
      where,
      orderBy: { createdAtUtc: "desc" },
      skip,
      take: limitNum,
      select: {
        id: true,
        type: true,
        message: true,
        imageBase64: true,
        wantsContact: true,
        contactName: true,
        phoneNumber: true,
        userId: true,
        userEmail: true,
        currentUrl: true,
        userAgent: true,
        createdAtUtc: true,
      },
    }),
    prisma.betaFeedback.count({ where }),
  ]);

  return res.json({
    feedbacks,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});
