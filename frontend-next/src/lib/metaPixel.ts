/**
 * Meta Pixel — consent-gated Facebook/Instagram tracking.
 *
 * Architecture:
 *   1. initMetaPixel() injects the fbevents.js script from Meta's CDN
 *   2. fbevents.js creates the real window.fbq when it loads
 *   3. Events fired before the script loads are queued internally
 *   4. On script load: init pixel, grant consent, flush queue
 *
 * This avoids creating a manual fbq stub, which prevents conflicts
 * with browser extensions (e.g. Meta Pixel Helper) that inject their
 * own window.fbq before our code runs.
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
let scriptReady = false;
const eventQueue: unknown[][] = [];

function getStoredUserData(): Record<string, string> | undefined {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function enqueueFbq(...args: unknown[]): void {
  if (scriptReady && typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq(...args);
  } else {
    eventQueue.push(args);
  }
}

function flushEventQueue(): void {
  scriptReady = true;
  while (eventQueue.length > 0) {
    const args = eventQueue.shift()!;
    if (typeof window.fbq === "function") {
      window.fbq(...args);
    }
  }
}

/**
 * Load fbevents.js from Meta's CDN and initialize the pixel.
 * Includes stored Advanced Matching data if available.
 * Does NOT fire PageView — call trackMetaEvent('PageView') separately.
 */
export function initMetaPixel(): void {
  if (!PIXEL_ID || initialized) return;
  if (typeof window === "undefined") return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  script.onload = () => {
    const storedUserData = getStoredUserData();
    if (storedUserData) {
      window.fbq("init", PIXEL_ID, storedUserData);
    } else {
      window.fbq("init", PIXEL_ID);
    }
    window.fbq("consent", "grant");
    flushEventQueue();
  };
  script.onerror = () => {
    initialized = false;
  };
  document.head.appendChild(script);
}

/**
 * Fire a Meta standard event (e.g. 'PageView', 'Lead', 'Purchase').
 */
export function trackMetaEvent(event: string, params?: Record<string, unknown>): void {
  if (!PIXEL_ID) return;
  if (params) {
    enqueueFbq("track", event, params);
  } else {
    enqueueFbq("track", event);
  }
}

/**
 * Fire a Meta custom event (e.g. 'PoolCreated', 'PoolJoined').
 */
export function trackMetaCustomEvent(event: string, params?: Record<string, unknown>): void {
  if (!PIXEL_ID) return;
  if (params) {
    enqueueFbq("trackCustom", event, params);
  } else {
    enqueueFbq("trackCustom", event);
  }
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase().trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash and store user data for Advanced Matching.
 * Data is persisted in localStorage and included in the next fbq('init')
 * call (on page reload), avoiding the duplicate pixel warning.
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
