import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, optionalAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { PAGINATION } from "../lib/constants";
import { sendAdminNotification, escapeHtml } from "../lib/email";
import rateLimit from "express-rate-limit";
import { sendCreated, sendData, sendBadRequest } from "../lib/apiResponse";

export const feedbackRouter = Router();

// Rate limit: 5 feedback submissions per minute per IP
const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "RATE_LIMITED" },
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
feedbackRouter.post("/", feedbackLimiter, optionalAuth, async (req, res) => {
  const parsed = submitFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  const { type, message, imageBase64, wantsContact, contactName, phoneNumber, currentUrl } = parsed.data;

  // Get user info from optionalAuth middleware
  let userId: string | null = req.auth?.userId ?? null;
  let userEmail: string | null = null;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    userEmail = user?.email ?? null;
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

  // Notify the support inbox (fire and forget)
  sendAdminNotification({
    subject: `${escapeHtml(type)}: ${escapeHtml(message.substring(0, 60))}${message.length > 60 ? "..." : ""}`,
    category: "feedback",
    body: `
      <p><strong>Tipo:</strong> ${escapeHtml(type)}</p>
      <p><strong>Mensaje:</strong> ${escapeHtml(message)}</p>
      <p><strong>Usuario:</strong> ${escapeHtml(userEmail || "Anónimo")}</p>
      ${currentUrl ? `<p><strong>URL:</strong> ${escapeHtml(currentUrl)}</p>` : ""}
      ${wantsContact ? `<p><strong>Contacto:</strong> ${escapeHtml(contactName || "—")} / ${escapeHtml(phoneNumber || "—")}</p>` : ""}
      ${imageBase64 ? `<p><em>(Incluye screenshot)</em></p>` : ""}
    `,
  }).catch((err) => console.error("Error sending admin notification:", err));

  return sendCreated(res, {
    ok: true,
    message: "Feedback enviado exitosamente. Gracias por tu ayuda!",
    id: feedback.id,
  });
});

// Query schema used for both admin list endpoints. Zod coerces string
// numbers and clamps ranges so callers can't send `limit=99999` or
// negative pages. `z.coerce.number` converts "1" → 1 implicitly.
const adminListQuerySchema = z.object({
  type: z.enum(["BUG", "SUGGESTION"]).optional(),
  wantsContact: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).optional().default(PAGINATION.DEFAULT_LIMIT),
});

// GET /feedback/admin — list all feedback (admin only)
feedbackRouter.get("/admin", requireAuth, requireAdmin, async (req, res) => {
  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  const { type, wantsContact, page: pageNum, limit: limitNum } = parsed.data;

  const where: any = {};
  if (type) {
    where.type = type;
  }
  if (wantsContact === "true") {
    where.wantsContact = true;
  }
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

  return sendData(res, {
    feedbacks,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});
