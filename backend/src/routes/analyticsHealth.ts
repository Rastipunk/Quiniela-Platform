/**
 * Analytics health probe — admin-only diagnostic endpoint.
 *
 * Fires a synthetic event at each sink and surfaces the sink's own validation
 * response. This is the single source of truth for "is our tracking stack
 * wired correctly RIGHT NOW?" — it does not simulate, it calls the real APIs.
 *
 *   - GA4: hits `/debug/mp/collect` (validation-only endpoint — does NOT
 *     ingest into reports). Returns the `validationMessages[]` Google uses
 *     internally to accept or reject events.
 *   - Meta CAPI: hits the production `/events` endpoint with a synthetic
 *     event ID + the account's `test_event_code` if configured. Visible in
 *     Meta Events Manager → Test Events tab.
 *
 * The endpoint ALSO reports presence (not values) of every analytics env var
 * so an operator can tell "var missing" apart from "var set but wrong".
 *
 * GET /admin/analytics/probe
 *   Authorization: Bearer <admin JWT>
 */

import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { sendOk, sendBadRequest } from "../lib/apiResponse";
import { prisma } from "../db";

export const analyticsHealthRouter = Router();

const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || "";
const GA4_API_SECRET = process.env.GA4_API_SECRET || "";
const META_PIXEL_ID = process.env.META_PIXEL_ID || "";
const META_CAPI_ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || "";
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "";

interface CheckResult {
  status: "ok" | "error" | "not_configured";
  message: string;
  details?: unknown;
}

/**
 * Presence-only report — never logs the actual secret values. Useful to
 * catch "var was renamed" or "var is set in backend but not in frontend
 * build" without leaking credentials into the response.
 */
function envVarReport() {
  return {
    backend: {
      GA4_MEASUREMENT_ID: Boolean(GA4_MEASUREMENT_ID),
      GA4_API_SECRET: Boolean(GA4_API_SECRET),
      META_PIXEL_ID: Boolean(META_PIXEL_ID),
      META_CAPI_ACCESS_TOKEN: Boolean(META_CAPI_ACCESS_TOKEN),
      META_TEST_EVENT_CODE: Boolean(META_TEST_EVENT_CODE),
      FRONTEND_URL: Boolean(FRONTEND_URL),
    },
    /** Frontend vars live in the Next.js build. Probe cannot read them
     *  from backend memory; operator must fetch the public HTML to verify
     *  — see /admin/analytics/frontend-probe below. */
    frontend_note:
      "NEXT_PUBLIC_* vars are inlined at build time. Use /admin/analytics/frontend-probe to verify they reached the shipped HTML.",
  };
}

async function probeGa4(userId: string): Promise<CheckResult> {
  if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET) {
    return {
      status: "not_configured",
      message:
        "GA4_MEASUREMENT_ID and/or GA4_API_SECRET env vars are not set. Server-side GA4 emission is fully disabled.",
    };
  }

  // Google's debug endpoint validates the payload and returns structured
  // errors — prod `/mp/collect` always returns 2xx, so debug is the ONLY
  // way to server-side verify correctness.
  const url = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;

  const clientIdHash = crypto.createHash("sha256").update(userId).digest("hex");
  const clientId = `${clientIdHash.slice(0, 10)}.${clientIdHash.slice(10, 20)}`;

  const body = {
    client_id: clientId,
    user_id: userId,
    events: [
      {
        name: "analytics_health_probe",
        params: {
          probe_source: "admin_endpoint",
          probe_timestamp: Date.now(),
        },
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      return {
        status: "error",
        message: `GA4 debug endpoint returned HTTP ${res.status}`,
        details: parsed,
      };
    }

    // Even 2xx can carry validation errors in the body.
    const validationMessages =
      parsed && typeof parsed === "object" && "validationMessages" in parsed
        ? (parsed as { validationMessages: unknown[] }).validationMessages
        : [];

    if (Array.isArray(validationMessages) && validationMessages.length > 0) {
      return {
        status: "error",
        message: `GA4 rejected the payload with ${validationMessages.length} validation error(s)`,
        details: { validationMessages, clientId, measurementId: GA4_MEASUREMENT_ID },
      };
    }

    return {
      status: "ok",
      message:
        "GA4 debug endpoint accepted the payload. Verify the event appears in GA4 > Configure > DebugView within ~30s.",
      details: { clientId, measurementId: GA4_MEASUREMENT_ID },
    };
  } catch (err) {
    return {
      status: "error",
      message: "Network error reaching google-analytics.com",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeMetaCapi(userId: string): Promise<CheckResult> {
  if (!META_PIXEL_ID || !META_CAPI_ACCESS_TOKEN) {
    return {
      status: "not_configured",
      message:
        "META_PIXEL_ID and/or META_CAPI_ACCESS_TOKEN env vars are not set. Server-side Meta CAPI emission is fully disabled.",
    };
  }

  const eventId = `probe_${Date.now()}_${crypto.randomUUID()}`;
  const externalIdHash = crypto
    .createHash("sha256")
    .update(userId)
    .digest("hex");

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: "AnalyticsHealthProbe",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "system_generated",
        user_data: { external_id: [externalIdHash] },
        custom_data: { probe_source: "admin_endpoint" },
      },
    ],
    access_token: META_CAPI_ACCESS_TOKEN,
  };
  if (META_TEST_EVENT_CODE) payload.test_event_code = META_TEST_EVENT_CODE;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      return {
        status: "error",
        message: `Meta CAPI returned HTTP ${res.status}`,
        details: parsed,
      };
    }

    // CAPI returns { events_received, fbtrace_id, messages? } on success.
    // `messages` carries non-fatal warnings (e.g. low-match-quality hints)
    // that we surface so the operator can tune user_data.
    const typed = parsed as {
      events_received?: number;
      fbtrace_id?: string;
      messages?: unknown[];
    };

    return {
      status: "ok",
      message: META_TEST_EVENT_CODE
        ? "Meta CAPI accepted the event. Check Meta Events Manager > Test Events within ~30s."
        : "Meta CAPI accepted the event. NOTE: without META_TEST_EVENT_CODE you cannot verify in Events Manager — it will land in real prod data.",
      details: {
        events_received: typed.events_received,
        fbtrace_id: typed.fbtrace_id,
        messages: typed.messages,
        eventId,
        test_event_code_used: Boolean(META_TEST_EVENT_CODE),
      },
    };
  } catch (err) {
    return {
      status: "error",
      message: "Network error reaching graph.facebook.com",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeDlqBacklog(): Promise<CheckResult> {
  try {
    const [unresolved, oldestUnresolved] = await Promise.all([
      prisma.failedAnalyticsEvent.count({ where: { resolvedAt: null } }),
      prisma.failedAnalyticsEvent.findFirst({
        where: { resolvedAt: null },
        orderBy: { createdAtUtc: "asc" },
        select: { createdAtUtc: true, provider: true, eventName: true, lastError: true },
      }),
    ]);

    if (unresolved === 0) {
      return { status: "ok", message: "Zero unresolved events in the DLQ." };
    }
    return {
      status: "error",
      message: `${unresolved} unresolved events in DLQ. Oldest from ${oldestUnresolved?.createdAtUtc?.toISOString() ?? "unknown"}.`,
      details: oldestUnresolved,
    };
  } catch (err) {
    return {
      status: "error",
      message: "Could not query FailedAnalyticsEvent table",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeFrontendHtml(): Promise<CheckResult> {
  if (!FRONTEND_URL) {
    return {
      status: "not_configured",
      message: "FRONTEND_URL env var not set — cannot probe the public HTML.",
    };
  }

  try {
    const res = await fetch(FRONTEND_URL, {
      headers: { "User-Agent": "Picks4All-Analytics-Probe/1.0" },
    });
    const html = await res.text();

    // Look for the actual markers that prove tracking scripts are present.
    // If the operator only relies on env-var presence they miss the case
    // where the var is set on the backend Railway service but missing on
    // the frontend service (NEXT_PUBLIC_* must be on the frontend build).
    const gtmIdMatch = html.match(/GTM-[A-Z0-9]+/);
    const ga4IdMatch = html.match(/G-[A-Z0-9]{10}/);
    const pixelPresent = /connect\.facebook\.net/i.test(html);
    const consentDefaultPresent = /consent['"],\s*['"]default/i.test(html);
    const dataLayerPresent = /dataLayer\s*=\s*/i.test(html);

    const missing: string[] = [];
    if (!gtmIdMatch) missing.push("GTM container ID (GTM-XXXXXXX) not found in HTML");
    if (!consentDefaultPresent) missing.push("Consent Mode v2 default script not found");
    if (!dataLayerPresent) missing.push("window.dataLayer initialiser not found");

    if (missing.length > 0) {
      return {
        status: "error",
        message: `Public HTML is missing tracking markers. Most likely NEXT_PUBLIC_GTM_ID is not in the frontend service env vars at BUILD time.`,
        details: {
          missing,
          frontendUrl: FRONTEND_URL,
          gtmId: gtmIdMatch?.[0] ?? null,
          ga4Id: ga4IdMatch?.[0] ?? null,
          pixelPresent,
        },
      };
    }

    return {
      status: "ok",
      message: "Public HTML contains GTM loader, Consent Mode defaults, and dataLayer initialiser.",
      details: {
        gtmId: gtmIdMatch?.[0] ?? null,
        ga4Id: ga4IdMatch?.[0] ?? null,
        pixelPresent,
      },
    };
  } catch (err) {
    return {
      status: "error",
      message: `Could not fetch ${FRONTEND_URL}`,
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * GET /admin/analytics/probe
 *
 * Runs all checks in parallel, returns a single JSON report. Never throws
 * — even if every downstream is broken, operator still gets a useful dump.
 */
analyticsHealthRouter.get(
  "/probe",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const userId = req.auth!.userId;

    const [ga4, capi, dlq, html] = await Promise.all([
      probeGa4(userId),
      probeMetaCapi(userId),
      probeDlqBacklog(),
      probeFrontendHtml(),
    ]);

    const overall: "ok" | "error" | "degraded" =
      [ga4.status, capi.status, dlq.status, html.status].every((s) => s === "ok")
        ? "ok"
        : [ga4.status, capi.status, html.status].some((s) => s === "error")
          ? "error"
          : "degraded";

    return sendOk(res, {
      overall,
      timestamp: new Date().toISOString(),
      checks: { ga4, metaCapi: capi, dlqBacklog: dlq, frontendHtml: html },
      envVars: envVarReport(),
    });
  },
);

/**
 * POST /admin/analytics/probe/send-real-purchase
 *
 * Escape hatch — emit a REAL synthetic purchase event to GA4/CAPI (not the
 * debug endpoint) so the operator can confirm it lands in Realtime /
 * DebugView. Gated behind `allowReal: true` to prevent accidental pollution.
 */
const sendRealSchema = z.object({
  allowReal: z.literal(true),
  transactionId: z.string().min(3).max(80).optional(),
});

analyticsHealthRouter.post(
  "/probe/send-real-purchase",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = sendRealSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
    }

    const txn = parsed.data.transactionId ?? `probe_${Date.now()}`;
    const [ga4Mod, capiMod] = await Promise.all([
      import("../lib/ga4"),
      import("../lib/metaCapi"),
    ]);

    await Promise.all([
      ga4Mod.sendGa4Event({
        userId: req.auth!.userId,
        events: [
          {
            name: "purchase",
            params: {
              transaction_id: txn,
              currency: "USD",
              value: 0.01,
              items: [{ item_id: "probe", item_name: "probe", price: 0.01, quantity: 1 }],
            },
          },
        ],
      }),
      capiMod.sendCapiEvent({
        eventName: "Purchase",
        eventId: txn,
        userData: { externalId: req.auth!.userId },
        customData: {
          currency: "USD",
          value: 0.01,
          content_name: "analytics_health_probe",
        },
      }),
    ]);

    return sendOk(res, {
      sent: true,
      transactionId: txn,
      instructions: [
        "GA4 > Reports > Realtime: event should appear within 10-30 seconds.",
        "Meta Events Manager > Test Events tab: event should appear within 10-30 seconds (requires META_TEST_EVENT_CODE).",
      ],
    });
  },
);
