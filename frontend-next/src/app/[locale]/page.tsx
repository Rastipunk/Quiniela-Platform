import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { LandingContent } from "@/components/LandingContent";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";

  const localePath = locale === "es" ? "" : `/${locale}`;
  const url = `${baseUrl}${localePath}`;

  return {
    title: {
      absolute: t("home.title"),
    },
    description: t("home.description"),
    openGraph: {
      title: t("home.title"),
      description: t("home.description"),
      url,
      type: "website",
    },
    alternates: {
      canonical: url,
      languages: {
        es: baseUrl,
        en: `${baseUrl}/en`,
        pt: `${baseUrl}/pt`,
        "x-default": baseUrl,
      },
    },
  };
}

export default function LandingPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Picks4All",
          description:
            "Plataforma gratuita de quinielas deportivas (pollas, prodes, pencas) para competir con amigos prediciendo resultados de futbol",
          url: "https://picks4all.com",
          applicationCategory: "SportsApplication",
          applicationSubCategory: "Game",
          operatingSystem: "Web",
          inLanguage: "es",
          image: "https://picks4all.com/opengraph-image",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          publisher: {
            "@type": "Organization",
            name: "Picks4All",
            url: "https://picks4all.com",
          },
          featureList: [
            "Crear quinielas deportivas gratis",
            "Invitar amigos con codigo de invitacion",
            "Predicciones de partidos de futbol",
            "Leaderboard automatico en tiempo real",
            "Reglas de puntuacion personalizables",
            "Compatible con Mundial 2026 y Champions League",
          ],
          potentialAction: {
            "@type": "ViewAction",
            target: "https://picks4all.com",
            name: "Crear Quiniela Gratis",
          },
        }}
      />
      <PublicPageWrapper>
        <LandingContent />
      </PublicPageWrapper>
    </>
  );
}
