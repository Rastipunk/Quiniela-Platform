import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";
import { HowToPlayContent } from "./HowToPlayContent";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("howToPlay.title"),
    description: t("howToPlay.description"),
    path: { es: "/como-se-juega", en: "/how-to-play", pt: "/como-jogar" },
  });
}

export default async function HowToPlayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("howToPlay");

  const localePath = locale === "es" ? "" : `/${locale}`;
  const pagePath = locale === "en" ? "/how-to-play" : locale === "pt" ? "/como-jogar" : "/como-se-juega";
  const crumbs = [
    { name: "Picks4All", url: `${SITE_URL}${localePath}` },
    { name: t("title"), url: `${SITE_URL}${localePath}${pagePath}` },
  ];

  return (
    <PublicPageWrapper>
      <Breadcrumbs items={crumbs} />
      <HowToPlayContent />
    </PublicPageWrapper>
  );
}
