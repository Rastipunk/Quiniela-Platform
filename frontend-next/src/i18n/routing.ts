import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en", "pt"],
  defaultLocale: "es",
  localePrefix: "as-needed",
  // Disable next-intl's automatic NEXT_LOCALE cookie write. With this
  // off, every public SSG response stops carrying `Set-Cookie` — Google
  // treats `Set-Cookie` + `Cache-Control: public, s-maxage=...` as
  // contradictory signals ("personalised response that's also publicly
  // cacheable?") and downgrades indexing priority. For users who
  // explicitly switch language, the cookie is written by
  // `LanguageSelector.tsx`, `LocalePreferenceModal.tsx`, and
  // `backend/src/lib/authCookies.ts` (at login).
  localeCookie: false,
  // Disable next-intl's Accept-Language auto-redirect. Combined with
  // localeCookie:false above, next-intl now only consults URL prefix +
  // defaultLocale. All other signals (cookie, Accept-Language) flow
  // through our manual logic in `proxy.ts`, so we keep one source of
  // truth for locale resolution and avoid the conflict where a
  // manually-set NEXT_LOCALE=es cookie gets overridden by an English
  // Accept-Language header. See LOCALE_RESOLUTION_AUDIT.md §3.1.
  localeDetection: false,
  pathnames: {
    "/": "/",
    "/invite": "/invite",
    "/login": "/login",
    "/forgot-password": "/forgot-password",
    "/reset-password": "/reset-password",
    "/verify-email": "/verify-email",
    "/faq": "/faq",
    "/como-funciona": {
      es: "/como-funciona",
      en: "/how-it-works",
      pt: "/como-funciona",
    },
    "/como-se-juega": {
      es: "/como-se-juega",
      en: "/how-to-play",
      pt: "/como-jogar",
    },
    "/que-es-una-quiniela": {
      es: "/que-es-una-quiniela",
      en: "/what-is-a-pool",
      pt: "/o-que-e-uma-penca",
    },
    "/terminos": {
      es: "/terminos",
      en: "/terms",
      pt: "/termos",
    },
    "/privacidad": {
      es: "/privacidad",
      en: "/privacy",
      pt: "/privacidade",
    },
    "/precios": {
      es: "/precios",
      en: "/pricing",
      pt: "/precos",
    },
    "/reembolsos": {
      es: "/reembolsos",
      en: "/refunds",
      pt: "/reembolsos",
    },
    // Regional SEO pages — each path lives in ONE locale only.
    //
    // Why this is a per-locale object instead of a plain string: a string
    // value tells next-intl "this path exists in every locale", which made
    // the middleware emit `Link: rel="alternate"; hreflang="en|pt"` headers
    // pointing at /en/polla-futbolera, /pt/polla-futbolera, etc. The page
    // file calls `notFound()` for any non-supported locale, so those URLs
    // return 404 — which created an inconsistent hreflang cluster in
    // Search Console (Google was told the alternate exists, then got a 404
    // when crawling it). With a single-locale entry, next-intl no longer
    // generates the cross-locale URLs at all.
    "/polla-futbolera": { es: "/polla-futbolera" },
    "/prode-deportivo": { es: "/prode-deportivo" },
    "/penca-futbol":    { es: "/penca-futbol" },
    "/porra-deportiva": { es: "/porra-deportiva" },
    "/football-pool":   { en: "/football-pool" },
    // Corporate
    "/empresas": {
      es: "/empresas",
      en: "/for-companies",
      pt: "/para-empresas",
    },
    "/empresas/crear": {
      es: "/empresas/crear",
      en: "/for-companies/create",
      pt: "/para-empresas/criar",
    },
    "/activar-cuenta": {
      es: "/activar-cuenta",
      en: "/activate-account",
      pt: "/ativar-conta",
    },
    // World Cup 2026 content hub
    "/mundial-2026": {
      es: "/mundial-2026",
      en: "/world-cup-2026",
      pt: "/copa-do-mundo-2026",
    },
    "/mundial-2026/grupos": {
      es: "/mundial-2026/grupos",
      en: "/world-cup-2026/groups",
      pt: "/copa-do-mundo-2026/grupos",
    },
    "/mundial-2026/calendario": {
      es: "/mundial-2026/calendario",
      en: "/world-cup-2026/schedule",
      pt: "/copa-do-mundo-2026/calendario",
    },
    "/mundial-2026/sedes": {
      es: "/mundial-2026/sedes",
      en: "/world-cup-2026/venues",
      pt: "/copa-do-mundo-2026/sedes",
    },
    "/mundial-2026/como-hacer-quiniela": {
      es: "/mundial-2026/como-hacer-quiniela",
      en: "/world-cup-2026/how-to-create-pool",
      pt: "/copa-do-mundo-2026/como-criar-bolao",
    },
    "/mundial-2026/reglas-quiniela": {
      es: "/mundial-2026/reglas-quiniela",
      en: "/world-cup-2026/pool-rules",
      pt: "/copa-do-mundo-2026/regras-bolao",
    },
    "/mundial-2026/predicciones": {
      es: "/mundial-2026/predicciones",
      en: "/world-cup-2026/predictions",
      pt: "/copa-do-mundo-2026/previsoes",
    },
    // Payment pages
    "/pago/checkout": "/pago/checkout",
    "/pago/exitoso": "/pago/exitoso",
    "/pago/cancelado": "/pago/cancelado",
    // Pool creation wizard
    "/crear-pool": {
      es: "/crear-pool",
      en: "/create-pool",
      pt: "/criar-pool",
    },
    // App pages
    "/dashboard": "/dashboard",
    "/profile": "/profile",
    "/pools/join": "/pools/join",
    "/pools/[poolId]": "/pools/[poolId]",
    "/admin/feedback": "/admin/feedback",
    "/admin/settings/email": "/admin/settings/email",
    "/admin/analytics": "/admin/analytics",
    "/admin/survey": "/admin/survey",
    "/admin/monitor": "/admin/monitor",
    "/admin/fases": "/admin/fases",
    "/admin/ventas/cotizaciones": "/admin/ventas/cotizaciones",
    "/admin/ventas/cotizaciones/nueva": "/admin/ventas/cotizaciones/nueva",
    "/admin/ventas/cotizaciones/[id]": "/admin/ventas/cotizaciones/[id]",
    "/admin/ventas/cuentas-de-cobro": "/admin/ventas/cuentas-de-cobro",
    "/admin/ventas/cuentas-de-cobro/nueva": "/admin/ventas/cuentas-de-cobro/nueva",
    "/admin/ventas/cuentas-de-cobro/[id]": "/admin/ventas/cuentas-de-cobro/[id]",
  },
});

export type Locale = (typeof routing.locales)[number];
export type Pathnames = keyof typeof routing.pathnames;
