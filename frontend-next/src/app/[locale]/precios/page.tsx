import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PricingPageContent } from "./PricingPageContent";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("pricing.title"),
    description: t("pricing.description"),
    path: { es: "/precios", en: "/pricing", pt: "/precos" },
  });
}

export default async function PreciosPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;

  const pathMap: Record<string, string> = {
    es: "/precios",
    en: "/pricing",
    pt: "/precos",
  };
  const breadcrumbPath = pathMap[locale] || pathMap.es;

  const pricingJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Picks4All",
    applicationCategory: "SportsApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "COP",
      description: "Free for pools up to 20 participants",
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbHome"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbPricing"), url: `${baseUrl}${localePath}${breadcrumbPath}` },
        ]}
      />
      <JsonLd data={pricingJsonLd} />
      <PricingPageContent />
    </>
  );
}
