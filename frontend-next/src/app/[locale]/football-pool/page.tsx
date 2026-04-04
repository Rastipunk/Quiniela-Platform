import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { RegionalArticlePage } from "@/components/RegionalArticlePage";
import { SITE_URL } from "@/lib/siteConfig";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;
  const url = `${baseUrl}${localePath}/football-pool`;

  return {
    title: t("footballPool.title"),
    description: t("footballPool.description"),
    openGraph: {
      title: t("footballPool.title"),
      description: t("footballPool.description"),
      url,
      type: "article",
    },
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/football-pool`,
        en: `${baseUrl}/en/football-pool`,
        pt: `${baseUrl}/pt/football-pool`,
        "x-default": `${baseUrl}/football-pool`,
      },
    },
  };
}

const relatedLinks = [
  { key: "relatedQuiniela", href: "/que-es-una-quiniela" },
  { key: "relatedHowItWorks", href: "/como-funciona" },
  { key: "relatedFaq", href: "/faq" },
  { key: "relatedPolla", href: "/polla-futbolera" },
  { key: "relatedProde", href: "/prode-deportivo" },
  { key: "relatedPenca", href: "/penca-futbol" },
  { key: "relatedPorra", href: "/porra-deportiva" },
];

export default async function FootballPoolPage() {
  const locale = await getLocale();
  const t = await getTranslations("footballPool");
  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t("heroTitle"),
    description: t("heroSubtitle"),
    inLanguage: locale,
    datePublished: "2026-02-22",
    dateModified: "2026-02-22",
    image: `${SITE_URL}/opengraph-image`,
    author: { "@type": "Organization", name: "Picks4All", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Picks4All",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/opengraph-image` },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}${localePath}/football-pool`,
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbHome"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbPage"), url: `${baseUrl}${localePath}/football-pool` },
        ]}
      />
      <JsonLd data={articleJsonLd} />
      <RegionalArticlePage namespace="footballPool" relatedLinks={relatedLinks} />
    </>
  );
}
