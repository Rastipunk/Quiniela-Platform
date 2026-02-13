import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { BetaFeedbackBar } from "../components/BetaFeedbackBar";
import { JsonLd } from "../components/JsonLd";

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f4f5f7",
};

export const metadata: Metadata = {
  title: {
    default: "Picks4All — Quinielas Deportivas Gratis con Amigos",
    template: "%s | Picks4All",
  },
  description:
    "Crea quinielas, pollas, prodes y pencas de futbol gratis. Predice resultados del Mundial 2026, Champions League y mas. Sin dinero real, solo diversion entre amigos.",
  keywords: [
    "quiniela",
    "quiniela deportiva",
    "quiniela online gratis",
    "quiniela mundial 2026",
    "polla futbolera",
    "polla mundialista",
    "prode online",
    "penca de futbol",
    "porra deportiva",
    "predicciones futbol",
    "pronosticos deportivos gratis",
    "crear quiniela con amigos",
    "copa del mundo 2026",
    "champions league",
  ],
  openGraph: {
    type: "website",
    locale: "es_LA",
    url: "https://picks4all.com",
    siteName: "Picks4All",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Picks4All — Quinielas deportivas gratis entre amigos",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  metadataBase: new URL("https://picks4all.com"),
  alternates: {
    canonical: "https://picks4all.com",
    languages: {
      es: "https://picks4all.com",
      "x-default": "https://picks4all.com",
    },
  },
  verification: {
    google: "mLDBKCz1jxTO32YsN9ovBRguWz9Ikmc7RWZoq21O3mY",
  },
  other: {
    "color-scheme": "light only",
    "supported-color-schemes": "light only",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" style={{ colorScheme: "light only" } as React.CSSProperties}>
      <head>
        <link rel="dns-prefetch" href="https://media.api-sports.io" />
        <link rel="dns-prefetch" href="https://flagcdn.com" />
      </head>
      <body style={{ backgroundColor: "#f4f5f7", color: "#111827" }}>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Picks4All",
            url: "https://picks4all.com",
            logo: "https://picks4all.com/opengraph-image",
            description:
              "Plataforma gratuita de quinielas deportivas (pollas, prodes, pencas) para competir con amigos prediciendo resultados de futbol",
          }}
        />
        <BetaFeedbackBar />
        {children}
        {/* Google Analytics (GA4) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8JG2YTDLPH"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8JG2YTDLPH');
          `}
        </Script>
        {/* Google Identity Services (for Google login) — beforeInteractive for Safari ITP compatibility */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
