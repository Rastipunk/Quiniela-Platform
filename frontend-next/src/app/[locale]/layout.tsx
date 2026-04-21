import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Script from "next/script";
import { routing } from "@/i18n/routing";
import { JsonLd } from "@/components/JsonLd";
import { CookieConsent } from "@/components/CookieConsent";
import { AuthAnalyticsSync } from "@/components/AuthAnalyticsSync";
import { MetaPixelPageView } from "@/components/MetaPixelPageView";
import { AttributionCapture } from "@/components/AttributionCapture";
import { PoolTermProvider } from "@/contexts/PoolTermContext";
import { POOL_REGION_COOKIE, DEFAULT_REGION, isValidRegion } from "@/lib/poolTerms";
import type { PoolRegion } from "@/lib/poolTerms";
import { SITE_URL } from "@/lib/siteConfig";
import {
  getConsentDefaultsScript,
  getGtmLoaderScript,
  getGtmNoScriptSrc,
  isGtmEnabled,
} from "@/lib/gtm";
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
  const baseUrl = SITE_URL;
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
      "polla",
      "prode",
      "penca",
      "football predictions",
      "predictions with friends",
      "free",
      "World Cup 2026",
      "Mundial 2026",
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
      "facebook-domain-verification": "wp2mljgv4bqt6wl8mwngdzre7sumje",
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

  // Read pool region from cookie (set by middleware via CF-IPCountry)
  const cookieStore = await cookies();
  const regionCookie = cookieStore.get(POOL_REGION_COOKIE)?.value;
  const region: PoolRegion =
    regionCookie && isValidRegion(regionCookie) ? regionCookie : DEFAULT_REGION;

  const gtmEnabled = isGtmEnabled();

  return (
    <html lang={locale} style={{ colorScheme: "light only" } as React.CSSProperties}>
      <head>
        <link rel="preconnect" href="https://accounts.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://media.api-sports.io" />
        <link rel="dns-prefetch" href="https://flagcdn.com" />
        <link rel="dns-prefetch" href="https://connect.facebook.net" />
        {/*
          Google Tag Manager — inlined in <head> so browser executes in
          document order: Consent Mode v2 defaults populate dataLayer first,
          then gtm.js is fetched and evaluates with those defaults already
          present. Using `next/script` here is unreliable because
          `beforeInteractive` only works in the literal root layout.
        */}
        {gtmEnabled && (
          <>
            <script
              id="gtm-consent-defaults"
              dangerouslySetInnerHTML={{ __html: getConsentDefaultsScript() }}
            />
            <script id="gtm-loader" dangerouslySetInnerHTML={{ __html: getGtmLoaderScript() }} />
          </>
        )}
      </head>
      <body style={{ backgroundColor: "#f4f5f7", color: "#111827" }}>
        {/* GTM <noscript> fallback — per Google's install docs, placed
            immediately after <body> opens so it is discoverable without JS. */}
        {gtmEnabled && (
          <noscript>
            <iframe
              src={getGtmNoScriptSrc()}
              title="Google Tag Manager"
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        <NextIntlClientProvider messages={messages}>
          <PoolTermProvider region={region} locale={locale}>
            <JsonLd
              data={{
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "Picks4All",
                url: SITE_URL,
                logo: `${SITE_URL}/opengraph-image`,
                inLanguage: locale,
                description: t("orgDescription"),
              }}
            />
            {children}
            <CookieConsent />
            <MetaPixelPageView />
            <AttributionCapture />
            <AuthAnalyticsSync />
          </PoolTermProvider>
        </NextIntlClientProvider>
        {/* Google Identity Services — loads after hydration so button is ready when AuthSlidePanel opens */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
