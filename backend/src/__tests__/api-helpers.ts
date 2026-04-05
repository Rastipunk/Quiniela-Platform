/**
 * API Integration Test Helpers
 *
 * These tests call the REAL production API (api.picks4all.com).
 * They use a dedicated test account and only perform READ operations
 * or operations that are safely reversible (create + delete).
 *
 * Environment:
 *   API_BASE_URL=https://api.picks4all.com (default)
 *   E2E_TEST_EMAIL=e2e-test@picks4all.com
 *   E2E_TEST_PASSWORD=E2eTest2026!
 */

const API = process.env.API_BASE_URL || "https://api.picks4all.com";

export interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Headers;
  cookies: Record<string, string>;
}

/**
 * Make an HTTP request to the API.
 * Returns status, parsed JSON data, headers, and extracted cookies.
 */
export async function api<T = any>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options?: {
    body?: Record<string, unknown>;
    cookie?: string;
  }
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.cookie) {
    headers["Cookie"] = options.cookie;
  }

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });

  const data = await res.json().catch(() => null);

  // Parse Set-Cookie header
  const cookies: Record<string, string> = {};
  const setCookie = res.headers.get("set-cookie") || "";
  for (const part of setCookie.split(",")) {
    const match = part.match(/([^=]+)=([^;]+)/);
    if (match) cookies[match[1].trim()] = match[2].trim();
  }

  return { status: res.status, data: data as T, headers: res.headers, cookies };
}

/**
 * Login as the test user and return the auth cookie string.
 */
export async function loginTestUser(): Promise<{ cookie: string; userId: string }> {
  const email = process.env.E2E_TEST_EMAIL || "e2e-test@picks4all.com";
  const password = process.env.E2E_TEST_PASSWORD || "E2eTest2026!";

  const res = await api("POST", "/auth/login", {
    body: { email, password },
  });

  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.data)}`);
  }

  const token = res.cookies["p4a_token"];
  if (!token) {
    throw new Error("No p4a_token cookie in login response");
  }

  return {
    cookie: `p4a_token=${token}; p4a_logged_in=1`,
    userId: res.data?.user?.id || "",
  };
}
