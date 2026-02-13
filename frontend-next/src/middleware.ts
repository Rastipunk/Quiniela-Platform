import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // Redirect www → non-www
  if (host.startsWith("www.")) {
    const nonWwwHost = host.replace("www.", "");
    const url = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      `https://${nonWwwHost}`
    );
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
