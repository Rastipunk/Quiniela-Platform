/**
 * Meta Conversion API (CAPI) client.
 *
 * Hashes PII server-side, sends events to Meta Graph API, and on failure
 * queues the event in `FailedCapiEvent` for a background worker to retry.
 * Browser-Pixel ↔ CAPI deduplication is handled by the caller passing a
 * stable `eventId` that matches the `eventID` used in `fbq('track', …)`.
 */

import crypto from "crypto";
import { prisma } from "../db";

const PIXEL_ID = process.env.META_PIXEL_ID || "";
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || "";
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || "";
const API_VERSION = "v21.0";

// EEA + UK + Switzerland country codes (ISO 3166-1 alpha-2). When a
// request comes from one of these, we apply Meta's Limited Data Use flag
// so the event is processed under GDPR constraints (no custom audience
// building, no optimisation using this data). Switzerland (CH) is not
// formally in the EEA but has aligned its data-protection law (revFADP)
// with GDPR, so we treat it the same for compliance.
const EEA_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
  "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI",
  "LT", "LU", "LV", "MT", "NL", "NO", "PL", "PT", "RO", "SE",
  "SI", "SK",
]);

// Retry config. Exponential backoff with jitter inside the in-process
// attempt; if every attempt fails we hand off to the DLQ.
const MAX_IN_PROCESS_RETRIES = 3;
const IN_PROCESS_BACKOFF_MS = [1_000, 2_000, 4_000];
// Background worker retries. Capped so we stop after a day.
const MAX_DLQ_ATTEMPTS = 8;
const DLQ_BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720, 1440, 1440];

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export interface CapiUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  /** Date of birth in ISO format (YYYY-MM-DD). Normalised to YYYYMMDD before hashing. */
  dateOfBirth?: string;
  /** "MALE" | "FEMALE" — reduced to "m" / "f" before hashing. */
  gender?: string;
  /** Phone with or without leading +. Digits only before hashing. */
  phone?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string;
  fbp?: string;
  externalId?: string;
  /** ISO 3166-1 alpha-2 country code for LDU / geo tagging. */
  country?: string;
}

export interface CapiEventParams {
  eventName: string;
  /** Required for Pixel↔CAPI deduplication. Callers should always supply. */
  eventId?: string;
  eventSourceUrl?: string;
  userData: CapiUserData;
  customData?: Record<string, unknown>;
}

function normaliseGender(value: string): string | undefined {
  const lowered = value.trim().toLowerCase();
  if (lowered === "male" || lowered === "m") return "m";
  if (lowered === "female" || lowered === "f") return "f";
  return undefined;
}

function normaliseDob(iso: string): string | undefined {
  // Meta expects YYYYMMDD; drop separators and validate length.
  const compact = iso.replace(/-/g, "");
  return /^\d{8}$/.test(compact) ? compact : undefined;
}

function normalisePhone(value: string): string | undefined {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? digits : undefined;
}

function buildUserData(data: CapiUserData): Record<string, string | undefined> {
  const gender = data.gender ? normaliseGender(data.gender) : undefined;
  const dob = data.dateOfBirth ? normaliseDob(data.dateOfBirth) : undefined;
  const phone = data.phone ? normalisePhone(data.phone) : undefined;
  return {
    em: data.email ? sha256(data.email) : undefined,
    fn: data.firstName ? sha256(data.firstName) : undefined,
    ln: data.lastName ? sha256(data.lastName) : undefined,
    db: dob ? sha256(dob) : undefined,
    ge: gender ? sha256(gender) : undefined,
    ph: phone ? sha256(phone) : undefined,
    client_ip_address: data.clientIpAddress,
    client_user_agent: data.clientUserAgent,
    // fbp / fbc have a defined shape (see
    // https://developers.facebook.com/docs/meta-pixel/advanced/cookies).
    // A malformed value doesn't just get ignored by Meta — it breaks
    // browser↔server deduplication, inflating the Events Manager count
    // and silently poisoning the EMQ score. Drop anything unparseable.
    fbc: isValidFbc(data.fbc) ? data.fbc : undefined,
    fbp: isValidFbp(data.fbp) ? data.fbp : undefined,
    external_id: data.externalId ? sha256(data.externalId) : undefined,
    country: data.country ? sha256(data.country) : undefined,
  };
}

const FBP_RE = /^fb\.\d\.\d+\.\d+$/; // "fb.<subdomainIndex>.<creationTime>.<random>"
const FBC_RE = /^fb\.\d\.\d+\.[A-Za-z0-9_-]+$/; // "fb.<subdomainIndex>.<creationTime>.<fbclid>"
function isValidFbp(value: string | undefined): value is string {
  return typeof value === "string" && FBP_RE.test(value);
}
function isValidFbc(value: string | undefined): value is string {
  return typeof value === "string" && FBC_RE.test(value);
}

function buildEventBody(params: CapiEventParams): Record<string, unknown> {
  const userData = buildUserData(params.userData);
  const cleanUserData = Object.fromEntries(
    Object.entries(userData).filter(([, v]) => v !== undefined),
  );

  const eventData: Record<string, unknown> = {
    event_name: params.eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    user_data: cleanUserData,
  };

  if (params.eventId) eventData.event_id = params.eventId;
  if (params.eventSourceUrl) eventData.event_source_url = params.eventSourceUrl;
  if (params.customData) eventData.custom_data = params.customData;

  // Limited Data Use for EEA / UK users, per Meta's GDPR guidance.
  const country = params.userData.country?.toUpperCase();
  if (country && EEA_COUNTRY_CODES.has(country)) {
    eventData.data_processing_options = ["LDU"];
    eventData.data_processing_options_country = 0;
    eventData.data_processing_options_state = 0;
  }

  return { data: [eventData] };
}

// Hard timeout for outbound Graph API calls. Meta occasionally times out
// closer to 25s; a payment request handler waiting that long would burn a
// connection and cascade into thread starvation under spike. 8s is enough
// for the p99 successful call, and failures flow straight into the DLQ
// where the worker retries without blocking anyone.
const HTTP_TIMEOUT_MS = 8_000;

/**
 * An HTTP failure is "permanent" when retrying cannot possibly succeed
 * with the same payload — malformed JSON, wrong pixel id, deleted event
 * definition, etc. Anything that can heal on its own (rate limit,
 * temporary token invalidation during rotation, server-side transient)
 * is NOT permanent and stays in the DLQ for a later retry.
 *
 *   401 / 403 → transient. Rotating META_CAPI_ACCESS_TOKEN momentarily
 *               returns 401 for in-flight requests; we must not discard
 *               queued events during a deploy or key rotation.
 *   408       → transient (request timeout).
 *   429       → transient (rate limit).
 *   other 4xx → permanent (payload is wrong; retries waste quota).
 *   5xx / network → NOT a 4xx, handled by the generic retry path.
 */
function isPermanentFailure(status: number): boolean {
  if (status < 400 || status >= 500) return false;
  if (status === 401 || status === 403 || status === 408 || status === 429) return false;
  return true;
}

async function postToMeta(body: Record<string, unknown>): Promise<Response> {
  const payload: Record<string, unknown> = { ...body, access_token: ACCESS_TOKEN };
  if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    return await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send an event to Meta CAPI with in-process retries. If all retries fail,
 * persists the event to `FailedCapiEvent` for the background worker to
 * retry later without losing it.
 *
 * Always resolves (never throws) — analytics failures must not break the
 * business transaction that produced the event.
 */
export async function sendCapiEvent(params: CapiEventParams): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;
  // Ensure every event has a stable ID — even if the caller forgot to
  // supply one — so DLQ retries never duplicate in Meta.
  const eventId = params.eventId ?? crypto.randomUUID();
  const paramsWithId: CapiEventParams = { ...params, eventId };

  const body = buildEventBody(paramsWithId);
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_IN_PROCESS_RETRIES; attempt++) {
    try {
      const res = await postToMeta(body);
      if (res.ok) return;
      const text = await res.text();
      lastError = new Error(`Meta CAPI ${res.status}: ${text}`);
      // Permanent failures are recorded and dropped — retrying with the
      // same payload won't change Meta's answer.
      if (isPermanentFailure(res.status)) {
        console.error(`[CAPI] ${params.eventName} rejected (permanent):`, text);
        return;
      }
      // 401 / 403 / 408 / 429 fall through to the retry loop and, if
      // still failing, to the DLQ for the worker to drain later.
    } catch (err) {
      lastError = err;
    }

    if (attempt < MAX_IN_PROCESS_RETRIES) {
      const base = IN_PROCESS_BACKOFF_MS[attempt] ?? 4_000;
      // ±25% jitter — same rationale as the DLQ path, at a smaller scale.
      await sleep(base + (Math.random() * 0.5 - 0.25) * base);
    }
  }

  // All in-process retries exhausted — hand off to DLQ.
  const errorMessage = lastError instanceof Error
    ? lastError.message
    : String(lastError ?? "unknown");
  console.error(`[CAPI] ${params.eventName} queued for retry after ${MAX_IN_PROCESS_RETRIES + 1} failed attempts:`, errorMessage);

  try {
    await prisma.failedAnalyticsEvent.create({
      data: {
        provider: "META_CAPI",
        eventName: params.eventName,
        eventId,
        payloadJson: body as object,
        lastError: errorMessage.slice(0, 2_000),
        nextRetryAt: nextRetryAt(1),
      },
    });
  } catch (dbErr) {
    console.error(
      `[CAPI] Failed to persist DLQ entry for ${params.eventName}:`,
      dbErr instanceof Error ? dbErr.message : String(dbErr),
    );
  }
}

function nextRetryAt(attempts: number): Date {
  const idx = Math.min(attempts - 1, DLQ_BACKOFF_MINUTES.length - 1);
  const minutes = DLQ_BACKOFF_MINUTES[idx] ?? 1_440;
  // ±20% jitter. When 100 events fail simultaneously (e.g. a brief
  // Meta outage), identical backoffs would schedule them all for the
  // same retry tick and recreate the thundering herd against Meta.
  // Uniformly spreading the reschedule stops that.
  const jitter = (Math.random() * 0.4 - 0.2) * minutes * 60_000;
  return new Date(Date.now() + minutes * 60_000 + jitter);
}

/**
 * Process one batch of DLQ entries ready for retry. Called by the
 * background worker on a cron. Marks resolved events and updates the
 * retry schedule for those still failing.
 */
export async function retryFailedCapiEventsBatch(batchSize = 20): Promise<{
  processed: number;
  resolved: number;
}> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return { processed: 0, resolved: 0 };

  const due = await prisma.failedAnalyticsEvent.findMany({
    where: {
      provider: "META_CAPI",
      resolvedAt: null,
      nextRetryAt: { lte: new Date() },
      attemptCount: { lt: MAX_DLQ_ATTEMPTS },
    },
    take: batchSize,
    orderBy: { nextRetryAt: "asc" },
  });

  let resolved = 0;

  for (const row of due) {
    try {
      const res = await postToMeta(row.payloadJson as Record<string, unknown>);
      if (res.ok) {
        await prisma.failedAnalyticsEvent.update({
          where: { id: row.id },
          data: { resolvedAt: new Date(), nextRetryAt: null, lastError: "" },
        });
        resolved++;
        continue;
      }
      const text = await res.text();
      const permanentError = isPermanentFailure(res.status);
      await prisma.failedAnalyticsEvent.update({
        where: { id: row.id },
        data: {
          attemptCount: { increment: 1 },
          lastError: `${res.status}: ${text}`.slice(0, 2_000),
          lastAttemptAt: new Date(),
          // Permanent 4xx — stop retrying by flagging resolved (with the
          // error preserved for forensics).
          resolvedAt: permanentError ? new Date() : null,
          nextRetryAt: permanentError ? null : nextRetryAt(row.attemptCount + 1),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.failedAnalyticsEvent.update({
        where: { id: row.id },
        data: {
          attemptCount: { increment: 1 },
          lastError: msg.slice(0, 2_000),
          lastAttemptAt: new Date(),
          nextRetryAt: nextRetryAt(row.attemptCount + 1),
        },
      });
    }
  }

  return { processed: due.length, resolved };
}
