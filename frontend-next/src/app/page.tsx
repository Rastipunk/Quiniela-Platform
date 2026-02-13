import type { Metadata } from "next";
import { PublicPageWrapper } from "../components/PublicPageWrapper";
import { JsonLd } from "../components/JsonLd";
import { LandingContent } from "../components/LandingContent";

export const metadata: Metadata = {
  title: {
    absolute: "Quinielas Deportivas Gratis con Amigos — Polla, Prode, Penca | Picks4All",
  },
  description:
    "Crea tu quiniela, polla o prode gratis. Invita amigos, haz predicciones de futbol y compite en el leaderboard. Mundial 2026 y Champions League. 100% gratis, sin apuestas.",
  openGraph: {
    title: "Picks4All — Quinielas Deportivas Gratis con Amigos",
    description:
      "La plataforma gratuita para crear quinielas, pollas, prodes y pencas de futbol. Compite con amigos prediciendo resultados.",
    url: "https://picks4all.com",
    type: "website",
  },
  alternates: {
    canonical: "https://picks4all.com",
  },
};

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
