import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ReembolsosContent } from "./ReembolsosContent";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("refunds.title"),
    description: t("refunds.description"),
    path: { es: "/reembolsos", en: "/refunds", pt: "/reembolsos" },
  });
}

export default async function ReembolsosPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const baseUrl = SITE_URL;
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
