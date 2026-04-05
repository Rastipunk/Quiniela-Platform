# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> Mobile: key pages load >> /login loads on mobile
- Location: e2e\responsive.spec.ts:16:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h1').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e3]:
    - generic [ref=e4]: Beta — Tu feedback nos ayuda
    - generic [ref=e5]:
      - button "Reportar Bug" [ref=e6] [cursor=pointer]
      - button "Sugerencia" [ref=e7] [cursor=pointer]
  - generic [ref=e9]:
    - generic [ref=e10]: Picks4All
    - generic [ref=e11]: Entra a tu cuenta o crea una nueva para unirte o crear pools.
    - generic [ref=e12]:
      - button "Entrar" [ref=e13] [cursor=pointer]
      - button "Crear cuenta" [ref=e14] [cursor=pointer]
    - generic [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e17]: Email
        - textbox "Email" [ref=e18]:
          - /placeholder: tu@email.com
      - generic [ref=e19]:
        - generic [ref=e20]: Contraseña
        - textbox "Contraseña Mínimo 8 caracteres, 1 mayúscula, 1 número" [ref=e21]
        - generic [ref=e22]: Mínimo 8 caracteres, 1 mayúscula, 1 número
      - link "¿Olvidaste tu contraseña?" [ref=e24] [cursor=pointer]:
        - /url: /forgot-password
      - button "Entrar" [ref=e25] [cursor=pointer]
    - generic [ref=e26]:
      - generic [ref=e29]: o continúa con
      - iframe [ref=e33]:
        - button "Iniciar sesión con Google. Se abre en una pestaña nueva." [ref=f1e3] [cursor=pointer]:
          - generic [ref=f1e5]:
            - img [ref=f1e7]
            - generic [ref=f1e14]: Iniciar sesión con Google
    - generic [ref=e34]:
      - paragraph [ref=e35]:
        - text: Al continuar aceptas los
        - link "Términos de Servicio" [ref=e36] [cursor=pointer]:
          - /url: /terminos
        - text: "y"
        - link "Política de Privacidad" [ref=e37] [cursor=pointer]:
          - /url: /privacidad
        - text: .
      - paragraph [ref=e38]: Esta plataforma es solo para entretenimiento. No involucra dinero real ni apuestas.
  - alert [ref=e39]
```

# Test source

```ts
  1  | /**
  2  |  * Responsive — Verify pages work on mobile viewport.
  3  |  *
  4  |  * Uses the "mobile-chrome" project (Pixel 5 viewport: 393x851).
  5  |  * Tests only run in the mobile project.
  6  |  */
  7  | 
  8  | import { test, expect } from "@playwright/test";
  9  | 
  10 | // This file only runs in the "mobile-chrome" project (see playwright.config.ts)
  11 | 
  12 | test.describe("Mobile: key pages load", () => {
  13 |   const mobilePaths = ["/", "/mundial-2026", "/faq", "/precios", "/login"];
  14 | 
  15 |   for (const path of mobilePaths) {
  16 |     test(`${path} loads on mobile`, async ({ page }) => {
  17 |       const response = await page.goto(path);
  18 |       expect(response?.status()).toBe(200);
  19 | 
  20 |       const h1 = page.locator("h1").first();
> 21 |       await expect(h1).toBeVisible();
     |                        ^ Error: expect(locator).toBeVisible() failed
  22 |     });
  23 |   }
  24 | });
  25 | 
  26 | test.describe("Mobile: navigation", () => {
  27 |   test("hamburger menu exists and opens", async ({ page }) => {
  28 |     await page.goto("/");
  29 |     // On mobile, the nav should have a menu button
  30 |     const menuButton = page.locator("button[aria-label], button").filter({ hasText: /menu|menú/i }).first();
  31 |     // Menu button might exist or the nav collapses — check that navigation is accessible
  32 |     const nav = page.locator("nav").first();
  33 |     await expect(nav).toBeVisible();
  34 |   });
  35 | });
  36 | 
  37 | test.describe("Mobile: touch targets", () => {
  38 |   test("buttons have adequate size", async ({ page }) => {
  39 |     await page.goto("/");
  40 |     const buttons = await page.locator("button, a[role='button']").all();
  41 | 
  42 |     for (const button of buttons.slice(0, 10)) {
  43 |       const box = await button.boundingBox();
  44 |       if (!box) continue;
  45 |       // WCAG minimum touch target: 44x44px (we use 44px minHeight)
  46 |       expect(box.height, `Button too small: ${await button.textContent()}`).toBeGreaterThanOrEqual(32);
  47 |     }
  48 |   });
  49 | });
  50 | 
  51 | test.describe("Mobile: no horizontal overflow", () => {
  52 |   test("home page has no horizontal scroll", async ({ page }) => {
  53 |     await page.goto("/");
  54 |     const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  55 |     const viewportWidth = await page.evaluate(() => window.innerWidth);
  56 |     // Allow small margin (5px) for potential border/padding
  57 |     expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
  58 |   });
  59 | 
  60 |   test("WC2026 hub has no horizontal scroll", async ({ page }) => {
  61 |     await page.goto("/mundial-2026");
  62 |     const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  63 |     const viewportWidth = await page.evaluate(() => window.innerWidth);
  64 |     expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
  65 |   });
  66 | });
  67 | 
```