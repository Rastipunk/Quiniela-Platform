// frontend/src/lib/auth.ts
const TOKEN_KEY = "quiniela.token";
const TOKEN_KEY_LEGACY = "token"; // por si versiones anteriores guardaban así
const SESSION_EXPIRED_KEY = "quiniela.sessionExpired";
const AUTH_EVENT = "quiniela:auth";

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY_LEGACY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY_LEGACY, token);
  localStorage.removeItem(SESSION_EXPIRED_KEY);
  notifyAuthChanged();
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY_LEGACY);
  notifyAuthChanged();
}

export function markSessionExpired() {
  localStorage.setItem(SESSION_EXPIRED_KEY, "1");
}

export function consumeSessionExpiredFlag(): boolean {
  const v = localStorage.getItem(SESSION_EXPIRED_KEY);
  if (v) localStorage.removeItem(SESSION_EXPIRED_KEY);
  return !!v;
}

export function onAuthChange(handler: () => void) {
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
}

