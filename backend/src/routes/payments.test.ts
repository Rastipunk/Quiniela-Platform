import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import type { Request, Response } from "express";

// ── Mocks ──────────────────────────────────────────────────────

vi.mock("../services/paymentService", () => ({
  handleOrderPaid: vi.fn().mockResolvedValue(undefined),
  handleCheckoutUpdated: vi.fn().mockResolvedValue(undefined),
  handleMpWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("standardwebhooks", () => {
  class MockWebhook {
    verify(_body: string, headers: Record<string, string>) {
      if (headers["webhook-signature"] === "valid-sig") {
        return { type: "order.paid", data: { id: "evt_123" } };
      }
      throw new Error("Invalid signature");
    }
  }
  return { Webhook: MockWebhook };
});

import { createWebhookHandler, createMpWebhookHandler } from "./payments";

// ── Helpers ────────────────────────────────────────────────────

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function mockReq(overrides: Partial<{
  body: unknown;
  headers: Record<string, string>;
  query: Record<string, string>;
}>): Request {
  return {
    body: overrides.body ?? {},
    headers: overrides.headers ?? {},
    query: overrides.query ?? {},
    get: vi.fn(),
  } as unknown as Request;
}

// ── Polar Webhook Tests ────────────────────────────────────────

describe("Polar webhook (createWebhookHandler)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 when POLAR_WEBHOOK_SECRET is not set", () => {
    delete process.env.POLAR_WEBHOOK_SECRET;

    // Re-import to pick up env change
    const handler = createWebhookHandler();
    const res = mockRes();
    handler(mockReq({}), res);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("returns 401 for invalid signature", async () => {
    process.env.POLAR_WEBHOOK_SECRET = "test-secret";

    // Need to re-import with the secret set
    const { createWebhookHandler: freshCreate } = await import("./payments");
    const handler = freshCreate();
    const res = mockRes();

    await handler(
      mockReq({
        body: Buffer.from(JSON.stringify({ type: "order.paid" })),
        headers: {
          "webhook-id": "wh_123",
          "webhook-timestamp": "12345",
          "webhook-signature": "invalid-sig",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 200 for valid signature", async () => {
    process.env.POLAR_WEBHOOK_SECRET = "test-secret";

    const { createWebhookHandler: freshCreate } = await import("./payments");
    const handler = freshCreate();
    const res = mockRes();

    await handler(
      mockReq({
        body: Buffer.from(JSON.stringify({ type: "order.paid", data: { id: "evt_123" } })),
        headers: {
          "webhook-id": "wh_123",
          "webhook-timestamp": "12345",
          "webhook-signature": "valid-sig",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── Mercado Pago Webhook Tests ─────────────────────────────────

describe("MP webhook (createMpWebhookHandler)", () => {
  const MP_SECRET = "mp-webhook-secret-test";

  function computeMpSignature(dataId: string | undefined, requestId: string, ts: string, secret: string) {
    let manifest = "";
    if (dataId) manifest += `id:${dataId};`;
    manifest += `request-id:${requestId};`;
    manifest += `ts:${ts};`;
    const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    return `ts=${ts},v1=${hash}`;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when MP_WEBHOOK_SECRET is not set", async () => {
    delete process.env.MP_WEBHOOK_SECRET;

    const handler = createMpWebhookHandler();
    const res = mockRes();

    await handler(
      mockReq({
        body: { type: "payment", data: { id: "123" } },
        headers: {},
        query: {},
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when x-signature header is missing", async () => {
    process.env.MP_WEBHOOK_SECRET = MP_SECRET;

    const handler = createMpWebhookHandler();
    const res = mockRes();

    await handler(
      mockReq({
        body: { type: "payment", data: { id: "123" } },
        headers: {},
        query: { "data.id": "123" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 for invalid signature", async () => {
    process.env.MP_WEBHOOK_SECRET = MP_SECRET;

    const handler = createMpWebhookHandler();
    const res = mockRes();

    await handler(
      mockReq({
        body: { type: "payment", data: { id: "123" } },
        headers: {
          "x-signature": "ts=12345,v1=badhash",
          "x-request-id": "req-1",
        },
        query: { "data.id": "123" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 200 for valid HMAC signature", async () => {
    process.env.MP_WEBHOOK_SECRET = MP_SECRET;

    const ts = String(Date.now());
    const requestId = "req-valid-1";
    const dataId = "mp-pay-456";
    const xSignature = computeMpSignature(dataId, requestId, ts, MP_SECRET);

    const handler = createMpWebhookHandler();
    const res = mockRes();

    await handler(
      mockReq({
        body: { type: "payment", data: { id: dataId } },
        headers: {
          "x-signature": xSignature,
          "x-request-id": requestId,
        },
        query: { "data.id": dataId },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
