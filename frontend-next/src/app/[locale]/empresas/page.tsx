import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { EnterpriseLandingContent } from "@/components/EnterpriseLandingContent";
import { JsonLd } from "@/components/JsonLd";
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
  const enterpriseJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Picks4All",
        url: SITE_URL,
        logo: `${SITE_URL}/opengraph-image`,
      },
      {
        "@type": "Service",
        name: "Picks4All Corporate Pools",
        provider: {
          "@type": "Organization",
          name: "Picks4All",
        },
        description:
          "Corporate sports prediction pools for team building and employee engagement.",
        serviceType: "Corporate Entertainment",
        areaServed: "Worldwide",
      },
    ],
  };

  return (
    <PublicPageWrapper>
      <JsonLd data={enterpriseJsonLd} />
      <EnterpriseLandingContent />
    </PublicPageWrapper>
  );
}
