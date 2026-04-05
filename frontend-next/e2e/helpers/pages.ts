/**
 * Page Registry — Single source of truth for all public pages and their expected properties.
 *
 * Every public page in the app is registered here with:
 * - URL paths per locale
 * - Expected SEO metadata (title substring, description substring)
 * - Expected content markers (elements that must exist on the page)
 * - Whether the page should be indexed by search engines
 *
 * Tests import this registry to verify pages against expected behavior.
 * When a new page is added, add it here — all test suites pick it up automatically.
 */

export interface PageDefinition {
  /** Internal identifier */
  id: string;
  /** URL path per locale (relative to baseURL) */
  paths: { es: string; en: string; pt: string };
  /** Whether the page should be indexed (true) or noindex (false) */
  indexed: boolean;
  /** Substring expected in <title> */
  titleContains: string;
  /** Substring expected in meta description */
  descriptionContains: string;
  /** CSS selectors for elements that MUST exist on the page */
  requiredElements?: string[];
  /** Text that must NOT appear on the page (e.g., "TBD", raw i18n keys) */
  forbiddenText?: string[];
}

// ─── Public Pages (indexed) ───────────────────────────────

export const PUBLIC_PAGES: PageDefinition[] = [
  {
    id: "home",
    paths: { es: "/", en: "/en", pt: "/pt" },
    indexed: true,
    titleContains: "Picks4All",
    descriptionContains: "gratis",
    requiredElements: ["h1", "nav"],
    forbiddenText: ["undefined", "null"],
  },
  {
    id: "faq",
    paths: { es: "/faq", en: "/en/faq", pt: "/pt/faq" },
    indexed: true,
    titleContains: "FAQ",
    descriptionContains: "quiniela",
    requiredElements: ["h1"],
  },
  {
    id: "how-it-works",
    paths: { es: "/como-funciona", en: "/en/how-it-works", pt: "/pt/como-funciona" },
    indexed: true,
    titleContains: "Picks4All",
    descriptionContains: "quiniela",
    requiredElements: ["h1"],
  },
  {
    id: "what-is-quiniela",
    paths: { es: "/que-es-una-quiniela", en: "/en/what-is-a-pool", pt: "/pt/o-que-e-uma-penca" },
    indexed: true,
    titleContains: "Quiniela",
    descriptionContains: "historia",
    requiredElements: ["h1"],
  },
  {
    id: "pricing",
    paths: { es: "/precios", en: "/en/pricing", pt: "/pt/precos" },
    indexed: true,
    titleContains: "Picks4All",
    descriptionContains: "gratis",
    requiredElements: ["h1"],
  },
  {
    id: "enterprise",
    paths: { es: "/empresas", en: "/en/for-companies", pt: "/pt/para-empresas" },
    indexed: true,
    titleContains: "Picks4All",
    descriptionContains: "empresa",
    requiredElements: ["h1"],
  },
  {
    id: "terms",
    paths: { es: "/terminos", en: "/en/terms", pt: "/pt/termos" },
    indexed: true,
    titleContains: "Picks4All",
    descriptionContains: "servicio",
    requiredElements: ["h1"],
  },
  {
    id: "privacy",
    paths: { es: "/privacidad", en: "/en/privacy", pt: "/pt/privacidade" },
    indexed: true,
    titleContains: "Picks4All",
    descriptionContains: "privacidad",
    requiredElements: ["h1"],
  },
  {
    id: "refunds",
    paths: { es: "/reembolsos", en: "/en/refunds", pt: "/pt/reembolsos" },
    indexed: true,
    titleContains: "Picks4All",
    descriptionContains: "reembolso",
    requiredElements: ["h1"],
  },

  // ─── Regional SEO pages ──────────────────────────────
  {
    id: "polla-futbolera",
    paths: { es: "/polla-futbolera", en: "/en/polla-futbolera", pt: "/pt/polla-futbolera" },
    indexed: true,
    titleContains: "Polla",
    descriptionContains: "polla",
    requiredElements: ["h1"],
  },
  {
    id: "prode-deportivo",
    paths: { es: "/prode-deportivo", en: "/en/prode-deportivo", pt: "/pt/prode-deportivo" },
    indexed: true,
    titleContains: "Prode",
    descriptionContains: "prode",
    requiredElements: ["h1"],
  },
  {
    id: "penca-futbol",
    paths: { es: "/penca-futbol", en: "/en/penca-futbol", pt: "/pt/penca-futbol" },
    indexed: true,
    titleContains: "Penca",
    descriptionContains: "penca",
    requiredElements: ["h1"],
  },
  {
    id: "porra-deportiva",
    paths: { es: "/porra-deportiva", en: "/en/porra-deportiva", pt: "/pt/porra-deportiva" },
    indexed: true,
    titleContains: "Porra",
    descriptionContains: "porra",
    requiredElements: ["h1"],
  },
  {
    id: "football-pool",
    paths: { es: "/football-pool", en: "/en/football-pool", pt: "/pt/football-pool" },
    indexed: true,
    titleContains: "Football Pool",
    descriptionContains: "football",
    requiredElements: ["h1"],
  },

  // ─── World Cup 2026 Hub ──────────────────────────────
  {
    id: "wc2026-hub",
    paths: { es: "/mundial-2026", en: "/en/world-cup-2026", pt: "/pt/copa-do-mundo-2026" },
    indexed: true,
    titleContains: "Mundial 2026",
    descriptionContains: "quiniela",
    requiredElements: ["h1", "nav"],
    forbiddenText: ["TBD", "undefined"],
  },
  {
    id: "wc2026-groups",
    paths: { es: "/mundial-2026/grupos", en: "/en/world-cup-2026/groups", pt: "/pt/copa-do-mundo-2026/grupos" },
    indexed: true,
    titleContains: "Grupo",
    descriptionContains: "48",
    requiredElements: ["h1"],
    forbiddenText: ["TBD", "undefined"],
  },
  {
    id: "wc2026-schedule",
    paths: { es: "/mundial-2026/calendario", en: "/en/world-cup-2026/schedule", pt: "/pt/copa-do-mundo-2026/calendario" },
    indexed: true,
    titleContains: "Calendario",
    descriptionContains: "104",
    requiredElements: ["h1"],
  },
  {
    id: "wc2026-venues",
    paths: { es: "/mundial-2026/sedes", en: "/en/world-cup-2026/venues", pt: "/pt/copa-do-mundo-2026/sedes" },
    indexed: true,
    titleContains: "Sedes",
    descriptionContains: "estadio",
    requiredElements: ["h1"],
  },
  {
    id: "wc2026-howto",
    paths: { es: "/mundial-2026/como-hacer-quiniela", en: "/en/world-cup-2026/how-to-create-pool", pt: "/pt/copa-do-mundo-2026/como-criar-bolao" },
    indexed: true,
    titleContains: "Quiniela",
    descriptionContains: "paso",
    requiredElements: ["h1"],
  },
  {
    id: "wc2026-rules",
    paths: { es: "/mundial-2026/reglas-quiniela", en: "/en/world-cup-2026/pool-rules", pt: "/pt/copa-do-mundo-2026/regras-bolao" },
    indexed: true,
    titleContains: "Regla",
    descriptionContains: "puntuación",
    requiredElements: ["h1"],
  },
  {
    id: "wc2026-predictions",
    paths: { es: "/mundial-2026/predicciones", en: "/en/world-cup-2026/predictions", pt: "/pt/copa-do-mundo-2026/previsoes" },
    indexed: true,
    titleContains: "Prediccion",
    descriptionContains: "IA",
    requiredElements: ["h1"],
    forbiddenText: ["TBD", "undefined"],
  },
];

// ─── Auth pages (noindex) ──────────────────────────────

export const AUTH_PAGES: PageDefinition[] = [
  {
    id: "login",
    paths: { es: "/login", en: "/en/login", pt: "/pt/login" },
    indexed: false,
    titleContains: "Picks4All",
    descriptionContains: "login",
    requiredElements: ["form", "button"],
  },
];

// ─── All pages combined ────────────────────────────────

export const ALL_PAGES = [...PUBLIC_PAGES, ...AUTH_PAGES];

// ─── Global forbidden patterns ─────────────────────────
// These should NEVER appear on any rendered page

export const GLOBAL_FORBIDDEN_PATTERNS = [
  /NEXT_PUBLIC_/,          // Leaked env var names
  /Error: [A-Z]/,          // Unhandled error messages (e.g., "Error: INTERNAL_ERROR")
  /pool\.invite\.\w+/,     // Raw i18n keys like "pool.invite.createCode"
  /common\.nav\.\w+/,      // Raw i18n keys like "common.nav.loading"
  /worldCup\.\w+\.\w+/,    // Raw i18n keys like "worldCup.hub.title"
];
