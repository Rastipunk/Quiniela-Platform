import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

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
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Picks4All — Quinielas, Pollas y Prodes de Futbol Gratis",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  metadataBase: new URL("https://picks4all.com"),
  alternates: {
    languages: { es: "https://picks4all.com" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
        {/* Google Identity Services (for Google login) */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
