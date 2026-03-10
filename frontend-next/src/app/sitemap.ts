import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://picks4all.com";
  const now = new Date();

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
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: allLocales("", "", ""),
    },

    // FAQ
    {
      url: `${baseUrl}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: samePath("/faq"),
    },

    // How it works (localized paths)
    {
      url: `${baseUrl}/como-funciona`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/como-funciona", "/how-it-works", "/como-funciona"),
    },

    // What is a quiniela (localized paths)
    {
      url: `${baseUrl}/que-es-una-quiniela`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: allLocales("/que-es-una-quiniela", "/what-is-a-pool", "/o-que-e-uma-penca"),
    },

    // Terms of service (localized paths)
    {
      url: `${baseUrl}/terminos`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: allLocales("/terminos", "/terms", "/termos"),
    },

    // Privacy policy (localized paths)
    {
      url: `${baseUrl}/privacidad`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: allLocales("/privacidad", "/privacy", "/privacidade"),
    },

    // Enterprise / Corporate
    {
      url: `${baseUrl}/empresas`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/empresas", "/for-companies", "/para-empresas"),
    },

    // --- Regional SEO pages (each in its target language only) ---

    // Spanish-language regional terms (no /en or /pt alternates)
    {
      url: `${baseUrl}/polla-futbolera`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/prode-deportivo`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/porra-deportiva`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/penca-futbol`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // English-language regional term
    {
      url: `${baseUrl}/en/football-pool`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
