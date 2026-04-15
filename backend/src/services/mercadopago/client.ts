/**
 * Mercado Pago API Client
 *
 * Uses the official mercadopago SDK for Checkout Bricks.
 * Payment Brick renders embedded in the frontend — the backend
 * processes payments via the Payment API after the Brick collects
 * card/payment data from the user.
 *
 * Flow:
 * 1. Frontend renders Payment Brick with public key
 * 2. User fills payment info in the Brick
 * 3. Brick's onSubmit sends payment data to our backend
 * 4. Backend calls MP Payment API to create/process the payment
 * 5. Backend updates pool capacity on approval
 */

import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

// ── Configuration ──────────────────────────────────────────────

const MP_ACCESS_TOKEN = (): string => process.env.MP_ACCESS_TOKEN || "";
const MP_PUBLIC_KEY = (): string => process.env.MP_PUBLIC_KEY || "";

let _client: MercadoPagoConfig | null = null;

function getClient(): MercadoPagoConfig {
  if (!_client) {
    const token = MP_ACCESS_TOKEN();
    if (!token) throw new Error("MP_ACCESS_TOKEN not configured");
    _client = new MercadoPagoConfig({ accessToken: token });
  }
  return _client;
}

/** Check if Mercado Pago is configured */
export function isMercadoPagoConfigured(): boolean {
  return !!MP_ACCESS_TOKEN() && !!MP_PUBLIC_KEY();
}

/** Get public key for frontend Brick initialization */
export function getMpPublicKey(): string {
  return MP_PUBLIC_KEY();
}

// ── Preference (for Checkout Pro fallback) ─────────────────────

export interface CreatePreferenceParams {
  title: string;
  unitPrice: number; // COP
  quantity: number;
  externalReference: string;
  notificationUrl: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
}

/**
 * Create a preference for Checkout Pro (redirect fallback).
 * Returns init_point URL for redirect and sandbox_init_point for testing.
 */
export async function createPreference(params: CreatePreferenceParams) {
  const client = getClient();
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [
        {
          id: "pool-capacity-upgrade",
          title: params.title,
          description: "Upgrade pool capacity to allow more players",
          unit_price: params.unitPrice,
          quantity: params.quantity,
          currency_id: "COP",
          category_id: "services",
        },
      ],
      external_reference: params.externalReference,
      notification_url: params.notificationUrl,
      back_urls: params.backUrls,
      auto_return: "approved",
    },
  });

  return {
    preferenceId: result.id!,
    initPoint: result.init_point!,
    sandboxInitPoint: result.sandbox_init_point!,
  };
}

// ── Payment Processing ─────────────────────────────────────────

export interface ProcessPaymentParams {
  token?: string;
  paymentMethodId: string;
  issuerId?: string;
  transactionAmount: number; // COP
  installments: number;
  payer: {
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  externalReference: string;
  description: string;
  additionalInfo?: Record<string, unknown>;
}

/**
 * Process a payment from Payment Brick data (legacy camelCase mapping).
 * Called after the Brick collects card/payment info from the user.
 */
export async function processPayment(params: ProcessPaymentParams) {
  const client = getClient();
  const payment = new Payment(client);

  const result = await payment.create({
    body: {
      token: params.token,
      payment_method_id: params.paymentMethodId,
      issuer_id: params.issuerId ? Number(params.issuerId) : undefined,
      transaction_amount: params.transactionAmount,
      installments: params.installments || 1,
      payer: {
        email: params.payer.email,
        identification: params.payer.identification,
      },
      external_reference: params.externalReference,
      description: params.description,
    },
  });

  return {
    id: result.id!,
    status: result.status!,
    statusDetail: result.status_detail!,
    externalReference: result.external_reference,
  };
}

/**
 * Process a payment passing the Brick's formData directly.
 * The Payment Brick sends data in MP's native snake_case format,
 * which matches the Payment API expected format — no mapping needed.
 */
export async function processPaymentDirect(formData: Record<string, unknown>) {
  const client = getClient();
  const payment = new Payment(client);

  const result = await payment.create({
    body: formData as Parameters<Payment["create"]>[0]["body"],
  });

  return {
    id: result.id!,
    status: result.status!,
    statusDetail: result.status_detail!,
    externalReference: result.external_reference,
  };
}

/**
 * Get a payment by ID (for webhook verification).
 */
export async function getPayment(paymentId: string) {
  const client = getClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}
