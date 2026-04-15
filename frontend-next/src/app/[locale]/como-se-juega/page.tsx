import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/siteConfig";
import { HowToPlayContent } from "./HowToPlayContent";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = SITE_URL;

  const localePath = locale === "es" ? "" : `/${locale}`;
  const pagePath = locale === "en" ? "/how-to-play" : locale === "pt" ? "/como-jogar" : "/como-se-juega";
  const url = `${baseUrl}${localePath}${pagePath}`;

  return {
    title: t("howToPlay.title"),
    description: t("howToPlay.description"),
    openGraph: {
      title: t("howToPlay.title"),
      description: t("howToPlay.description"),
      url,
      type: "website",
    },
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/como-se-juega`,
        en: `${baseUrl}/en/how-to-play`,
        pt: `${baseUrl}/pt/como-jogar`,
        "x-default": `${baseUrl}/como-se-juega`,
      },
    },
  };
}

export default async function HowToPlayPage() {
  const locale = await getLocale();
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
