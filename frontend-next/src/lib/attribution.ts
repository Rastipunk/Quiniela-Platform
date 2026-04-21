/**
 * Marketing attribution capture — reads acquisition parameters from the
 * first URL the user lands on and persists them in sessionStorage so the
 * signup request can send them to the backend, where they become
 * first-touch attribution on the `User` row.
 *
 * First-touch wins: once stored, we NEVER overwrite with later visits in
 * the same session. This matches how GA4, Meta, and Google Ads all reason
 * about conversion attribution.
 */

const STORAGE_KEY = "p4a_attribution";

// Keys we capture. UTM set is canonical; click-IDs are what Google/Meta
// use to tie a paid click back to its ad. Every field is optional.
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "fbclid"] as const;

export type UtmKey = (typeof UTM_KEYS)[number];
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];

export interface AttributionData {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  landingPath?: string;
  referrerUrl?: string;
  /** Epoch ms when this attribution row was first captured. */
  capturedAt?: number;
}

function safeParse(raw: string | null): AttributionData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as AttributionData) : null;
  } catch {
    return null;
  }
}

function readStored(): AttributionData | null {
  if (typeof window === "undefined") return null;
  try {
    return safeParse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStored(data: AttributionData): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage blocked — attribution won't survive navigation but
    // will still apply if the signup happens on the same page load.
  }
}

/**
 * Parse the current URL + referrer and merge with whatever is already
 * stored (first-touch wins). Returns the resulting snapshot so callers
 * can inspect it immediately without reading storage again.
 *
 * Safe to call on every page load — noop if nothing new to capture.
 */
export function captureAttribution(): AttributionData | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const params = url.searchParams;

  const incoming: AttributionData = {};
  let hasAny = false;

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      // Drop the leading `utm_` to keep the stored shape flat.
      (incoming as Record<string, string>)[key.slice(4)] = value.slice(0, 200);
      hasAny = true;
    }
  }
  for (const key of CLICK_ID_KEYS) {
    const value = params.get(key);
    if (value) {
      (incoming as Record<string, string>)[key] = value.slice(0, 200);
      hasAny = true;
    }
  }

  const stored = readStored();

  // No incoming attribution AND nothing stored yet → capture the bare
  // landing context (path + referrer) so we at least know the surface.
  if (!hasAny && !stored) {
    const seed: AttributionData = {
      landingPath: url.pathname,
      referrerUrl: document.referrer || undefined,
      capturedAt: Date.now(),
    };
    writeStored(seed);
    return seed;
  }

  if (!hasAny) return stored;

  // First-touch: if we already have any meaningful channel signal
  // stored, keep it. `medium` counts because an organic visit with
  // `utm_medium=email` but no `utm_source` is still a real first touch
  // — otherwise a later CPC visit would overwrite it and skew the
  // acquisition cohort.
  if (stored && (stored.source || stored.medium || stored.campaign || stored.gclid || stored.fbclid)) {
    return stored;
  }

  const merged: AttributionData = {
    ...stored,
    ...incoming,
    landingPath: stored?.landingPath ?? url.pathname,
    referrerUrl: stored?.referrerUrl ?? (document.referrer || undefined),
    capturedAt: stored?.capturedAt ?? Date.now(),
  };
  writeStored(merged);
  return merged;
}

/** Read the stored attribution snapshot without mutating it. */
export function getAttribution(): AttributionData | null {
  return readStored();
}

/** Clear the stored attribution. Call on successful signup after it has
 *  been forwarded to the backend — prevents re-sending on login events. */
export function clearAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Shape the stored attribution into the payload the backend signup
 * endpoint accepts. Returns `undefined` if nothing useful to send —
 * spares an empty object in JSON over the wire.
 */
export function getAttributionPayload(): Record<string, string> | undefined {
  const data = readStored();
  if (!data) return undefined;
  const payload: Record<string, string> = {};
  if (data.source) payload.source = data.source;
  if (data.medium) payload.medium = data.medium;
  if (data.campaign) payload.campaign = data.campaign;
  if (data.content) payload.content = data.content;
  if (data.term) payload.term = data.term;
  if (data.gclid) payload.gclid = data.gclid;
  if (data.gbraid) payload.gbraid = data.gbraid;
  if (data.wbraid) payload.wbraid = data.wbraid;
  if (data.fbclid) payload.fbclid = data.fbclid;
  if (data.landingPath) payload.landingPath = data.landingPath;
  if (data.referrerUrl) payload.referrerUrl = data.referrerUrl;
  return Object.keys(payload).length > 0 ? payload : undefined;
}
