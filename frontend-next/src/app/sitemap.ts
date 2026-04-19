import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL;
  const recentlyUpdated = new Date("2026-04-16");
  const stable = new Date("2026-04-04");
  const legal = new Date("2026-02-22");

  // Helper: create alternates for all 3 locales
  function allLocales(esPath: string, enPath: string, ptPath: string) {
    return {
      languages: {
        es: `${baseUrl}${esPath}`,
        en: `${baseUrl}/en${enPath}`,
        pt: `${baseUrl}/pt${ptPath}`,
      },
    };
  }

  // Helper: same path for all locales
  function samePath(path: string) {
    return allLocales(path, path, path);
  }

  return [
    // --- Pages available in all 3 locales ---

    // Landing
    {
      url: baseUrl,
      lastModified: recentlyUpdated,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: allLocales("", "", ""),
    },

    // FAQ
    {
      url: `${baseUrl}/faq`,
      lastModified: stable,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: samePath("/faq"),
    },

    // How it works (localized paths)
    {
      url: `${baseUrl}/como-funciona`,
      lastModified: stable,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/como-funciona", "/how-it-works", "/como-funciona"),
    },

    // What is a quiniela (localized paths)
    {
      url: `${baseUrl}/que-es-una-quiniela`,
      lastModified: stable,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: allLocales("/que-es-una-quiniela", "/what-is-a-pool", "/o-que-e-uma-penca"),
    },

    // Terms of service (localized paths)
    {
      url: `${baseUrl}/terminos`,
      lastModified: legal,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: allLocales("/terminos", "/terms", "/termos"),
    },

    // Privacy policy (localized paths)
    {
      url: `${baseUrl}/privacidad`,
      lastModified: legal,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: allLocales("/privacidad", "/privacy", "/privacidade"),
    },

    // Pricing (localized paths)
    {
      url: `${baseUrl}/precios`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/precios", "/pricing", "/precos"),
    },

    // Refund policy (localized paths)
    {
      url: `${baseUrl}/reembolsos`,
      lastModified: legal,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: allLocales("/reembolsos", "/refunds", "/reembolsos"),
    },

    // How to Play
    {
      url: `${baseUrl}/como-se-juega`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/como-se-juega", "/how-to-play", "/como-jogar"),
    },

    // Enterprise / Corporate
    {
      url: `${baseUrl}/empresas`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/empresas", "/for-companies", "/para-empresas"),
    },

    // --- World Cup 2026 Content Hub ---

    // Hub principal
    {
      url: `${baseUrl}/mundial-2026`,
      lastModified: recentlyUpdated,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: allLocales("/mundial-2026", "/world-cup-2026", "/copa-do-mundo-2026"),
    },

    // Grupos
    {
      url: `${baseUrl}/mundial-2026/grupos`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/mundial-2026/grupos", "/world-cup-2026/groups", "/copa-do-mundo-2026/grupos"),
    },

    // Calendario
    {
      url: `${baseUrl}/mundial-2026/calendario`,
      lastModified: recentlyUpdated,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: allLocales("/mundial-2026/calendario", "/world-cup-2026/schedule", "/copa-do-mundo-2026/calendario"),
    },

    // Sedes
    {
      url: `${baseUrl}/mundial-2026/sedes`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: allLocales("/mundial-2026/sedes", "/world-cup-2026/venues", "/copa-do-mundo-2026/sedes"),
    },

    // Cómo hacer quiniela
    {
      url: `${baseUrl}/mundial-2026/como-hacer-quiniela`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/mundial-2026/como-hacer-quiniela", "/world-cup-2026/how-to-create-pool", "/copa-do-mundo-2026/como-criar-bolao"),
    },

    // Reglas
    {
      url: `${baseUrl}/mundial-2026/reglas-quiniela`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: allLocales("/mundial-2026/reglas-quiniela", "/world-cup-2026/pool-rules", "/copa-do-mundo-2026/regras-bolao"),
    },

    // Predicciones IA
    {
      url: `${baseUrl}/mundial-2026/predicciones`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/mundial-2026/predicciones", "/world-cup-2026/predictions", "/copa-do-mundo-2026/previsoes"),
    },

    // --- Regional SEO pages (each in its target language only) ---

    // Spanish-language regional terms (no /en or /pt alternates)
    {
      url: `${baseUrl}/polla-futbolera`,
      lastModified: stable,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/prode-deportivo`,
      lastModified: stable,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/porra-deportiva`,
      lastModified: stable,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/penca-futbol`,
      lastModified: stable,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // English-language regional term
    {
      url: `${baseUrl}/en/football-pool`,
      lastModified: stable,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
