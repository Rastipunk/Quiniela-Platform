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

// Paths where a NEXT_LOCALE cookie is allowed to override the URL-based
// locale detection. All of these have a UNIFORM mapping across locales
// (the same path exists at /en/X, /pt/X and /X), so prepending the
// cookie's locale to the path always resolves to a real route.
//
// Translated routes like /crear-pool ↔ /create-pool ↔ /criar-pool are
// intentionally NOT in this list — next-intl can't serve /en/crear-pool
// (it expects /en/create-pool), so prepending the locale would 404.
// Locale-aware `Link`s from `@/i18n/navigation` handle those paths
// correctly; this guard is the safety net for non-aware navigations
// (raw `<a href>`, `window.location.href = "/..."`, etc.).
const COOKIE_REDIRECT_PREFIXES = [
  // Authenticated app
  "/dashboard",
  "/profile",
  "/pools",
  "/admin",
  "/pago",
  // Public auth flows
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

function pathMatchesCookieRedirect(path: string): boolean {
  return COOKIE_REDIRECT_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
}

function pathStartsWithLocale(path: string): boolean {
  return routing.locales.some(
    (l) => path === `/${l}` || path.startsWith(`/${l}/`),
  );
}

// Return the locale prefix at the start of the path, or null if none.
// Used by the manual locale resolution block below to compare against
// the user's cookie / Accept-Language preference.
function extractUrlLocalePrefix(path: string): string | null {
  for (const l of routing.locales) {
    if (path === `/${l}` || path.startsWith(`/${l}/`)) return l;
  }
  return null;
}

// Strip a leading /en, /pt, etc. locale prefix from the path. Used to
// compare the "logical" path against COOKIE_REDIRECT_PREFIXES, which
// stores unprefixed entries like "/dashboard" — without stripping, a
// hit on /en/dashboard wouldn't match the entry.
function stripLocalePrefix(path: string): string {
  const p = extractUrlLocalePrefix(path);
  if (!p) return path;
  const after = path.slice(p.length + 1);
  return after === "" ? "/" : after;
}

// Manual Accept-Language detection. Parses the header (e.g.
// "en-US,en;q=0.9,es;q=0.8") into primary-subtag candidates ordered
// by browser priority and returns the first one in routing.locales.
// Replaces the auto-detection that next-intl used to do before we
// disabled `localeDetection`. See LOCALE_RESOLUTION_AUDIT.md §3.1.
function detectLocaleFromAcceptLanguage(header: string | null): string | null {
  if (!header) return null;
  const candidates = header
    .split(",")
    .map((part) => part.split(";")[0]?.trim().toLowerCase() ?? "")
    .filter(Boolean);
  for (const lang of candidates) {
    // "en-US" → "en", "pt-BR" → "pt". Browsers send region tags;
    // routing.locales is primary-only.
    const primary = lang.split("-")[0] ?? "";
    if ((routing.locales as readonly string[]).includes(primary)) {
      return primary;
    }
  }
  return null;
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

  // Step 1b: locale resolution.
  //
  // Precedence (LOCALE_RESOLUTION_AUDIT.md §3.1):
  //   1. URL prefix (/en, /pt) — authoritative if cookie agrees or absent.
  //   2. NEXT_LOCALE cookie — written by LanguageSelector,
  //      LocalePreferenceModal, and backend setAuthCookies at login.
  //      If it disagrees with the URL, we redirect to match the cookie.
  //   3. Accept-Language — only for anonymous visitors with no cookie.
  //   4. routing.defaultLocale (es) — terminal fallback.
  //
  // We only READ cookies (no Set-Cookie on the response), so the SEO
  // cacheability documented in i18n/routing.ts stays intact: bots have
  // no cookie and continue to land on the default-locale URL.
  //
  // next-intl is configured with localeDetection:false so it no longer
  // does Accept-Language detection. The manual detection below is the
  // single source of truth.
  const path = request.nextUrl.pathname;
  const urlLocale = extractUrlLocalePrefix(path);
  const cookieValue = request.cookies.get("NEXT_LOCALE")?.value;
  const cookieLocale =
    cookieValue && (routing.locales as readonly string[]).includes(cookieValue)
      ? cookieValue
      : null;

  // The cookie-redirect (and Accept-Language fallback) only applies to
  // authenticated app paths + public auth flows. Public SEO pages
  // continue to be served by next-intl directly without our overrides.
  const unprefixedPath = urlLocale ? stripLocalePrefix(path) : path;
  const inScope = pathMatchesCookieRedirect(unprefixedPath);

  if (inScope) {
    // Step A: cookie present → it wins. Reconcile URL with cookie.
    if (cookieLocale) {
      // ES (default) lives at unprefixed paths; EN/PT at /en/X and /pt/X.
      const desiredUrlLocale =
        cookieLocale === routing.defaultLocale ? null : cookieLocale;
      if (desiredUrlLocale !== urlLocale) {
        const target = desiredUrlLocale
          ? `/${desiredUrlLocale}${unprefixedPath === "/" ? "" : unprefixedPath}`
          : unprefixedPath;
        return NextResponse.redirect(
          new URL(target + request.nextUrl.search, request.nextUrl.origin),
          307,
        );
      }
      // cookie matches URL — no redirect, fall through.
    } else if (!urlLocale) {
      // Step B: no cookie + no URL prefix → manual Accept-Language detection.
      const detected = detectLocaleFromAcceptLanguage(
        request.headers.get("accept-language"),
      );
      if (detected && detected !== routing.defaultLocale) {
        const target = `/${detected}${path}`;
        return NextResponse.redirect(
          new URL(target + request.nextUrl.search, request.nextUrl.origin),
          307,
        );
      }
      // detected is default or null → fall through (next-intl serves default).
    }
    // Step C: cookie absent + URL has prefix → respect URL, fall through.
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
