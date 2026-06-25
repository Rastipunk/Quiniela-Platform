// Shared HTTP client for all API modules
import { clearToken, getToken, markSessionExpired } from "../auth";
import { ApiError } from "../apiError";

function getApiBase(): string {
  // Primary: always prefer the env var (set in Railway for both services)
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  // Fallback for local development only
  return "http://localhost:3000";
}

export const API_BASE = getApiBase();

// Silent session refresh (ADR-081). A 401 on a normal call triggers ONE
// /auth/refresh attempt — shared across concurrent 401s so a burst refreshes
// once — then the original request is retried a single time. Persistent
// ("remember me") sessions refresh transparently; non-persistent sessions have
// no refresh cookie, so /auth/refresh 401s → the existing logout path runs
// (unchanged 4h behaviour).
let refreshInFlight: Promise<boolean> | null = null;

function attemptRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const r = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// Auth-flow endpoints must never trigger the refresh-retry (would loop or be
// meaningless — these establish/clear the session themselves).
function isAuthFlowPath(path: string): boolean {
  return (
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/logout") ||
    path.startsWith("/auth/register") ||
    path.startsWith("/auth/google")
  );
}

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  _retried = false,
): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const timeout = 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include" as const,
      signal: init.signal ?? controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError" && !init.signal) {
      throw new ApiError(0, "TIMEOUT", "Request timed out after 30 seconds");
    }
    throw err;
  }
  clearTimeout(timer);

  // Silent refresh: a 401 on a normal call → refresh once → retry once.
  if (
    res.status === 401 &&
    typeof window !== "undefined" &&
    !_retried &&
    !isAuthFlowPath(path)
  ) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return requestJson<T>(path, init, true);
    }
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const errorCode =
      (data && typeof data === "object" && (data as Record<string, unknown>).error as string) || `HTTP_${res.status}`;
    const msg =
      (data && typeof data === "object" && ((data as Record<string, unknown>).error || (data as Record<string, unknown>).message)) ||
      (typeof data === "string" && data) ||
      `HTTP ${res.status}`;

    if (res.status === 401 && typeof window !== "undefined") {
      const hadToken = !!getToken();
      clearToken();
      if (hadToken) {
        markSessionExpired();
      }
    }
    throw new ApiError(res.status, errorCode as string, msg as string, data);
  }

  return data as T;
}
