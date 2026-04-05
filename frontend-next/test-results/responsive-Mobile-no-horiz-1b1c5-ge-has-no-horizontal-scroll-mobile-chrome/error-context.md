# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> Mobile: no horizontal overflow >> home page has no horizontal scroll
- Location: e2e\responsive.spec.ts:52:7

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 398
Received:    566
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
  - generic [ref=e8]:
    - navigation [ref=e9]:
      - link "Picks4All" [ref=e10] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]: P
        - text: Picks4All
      - generic [ref=e12]:
        - button "Ingresar" [ref=e13] [cursor=pointer]
        - button "Abrir menú" [ref=e14] [cursor=pointer]
    - main [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e21]:
          - heading "Compite con tus amigos prediciendo partidos de fútbol" [level=1] [ref=e22]
          - paragraph [ref=e23]: Crea tu quiniela gratis y diviértete prediciendo resultados de fútbol con tus amigos.
          - generic [ref=e24]:
            - button "Crear cuenta gratis" [ref=e25] [cursor=pointer]
            - link "Ver cómo funciona" [ref=e26] [cursor=pointer]:
              - /url: /como-funciona
        - generic [ref=e27]:
          - heading "¿Qué es Picks4All?" [level=2] [ref=e28]
          - paragraph [ref=e29]:
            - text: Picks4All es la plataforma gratuita para crear
            - strong [ref=e30]: quinielas deportivas
            - text: online y competir con amigos, familia o compañeros de trabajo prediciendo resultados de fútbol. También conocida como
            - strong [ref=e31]: polla futbolera
            - text: en Colombia, Chile y Venezuela,
            - strong [ref=e32]: prode
            - text: en Argentina,
            - strong [ref=e33]: penca
            - text: en Uruguay, o
            - strong [ref=e34]: porra
            - text: en España.
          - paragraph [ref=e35]:
            - text: Crea tu quiniela gratis para hasta 20 jugadores, invita a quien quieras con un código, haz tus predicciones y compite en el leaderboard.
            - strong [ref=e36]: Gratis y sin apuestas
            - text: — solo diversión y rivalidad sana.
        - generic [ref=e37]:
          - heading "Todo lo que necesitas para competir" [level=2] [ref=e38]
          - paragraph [ref=e39]: Una plataforma completa para organizar tus quinielas con amigos, familia o compañeros de trabajo.
          - generic [ref=e40]:
            - generic [ref=e41]:
              - generic [ref=e42]: ⚽
              - heading "Crea tu quiniela en minutos" [level=3] [ref=e43]
              - paragraph [ref=e44]: Personaliza las reglas, el sistema de puntos y los plazos. Elige entre marcador exacto, resultado, diferencia de goles y más. Tú decides cómo se juega tu quiniela.
            - generic [ref=e45]:
              - generic [ref=e46]: 📊
              - heading "Leaderboard en tiempo real" [level=3] [ref=e47]
              - paragraph [ref=e48]: Ranking actualizado automáticamente después de cada partido. Ve quién lidera, compara tu posición y sigue la competencia en vivo con estadísticas detalladas.
            - generic [ref=e49]:
              - generic [ref=e50]: 🎯
              - heading "Múltiples modos de puntuación" [level=3] [ref=e51]
              - paragraph [ref=e52]: Marcador exacto, resultado correcto, diferencia de goles, bonus por racha. Configura el sistema de puntos que más se adapte a tu grupo.
            - generic [ref=e53]:
              - generic [ref=e54]: 👥
              - heading "Invita por link o WhatsApp" [level=3] [ref=e55]
              - paragraph [ref=e56]: Comparte un código de invitación por WhatsApp, Telegram o cualquier red social. Tus amigos se unen en segundos, sin necesidad de crear cuenta previamente.
            - generic [ref=e57]:
              - generic [ref=e58]: ⚡
              - heading "Resultados automáticos" [level=3] [ref=e59]
              - paragraph [ref=e60]: Los marcadores se actualizan automáticamente al finalizar cada partido. No tienes que ingresar resultados manualmente — nosotros nos encargamos.
            - generic [ref=e61]:
              - generic [ref=e62]: 📧
              - heading "Notificaciones por email" [level=3] [ref=e63]
              - paragraph [ref=e64]: Recordatorios antes de cada fecha límite, resúmenes de resultados y actualizaciones del ranking. Tus jugadores siempre están informados.
            - generic [ref=e65]:
              - generic [ref=e66]: 🏆
              - heading "Multi-torneo" [level=3] [ref=e67]
              - paragraph [ref=e68]: Copa del Mundo, Champions League, Copa América, ligas locales y más. Crea quinielas para cualquier competencia y maneja varios torneos a la vez.
            - generic [ref=e69]:
              - generic [ref=e70]: 📱
              - heading "Optimizado para móvil" [level=3] [ref=e71]
              - paragraph [ref=e72]: Diseñado para funcionar perfectamente en tu celular. Haz predicciones, revisa el ranking y administra tu pool desde cualquier lugar.
        - generic [ref=e74]:
          - heading "Cómo funciona" [level=2] [ref=e75]
          - generic [ref=e76]:
            - generic [ref=e77]:
              - generic [ref=e78]: "1"
              - heading "Crea o únete" [level=3] [ref=e79]
              - paragraph [ref=e80]: Crea tu quiniela o únete a un pool con un código de invitación.
            - generic [ref=e81]:
              - generic [ref=e82]: "2"
              - heading "Haz tus predicciones" [level=3] [ref=e83]
              - paragraph [ref=e84]: Ingresa tus pronósticos antes del deadline de cada partido.
            - generic [ref=e85]:
              - generic [ref=e86]: "3"
              - heading "Sube en el ranking" [level=3] [ref=e87]
              - paragraph [ref=e88]: Gana puntos con cada acierto y demuestra que sos el mejor predictor.
          - link "Ver más detalles →" [ref=e90] [cursor=pointer]:
            - /url: /como-funciona
        - generic [ref=e91]:
          - heading "Planes y Precios" [level=2] [ref=e92]
          - paragraph [ref=e93]: Comienza gratis. Sin tarjeta de crédito.
          - generic [ref=e94]:
            - generic [ref=e95]:
              - generic [ref=e96]:
                - heading "Personal" [level=3] [ref=e97]
                - generic [ref=e98]: Gratis
              - paragraph [ref=e99]: Hasta 20 jugadores
              - generic [ref=e100]:
                - generic [ref=e101]:
                  - generic [ref=e102]: ✓
                  - generic [ref=e103]: Leaderboard en tiempo real
                - generic [ref=e104]:
                  - generic [ref=e105]: ✓
                  - generic [ref=e106]: Múltiples modos de puntuación
                - generic [ref=e107]:
                  - generic [ref=e108]: ✓
                  - generic [ref=e109]: Actualización automática de resultados
                - generic [ref=e110]:
                  - generic [ref=e111]: ✓
                  - generic [ref=e112]: Notificaciones por email a jugadores
                - generic [ref=e113]:
                  - generic [ref=e114]: ✓
                  - generic [ref=e115]: Soporte multi-torneo
                - generic [ref=e116]:
                  - generic [ref=e117]: ✓
                  - generic [ref=e118]: Invita por link
                - generic [ref=e119]:
                  - generic [ref=e120]: ✓
                  - generic [ref=e121]: Optimizado para móvil
              - button "Crear pool gratis" [ref=e122] [cursor=pointer]
            - generic [ref=e123]:
              - generic [ref=e124]:
                - heading "Personal Pro" [level=3] [ref=e125]
                - generic [ref=e126]: Desde $6.99
              - paragraph [ref=e127]: Hasta 300+ jugadores
              - generic [ref=e128]:
                - generic [ref=e129]:
                  - generic [ref=e130]: ✓
                  - generic [ref=e131]: Todo lo del plan gratis
                - generic [ref=e132]:
                  - generic [ref=e133]: ✓
                  - generic [ref=e134]: Hasta 300+ jugadores
              - generic [ref=e135]:
                - generic [ref=e136]: 🔒
                - generic [ref=e137]: Próximamente
            - generic [ref=e138]:
              - generic [ref=e139]:
                - heading "Corporativo" [level=3] [ref=e140]
                - generic [ref=e141]:
                  - generic [ref=e142]: $49.99
                  - generic [ref=e143]: $0 — Prueba gratuita
              - paragraph [ref=e144]: Hasta 100 jugadores incluidos
              - generic [ref=e145]:
                - generic [ref=e146]:
                  - generic [ref=e147]: ✓
                  - generic [ref=e148]: Todo lo de Personal
                - generic [ref=e149]:
                  - generic [ref=e150]: ✓
                  - generic [ref=e151]: Logo y marca de tu empresa
                - generic [ref=e152]:
                  - generic [ref=e153]: ✓
                  - generic [ref=e154]: Invitaciones personalizadas por email
                - generic [ref=e155]:
                  - generic [ref=e156]: ✓
                  - generic [ref=e157]: Importación CSV de empleados
                - generic [ref=e158]:
                  - generic [ref=e159]: ✓
                  - generic [ref=e160]: Panel de gestión de empleados
                - generic [ref=e161]:
                  - generic [ref=e162]: ✓
                  - generic [ref=e163]: Pool con marca empresarial
              - link "Crear pool corporativo" [ref=e164] [cursor=pointer]:
                - /url: /empresas
          - link "Ver todos los planes →" [ref=e166] [cursor=pointer]:
            - /url: /precios
        - generic [ref=e167]:
          - heading "Torneos disponibles" [level=2] [ref=e168]
          - paragraph [ref=e169]: Crea quinielas para los torneos más emocionantes del mundo.
          - generic [ref=e170]:
            - generic [ref=e171]:
              - generic [ref=e172]: 🏆
              - heading "Copa del Mundo 2026" [level=3] [ref=e173]
              - paragraph [ref=e174]: 48 equipos • 104 partidos • El torneo más grande de la historia
              - button "Crear pool" [ref=e175] [cursor=pointer]
            - generic [ref=e176]:
              - generic [ref=e177]: ⭐
              - heading "Champions League 2025-26" [level=3] [ref=e178]
              - paragraph [ref=e179]: 36 equipos • Formato liga + eliminatorias
              - button "Crear pool" [ref=e180] [cursor=pointer]
            - generic [ref=e181]:
              - generic [ref=e182]: Próximamente
              - generic [ref=e183]: 🌎
              - heading "Copa América 2028" [level=3] [ref=e184]
              - paragraph [ref=e185]: 16 selecciones • El torneo más antiguo del mundo
            - generic [ref=e186]:
              - generic [ref=e187]: Próximamente
              - generic [ref=e188]: 🇪🇺
              - heading "Eurocopa 2028" [level=3] [ref=e189]
              - paragraph [ref=e190]: 24 selecciones • UK e Irlanda
            - generic [ref=e191]:
              - generic [ref=e192]: Próximamente
              - generic [ref=e193]: 🏅
              - heading "UEFA Nations League" [level=3] [ref=e194]
              - paragraph [ref=e195]: Selecciones europeas • Formato liga
            - generic [ref=e196]:
              - generic [ref=e197]: Próximamente
              - generic [ref=e198]: 🔥
              - heading "Copa Libertadores" [level=3] [ref=e199]
              - paragraph [ref=e200]: Los mejores clubes de Sudamérica
            - generic [ref=e201]:
              - generic [ref=e202]: Próximamente
              - generic [ref=e203]: ⚡
              - heading "Copa Sudamericana" [level=3] [ref=e204]
              - paragraph [ref=e205]: La segunda competencia de clubes de Sudamérica
            - generic [ref=e206]:
              - generic [ref=e207]: Próximamente
              - generic [ref=e208]: 🦁
              - heading "Premier League" [level=3] [ref=e209]
              - paragraph [ref=e210]: La liga más competitiva del mundo
        - generic [ref=e211]:
          - heading "¿Listo para demostrar que sabes de fútbol?" [level=2] [ref=e212]
          - paragraph [ref=e213]: Crea tu pool gratis y comienza a competir con tus amigos.
          - paragraph [ref=e214]: Gratis para pools de hasta 20 jugadores. Crea tu quiniela en menos de 1 minuto.
          - button "Comenzar ahora — Es gratis" [ref=e215] [cursor=pointer]
    - contentinfo [ref=e216]:
      - generic [ref=e217]:
        - generic [ref=e218]:
          - generic [ref=e219]:
            - generic [ref=e220]: P
            - text: Picks4All
          - paragraph [ref=e221]: Plataforma gratuita de predicciones deportivas entre amigos. Quinielas, pollas, prodes y pencas — gratis hasta 20 jugadores, sin dinero real ni apuestas.
        - generic [ref=e222]:
          - generic [ref=e223]: Legal
          - link "Términos de Servicio" [ref=e224] [cursor=pointer]:
            - /url: /terminos
          - link "Política de Privacidad" [ref=e225] [cursor=pointer]:
            - /url: /privacidad
          - link "Precios" [ref=e226] [cursor=pointer]:
            - /url: /precios
          - link "Política de Reembolso" [ref=e227] [cursor=pointer]:
            - /url: /reembolsos
        - generic [ref=e228]:
          - generic [ref=e229]: Descubre
          - link "Mundial 2026" [ref=e230] [cursor=pointer]:
            - /url: /mundial-2026
          - link "Cómo Funciona" [ref=e231] [cursor=pointer]:
            - /url: /como-funciona
          - link "Preguntas Frecuentes" [ref=e232] [cursor=pointer]:
            - /url: /faq
          - link "¿Qué es una Quiniela?" [ref=e233] [cursor=pointer]:
            - /url: /que-es-una-quiniela
          - link "Polla Futbolera" [ref=e234] [cursor=pointer]:
            - /url: /polla-futbolera
          - link "Prode Deportivo" [ref=e235] [cursor=pointer]:
            - /url: /prode-deportivo
          - link "Penca de Fútbol" [ref=e236] [cursor=pointer]:
            - /url: /penca-futbol
          - link "Porra Deportiva" [ref=e237] [cursor=pointer]:
            - /url: /porra-deportiva
          - link "Football Pool" [ref=e238] [cursor=pointer]:
            - /url: /football-pool
          - link "Para Empresas" [ref=e239] [cursor=pointer]:
            - /url: /empresas
        - generic [ref=e240]:
          - generic [ref=e241]:
            - generic [ref=e242]: Contacto
            - link "soporte@picks4all.com" [ref=e243] [cursor=pointer]:
              - /url: mailto:soporte@picks4all.com
          - generic [ref=e244]:
            - generic [ref=e245]: Región
            - combobox [ref=e246] [cursor=pointer]:
              - option "🇲🇽 Quiniela" [selected]
              - option "🇨🇴 Polla"
              - option "🇦🇷 Prode"
              - option "🇺🇾 Penca"
              - option "🇪🇸 Porra"
      - generic [ref=e247]: © 2026 Picks4All. Todos los derechos reservados.
  - alert [ref=e248]
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
  21 |       await expect(h1).toBeVisible();
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
> 57 |     expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
     |                         ^ Error: expect(received).toBeLessThanOrEqual(expected)
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