import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../db";

// ── Mocks ──────────────────────────────────────────────────────

vi.mock("../db", () => ({
  prisma: {
    paymentEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    poolPayment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    pool: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    poolMember: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../lib/audit", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/email", () => ({
  sendAdminNotification: vi.fn().mockResolvedValue(undefined),
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/asyncHelpers", () => ({
  fireAndForget: vi.fn(),
}));

vi.mock("./polar/client", () => ({
  createCheckout: vi.fn(),
  getCheckoutSession: vi.fn(),
}));

vi.mock("./mercadopago/client", () => ({
  processPaymentDirect: vi.fn(),
  getPayment: vi.fn(),
  getMpPublicKey: vi.fn().mockReturnValue("TEST_MP_KEY"),
  createPreference: vi.fn(),
}));

import {
  handleOrderPaid,
  handleOrderRefunded,
  handleCheckoutUpdated,
  initiateCheckout,
  initiateMpCheckout,
  processMpPayment,
  handleMpWebhook,
  getPaymentStatus,
} from "./paymentService";
import { ServiceError } from "./authService";
import {
  processPaymentDirect as mpProcessPaymentDirect,
  getPayment as mpGetPayment,
  createPreference as mpCreatePreference,
} from "./mercadopago/client";
import { createCheckout as polarCreateCheckout } from "./polar/client";

// ── Helpers ────────────────────────────────────────────────────

function orderPaidPayload(overrides: Partial<{
  id: string;
  checkout_id: string;
  metadata: Record<string, unknown>;
  total_amount: number;
}> = {}) {
  return {
    type: "order.paid",
    data: {
      id: overrides.id ?? "evt_polar_123",
      checkout_id: overrides.checkout_id ?? "chk_polar_456",
      metadata: overrides.metadata ?? {
        poolId: "pool-aaa",
        userId: "user-bbb",
        fromCapacity: 20,
        toCapacity: 50,
        poolType: "personal",
      },
      total_amount: overrides.total_amount ?? 1500,
    },
  };
}

const MOCK_PAYMENT = {
  id: "pay-001",
  poolId: "pool-aaa",
  userId: "user-bbb",
  polarCheckoutId: "chk_polar_456",
  status: "PENDING",
  amountUsd: 1500,
  currency: "usd",
  fromCapacity: 20,
  toCapacity: 50,
  poolType: "personal",
  paidAtUtc: null,
  createdAtUtc: new Date(),
};

// ── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
});

describe("handleOrderPaid", () => {
  it("expands capacity for a new event with valid metadata", async () => {
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.paymentEvent.create as any).mockResolvedValue({});
    (prisma.poolPayment.findUnique as any).mockResolvedValue(MOCK_PAYMENT);
    (prisma.poolPayment.update as any).mockResolvedValue({});
    (prisma.pool.update as any).mockResolvedValue({});

    await handleOrderPaid(orderPaidPayload());

    expect(prisma.paymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ polarEventId: "evt_polar_123" }),
      }),
    );
    expect(prisma.poolPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
    expect(prisma.pool.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maxParticipants: 50,
          // Re-armed so capacity threshold notifications fire again post-expansion.
          poolFullNotifiedAt: null,
          capacityWarningNotifiedAt: null,
        }),
      }),
    );
  });

  it("skips duplicate event (idempotency via findUnique)", async () => {
    (prisma.paymentEvent.findUnique as any).mockResolvedValue({ id: "existing" });

    await handleOrderPaid(orderPaidPayload());

    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
    expect(prisma.poolPayment.update).not.toHaveBeenCalled();
  });

  it("handles race-condition duplicate (P2002 unique constraint inside tx)", async () => {
    // Post-fix: paymentEvent.create runs INSIDE the $transaction. A concurrent
    // webhook that also passed the cheap pre-check will lose the race at the
    // UNIQUE constraint, the tx rolls back atomically (no payment/pool update
    // happens), and we silently skip.
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.poolPayment.findUnique as any).mockResolvedValue(MOCK_PAYMENT);
    const prismaError = new Error("Unique constraint failed");
    (prismaError as any).code = "P2002";
    (prisma.paymentEvent.create as any).mockRejectedValue(prismaError);

    await handleOrderPaid(orderPaidPayload());

    expect(prisma.poolPayment.update).not.toHaveBeenCalled();
    expect(prisma.pool.update).not.toHaveBeenCalled();
  });

  it("commits paymentEvent.create + poolPayment.update + pool.update atomically", async () => {
    // Regression for the bug where paymentEvent.create lived OUTSIDE the tx:
    // a tx failure left the idempotency slot persisted, blocking retries.
    // Now all three writes go through the same tx — verify the create call
    // is mocked through the $transaction passthrough.
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.paymentEvent.create as any).mockResolvedValue({});
    (prisma.poolPayment.findUnique as any).mockResolvedValue(MOCK_PAYMENT);
    (prisma.poolPayment.update as any).mockResolvedValue({});
    (prisma.pool.update as any).mockResolvedValue({});

    await handleOrderPaid(orderPaidPayload());

    // $transaction was invoked exactly once and ran the callback through the
    // mock-passthrough so the inner calls hit the prisma mocks.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.paymentEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.poolPayment.update).toHaveBeenCalledTimes(1);
    expect(prisma.pool.update).toHaveBeenCalledTimes(1);
    // metaEventId is now persisted in the SAME tx update — there is no
    // second poolPayment.update later in the function (post-fix #9 bonus).
    expect(prisma.poolPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          metaEventId: expect.any(String), // userId present in default payload
        }),
      }),
    );
  });

  it("skips when payment is already COMPLETED", async () => {
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.paymentEvent.create as any).mockResolvedValue({});
    (prisma.poolPayment.findUnique as any).mockResolvedValue({
      ...MOCK_PAYMENT,
      status: "COMPLETED",
    });

    await handleOrderPaid(orderPaidPayload());

    expect(prisma.pool.update).not.toHaveBeenCalled();
  });

  it("returns without crash when metadata is missing poolId", async () => {
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.paymentEvent.create as any).mockResolvedValue({});

    await handleOrderPaid(orderPaidPayload({ metadata: {} }));

    expect(prisma.poolPayment.findUnique).not.toHaveBeenCalled();
  });

  it("returns without crash when checkoutId is missing", async () => {
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.paymentEvent.create as any).mockResolvedValue({});

    const payload = orderPaidPayload({ metadata: { poolId: "pool-aaa", toCapacity: 50 } });
    payload.data.checkout_id = null as any;

    await handleOrderPaid(payload);

    expect(prisma.poolPayment.findUnique).not.toHaveBeenCalled();
  });

  it("throws PAYMENT_NOT_FOUND_RETRYABLE when no PoolPayment matches the checkout (race with checkout creation)", async () => {
    // Regression: pre-fix, this returned silently → route returned 200 → Polar
    // dropped the event from its queue and the customer's payment was lost
    // when the webhook beat the row commit. Now we throw so the route returns
    // 5xx and Polar retries — the row will exist on the second attempt.
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.poolPayment.findUnique as any).mockResolvedValue(null);

    await expect(handleOrderPaid(orderPaidPayload())).rejects.toThrow(
      "PAYMENT_NOT_FOUND_RETRYABLE",
    );
    expect(prisma.pool.update).not.toHaveBeenCalled();
    // We must NOT claim the paymentEvent slot in this case — otherwise the
    // retry would dedupe and skip. The throw happens BEFORE we enter the tx.
    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
  });
});

describe("handleOrderRefunded — retryable not-found", () => {
  it("throws PAYMENT_NOT_FOUND_RETRYABLE when no PoolPayment matches the refund's checkoutId", async () => {
    // Same defence as handleOrderPaid: if the refund webhook lands when the
    // PoolPayment row isn't yet committed (or the checkoutId is malformed
    // in transit), throw to trigger retry rather than silently dropping
    // the refund signal.
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.poolPayment.findUnique as any).mockResolvedValue(null);

    await expect(
      handleOrderRefunded({
        type: "order.refunded",
        data: { id: "evt_refund_123", checkout_id: "chk_unknown" },
      }),
    ).rejects.toThrow("PAYMENT_NOT_FOUND_RETRYABLE");
  });
});

describe("handleCheckoutUpdated", () => {
  it("marks payment as FAILED when checkout expires", async () => {
    (prisma.poolPayment.findUnique as any).mockResolvedValue(MOCK_PAYMENT);
    (prisma.poolPayment.update as any).mockResolvedValue({});

    await handleCheckoutUpdated({
      type: "checkout.updated",
      data: { id: "chk_polar_456", status: "expired" },
    });

    expect(prisma.poolPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "FAILED" },
      }),
    );
  });

  it("does nothing when checkout status is not expired/failed", async () => {
    await handleCheckoutUpdated({
      type: "checkout.updated",
      data: { id: "chk_polar_456", status: "confirmed" },
    });

    expect(prisma.poolPayment.findUnique).not.toHaveBeenCalled();
  });
});

describe("initiateCheckout", () => {
  it("throws FORBIDDEN when user is not HOST", async () => {
    (prisma.pool.findUnique as any).mockResolvedValue({
      id: "pool-aaa",
      maxParticipants: 20,
      members: [],
      organization: null,
    });

    await expect(
      initiateCheckout({ userId: "user-bbb", poolId: "pool-aaa", targetCapacity: 50 }),
    ).rejects.toThrow(ServiceError);

    try {
      await initiateCheckout({ userId: "user-bbb", poolId: "pool-aaa", targetCapacity: 50 });
    } catch (err) {
      expect((err as ServiceError).code).toBe("FORBIDDEN");
    }
  });

  it("throws VALIDATION_ERROR when targetCapacity <= current", async () => {
    (prisma.pool.findUnique as any).mockResolvedValue({
      id: "pool-aaa",
      maxParticipants: 50,
      members: [{ userId: "user-bbb", role: "HOST" }],
      organization: null,
    });

    await expect(
      initiateCheckout({ userId: "user-bbb", poolId: "pool-aaa", targetCapacity: 50 }),
    ).rejects.toThrow(ServiceError);

    try {
      await initiateCheckout({ userId: "user-bbb", poolId: "pool-aaa", targetCapacity: 50 });
    } catch (err) {
      expect((err as ServiceError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("reuses existing PENDING checkout when one exists", async () => {
    (prisma.pool.findUnique as any).mockResolvedValue({
      id: "pool-aaa",
      maxParticipants: 20,
      members: [{ userId: "user-bbb", role: "HOST" }],
      organization: null,
    });
    (prisma.poolPayment.findFirst as any).mockResolvedValue({
      ...MOCK_PAYMENT,
      polarCheckoutId: "chk_existing",
    });

    const { getCheckoutSession } = await import("./polar/client");
    (getCheckoutSession as any).mockResolvedValue({ url: "https://polar.sh/checkout/existing" });

    const result = await initiateCheckout({
      userId: "user-bbb",
      poolId: "pool-aaa",
      targetCapacity: 50,
    });

    expect(result.checkoutUrl).toBe("https://polar.sh/checkout/existing");
    expect(polarCreateCheckout).not.toHaveBeenCalled();
  });
});

describe("processMpPayment", () => {
  it("expands capacity when payment is approved", async () => {
    (prisma.poolPayment.findUnique as any).mockResolvedValue(MOCK_PAYMENT);
    (mpProcessPaymentDirect as any).mockResolvedValue({
      id: 12345,
      status: "approved",
      statusDetail: "accredited",
    });
    (prisma.poolPayment.update as any).mockResolvedValue({});
    (prisma.pool.update as any).mockResolvedValue({});

    const result = await processMpPayment({
      paymentId: "pay-001",
      formData: { token: "tok_123" },
    });

    expect(result.status).toBe("approved");
    expect(prisma.poolPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
    expect(prisma.pool.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maxParticipants: 50,
          // Re-armed so capacity threshold notifications fire again post-expansion.
          poolFullNotifiedAt: null,
          capacityWarningNotifiedAt: null,
        }),
      }),
    );
  });

  it("marks payment as FAILED when rejected", async () => {
    (prisma.poolPayment.findUnique as any).mockResolvedValue(MOCK_PAYMENT);
    (mpProcessPaymentDirect as any).mockResolvedValue({
      id: 12345,
      status: "rejected",
      statusDetail: "cc_rejected_other_reason",
    });
    (prisma.poolPayment.update as any).mockResolvedValue({});

    const result = await processMpPayment({
      paymentId: "pay-001",
      formData: { token: "tok_123" },
    });

    expect(result.status).toBe("rejected");
    expect(prisma.poolPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "FAILED" },
      }),
    );
    expect(prisma.pool.update).not.toHaveBeenCalled();
  });
});

describe("initiateMpCheckout (idempotency)", () => {
  const HOST_POOL = {
    id: "pool-aaa",
    maxParticipants: 2,
    members: [{ userId: "user-bbb", role: "CORPORATE_HOST" }],
    organization: { id: "org-zzz" },
  };

  it("REUSES existing PENDING payment + MP preference instead of creating a duplicate", async () => {
    // Regression for the bug where doube-clicking "Pagar" produced two
    // PoolPayment rows + two MP preferences for the same poolId/target —
    // racing the customer into paying twice. Mirror of the Polar
    // initiateCheckout idempotency block (already tested at line ~283).
    (prisma.pool.findUnique as any).mockResolvedValue(HOST_POOL);
    (prisma.poolPayment.findFirst as any).mockResolvedValue({
      id: "existing-mp-payment",
      polarCheckoutId: "P4A-pool-aaa-existing",
      mpPreferenceId: "pref-existing-123",
      amountCop: 200000,
      status: "PENDING",
      toCapacity: 100,
      currency: "cop",
    });

    const result = await initiateMpCheckout({
      userId: "user-bbb",
      poolId: "pool-aaa",
      targetCapacity: 100,
    });

    expect(result.preferenceId).toBe("pref-existing-123");
    expect(result.paymentId).toBe("existing-mp-payment");
    // Crucially: NO new MP preference was created and NO new PoolPayment row.
    expect(mpCreatePreference).not.toHaveBeenCalled();
    expect(prisma.poolPayment.create).not.toHaveBeenCalled();
  });

  it("creates a new payment + persists mpPreferenceId when no PENDING exists", async () => {
    (prisma.pool.findUnique as any).mockResolvedValue(HOST_POOL);
    (prisma.poolPayment.findFirst as any).mockResolvedValue(null);
    (mpCreatePreference as any).mockResolvedValue({ preferenceId: "pref-new-456" });
    (prisma.poolPayment.create as any).mockResolvedValue({
      id: "new-mp-payment",
      polarCheckoutId: "P4A-pool-aaa-new",
      mpPreferenceId: "pref-new-456",
    });

    const result = await initiateMpCheckout({
      userId: "user-bbb",
      poolId: "pool-aaa",
      targetCapacity: 100,
    });

    expect(mpCreatePreference).toHaveBeenCalledTimes(1);
    expect(prisma.poolPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mpPreferenceId: "pref-new-456",
        }),
      }),
    );
    expect(result.preferenceId).toBe("pref-new-456");
  });

  it("if existing PENDING has mpPreferenceId=null (legacy row), creates a fresh preference", async () => {
    // Pre-migration rows lack mpPreferenceId. We can't reuse them safely
    // (no preference to point the Brick at), so we treat them as if they
    // didn't exist and create a new payment. Acceptable: legacy rows are
    // a finite, one-time set; new rows always have the column populated.
    (prisma.pool.findUnique as any).mockResolvedValue(HOST_POOL);
    (prisma.poolPayment.findFirst as any).mockResolvedValue({
      id: "legacy-mp-payment",
      polarCheckoutId: "P4A-pool-aaa-legacy",
      mpPreferenceId: null, // pre-migration
      amountCop: 200000,
      status: "PENDING",
      toCapacity: 100,
      currency: "cop",
    });
    (mpCreatePreference as any).mockResolvedValue({ preferenceId: "pref-fresh-789" });
    (prisma.poolPayment.create as any).mockResolvedValue({
      id: "new-mp-payment",
      mpPreferenceId: "pref-fresh-789",
    });

    const result = await initiateMpCheckout({
      userId: "user-bbb",
      poolId: "pool-aaa",
      targetCapacity: 100,
    });

    expect(mpCreatePreference).toHaveBeenCalledTimes(1);
    expect(prisma.poolPayment.create).toHaveBeenCalledTimes(1);
    expect(result.preferenceId).toBe("pref-fresh-789");
  });
});

describe("handleMpWebhook", () => {
  it("expands capacity when MP IPN reports approved payment", async () => {
    (mpGetPayment as any).mockResolvedValue({
      status: "approved",
      external_reference: "P4A-pool-aaa-12345",
    });
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.paymentEvent.create as any).mockResolvedValue({});
    (prisma.poolPayment.findUnique as any).mockResolvedValue(MOCK_PAYMENT);
    (prisma.poolPayment.update as any).mockResolvedValue({});
    (prisma.pool.update as any).mockResolvedValue({});
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await handleMpWebhook("mp-payment-999");

    expect(prisma.poolPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
    expect(prisma.pool.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maxParticipants: 50,
          // Re-armed so capacity threshold notifications fire again post-expansion.
          poolFullNotifiedAt: null,
          capacityWarningNotifiedAt: null,
        }),
      }),
    );
  });

  it("handles race-condition duplicate (P2002) inside the approved-branch tx", async () => {
    // Post-fix #9: the paymentEvent.create call now happens INSIDE the same
    // tx as the poolPayment + pool updates. A concurrent webhook losing the
    // UNIQUE-constraint race causes the tx to roll back atomically — neither
    // payment nor pool gets touched, and we silently skip.
    (mpGetPayment as any).mockResolvedValue({
      status: "approved",
      external_reference: "P4A-pool-aaa-12345",
    });
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.poolPayment.findUnique as any).mockResolvedValue(MOCK_PAYMENT);
    const prismaError = new Error("Unique constraint failed");
    (prismaError as any).code = "P2002";
    (prisma.paymentEvent.create as any).mockRejectedValue(prismaError);

    await handleMpWebhook("mp-payment-999");

    expect(prisma.poolPayment.update).not.toHaveBeenCalled();
    expect(prisma.pool.update).not.toHaveBeenCalled();
  });

  it("eventId includes mpPayment.status — different statuses are distinct events", async () => {
    // Regression: previous eventId was `mp-${paymentMpId}` only. The first
    // webhook (often `pending` or `in_process` for PSE/Nequi) consumed that
    // single slot, and a later `approved` webhook for the same payment was
    // dedup-skipped, leaving the pool stuck in PENDING forever.
    (mpGetPayment as any).mockResolvedValue({
      status: "approved",
      external_reference: "P4A-pool-aaa-12345",
    });
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.paymentEvent.create as any).mockResolvedValue({});
    (prisma.poolPayment.findUnique as any).mockResolvedValue(MOCK_PAYMENT);
    (prisma.poolPayment.update as any).mockResolvedValue({});
    (prisma.pool.update as any).mockResolvedValue({});
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await handleMpWebhook("mp-payment-999");

    expect(prisma.paymentEvent.findUnique).toHaveBeenCalledWith({
      where: { polarEventId: "mp-mp-payment-999-approved" },
    });
    expect(prisma.paymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ polarEventId: "mp-mp-payment-999-approved" }),
      }),
    );
  });

  it("an intermediate `pending` webhook is dedup-independent from a later `approved` one", async () => {
    // Walk-through:
    //   1) Webhook arrives, MP returns status=pending
    //      eventId="mp-X-pending", findUnique→null, create succeeds, no expansion
    //   2) Webhook arrives later, MP returns status=approved
    //      eventId="mp-X-approved", findUnique→null (different key!), create
    //      succeeds, expansion runs ✓
    // We assert step 2 expands even though step 1 already wrote a row. The
    // bug we're fixing was: step 2's findUnique HIT step 1's row and returned.

    // ── Step 1: pending webhook ────────────────────────────────────────
    (mpGetPayment as any).mockResolvedValueOnce({
      status: "pending",
      external_reference: "P4A-pool-aaa-12345",
    });
    (prisma.paymentEvent.findUnique as any).mockResolvedValueOnce(null);
    (prisma.paymentEvent.create as any).mockResolvedValueOnce({});
    (prisma.poolPayment.findUnique as any).mockResolvedValueOnce({
      ...MOCK_PAYMENT,
      status: "PENDING",
    });
    // No pool.update or poolPayment.update in step 1 (pending falls through).

    await handleMpWebhook("mp-payment-777");

    expect(prisma.pool.update).not.toHaveBeenCalled();
    expect(prisma.poolPayment.update).not.toHaveBeenCalled();

    // ── Step 2: approved webhook for the SAME payment ──────────────────
    (mpGetPayment as any).mockResolvedValueOnce({
      status: "approved",
      external_reference: "P4A-pool-aaa-12345",
    });
    // Critical: the find for the new eventId returns null even though the
    // pending eventId is "stored". With the old single-key scheme this would
    // have hit the existing row and returned without doing anything.
    (prisma.paymentEvent.findUnique as any).mockResolvedValueOnce(null);
    (prisma.paymentEvent.create as any).mockResolvedValueOnce({});
    (prisma.poolPayment.findUnique as any).mockResolvedValueOnce(MOCK_PAYMENT);
    (prisma.poolPayment.update as any).mockResolvedValueOnce({});
    (prisma.pool.update as any).mockResolvedValueOnce({});
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await handleMpWebhook("mp-payment-777");

    expect(prisma.paymentEvent.findUnique).toHaveBeenLastCalledWith({
      where: { polarEventId: "mp-mp-payment-777-approved" },
    });
    expect(prisma.poolPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
    expect(prisma.pool.update).toHaveBeenCalled();
  });

  it("throws PAYMENT_NOT_FOUND_RETRYABLE when no PoolPayment matches the MP external_reference", async () => {
    // Same retryable-race defence as the Polar handlers. MP IPN can fire
    // for a reference whose PoolPayment row hasn't been committed yet
    // (rare, but possible). The pre-fix `if (!payment) return;` would
    // silently swallow the COMPLETED transition for a paid order.
    (mpGetPayment as any).mockResolvedValue({
      status: "approved",
      external_reference: "P4A-orphan-reference",
    });
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.poolPayment.findUnique as any).mockResolvedValue(null);

    await expect(handleMpWebhook("mp-payment-orphan")).rejects.toThrow(
      "PAYMENT_NOT_FOUND_RETRYABLE",
    );
    // Critical: we must NOT have claimed a PaymentEvent slot — otherwise
    // the retry would dedupe and skip. The throw happens BEFORE we enter
    // the per-status tx (which is where paymentEvent.create runs).
    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
    expect(prisma.poolPayment.update).not.toHaveBeenCalled();
  });
});

describe("getPaymentStatus", () => {
  it("returns null when no payment exists", async () => {
    (prisma.poolMember.findFirst as any).mockResolvedValue({ id: "member-1" });
    (prisma.poolPayment.findFirst as any).mockResolvedValue(null);

    const result = await getPaymentStatus("user-bbb", "pool-aaa");
    expect(result).toBeNull();
  });

  it("throws FORBIDDEN when user is not an active pool member", async () => {
    (prisma.poolMember.findFirst as any).mockResolvedValue(null);

    await expect(getPaymentStatus("user-bbb", "pool-aaa")).rejects.toThrow(ServiceError);
  });
});
