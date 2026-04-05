import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en", "pt"],
  defaultLocale: "es",
  localePrefix: "as-needed",
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
    // Regional SEO pages (locale-specific, handled with notFound in page)
    "/polla-futbolera": "/polla-futbolera",
    "/prode-deportivo": "/prode-deportivo",
    "/penca-futbol": "/penca-futbol",
    "/porra-deportiva": "/porra-deportiva",
    "/football-pool": "/football-pool",
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
  },
});

export type Locale = (typeof routing.locales)[number];
export type Pathnames = keyof typeof routing.pathnames;
