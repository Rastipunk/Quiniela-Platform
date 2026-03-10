import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ReembolsosContent } from "./ReembolsosContent";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";

  const pathMap: Record<string, string> = {
    es: "/reembolsos",
    en: "/refunds",
    pt: "/reembolsos",
  };
  const localePath = locale === "es" ? "" : `/${locale}`;
  const pagePath = pathMap[locale] || pathMap.es;
  const url = `${baseUrl}${localePath}${pagePath}`;

  return {
    title: t("refunds.title"),
    description: t("refunds.description"),
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/reembolsos`,
        en: `${baseUrl}/en/refunds`,
        pt: `${baseUrl}/pt/reembolsos`,
        "x-default": `${baseUrl}/reembolsos`,
      },
    },
  };
}

export default async function ReembolsosPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const baseUrl = "https://picks4all.com";
  const localePath = locale === "es" ? "" : `/${locale}`;

  const pathMap: Record<string, string> = {
    es: "/reembolsos",
    en: "/refunds",
    pt: "/reembolsos",
  };
  const breadcrumbPath = pathMap[locale] || pathMap.es;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbHome"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbRefunds"), url: `${baseUrl}${localePath}${breadcrumbPath}` },
        ]}
      />
      <ReembolsosContent />
    </>
  );
}
