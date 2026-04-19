import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { verifyUnsubscribeToken } from "../lib/unsubscribe";
import { sendOk, sendBadRequest, sendNotFound } from "../lib/apiResponse";

export const unsubscribeRouter = Router();

/**
 * GET /unsubscribe?token=xxx
 * Disables all email notifications for the user identified by the token.
 * Redirects to frontend confirmation page.
 */
unsubscribeRouter.get("/", async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined;
  if (!token) return sendBadRequest(res, "MISSING_TOKEN");

  const userId = verifyUnsubscribeToken(token);
  if (!userId) return sendBadRequest(res, "INVALID_TOKEN");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return sendNotFound(res, "USER_NOT_FOUND");

  await prisma.user.update({
    where: { id: userId },
    data: { emailNotificationsEnabled: false },
  });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  res.redirect(`${frontendUrl}/unsubscribed`);
});

/**
 * POST /unsubscribe
 * One-click unsubscribe (RFC 8058 / List-Unsubscribe-Post).
 * Email clients send POST with body "List-Unsubscribe=One-Click".
 */
unsubscribeRouter.post("/", async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined;
  if (!token) return sendBadRequest(res, "MISSING_TOKEN");

  const userId = verifyUnsubscribeToken(token);
  if (!userId) return sendBadRequest(res, "INVALID_TOKEN");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return sendNotFound(res, "USER_NOT_FOUND");

  await prisma.user.update({
    where: { id: userId },
    data: { emailNotificationsEnabled: false },
  });

  return sendOk(res, { unsubscribed: true } as unknown as Record<string, unknown>);
});
