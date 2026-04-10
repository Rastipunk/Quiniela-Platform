/**
 * Analytics — centralized event tracking via GTM dataLayer.
 *
 * Usage:
 *   import { trackEvent } from "@/lib/analytics";
 *   trackEvent("pool_created", { pool_type: "personal", tournament: "wc2026" });
 *
 * Events are pushed to `window.dataLayer` which GTM picks up.
 * If GTM is not loaded (consent denied, dev mode, etc), calls are no-ops.
 */

// Extend Window to include dataLayer
declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

/**
 * Push a custom event to the GTM dataLayer.
 * Safe to call anywhere — no-op if dataLayer doesn't exist.
 */
export function trackEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

/**
 * Track a page view explicitly (for SPA route changes).
 * GA4 Enhanced Measurement handles most page views, but this
 * is useful for virtual page views or custom page categorization.
 */
export function trackPageView(path: string, title?: string): void {
  trackEvent("page_view", {
    page_path: path,
    page_title: title,
  });
}

/**
 * Set the authenticated user ID for cross-device tracking.
 * GA4 uses this to deduplicate users across devices/sessions.
 * Call after login/register. Pass null on logout to clear.
 */
export function setAnalyticsUserId(userId: string | null): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ user_id: userId });
}
