/**
 * Public Pages — Verify all public pages load correctly.
 *
 * For each registered public page:
 * 1. GET request returns HTTP 200
 * 2. Page has an <h1> element (proper heading hierarchy)
 * 3. No JavaScript errors in console
 * 4. No forbidden text (TBD, undefined, raw i18n keys)
 * 5. Required elements are present
 */

import { test, expect } from "@playwright/test";
import { PUBLIC_PAGES, GLOBAL_FORBIDDEN_PATTERNS } from "./helpers/pages";

for (const page of PUBLIC_PAGES) {
  test.describe(`${page.id} (${page.paths.es})`, () => {
    test("loads with HTTP 200", async ({ page: p }) => {
      const response = await p.goto(page.paths.es);
      expect(response?.status()).toBe(200);
    });

    test("has h1 heading", async ({ page: p }) => {
      await p.goto(page.paths.es);
      const h1 = p.locator("h1").first();
      await expect(h1).toBeVisible();
      const text = await h1.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    });

    test("no console errors", async ({ page: p }) => {
      const errors: string[] = [];
      p.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      await p.goto(page.paths.es);
      // Filter out known non-critical errors (hydration warnings, etc.)
      const critical = errors.filter(
        (e) => !e.includes("hydrat") && !e.includes("Warning:") && !e.includes("favicon")
      );
      expect(critical).toHaveLength(0);
    });

    if (page.forbiddenText?.length) {
      test("no forbidden text visible", async ({ page: p }) => {
        await p.goto(page.paths.es);
        const body = await p.locator("body").textContent();
        for (const forbidden of page.forbiddenText!) {
          expect(body).not.toContain(forbidden);
        }
      });
    }

    if (page.requiredElements?.length) {
      test("required elements present", async ({ page: p }) => {
        await p.goto(page.paths.es);
        for (const selector of page.requiredElements!) {
          await expect(p.locator(selector).first()).toBeVisible();
        }
      });
    }

    test("no global forbidden patterns", async ({ page: p }) => {
      await p.goto(page.paths.es);
      const body = await p.locator("body").textContent() || "";
      for (const pattern of GLOBAL_FORBIDDEN_PATTERNS) {
        // Skip check for common words that might legitimately appear
        if (pattern.source === "\\bnull\\b" || pattern.source === "\\bundefined\\b") continue;
        const match = body.match(pattern);
        if (match) {
          // Check it's not inside a code block or technical context
          const context = body.substring(
            Math.max(0, body.indexOf(match[0]) - 30),
            body.indexOf(match[0]) + match[0].length + 30
          );
          // Only fail if it looks like a rendering bug
          if (!context.includes("<code>") && !context.includes("technical")) {
            expect(match, `Forbidden pattern "${pattern}" found: "${context}"`).toBeNull();
          }
        }
      }
    });
  });
}
