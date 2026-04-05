/**
 * Navigation — Verify all navigation links work correctly.
 *
 * Tests:
 * 1. Public NavBar links resolve to real pages (not 404)
 * 2. Footer links resolve to real pages
 * 3. World Cup hub sub-page pills link to valid pages
 * 4. No broken internal links on key pages
 */

import { test, expect } from "@playwright/test";

test.describe("Public NavBar", () => {
  test("all nav links return 200", async ({ page }) => {
    await page.goto("/");
    const navLinks = await page.locator("nav a[href]").all();
    expect(navLinks.length).toBeGreaterThan(3);

    for (const link of navLinks) {
      const href = await link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http")) continue;
      // Skip authenticated routes — they redirect to login
      if (href.includes("/dashboard") || href.includes("/pools/") || href.includes("/profile") || href.includes("/admin") || href.includes("/crear-pool") || href.includes("/create-pool")) continue;

      const response = await page.request.get(href);
      expect(response.status(), `NavBar link ${href} broken`).toBe(200);
    }
  });
});

test.describe("Footer", () => {
  test("all footer links return 200", async ({ page }) => {
    await page.goto("/");
    const footerLinks = await page.locator("footer a[href]").all();
    expect(footerLinks.length).toBeGreaterThan(3);

    for (const link of footerLinks) {
      const href = await link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("http")) continue;

      const response = await page.request.get(href);
      expect(response.status(), `Footer link ${href} broken`).toBe(200);
    }
  });
});

test.describe("World Cup Hub navigation pills", () => {
  test("all sub-page pills link to valid pages", async ({ page }) => {
    await page.goto("/mundial-2026");
    const pills = await page.locator("nav a[href*='mundial-2026']").all();
    // Hub has 7 sub-page pills (may be in multiple navs — at least 6 unique)
    expect(pills.length).toBeGreaterThanOrEqual(6);

    const checked = new Set<string>();
    for (const pill of pills) {
      const href = await pill.getAttribute("href");
      if (!href || checked.has(href)) continue;
      checked.add(href);

      const response = await page.request.get(href);
      expect(response.status(), `WC2026 pill ${href} broken`).toBe(200);
    }
  });
});

test.describe("Internal links on key pages", () => {
  const pagesToCheck = [
    { path: "/", name: "Home" },
    { path: "/mundial-2026", name: "WC2026 Hub" },
    { path: "/faq", name: "FAQ" },
    { path: "/como-funciona", name: "How it works" },
  ];

  for (const { path, name } of pagesToCheck) {
    test(`${name}: no broken internal links`, async ({ page }) => {
      await page.goto(path);
      const allLinks = await page.locator("a[href^='/']").all();

      const checked = new Set<string>();
      const broken: string[] = [];

      for (const link of allLinks) {
        const href = await link.getAttribute("href");
        if (!href || checked.has(href) || href.includes("/pools/") || href.includes("/dashboard") || href.includes("/profile")) continue;
        checked.add(href);

        try {
          const response = await page.request.get(href);
          if (response.status() !== 200) {
            broken.push(`${href} → ${response.status()}`);
          }
        } catch {
          broken.push(`${href} → request failed`);
        }
      }

      expect(broken, `Broken links on ${name}`).toHaveLength(0);
    });
  }
});
