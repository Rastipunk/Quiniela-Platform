/**
 * Meta Pixel — consent-gated Facebook/Instagram tracking.
 *
 * Uses the official Meta Pixel stub pattern: a lightweight queue function
 * is created as window.fbq BEFORE fbevents.js loads. The stub queues all
 * fbq() calls. When fbevents.js executes, it processes the queue and
 * replaces the stub with the real implementation.
 *
 * All functions are no-ops if NEXT_PUBLIC_META_PIXEL_ID is not set.
 */

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const USER_DATA_KEY = "p4a_meta_ud";

let initialized = false;

function getStoredUserData(): Record<string, string> | undefined {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Load fbevents.js from Meta's CDN and initialize the pixel.
 * Creates the official fbq stub first, then loads the script.
 * Does NOT fire PageView — call trackMetaEvent('PageView') separately.
 */
export function initMetaPixel(): void {
  if (!PIXEL_ID || initialized) return;
  if (typeof window === "undefined") return;
  initialized = true;

  // Official Meta Pixel stub — queues calls until fbevents.js loads
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n: any = (window.fbq = function (...args: unknown[]) {
    if (n.callMethod) {
      n.callMethod(...args);
    } else {
      n.queue.push(args);
    }
  });
  window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [] as unknown[][];

  // Init pixel through the stub (queued, processed when script loads)
  const storedUserData = getStoredUserData();
  if (storedUserData) {
    window.fbq("init", PIXEL_ID, storedUserData);
  } else {
    window.fbq("init", PIXEL_ID);
  }
  window.fbq("consent", "grant");

  // Load fbevents.js
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  script.onerror = () => {
    initialized = false;
  };
  document.head.appendChild(script);
}

/**
 * Revoke Meta Pixel consent. Stops all further data collection from the
 * pixel until `initMetaPixel()` runs again with granted consent.
 *
 * Meta does NOT honour Google Consent Mode v2 signals — it requires this
 * explicit `fbq('consent', 'revoke')` command. Also clears stored user
 * data so logout/reject on a shared device does not leak PII to the next
 * session.
 *
 * @see https://developers.facebook.com/docs/meta-pixel/implementation/gdpr
 */
export function revokeMetaPixelConsent(): void {
  if (typeof window === "undefined") return;
  if (typeof window.fbq === "function") {
    window.fbq("consent", "revoke");
  }
  try {
    localStorage.removeItem(USER_DATA_KEY);
  } catch {
    // localStorage may be disabled — nothing to clear.
  }
}

/**
 * Generate a unique event ID for browser/CAPI deduplication.
 */
export function generateEventId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Fire a Meta standard event (e.g. 'PageView', 'Lead', 'Purchase').
 * Pass eventId for browser/CAPI deduplication on events also sent server-side.
 * Safe to call before fbevents.js loads — the stub queues the call.
 */
export function trackMetaEvent(event: string, params?: Record<string, unknown>, eventId?: string): void {
  if (!PIXEL_ID || typeof window === "undefined" || typeof window.fbq !== "function") return;
  const options = eventId ? { eventID: eventId } : undefined;
  if (params && options) {
    window.fbq("track", event, params, options);
  } else if (params) {
    window.fbq("track", event, params);
  } else if (options) {
    window.fbq("track", event, {}, options);
  } else {
    window.fbq("track", event);
  }
}

/**
 * Fire a Meta custom event (e.g. 'PoolCreated', 'PoolJoined').
 */
export function trackMetaCustomEvent(event: string, params?: Record<string, unknown>): void {
  if (!PIXEL_ID || typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (params) {
    window.fbq("trackCustom", event, params);
  } else {
    window.fbq("trackCustom", event);
  }
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase().trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash and store user data for Advanced Matching.
 * Data is persisted in localStorage (for next page load init) AND
 * applied immediately via fbq('init') if the script is already loaded.
 */
export async function setMetaUserData(data: {
  email?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  gender?: string;
  dateOfBirth?: string;
  externalId?: string;
}): Promise<void> {
  if (typeof window === "undefined" || !PIXEL_ID) return;

  const userData: Record<string, string> = {};
  if (data.email) userData.em = await sha256(data.email);
  if (data.firstName) userData.fn = await sha256(data.firstName);
  if (data.lastName) userData.ln = await sha256(data.lastName);
  if (data.country) userData.ct = data.country.toLowerCase();
  if (data.gender) userData.ge = data.gender === "MALE" ? "m" : data.gender === "FEMALE" ? "f" : "";
  if (data.dateOfBirth) userData.db = data.dateOfBirth.replace(/-/g, "");
  if (data.externalId) userData.external_id = await sha256(data.externalId);

  try {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  } catch { /* localStorage full or blocked */ }

  // Update internal pixel userData directly to avoid "Duplicate Pixel ID" warning.
  // Calling fbq("init") again would trigger the warning from fbevents.js.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = (window.fbq as any)?.instance;
  const pixel = instance?.pixelsByID?.[PIXEL_ID];
  if (pixel) {
    Object.assign(pixel.userData, userData);
  }
}

/**
 * Read Meta cookies (_fbc, _fbp) to pass to backend for CAPI.
 */
export function getMetaCookies(): { fbc?: string; fbp?: string } {
  if (typeof document === "undefined") return {};
  const cookies = document.cookie.split("; ");
  const fbc = cookies.find(c => c.startsWith("_fbc="))?.split("=")[1];
  const fbp = cookies.find(c => c.startsWith("_fbp="))?.split("=")[1];
  return { fbc, fbp };
}
