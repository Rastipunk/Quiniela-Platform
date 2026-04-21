// frontend-next/src/lib/auth.ts
// Auth state management — uses httpOnly cookies (token set by server).
// The p4a_logged_in cookie (non-httpOnly) is used only as a UI hint.

const LOGGED_IN_COOKIE = "p4a_logged_in";
const SESSION_EXPIRED_KEY = "quiniela.sessionExpired";
const AUTH_EVENT = "quiniela:auth";
// Cross-tab logout signalling. Cookies do NOT emit the `storage` event,
// so other open tabs cannot react to an httpOnly-cookie clear. We piggy-
// back a monotonic timestamp on localStorage to broadcast the change —
// tabs subscribe via `storage` events on this key and flush analytics
// identity + Meta Pixel consent accordingly.
export const AUTH_LOGOUT_BROADCAST_KEY = "p4a_auth_logout_tick";

// Legacy localStorage keys — cleared on first load to complete migration
const LEGACY_TOKEN_KEY = "quiniela.token";
const LEGACY_TOKEN_KEY_2 = "token";

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Returns a truthy string ("1") if the user appears logged in, null otherwise.
 *  NOTE: the actual JWT is in an httpOnly cookie and NOT accessible to JS. */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  // Clean up legacy localStorage tokens on first access
  if (localStorage.getItem(LEGACY_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY_2)) {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY_2);
  }
  return getCookie(LOGGED_IN_COOKIE);
}

/** Called after a successful login/register — the server already set the httpOnly cookie
 *  via Set-Cookie header. We just notify listeners so the UI updates. */
export function setToken(_token?: string) {
  if (typeof window === "undefined") return;
  // Remove legacy localStorage tokens
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY_2);
  localStorage.removeItem(SESSION_EXPIRED_KEY);
  notifyAuthChanged();
}

/** Called on logout — the server already cleared the cookie.
 *  We just notify listeners. */
export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY_2);
  // Broadcast to sibling tabs. A timestamp value guarantees every call
  // produces a distinct `storage` event — `setItem` to the same value
  // is a no-op and wouldn't fire.
  try {
    localStorage.setItem(AUTH_LOGOUT_BROADCAST_KEY, String(Date.now()));
  } catch {
    // localStorage may throw in private mode / quota — best-effort.
  }
  notifyAuthChanged();
}

export function markSessionExpired() {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_EXPIRED_KEY, "1");
}

export function consumeSessionExpiredFlag(): boolean {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem(SESSION_EXPIRED_KEY);
  if (v) localStorage.removeItem(SESSION_EXPIRED_KEY);
  return !!v;
}

export function onAuthChange(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
}
