/**
 * Google Tag Manager bootstrap — server-only helpers that produce the raw
 * `<script>` strings injected by the root layout.
 *
 * We intentionally do NOT use `next/script` here. Its `beforeInteractive`
 * strategy only works when invoked from the literal root layout, and even
 * `afterInteractive` introduces ordering ambiguity between the Consent Mode
 * defaults and the GTM loader. Inline `<script>` tags rendered in `<head>`
 * execute synchronously in document order, guaranteeing:
 *
 *   1. Consent Mode v2 defaults are on dataLayer BEFORE gtm.js requests it.
 *   2. GTM picks up the consent state on first evaluation.
 *   3. Any subsequent `gtag('consent', 'update', …)` from the client is a
 *      valid transition recognised by Consent Mode.
 */

import { CONSENT_SIGNALS } from "./analytics";

export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "";

export const isGtmEnabled = (): boolean => GTM_ID.length > 0;

/**
 * Consent Mode v2 defaults — analytics and ad signals are denied until the
 * user opts in (or we detect an authenticated session). `security_storage`
 * and `functionality_storage` stay implicitly granted (Google's default)
 * because the site needs them to operate.
 *
 * `wait_for_update` gives client-side code a window to call
 * `gtag('consent','update', …)` based on stored preferences before GA4
 * sends its first pings — avoids a flash of consent-denied pings for
 * returning users who already accepted.
 *
 * `url_passthrough` preserves `gclid`, `gbraid`, `wbraid` across navigation
 * in denied state so attribution still works after consent is granted.
 * `ads_data_redaction` strips PII from ad pings when denied.
 */
const CONSENT_DEFAULT_WAIT_MS = 500;

function buildConsentDefaults(): string {
  const defaults = CONSENT_SIGNALS.reduce<Record<string, string>>((acc, key) => {
    acc[key] = "denied";
    return acc;
  }, {});
  const payload = {
    ...defaults,
    wait_for_update: CONSENT_DEFAULT_WAIT_MS,
  };
  return [
    "window.dataLayer = window.dataLayer || [];",
    "function gtag(){dataLayer.push(arguments);}",
    `gtag('consent','default',${JSON.stringify(payload)});`,
    "gtag('set','url_passthrough',true);",
    "gtag('set','ads_data_redaction',true);",
  ].join("");
}

/**
 * Official GTM loader snippet, parameterised with our container ID.
 * Kept separate from the consent defaults so the two can render as distinct
 * `<script>` nodes in `<head>` with deterministic execution order.
 */
function buildGtmLoader(id: string): string {
  return (
    "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':" +
    "new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0]," +
    "j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=" +
    "'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);" +
    `})(window,document,'script','dataLayer','${id}');`
  );
}

/**
 * URL for the GTM <noscript> fallback iframe (shown when JS is disabled).
 * Used by layout to render the iframe just after <body> opens.
 */
export function getGtmNoScriptSrc(): string {
  return `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`;
}

export function getConsentDefaultsScript(): string {
  return buildConsentDefaults();
}

export function getGtmLoaderScript(): string {
  return buildGtmLoader(GTM_ID);
}
