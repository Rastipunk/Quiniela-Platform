import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { RegionalArticlePage } from "@/components/RegionalArticlePage";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

const PUBLISHED_AT = "2026-02-13T00:00:00Z";
const MODIFIED_AT = "2026-02-22T00:00:00Z";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "en") notFound();

  setRequestLocale(locale);
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("footballPool.title"),
    description: t("footballPool.description"),
    path: "/football-pool",
    type: "article",
    article: { publishedTime: PUBLISHED_AT, modifiedTime: MODIFIED_AT },
  });
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

export default async function FootballPoolPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "en") notFound();

  setRequestLocale(locale);
  const t = await getTranslations("footballPool");
  const baseUrl = SITE_URL;
  const localePath = `/${locale}`;

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
