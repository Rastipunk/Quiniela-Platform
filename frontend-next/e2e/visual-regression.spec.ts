import { test, expect } from "@playwright/test";

/**
 * Visual regression tests for Picks4All public pages.
 *
 * First run:  creates baseline screenshots in e2e/visual-regression.spec.ts-snapshots/
 * Later runs: compares against baselines and fails if diff exceeds threshold.
 * Update:     npx playwright test visual-regression --update-snapshots
 *
 * Runs only in desktop-chrome project (mobile viewports produce different layouts).
 */

const VISUAL_PAGES = [
  { name: "home", path: "/", waitFor: "h1" },
  { name: "faq", path: "/faq", waitFor: "h1" },
  { name: "pricing", path: "/precios", waitFor: "h1" },
  { name: "wc2026-hub", path: "/mundial-2026", waitFor: "h1" },
  { name: "wc2026-predictions", path: "/mundial-2026/predicciones", waitFor: "h1" },
  { name: "wc2026-groups", path: "/mundial-2026/grupos", waitFor: "h1" },
  { name: "login", path: "/login", waitFor: "input" },
  { name: "enterprise", path: "/empresas", waitFor: "h1" },
  { name: "invite-invalid", path: "/invite?code=INVALID", waitFor: "body" },
];

test.describe("Visual regression", () => {
  for (const { name, path, waitFor } of VISUAL_PAGES) {
    test(`${name} matches baseline`, async ({ page }) => {
      await page.goto(path);
      await page.locator(waitFor).first().waitFor({ state: "visible" });

      // Allow fonts, images, and lazy-loaded content to settle
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
        animations: "disabled",
      });
    });
  }
});
