import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { FAQAccordion } from "@/components/FAQAccordion";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";
import { colors } from "@/lib/theme";
import { DEFAULT_REGION, getPoolTermParams } from "@/lib/poolTerms";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("faq.title"),
    description: t("faq.description"),
    path: "/faq",
  });
}

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface FAQMessages {
  hero: { title: string; subtitle: string };
  contact: { title: string; description: string; button: string };
  cta: { title: string; description: string; button: string };
  breadcrumbs: { home: string; faq: string };
  categories: string[];
  items: FAQItem[];
}

/** Replace ICU-style {key} placeholders with values from params */
function interpolate(text: string, params: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}

// Single canonical support mailbox shown across all locales. EN/PT
// variants (`support@`, `suporte@`) remain configured as Cloudflare
// aliases that forward to the same inbox, so any old reference still
// delivers — but the website always shows the Spanish address.
const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || "picks4all.com";
const SUPPORT_EMAIL = `soporte@${EMAIL_DOMAIN}`;

export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  // IMPORTANT: messages/{locale}/faq.json is loaded via dynamic import (not registered
  // in i18n/request.ts) because it contains structured arrays (items[]) that benefit
  // from typed loading. DO NOT DELETE these files — see commit 27db35b for the
  // regression that occurred when they were removed.
  const rawFaqMessages: FAQMessages = (await import(`@/messages/${locale}/faq.json`)).default;
  const supportEmail = SUPPORT_EMAIL;
  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;

  // Build interpolation params with the default region. The visitor's
  // actual region is applied client-side via PoolTermProvider; this SSR
  // copy uses the canonical wording so the page renders identically for
  // every visitor and Next.js can serve it as a static, cacheable HTML
  // (avoiding the `Cache-Control: no-store` that previously kept Search
  // Console from indexing this URL).
  const pp = getPoolTermParams(locale, DEFAULT_REGION);

  // Interpolate pool term placeholders
  const faqMessages: FAQMessages = {
    ...rawFaqMessages,
    hero: {
      title: rawFaqMessages.hero.title,
      subtitle: interpolate(rawFaqMessages.hero.subtitle, pp),
    },
    cta: {
      title: interpolate(rawFaqMessages.cta.title, pp),
      description: interpolate(rawFaqMessages.cta.description, pp),
      button: rawFaqMessages.cta.button,
    },
    items: rawFaqMessages.items.map((item) => ({
      ...item,
      question: interpolate(item.question, pp),
      answer: interpolate(item.answer, pp),
    })),
  };

  const { hero, contact, cta, breadcrumbs, items } = faqMessages;

  // Build JSON-LD FAQPage schema from the data
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: breadcrumbs.home, url: `${baseUrl}${localePath}` },
          { name: breadcrumbs.faq, url: `${baseUrl}${localePath}/faq` },
        ]}
      />
      <JsonLd data={faqJsonLd} />
      <PublicPageWrapper>
      <div style={{ background: "var(--bg)" }}>
        {/* Header */}
        <section
          className="seo-hero"
          style={{
            background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
            color: "white",
            padding: "60px 40px",
            textAlign: "center",
          }}
        >
          <h1
            className="seo-h1"
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            {hero.title}
          </h1>
          <p
            style={{
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.8)",
              maxWidth: 600,
              margin: "0 auto",
            }}
          >
            {hero.subtitle}
          </p>
        </section>

        {/* FAQ Accordion (client component for interactivity) */}
        <FAQAccordion faqData={items} />

        {/* Contact Section */}
        <section
          className="seo-section"
          style={{
            background: "var(--surface)",
            padding: "80px 40px",
            textAlign: "center",
          }}
        >
          <h2
            className="seo-h2"
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 16,
              color: "var(--text)",
            }}
          >
            {contact.title}
          </h2>
          <p
            style={{
              color: "var(--muted)",
              marginBottom: 24,
              maxWidth: 500,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {contact.description}
          </p>
          <a
            href={`mailto:${supportEmail}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: colors.brandGradient,
              color: "white",
              padding: "16px 32px",
              borderRadius: 8,
              fontSize: "1.1rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {contact.button}
          </a>
        </section>

        {/* CTA */}
        <section
          className="seo-cta"
          style={{
            background: colors.brandGradient,
            color: "white",
            padding: "80px 40px",
            textAlign: "center",
          }}
        >
          <h2
            className="seo-h2"
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            {cta.title}
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.9)",
              marginBottom: 32,
            }}
          >
            {cta.description}
          </p>
          <RegisterButton label={cta.button} />
        </section>
      </div>

      </PublicPageWrapper>
    </>
  );
}
