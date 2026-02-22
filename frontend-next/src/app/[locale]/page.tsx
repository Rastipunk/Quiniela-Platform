import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { LandingContent } from "@/components/LandingContent";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";

  const localePath = locale === "es" ? "" : `/${locale}`;
  const url = `${baseUrl}${localePath}`;

  return {
    title: {
      absolute: t("home.title"),
    },
    description: t("home.description"),
    openGraph: {
      title: t("home.title"),
      description: t("home.description"),
      url,
      type: "website",
    },
    alternates: {
      canonical: url,
      languages: {
        es: baseUrl,
        en: `${baseUrl}/en`,
        pt: `${baseUrl}/pt`,
        "x-default": baseUrl,
      },
    },
  };
}

export default async function LandingPage() {
  const locale = await getLocale();
  const t = await getTranslations("jsonLd");
  const baseUrl = "https://picks4all.com";
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
          image: "https://picks4all.com/opengraph-image",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          publisher: {
            "@type": "Organization",
            name: "Picks4All",
            url: "https://picks4all.com",
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
