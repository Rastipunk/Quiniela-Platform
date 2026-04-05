/**
 * Auth helpers for E2E tests.
 *
 * Authenticated tests need a valid JWT token. There are two approaches:
 *
 * 1. **API login** (preferred): Call the backend login endpoint directly
 *    to get a token. Requires test credentials in env vars.
 *
 * 2. **Stored auth state**: Use Playwright's storageState to persist
 *    auth cookies across tests (faster, no login per test).
 *
 * Environment variables (set in .env or CLI):
 *   E2E_TEST_EMAIL=test-e2e@picks4all.com
 *   E2E_TEST_PASSWORD=<test password>
 *
 * These are NOT committed to git. Create them once per environment.
 */

import { request } from "@playwright/test";

const API_URL = process.env.BASE_URL
  ? process.env.BASE_URL.replace("picks4all.com", "api.picks4all.com")
  : "https://api.picks4all.com";

export interface AuthSession {
  token: string;
  userId: string;
}

/**
 * Login via API and return JWT token.
 * Uses E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars.
 */
export async function loginAsTestUser(): Promise<AuthSession> {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars required for authenticated tests. " +
      "Set them in frontend-next/.env.local or pass via CLI."
    );
  }

  const ctx = await request.newContext({ baseURL: API_URL });

  const response = await ctx.post("/auth/login", {
    data: { email, password },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Login failed (${response.status()}): ${body}`);
  }

  const data = await response.json();

  // Token is in Set-Cookie header (HTTP-only cookie), not in response body
  const cookies = response.headers()["set-cookie"] || "";
  const tokenMatch = cookies.match(/p4a_token=([^;]+)/);
  const token = tokenMatch?.[1] || "";

  await ctx.dispose();

  return {
    token,
    userId: data.user?.id || data.userId || "",
  };
}

/**
 * Set auth cookies/localStorage on a Playwright page.
 * Call this before navigating to authenticated pages.
 */
export async function authenticatePage(
  page: any,
  session: AuthSession
): Promise<void> {
  const baseURL = process.env.BASE_URL || "https://picks4all.com";

  // Set the token cookie (matches authCookies.ts pattern)
  await page.context().addCookies([
    {
      name: "p4a_token",
      value: session.token,
      domain: new URL(baseURL).hostname,
      path: "/",
      httpOnly: true,
      secure: baseURL.startsWith("https"),
      sameSite: "Lax",
    },
    {
      name: "p4a_logged_in",
      value: "1",
      domain: new URL(baseURL).hostname,
      path: "/",
      httpOnly: false,
      secure: baseURL.startsWith("https"),
      sameSite: "Lax",
    },
  ]);
}

/**
 * Make an authenticated API request.
 */
export async function apiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  token: string,
  body?: Record<string, unknown>
): Promise<any> {
  const ctx = await request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: {
      // Use both cookie and Bearer header — backend accepts either
      Cookie: `p4a_token=${token}; p4a_logged_in=1`,
      Authorization: `Bearer ${token}`,
    },
  });
  const options: any = {};
  if (body) options.data = body;

  const response = await ctx[method.toLowerCase() as "get" | "post" | "put" | "delete"](path, options);
  const data = await response.json().catch(() => null);
  await ctx.dispose();

  return { status: response.status(), data };
}
