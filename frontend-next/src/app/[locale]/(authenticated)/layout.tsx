import type { Metadata } from "next";
import { AuthenticatedLayoutClient } from "./AuthenticatedLayoutClient";

// Authenticated routes (dashboard, pools, profile, crear-pool, admin/*) must
// not be indexed. robots.txt already Disallows these paths, but a meta
// noindex,nofollow here defends in depth in case any URL slips through
// crawl-delay or sitemap leakage.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayoutClient>{children}</AuthenticatedLayoutClient>;
}
