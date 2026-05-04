/**
 * GET /api/region
 *
 * Returns the visitor's preferred pool region ("quiniela" | "polla" | "prode"
 * | "penca" | "porra"), inferred from Cloudflare's CF-IPCountry header.
 *
 * Why this exists as an endpoint instead of being read in a Server Component:
 *   The home page, FAQ, and the regional landing pages are public SEO targets.
 *   Reading `cookies()` or `headers()` from a Server Component forces Next.js
 *   to flag the response as dynamic and emit `Cache-Control: private, no-store`.
 *   Google reads that as "this content is per-user" and de-prioritises
 *   indexing — exactly what we observed in Search Console
 *   ("Crawled - currently not indexed" on 40 pages).
 *
 *   By moving region detection out of the render path and into a small JSON
 *   endpoint that the client calls once after hydration, the SSR HTML stays
 *   genuinely static and cacheable. Users still see their localised wording
 *   ("polla" in Colombia, "prode" in Argentina, etc.) — it just happens
 *   client-side a beat after first paint.
 *
 * Caching: the endpoint must NOT be cached at the edge — its response varies
 * by request IP. We set `Cache-Control: no-store` so each visitor gets their
 * own answer. Frequency is one call per visitor per device per year (the
 * client mirrors the result into localStorage with that TTL).
 */

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  DEFAULT_REGION,
  regionFromCountryCode,
  type PoolRegion,
} from "@/lib/poolTerms";

export const dynamic = "force-dynamic"; // explicit — depends on the request IP

export async function GET() {
  const h = await headers();
  // Cloudflare sets CF-IPCountry on every request that passes through its
  // edge. In dev or behind any proxy that strips it, falls back to default.
  const country = h.get("cf-ipcountry") ?? "";
  const region: PoolRegion = country
    ? regionFromCountryCode(country)
    : DEFAULT_REGION;

  return NextResponse.json(
    { region, country: country || null },
    {
      // No-store on the JSON response is fine — the client caches it in
      // localStorage so this endpoint sees at most one call per device.
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
