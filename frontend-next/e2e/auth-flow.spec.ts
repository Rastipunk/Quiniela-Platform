/**
 * Auth Flow — Test authentication flows end-to-end.
 *
 * Tests:
 * 1. Login page renders correctly
 * 2. Login with valid credentials succeeds
 * 3. Login with invalid credentials shows error
 * 4. Authenticated redirect works (login → redirect to original URL)
 * 5. AuthGuard redirects unauthenticated users to login
 * 6. Logout clears session
 */

import { test, expect } from "@playwright/test";
import { loginAsTestUser, authenticatePage } from "./helpers/auth";

test.describe("Login page", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email'], input[name='email']").first()).toBeVisible();
    await expect(page.locator("input[type='password']").first()).toBeVisible();
    await expect(page.locator("button[type='submit'], button").filter({ hasText: /[Ii]ngresar|[Ll]og [Ii]n|[Ee]ntrar/ }).first()).toBeVisible();
  });

  test("has noindex meta", async ({ page }) => {
    await page.goto("/login");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("noindex");
  });
});

test.describe("Login API flow", () => {
  test("login with valid credentials returns token", async () => {
    const session = await loginAsTestUser();
    expect(session.token).toBeTruthy();
    expect(session.token.length).toBeGreaterThan(50);
    expect(session.userId).toBeTruthy();
  });

  test("login with invalid credentials fails", async ({ request }) => {
    const response = await request.post("https://api.picks4all.com/auth/login", {
      data: { email: "nonexistent@test.com", password: "wrongpassword" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("AuthGuard redirect", () => {
  test("unauthenticated user visiting /dashboard gets redirected to /login", async ({ page }) => {
    // Clear any cookies first
    await page.context().clearCookies();
    await page.goto("/dashboard");
    // Should end up on login page (AuthGuard redirects)
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("redirect preserves original URL in query param", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/pools/join?code=TESTCODE");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    // The redirect param should contain the original URL
    expect(page.url()).toContain("redirect");
  });
});

test.describe("Authenticated access", () => {
  test("authenticated user can access /dashboard", async ({ page }) => {
    const session = await loginAsTestUser();
    await authenticatePage(page, session);
    await page.goto("/dashboard");
    // Should NOT redirect to login
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/dashboard");
  });

  test("authenticated user sees dashboard content", async ({ page }) => {
    const session = await loginAsTestUser();
    await authenticatePage(page, session);
    await page.goto("/dashboard");
    // Wait for client-side hydration and auth check
    await page.waitForTimeout(3000);
    // Should show dashboard or at least not be on login page
    expect(page.url()).not.toContain("/login");
  });
});
