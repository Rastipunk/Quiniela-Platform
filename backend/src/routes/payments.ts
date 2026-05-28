/**
 * Payment Routes
 *
 * HTTP layer for pool capacity payments via Polar.sh.
 * Routes: checkout creation, webhook handler, payment status.
 *
 * The webhook uses standardwebhooks for signature verification
 * (same library Polar uses internally).
 */

import express, { Router, Request, Response } from "express";
import { z } from "zod";
import { Webhook } from "standardwebhooks";
import { requireAuth } from "../middleware/requireAuth";
import { sendOk, sendBadRequest, sendNotFound, sendInternal, sendForbidden } from "../lib/apiResponse";
import { ServiceError } from "../services/authService";
import { isPolarConfigured } from "../services/polar/client";

/**
 * Extract Meta Advanced Matching signals from the browser request so
 * async webhook emissions (Polar order.paid, MP IPN) can attach them
 * to the CAPI Purchase event. Cookies set by the Meta Pixel stub:
 *   _fbp — always on once the pixel loads
 *   _fbc — only when the user arrived via an fbclid URL
 * IP and UA are used for server-side match as well.
 */
function extractMetaSignals(req: Request): {
  metaFbp?: string;
  metaFbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
} {
  const fbp = req.cookies?._fbp as string | undefined;
  const fbc = req.cookies?._fbc as string | undefined;
  const ua = req.get("user-agent") ?? undefined;
  // `req.ip` honours `trust proxy` (set in server.ts), so behind
  // Railway's reverse proxy this yields the real client address.
  return {
    metaFbp: typeof fbp === "string" && fbp.length > 0 ? fbp : undefined,
    metaFbc: typeof fbc === "string" && fbc.length > 0 ? fbc : undefined,
    clientIpAddress: req.ip ?? undefined,
    clientUserAgent: ua,
  };
}

import {
  initiateCheckout,
  initiateMpCheckout,
  processMpPayment,
  handleOrderPaid,
  handleOrderRefunded,
  handleCheckoutUpdated,
  handleMpWebhook,
  getPaymentStatus,
  recordUnhandledPolarEvent,
  recordClientEvent,
  type WebhookContext,
} from "../services/paymentService";
import { isMercadoPagoConfigured } from "../services/mercadopago/client";
import { CLIENT_EVENT_TYPES } from "../lib/paymentEvents";

// ── JSON routes (require auth) ─────────────────────────────────

export const paymentsRouter = Router();

const checkoutSchema = z.object({
  poolId: z.string().uuid(),
  targetCapacity: z.number().int().min(2).max(10000),
  // Optional CC redemption — when the customer pre-paid via a cuenta
  // de cobro the wizard / expand-capacity tab attaches its id here.
  // paymentService validates the snapshot against live pricing.ts and
  // atomically locks the CC to REDEEMED inside the same tx that
  // creates the PoolPayment. See SALES_AUDIT.md §9.7.
  accountReceivableId: z.string().uuid().optional(),
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
      accountReceivableId: parsed.data.accountReceivableId,
      locale: String(req.headers["accept-language"] ?? "es").slice(0, 2),
      ...extractMetaSignals(req),
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
      accountReceivableId: parsed.data.accountReceivableId,
      locale: String(req.headers["accept-language"] ?? "es").slice(0, 2),
      ...extractMetaSignals(req),
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
  formData: z.record(z.string(), z.unknown()),
  // Meta cookies forwarded from the browser for CAPI attribution. Both
  // optional — we work fine without them, but having them improves match
  // quality significantly in Meta Events Manager.
  metaCookies: z
    .object({
      fbc: z.string().max(200).optional(),
      fbp: z.string().max(200).optional(),
    })
    .optional(),
});

paymentsRouter.post("/mp-process", requireAuth, async (req: Request, res: Response) => {
  const parsed = mpProcessSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const clientIpAddress =
      (req.headers["cf-connecting-ip"] as string) ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      undefined;
    const clientUserAgent = (req.headers["user-agent"] as string) || undefined;
    const country = ((req.headers["cf-ipcountry"] as string) || "").toUpperCase() || undefined;

    const result = await processMpPayment({
      ...parsed.data,
      clientIpAddress,
      clientUserAgent,
      country,
    });
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

// POST /payments/attempts/:paymentId/event — Client beacon for the
// checkout-attempt lifecycle (redirect started/failed, user cancelled,
// client-side error). See POLAR_AUDIT.md F-13 and lib/paymentEvents.ts
// for the event-type taxonomy.
//
// Authorization: requireAuth + ownership check inside recordClientEvent
// (the service refuses to write events for someone else's payment).
//
// Idempotency: client events are intentionally NOT deduplicated — each
// is a forensic row. If a frontend retries the same beacon (page reload
// during redirect), each becomes its own row. That's the desired
// behavior for "what did the browser actually do?" forensics.
const clientEventSchema = z.object({
  // Match the union we expose to the browser. Keeping it as an enum at
  // the route layer means a malformed value 400s before reaching the
  // service, which is cheaper than the service's runtime check.
  eventType: z.enum(CLIENT_EVENT_TYPES as unknown as [string, ...string[]]),
  // Free-form bag for whatever the browser wants to persist. Cap the
  // size to avoid pathological payloads filling the audit log.
  details: z.record(z.string(), z.unknown()).optional(),
});

// Accept text/plain bodies for this route ALONGSIDE the default JSON
// parser. Required because navigator.sendBeacon (used for the
// USER_CLOSED_TAB beacon on page unload) cannot set
// `Content-Type: application/json` without triggering a CORS preflight
// that gets aborted while the page unloads. With Content-Type set to
// text/plain the request is a simple CORS request, no preflight, and
// the browser flushes it reliably. The handler JSON.parses the raw
// string before the existing Zod schema runs.
// Cap at 8kb — beacons are tiny by design; this prevents a malicious
// caller from filling the audit log with megabyte payloads.
const beaconBodyParser = express.text({ type: "text/plain", limit: "8kb" });

paymentsRouter.post(
  "/attempts/:paymentId/event",
  requireAuth,
  beaconBodyParser,
  async (req: Request, res: Response) => {
    // Validate the path param shape before touching the DB. Express types
    // params as `string | string[]` in some configurations; coerce.
    const rawPaymentId = req.params.paymentId;
    const paymentId = typeof rawPaymentId === "string" ? rawPaymentId : "";
    if (!paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) {
      return sendBadRequest(res, "INVALID_PAYMENT_ID");
    }

    // If the request came via sendBeacon (text/plain) the body is the
    // raw JSON string — parse it once here so the Zod schema below
    // operates on the same shape regardless of transport. JSON-body
    // requests (the existing fetch-based callers) come through with
    // req.body already parsed as an object; they bypass this branch.
    let rawBody: unknown = req.body;
    if (typeof rawBody === "string") {
      try {
        rawBody = JSON.parse(rawBody);
      } catch {
        return sendBadRequest(res, "INVALID_JSON_BODY");
      }
    }

    const parsed = clientEventSchema.safeParse(rawBody);
    if (!parsed.success) {
      return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
    }

    try {
      await recordClientEvent({
        userId: req.auth!.userId,
        poolPaymentId: paymentId,
        eventType: parsed.data.eventType as (typeof CLIENT_EVENT_TYPES)[number],
        details: parsed.data.details,
      });
      // 202 because the side-effect (audit row written) is the whole
      // point of the call; the response carries no useful body.
      return res.status(202).json({ recorded: true });
    } catch (err) {
      if (err instanceof ServiceError) {
        const send =
          {
            400: sendBadRequest,
            403: sendForbidden,
            404: sendNotFound,
          }[err.statusHint] ?? sendInternal;
        return send(res, err.code, err.extra);
      }
      console.error("[Payments] client-event error:", err instanceof Error ? err.message : String(err));
      return sendInternal(res, "CLIENT_EVENT_FAILED");
    }
  },
);

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

// ── Mercado Pago webhook (public, signature verified via HMAC-SHA256) ──

/**
 * Verify the x-signature header from Mercado Pago using HMAC-SHA256.
 *
 * MP sends: x-signature: ts=<timestamp>,v1=<hash>
 * Manifest template: id:<data.id query param>;request-id:<x-request-id>;ts:<ts>;
 * HMAC is computed with the webhook secret from MP dashboard.
 *
 * Returns true if signature is valid. Rejects all requests if no secret is configured.
 */
function verifyMpSignature(req: Request): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[Payments] MP_WEBHOOK_SECRET not set — rejecting webhook");
    return false;
  }

  const xSignature = req.headers["x-signature"] as string | undefined;
  const xRequestId = req.headers["x-request-id"] as string | undefined;
  if (!xSignature) return false;

  // Extract ts and v1 from x-signature header
  let ts: string | undefined;
  let hash: string | undefined;
  for (const part of xSignature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "ts") ts = value?.trim();
    if (key?.trim() === "v1") hash = value?.trim();
  }
  if (!ts || !hash) return false;

  // Drift / replay protection. The HMAC alone is forever-valid: an attacker
  // who captures a legitimate webhook (proxy logs, mirrored TLS, etc.) could
  // re-deliver it indefinitely. Standard practice (Stripe, Polar) is to
  // reject anything outside a small window around the current clock.
  // MP's docs example shows ts in seconds (10 digits); we auto-detect ms vs s
  // for forward-compat in case MP ever switches. anything below 1e12 is
  // seconds because 1e12 ms ≈ year 2001 and 1e12 s ≈ year 33658.
  let tsMs = parseInt(ts, 10);
  if (isNaN(tsMs)) return false;
  if (tsMs < 1e12) tsMs *= 1000;
  const driftMs = Math.abs(Date.now() - tsMs);
  const MAX_DRIFT_MS = parseInt(process.env.MP_WEBHOOK_MAX_DRIFT_MS || "300000", 10); // 5min default
  if (driftMs > MAX_DRIFT_MS) {
    console.warn(`[Payments] MP webhook ts drift ${driftMs}ms > ${MAX_DRIFT_MS}ms — rejecting`);
    return false;
  }

  // data.id comes from query params per MP spec
  const dataId = req.query["data.id"] as string | undefined;

  // Build manifest — omit parts that are missing
  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const crypto = require("crypto") as typeof import("crypto");
  const computed = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  // Timing-safe comparison. A plain `===` leaks information through
  // early-exit: an attacker who can observe response times byte-by-byte
  // can reconstruct the valid HMAC. The practical risk against MP's
  // webhook endpoint is low (network jitter dominates), but the fix is
  // one line and removes the class of bug entirely.
  const computedBuf = Buffer.from(computed, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  if (computedBuf.length !== hashBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, hashBuf);
}

/**
 * Mercado Pago webhook notification handler.
 * For async payment methods (PSE, Nequi) that don't resolve immediately.
 * Verifies x-signature HMAC when MP_WEBHOOK_SECRET is configured.
 */
export function createMpWebhookHandler() {
  return async (req: Request, res: Response) => {
    try {
      if (!verifyMpSignature(req)) {
        console.warn("[Payments] MP webhook signature verification failed");
        return res.status(401).json({ error: "Invalid signature" });
      }

      const { type, data } = req.body;
      if (type === "payment" && data?.id) {
        await handleMpWebhook(String(data.id));
      }
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[Payments] MP webhook error:", err instanceof Error ? err.message : String(err));
      // 5xx so MP retries the delivery with backoff. The handler is idempotent
      // via PaymentEvent.polarEventId UNIQUE, so retries are safe.
      // Returning 200 here was the previous behaviour and silently lost pagos
      // when the DB or downstream MP API was momentarily unavailable.
      res.status(500).json({ error: "Processing failed", retryable: true });
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

      // Capture delivery metadata so every PaymentEvent row we write
      // for this webhook records the Polar delivery it came from (F-19).
      // webhook-timestamp is an ISO string per standardwebhooks spec.
      const webhookTimestampRaw = headers["webhook-timestamp"];
      const parsedTs = webhookTimestampRaw ? new Date(webhookTimestampRaw) : undefined;
      const ctx: WebhookContext = {
        webhookId: headers["webhook-id"] || undefined,
        webhookTimestamp:
          parsedTs && !isNaN(parsedTs.getTime()) ? parsedTs : undefined,
      };
      // Log header metadata so failed deliveries can be correlated with
      // Polar's dashboard log without grepping payloads.
      console.log(
        `[Payments] Polar webhook received: type=${payload.type} webhook-id=${ctx.webhookId ?? "-"} webhook-timestamp=${webhookTimestampRaw ?? "-"}`,
      );

      // Route to the correct handler. EVERY known type writes a
      // PaymentEvent atomically with its state change (handler-internal).
      // Unhandled types fall through to recordUnhandledPolarEvent so we
      // still leave an audit trail — the immutable audit log promise in
      // PaymentEvent's docstring (F-3 + F-18 fix).
      if (payload.type === "order.paid") {
        await handleOrderPaid(payload as Parameters<typeof handleOrderPaid>[0], ctx);
      } else if (payload.type === "order.refunded" || payload.type === "order.canceled") {
        await handleOrderRefunded(payload as Parameters<typeof handleOrderRefunded>[0], ctx);
      } else if (payload.type === "checkout.updated") {
        await handleCheckoutUpdated(payload as Parameters<typeof handleCheckoutUpdated>[0], ctx);
      } else {
        await recordUnhandledPolarEvent(payload, ctx);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[Payments] Webhook error:", err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.message.includes("signature")) {
        // 401 — signature mismatch is a config/security issue, not a transient
        // failure. Polar will not retry these (correct).
        res.status(401).json({ error: "Invalid signature" });
      } else {
        // 500 — transient (DB outage, network, race) errors must surface as
        // 5xx so Polar's exponential backoff retries the delivery. The handler
        // is idempotent at the PaymentEvent.polarEventId UNIQUE constraint, so
        // duplicate retries are safe. Returning 200 here was the previous
        // behaviour and silently lost pagos when the DB was momentarily down.
        res.status(500).json({ error: "Processing failed", retryable: true });
      }
    }
  };
}
