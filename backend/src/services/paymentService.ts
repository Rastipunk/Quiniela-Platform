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

import { prisma } from "../db";
import { ServiceError } from "./authService";
import { writeAuditEvent } from "../lib/audit";
import { sendAdminNotification, sendPaymentReceiptEmail } from "../lib/email";
import { countryToLocale } from "../lib/constants";
import { fireAndForget } from "../lib/asyncHelpers";
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
  amountUsd: number;
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
  await prisma.paymentEvent.create({
    data: {
      polarEventId: eventId,
      eventType,
      payloadJson: JSON.parse(JSON.stringify(payload)),
    },
  });

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

  return {
    status: payment.status,
    fromCapacity: payment.fromCapacity,
    toCapacity: payment.toCapacity,
    amountUsd: payment.amountUsd / 100, // cents to dollars
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
export async function processMpPayment(input: {
  paymentId: string; // our PoolPayment ID
  formData: Record<string, unknown>;
}): Promise<{ status: string; statusDetail: string; mpPaymentId: number }> {
  const { paymentId, formData } = input;

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

  await prisma.paymentEvent.create({
    data: {
      polarEventId: `mp-${paymentMpId}`,
      eventType: "mp.payment.updated",
      payloadJson: { id: paymentMpId, status: mpPayment.status, reference },
    },
  });

  const payment = await prisma.poolPayment.findUnique({
    where: { polarCheckoutId: reference },
  });
  if (!payment || payment.status === "COMPLETED") return;

  if (mpPayment.status === "approved") {
    await prisma.$transaction(async (tx) => {
      await tx.poolPayment.update({
        where: { id: payment.id },
        data: { status: "COMPLETED", polarOrderId: `mp-${paymentMpId}`, paidAtUtc: new Date() },
      });
      await tx.pool.update({
        where: { id: payment.poolId },
        data: { maxParticipants: payment.toCapacity },
      });
    });
    console.log(`[PaymentService] MP IPN: Pool ${payment.poolId} expanded ${payment.fromCapacity} → ${payment.toCapacity}`);

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
  }
}
