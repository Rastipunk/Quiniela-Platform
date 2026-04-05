/**
 * Internationalization (i18n) — Verify all 3 locales render correctly.
 *
 * Tests:
 * 1. Each locale variant of key pages loads with HTTP 200
 * 2. Content changes between locales (not same text)
 * 3. HTML lang attribute matches the locale
 * 4. No raw i18n keys visible (patterns like "pool.invite.createCode")
 */

import { test, expect } from "@playwright/test";
import { PUBLIC_PAGES } from "./helpers/pages";

const LOCALES = ["es", "en", "pt"] as const;

// Select representative pages to test across all locales
// (testing ALL pages × 3 locales would be ~60+ tests — focus on diversity)
const PAGES_TO_TEST = PUBLIC_PAGES.filter((p) =>
  ["home", "faq", "how-it-works", "pricing", "wc2026-hub", "wc2026-predictions"].includes(p.id)
);

test.describe("i18n: locale variants load", () => {
  for (const pageDef of PAGES_TO_TEST) {
    for (const locale of LOCALES) {
      const path = pageDef.paths[locale];
      test(`${pageDef.id} loads in ${locale.toUpperCase()} (${path})`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status(), `${path} returned ${response?.status()}`).toBe(200);

        // h1 should exist and have content
        const h1 = page.locator("h1").first();
        await expect(h1).toBeVisible();
      });
    }
  }
});

test.describe("i18n: HTML lang attribute", () => {
  test("Spanish page has lang=es", async ({ page }) => {
    await page.goto("/");
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBe("es");
  });

  test("English page has lang=en", async ({ page }) => {
    await page.goto("/en");
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBe("en");
  });

  test("Portuguese page has lang=pt", async ({ page }) => {
    await page.goto("/pt");
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBe("pt");
  });
});

test.describe("i18n: content differs between locales", () => {
  test("home page h1 is different in ES vs EN", async ({ page }) => {
    await page.goto("/");
    const esH1 = await page.locator("h1").first().textContent();

    await page.goto("/en");
    const enH1 = await page.locator("h1").first().textContent();

    expect(esH1).not.toBe(enH1);
  });

  test("WC2026 hub h1 is different in ES vs EN", async ({ page }) => {
    await page.goto("/mundial-2026");
    const esH1 = await page.locator("h1").first().textContent();

    await page.goto("/en/world-cup-2026");
    const enH1 = await page.locator("h1").first().textContent();

    expect(esH1).not.toBe(enH1);
  });
});

test.describe("i18n: no raw translation keys", () => {
  // Raw keys look like "pool.invite.createCode" or "auth.loginTitle"
  const RAW_KEY_PATTERN = /\b[a-z]+\.[a-z]+\.[a-zA-Z]+/;

  for (const pageDef of PAGES_TO_TEST) {
    test(`${pageDef.id}: no raw keys in ES`, async ({ page }) => {
      await page.goto(pageDef.paths.es);
      const body = await page.locator("body").textContent() || "";

      // Find potential raw keys
      const matches = body.match(new RegExp(RAW_KEY_PATTERN, "g")) || [];

      // Filter out legitimate patterns (URLs, domain names, version numbers)
      const suspicious = matches.filter(
        (m) =>
          !m.includes("picks4all") &&
          !m.includes("google.com") &&
          !m.includes("api.") &&
          !m.includes("www.") &&
          !m.includes("v0.") &&
          !m.includes("schema.org")
      );

      expect(suspicious, `Raw i18n keys found: ${suspicious.join(", ")}`).toHaveLength(0);
    });
  }
});
