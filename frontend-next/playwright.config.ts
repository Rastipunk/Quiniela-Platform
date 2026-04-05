import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env.local for test credentials
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

/**
 * Playwright E2E test configuration for Picks4All.
 *
 * Tests run against the PRODUCTION site (picks4all.com) by default.
 * Override with BASE_URL env var for local/staging:
 *   BASE_URL=http://localhost:3000 npx playwright test
 *
 * Structure:
 *   e2e/
 *   ├── public-pages.spec.ts    — All public pages load without errors
 *   ├── seo-metadata.spec.ts    — Title, description, OG, hreflang on every page
 *   ├── navigation.spec.ts      — NavBar, Footer, internal links
 *   ├── i18n.spec.ts            — All 3 locales render translated content
 *   ├── world-cup.spec.ts       — Mundial 2026 hub and sub-pages
 *   ├── responsive.spec.ts      — Mobile viewport tests
 *   └── helpers/
 *       └── pages.ts            — Page registry (URLs, expected metadata)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never" }],
    ["list"],
  ],
  timeout: 30_000,

  use: {
    baseURL: process.env.BASE_URL || "https://picks4all.com",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "es",
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    },
  },

  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/responsive.spec.ts"],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      testMatch: ["**/responsive.spec.ts"],
      testIgnore: ["**/visual-regression.spec.ts"],
    },
  ],
});
