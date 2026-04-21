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
import { countryToLocale } from "../lib/constants";
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

// ── Types ──────────────────────────────────────────────────────

export interface InitiateCheckoutInput {
  userId: string;
  poolId: string;
  targetCapacity: number;
  locale?: string;
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

  // 4. Check for existing PENDING checkout (idempotency)
  const existingPayment = await prisma.poolPayment.findFirst({
    where: { poolId, status: "PENDING", toCapacity: targetCapacity },
    orderBy: { createdAtUtc: "desc" },
  });

  if (existingPayment) {
    // Return existing checkout URL (reconstruct from Polar)
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
    } catch {
      // Existing checkout may have expired — create a new one below
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

  // 7. Create Polar checkout
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

  const { checkoutId, checkoutUrl } = await polarCreateCheckout(checkoutParams);

  // 8. Create PoolPayment record
  const payment = await prisma.poolPayment.create({
    data: {
      poolId,
      userId,
      polarCheckoutId: checkoutId,
      status: "PENDING",
      amountUsd: amountCents, // stored in cents for precision
      currency: "usd",
      fromCapacity: currentCapacity,
      toCapacity: targetCapacity,
      poolType,
    },
  });

  // 9. Audit
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
 */
export async function handleOrderPaid(payload: {
  data: {
    id: string;
    checkout_id?: string | null;
    metadata?: Record<string, unknown>;
    total_amount?: number;
  };
  type: string;
}): Promise<void> {
  const eventId = payload.data.id;
  const eventType = payload.type || "order.paid";

  // 1. Idempotency check
  const existing = await prisma.paymentEvent.findUnique({
    where: { polarEventId: eventId },
  });
  if (existing) {
    console.log(`[PaymentService] Duplicate event ${eventId}, skipping`);
    return;
  }

  // 2. Record the raw event (immutable audit log)
  // Wrapped in try/catch to handle race condition: two concurrent webhooks
  // may both pass the findUnique check above and attempt to create.
  try {
    await prisma.paymentEvent.create({
      data: {
        polarEventId: eventId,
        eventType,
        payloadJson: JSON.parse(JSON.stringify(payload)),
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      console.log(`[PaymentService] Race-condition duplicate event ${eventId}, skipping`);
      return;
    }
    throw err;
  }

  // 3. Extract metadata
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

  // 4. Find the PoolPayment by checkout ID
  const payment = await prisma.poolPayment.findUnique({
    where: { polarCheckoutId: checkoutId },
  });

  if (!payment) {
    console.error(`[PaymentService] No PoolPayment found for checkout ${checkoutId}`);
    return;
  }

  if (payment.status === "COMPLETED") {
    console.log(`[PaymentService] Payment ${payment.id} already completed, skipping`);
    return;
  }

  // 5. Expand capacity in a transaction
  await prisma.$transaction(async (tx) => {
    // Update payment status
    await tx.poolPayment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        polarOrderId: eventId,
        paidAtUtc: new Date(),
      },
    });

    // Expand pool capacity
    await tx.pool.update({
      where: { id: metadata.poolId! },
      data: { maxParticipants: metadata.toCapacity! },
    });
  });

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

  fireAndForget("admin:payment-completed", sendAdminNotification({
    subject: `Payment completed: pool capacity ${metadata.fromCapacity} → ${metadata.toCapacity}`,
    body: `<p>Pool <strong>${metadata.poolId}</strong> expanded to ${metadata.toCapacity} participants.</p><p>Type: ${metadata.poolType}</p>`,
    type: "feedback",
  }));

  if (metadata.userId) {
    // Stable event_id shared by CAPI and (eventually) the browser Pixel.
    // Persist on the payment row so the success-page pixel emission uses
    // the same ID and Meta deduplicates automatically.
    const metaEventId = crypto.randomUUID();
    await prisma.poolPayment.update({
      where: { id: payment.id },
      data: { metaEventId },
    });
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
        locale: countryToLocale(user.country),
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
export async function handleOrderRefunded(payload: {
  data: {
    id: string;
    checkout_id?: string | null;
    metadata?: Record<string, unknown>;
    total_amount?: number;
  };
  type: string;
}): Promise<void> {
  const eventId = payload.data.id;
  const eventType = payload.type || "order.refunded";

  // Idempotency — refund webhooks can be replayed by Polar.
  const existing = await prisma.paymentEvent.findUnique({
    where: { polarEventId: eventId },
  });
  if (existing) return;

  try {
    await prisma.paymentEvent.create({
      data: {
        polarEventId: eventId,
        eventType,
        payloadJson: JSON.parse(JSON.stringify(payload)),
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") return;
    throw err;
  }

  const checkoutId = payload.data.checkout_id;
  const payment = checkoutId
    ? await prisma.poolPayment.findUnique({ where: { polarCheckoutId: checkoutId } })
    : null;

  if (!payment) {
    console.error(`[PaymentService] order.refunded: no PoolPayment for checkout ${checkoutId}`);
    return;
  }

  if (payment.status === "REFUNDED") {
    console.log(`[PaymentService] Payment ${payment.id} already REFUNDED`);
    return;
  }

  await prisma.poolPayment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED" },
  });

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
 * Process a checkout.updated webhook (for detecting expired/failed checkouts).
 */
export async function handleCheckoutUpdated(payload: {
  data: {
    id: string;
    status?: string;
  };
  type: string;
}): Promise<void> {
  const checkoutId = payload.data.id;
  const checkoutStatus = payload.data.status;

  if (checkoutStatus === "expired" || checkoutStatus === "failed") {
    const payment = await prisma.poolPayment.findUnique({
      where: { polarCheckoutId: checkoutId },
    });

    if (payment && payment.status === "PENDING") {
      await prisma.poolPayment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      console.log(`[PaymentService] Checkout ${checkoutId} ${checkoutStatus}, payment marked FAILED`);
    }
  }
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
  // USD payments are stored in cents (Polar standard). COP payments are
  // stored as whole pesos (no cents in COP). Convert only for USD.
  const amountMajor = currency === "USD" ? payment.amountUsd / 100 : payment.amountUsd;

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
  const reference = `P4A-${poolId.slice(0, 8)}-${Date.now()}`;

  // Build URLs for preference
  const frontendUrl = process.env.FRONTEND_URL || "https://picks4all.com";
  const backendUrl = process.env.BACKEND_URL || "https://api.picks4all.com";
  const localePath = input.locale && input.locale !== "es" ? `/${input.locale}` : "";

  // Create MP preference (required for Payment Brick initialization)
  console.log("[Payments] Creating MP preference:", { reference, amountCop, notificationUrl: `${backendUrl}/payments/mp-webhook` });
  const preference = await mpCreatePreference({
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
  console.log("[Payments] MP preference created:", { preferenceId: preference.preferenceId, publicKey: getMpPublicKey() ? "SET" : "MISSING" });

  const payment = await prisma.poolPayment.create({
    data: {
      poolId,
      userId,
      polarCheckoutId: reference,
      status: "PENDING",
      amountUsd: usdToCents(amountUsd),
      currency: "cop",
      fromCapacity: currentCapacity,
      toCapacity: targetCapacity,
      poolType,
    },
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
        unit_price: payment.amountUsd, // stored in cents but MP wants the COP amount from formData
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
        data: { maxParticipants: payment.toCapacity },
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
        value: payment.amountUsd,
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
          value: payment.amountUsd,
          items: [{
            item_id: `pool_upgrade_${payment.poolType}_${payment.toCapacity}`,
            item_name: `Pool capacity upgrade to ${payment.toCapacity}`,
            item_category: "pool_capacity",
            item_variant: payment.poolType,
            price: payment.amountUsd,
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

  // Idempotency
  const existing = await prisma.paymentEvent.findUnique({
    where: { polarEventId: `mp-${paymentMpId}` },
  });
  if (existing) return;

  try {
    await prisma.paymentEvent.create({
      data: {
        polarEventId: `mp-${paymentMpId}`,
        eventType: "mp.payment.updated",
        payloadJson: { id: paymentMpId, status: mpPayment.status, reference },
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      console.log(`[PaymentService] Race-condition duplicate MP event ${paymentMpId}, skipping`);
      return;
    }
    throw err;
  }

  const payment = await prisma.poolPayment.findUnique({
    where: { polarCheckoutId: reference },
  });
  if (!payment) return;

  const isRefundSignal =
    mpPayment.status === "refunded" || mpPayment.status === "charged_back";
  // Approved events are idempotent: if our payment is already COMPLETED,
  // we've already processed the approval. Refund signals are handled below
  // even when the local payment is COMPLETED — that IS the precondition.
  if (!isRefundSignal && payment.status === "COMPLETED") return;

  if (mpPayment.status === "approved") {
    // Re-use the event_id from the sync flow if the browser already fired
    // a Pixel event (dedupe). Otherwise mint a new one and persist it for
    // any future re-entry (rare but possible with MP retries).
    const metaEventId = payment.metaEventId ?? crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
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
        data: { maxParticipants: payment.toCapacity },
      });
    });
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
      },
      customData: {
        value: payment.amountUsd,
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
          value: payment.amountUsd,
          items: [{
            item_id: `pool_upgrade_${payment.poolType}_${payment.toCapacity}`,
            item_name: `Pool capacity upgrade to ${payment.toCapacity}`,
            item_category: "pool_capacity",
            item_variant: payment.poolType,
            price: payment.amountUsd,
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
      const amountCop = payment.amountUsd;
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
        locale: countryToLocale(user.country),
      });
    })());
  } else if (mpPayment.status === "rejected" || mpPayment.status === "cancelled") {
    await prisma.poolPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
  } else if (mpPayment.status === "refunded" || mpPayment.status === "charged_back") {
    // Only meaningful if the payment was previously COMPLETED; otherwise
    // there is no revenue to reverse.
    if (payment.status !== "COMPLETED") return;
    await prisma.poolPayment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });

    const originalTransactionId = payment.polarOrderId ?? `mp-${paymentMpId}`;

    fireAndForget("audit:mp-payment-refunded", writeAuditEvent({
      actorUserId: payment.userId,
      action: "PAYMENT_REFUNDED",
      entityType: "Pool",
      entityId: payment.poolId,
      poolId: payment.poolId,
      dataJson: { mpPaymentId: paymentMpId, mpStatus: mpPayment.status },
    }));

    fireAndForget("ga4mp:refund-mp", sendGa4Event({
      userId: payment.userId,
      events: [{
        name: "refund",
        params: {
          transaction_id: originalTransactionId,
          currency: "COP",
          value: payment.amountUsd,
          items: [{
            item_id: `pool_upgrade_${payment.poolType}_${payment.toCapacity}`,
            item_name: `Pool capacity upgrade to ${payment.toCapacity}`,
            item_category: "pool_capacity",
            item_variant: payment.poolType,
            price: payment.amountUsd,
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
        value: payment.amountUsd,
        currency: "COP",
        content_type: "product",
        content_ids: [`pool_upgrade_${payment.poolType}_${payment.toCapacity}`],
        num_items: 1,
        original_transaction_id: originalTransactionId,
      },
    }));
  }
}
