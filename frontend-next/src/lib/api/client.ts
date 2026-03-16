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

export async function requestJson<T>(path: string, init: RequestInit = {}, _token?: string): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" as const });

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

    if (res.status === 401) {
      if (typeof window !== "undefined" && getToken()) {
        markSessionExpired();
      }
      if (typeof window !== "undefined") {
        clearToken();
      }
    }
    throw new ApiError(res.status, errorCode as string, msg as string, data);
  }

  return data as T;
}
