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
import { sendAdminNotification } from "../lib/email";
import { fireAndForget } from "../lib/asyncHelpers";
import {
  calculateUpgradePrice,
  usdToCents,
  getFreeLimit,
  type PoolType,
} from "../lib/pricing";
import {
  createCheckout as polarCreateCheckout,
  type CreateCheckoutParams,
} from "./polar/client";

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
