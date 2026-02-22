import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Script from "next/script";
import { routing } from "@/i18n/routing";
import { BetaFeedbackBar } from "@/components/BetaFeedbackBar";
import { JsonLd } from "@/components/JsonLd";
import "../globals.css";

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f4f5f7",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const OG_LOCALES: Record<string, string> = {
  es: "es_LA",
  en: "en_US",
  pt: "pt_BR",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo.home" });
  const baseUrl = "https://picks4all.com";
  const localeUrl = locale === "es" ? baseUrl : `${baseUrl}/${locale}`;

  return {
    title: {
      default: t("title"),
      template: "%s | Picks4All",
    },
    description: t("description"),
    keywords: [
      "quiniela",
      "sports pool",
      "penca",
      "football predictions",
      "World Cup 2026",
      "Champions League",
    ],
    openGraph: {
      type: "website",
      locale: OG_LOCALES[locale] || "es_LA",
      url: localeUrl,
      siteName: "Picks4All",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Picks4All",
        },
      ],
    },
    twitter: { card: "summary_large_image" },
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: localeUrl,
      languages: {
        es: baseUrl,
        en: `${baseUrl}/en`,
        pt: `${baseUrl}/pt`,
        "x-default": baseUrl,
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
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations("jsonLd");

  return (
    <html lang={locale} style={{ colorScheme: "light only" } as React.CSSProperties}>
      <head>
        <link rel="preconnect" href="https://accounts.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://media.api-sports.io" />
        <link rel="dns-prefetch" href="https://flagcdn.com" />
      </head>
      <body style={{ backgroundColor: "#f4f5f7", color: "#111827" }}>
        <NextIntlClientProvider messages={messages}>
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Picks4All",
              url: "https://picks4all.com",
              logo: "https://picks4all.com/opengraph-image",
              inLanguage: locale,
              description: t("orgDescription"),
            }}
          />
          <BetaFeedbackBar />
          {children}
        </NextIntlClientProvider>
        {/* Google Analytics (GA4) — lazyOnload: analytics can wait for idle time */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8JG2YTDLPH"
          strategy="lazyOnload"
        />
        <Script id="google-analytics" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8JG2YTDLPH');
          `}
        </Script>
        {/* Google Identity Services — lazyOnload: only needed on login page */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
