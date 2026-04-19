import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { logger } from "../lib/logger";

export const resendWebhookRouter = Router();

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!RESEND_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto
    .createHmac("sha256", RESEND_WEBHOOK_SECRET)
    .update(payload)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

resendWebhookRouter.post("/", async (req: Request, res: Response) => {
  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const signature = req.headers["svix-signature"] as string | undefined;

  if (RESEND_WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
    logger.warn("Resend webhook signature verification failed");
    return res.status(401).json({ error: "INVALID_SIGNATURE" });
  }

  try {
    const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const eventType: string = event.type;
    const data = event.data;

    if (eventType === "email.bounced" || eventType === "email.complained") {
      const to: string[] = Array.isArray(data?.to) ? data.to : data?.to ? [data.to] : [];
      const reason = eventType === "email.bounced" ? "bounced" : "complained";

      for (const email of to) {
        const normalized = email.trim().toLowerCase();
        await prisma.emailSuppression.upsert({
          where: { email: normalized },
          create: {
            email: normalized,
            reason,
            resendId: data?.email_id || null,
            eventData: data,
          },
          update: {
            reason,
            resendId: data?.email_id || null,
            eventData: data,
            createdAt: new Date(),
          },
        });
        logger.info("Email suppressed", { email: normalized, reason, eventType });
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error("Resend webhook processing error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ error: "PROCESSING_ERROR" });
  }
});
