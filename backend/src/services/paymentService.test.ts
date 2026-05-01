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
  handleCheckoutUpdated,
  initiateCheckout,
  processMpPayment,
  handleMpWebhook,
  getPaymentStatus,
} from "./paymentService";
import { ServiceError } from "./authService";
import {
  processPaymentDirect as mpProcessPaymentDirect,
  getPayment as mpGetPayment,
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

  it("handles race-condition duplicate (P2002 unique constraint)", async () => {
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    const prismaError = new Error("Unique constraint failed");
    (prismaError as any).code = "P2002";
    (prisma.paymentEvent.create as any).mockRejectedValue(prismaError);

    await handleOrderPaid(orderPaidPayload());

    expect(prisma.poolPayment.update).not.toHaveBeenCalled();
    expect(prisma.pool.update).not.toHaveBeenCalled();
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

  it("returns without crash when no PoolPayment found for checkout", async () => {
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    (prisma.paymentEvent.create as any).mockResolvedValue({});
    (prisma.poolPayment.findUnique as any).mockResolvedValue(null);

    await handleOrderPaid(orderPaidPayload());

    expect(prisma.pool.update).not.toHaveBeenCalled();
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

  it("handles race-condition duplicate (P2002) in MP webhook", async () => {
    (mpGetPayment as any).mockResolvedValue({
      status: "approved",
      external_reference: "P4A-pool-aaa-12345",
    });
    (prisma.paymentEvent.findUnique as any).mockResolvedValue(null);
    const prismaError = new Error("Unique constraint failed");
    (prismaError as any).code = "P2002";
    (prisma.paymentEvent.create as any).mockRejectedValue(prismaError);

    await handleMpWebhook("mp-payment-999");

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
