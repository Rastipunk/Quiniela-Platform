import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { EnterpriseLandingContent } from "@/components/EnterpriseLandingContent";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("enterprise.meta");
  return buildPageMetadata({
    locale,
    title: t("title"),
    description: t("description"),
    path: { es: "/empresas", en: "/for-companies", pt: "/para-empresas" },
  });
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
