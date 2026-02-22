import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { TerminosContent } from "./TerminosContent";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";

  const pathMap: Record<string, string> = {
    es: "/terminos",
    en: "/terms",
    pt: "/termos",
  };
  const localePath = locale === "es" ? "" : `/${locale}`;
  const pagePath = pathMap[locale] || pathMap.es;
  const url = `${baseUrl}${localePath}${pagePath}`;

  return {
    title: t("terms.title"),
    description: t("terms.description"),
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/terminos`,
        en: `${baseUrl}/en/terms`,
        pt: `${baseUrl}/pt/termos`,
        "x-default": `${baseUrl}/terminos`,
      },
    },
  };
}

export default async function TerminosPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const baseUrl = "https://picks4all.com";
  const localePath = locale === "es" ? "" : `/${locale}`;

  const pathMap: Record<string, string> = {
    es: "/terminos",
    en: "/terms",
    pt: "/termos",
  };
  const breadcrumbPath = pathMap[locale] || pathMap.es;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbHome"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbTerms"), url: `${baseUrl}${localePath}${breadcrumbPath}` },
        ]}
      />
      <TerminosContent />
    </>
  );
}
