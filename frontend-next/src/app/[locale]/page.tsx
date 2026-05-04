import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { LandingContent } from "@/components/LandingContent";
import { SITE_URL, WORLD_CUP_FOCUS } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("seo");
  const useWorldCup = WORLD_CUP_FOCUS && locale === "es";
  const title = useWorldCup ? t("home.titleWorldCup") : t("home.title");
  const description = useWorldCup ? t("home.descriptionWorldCup") : t("home.description");
  return buildPageMetadata({
    locale,
    title,
    description,
    path: "",
    extra: {
      // Home title is absolute (no template suffix appended).
      title: { absolute: title },
    },
  });
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("jsonLd");
  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;
  const url = `${baseUrl}${localePath}`;
  const useWorldCup = WORLD_CUP_FOCUS && locale === "es";

  const featureListKey = useWorldCup ? "featureListWorldCup" : "featureList";
  const featureList: string[] = [];
  for (let i = 0; i < 6; i++) {
    featureList.push(t(`${featureListKey}.${i}`));
  }
  const appDescription = useWorldCup ? t("appDescriptionWorldCup") : t("appDescription");
  const ctaName = useWorldCup ? t("ctaNameWorldCup") : t("ctaName");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Picks4All",
          description: appDescription,
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
            name: ctaName,
          },
        }}
      />
      <PublicPageWrapper>
        {/* Suspense boundary required because LandingContent reads
            useSearchParams() (e.g. ?ref=, ?utm_*=). Without it the page
            cannot be statically prerendered, which is what made the home
            page emit Cache-Control: no-store and stay un-indexed. */}
        <Suspense fallback={null}>
          <LandingContent />
        </Suspense>
      </PublicPageWrapper>
    </>
  );
}
