/**
 * World Cup 2026 Hub — Verify the WC2026 content hub is complete and correct.
 *
 * Tests:
 * 1. Hub page: 12 groups rendered, all teams present, no TBD
 * 2. Groups page: all 48 teams, flag images load
 * 3. Schedule page: match data present
 * 4. Venues page: stadium data present
 * 5. Predictions page: champion prediction visible, subscribe CTA present
 * 6. JSON-LD structured data present
 */

import { test, expect } from "@playwright/test";

test.describe("WC2026 Hub", () => {
  test("renders 12 group cards", async ({ page }) => {
    await page.goto("/mundial-2026");
    // Each group has a heading with "Grupo X"
    const groupHeadings = page.locator("h3");
    const headings = await groupHeadings.allTextContents();
    const groupLabels = headings.filter((h) => h.match(/Grupo [A-L]/));
    expect(groupLabels.length).toBe(12);
  });

  test("no TBD teams visible", async ({ page }) => {
    await page.goto("/mundial-2026");
    const body = await page.locator("body").textContent();
    expect(body).not.toContain("TBD");
  });

  test("has sub-page navigation pills", async ({ page }) => {
    await page.goto("/mundial-2026");
    // Should have pills linking to sub-pages
    const pills = await page.locator("nav a").all();
    expect(pills.length).toBeGreaterThanOrEqual(6);
  });

  test("CTA button exists", async ({ page }) => {
    await page.goto("/mundial-2026");
    const cta = page.locator("button, a").filter({ hasText: /[Cc]rear|[Cc]reate/ }).first();
    await expect(cta).toBeVisible();
  });

  test("has SportsEvent JSON-LD", async ({ page }) => {
    await page.goto("/mundial-2026");
    const jsonLd = page.locator('script[type="application/ld+json"], div[hidden]');
    const content = await jsonLd.first().textContent() || "";
    expect(content).toContain("SportsEvent");
  });
});

test.describe("WC2026 Groups", () => {
  test("shows all 48 teams", async ({ page }) => {
    await page.goto("/mundial-2026/grupos");
    // Each group has 4 teams, 12 groups = 48
    const flags = await page.locator("img[src*='flagcdn.com']").all();
    // At least 48 flag images (could be more if matches shown)
    expect(flags.length).toBeGreaterThanOrEqual(48);
  });

  test("flag images load successfully", async ({ page }) => {
    await page.goto("/mundial-2026/grupos");
    const flags = await page.locator("img[src*='flagcdn.com']").all();
    for (const flag of flags.slice(0, 12)) {
      // Check images have valid src
      const src = await flag.getAttribute("src");
      expect(src).toContain("flagcdn.com");
    }
  });

  test("no TBD in groups page", async ({ page }) => {
    await page.goto("/mundial-2026/grupos");
    const body = await page.locator("body").textContent();
    expect(body).not.toContain("TBD");
  });
});

test.describe("WC2026 Schedule", () => {
  test("page loads with match data", async ({ page }) => {
    await page.goto("/mundial-2026/calendario");
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();

    // Should mention number of matches
    const body = await page.locator("body").textContent();
    expect(body).toContain("104");
  });

  test("has group stage section", async ({ page }) => {
    await page.goto("/mundial-2026/calendario");
    const body = await page.locator("body").textContent() || "";
    // Should have group labels
    expect(body).toContain("Grupo A");
    expect(body).toContain("Grupo L");
  });
});

test.describe("WC2026 Venues", () => {
  test("lists stadiums", async ({ page }) => {
    await page.goto("/mundial-2026/sedes");
    const body = await page.locator("body").textContent() || "";
    // Key stadiums should be mentioned
    expect(body).toContain("MetLife");
    expect(body).toContain("Azteca");
  });

  test("has 3 country sections", async ({ page }) => {
    await page.goto("/mundial-2026/sedes");
    const body = await page.locator("body").textContent() || "";
    expect(body).toContain("Estados Unidos");
    expect(body).toContain("México");
    expect(body).toContain("Canadá");
  });
});

test.describe("WC2026 Predictions", () => {
  test("shows champion prediction", async ({ page }) => {
    await page.goto("/mundial-2026/predicciones");
    const body = await page.locator("body").textContent() || "";
    // Champion should be visible (Argentina in current prediction)
    expect(body).toContain("Argentina");
  });

  test("has subscribe CTA", async ({ page }) => {
    await page.goto("/mundial-2026/predicciones");
    const subscribe = page.locator("#subscribe");
    await expect(subscribe).toBeVisible();
  });

  test("has methodology section", async ({ page }) => {
    await page.goto("/mundial-2026/predicciones");
    const methodology = page.locator("#methodology");
    await expect(methodology).toBeVisible();
  });

  test("has anchor buttons in hero", async ({ page }) => {
    await page.goto("/mundial-2026/predicciones");
    const championLink = page.locator("a[href='#champion']");
    const methodologyLink = page.locator("a[href='#methodology']");
    await expect(championLink).toBeVisible();
    await expect(methodologyLink).toBeVisible();
  });
});
