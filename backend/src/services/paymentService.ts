/**
 * Payment Service
 *
 * Business logic for pool capacity payments via Polar.sh.
 * Handles checkout initiation, webhook processing, and status queries.
 *
 * Key invariants:
 * - Pool.maxParticipants is ONLY updated inside handleOrderPaid (never from client)
 * - Price is ALWAYS computed server-side (client sends targetCapacity, not price)
 * - Webhooks are idempotent (PaymentEvent.polarEventId is unique)
 * - Checkouts are idempotent (reuse existing PENDING checkout for same pool)
 */

import crypto from "crypto";
import { prisma } from "../db";
import { ServiceError } from "./authService";
import { writeAuditEvent } from "../lib/audit";
import { sendAdminNotification, sendPaymentReceiptEmail } from "../lib/email";
import { resolveUserLocale } from "../lib/constants";
import { fireAndForget } from "../lib/asyncHelpers";
import { sendCapiEvent } from "../lib/metaCapi";
import { sendGa4Event } from "../lib/ga4";
import {
  calculateUpgradePrice,
  calculateUpgradePriceCop,
  usdToCents,
  getFreeLimit,
  type PoolType,
} from "../lib/pricing";
import {
  createCheckout as polarCreateCheckout,
  type CreateCheckoutParams,
} from "./polar/client";
import {
  processPaymentDirect as mpProcessPaymentDirect,
  getPayment as mpGetPayment,
  getMpPublicKey,
  createPreference as mpCreatePreference,
} from "./mercadopago/client";
import { Prisma } from "@prisma/client";
import {
  PAYMENT_EVENT_SOURCE,
  CLIENT_EVENT_TYPES,
  SERVER_EVENT_TYPE,
  type ClientEventType,
} from "../lib/paymentEvents";

// ── Helpers ────────────────────────────────────────────────────

/**
 * Webhook delivery metadata, captured at receipt and threaded through
 * the handler chain so every `PaymentEvent` row we write can record
 * which Polar delivery it came from (F-19). Headers are optional —
 * legacy callers (tests, retry loops) may omit them.
 */
export interface WebhookContext {
  /** Polar `webhook-id` header — Polar's delivery ID, useful for
   *  cross-referencing with Polar's dashboard log. */
  webhookId?: string;
  /** Polar `webhook-timestamp` header — ms or s epoch, parsed to Date
   *  at the route boundary so handlers receive a typed value. */
  webhookTimestamp?: Date;
}

/**
 * Resolves the COP value to report on a Purchase event for a Mercado Pago
 * payment. Prefers the persisted `amountCop` column (authoritative since
 * the 20260421 migration); falls back to recomputing from the pricing
 * library for pre-migration rows that still have NULL. We never use
 * `amountUsd` here — it's USD cents, mislabelled as COP pesos would
 * under-report revenue by ~40x.
 */
function mpPurchaseValue(payment: {
  amountCop: number | null;
  poolType: string;
  fromCapacity: number;
  toCapacity: number;
}): number {
  if (payment.amountCop != null) return payment.amountCop;
  return calculateUpgradePriceCop(
    payment.poolType as PoolType,
    payment.fromCapacity,
    payment.toCapacity,
  );
}

// ── Types ──────────────────────────────────────────────────────

export interface InitiateCheckoutInput {
  userId: string;
  poolId: string;
  targetCapacity: number;
  locale?: string;
  /** Optional Meta Advanced Matching signals, passed from the browser
   *  request that initiated the checkout so async webhook emissions
   *  (Polar `order.paid`, MP IPN) can attach them to the CAPI Purchase
   *  event. All fields may be undefined; missing values just reduce
   *  EMQ score without breaking dedup. */
  metaFbp?: string;
  metaFbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
}

export interface InitiateCheckoutResult {
  checkoutUrl: string;
  paymentId: string;
  amountUsd: number;
}

export interface PaymentStatusResult {
  status: string;
  fromCapacity: number;
  toCapacity: number;
  /**
   * Amount paid, always in MAJOR units (dollars for USD, pesos for COP).
   * Kept named `amountUsd` for backward compatibility with existing
   * frontend code, but `currency` tells you what unit this is in.
   */
  amountUsd: number;
  currency: "USD" | "COP";
  poolType: "personal" | "corporate";
  /**
   * Gateway-level unique transaction identifier. Present only when
   * `status === "COMPLETED"`. Used as GA4 `transaction_id` for purchase
   * events — same value from both the client-side approval event and the
   * exitoso page polling, so GA4 deduplicates them cleanly.
   */
  transactionId: string | null;
  /**
   * Meta event_id persisted on the payment row. Returned so the exitoso
   * page can emit the Meta Pixel Purchase with the same ID that CAPI
   * used, guaranteeing deduplication in Meta Events Manager.
   */
  metaEventId: string | null;
  paidAtUtc: string | null;
}

// ── Checkout Initiation ────────────────────────────────────────

/**
 * Create a Polar checkout session for a pool capacity upgrade.
 * If a PENDING checkout already exists for this pool, returns the existing one.
 */
export async function initiateCheckout(
  input: InitiateCheckoutInput,
): Promise<InitiateCheckoutResult> {
  const { userId, poolId, targetCapacity, locale } = input;

  // 1. Load pool and verify ownership
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      members: {
        where: { userId, role: { in: ["HOST", "CORPORATE_HOST"] } },
        take: 1,
      },
      organization: { select: { id: true } },
    },
  });

  if (!pool) throw new ServiceError("NOT_FOUND", 404);
  if (pool.members.length === 0) {
    throw new ServiceError("FORBIDDEN", 403, { reason: "Must be HOST or CORPORATE_HOST" });
  }

  const currentCapacity = pool.maxParticipants ?? getFreeLimit(pool.organization ? "corporate" : "personal");
  const poolType: PoolType = pool.organization ? "corporate" : "personal";

  // 2. Validate target capacity
  if (targetCapacity <= currentCapacity) {
    throw new ServiceError("VALIDATION_ERROR", 400, {
      message: "Target capacity must be greater than current capacity",
      currentCapacity,
      targetCapacity,
    });
  }

  // 3. Calculate price server-side
  const amountUsd = calculateUpgradePrice(poolType, currentCapacity, targetCapacity);
  if (amountUsd <= 0) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "No payment required for this capacity" });
  }
  const amountCents = usdToCents(amountUsd);

  // 4. Idempotency check (F-5). Scoped to the SAME user + same pool +
  // same target capacity + status=PENDING. Without the userId filter,
  // a CO_ADMIN re-initiating the upgrade would receive the URL created
  // for a different HOST — wrong email pre-filled, wrong receipt, wrong
  // CAPI attribution.
  const existingPayment = await prisma.poolPayment.findFirst({
    where: {
      poolId,
      userId,
      status: "PENDING",
      toCapacity: targetCapacity,
    },
    orderBy: { createdAtUtc: "desc" },
  });

  if (existingPayment && existingPayment.polarCheckoutId) {
    // Same user, same intent, currently active — return the existing
    // checkout URL. Try to re-fetch from Polar to confirm it's still
    // open; if Polar rejects (expired, deleted), we'll fall through
    // and create a fresh INITIATED row below.
    try {
      const { getCheckoutSession } = await import("./polar/client");
      const session = await getCheckoutSession(existingPayment.polarCheckoutId);
      if (session.url) {
        return {
          checkoutUrl: session.url,
          paymentId: existingPayment.id,
          amountUsd,
        };
      }
    } catch (err) {
      // Polar returned an error fetching the existing checkout.
      // The reconciler (F-14) will sweep the stale row separately.
      console.warn(
        `[PaymentService] Existing checkout ${existingPayment.polarCheckoutId} no longer fetchable — creating new attempt:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // 5. Get user email for checkout pre-fill
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) throw new ServiceError("NOT_FOUND", 404);

  // 6. Build success/cancel URLs
  const frontendUrl = process.env.FRONTEND_URL || "https://picks4all.com";
  const localePath = locale && locale !== "es" ? `/${locale}` : "";
  const successUrl = `${frontendUrl}${localePath}/pago/exitoso?poolId=${poolId}`;
  const cancelUrl = `${frontendUrl}${localePath}/pago/cancelado?poolId=${poolId}`;

  // 7. INSERT the PoolPayment in INITIATED state BEFORE calling Polar
  // (F-4). This is the keystone of the audit trail: if Polar's API
  // rejects the create, network drops, or any failure happens before
  // we get a checkout URL back, the row still exists. Pre-fix, the
  // INSERT happened AFTER the Polar call so a gateway-side failure
  // vanished entirely — exactly the case Abril's "no me anda la
  // página" report fell into.
  const payment = await prisma.poolPayment.create({
    data: {
      poolId,
      userId,
      polarCheckoutId: null, // populated post-Polar-success below
      status: "INITIATED",
      amountUsd: amountCents,
      currency: "usd",
      fromCapacity: currentCapacity,
      toCapacity: targetCapacity,
      poolType,
      // Persist Meta Advanced Matching signals so the async order.paid
      // webhook can emit a CAPI Purchase with full EMQ quality.
      metaFbp: input.metaFbp,
      metaFbc: input.metaFbc,
      clientIpAddress: input.clientIpAddress,
      clientUserAgent: input.clientUserAgent,
    },
  });

  // 8. Call Polar to create the actual checkout session. Failures must
  // not leave the row dangling — we transition to FAILED with an audit
  // STATUS_TRANSITION event and re-throw so the route returns 5xx.
  const checkoutParams: CreateCheckoutParams = {
    amountCents,
    customerEmail: user.email,
    successUrl,
    cancelUrl,
    locale: locale || "es",
    metadata: {
      poolId,
      userId,
      fromCapacity: currentCapacity,
      toCapacity: targetCapacity,
      poolType,
    },
  };

  let checkoutId: string;
  let checkoutUrl: string;
  try {
    const result = await polarCreateCheckout(checkoutParams);
    checkoutId = result.checkoutId;
    checkoutUrl = result.checkoutUrl;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[PaymentService] Polar create failed for payment ${payment.id}: ${errorMsg}`);

    // Best-effort transition to FAILED + audit. If the DB is the thing
    // that's down too (very rare race), the row stays INITIATED and the
    // reconciler will resolve it. We do NOT swallow the original Polar
    // error — re-throwing surfaces a 5xx to the route handler.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.poolPayment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
        await tx.paymentEvent.create({
          data: {
            source: PAYMENT_EVENT_SOURCE.SERVER,
            poolPaymentId: payment.id,
            eventType: SERVER_EVENT_TYPE.STATUS_TRANSITION,
            payloadJson: {
              from: "INITIATED",
              to: "FAILED",
              reason: "polar_create_failed",
              error: errorMsg.slice(0, 1000),
            },
          },
        });
      });
    } catch (markErr) {
      console.error(
        `[PaymentService] Failed to mark payment ${payment.id} as FAILED after Polar error:`,
        markErr instanceof Error ? markErr.message : String(markErr),
      );
    }
    throw err;
  }

  // 9. Polar accepted — transition to PENDING with the real checkoutId.
  // Atomic with the audit event so a tx failure leaves no half-state.
  await prisma.$transaction(async (tx) => {
    await tx.poolPayment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING",
        polarCheckoutId: checkoutId,
      },
    });
    await tx.paymentEvent.create({
      data: {
        source: PAYMENT_EVENT_SOURCE.SERVER,
        poolPaymentId: payment.id,
        eventType: SERVER_EVENT_TYPE.STATUS_TRANSITION,
        payloadJson: {
          from: "INITIATED",
          to: "PENDING",
          reason: "polar_checkout_created",
          polarCheckoutId: checkoutId,
        },
      },
    });
  });

  // 10. Audit (the long-form audit-log entry — unchanged behaviour
  //     except the SERVER STATUS_TRANSITION above is now the
  //     authoritative event for funnel analytics).
  fireAndForget("audit:checkout-created", writeAuditEvent({
    actorUserId: userId,
    action: "PAYMENT_CHECKOUT_CREATED",
    entityType: "Pool",
    entityId: poolId,
    poolId,
    dataJson: {
      paymentId: payment.id,
      polarCheckoutId: checkoutId,
      amountCents,
      fromCapacity: currentCapacity,
      toCapacity: targetCapacity,
      poolType,
    },
  }));

  return { checkoutUrl, paymentId: payment.id, amountUsd };
}

// ── Webhook Processing ─────────────────────────────────────────

/**
 * Process an order.paid webhook from Polar.
 * Idempotent: duplicate events are skipped silently.
 *
 * @param payload  Verified webhook body from Polar.
 * @param ctx      Delivery metadata threaded through from the route
 *                 boundary so the audit row (PaymentEvent) can record
 *                 which delivery it came from.
 */
export async function handleOrderPaid(
  payload: {
    data: {
      id: string;
      checkout_id?: string | null;
      metadata?: Record<string, unknown>;
      total_amount?: number;
    };
    type: string;
  },
  ctx: WebhookContext = {},
): Promise<void> {
  const eventId = payload.data.id;
  const eventType = payload.type || "order.paid";

  // 1. Cheap idempotency pre-check (avoids opening a tx for known duplicates).
  // Not a correctness boundary — the real lock is the partial unique index
  // `PaymentEvent_polarEventId_unique_when_set` (UNIQUE WHERE polarEventId
  // IS NOT NULL), claimed inside the transaction below. findFirst here
  // because Prisma doesn't recognise partial unique indexes as findUnique
  // targets, but the partial index guarantees ≤1 row per non-null value
  // so this is functionally equivalent.
  const existing = await prisma.paymentEvent.findFirst({
    where: { polarEventId: eventId },
  });
  if (existing) {
    console.log(`[PaymentService] Duplicate event ${eventId}, skipping`);
    return;
  }

  // 2. Validate metadata BEFORE entering the tx (cheap, no DB cost on bad input).
  const metadata = payload.data.metadata as {
    poolId?: string;
    userId?: string;
    fromCapacity?: number;
    toCapacity?: number;
    poolType?: string;
  } | null;

  if (!metadata?.poolId || !metadata?.toCapacity) {
    console.error("[PaymentService] order.paid missing metadata:", metadata);
    return;
  }

  const checkoutId = payload.data.checkout_id;
  if (!checkoutId) {
    console.error("[PaymentService] order.paid missing checkoutId");
    return;
  }

  // 3. Find the PoolPayment by checkout ID. findFirst (not findUnique)
  // because polarCheckoutId is partial-unique-when-set after the
  // 20260521 migration; the index still guarantees ≤1 row per value.
  const payment = await prisma.poolPayment.findFirst({
    where: { polarCheckoutId: checkoutId },
  });

  if (!payment) {
    // Common cause: race between checkout creation and webhook delivery
    // (50-200ms window where the PoolPayment row was not yet committed
    // when Polar fired this webhook). Throw so the route returns 5xx
    // and Polar retries with exponential backoff — the row will exist
    // on retry. If after Polar's full retry budget the row still doesn't
    // exist, the event lands in Polar's DLQ for human triage.
    // The pre-fix `return` here silently dropped pagos when the race hit.
    console.error(`[PaymentService] order.paid: PoolPayment not found for checkout ${checkoutId} — signalling retry`);
    throw new Error("PAYMENT_NOT_FOUND_RETRYABLE");
  }

  if (payment.status === "COMPLETED") {
    console.log(`[PaymentService] Payment ${payment.id} already completed, skipping`);
    return;
  }

  // 4. Generate the Meta event ID up-front so it can be persisted INSIDE the
  // same tx as the rest of the state changes. The success-page Pixel emission
  // and the server-side CAPI emission below both use this ID; if it weren't
  // committed atomically with COMPLETED, a tx that failed AFTER metaEventId
  // was set could leave the pool expanded but the Pixel/CAPI dedup broken.
  const metaEventId = metadata.userId ? crypto.randomUUID() : null;
  const paidAt = new Date();

  // 5. Atomic claim + state changes. PaymentEvent.create is now INSIDE the
  // tx so the partial-unique-index slot only stays committed if the rest
  // of the writes succeed. If anything throws, the slot rolls back and
  // Polar's retry (which our 5xx response triggers — see route handler)
  // gets a fresh shot at processing.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          source: PAYMENT_EVENT_SOURCE.POLAR_WEBHOOK,
          polarEventId: eventId,
          poolPaymentId: payment.id,
          eventType,
          webhookId: ctx.webhookId,
          webhookTimestamp: ctx.webhookTimestamp,
          payloadJson: JSON.parse(JSON.stringify(payload)),
        },
      });
      await tx.poolPayment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          polarOrderId: eventId,
          paidAtUtc: paidAt,
          ...(metaEventId ? { metaEventId } : {}),
        },
      });
      await tx.pool.update({
        where: { id: metadata.poolId! },
        data: {
          maxParticipants: metadata.toCapacity!,
          // Re-arm capacity threshold notifications so the warning + full
          // emails fire again if the pool refills after the expansion.
          poolFullNotifiedAt: null,
          capacityWarningNotifiedAt: null,
        },
      });
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // Concurrent webhook claimed the event slot first; safe to skip.
      console.log(`[PaymentService] Race-condition duplicate event ${eventId}, skipping`);
      return;
    }
    throw err; // Real failure → propagate so route returns 5xx and Polar retries.
  }

  console.log(
    `[PaymentService] Pool ${metadata.poolId} expanded: ${metadata.fromCapacity} → ${metadata.toCapacity} participants`
  );

  // 6. Audit + notification
  fireAndForget("audit:payment-completed", writeAuditEvent({
    actorUserId: metadata.userId || null,
    action: "PAYMENT_COMPLETED",
    entityType: "Pool",
    entityId: metadata.poolId,
    poolId: metadata.poolId,
    dataJson: {
      paymentId: payment.id,
      polarOrderId: eventId,
      fromCapacity: metadata.fromCapacity,
      toCapacity: metadata.toCapacity,
      poolType: metadata.poolType,
    },
  }));

  fireAndForget(
    "admin:payment-completed",
    (async () => {
      const [pool, user] = await Promise.all([
        prisma.pool.findUnique({
          where: { id: metadata.poolId! },
          select: { name: true },
        }),
        metadata.userId
          ? prisma.user.findUnique({
              where: { id: metadata.userId },
              select: { displayName: true, email: true },
            })
          : null,
      ]);
      const poolName = pool?.name || metadata.poolId!;
      const buyer = user
        ? `${user.displayName} <${user.email}>`
        : "(usuario desconocido)";
      const usdAmount = `$${(payment.amountUsd / 100).toFixed(2)} USD`;
      const copAmount = payment.amountCop
        ? `${payment.amountCop.toLocaleString("es-CO")} COP`
        : null;
      const amountStr = copAmount ? `${copAmount} (${usdAmount})` : usdAmount;
      // This handler is the Polar `order.paid` webhook entry point —
      // MP completions go through a different handler elsewhere — so the
      // gateway is always Polar here. We derive it from `mpPreferenceId`
      // anyway to stay correct if the routing ever changes.
      const gateway = payment.mpPreferenceId ? "Mercado Pago" : "Polar";
      return sendAdminNotification({
        subject: `${buyer} — pool "${poolName}" ${metadata.fromCapacity}→${metadata.toCapacity} (${amountStr})`,
        body:
          `<p><strong>Pool:</strong> "${poolName}" (${metadata.poolType})</p>` +
          `<p><strong>Comprador:</strong> ${buyer}</p>` +
          `<p><strong>Capacidad:</strong> ${metadata.fromCapacity} → ${metadata.toCapacity} participantes</p>` +
          `<p><strong>Monto:</strong> ${amountStr}</p>` +
          `<p><strong>Pasarela:</strong> ${gateway} · payment id <code>${payment.id}</code></p>`,
        category: "payment_completed",
      });
    })(),
  );

  if (metadata.userId && metaEventId) {
    // metaEventId was generated and persisted INSIDE the atomic tx above —
    // no separate update here. The success-page Pixel emission and the
    // server-side CAPI emission below both use the same ID, so Meta
    // deduplicates the Purchase event automatically.
    // Enriched Advanced Matching: everything we know about the user that
    // Meta accepts (email, name, DOB, gender, country) improves EMQ score
    // and match quality in Events Manager.
    const userForCapi = await prisma.user.findUnique({
      where: { id: metadata.userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        country: true,
      },
    });
    fireAndForget("capi:purchase-polar", sendCapiEvent({
      eventName: "Purchase",
      eventId: metaEventId,
      userData: {
        externalId: metadata.userId,
        email: userForCapi?.email,
        firstName: userForCapi?.firstName ?? undefined,
        lastName: userForCapi?.lastName ?? undefined,
        dateOfBirth: userForCapi?.dateOfBirth?.toISOString().slice(0, 10),
        gender: userForCapi?.gender ?? undefined,
        country: userForCapi?.country ?? undefined,
        // Advanced Matching signals captured when the checkout was
        // initiated from the browser. Without these the EMQ score
        // drops 2-3 points and Meta's audience optimisation degrades.
        fbp: payment.metaFbp ?? undefined,
        fbc: payment.metaFbc ?? undefined,
        clientIpAddress: payment.clientIpAddress ?? undefined,
        clientUserAgent: payment.clientUserAgent ?? undefined,
      },
      customData: {
        value: payment.amountUsd / 100,
        currency: "USD",
        content_type: "product",
        content_ids: [`pool_upgrade_${payment.poolType}_${payment.toCapacity}`],
        num_items: 1,
      },
    }));

    // Server-side GA4 failsafe. GA4 deduplicates by `transaction_id`, so
    // if the browser already fired `purchase` this call is a no-op in
    // reports but guarantees revenue is captured when the browser event
    // was blocked (ad-blocker, tab closed on redirect, Polar bounce).
    fireAndForget("ga4mp:purchase-polar", sendGa4Event({
      userId: metadata.userId,
      events: [{
        name: "purchase",
        params: {
          transaction_id: eventId,
          affiliation: "Polar International",
          currency: "USD",
          value: payment.amountUsd / 100,
          items: [{
            item_id: `pool_upgrade_${payment.poolType}_${payment.toCapacity}`,
            item_name: `Pool capacity upgrade to ${payment.toCapacity}`,
            item_category: "pool_capacity",
            item_variant: payment.poolType,
            price: payment.amountUsd / 100,
            quantity: 1,
            currency: "USD",
          }],
        },
      }],
    }));
  }

  // 7. Send payment receipt to user
  if (metadata.userId) {
    fireAndForget("payment-receipt-email", (async () => {
      const user = await prisma.user.findUnique({
        where: { id: metadata.userId! },
        select: { email: true, displayName: true, country: true },
      });
      const pool = await prisma.pool.findUnique({
        where: { id: metadata.poolId! },
        select: { name: true },
      });
      if (!user || !pool) return;
      const amountUsd = payment.amountUsd / 100;
      await sendPaymentReceiptEmail({
        to: user.email,
        userId: metadata.userId!,
        displayName: user.displayName,
        poolName: pool.name,
        poolId: metadata.poolId!,
        transactionId: eventId,
        amount: amountUsd.toFixed(2),
        currency: "USD",
        fromCapacity: metadata.fromCapacity!,
        toCapacity: metadata.toCapacity!,
        paidAt: new Date(),
        locale: resolveUserLocale(user),
      });
    })());
  }
}

/**
 * Process an `order.refunded` (or equivalent cancellation) webhook from
 * Polar. Marks the PoolPayment as REFUNDED, emits a GA4 `refund` event
 * with the same transaction_id as the original purchase, and sends a
 * compensating Meta CAPI event. Idempotent via `PaymentEvent.polarEventId`.
 *
 * NOTE: refunds DO NOT shrink `Pool.maxParticipants`. Reducing capacity
 * could evict members who have already joined; a manual host flow would
 * be required for that. We only reverse the revenue accounting.
 */
export async function handleOrderRefunded(
  payload: {
    data: {
      id: string;
      checkout_id?: string | null;
      metadata?: Record<string, unknown>;
      total_amount?: number;
    };
    type: string;
  },
  ctx: WebhookContext = {},
): Promise<void> {
  const eventId = payload.data.id;
  const eventType = payload.type || "order.refunded";

  // Cheap pre-check (real lock is the partial unique index inside the tx
  // below — see note on findFirst in handleOrderPaid above).
  const existing = await prisma.paymentEvent.findFirst({
    where: { polarEventId: eventId },
  });
  if (existing) return;

  const checkoutId = payload.data.checkout_id;
  const payment = checkoutId
    ? await prisma.poolPayment.findFirst({ where: { polarCheckoutId: checkoutId } })
    : null;

  if (!payment) {
    // Same retryable race as handleOrderPaid above. Refund webhooks normally
    // arrive long after the original PoolPayment row has been committed,
    // but if Polar's refund delivery beats our DB write for some reason,
    // signal retry so we don't silently drop the refund.
    console.error(`[PaymentService] order.refunded: PoolPayment not found for checkout ${checkoutId} — signalling retry`);
    throw new Error("PAYMENT_NOT_FOUND_RETRYABLE");
  }

  if (payment.status === "REFUNDED") {
    console.log(`[PaymentService] Payment ${payment.id} already REFUNDED`);
    return;
  }

  // Atomic claim + state change. PaymentEvent.create is INSIDE the tx so the
  // partial-unique-index slot only stays committed if the REFUNDED update
  // succeeds. If anything throws, the slot rolls back and Polar's retry
  // (triggered by our 5xx) gets a fresh shot.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          source: PAYMENT_EVENT_SOURCE.POLAR_WEBHOOK,
          polarEventId: eventId,
          poolPaymentId: payment.id,
          eventType,
          webhookId: ctx.webhookId,
          webhookTimestamp: ctx.webhookTimestamp,
          payloadJson: JSON.parse(JSON.stringify(payload)),
        },
      });
      await tx.poolPayment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" },
      });
    });
  } catch (err: any) {
    if (err?.code === "P2002") return; // race with concurrent webhook — safe skip
    throw err;
  }

  fireAndForget("audit:payment-refunded", writeAuditEvent({
    actorUserId: payment.userId,
    action: "PAYMENT_REFUNDED",
    entityType: "Pool",
    entityId: payment.poolId,
    poolId: payment.poolId,
    dataJson: { paymentId: payment.id, polarEventId: eventId, amountCents: payment.amountUsd },
  }));

  // Analytics: GA4 `refund` deduplicates against the original purchase
  // by transaction_id. We use the ORIGINAL transactionId (polarOrderId)
  // so the refund collapses onto the same GA4 transaction row.
  const transactionId = payment.polarOrderId ?? eventId;
  const amountMajor = payment.amountUsd / 100;

  fireAndForget("ga4mp:refund-polar", sendGa4Event({
    userId: payment.userId,
    events: [{
      name: "refund",
      params: {
        transaction_id: transactionId,
        currency: "USD",
        value: amountMajor,
        items: [{
          item_id: `pool_upgrade_${payment.poolType}_${payment.toCapacity}`,
          item_name: `Pool capacity upgrade to ${payment.toCapacity}`,
          item_category: "pool_capacity",
          item_variant: payment.poolType,
          price: amountMajor,
          quantity: 1,
          currency: "USD",
        }],
      },
    }],
  }));

  // Meta CAPI: there is no "refund" standard event. Google's convention
  // is to send a compensating custom event that downstream BI can reconcile.
  // Re-use the same event_id prefix so it stays grouped with the purchase
  // in Events Manager's deduplication view.
  fireAndForget("capi:refund-polar", sendCapiEvent({
    eventName: "Refund",
    eventId: `${payment.metaEventId ?? transactionId}-refund`,
    userData: { externalId: payment.userId },
    customData: {
      value: amountMajor,
      currency: "USD",
      content_type: "product",
      content_ids: [`pool_upgrade_${payment.poolType}_${payment.toCapacity}`],
      num_items: 1,
      original_transaction_id: transactionId,
    },
  }));
}

/**
 * Process a `checkout.updated` webhook from Polar.
 *
 * Pre-20260519 this handler only acted on `expired` / `failed` and dropped
 * every other status on the floor, leaving us blind to "user reached
 * checkout", "user submitted payment, awaiting processor", "user
 * cancelled at the Polar page", etc. — see POLAR_AUDIT.md F-3.
 *
 * Now we persist EVERY checkout.updated delivery as a PaymentEvent,
 * map known terminal states (`expired`, `failed`, `canceled`, `succeeded`)
 * to the corresponding PaymentStatus, and leave non-terminal transitions
 * (`open`, `processing`, `confirmed`) as audit-only rows.
 *
 * Idempotent: each delivery has its own `payload.data.id` per Polar's
 * webhook contract, so the partial unique index on `polarEventId` keeps
 * duplicate deliveries from re-writing PoolPayment state.
 */
export async function handleCheckoutUpdated(
  payload: {
    data: {
      id: string;
      status?: string;
    };
    type: string;
  },
  ctx: WebhookContext = {},
): Promise<void> {
  const checkoutId = payload.data.id;
  const checkoutStatus = (payload.data.status ?? "").toLowerCase();
  const eventId = payload.data.id; // Polar reuses the checkout id as the event id for checkout.updated; fine as the idempotency key since each transition gets a separate webhook delivery with a distinct webhook-id header (captured in ctx).

  // 1. Cheap idempotency pre-check.
  const existingEvent = await prisma.paymentEvent.findFirst({
    where: { polarEventId: eventId, eventType: payload.type || "checkout.updated" },
  });
  if (existingEvent) {
    console.log(`[PaymentService] Duplicate checkout.updated ${eventId} (${checkoutStatus}), skipping`);
    return;
  }

  // 2. Match to a PoolPayment (may be null for racing deliveries
  // pre-INITIATED rollout — graceful degradation). findFirst because
  // polarCheckoutId is partial-unique-when-set after 20260521.
  const payment = await prisma.poolPayment.findFirst({
    where: { polarCheckoutId: checkoutId },
  });

  // 3. Decide target PaymentStatus, if any.
  // `expired` / `failed` / `canceled` are terminal Polar states we map
  // onto our enum. `succeeded` is intermediate (the order.paid webhook
  // does the actual COMPLETED transition); we still audit-log it so the
  // funnel report can count "reached succeeded but no order.paid arrived".
  // `open` / `processing` / `confirmed` are non-terminal — audit only.
  let nextStatus: "EXPIRED" | "CANCELLED" | "FAILED" | null = null;
  if (payment && (payment.status === "PENDING" || payment.status === "INITIATED")) {
    if (checkoutStatus === "expired") nextStatus = "EXPIRED";
    else if (checkoutStatus === "canceled" || checkoutStatus === "cancelled") nextStatus = "CANCELLED";
    else if (checkoutStatus === "failed") nextStatus = "FAILED";
  }

  // 4. Write the audit row + maybe transition status atomically.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          source: PAYMENT_EVENT_SOURCE.POLAR_WEBHOOK,
          polarEventId: eventId,
          poolPaymentId: payment?.id ?? null,
          eventType: payload.type || "checkout.updated",
          webhookId: ctx.webhookId,
          webhookTimestamp: ctx.webhookTimestamp,
          payloadJson: JSON.parse(JSON.stringify(payload)),
        },
      });
      if (payment && nextStatus) {
        await tx.poolPayment.update({
          where: { id: payment.id },
          data: { status: nextStatus },
        });
      }
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      console.log(`[PaymentService] Race-condition duplicate checkout.updated ${eventId}, skipping`);
      return;
    }
    throw err;
  }

  if (nextStatus) {
    console.log(`[PaymentService] Checkout ${checkoutId} ${checkoutStatus} → payment ${payment!.id} marked ${nextStatus}`);
    // Funnel analytics: only emit payment_failed once per transition.
    if (nextStatus === "FAILED" || nextStatus === "EXPIRED" || nextStatus === "CANCELLED") {
      fireAndForget("ga4mp:payment_failed-polar", sendGa4Event({
        userId: payment!.userId,
        events: [{
          name: "payment_failed",
          params: {
            transaction_id: payment!.polarCheckoutId,
            affiliation: "Polar",
            currency: "USD",
            value: payment!.amountUsd / 100,
            reason: checkoutStatus,
            payment_method: "polar",
          },
        }],
      }));
    }
  } else {
    console.log(`[PaymentService] Checkout ${checkoutId} status=${checkoutStatus} — audit row written, no state transition`);
  }
}

/**
 * Persist a Polar webhook event that has no dedicated business-logic
 * handler (e.g. `customer.created`, `subscription.updated`, or any
 * future event type Polar adds). Writing the row guarantees the audit
 * trail promised by `PaymentEvent`'s docstring: every webhook we
 * receive leaves a trace, even if we don't act on it.
 *
 * Idempotent via the partial unique index on polarEventId. Returns
 * silently on duplicate events.
 */
export async function recordUnhandledPolarEvent(
  payload: { type: string; data: { id?: string;[key: string]: unknown } },
  ctx: WebhookContext = {},
): Promise<void> {
  const eventId = (payload.data?.id as string | undefined) ?? undefined;
  if (!eventId) {
    // No event id means we can't dedupe. Persist with NULL polarEventId
    // (allowed by the partial unique index) and a synthetic eventType
    // suffix so a re-delivery would dedupe via row identity (timestamp
    // collision is the only realistic re-write path here).
    console.warn(`[PaymentService] Unhandled Polar event with no id, persisting without dedup key: ${payload.type}`);
  }

  // checkout_id present on most checkout.* events; orders carry it
  // explicitly too. Worth a lookup so the audit row links to the
  // PoolPayment.
  const checkoutId =
    (payload.data?.checkout_id as string | null | undefined) ??
    (payload.type.startsWith("checkout.") ? (payload.data?.id as string | undefined) : undefined);
  const payment = checkoutId
    ? await prisma.poolPayment.findFirst({ where: { polarCheckoutId: checkoutId } })
    : null;

  // Idempotency pre-check (only when we have an eventId).
  if (eventId) {
    const existing = await prisma.paymentEvent.findFirst({
      where: { polarEventId: eventId, eventType: payload.type },
    });
    if (existing) {
      console.log(`[PaymentService] Duplicate unhandled event ${payload.type}/${eventId}, skipping`);
      return;
    }
  }

  try {
    await prisma.paymentEvent.create({
      data: {
        source: PAYMENT_EVENT_SOURCE.POLAR_WEBHOOK,
        polarEventId: eventId ?? null,
        poolPaymentId: payment?.id ?? null,
        eventType: payload.type,
        webhookId: ctx.webhookId,
        webhookTimestamp: ctx.webhookTimestamp,
        payloadJson: JSON.parse(JSON.stringify(payload)),
      },
    });
    console.log(`[PaymentService] Recorded unhandled Polar event: ${payload.type}${eventId ? ` (id=${eventId})` : ""}`);
  } catch (err: any) {
    // P2002 = partial unique index collision. Race with a duplicate
    // delivery; safe to skip silently.
    if (err?.code === "P2002") return;
    throw err;
  }
}

// ── Client-side event recording ────────────────────────────────

export interface RecordClientEventInput {
  /** Authenticated user — must match the PoolPayment's userId. */
  userId: string;
  /** PoolPayment being reported on. Ownership is enforced before writing. */
  poolPaymentId: string;
  /** One of CLIENT_EVENT_TYPES — REDIRECT_INITIATED, REDIRECT_FAILED,
   *  USER_CANCELLED, CLIENT_ERROR. */
  eventType: ClientEventType;
  /** Optional structured detail — error message, retry count, browser
   *  metadata, anything the frontend wants persisted for forensics. */
  details?: Record<string, unknown>;
}

/**
 * Record a client-side event for a payment attempt. The browser POSTs to
 * `/payments/attempts/:paymentId/event` and the route calls this.
 *
 * Authorization contract: the call MUST verify that `userId` owns the
 * `poolPaymentId` before persisting. We enforce that here as the last
 * line of defence — even if the route handler is bypassed, no event is
 * written for someone else's payment.
 *
 * Idempotency: client events have no gateway event ID, so polarEventId
 * is null. A frontend can safely re-emit the same event (e.g. after a
 * page reload during the redirect lifecycle) — each becomes a distinct
 * row, which is the desired forensic behavior. If we ever need to
 * deduplicate on a client-provided key, add an optional `clientEventId`
 * and a partial unique index on it.
 */
export async function recordClientEvent(input: RecordClientEventInput): Promise<void> {
  if (!CLIENT_EVENT_TYPES.includes(input.eventType)) {
    throw new ServiceError("INVALID_EVENT_TYPE", 400, { eventType: input.eventType });
  }

  const payment = await prisma.poolPayment.findUnique({
    where: { id: input.poolPaymentId },
    select: { id: true, userId: true },
  });
  if (!payment) throw new ServiceError("NOT_FOUND", 404);
  if (payment.userId !== input.userId) {
    // Cross-user write attempt. Refuse without leaking that the
    // payment exists.
    throw new ServiceError("FORBIDDEN", 403);
  }

  await prisma.paymentEvent.create({
    data: {
      source: PAYMENT_EVENT_SOURCE.CLIENT,
      // No gateway event ID; partial unique index permits NULL here.
      polarEventId: null,
      poolPaymentId: payment.id,
      eventType: input.eventType,
      payloadJson: (input.details ?? {}) as Prisma.InputJsonValue,
    },
  });
}

// ── Status Queries ─────────────────────────────────────────────

/**
 * Get the latest payment status for a pool.
 */
export async function getPaymentStatus(
  userId: string,
  poolId: string,
): Promise<PaymentStatusResult | null> {
  // Verify membership
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  if (!member) throw new ServiceError("FORBIDDEN", 403);

  const payment = await prisma.poolPayment.findFirst({
    where: { poolId },
    orderBy: { createdAtUtc: "desc" },
  });

  if (!payment) return null;

  const currency = payment.currency.toUpperCase() as "USD" | "COP";
  // USD payments: amountUsd is cents (Polar standard) → convert to dollars.
  // COP payments: amountUsd is ALSO USD cents (mislabeled column for MP rows);
  //   the real pesos are in amountCop (or recoverable via mpPurchaseValue).
  //   Without this, the success page shows "$6.597 COP" for a real $260,000
  //   COP payment — same root cause as the receipt-email bug.
  const amountMajor = currency === "USD"
    ? payment.amountUsd / 100
    : mpPurchaseValue(payment);

  return {
    status: payment.status,
    fromCapacity: payment.fromCapacity,
    toCapacity: payment.toCapacity,
    amountUsd: amountMajor,
    currency,
    poolType: (payment.poolType as "personal" | "corporate") ?? "personal",
    transactionId: payment.polarOrderId ?? null,
    metaEventId: payment.metaEventId ?? null,
    paidAtUtc: payment.paidAtUtc?.toISOString() ?? null,
  };
}

// ─── Reconciliation (F-14) ─────────────────────────────────────

import { RECONCILER_EVENT_TYPE } from "../lib/paymentEvents";
import { getCheckoutSession } from "./polar/client";

/**
 * Threshold (in hours) past which a PoolPayment still in INITIATED or
 * PENDING is considered abandoned. Configurable via env var so we can
 * relax during the World Cup and tighten otherwise. Default 24h —
 * Polar's default checkout TTL is 24h, beyond which the checkout
 * link is unusable anyway.
 */
const RECONCILE_ABANDONED_THRESHOLD_HOURS = Number(
  process.env.RECONCILE_ABANDONED_THRESHOLD_HOURS || "24",
);

/**
 * Grace period before considering a row eligible for reconciliation.
 * Inside this window the webhook is still expected to arrive normally;
 * reconciling too aggressively would race the gateway. 15 minutes is
 * Polar's typical webhook delivery worst-case + a safety margin.
 */
const RECONCILE_GRACE_PERIOD_MINUTES = Number(
  process.env.RECONCILE_GRACE_PERIOD_MINUTES || "15",
);

export interface ReconcileResult {
  paymentId: string;
  outcome: "RESCUED" | "EXPIRED" | "FAILED_FROM_GATEWAY" | "ABANDONED_GATEWAY_404" | "ABANDONED_LOCAL_TIMEOUT" | "NOOP";
  previousStatus: string;
  nextStatus: string | null;
}

/**
 * Reconcile a single stale PoolPayment against Polar.
 *
 * Strategy:
 *   1. If the row has no `polarCheckoutId` (rare — only possible if a
 *      previous initiateCheckout crashed AFTER the INITIATED INSERT but
 *      BEFORE Polar accepted the create), there's nothing to query. If
 *      the row is past the abandon threshold, mark ABANDONED with a
 *      `gateway_never_reached` reason.
 *   2. Otherwise call Polar `getCheckoutSession(polarCheckoutId)` and
 *      map the response:
 *       - status=`succeeded` and our row is NOT COMPLETED → RESCUED.
 *         Write an audit row + notify admin. We do NOT auto-complete
 *         because the webhook side-effects (CAPI Purchase, GA4 purchase,
 *         pool capacity bump, receipt email) are non-trivial to replay
 *         safely; a human reviews and processes via the override path.
 *       - status=`expired` → mark EXPIRED.
 >      - status=`failed` → mark FAILED.
 *       - status=`open` and row older than threshold → mark ABANDONED.
 *       - status=`open` and row within threshold → NOOP.
 *       - HTTP 404 (checkout deleted upstream) → mark ABANDONED.
 *
 * Every outcome writes a `PaymentEvent` row with `source=RECONCILER` so
 * the audit log shows exactly what the reconciler decided and why.
 */
export async function reconcileStalePayment(paymentId: string): Promise<ReconcileResult> {
  const payment = await prisma.poolPayment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    throw new ServiceError("NOT_FOUND", 404);
  }

  // Only INITIATED / PENDING are reconcilable. Anything else has already
  // reached a terminal state.
  if (payment.status !== "INITIATED" && payment.status !== "PENDING") {
    return {
      paymentId,
      outcome: "NOOP",
      previousStatus: payment.status,
      nextStatus: null,
    };
  }

  const ageHours = (Date.now() - payment.createdAtUtc.getTime()) / 3_600_000;
  const isOlderThanThreshold = ageHours >= RECONCILE_ABANDONED_THRESHOLD_HOURS;

  // Case 1: no polarCheckoutId — Polar create never returned, and the
  // initiateCheckout failure path didn't run (host crashed mid-flight,
  // or rare race). Only act once we're past the abandon threshold.
  if (!payment.polarCheckoutId) {
    if (!isOlderThanThreshold) {
      return {
        paymentId,
        outcome: "NOOP",
        previousStatus: payment.status,
        nextStatus: null,
      };
    }
    await markAbandoned(payment.id, payment.status, "gateway_never_reached", {
      ageHours,
      polarCheckoutId: null,
    });
    return {
      paymentId,
      outcome: "ABANDONED_LOCAL_TIMEOUT",
      previousStatus: payment.status,
      nextStatus: "ABANDONED",
    };
  }

  // Case 2: query Polar for the current checkout state.
  let polarStatus: string | null = null;
  let polarPayload: Record<string, unknown> | null = null;
  let polarErrorCode: number | null = null;

  try {
    const session = await getCheckoutSession(payment.polarCheckoutId);
    polarStatus = (session.status as string | undefined) ?? null;
    polarPayload = JSON.parse(JSON.stringify(session));
  } catch (err: any) {
    // The SDK throws on non-2xx. We can distinguish 404 from transient
    // failures by inspecting the error structure. The standardwebhooks
    // / SDK error shape exposes `statusCode` for HTTP errors.
    polarErrorCode = typeof err?.statusCode === "number" ? err.statusCode : null;
    polarPayload = {
      error: err instanceof Error ? err.message : String(err),
      statusCode: polarErrorCode,
    };

    // 404 from Polar = checkout deleted upstream (long since expired or
    // explicitly removed via Polar dashboard). Treat as ABANDONED.
    if (polarErrorCode === 404) {
      await markAbandoned(payment.id, payment.status, "polar_404_checkout_missing", polarPayload);
      return {
        paymentId,
        outcome: "ABANDONED_GATEWAY_404",
        previousStatus: payment.status,
        nextStatus: "ABANDONED",
      };
    }

    // Any other error (5xx, network, rate limit) — do NOT transition.
    // Audit the attempt as RECONCILER_NOOP so the operator can see we
    // tried, then leave the row for the next tick.
    await writeReconcilerEvent(payment.id, RECONCILER_EVENT_TYPE.NOOP, {
      reason: "polar_query_failed",
      ...polarPayload,
    });
    return {
      paymentId,
      outcome: "NOOP",
      previousStatus: payment.status,
      nextStatus: null,
    };
  }

  // Case 3: Polar responded — map status to outcome.
  const polarStatusLower = (polarStatus ?? "").toLowerCase();

  if (polarStatusLower === "succeeded" || polarStatusLower === "confirmed") {
    // RESCUED — Polar believes this checkout completed but we don't have
    // a COMPLETED row. Could be: webhook never delivered, webhook
    // delivered but processing failed every retry, or the row was reset
    // accidentally. We write the audit row + notify admin; we do NOT
    // auto-complete (replaying handleOrderPaid is non-trivial; a human
    // verifies via Polar dashboard and processes manually).
    await writeReconcilerEvent(payment.id, RECONCILER_EVENT_TYPE.RESCUED, {
      polarStatus,
      polarCheckoutId: payment.polarCheckoutId,
      ageHours,
      polarPayload,
    });

    // Fire admin notification (best-effort, async).
    fireAndForget("admin:reconciler-rescued", sendAdminNotification({
      subject: `[Reconciler] Polar says ${polarStatus} but PoolPayment ${payment.id} is ${payment.status}`,
      body:
        `<p><strong>Manual review required.</strong> Polar's checkout state contradicts ours.</p>` +
        `<p><strong>Payment:</strong> <code>${payment.id}</code></p>` +
        `<p><strong>polarCheckoutId:</strong> <code>${payment.polarCheckoutId}</code></p>` +
        `<p><strong>Polar status:</strong> ${polarStatus}</p>` +
        `<p><strong>Our status:</strong> ${payment.status} (age ${ageHours.toFixed(1)}h)</p>` +
        `<p>Verify in Polar dashboard, then process manually (capacity bump + CAPI/GA4 + receipt email).</p>`,
      category: "payment_reconciler_rescued",
    }));

    return {
      paymentId,
      outcome: "RESCUED",
      previousStatus: payment.status,
      nextStatus: null, // intentionally not transitioned by the reconciler
    };
  }

  if (polarStatusLower === "expired") {
    await prisma.$transaction(async (tx) => {
      await tx.poolPayment.update({ where: { id: payment.id }, data: { status: "EXPIRED" } });
      await tx.paymentEvent.create({
        data: {
          source: PAYMENT_EVENT_SOURCE.RECONCILER,
          poolPaymentId: payment.id,
          eventType: RECONCILER_EVENT_TYPE.EXPIRED,
          payloadJson: { polarStatus, ageHours, polarPayload } as Prisma.InputJsonValue,
        },
      });
    });
    return {
      paymentId,
      outcome: "EXPIRED",
      previousStatus: payment.status,
      nextStatus: "EXPIRED",
    };
  }

  if (polarStatusLower === "failed") {
    await prisma.$transaction(async (tx) => {
      await tx.poolPayment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      await tx.paymentEvent.create({
        data: {
          source: PAYMENT_EVENT_SOURCE.RECONCILER,
          poolPaymentId: payment.id,
          eventType: RECONCILER_EVENT_TYPE.EXPIRED,
          payloadJson: { polarStatus, ageHours, polarPayload } as Prisma.InputJsonValue,
        },
      });
    });
    return {
      paymentId,
      outcome: "FAILED_FROM_GATEWAY",
      previousStatus: payment.status,
      nextStatus: "FAILED",
    };
  }

  // Polar status is "open" (or anything else not terminal). If the row
  // is older than the abandon threshold, give up locally — the checkout
  // link is unusable anyway. Otherwise, NOOP and let the webhook
  // eventually deliver.
  if (isOlderThanThreshold) {
    await markAbandoned(payment.id, payment.status, "local_timeout", {
      polarStatus,
      ageHours,
      polarPayload,
    });
    return {
      paymentId,
      outcome: "ABANDONED_LOCAL_TIMEOUT",
      previousStatus: payment.status,
      nextStatus: "ABANDONED",
    };
  }

  await writeReconcilerEvent(payment.id, RECONCILER_EVENT_TYPE.NOOP, {
    reason: "polar_still_open_within_threshold",
    polarStatus,
    ageHours,
  });
  return {
    paymentId,
    outcome: "NOOP",
    previousStatus: payment.status,
    nextStatus: null,
  };
}

/**
 * Mark a payment as ABANDONED atomically with a RECONCILER audit event.
 * Helper to keep the reconciler's branches readable.
 */
async function markAbandoned(
  paymentId: string,
  previousStatus: string,
  reason: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.poolPayment.update({
      where: { id: paymentId },
      data: { status: "ABANDONED" },
    });
    await tx.paymentEvent.create({
      data: {
        source: PAYMENT_EVENT_SOURCE.RECONCILER,
        poolPaymentId: paymentId,
        eventType: RECONCILER_EVENT_TYPE.ABANDONED,
        payloadJson: {
          from: previousStatus,
          to: "ABANDONED",
          reason,
          ...detail,
        } as Prisma.InputJsonValue,
      },
    });
  });
}

async function writeReconcilerEvent(
  paymentId: string,
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await prisma.paymentEvent.create({
    data: {
      source: PAYMENT_EVENT_SOURCE.RECONCILER,
      poolPaymentId: paymentId,
      eventType,
      payloadJson: detail as Prisma.InputJsonValue,
    },
  });
}

/**
 * Find the next batch of PoolPayments eligible for reconciliation:
 *   - status ∈ (INITIATED, PENDING)
 *   - older than the grace period (so we don't race the webhook)
 *
 * Ordered oldest-first so a long-stuck row gets resolved before newer
 * arrivals. Batch size capped to avoid hammering Polar's rate limit.
 */
export async function findStalePayments(batchSize: number): Promise<{ id: string }[]> {
  const cutoff = new Date(Date.now() - RECONCILE_GRACE_PERIOD_MINUTES * 60_000);
  return prisma.poolPayment.findMany({
    where: {
      status: { in: ["INITIATED", "PENDING"] },
      createdAtUtc: { lt: cutoff },
    },
    select: { id: true },
    orderBy: { createdAtUtc: "asc" },
    take: batchSize,
  });
}

// ═══════════════════════════════════════════════════════════════
// MERCADO PAGO (Colombia, COP)
// ═══════════════════════════════════════════════════════════════

export interface MpCheckoutData {
  publicKey: string;
  paymentId: string;
  amountCop: number;
  reference: string;
  poolId: string;
  preferenceId: string;
}

/**
 * Prepare Mercado Pago checkout data for the Payment Brick.
 * The frontend renders the Brick, collects payment info, and sends it
 * to POST /payments/mp-process which calls processMpPayment().
 */
export async function initiateMpCheckout(
  input: InitiateCheckoutInput,
): Promise<MpCheckoutData> {
  const { userId, poolId, targetCapacity } = input;

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      members: {
        where: { userId, role: { in: ["HOST", "CORPORATE_HOST"] } },
        take: 1,
      },
      organization: { select: { id: true } },
    },
  });

  if (!pool) throw new ServiceError("NOT_FOUND", 404);
  if (pool.members.length === 0) {
    throw new ServiceError("FORBIDDEN", 403, { reason: "Must be HOST or CORPORATE_HOST" });
  }

  const currentCapacity = pool.maxParticipants ?? getFreeLimit(pool.organization ? "corporate" : "personal");
  const poolType: PoolType = pool.organization ? "corporate" : "personal";

  if (targetCapacity <= currentCapacity) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "Target capacity must be greater than current capacity" });
  }

  const amountCop = calculateUpgradePriceCop(poolType, currentCapacity, targetCapacity);
  if (amountCop <= 0) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "No payment required" });
  }

  const amountUsd = calculateUpgradePrice(poolType, currentCapacity, targetCapacity);

  // Idempotency (F-5). Same userId + same pool + same target + currently
  // PENDING + currency=cop. The userId guard prevents a CO_ADMIN from
  // receiving a HOST's pre-created MP preference — wrong amount could be
  // pre-filled on the Brick if the previous attempt had a different
  // target capacity at the time of creation.
  const existingPayment = await prisma.poolPayment.findFirst({
    where: {
      poolId,
      userId,
      status: "PENDING",
      toCapacity: targetCapacity,
      currency: "cop",
    },
    orderBy: { createdAtUtc: "desc" },
  });

  if (existingPayment?.mpPreferenceId && existingPayment.polarCheckoutId) {
    console.log(`[Payments] Reusing existing MP preference ${existingPayment.mpPreferenceId} for payment ${existingPayment.id}`);
    return {
      publicKey: getMpPublicKey(),
      paymentId: existingPayment.id,
      amountCop: existingPayment.amountCop ?? amountCop,
      reference: existingPayment.polarCheckoutId,
      poolId,
      preferenceId: existingPayment.mpPreferenceId,
    };
  }

  // Our own stable identifier — kept in `polarCheckoutId` (the column
  // doubles as gateway-reference for MP rows; see F-8 in POLAR_AUDIT
  // for the rename plan).
  const reference = `P4A-${poolId.slice(0, 8)}-${Date.now()}`;

  // Build URLs for preference
  const frontendUrl = process.env.FRONTEND_URL || "https://picks4all.com";
  const backendUrl = process.env.BACKEND_URL || "https://api.picks4all.com";
  const localePath = input.locale && input.locale !== "es" ? `/${input.locale}` : "";

  // 1. INSERT the PoolPayment row in INITIATED state BEFORE calling MP
  // (F-4 symmetric with Polar). If MP rejects the preference create, the
  // row stays around long enough for the FAILED transition below to
  // record the cause — instead of vanishing into "we never tried".
  const payment = await prisma.poolPayment.create({
    data: {
      poolId,
      userId,
      polarCheckoutId: reference, // our reference is stable from the start; MP only adds the preferenceId after its create call
      mpPreferenceId: null,        // populated after MP accepts
      status: "INITIATED",
      amountUsd: usdToCents(amountUsd),
      amountCop,
      currency: "cop",
      fromCapacity: currentCapacity,
      toCapacity: targetCapacity,
      poolType,
      metaFbp: input.metaFbp,
      metaFbc: input.metaFbc,
      clientIpAddress: input.clientIpAddress,
      clientUserAgent: input.clientUserAgent,
    },
  });

  // 2. Create MP preference. Failure path mirrors the Polar handler:
  // transition to FAILED with an audit event, then re-throw.
  console.log("[Payments] Creating MP preference:", { reference, amountCop, notificationUrl: `${backendUrl}/payments/mp-webhook` });
  let preference: { preferenceId: string };
  try {
    preference = await mpCreatePreference({
      title: `Picks4All — Pool upgrade (${currentCapacity} → ${targetCapacity} players)`,
      unitPrice: amountCop,
      quantity: 1,
      externalReference: reference,
      notificationUrl: `${backendUrl}/payments/mp-webhook`,
      backUrls: {
        success: `${frontendUrl}${localePath}/pago/exitoso?poolId=${poolId}`,
        failure: `${frontendUrl}${localePath}/pago/cancelado?poolId=${poolId}`,
        pending: `${frontendUrl}${localePath}/pago/exitoso?poolId=${poolId}`,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[PaymentService] MP create failed for payment ${payment.id}: ${errorMsg}`);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.poolPayment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
        await tx.paymentEvent.create({
          data: {
            source: PAYMENT_EVENT_SOURCE.SERVER,
            poolPaymentId: payment.id,
            eventType: SERVER_EVENT_TYPE.STATUS_TRANSITION,
            payloadJson: {
              from: "INITIATED",
              to: "FAILED",
              reason: "mp_preference_create_failed",
              error: errorMsg.slice(0, 1000),
            },
          },
        });
      });
    } catch (markErr) {
      console.error(
        `[PaymentService] Failed to mark payment ${payment.id} as FAILED after MP error:`,
        markErr instanceof Error ? markErr.message : String(markErr),
      );
    }
    throw err;
  }
  console.log("[Payments] MP preference created:", { preferenceId: preference.preferenceId, publicKey: getMpPublicKey() ? "SET" : "MISSING" });

  // 3. MP accepted — transition to PENDING + persist preferenceId. Atomic
  // with the audit event so a tx failure leaves no half-state.
  await prisma.$transaction(async (tx) => {
    await tx.poolPayment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING",
        mpPreferenceId: preference.preferenceId,
      },
    });
    await tx.paymentEvent.create({
      data: {
        source: PAYMENT_EVENT_SOURCE.SERVER,
        poolPaymentId: payment.id,
        eventType: SERVER_EVENT_TYPE.STATUS_TRANSITION,
        payloadJson: {
          from: "INITIATED",
          to: "PENDING",
          reason: "mp_preference_created",
          mpPreferenceId: preference.preferenceId,
          reference,
        },
      },
    });
  });

  fireAndForget("audit:mp-checkout-created", writeAuditEvent({
    actorUserId: userId,
    action: "MP_CHECKOUT_CREATED",
    entityType: "Pool",
    entityId: poolId,
    poolId,
    dataJson: { paymentId: payment.id, reference, amountCop, poolType, preferenceId: preference.preferenceId },
  }));

  return {
    publicKey: getMpPublicKey(),
    paymentId: payment.id,
    amountCop,
    reference,
    poolId,
    preferenceId: preference.preferenceId,
  };
}

/**
 * Process a payment from the Payment Brick.
 * Called by POST /payments/mp-process after the Brick collects payment data.
 *
 * The Brick sends formData in MP's native format (snake_case).
 * We enrich it with our reference/description and pass it through
 * to the MP Payment API — matching the official integration pattern.
 */
export interface MpProcessInput {
  paymentId: string; // our PoolPayment ID
  formData: Record<string, unknown>;
  /**
   * Optional Meta cookies forwarded from the browser (`_fbc`, `_fbp`). When
   * present the CAPI event includes them so Meta can stitch server-side
   * conversions back to the original browsing session — critical for
   * attribution on iOS / ITP-restricted browsers.
   */
  metaCookies?: { fbc?: string; fbp?: string };
  /** Request metadata for CAPI user_data enrichment. */
  clientIpAddress?: string;
  clientUserAgent?: string;
  country?: string;
}

export async function processMpPayment(
  input: MpProcessInput,
): Promise<{ status: string; statusDetail: string; mpPaymentId: number; metaEventId?: string }> {
  const { paymentId, formData, metaCookies, clientIpAddress, clientUserAgent, country } = input;

  // Find our payment record
  const payment = await prisma.poolPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new ServiceError("NOT_FOUND", 404);
  if (payment.status === "COMPLETED") throw new ServiceError("ALREADY_COMPLETED", 409);

  // Enrich formData with server-side values (prevent client-side tampering)
  formData.external_reference = payment.polarCheckoutId; // our reference
  formData.description = `Picks4All — Pool capacity upgrade`;
  formData.additional_info = {
    items: [
      {
        id: "pool-capacity-upgrade",
        title: `Pool upgrade (${payment.fromCapacity} → ${payment.toCapacity} players)`,
        description: "Upgrade pool capacity to allow more players",
        category_id: "services",
        quantity: 1,
        // MP expects this in the transaction currency (COP pesos), NOT in
        // USD cents. Using payment.amountUsd here would mismatch the actual
        // formData total and could trip MP's antifraud / consistency checks.
        unit_price: mpPurchaseValue(payment),
      },
    ],
  };

  // Process with Mercado Pago (pass Brick formData directly)
  const result = await mpProcessPaymentDirect(formData);

  console.log(`[PaymentService] MP payment result: id=${result.id}, status=${result.status}, detail=${result.statusDetail}`);

  if (result.status === "approved") {
    // Expand capacity immediately
    await prisma.$transaction(async (tx) => {
      await tx.poolPayment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          polarOrderId: `mp-${result.id}`,
          paidAtUtc: new Date(),
        },
      });
      await tx.pool.update({
        where: { id: payment.poolId },
        data: {
        maxParticipants: payment.toCapacity,
        // Re-arm capacity threshold notifications so the warning + full
        // emails fire again if the pool refills after the expansion.
        poolFullNotifiedAt: null,
        capacityWarningNotifiedAt: null,
      },
      });
    });

    console.log(`[PaymentService] MP: Pool ${payment.poolId} expanded ${payment.fromCapacity} → ${payment.toCapacity}`);

    fireAndForget("audit:mp-payment-completed", writeAuditEvent({
      actorUserId: payment.userId,
      action: "MP_PAYMENT_COMPLETED",
      entityType: "Pool",
      entityId: payment.poolId,
      poolId: payment.poolId,
      dataJson: { mpPaymentId: result.id, status: result.status },
    }));

    const metaEventId = crypto.randomUUID();
    // Persist so the exitoso page (and any IPN re-entry) re-uses the same
    // event_id and Meta deduplicates across emission channels.
    await prisma.poolPayment.update({
      where: { id: payment.id },
      data: { metaEventId },
    });
    const userForCapi = await prisma.user.findUnique({
      where: { id: payment.userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        country: true,
      },
    });
    fireAndForget("capi:purchase-mp", sendCapiEvent({
      eventName: "Purchase",
      eventId: metaEventId,
      userData: {
        externalId: payment.userId,
        email: userForCapi?.email,
        firstName: userForCapi?.firstName ?? undefined,
        lastName: userForCapi?.lastName ?? undefined,
        dateOfBirth: userForCapi?.dateOfBirth?.toISOString().slice(0, 10),
        gender: userForCapi?.gender ?? undefined,
        country: userForCapi?.country ?? country,
        fbp: metaCookies?.fbp,
        fbc: metaCookies?.fbc,
        clientIpAddress,
        clientUserAgent,
      },
      customData: {
        // COP Purchase: value must be the REAL pesos paid, not the USD cents
        // equivalent. `amountCop` is written at checkout creation; fallback
        // to recomputing from the pricing library handles pre-migration
        // rows that still have NULL amountCop.
        value: mpPurchaseValue(payment),
        currency: "COP",
        content_type: "product",
        content_ids: [`pool_upgrade_${payment.poolType}_${payment.toCapacity}`],
        num_items: 1,
      },
    }));

    fireAndForget("ga4mp:purchase-mp", sendGa4Event({
      userId: payment.userId,
      ipOverride: clientIpAddress,
      userAgent: clientUserAgent,
      events: [{
        name: "purchase",
        params: {
          transaction_id: String(result.id),
          affiliation: "Mercado Pago Colombia",
          currency: "COP",
          value: mpPurchaseValue(payment),
          items: [{
            item_id: `pool_upgrade_${payment.poolType}_${payment.toCapacity}`,
            item_name: `Pool capacity upgrade to ${payment.toCapacity}`,
            item_category: "pool_capacity",
            item_variant: payment.poolType,
            price: mpPurchaseValue(payment),
            quantity: 1,
            currency: "COP",
          }],
        },
      }],
    }));

    return { status: result.status, statusDetail: result.statusDetail, mpPaymentId: result.id, metaEventId };
  } else if (result.status === "rejected") {
    await prisma.poolPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    // Monetisation-funnel telemetry. Without this event the funnel
    // drops off at `begin_checkout → add_payment_info` with no
    // signal of *why* — rejected cards / wrong CVV / bank decline
    // are indistinguishable from ragequit cancellations.
    fireAndForget("ga4mp:payment_failed-mp", sendGa4Event({
      userId: payment.userId,
      events: [{
        name: "payment_failed",
        params: {
          transaction_id: String(result.id),
          affiliation: "Mercado Pago Colombia",
          currency: "COP",
          value: mpPurchaseValue(payment),
          reason: result.statusDetail ?? "rejected",
          payment_method: "mercadopago",
        },
      }],
    }));
  }
  // "pending" and "in_process" statuses are handled by IPN webhook later

  return { status: result.status, statusDetail: result.statusDetail, mpPaymentId: result.id };
}

/**
 * Handle Mercado Pago IPN webhook notification.
 * Used for async payment methods (PSE, Nequi) that don't resolve immediately.
 */
export async function handleMpWebhook(paymentMpId: string): Promise<void> {
  // Verify with MP API
  const mpPayment = await mpGetPayment(paymentMpId);
  if (!mpPayment || !mpPayment.external_reference) return;

  const reference = mpPayment.external_reference;

  // Idempotency keyed on (paymentId, status). The MP payment lifecycle emits
  // multiple webhooks per payment (pending → in_process → approved → maybe
  // refunded later). Keying only on paymentId would dedupe ALL webhooks after
  // the first — so a payment that arrived as `pending` first would never see
  // its `approved` webhook processed, leaving the pool stuck in PENDING.
  // Including the status in the key means each transition gets its own slot,
  // while genuine retries of the SAME status (MP re-delivery after our 5xx)
  // still dedupe correctly.
  const eventId = `mp-${paymentMpId}-${mpPayment.status}`;

  // Cheap pre-check (real lock is the partial unique index inside each
  // branch's tx — see note on findFirst in handleOrderPaid).
  const existing = await prisma.paymentEvent.findFirst({
    where: { polarEventId: eventId },
  });
  if (existing) return;

  // findFirst because polarCheckoutId is partial-unique-when-set after
  // the 20260521 migration; ≤1 row per value still guaranteed.
  const payment = await prisma.poolPayment.findFirst({
    where: { polarCheckoutId: reference },
  });
  if (!payment) {
    // Same retryable race as the Polar handlers above. MP IPN can fire for
    // an external_reference whose PoolPayment row is still in the middle
    // of being committed (rare but possible — both writes happen in
    // initiateMpCheckout). Throw to make the route return 5xx so MP's
    // IPN retry policy kicks in. Without this, the previous silent return
    // dropped the COMPLETED transition for a paid order.
    console.error(`[PaymentService] MP IPN: PoolPayment not found for reference ${reference} — signalling retry`);
    throw new Error("PAYMENT_NOT_FOUND_RETRYABLE");
  }

  const isRefundSignal =
    mpPayment.status === "refunded" || mpPayment.status === "charged_back";
  // Approved events are idempotent: if our payment is already COMPLETED,
  // we've already processed the approval. Refund signals are handled below
  // even when the local payment is COMPLETED — that IS the precondition.
  if (!isRefundSignal && payment.status === "COMPLETED") return;

  // Build the PaymentEvent.create payload once — it's the same in every
  // branch and goes INSIDE the branch tx to keep the idempotency slot
  // atomic with the actual state change. If a branch tx rolls back, the
  // slot rolls back with it and MP's retry can re-process cleanly.
  const eventCreateData = {
    source: PAYMENT_EVENT_SOURCE.MP_WEBHOOK,
    polarEventId: eventId,
    poolPaymentId: payment.id,
    eventType: "mp.payment.updated",
    payloadJson: { id: paymentMpId, status: mpPayment.status, reference },
  };

  if (mpPayment.status === "approved") {
    // Re-use the event_id from the sync flow if the browser already fired
    // a Pixel event (dedupe). Otherwise mint a new one and persist it for
    // any future re-entry (rare but possible with MP retries).
    const metaEventId = payment.metaEventId ?? crypto.randomUUID();

    try {
      await prisma.$transaction(async (tx) => {
        await tx.paymentEvent.create({ data: eventCreateData });
        await tx.poolPayment.update({
          where: { id: payment.id },
          data: {
            status: "COMPLETED",
            polarOrderId: `mp-${paymentMpId}`,
            paidAtUtc: new Date(),
            metaEventId,
          },
        });
        await tx.pool.update({
          where: { id: payment.poolId },
          data: {
            maxParticipants: payment.toCapacity,
            // Re-arm capacity threshold notifications so the warning + full
            // emails fire again if the pool refills after the expansion.
            poolFullNotifiedAt: null,
            capacityWarningNotifiedAt: null,
          },
        });
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        console.log(`[PaymentService] Race-condition duplicate MP event ${eventId}, skipping`);
        return;
      }
      throw err;
    }
    console.log(`[PaymentService] MP IPN: Pool ${payment.poolId} expanded ${payment.fromCapacity} → ${payment.toCapacity}`);

    const userForIpnCapi = await prisma.user.findUnique({
      where: { id: payment.userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        country: true,
      },
    });
    fireAndForget("capi:purchase-mp-ipn", sendCapiEvent({
      eventName: "Purchase",
      eventId: metaEventId,
      userData: {
        externalId: payment.userId,
        email: userForIpnCapi?.email,
        firstName: userForIpnCapi?.firstName ?? undefined,
        lastName: userForIpnCapi?.lastName ?? undefined,
        dateOfBirth: userForIpnCapi?.dateOfBirth?.toISOString().slice(0, 10),
        gender: userForIpnCapi?.gender ?? undefined,
        country: userForIpnCapi?.country ?? undefined,
        // Advanced Matching from checkout-time cookies (see schema note).
        fbp: payment.metaFbp ?? undefined,
        fbc: payment.metaFbc ?? undefined,
        clientIpAddress: payment.clientIpAddress ?? undefined,
        clientUserAgent: payment.clientUserAgent ?? undefined,
      },
      customData: {
        value: mpPurchaseValue(payment),
        currency: "COP",
        content_type: "product",
        content_ids: [`pool_upgrade_${payment.poolType}_${payment.toCapacity}`],
        num_items: 1,
      },
    }));

    fireAndForget("ga4mp:purchase-mp-ipn", sendGa4Event({
      userId: payment.userId,
      events: [{
        name: "purchase",
        params: {
          transaction_id: `mp-${paymentMpId}`,
          affiliation: "Mercado Pago Colombia",
          currency: "COP",
          value: mpPurchaseValue(payment),
          items: [{
            item_id: `pool_upgrade_${payment.poolType}_${payment.toCapacity}`,
            item_name: `Pool capacity upgrade to ${payment.toCapacity}`,
            item_category: "pool_capacity",
            item_variant: payment.poolType,
            price: mpPurchaseValue(payment),
            quantity: 1,
            currency: "COP",
          }],
        },
      }],
    }));

    // Send payment receipt to user
    fireAndForget("mp-payment-receipt-email", (async () => {
      const user = await prisma.user.findUnique({
        where: { id: payment.userId },
        select: { email: true, displayName: true, country: true },
      });
      const pool = await prisma.pool.findUnique({
        where: { id: payment.poolId },
        select: { name: true },
      });
      if (!user || !pool) return;
      // amountUsd stores USD cents (e.g. 6597 for $65.97). Using it here
      // would render "$6.597 COP" in the receipt while the customer's bank
      // shows ~$260,000 COP — a ~40x discrepancy that triggers chargebacks.
      // mpPurchaseValue prefers the persisted amountCop column and falls back
      // to recomputing from pricing for pre-migration rows.
      const amountCop = mpPurchaseValue(payment);
      await sendPaymentReceiptEmail({
        to: user.email,
        userId: payment.userId,
        displayName: user.displayName,
        poolName: pool.name,
        poolId: payment.poolId,
        transactionId: `mp-${paymentMpId}`,
        amount: amountCop.toLocaleString("es-CO"),
        currency: "COP",
        fromCapacity: payment.fromCapacity,
        toCapacity: payment.toCapacity,
        paidAt: new Date(),
        locale: resolveUserLocale(user),
      });
    })());
  } else if (mpPayment.status === "rejected" || mpPayment.status === "cancelled") {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.paymentEvent.create({ data: eventCreateData });
        await tx.poolPayment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        console.log(`[PaymentService] Race-condition duplicate MP event ${eventId}, skipping`);
        return;
      }
      throw err;
    }
    fireAndForget("ga4mp:payment_failed-mp-ipn", sendGa4Event({
      userId: payment.userId,
      events: [{
        name: "payment_failed",
        params: {
          transaction_id: `mp-${paymentMpId}`,
          affiliation: "Mercado Pago Colombia",
          currency: "COP",
          value: mpPurchaseValue(payment),
          reason: mpPayment.status_detail ?? mpPayment.status ?? "unknown",
          payment_method: "mercadopago",
        },
      }],
    }));
  } else if (mpPayment.status === "refunded" || mpPayment.status === "charged_back") {
    // Only meaningful if the payment was previously COMPLETED; otherwise
    // there is no revenue to reverse.
    if (payment.status !== "COMPLETED") return;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.paymentEvent.create({ data: eventCreateData });
        await tx.poolPayment.update({
          where: { id: payment.id },
          data: { status: "REFUNDED" },
        });
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        console.log(`[PaymentService] Race-condition duplicate MP event ${eventId}, skipping`);
        return;
      }
      throw err;
    }

    const originalTransactionId = payment.polarOrderId ?? `mp-${paymentMpId}`;

    fireAndForget("audit:mp-payment-refunded", writeAuditEvent({
      actorUserId: payment.userId,
      action: "PAYMENT_REFUNDED",
      entityType: "Pool",
      entityId: payment.poolId,
      poolId: payment.poolId,
      dataJson: { mpPaymentId: paymentMpId, mpStatus: mpPayment.status },
    }));

    // Refund analytics — value MUST be in COP pesos (the transaction currency
    // declared right below). amountUsd would be USD cents and would underreport
    // refunded revenue by ~40x in GA4/Meta dashboards. mpPurchaseValue returns
    // the persisted COP amount or recomputes it from the pricing library.
    const refundValueCop = mpPurchaseValue(payment);

    fireAndForget("ga4mp:refund-mp", sendGa4Event({
      userId: payment.userId,
      events: [{
        name: "refund",
        params: {
          transaction_id: originalTransactionId,
          currency: "COP",
          value: refundValueCop,
          items: [{
            item_id: `pool_upgrade_${payment.poolType}_${payment.toCapacity}`,
            item_name: `Pool capacity upgrade to ${payment.toCapacity}`,
            item_category: "pool_capacity",
            item_variant: payment.poolType,
            price: refundValueCop,
            quantity: 1,
            currency: "COP",
          }],
        },
      }],
    }));

    fireAndForget("capi:refund-mp", sendCapiEvent({
      eventName: "Refund",
      eventId: `${payment.metaEventId ?? originalTransactionId}-refund`,
      userData: { externalId: payment.userId },
      customData: {
        value: refundValueCop,
        currency: "COP",
        content_type: "product",
        content_ids: [`pool_upgrade_${payment.poolType}_${payment.toCapacity}`],
        num_items: 1,
        original_transaction_id: originalTransactionId,
      },
    }));
  }
}
