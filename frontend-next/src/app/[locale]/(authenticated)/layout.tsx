import type { Metadata } from "next";
import { AuthenticatedLayoutClient } from "./AuthenticatedLayoutClient";

// Authenticated routes (dashboard, pools, profile, crear-pool, admin/*) must
// not be indexed. robots.txt already Disallows these paths, but a meta
// noindex,nofollow here defends in depth in case any URL slips through
// crawl-delay or sitemap leakage.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Force dynamic rendering for the entire authenticated tree.
//
// Why this is needed: when we made the public [locale] layout statically
// renderable (to fix Search Console "Crawled - currently not indexed" on
// our SEO pages), Next.js started attempting to prerender the authenticated
// tree as well. Pages here use client-side hooks like useSearchParams() and
// read tokens from localStorage, so prerendering them surfaces errors like
// "useSearchParams() should be wrapped in a suspense boundary".
//
// These pages are NOT SEO targets — they live behind login, are disallowed
// in robots.txt and carry meta robots="noindex,nofollow". Marking them
// dynamic costs us nothing on the SEO side and gives the per-request
// rendering they actually need.
export const dynamic = "force-dynamic";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayoutClient>{children}</AuthenticatedLayoutClient>;
}
