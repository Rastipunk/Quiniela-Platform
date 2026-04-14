/**
 * Wompi API Client
 *
 * HTTP client for Wompi (Colombia payment gateway).
 * Handles integrity signature generation and transaction verification.
 * Wompi uses a widget-based checkout (embedded in frontend), not a redirect.
 *
 * Flow:
 * 1. Backend generates integrity signature (SHA256)
 * 2. Frontend opens Wompi widget with signature + public key
 * 3. User completes payment in widget
 * 4. Wompi sends webhook (transaction.updated) to our backend
 * 5. Backend verifies checksum and processes the payment
 */

import crypto from "crypto";

// ── Configuration ──────────────────────────────────────────────

const WOMPI_PUBLIC_KEY = (): string => process.env.WOMPI_PUBLIC_KEY || "";
const WOMPI_PRIVATE_KEY = (): string => process.env.WOMPI_PRIVATE_KEY || "";
const WOMPI_INTEGRITY_SECRET = (): string => process.env.WOMPI_INTEGRITY_SECRET || "";
const WOMPI_EVENTS_SECRET = (): string => process.env.WOMPI_EVENTS_SECRET || "";

const WOMPI_API_BASE = (): string => {
  const key = WOMPI_PUBLIC_KEY();
  // Sandbox keys start with pub_test_, production with pub_prod_
  return key.startsWith("pub_test_")
    ? "https://sandbox.wompi.co/v1"
    : "https://production.wompi.co/v1";
};

/** Check if Wompi is configured */
export function isWompiConfigured(): boolean {
  return !!WOMPI_PUBLIC_KEY() && !!WOMPI_INTEGRITY_SECRET() && !!WOMPI_EVENTS_SECRET();
}

/** Get public key for frontend widget */
export function getWompiPublicKey(): string {
  return WOMPI_PUBLIC_KEY();
}

// ── Integrity Signature ────────────────────────────────────────

/**
 * Generate the integrity signature for a Wompi checkout.
 * SHA256 of: reference + amountInCents + currency + integritySecret
 *
 * This is computed server-side and sent to the frontend to initialize
 * the Wompi widget. It prevents amount tampering.
 */
export function generateIntegritySignature(params: {
  reference: string;
  amountInCents: number;
  currency: string;
}): string {
  const { reference, amountInCents, currency } = params;
  const secret = WOMPI_INTEGRITY_SECRET();
  const raw = `${reference}${amountInCents}${currency}${secret}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ── Webhook Verification ───────────────────────────────────────

/**
 * Verify a Wompi webhook event checksum.
 *
 * Wompi's verification algorithm:
 * 1. Read the `signature.properties` array from the event
 * 2. Extract the values from `data` using dot-notation paths
 * 3. Concatenate: values + signature.timestamp + events_secret
 * 4. SHA256 hash and compare to signature.checksum
 */
export function verifyWebhookChecksum(event: {
  data: Record<string, unknown>;
  signature: {
    properties: string[];
    timestamp: number;
    checksum: string;
  };
}): boolean {
  const secret = WOMPI_EVENTS_SECRET();
  const { properties, timestamp, checksum } = event.signature;

  // Extract values from data using dot-notation paths
  let concatenated = "";
  for (const prop of properties) {
    const value = getNestedValue(event.data, prop);
    concatenated += String(value);
  }

  // Append timestamp and secret
  concatenated += timestamp + secret;

  // SHA256 and compare
  const computed = crypto.createHash("sha256").update(concatenated).digest("hex");
  return computed.toUpperCase() === checksum.toUpperCase();
}

/** Get a nested value from an object using dot-notation path (e.g. "transaction.id") */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ── Transaction Verification ───────────────────────────────────

/**
 * Verify a transaction status by querying Wompi's API.
 * Used as a secondary verification after webhook.
 */
export async function getTransaction(transactionId: string): Promise<{
  id: string;
  status: string;
  amount_in_cents: number;
  reference: string;
  currency: string;
  payment_method_type: string;
}> {
  const res = await fetch(`${WOMPI_API_BASE()}/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${WOMPI_PRIVATE_KEY()}` },
  });

  if (!res.ok) {
    throw new Error(`Wompi API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json() as { data: { id: string; status: string; amount_in_cents: number; reference: string; currency: string; payment_method_type: string } };
  return json.data;
}
