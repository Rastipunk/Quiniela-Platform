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
      alternates: allLocales("/faq", "/faq", "/faq"),
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

    // Login
    {
      url: `${baseUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: allLocales("/login", "/login", "/login"),
    },

    // --- Spanish-only regional pages ---

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

    // --- Penca: Spanish + Portuguese ---

    {
      url: `${baseUrl}/penca-futbol`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: {
        languages: {
          es: `${baseUrl}/penca-futbol`,
          pt: `${baseUrl}/pt/penca-futbol`,
        },
      },
    },

    // --- English-only regional page ---

    {
      url: `${baseUrl}/en/football-pool`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
