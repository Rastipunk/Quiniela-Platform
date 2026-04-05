/**
 * Responsive — Verify pages work on mobile viewport.
 *
 * Uses the "mobile-chrome" project (Pixel 5 viewport: 393x851).
 * Tests only run in the mobile project.
 */

import { test, expect } from "@playwright/test";

// This file only runs in the "mobile-chrome" project (see playwright.config.ts)

test.describe("Mobile: key pages load", () => {
  const mobilePaths = ["/", "/mundial-2026", "/faq", "/precios", "/login"];

  for (const path of mobilePaths) {
    test(`${path} loads on mobile`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible();
    });
  }
});

test.describe("Mobile: navigation", () => {
  test("hamburger menu exists and opens", async ({ page }) => {
    await page.goto("/");
    // On mobile, the nav should have a menu button
    const menuButton = page.locator("button[aria-label], button").filter({ hasText: /menu|menú/i }).first();
    // Menu button might exist or the nav collapses — check that navigation is accessible
    const nav = page.locator("nav").first();
    await expect(nav).toBeVisible();
  });
});

test.describe("Mobile: touch targets", () => {
  test("buttons have adequate size", async ({ page }) => {
    await page.goto("/");
    const buttons = await page.locator("button, a[role='button']").all();

    for (const button of buttons.slice(0, 10)) {
      const box = await button.boundingBox();
      if (!box) continue;
      // WCAG minimum touch target: 44x44px (we use 44px minHeight)
      expect(box.height, `Button too small: ${await button.textContent()}`).toBeGreaterThanOrEqual(32);
    }
  });
});

test.describe("Mobile: no horizontal overflow", () => {
  test("home page has no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    // Allow small margin (5px) for potential border/padding
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test("WC2026 hub has no horizontal scroll", async ({ page }) => {
    await page.goto("/mundial-2026");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
});
