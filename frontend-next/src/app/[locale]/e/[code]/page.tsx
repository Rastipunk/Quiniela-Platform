import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo";
import { PublicBarRace } from "./PublicBarRace";

// Public "Evolución" share page: picks4all.com/e/{shareCode}. No login.
// Server component resolves the pool name (for a nice OG/WhatsApp preview) then
// hands off to the client renderer.

/** Server-side, dependency-free fetch of just the pool name for OG metadata. */
async function fetchPoolName(code: string): Promise<string> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    const r = await fetch(`${base}/public/evolution/${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!r.ok) return "";
    const d = (await r.json()) as { poolName?: unknown };
    return typeof d?.poolName === "string" ? d.poolName : "";
  } catch {
    return "";
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}): Promise<Metadata> {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pool");

  const poolName = await fetchPoolName(code);
  const title = poolName
    ? `🏁 ${t("barRace.title")} — ${poolName}`
    : t("barRace.publicMetaTitle");

  return buildPageMetadata({
    locale,
    title,
    description: t("barRace.publicMetaDescription"),
    path: `/e/${code}`,
    // Shareable, ephemeral per-pool page — not for search indexing.
    extra: { robots: { index: false, follow: false } },
  });
}

export default async function PublicBarRacePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return <PublicBarRace code={code} />;
}
