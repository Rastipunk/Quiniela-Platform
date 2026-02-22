import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en", "pt"],
  defaultLocale: "es",
  localePrefix: "as-needed",
  pathnames: {
    "/": "/",
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
    // Regional SEO pages (locale-specific, handled with notFound in page)
    "/polla-futbolera": "/polla-futbolera",
    "/prode-deportivo": "/prode-deportivo",
    "/penca-futbol": "/penca-futbol",
    "/porra-deportiva": "/porra-deportiva",
    "/football-pool": "/football-pool",
    // App pages
    "/dashboard": "/dashboard",
    "/profile": "/profile",
    "/pools/[poolId]": "/pools/[poolId]",
    "/admin/feedback": "/admin/feedback",
    "/admin/settings/email": "/admin/settings/email",
  },
});

export type Locale = (typeof routing.locales)[number];
export type Pathnames = keyof typeof routing.pathnames;
