/**
 * Google Analytics 4 Measurement Protocol (server-side sink).
 *
 * Acts as a failsafe for conversion events that MUST reach GA4 even if
 * the browser never fires (ad-blocker, bfcache close, user closes tab
 * mid-redirect, webhook-only async flows like Polar / PSE).
 *
 * Design principles:
 *  - Noop when `GA4_MEASUREMENT_ID` or `GA4_API_SECRET` are unset so
 *    local dev and unconfigured envs never fail.
 *  - Same `client_id` is NOT required — GA4 accepts server events with
 *    an anonymous client_id. We mint a stable one from userId so a user's
 *    server and browser events land on the same GA4 user timeline.
 *  - `transaction_id` is the canonical dedupe key for purchase events.
 *    GA4 collapses duplicates across sources (browser + MP) automatically.
 *  - Retry with exponential backoff, then DLQ, mirroring the CAPI client.
 *
 * @see https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

import crypto from "crypto";
import { prisma } from "../db";

const MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || "";
const API_SECRET = process.env.GA4_API_SECRET || "";
const DEBUG_ENDPOINT = process.env.GA4_DEBUG === "1";

// GA4 MP has a 25-param cap per event and 100-char param name / 500-char
// value limits. We do not enforce here — caller's payloads are already
// project-controlled and short.

const MAX_IN_PROCESS_RETRIES = 3;
const IN_PROCESS_BACKOFF_MS = [1_000, 2_000, 4_000];
const MAX_DLQ_ATTEMPTS = 8;
const DLQ_BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720, 1440, 1440];

export interface Ga4Event {
  name: string;
  params?: Record<string, unknown>;
}

export interface Ga4SendParams {
  /** Stable per-user identifier. Same user across sessions keeps timeline. */
  userId?: string;
  /** Device-scoped client ID. GA4 collects `cid` per device; falling back to
   *  a hash of userId keeps server events tied to the user even without a
   *  browser cookie. */
  clientId?: string;
  events: Ga4Event[];
  /** When true, user_properties are applied to the user record. */
  userProperties?: Record<string, { value: string | number | boolean }>;
  /** Request IP and UA for GA4 geolocation enrichment. */
  ipOverride?: string;
  userAgent?: string;
}

function dedupeKey(params: Ga4SendParams): string {
  // Prefer the transaction_id when present — that's what GA4 itself dedups
  // by. Falls back to a random UUID so the DLQ row is always unique.
  const firstParams = params.events[0]?.params;
  const txn = firstParams && typeof firstParams["transaction_id"] === "string"
    ? (firstParams["transaction_id"] as string)
    : null;
  return txn ?? crypto.randomUUID();
}

function buildClientId(userId?: string, explicit?: string): string {
  if (explicit) return explicit;
  if (userId) {
    // Deterministic pseudo-cid: `{first32hex}.{last8hex}` mimics GA4 format.
    const hash = crypto.createHash("sha256").update(userId).digest("hex");
    return `${hash.slice(0, 10)}.${hash.slice(10, 20)}`;
  }
  return crypto.randomUUID();
}

async function postToGa4(body: Record<string, unknown>): Promise<Response> {
  const path = DEBUG_ENDPOINT ? "debug/mp/collect" : "mp/collect";
  const url = `https://www.google-analytics.com/${path}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBody(params: Ga4SendParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    client_id: buildClientId(params.userId, params.clientId),
    events: params.events.map((e) => ({
      name: e.name,
      // GA4 MP requires params to be string/number/boolean. Strip anything
      // non-serialisable defensively to avoid silent payload rejections.
      params: e.params ? sanitizeParams(e.params) : undefined,
    })),
    non_personalized_ads: false,
  };
  if (params.userId) body.user_id = params.userId;
  if (params.userProperties) body.user_properties = params.userProperties;
  if (params.ipOverride) body.ip_override = params.ipOverride;
  if (params.userAgent) body.user_agent = params.userAgent;
  return body;
}

function sanitizeParams(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      // `items` array is allowed by GA4 — pass through untouched.
      out[key] = value;
      continue;
    }
    if (typeof value === "object") {
      // Nested objects (other than `items`) are rejected by GA4 — skip.
      continue;
    }
    out[key] = value;
  }
  return out;
}

function nextRetryAt(attempts: number): Date {
  const idx = Math.min(attempts - 1, DLQ_BACKOFF_MINUTES.length - 1);
  const minutes = DLQ_BACKOFF_MINUTES[idx] ?? 1_440;
  return new Date(Date.now() + minutes * 60_000);
}

/**
 * Send one or more events to GA4 MP with in-process retries. On final
 * failure the event is queued in `FailedAnalyticsEvent` for the cron
 * worker. Always resolves; never throws.
 */
export async function sendGa4Event(params: Ga4SendParams): Promise<void> {
  if (!MEASUREMENT_ID || !API_SECRET) return;
  const body = buildBody(params);
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_IN_PROCESS_RETRIES; attempt++) {
    try {
      const res = await postToGa4(body);
      if (res.ok) return;
      const text = await res.text();
      lastError = new Error(`GA4 MP ${res.status}: ${text}`);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        console.error(`[GA4MP] ${params.events[0]?.name} rejected:`, text);
        return;
      }
    } catch (err) {
      lastError = err;
    }
    if (attempt < MAX_IN_PROCESS_RETRIES) {
      await sleep(IN_PROCESS_BACKOFF_MS[attempt] ?? 4_000);
    }
  }

  const errorMessage = lastError instanceof Error
    ? lastError.message
    : String(lastError ?? "unknown");
  console.error(
    `[GA4MP] ${params.events[0]?.name} queued for retry after ${MAX_IN_PROCESS_RETRIES + 1} failed attempts:`,
    errorMessage,
  );

  try {
    await prisma.failedAnalyticsEvent.create({
      data: {
        provider: "GA4_MP",
        eventName: params.events[0]?.name ?? "unknown",
        eventId: dedupeKey(params),
        payloadJson: body as object,
        lastError: errorMessage.slice(0, 2_000),
        nextRetryAt: nextRetryAt(1),
      },
    });
  } catch (dbErr) {
    console.error(
      `[GA4MP] Failed to persist DLQ entry:`,
      dbErr instanceof Error ? dbErr.message : String(dbErr),
    );
  }
}

/**
 * Drain the GA4 MP slice of the DLQ. Mirrors `retryFailedCapiEventsBatch`.
 */
export async function retryFailedGa4EventsBatch(batchSize = 20): Promise<{
  processed: number;
  resolved: number;
}> {
  if (!MEASUREMENT_ID || !API_SECRET) return { processed: 0, resolved: 0 };

  const due = await prisma.failedAnalyticsEvent.findMany({
    where: {
      provider: "GA4_MP",
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
      const res = await postToGa4(row.payloadJson as Record<string, unknown>);
      if (res.ok) {
        await prisma.failedAnalyticsEvent.update({
          where: { id: row.id },
          data: { resolvedAt: new Date(), nextRetryAt: null, lastError: "" },
        });
        resolved++;
        continue;
      }
      const text = await res.text();
      const permanentError = res.status >= 400 && res.status < 500 && res.status !== 429;
      await prisma.failedAnalyticsEvent.update({
        where: { id: row.id },
        data: {
          attemptCount: { increment: 1 },
          lastError: `${res.status}: ${text}`.slice(0, 2_000),
          lastAttemptAt: new Date(),
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
