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
      },
    },
  };
}

export default function TerminosPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Inicio", url: "https://picks4all.com" },
          { name: "Terminos y Condiciones", url: "https://picks4all.com/terminos" },
        ]}
      />
      <TerminosContent />
    </>
  );
}
