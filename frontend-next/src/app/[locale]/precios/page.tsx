import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PricingPageContent } from "./PricingPageContent";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";

  const pathMap: Record<string, string> = {
    es: "/precios",
    en: "/pricing",
    pt: "/precos",
  };
  const localePath = locale === "es" ? "" : `/${locale}`;
  const pagePath = pathMap[locale] || pathMap.es;
  const url = `${baseUrl}${localePath}${pagePath}`;

  return {
    title: t("pricing.title"),
    description: t("pricing.description"),
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/precios`,
        en: `${baseUrl}/en/pricing`,
        pt: `${baseUrl}/pt/precos`,
        "x-default": `${baseUrl}/precios`,
      },
    },
  };
}

export default async function PreciosPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const baseUrl = "https://picks4all.com";
  const localePath = locale === "es" ? "" : `/${locale}`;

  const pathMap: Record<string, string> = {
    es: "/precios",
    en: "/pricing",
    pt: "/precos",
  };
  const breadcrumbPath = pathMap[locale] || pathMap.es;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbHome"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbPricing"), url: `${baseUrl}${localePath}${breadcrumbPath}` },
        ]}
      />
      <PricingPageContent />
    </>
  );
}
