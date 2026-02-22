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
  const url = `${baseUrl}${localePath}/porra-deportiva`;

  return {
    title: t("porraDeportiva.title"),
    description: t("porraDeportiva.description"),
    openGraph: {
      title: t("porraDeportiva.title"),
      description: t("porraDeportiva.description"),
      url,
      type: "article",
    },
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/porra-deportiva`,
        en: `${baseUrl}/en/porra-deportiva`,
        pt: `${baseUrl}/pt/porra-deportiva`,
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
  { key: "relatedFootballPool", href: "/football-pool" },
];

export default async function PorraDeportivaPage() {
  const locale = await getLocale();
  const t = await getTranslations("porra");
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
      "@id": `${baseUrl}${localePath}/porra-deportiva`,
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbHome"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbPage"), url: `${baseUrl}${localePath}/porra-deportiva` },
        ]}
      />
      <JsonLd data={articleJsonLd} />
      <RegionalArticlePage namespace="porra" relatedLinks={relatedLinks} />
    </>
  );
}
