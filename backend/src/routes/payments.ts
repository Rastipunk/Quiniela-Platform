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
  initiateMpCheckout,
  processMpPayment,
  handleOrderPaid,
  handleCheckoutUpdated,
  handleMpWebhook,
  getPaymentStatus,
} from "../services/paymentService";
import { isMercadoPagoConfigured } from "../services/mercadopago/client";

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

// GET /payments/country — Detect user's country from Cloudflare/Railway headers
paymentsRouter.get("/country", (req: Request, res: Response) => {
  // Try multiple geolocation headers (Cloudflare, Railway, Vercel, etc.)
  const country =
    (req.headers["cf-ipcountry"] as string) ||
    (req.headers["x-vercel-ip-country"] as string) ||
    (req.headers["x-country"] as string) ||
    "US"; // fallback to international
  console.log(`[Payments] Country detection: cf-ipcountry=${req.headers["cf-ipcountry"]}, x-forwarded-for=${req.headers["x-forwarded-for"]}, result=${country}`);
  return sendOk(res, { country } as unknown as Record<string, unknown>);
});

// POST /payments/mp-checkout — Prepare Mercado Pago Payment Brick data (Colombia/COP)
paymentsRouter.post("/mp-checkout", requireAuth, async (req: Request, res: Response) => {
  if (!isMercadoPagoConfigured()) {
    return sendInternal(res, "MP_NOT_CONFIGURED");
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const result = await initiateMpCheckout({
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
    console.error("[Payments] MP checkout error:", err instanceof Error ? err.message : String(err));
    return sendInternal(res, "MP_CHECKOUT_FAILED");
  }
});

// POST /payments/mp-process — Process payment from Payment Brick
// The Brick sends formData in MP's native snake_case format.
// We accept it permissively and validate server-side.
const mpProcessSchema = z.object({
  paymentId: z.string().uuid(),
  formData: z.record(z.unknown()),
});

paymentsRouter.post("/mp-process", requireAuth, async (req: Request, res: Response) => {
  const parsed = mpProcessSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const result = await processMpPayment(parsed.data);
    return sendOk(res, result as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof ServiceError) {
      const send = { 400: sendBadRequest, 403: sendForbidden, 404: sendNotFound, 409: sendBadRequest }[err.statusHint] ?? sendInternal;
      return send(res, err.code, err.extra);
    }
    console.error("[Payments] MP process error:", err instanceof Error ? err.message : String(err));
    return sendInternal(res, "MP_PROCESS_FAILED");
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

// ── Mercado Pago IPN webhook (public, verified via MP API) ──

/**
 * Mercado Pago IPN notification handler.
 * For async payment methods (PSE, Nequi) that don't resolve immediately.
 * Mounted AFTER express.json().
 */
export function createMpWebhookHandler() {
  return async (req: Request, res: Response) => {
    try {
      const { type, data } = req.body;
      if (type === "payment" && data?.id) {
        await handleMpWebhook(String(data.id));
      }
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[Payments] MP webhook error:", err instanceof Error ? err.message : String(err));
      res.status(200).json({ received: true });
    }
  };
}

// ── Polar webhook (public, signature verified via standardwebhooks) ──

/**
 * Polar webhook handler.
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

  // standardwebhooks expects the secret in base64 format
  const encodedSecret = Buffer.from(webhookSecret).toString("base64");
  const wh = new Webhook(encodedSecret);

  return async (req: Request, res: Response) => {
    try {
      const body = (req.body as Buffer).toString();
      const headers = {
        "webhook-id": req.headers["webhook-id"] as string,
        "webhook-timestamp": req.headers["webhook-timestamp"] as string,
        "webhook-signature": req.headers["webhook-signature"] as string,
      };

      const payload = wh.verify(body, headers) as {
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
