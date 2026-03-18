// Shared HTTP client for all API modules
import { clearToken, getToken, markSessionExpired } from "../auth";
import { ApiError } from "../apiError";

function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  if (typeof window !== "undefined" && window.location.hostname.includes("railway.app")) {
    return "https://quiniela-platform-production.up.railway.app";
  }

  return "http://localhost:3000";
}

export const API_BASE = getApiBase();

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
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
