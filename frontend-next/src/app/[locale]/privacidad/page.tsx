import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PrivacidadContent } from "./PrivacidadContent";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";

  const pathMap: Record<string, string> = {
    es: "/privacidad",
    en: "/privacy",
    pt: "/privacidade",
  };
  const localePath = locale === "es" ? "" : `/${locale}`;
  const pagePath = pathMap[locale] || pathMap.es;
  const url = `${baseUrl}${localePath}${pagePath}`;

  return {
    title: t("privacy.title"),
    description: t("privacy.description"),
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/privacidad`,
        en: `${baseUrl}/en/privacy`,
        pt: `${baseUrl}/pt/privacidade`,
      },
    },
  };
}

export default function PrivacidadPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Inicio", url: "https://picks4all.com" },
          { name: "Politica de Privacidad", url: "https://picks4all.com/privacidad" },
        ]}
      />
      <PrivacidadContent />
    </>
  );
}
