/**
 * Prediction Subscription — Test the AI predictor subscription flow.
 *
 * Tests:
 * 1. Predictions page has subscribe section
 * 2. Subscribe button visible (unauthenticated → shows create account)
 * 3. API toggle endpoint works
 * 4. Subscription status can be read
 */

import { test, expect } from "@playwright/test";
import { loginAsTestUser, apiRequest } from "./helpers/auth";

test.describe("Prediction subscribe UI", () => {
  test("predictions page has #subscribe section", async ({ page }) => {
    await page.goto("/mundial-2026/predicciones");
    const subscribe = page.locator("#subscribe");
    await expect(subscribe).toBeVisible();
  });

  test("subscribe section has a button", async ({ page }) => {
    await page.goto("/mundial-2026/predicciones");
    const subscribeSection = page.locator("#subscribe");
    const button = subscribeSection.locator("button").first();
    await expect(button).toBeVisible();
  });

  test("hero has subscribe pitch card", async ({ page }) => {
    await page.goto("/mundial-2026/predicciones");
    // The subscribe pitch in hero links to #subscribe
    const pitchLink = page.locator("a[href='#subscribe']");
    await expect(pitchLink).toBeVisible();
  });
});

test.describe("Prediction subscribe API", () => {
  test("GET /me/prediction-subscription returns status", async () => {
    const session = await loginAsTestUser();
    const { status, data } = await apiRequest("GET", "/me/prediction-subscription", session.token);
    expect(status).toBe(200);
    expect(typeof data.enabled).toBe("boolean");
  });

  test("PUT /me/prediction-subscription toggles subscription", async () => {
    const session = await loginAsTestUser();

    // Get current status
    const { data: before } = await apiRequest("GET", "/me/prediction-subscription", session.token);
    const wasBefore = before.enabled;

    // Toggle
    const { status, data: after } = await apiRequest(
      "PUT", "/me/prediction-subscription", session.token,
      { enabled: !wasBefore }
    );
    expect(status).toBe(200);
    expect(after.enabled).toBe(!wasBefore);

    // Toggle back to original
    await apiRequest("PUT", "/me/prediction-subscription", session.token, { enabled: wasBefore });
  });
});
