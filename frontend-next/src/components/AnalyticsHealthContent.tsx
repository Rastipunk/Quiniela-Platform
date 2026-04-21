"use client";

/**
 * Admin-only dashboard that hits `/admin/analytics/probe` and renders the
 * result as a traffic-light report. Also exposes a "send real purchase"
 * button that emits a $0.01 probe purchase into production sinks so the
 * operator can confirm end-to-end delivery to GA4 Realtime / Meta Events
 * Manager.
 */

import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface CheckResult {
  status: "ok" | "error" | "not_configured";
  message: string;
  details?: unknown;
}

interface ProbeResponse {
  overall: "ok" | "error" | "degraded";
  timestamp: string;
  checks: {
    ga4: CheckResult;
    metaCapi: CheckResult;
    dlqBacklog: CheckResult;
    frontendHtml: CheckResult;
  };
  envVars: {
    backend: Record<string, boolean>;
    frontend_note: string;
  };
}

// Frontend-only check: we look at window.dataLayer directly to verify the
// GTM loader executed AFTER page hydration. This catches the case where
// the HTML has the script but a CSP / network block prevents gtm.js from
// actually loading in the current browser.
interface ClientGtmStatus {
  scriptTagPresent: boolean;
  dataLayerExists: boolean;
  dataLayerLength: number;
  gtmLoaded: boolean;
  gtmId: string | null;
  /** Last `consent` command observed on dataLayer — "granted" / "denied" / unknown. */
  analyticsStorage: string;
  adStorage: string;
  /** Count of gtag("event"/ "config") push observed. */
  eventPushes: number;
}

function useClientGtmStatus(): ClientGtmStatus {
  const [state, setState] = useState<ClientGtmStatus>({
    scriptTagPresent: false,
    dataLayerExists: false,
    dataLayerLength: 0,
    gtmLoaded: false,
    gtmId: null,
    analyticsStorage: "unknown",
    adStorage: "unknown",
    eventPushes: 0,
  });

  useEffect(() => {
    const tick = () => {
      const tag = document.getElementById("gtm-loader") as HTMLScriptElement | null;
      const idMatch = tag?.innerHTML.match(/GTM-[A-Z0-9]+/);
      const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
      const gtmObj = (window as unknown as { google_tag_manager?: Record<string, unknown> })
        .google_tag_manager;

      // Walk the dataLayer looking for the LATEST `consent` command. GTM
      // pushes both arrays (via gtag()) and plain objects (via trackEvent)
      // onto the same queue, so we inspect both shapes.
      let analyticsStorage = "unknown";
      let adStorage = "unknown";
      let eventPushes = 0;
      if (Array.isArray(dl)) {
        for (const entry of dl) {
          if (Array.isArray(entry)) {
            // Shape: ["consent", "default" | "update", { analytics_storage, ... }]
            if (entry[0] === "consent" && typeof entry[2] === "object" && entry[2] !== null) {
              const payload = entry[2] as Record<string, unknown>;
              if (typeof payload.analytics_storage === "string") {
                analyticsStorage = payload.analytics_storage;
              }
              if (typeof payload.ad_storage === "string") {
                adStorage = payload.ad_storage;
              }
            }
            if (entry[0] === "event" || entry[0] === "config") eventPushes++;
          } else if (typeof entry === "object" && entry !== null && "event" in entry) {
            eventPushes++;
          }
        }
      }

      setState({
        scriptTagPresent: Boolean(tag),
        dataLayerExists: Array.isArray(dl),
        dataLayerLength: Array.isArray(dl) ? dl.length : 0,
        gtmLoaded: Boolean(gtmObj && Object.keys(gtmObj).length > 0),
        gtmId: idMatch?.[0] ?? null,
        analyticsStorage,
        adStorage,
        eventPushes,
      });
    };
    tick();
    const iv = setInterval(tick, 1_500);
    return () => clearInterval(iv);
  }, []);

  return state;
}

const STATUS_COLORS: Record<CheckResult["status"], string> = {
  ok: "#16a34a",
  error: "#dc2626",
  not_configured: "#d97706",
};

const STATUS_LABELS: Record<CheckResult["status"], string> = {
  ok: "OK",
  error: "ERROR",
  not_configured: "NO CONFIGURADO",
};

function StatusBadge({ status }: { status: CheckResult["status"] }) {
  return (
    <span
      style={{
        background: STATUS_COLORS[status],
        color: "white",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function CheckCard({ title, result }: { title: string; result: CheckResult }) {
  return (
    <div
      style={{
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 10,
        padding: 16,
        background: "var(--surface, white)",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>{title}</h3>
        <StatusBadge status={result.status} />
      </div>
      <p style={{ fontSize: "0.88rem", color: "var(--muted, #4b5563)", margin: 0 }}>{result.message}</p>
      {result.details !== undefined && result.details !== null && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: "0.82rem", color: "var(--muted, #4b5563)" }}>
            Detalles técnicos
          </summary>
          <pre
            style={{
              background: "var(--surface-alt, #f3f4f6)",
              padding: 12,
              borderRadius: 6,
              overflow: "auto",
              fontSize: "0.75rem",
              marginTop: 8,
            }}
          >
            {JSON.stringify(result.details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export default function AnalyticsHealthContent() {
  const [report, setReport] = useState<ProbeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realPurchaseStatus, setRealPurchaseStatus] = useState<string | null>(null);
  const clientGtm = useClientGtmStatus();

  const runProbe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError("No auth token");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/analytics/probe`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || `HTTP ${res.status}`);
        return;
      }
      // `sendOk` returns `{ ok: true, ...payload }` — payload is flattened
      // at the top level, there is no `data` envelope.
      setReport(json as ProbeResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runProbe();
  }, [runProbe]);

  const sendRealPurchase = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setRealPurchaseStatus("Enviando…");
    try {
      const txn = `probe_${Date.now()}`;
      const res = await fetch(`${API_URL}/admin/analytics/probe/send-real-purchase`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ allowReal: true, transactionId: txn }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRealPurchaseStatus(`Error: ${json?.error?.message || res.status}`);
        return;
      }
      setRealPurchaseStatus(
        `Enviado con transaction_id=${txn}. Revisá GA4 Realtime y Meta Events Manager → Test Events.`,
      );
    } catch (err) {
      setRealPurchaseStatus(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: 4 }}>Analytics Health</h1>
      <p style={{ color: "var(--muted, #4b5563)", marginBottom: 24, fontSize: "0.92rem" }}>
        Cada check llama al sistema real (GA4 debug endpoint, Meta Graph API, DB DLQ).
        Si algo está roto lo ves acá, no en reports 48h tarde.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={runProbe}
          disabled={loading}
          style={{
            background: BRAND.primary,
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Corriendo probe…" : "Re-run probe"}
        </button>
        <button
          onClick={sendRealPurchase}
          style={{
            background: "transparent",
            color: BRAND.primary,
            border: `1px solid ${BRAND.primary}`,
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Enviar purchase real ($0.01) a GA4 + Meta
        </button>
      </div>

      {realPurchaseStatus && (
        <div
          style={{
            padding: 12,
            background: "var(--surface-alt, #eff6ff)",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: "0.88rem",
          }}
        >
          {realPurchaseStatus}
        </div>
      )}

      {error && (
        <div style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Client-side GTM — doesn't depend on probe response, tells us if
          THIS browser actually loaded GTM (catches CSP / ad-block). */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>
          Este browser (client-side)
        </h2>
        <div
          style={{
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 10,
            padding: 16,
            background: "var(--surface, white)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            fontSize: "0.88rem",
          }}
        >
          <span>Script tag GTM en &lt;head&gt;</span>
          <strong style={{ color: clientGtm.scriptTagPresent ? "#16a34a" : "#dc2626" }}>
            {clientGtm.scriptTagPresent ? "Presente" : "AUSENTE — NEXT_PUBLIC_GTM_ID no llegó al build"}
          </strong>
          <span>window.dataLayer inicializado</span>
          <strong style={{ color: clientGtm.dataLayerExists ? "#16a34a" : "#dc2626" }}>
            {clientGtm.dataLayerExists ? `Sí (${clientGtm.dataLayerLength} items)` : "NO"}
          </strong>
          <span>gtm.js ejecutó (google_tag_manager)</span>
          <strong style={{ color: clientGtm.gtmLoaded ? "#16a34a" : "#dc2626" }}>
            {clientGtm.gtmLoaded ? "Sí" : "NO — CSP o ad-block"}
          </strong>
          <span>GTM ID detectado</span>
          <strong>{clientGtm.gtmId ?? "—"}</strong>
          <span>analytics_storage (Consent Mode)</span>
          <strong style={{ color: clientGtm.analyticsStorage === "granted" ? "#16a34a" : "#dc2626" }}>
            {clientGtm.analyticsStorage}
            {clientGtm.analyticsStorage === "denied" && " — GA4 NO recibe hits hasta que aceptes cookies"}
          </strong>
          <span>ad_storage (Consent Mode)</span>
          <strong style={{ color: clientGtm.adStorage === "granted" ? "#16a34a" : "#d97706" }}>
            {clientGtm.adStorage}
          </strong>
          <span>Pushes de evento observados en dataLayer</span>
          <strong>{clientGtm.eventPushes}</strong>
        </div>
      </section>

      {report && (
        <>
          <section style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>
              Server-side checks ({report.overall.toUpperCase()})
            </h2>
            <CheckCard title="GA4 Measurement Protocol" result={report.checks.ga4} />
            <CheckCard title="Meta Conversions API" result={report.checks.metaCapi} />
            <CheckCard title="DLQ (eventos que fallaron y están en retry)" result={report.checks.dlqBacklog} />
            <CheckCard title="HTML público (frontend deployado)" result={report.checks.frontendHtml} />
          </section>

          <section>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>Env vars (backend)</h2>
            <div
              style={{
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: 10,
                padding: 16,
                background: "var(--surface, white)",
              }}
            >
              {Object.entries(report.envVars.backend).map(([name, present]) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    fontSize: "0.88rem",
                    fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  }}
                >
                  <span>{name}</span>
                  <strong style={{ color: present ? "#16a34a" : "#dc2626" }}>
                    {present ? "set" : "MISSING"}
                  </strong>
                </div>
              ))}
              <p style={{ fontSize: "0.78rem", color: "var(--muted, #4b5563)", marginTop: 12, marginBottom: 0 }}>
                {report.envVars.frontend_note}
              </p>
            </div>
          </section>

          <p style={{ fontSize: "0.78rem", color: "var(--muted, #4b5563)", marginTop: 16 }}>
            Última corrida: {report.timestamp}
          </p>
        </>
      )}
    </div>
  );
}
