import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { EnterpriseLandingContent } from "@/components/EnterpriseLandingContent";
import { SITE_URL } from "@/lib/siteConfig";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("enterprise.meta");
  const baseUrl = SITE_URL;

  const localePaths: Record<string, string> = {
    es: "/empresas",
    en: "/en/for-companies",
    pt: "/pt/para-empresas",
  };

  const url = `${baseUrl}${localePaths[locale] || "/empresas"}`;

  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url,
      type: "website",
    },
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/empresas`,
        en: `${baseUrl}/en/for-companies`,
        pt: `${baseUrl}/pt/para-empresas`,
        "x-default": `${baseUrl}/empresas`,
      },
    },
  };
}

export default function EnterprisePage() {
  return (
    <PublicPageWrapper>
      <EnterpriseLandingContent />
    </PublicPageWrapper>
  );
}
