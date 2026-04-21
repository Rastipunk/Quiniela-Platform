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
