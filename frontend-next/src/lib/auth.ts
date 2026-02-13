// frontend-next/src/lib/auth.ts
const TOKEN_KEY = "quiniela.token";
const TOKEN_KEY_LEGACY = "token";
const SESSION_EXPIRED_KEY = "quiniela.sessionExpired";
const AUTH_EVENT = "quiniela:auth";

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY_LEGACY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY_LEGACY, token);
  localStorage.removeItem(SESSION_EXPIRED_KEY);
  notifyAuthChanged();
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY_LEGACY);
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
