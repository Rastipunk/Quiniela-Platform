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
import { SITE_URL, SITE_NAME, WORLD_CUP_FOCUS } from "@/lib/siteConfig";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
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

/**
 * Main navigation surfaced to Google as SiteNavigationElement schema.
 * These hints help Google understand the site structure and are one of
 * the inputs it uses when deciding whether to render sitelinks under
 * the home result in SERP.
 *
 * Keep this list in sync with the visible navbar/footer so the schema
 * is not flagged as misleading.
 */
function getNavItems(locale: string): Array<{ name: string; url: string }> {
  const prefix = locale === "es" ? "" : `/${locale}`;
  if (locale === "en") {
    return [
      { name: "Home", url: `${SITE_URL}${prefix}` },
      { name: "World Cup 2026", url: `${SITE_URL}${prefix}/world-cup-2026` },
      { name: "How it Works", url: `${SITE_URL}${prefix}/how-it-works` },
      { name: "Pricing", url: `${SITE_URL}${prefix}/pricing` },
      { name: "FAQ", url: `${SITE_URL}${prefix}/faq` },
      { name: "For Companies", url: `${SITE_URL}${prefix}/for-companies` },
    ];
  }
  if (locale === "pt") {
    return [
      { name: "Início", url: `${SITE_URL}${prefix}` },
      { name: "Copa do Mundo 2026", url: `${SITE_URL}${prefix}/copa-do-mundo-2026` },
      { name: "Como Funciona", url: `${SITE_URL}${prefix}/como-funciona` },
      { name: "Preços", url: `${SITE_URL}${prefix}/precos` },
      { name: "FAQ", url: `${SITE_URL}${prefix}/faq` },
      { name: "Para Empresas", url: `${SITE_URL}${prefix}/para-empresas` },
    ];
  }
  return [
    { name: "Inicio", url: `${SITE_URL}` },
    { name: "Mundial 2026", url: `${SITE_URL}/mundial-2026` },
    { name: "Cómo Funciona", url: `${SITE_URL}/como-funciona` },
    { name: "Precios", url: `${SITE_URL}/precios` },
    { name: "FAQ", url: `${SITE_URL}/faq` },
    { name: "Empresas", url: `${SITE_URL}/empresas` },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo.home" });
  const baseUrl = SITE_URL;
  const localeUrl = locale === "es" ? baseUrl : `${baseUrl}/${locale}`;
  // ES pivots to World Cup messaging during the WORLD_CUP_FOCUS window.
  // EN/PT keep their evergreen copy regardless.
  const useWorldCup = WORLD_CUP_FOCUS && locale === "es";
  const defaultTitle = useWorldCup ? t("titleWorldCup") : t("title");
  const defaultDescription = useWorldCup ? t("descriptionWorldCup") : t("description");

  // Bing Webmaster verification — populate NEXT_PUBLIC_BING_VERIFICATION
  // in Railway with the value Bing gives you. Empty string = no tag rendered.
  const bingVerification = process.env.NEXT_PUBLIC_BING_VERIFICATION ?? "";

  return {
    title: {
      default: defaultTitle,
      template: `%s | ${SITE_NAME}`,
    },
    description: defaultDescription,
    // The `keywords` meta tag has been ignored by Google since 2009 and is
    // not used by Bing either. Removed to keep <head> clean.
    openGraph: {
      type: "website",
      locale: OG_LOCALES[locale] || "es_LA",
      url: localeUrl,
      siteName: SITE_NAME,
      title: defaultTitle,
      description: defaultDescription,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: [DEFAULT_OG_IMAGE.url],
    },
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
      ...(bingVerification ? { "msvalidate.01": bingVerification } : {}),
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
                "@graph": [
                  {
                    "@type": "Organization",
                    "@id": `${SITE_URL}#organization`,
                    name: SITE_NAME,
                    url: SITE_URL,
                    logo: {
                      "@type": "ImageObject",
                      url: `${SITE_URL}/opengraph-image`,
                      width: 1200,
                      height: 630,
                    },
                    inLanguage: locale,
                    description: t("orgDescription"),
                  },
                  {
                    "@type": "WebSite",
                    "@id": `${SITE_URL}#website`,
                    url: SITE_URL,
                    name: SITE_NAME,
                    description: t("orgDescription"),
                    inLanguage: locale,
                    publisher: { "@id": `${SITE_URL}#organization` },
                  },
                  ...getNavItems(locale).map((item) => ({
                    "@type": "SiteNavigationElement",
                    name: item.name,
                    url: item.url,
                    inLanguage: locale,
                  })),
                ],
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
