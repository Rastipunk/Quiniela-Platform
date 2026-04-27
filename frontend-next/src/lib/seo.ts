/**
 * Centralized helpers for page-level SEO metadata.
 *
 * Why this exists: Next.js merges `metadata` shallowly. When a page exports its
 * own `openGraph`, the entire object replaces the parent layout's `openGraph` —
 * including its `images`, `siteName`, and `locale`. Re-defining these on every
 * page is error-prone, so we centralize the construction here.
 *
 * Use `buildPageMetadata()` from any public page's `generateMetadata`.
 */

import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "./siteConfig";

export type LocaleCode = "es" | "en" | "pt";

const OG_LOCALES: Record<LocaleCode, string> = {
  es: "es_LA",
  en: "en_US",
  pt: "pt_BR",
};

export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: SITE_NAME,
} as const;

export interface OgImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface BuildPageMetadataOptions {
  locale: string;
  title: string;
  description: string;
  /**
   * Either a single path applied to every locale, or a per-locale map of paths.
   * Paths must start with "/" and must NOT include the locale prefix
   * (it's added automatically: ES has no prefix, others use /{locale}).
   *
   * Examples:
   *   path: "/faq"
   *   path: { es: "/precios", en: "/pricing", pt: "/precos" }
   */
  path: string | Partial<Record<LocaleCode, string>>;
  /**
   * Restrict alternates to a subset of locales. Defaults to all keys of `path`.
   * Use this for regional pages (e.g., `/polla-futbolera` only in ES).
   */
  availableLocales?: LocaleCode[];
  /** Open Graph type. Default: "website". */
  type?: "website" | "article";
  /** Article-specific OG fields (only used when type === "article"). */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    tags?: string[];
  };
  /** Override the default Open Graph images. */
  images?: readonly OgImage[];
  /**
   * Extra metadata to spread last (e.g., custom robots, keywords, verification).
   * These override any defaults set by this helper.
   */
  extra?: Metadata;
}

/** Build a fully-qualified URL with the locale prefix convention (ES has none). */
export function buildLocaleUrl(locale: string, path: string): string {
  const prefix = locale === "es" ? "" : `/${locale}`;
  return `${SITE_URL}${prefix}${path}`;
}

export function buildPageMetadata(opts: BuildPageMetadataOptions): Metadata {
  const { locale, title, description, type = "website", article, images, extra } = opts;

  const pathMap: Partial<Record<LocaleCode, string>> =
    typeof opts.path === "string"
      ? { es: opts.path, en: opts.path, pt: opts.path }
      : opts.path;

  const availableLocales =
    opts.availableLocales ?? (Object.keys(pathMap) as LocaleCode[]);

  const currentPath = pathMap[locale as LocaleCode] ?? pathMap.es ?? "";
  const url = buildLocaleUrl(locale, currentPath);

  const languages: Record<string, string> = {};
  for (const loc of availableLocales) {
    const p = pathMap[loc];
    if (p !== undefined) {
      languages[loc] = buildLocaleUrl(loc, p);
    }
  }
  // x-default points to the ES path when ES is supported; otherwise to the
  // canonical of the only/primary supported locale.
  const xDefaultLocale: LocaleCode =
    availableLocales.includes("es") ? "es" : availableLocales[0] ?? "es";
  const xDefaultPath = pathMap[xDefaultLocale] ?? currentPath;
  languages["x-default"] = buildLocaleUrl(xDefaultLocale, xDefaultPath);

  const ogImages = images ?? [DEFAULT_OG_IMAGE];

  const articleFields =
    type === "article" && article
      ? {
          publishedTime: article.publishedTime,
          modifiedTime: article.modifiedTime,
          ...(article.tags ? { tags: article.tags } : {}),
        }
      : {};

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type,
      siteName: SITE_NAME,
      locale: OG_LOCALES[locale as LocaleCode] ?? OG_LOCALES.es,
      images: ogImages as OgImage[],
      ...articleFields,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages.map((img) => img.url),
    },
    alternates: {
      canonical: url,
      languages,
    },
    ...extra,
  };
}
