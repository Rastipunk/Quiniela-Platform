import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

// Index of paths that intentionally exist in fewer than all locales
// (regional SEO landing pages). Built once at module load from
// `routing.pathnames`.
//
// Why this exists: next-intl's middleware emits a `Link:` HTTP header
// with hreflang alternates for EVERY configured locale, even when a
// `pathnames` entry is declared as a per-locale object covering only a
// subset (e.g. `{ es: "/polla-futbolera" }`). That generates URLs that
// 404 (the page calls `notFound()` for unsupported locales), which
// Search Console then reports as a broken hreflang cluster.
//
// We filter the `Link:` header on the way out so the alternates only
// list locales that actually serve content. The HTML head already does
// this correctly via Next's metadata API; this just keeps the HTTP
// header in sync.
type LocalePathnameValue = string | Record<string, string>;

interface SingleLocaleEntry {
  allowedLocales: Set<string>;
  // URL path of the canonical existing locale, used to rewrite
  // `x-default` so it doesn't point at a 404.
  primaryLocalePath: string;
}

function buildSingleLocaleIndex(): Map<string, SingleLocaleEntry> {
  const index = new Map<string, SingleLocaleEntry>();
  const totalLocales = routing.locales.length;
  const pathnames = routing.pathnames as Record<string, LocalePathnameValue>;

  for (const value of Object.values(pathnames)) {
    if (typeof value === "string") continue;

    const localeKeys = Object.keys(value);
    if (localeKeys.length === totalLocales) continue;

    const allowedLocales = new Set(localeKeys);
    const primaryLocale = localeKeys[0];
    const primaryPath = value[primaryLocale];
    const primaryLocalePath =
      primaryLocale === routing.defaultLocale
        ? primaryPath
        : `/${primaryLocale}${primaryPath}`;

    const sharedEntry: SingleLocaleEntry = { allowedLocales, primaryLocalePath };

    for (const [locale, localePath] of Object.entries(value)) {
      const fullPath =
        locale === routing.defaultLocale ? localePath : `/${locale}${localePath}`;
      index.set(fullPath, sharedEntry);
    }
  }

  return index;
}

const SINGLE_LOCALE_PATH_INDEX = buildSingleLocaleIndex();

function filterHreflangLinkHeader(
  linkHeader: string,
  entry: SingleLocaleEntry,
  origin: string,
): string {
  const parts = linkHeader
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const filtered = parts.flatMap((part) => {
    const langMatch = part.match(/hreflang="([^"]+)"/);
    if (!langMatch) return [part];

    const lang = langMatch[1];
    if (lang === "x-default") {
      // x-default would otherwise point to the default-locale URL,
      // which doesn't exist for these pages. Rewrite to the canonical
      // existing locale.
      return [
        `<${origin}${entry.primaryLocalePath}>; rel="alternate"; hreflang="x-default"`,
      ];
    }
    if (entry.allowedLocales.has(lang)) {
      return [part];
    }
    return [];
  });

  return filtered.join(", ");
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // Step 1: www redirect (before i18n)
  if (host.startsWith("www.")) {
    const nonWwwHost = host.replace("www.", "");
    const url = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      `https://${nonWwwHost}`,
    );
    return NextResponse.redirect(url, 301);
  }

  // Step 2: i18n routing (locale detection + redirect).
  //
  // Pool-region detection USED to live here too — the middleware would set a
  // `pool-region` cookie based on Cloudflare's CF-IPCountry header on every
  // request. That had two unintended consequences:
  //
  //   1. Every response carried a Set-Cookie, which Next/Vercel adapters
  //      treat as a signal that the response varies per user, downgrading
  //      it to `Cache-Control: private, no-cache, no-store`. Combined with
  //      the Server Components that read the cookie, this made every public
  //      SEO page non-cacheable.
  //   2. Search Console saw 40+ URLs in "Crawled - currently not indexed",
  //      because Google interprets `no-store` as "this is per-user content"
  //      and de-prioritises indexing.
  //
  // Region detection now happens client-side (`PoolTermProvider` calls
  // `/api/region` once per device after hydration and persists the answer
  // in localStorage). The middleware only handles i18n, so most public
  // responses can be statically renderable again.
  const response = handleI18nRouting(request);

  // Step 3: filter cross-locale alternates from the Link header for
  // single-locale paths (see comment on SINGLE_LOCALE_PATH_INDEX above).
  if (
    response.status >= 200 &&
    response.status < 300 &&
    response.headers.has("link")
  ) {
    const entry = SINGLE_LOCALE_PATH_INDEX.get(request.nextUrl.pathname);
    if (entry) {
      const linkHeader = response.headers.get("link") || "";
      const origin = `https://${host}`;
      const filtered = filterHreflangLinkHeader(linkHeader, entry, origin);
      if (filtered) {
        response.headers.set("link", filtered);
      } else {
        response.headers.delete("link");
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|icon|opengraph-image|apple-icon|pwa-icon-192|pwa-icon-512|manifest.webmanifest|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
