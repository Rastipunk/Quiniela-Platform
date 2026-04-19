/**
 * Meta Pixel — consent-gated Facebook/Instagram tracking.
 *
 * All functions are no-ops if NEXT_PUBLIC_META_PIXEL_ID is not set
 * or if the pixel script has not been loaded (consent denied).
 */

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

let initialized = false;

/**
 * Inject the Meta Pixel base code and call fbq('init').
 * Does NOT fire PageView — call trackMetaEvent('PageView') separately.
 */
export function initMetaPixel(): void {
  if (!PIXEL_ID || initialized) return;
  if (typeof window === "undefined") return;

  // Meta Pixel base code (minified version from Meta docs)
  const n = (window.fbq = function (...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    n.callMethod ? n.callMethod(...args) : n.queue.push(args);
  } as unknown as Window["fbq"] & { callMethod?: Function; queue: unknown[][]; loaded: boolean; version: string; push: Function });
  const f = window._fbq;
  if (f && f !== n) return; // another pixel instance already loaded
  (n as any).push = n;
  (n as any).loaded = true;
  (n as any).version = "2.0";
  (n as any).queue = (n as any).queue || [];

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  const first = document.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(script, first);

  window.fbq("init", PIXEL_ID);
  window.fbq("consent", "grant");
  initialized = true;
}

/**
 * Fire a Meta standard event (e.g. 'PageView', 'Lead', 'Purchase').
 */
export function trackMetaEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.fbq || !PIXEL_ID) return;
  window.fbq("track", event, params);
}

/**
 * Fire a Meta custom event (e.g. 'PoolCreated', 'PoolJoined').
 */
export function trackMetaCustomEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.fbq || !PIXEL_ID) return;
  window.fbq("trackCustom", event, params);
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase().trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Send hashed user data for Advanced Matching.
 * Call after login/register when user data is available.
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
  if (typeof window === "undefined" || !window.fbq || !PIXEL_ID) return;

  const userData: Record<string, string> = {};
  if (data.email) userData.em = await sha256(data.email);
  if (data.firstName) userData.fn = await sha256(data.firstName);
  if (data.lastName) userData.ln = await sha256(data.lastName);
  if (data.country) userData.ct = data.country.toLowerCase();
  if (data.gender) userData.ge = data.gender === "MALE" ? "m" : data.gender === "FEMALE" ? "f" : "";
  if (data.dateOfBirth) userData.db = data.dateOfBirth.replace(/-/g, "");
  if (data.externalId) userData.external_id = await sha256(data.externalId);

  window.fbq("init", PIXEL_ID, userData);
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
