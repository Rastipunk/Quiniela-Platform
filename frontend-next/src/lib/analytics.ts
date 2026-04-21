/**
 * Analytics — centralized Google Tag Manager / GA4 integration.
 *
 * All tracking funnels through `window.dataLayer`. GTM (loaded from the root
 * layout) forwards these pushes to GA4 and any other configured tags.
 *
 * Pushes are safe to call at any time:
 * - On the server they are no-ops.
 * - Before GTM loads they queue in dataLayer and are processed retroactively.
 * - When consent is denied, GA4 still receives pings without cookies
 *   (Consent Mode v2 behaviour) and retroactively resolves once granted.
 */

declare global {
  interface Window {
    // GTM mixes plain event objects and array-like command tuples
    // (arguments/Array) in the same queue, so the element type must stay wide.
    dataLayer?: unknown[];
  }
}

const DEBUG_STORAGE_KEY = "p4a_analytics_debug";
const DEBUG_QUERY_PARAM = "gtm_debug";

/**
 * Whether analytics debug mode is active in this tab. Enabled by either:
 *  - `?gtm_debug=1` in the URL (matches Google's own convention), OR
 *  - `localStorage.p4a_analytics_debug = "1"` (persists between navs).
 *
 * In debug mode every dataLayer push is mirrored to `console.groupCollapsed`
 * so engineers can diagnose tagging issues without GTM Preview or Meta
 * Events Manager. Zero-cost when disabled — the check is a single
 * localStorage lookup behind a lazy singleton.
 */
let _debugCache: boolean | null = null;
function isDebugEnabled(): boolean {
  if (_debugCache !== null) return _debugCache;
  if (typeof window === "undefined") {
    _debugCache = false;
    return false;
  }
  try {
    if (new URL(window.location.href).searchParams.get(DEBUG_QUERY_PARAM) === "1") {
      localStorage.setItem(DEBUG_STORAGE_KEY, "1");
      _debugCache = true;
      return true;
    }
    _debugCache = localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
  } catch {
    _debugCache = false;
  }
  return _debugCache;
}

function debugLog(label: string, payload: unknown): void {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.groupCollapsed(`[analytics] ${label}`);
  // eslint-disable-next-line no-console
  console.log(payload);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

/** Supported Consent Mode v2 signal values. */
export type ConsentValue = "granted" | "denied";

/**
 * The Consent Mode v2 signals we control from the UI. Other signals
 * (`security_storage`, `functionality_storage`) stay granted by default — they
 * are required for the site to function and are not analytics-related.
 */
export const CONSENT_SIGNALS = [
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "personalization_storage",
] as const;

type ConsentSignal = (typeof CONSENT_SIGNALS)[number];

/**
 * Mirror of Google's `gtag()` helper. Pushes a command tuple to dataLayer so
 * GTM recognises it as a directive (consent, config, set, ...) instead of a
 * custom event. Using `dataLayer.push({ event: "...", ... })` for consent
 * signals does NOT update Consent Mode — only this form does.
 *
 * @see https://developers.google.com/tag-platform/gtagjs/reference
 */
export function gtag(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
  debugLog(`gtag ${String(args[0])} ${String(args[1] ?? "")}`.trim(), args);
}

/**
 * Push a custom event to the GTM dataLayer.
 *
 * GA4 parameter naming rules apply (snake_case, <=40 chars for event name,
 * <=100 chars for params). Values must be strings, numbers, or booleans.
 */
export function trackEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
  debugLog(`event ${event}`, { event, ...params });
}

/**
 * Track a virtual page view for client-side navigation. GA4 Enhanced
 * Measurement fires `page_view` on history changes automatically, so this is
 * only needed for cases where the URL does not change (modal routes, tab
 * navigation inside a single URL, etc.).
 */
export function trackPageView(path: string, title?: string): void {
  trackEvent("page_view", {
    page_path: path,
    page_title: title,
  });
}

/**
 * Bind the authenticated user ID to the GA4 user. Enables cross-device and
 * cross-session deduplication when the user signs in on a new device.
 *
 * Uses the `gtag('set', 'user_properties', ...)` + `gtag('config', ..., { user_id })`
 * pattern recommended by Google — applies to all subsequent events.
 *
 * Pass `null` on logout to clear the binding.
 */
export function setAnalyticsUserId(userId: string | null): void {
  // Push to dataLayer so GTM variables can read it; also emit a `set` command
  // so any gtag-configured tag picks it up without needing a GTM trigger.
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ user_id: userId });
  gtag("set", { user_id: userId });
}

/**
 * GA4 user properties — segment users by attributes that persist across
 * sessions (tier, country, cohort). Applied via `gtag('set','user_properties',…)`
 * so every subsequent event inherits them. Call after login (with the
 * aggregated snapshot from /me/aggregated) and after any event that
 * materially changes the user's state (pool_created, purchase success).
 *
 * GA4 enforces a 25-property cap per user and a 36-char value limit; this
 * helper truncates defensively.
 */
export type AnalyticsUserProperties = {
  tier?: "free" | "paid";
  is_corporate?: boolean;
  country?: string | null;
  pool_count?: number;
  paid_pool_count?: number;
  account_age_days?: number;
  platform_role?: string;
  acquisition_source?: string | null;
  acquisition_campaign?: string | null;
};

export function setUserProperties(props: AnalyticsUserProperties): void {
  if (typeof window === "undefined") return;
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      sanitized[key] = value.slice(0, 36);
    } else {
      sanitized[key] = value as number | boolean;
    }
  }
  if (Object.keys(sanitized).length === 0) return;
  // Both forms: dataLayer push so GTM variables can read the object, and
  // gtag('set','user_properties') so any GA4 config tag picks them up.
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ user_properties: sanitized });
  gtag("set", "user_properties", sanitized);
}

/**
 * Emit a Consent Mode v2 update for all analytics/ads signals.
 * This is what actually unlocks GA4 cookies and ad tags after the user
 * accepts the banner. Must be called via the `gtag` command form so GTM
 * treats it as a consent directive.
 */
export function updateConsent(consent: ConsentValue): void {
  const payload = CONSENT_SIGNALS.reduce<Record<ConsentSignal, ConsentValue>>(
    (acc, key) => {
      acc[key] = consent;
      return acc;
    },
    {} as Record<ConsentSignal, ConsentValue>,
  );
  gtag("consent", "update", payload);
  // Emit a regular event too so GTM triggers keyed on "consent_update" still fire.
  trackEvent("consent_update", { consent_state: consent });
}
