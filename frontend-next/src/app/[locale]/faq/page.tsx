import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { FAQAccordion } from "@/components/FAQAccordion";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";

  const localePath = locale === "es" ? "" : `/${locale}`;
  const url = `${baseUrl}${localePath}/faq`;

  return {
    title: t("faq.title"),
    description: t("faq.description"),
    openGraph: {
      title: t("faq.title"),
      description: t("faq.description"),
      url,
      type: "website",
    },
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/faq`,
        en: `${baseUrl}/en/faq`,
        pt: `${baseUrl}/pt/faq`,
        "x-default": `${baseUrl}/faq`,
      },
    },
  };
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

export default async function FAQPage() {
  const locale = await getLocale();
  const faqMessages: FAQMessages = (await import(`@/messages/${locale}/faq.json`)).default;
  const baseUrl = "https://picks4all.com";
  const localePath = locale === "es" ? "" : `/${locale}`;

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
            href="mailto:soporte@picks4all.com"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
