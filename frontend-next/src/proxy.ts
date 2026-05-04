import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

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
  return handleI18nRouting(request);
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|icon|opengraph-image|apple-icon|pwa-icon-192|pwa-icon-512|manifest.webmanifest|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
