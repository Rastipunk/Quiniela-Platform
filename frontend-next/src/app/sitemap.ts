import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

/**
 * Picks4All sitemap.
 *
 * Notes:
 * - URLs use the locale prefix convention: ES has none, EN/PT use /en/ and /pt/.
 * - `lastModified` is computed at build time. Updates here propagate via redeploy.
 *   Group routes by recency so we can bump dates surgically when content changes.
 * - The default OG image is added to every entry as a non-standard `images` field
 *   (Google ignores it but image-aware crawlers like Yandex use it).
 */

type SitemapEntry = MetadataRoute.Sitemap[number] & {
  images?: string[];
};

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL;
  const ogImage = `${baseUrl}/opengraph-image`;

  // Bump these dates when the underlying content OR SEO surface changes.
  // Group by lifecycle so updates stay surgical.
  //
  // 2026-05-08: bumped after the SEO recovery work
  //   (fixed `Set-Cookie` on public responses + canonical-matching
  //   internal links) — signals to Google that the page experience
  //   changed and warrants a re-crawl, helping recover from the post-
  //   Apr-15 deindex period.
  const recentlyUpdated = new Date("2026-05-08");
  const legal = new Date("2026-02-22");

  /** Alternates for all 3 locales with their localized paths. */
  function allLocales(esPath: string, enPath: string, ptPath: string) {
    return {
      languages: {
        es: `${baseUrl}${esPath}`,
        en: `${baseUrl}/en${enPath}`,
        pt: `${baseUrl}/pt${ptPath}`,
      },
    };
  }

  /** Same path across all 3 locales. */
  function samePath(path: string) {
    return allLocales(path, path, path);
  }

  // Helper to attach the default OG image to every entry.
  function withImage<T extends SitemapEntry>(entry: T): T {
    return { ...entry, images: [ogImage] };
  }

  return [
    // Landing
    withImage({
      url: baseUrl,
      lastModified: recentlyUpdated,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: allLocales("", "", ""),
    }),

    // FAQ
    withImage({
      url: `${baseUrl}/faq`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: samePath("/faq"),
    }),

    // How it works
    withImage({
      url: `${baseUrl}/como-funciona`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/como-funciona", "/how-it-works", "/como-funciona"),
    }),

    // What is a quiniela
    withImage({
      url: `${baseUrl}/que-es-una-quiniela`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: allLocales(
        "/que-es-una-quiniela",
        "/what-is-a-pool",
        "/o-que-e-uma-penca",
      ),
    }),

    // Terms of service
    withImage({
      url: `${baseUrl}/terminos`,
      lastModified: legal,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: allLocales("/terminos", "/terms", "/termos"),
    }),

    // Privacy policy
    withImage({
      url: `${baseUrl}/privacidad`,
      lastModified: legal,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: allLocales("/privacidad", "/privacy", "/privacidade"),
    }),

    // Pricing
    withImage({
      url: `${baseUrl}/precios`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/precios", "/pricing", "/precos"),
    }),

    // Refund policy
    withImage({
      url: `${baseUrl}/reembolsos`,
      lastModified: legal,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: allLocales("/reembolsos", "/refunds", "/reembolsos"),
    }),

    // How to Play
    withImage({
      url: `${baseUrl}/como-se-juega`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/como-se-juega", "/how-to-play", "/como-jogar"),
    }),

    // Enterprise / Corporate
    withImage({
      url: `${baseUrl}/empresas`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales("/empresas", "/for-companies", "/para-empresas"),
    }),

    // --- World Cup 2026 Content Hub ---

    withImage({
      url: `${baseUrl}/mundial-2026`,
      lastModified: recentlyUpdated,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: allLocales("/mundial-2026", "/world-cup-2026", "/copa-do-mundo-2026"),
    }),

    withImage({
      url: `${baseUrl}/mundial-2026/grupos`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales(
        "/mundial-2026/grupos",
        "/world-cup-2026/groups",
        "/copa-do-mundo-2026/grupos",
      ),
    }),

    withImage({
      url: `${baseUrl}/mundial-2026/calendario`,
      lastModified: recentlyUpdated,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: allLocales(
        "/mundial-2026/calendario",
        "/world-cup-2026/schedule",
        "/copa-do-mundo-2026/calendario",
      ),
    }),

    withImage({
      url: `${baseUrl}/mundial-2026/sedes`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: allLocales(
        "/mundial-2026/sedes",
        "/world-cup-2026/venues",
        "/copa-do-mundo-2026/sedes",
      ),
    }),

    withImage({
      url: `${baseUrl}/mundial-2026/como-hacer-quiniela`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales(
        "/mundial-2026/como-hacer-quiniela",
        "/world-cup-2026/how-to-create-pool",
        "/copa-do-mundo-2026/como-criar-bolao",
      ),
    }),

    withImage({
      url: `${baseUrl}/mundial-2026/reglas-quiniela`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: allLocales(
        "/mundial-2026/reglas-quiniela",
        "/world-cup-2026/pool-rules",
        "/copa-do-mundo-2026/regras-bolao",
      ),
    }),

    withImage({
      url: `${baseUrl}/mundial-2026/predicciones`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: allLocales(
        "/mundial-2026/predicciones",
        "/world-cup-2026/predictions",
        "/copa-do-mundo-2026/previsoes",
      ),
    }),

    // --- Regional SEO pages (single-locale) ---

    withImage({
      url: `${baseUrl}/polla-futbolera`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
    }),
    withImage({
      url: `${baseUrl}/prode-deportivo`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
    }),
    withImage({
      url: `${baseUrl}/porra-deportiva`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
    }),
    withImage({
      url: `${baseUrl}/penca-futbol`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
    }),

    // English-language regional term
    withImage({
      url: `${baseUrl}/en/football-pool`,
      lastModified: recentlyUpdated,
      changeFrequency: "monthly",
      priority: 0.7,
    }),
  ];
}
