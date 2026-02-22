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
  const url = `${baseUrl}${localePath}/prode-deportivo`;

  return {
    title: t("prodeDeportivo.title"),
    description: t("prodeDeportivo.description"),
    openGraph: {
      title: t("prodeDeportivo.title"),
      description: t("prodeDeportivo.description"),
      url,
      type: "article",
    },
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/prode-deportivo`,
        en: `${baseUrl}/en/prode-deportivo`,
        pt: `${baseUrl}/pt/prode-deportivo`,
      },
    },
  };
}

const relatedLinks = [
  { key: "relatedQuiniela", href: "/que-es-una-quiniela" },
  { key: "relatedHowItWorks", href: "/como-funciona" },
  { key: "relatedFaq", href: "/faq" },
  { key: "relatedPolla", href: "/polla-futbolera" },
  { key: "relatedPenca", href: "/penca-futbol" },
  { key: "relatedPorra", href: "/porra-deportiva" },
  { key: "relatedFootballPool", href: "/football-pool" },
];

export default async function ProdeDeportivoPage() {
  const locale = await getLocale();
  const t = await getTranslations("prode");
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
      "@id": `${baseUrl}${localePath}/prode-deportivo`,
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbHome"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbPage"), url: `${baseUrl}${localePath}/prode-deportivo` },
        ]}
      />
      <JsonLd data={articleJsonLd} />
      <RegionalArticlePage namespace="prode" relatedLinks={relatedLinks} />
    </>
  );
}
