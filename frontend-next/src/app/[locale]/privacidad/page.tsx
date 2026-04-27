import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PrivacidadContent } from "./PrivacidadContent";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("privacy.title"),
    description: t("privacy.description"),
    path: { es: "/privacidad", en: "/privacy", pt: "/privacidade" },
  });
}

export default async function PrivacidadPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;

  const pathMap: Record<string, string> = {
    es: "/privacidad",
    en: "/privacy",
    pt: "/privacidade",
  };
  const breadcrumbPath = pathMap[locale] || pathMap.es;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbHome"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbPrivacy"), url: `${baseUrl}${localePath}${breadcrumbPath}` },
        ]}
      />
      <PrivacidadContent />
    </>
  );
}
