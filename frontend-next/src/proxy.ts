import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  POOL_REGION_COOKIE,
  regionFromCountryCode,
  DEFAULT_REGION,
  isValidRegion,
} from "./lib/poolTerms";

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

  // Step 2: i18n routing (locale detection, cookie, redirect)
  const response = handleI18nRouting(request);

  // Step 3: Pool region detection (Cloudflare CF-IPCountry → cookie)
  // Only set the cookie if it doesn't already exist (respect first detection)
  const existingRegion = request.cookies.get(POOL_REGION_COOKIE)?.value;
  if (!existingRegion || !isValidRegion(existingRegion)) {
    const countryCode = request.headers.get("cf-ipcountry") || "";
    const region = countryCode
      ? regionFromCountryCode(countryCode)
      : DEFAULT_REGION;
    response.cookies.set(POOL_REGION_COOKIE, region, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|icon|opengraph-image|apple-icon|pwa-icon-192|pwa-icon-512|manifest.webmanifest|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
