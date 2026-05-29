import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TerminosContent } from "./TerminosContent";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("terms.title"),
    description: t("terms.description"),
    path: { es: "/terminos", en: "/terms", pt: "/termos" },
  });
}

export default async function TerminosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const baseUrl = SITE_URL;
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
