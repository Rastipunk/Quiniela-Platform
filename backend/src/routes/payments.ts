/**
 * Payment Routes
 *
 * HTTP layer for pool capacity payments via Polar.sh.
 * Routes: checkout creation, webhook handler, payment status.
 *
 * The webhook uses standardwebhooks for signature verification
 * (same library Polar uses internally).
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Webhook } from "standardwebhooks";
import { requireAuth } from "../middleware/requireAuth";
import { sendOk, sendBadRequest, sendNotFound, sendInternal, sendForbidden } from "../lib/apiResponse";
import { ServiceError } from "../services/authService";
import { isPolarConfigured } from "../services/polar/client";
import {
  initiateCheckout,
  handleOrderPaid,
  handleCheckoutUpdated,
  getPaymentStatus,
} from "../services/paymentService";

// ── JSON routes (require auth) ─────────────────────────────────

export const paymentsRouter = Router();

const checkoutSchema = z.object({
  poolId: z.string().uuid(),
  targetCapacity: z.number().int().min(2).max(10000),
});

// POST /payments/checkout — Create a Polar checkout session
paymentsRouter.post("/checkout", requireAuth, async (req: Request, res: Response) => {
  if (!isPolarConfigured()) {
    return sendInternal(res, "PAYMENTS_NOT_CONFIGURED");
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const result = await initiateCheckout({
      userId: req.auth!.userId,
      poolId: parsed.data.poolId,
      targetCapacity: parsed.data.targetCapacity,
      locale: String(req.headers["accept-language"] ?? "es").slice(0, 2),
    });
    return sendOk(res, result as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof ServiceError) {
      const send = { 400: sendBadRequest, 403: sendForbidden, 404: sendNotFound }[err.statusHint] ?? sendInternal;
      return send(res, err.code, err.extra);
    }
    console.error("[Payments] Checkout error:", err instanceof Error ? err.message : String(err));
    return sendInternal(res, "CHECKOUT_FAILED");
  }
});

// GET /payments/pool/:poolId/status — Get latest payment status for a pool
paymentsRouter.get("/pool/:poolId/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await getPaymentStatus(req.auth!.userId, req.params.poolId as string);
    return sendOk(res, (result ?? { status: "NONE" }) as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof ServiceError) {
      return sendForbidden(res, err.code);
    }
    return sendInternal(res, "STATUS_ERROR");
  }
});

// ── Webhook route (public, signature verified via standardwebhooks) ──

/**
 * Create the webhook handler.
 * Must be mounted BEFORE express.json() since it needs the raw body.
 */
export function createWebhookHandler() {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("[Payments] POLAR_WEBHOOK_SECRET not set — webhook endpoint disabled");
    return (_req: Request, res: Response) => {
      res.status(503).json({ error: "Webhooks not configured" });
    };
  }

  return async (req: Request, res: Response) => {
    try {
      // Verify signature using standardwebhooks
      const body = req.body as Buffer;
      const headers = {
        "webhook-id": req.headers["webhook-id"] as string,
        "webhook-timestamp": req.headers["webhook-timestamp"] as string,
        "webhook-signature": req.headers["webhook-signature"] as string,
      };

      const wh = new Webhook(webhookSecret);
      const payload = wh.verify(body.toString(), headers) as {
        type: string;
        data: Record<string, unknown>;
      };

      // Route to the correct handler based on event type
      if (payload.type === "order.paid") {
        await handleOrderPaid(payload as Parameters<typeof handleOrderPaid>[0]);
      } else if (payload.type === "checkout.updated") {
        await handleCheckoutUpdated(payload as Parameters<typeof handleCheckoutUpdated>[0]);
      } else {
        console.log("[Payments] Unhandled webhook event:", payload.type);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[Payments] Webhook error:", err instanceof Error ? err.message : String(err));
      // Return 200 anyway to prevent Polar from retrying on our errors
      // Only return 401 for signature verification failures
      if (err instanceof Error && err.message.includes("signature")) {
        res.status(401).json({ error: "Invalid signature" });
      } else {
        res.status(200).json({ received: true, error: "Processing failed" });
      }
    }
  };
}
