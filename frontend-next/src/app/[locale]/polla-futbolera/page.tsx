import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { RegionalArticlePage } from "@/components/RegionalArticlePage";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";
  const localePath = locale === "es" ? "" : `/${locale}`;
  const url = `${baseUrl}${localePath}/polla-futbolera`;

  return {
    title: t("pollaFutbolera.title"),
    description: t("pollaFutbolera.description"),
    openGraph: {
      title: t("pollaFutbolera.title"),
      description: t("pollaFutbolera.description"),
      url,
      type: "article",
    },
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/polla-futbolera`,
        en: `${baseUrl}/en/polla-futbolera`,
        pt: `${baseUrl}/pt/polla-futbolera`,
        "x-default": `${baseUrl}/polla-futbolera`,
      },
    },
  };
}

const relatedLinks = [
  { key: "relatedQuiniela", href: "/que-es-una-quiniela" },
  { key: "relatedHowItWorks", href: "/como-funciona" },
  { key: "relatedFaq", href: "/faq" },
  { key: "relatedProde", href: "/prode-deportivo" },
  { key: "relatedPenca", href: "/penca-futbol" },
  { key: "relatedPorra", href: "/porra-deportiva" },
  { key: "relatedFootballPool", href: "/football-pool" },
];

export default async function PollaFutboleraPage() {
  const locale = await getLocale();
  const t = await getTranslations("polla");
  const baseUrl = "https://picks4all.com";
  const localePath = locale === "es" ? "" : `/${locale}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t("heroTitle"),
    description: t("heroSubtitle"),
    inLanguage: locale,
    datePublished: "2026-02-13",
    dateModified: "2026-02-22",
    image: "https://picks4all.com/opengraph-image",
    author: { "@type": "Organization", name: "Picks4All", url: "https://picks4all.com" },
    publisher: {
      "@type": "Organization",
      name: "Picks4All",
      url: "https://picks4all.com",
      logo: { "@type": "ImageObject", url: "https://picks4all.com/opengraph-image" },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}${localePath}/polla-futbolera`,
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbHome"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbPage"), url: `${baseUrl}${localePath}/polla-futbolera` },
        ]}
      />
      <JsonLd data={articleJsonLd} />
      <RegionalArticlePage namespace="polla" relatedLinks={relatedLinks} />
    </>
  );
}
