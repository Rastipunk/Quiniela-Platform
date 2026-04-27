import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { LandingContent } from "@/components/LandingContent";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("home.title"),
    description: t("home.description"),
    path: "",
    extra: {
      // Home title is absolute (no template suffix appended).
      title: { absolute: t("home.title") },
    },
  });
}

export default async function LandingPage() {
  const locale = await getLocale();
  const t = await getTranslations("jsonLd");
  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;
  const url = `${baseUrl}${localePath}`;

  const featureList: string[] = [];
  for (let i = 0; i < 6; i++) {
    featureList.push(t(`featureList.${i}`));
  }

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Picks4All",
          description: t("appDescription"),
          url,
          applicationCategory: "SportsApplication",
          applicationSubCategory: "Game",
          operatingSystem: "Web",
          inLanguage: locale,
          image: `${SITE_URL}/opengraph-image`,
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "COP",
          },
          publisher: {
            "@type": "Organization",
            name: "Picks4All",
            url: SITE_URL,
          },
          featureList,
          potentialAction: {
            "@type": "ViewAction",
            target: url,
            name: t("ctaName"),
          },
        }}
      />
      <PublicPageWrapper>
        <LandingContent />
      </PublicPageWrapper>
    </>
  );
}
