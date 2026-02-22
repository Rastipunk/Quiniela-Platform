import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";

  const pathMap: Record<string, string> = {
    es: "/que-es-una-quiniela",
    en: "/what-is-a-pool",
    pt: "/o-que-e-uma-penca",
  };
  const localePath = locale === "es" ? "" : `/${locale}`;
  const pagePath = pathMap[locale] || pathMap.es;
  const url = `${baseUrl}${localePath}${pagePath}`;

  return {
    title: t("whatIsQuiniela.title"),
    description: t("whatIsQuiniela.description"),
    openGraph: {
      title: t("whatIsQuiniela.title"),
      description: t("whatIsQuiniela.description"),
      url,
      type: "article",
    },
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/que-es-una-quiniela`,
        en: `${baseUrl}/en/what-is-a-pool`,
        pt: `${baseUrl}/pt/o-que-e-uma-penca`,
      },
    },
  };
}

interface CountryRow {
  country: string;
  flag: string;
  term: string;
  origin: string;
}

interface RegionalSection {
  emoji: string;
  title: string;
  paragraphs: string[];
}

interface RelatedLink {
  href: string;
  flag: string;
  label: string;
  region: string;
}

interface WhatIsQuinielaMessages {
  breadcrumbs: { home: string; title: string };
  hero: { badge: string; title: string; subtitle: string };
  intro: { paragraphs: string[]; pullQuote: string };
  origins: { title: string; paragraphs: string[] };
  regionalMap: { title: string; intro: string };
  regionalSections: RegionalSection[];
  countryTable: {
    title: string;
    subtitle: string;
    columns: { country: string; term: string; origin: string };
    rows: CountryRow[];
  };
  digitalEvolution: { title: string; paragraphs: string[]; pullQuote: string };
  whyPopular: { title: string; paragraphs: string[] };
  relatedLinks: { title: string; links: RelatedLink[] };
  cta: { title: string; description: string; subdescription: string; button: string };
  jsonLd: {
    definedTermSet: { name: string; description: string; termDescriptionTemplate: string };
    article: { headline: string; description: string; inLanguage: string };
  };
}

const articleStyle = {
  paragraph: {
    color: "var(--text)",
    lineHeight: 1.85,
    fontSize: "1.05rem",
    marginBottom: 24,
  } as const,
  pullQuote: {
    borderLeft: "4px solid #667eea",
    paddingLeft: 24,
    margin: "32px 0",
    fontStyle: "italic" as const,
    color: "var(--muted)",
    fontSize: "1.15rem",
    lineHeight: 1.7,
  },
};

export default async function QueEsUnaQuinielaPage() {
  const locale = await getLocale();
  const msg: WhatIsQuinielaMessages = (await import(`@/messages/${locale}/whatIsQuiniela.json`)).default;

  const definedTermSetJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: msg.jsonLd.definedTermSet.name,
    description: msg.jsonLd.definedTermSet.description,
    hasDefinedTerm: msg.countryTable.rows.map((item) => ({
      "@type": "DefinedTerm",
      name: item.term,
      description: msg.jsonLd.definedTermSet.termDescriptionTemplate.replace("{country}", item.country),
      inDefinedTermSet: msg.jsonLd.definedTermSet.name,
    })),
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: msg.jsonLd.article.headline,
    description: msg.jsonLd.article.description,
    inLanguage: msg.jsonLd.article.inLanguage,
    datePublished: "2026-02-12",
    dateModified: "2026-02-13",
    image: "https://picks4all.com/opengraph-image",
    author: {
      "@type": "Organization",
      name: "Picks4All",
      url: "https://picks4all.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Picks4All",
      url: "https://picks4all.com",
      logo: {
        "@type": "ImageObject",
        url: "https://picks4all.com/opengraph-image",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://picks4all.com/que-es-una-quiniela",
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: msg.breadcrumbs.home, url: "https://picks4all.com" },
          { name: msg.breadcrumbs.title, url: "https://picks4all.com/que-es-una-quiniela" },
        ]}
      />
      <JsonLd data={definedTermSetJsonLd} />
      <JsonLd data={articleJsonLd} />
      <PublicPageWrapper>
      <div style={{ background: "var(--bg)" }}>
        {/* Article Header */}
        <section className="seo-hero"
          style={{
            background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
            color: "white",
            padding: "80px 40px 60px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "0.85rem",
              textTransform: "uppercase",
              letterSpacing: "2px",
              color: "rgba(255,255,255,0.5)",
              marginBottom: 16,
            }}
          >
            {msg.hero.badge}
          </p>
          <h1 className="seo-h1"
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              marginBottom: 16,
              lineHeight: 1.2,
              maxWidth: 700,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {msg.hero.title}
          </h1>
          <p
            style={{
              fontSize: "1.15rem",
              color: "rgba(255,255,255,0.75)",
              maxWidth: 650,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            {msg.hero.subtitle}
          </p>
        </section>

        {/* Article Body */}
        <article
          style={{
            padding: "64px 40px",
            maxWidth: 780,
            margin: "0 auto",
          }}
        >
          {/* Intro */}
          {msg.intro.paragraphs.map((p, i) => (
            <p key={i} style={articleStyle.paragraph} dangerouslySetInnerHTML={{ __html: p }} />
          ))}

          <div style={articleStyle.pullQuote}>
            {msg.intro.pullQuote}
          </div>

          {/* Origins */}
          <h2 className="seo-h2"
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: 20,
              marginTop: 48,
              color: "var(--text)",
            }}
          >
            {msg.origins.title}
          </h2>

          {msg.origins.paragraphs.map((p, i) => (
            <p key={i} style={articleStyle.paragraph} dangerouslySetInnerHTML={{ __html: p }} />
          ))}

          {/* Regional Deep Dive */}
          <h2 className="seo-h2"
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: 20,
              marginTop: 48,
              color: "var(--text)",
            }}
          >
            {msg.regionalMap.title}
          </h2>

          <p style={articleStyle.paragraph}>
            {msg.regionalMap.intro}
          </p>

          {msg.regionalSections.map((section, idx) => (
            <div key={idx}>
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#667eea",
                  marginBottom: 8,
                  marginTop: 32,
                }}
              >
                {section.emoji} {section.title}
              </h3>
              {section.paragraphs.map((p, i) => (
                <p key={i} style={articleStyle.paragraph} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </div>
          ))}
        </article>

        {/* Country Table */}
        <section className="seo-section"
          style={{
            background: "var(--surface)",
            padding: "64px 40px",
          }}
        >
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <h2 className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 12,
                color: "var(--text)",
                textAlign: "center",
              }}
            >
              {msg.countryTable.title}
            </h2>
            <p
              style={{
                textAlign: "center",
                color: "var(--muted)",
                marginBottom: 32,
                maxWidth: 550,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {msg.countryTable.subtitle}
            </p>

            <div
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "1rem",
                }}
              >
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <th
                      style={{
                        padding: "14px 20px",
                        textAlign: "left",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {msg.countryTable.columns.country}
                    </th>
                    <th
                      style={{
                        padding: "14px 20px",
                        textAlign: "left",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {msg.countryTable.columns.term}
                    </th>
                    <th
                      style={{
                        padding: "14px 20px",
                        textAlign: "left",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {msg.countryTable.columns.origin}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {msg.countryTable.rows.map((item, index) => (
                    <tr key={item.country}>
                      <td
                        style={{
                          padding: "12px 20px",
                          borderBottom:
                            index < msg.countryTable.rows.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                        }}
                      >
                        <span style={{ marginRight: 8 }}>{item.flag}</span>
                        {item.country}
                      </td>
                      <td
                        style={{
                          padding: "12px 20px",
                          borderBottom:
                            index < msg.countryTable.rows.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                          fontWeight: 600,
                          color: "#667eea",
                        }}
                      >
                        {item.term}
                      </td>
                      <td
                        style={{
                          padding: "12px 20px",
                          borderBottom:
                            index < msg.countryTable.rows.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                          color: "var(--muted)",
                          fontSize: "0.9rem",
                        }}
                      >
                        {item.origin}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Digital Evolution */}
        <article
          style={{
            padding: "64px 40px",
            maxWidth: 780,
            margin: "0 auto",
          }}
        >
          <h2 className="seo-h2"
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: 20,
              color: "var(--text)",
            }}
          >
            {msg.digitalEvolution.title}
          </h2>

          {msg.digitalEvolution.paragraphs.map((p, i) => (
            <p key={i} style={articleStyle.paragraph} dangerouslySetInnerHTML={{ __html: p }} />
          ))}

          <div style={articleStyle.pullQuote}>
            {msg.digitalEvolution.pullQuote}
          </div>

          <h2 className="seo-h2"
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: 20,
              marginTop: 48,
              color: "var(--text)",
            }}
          >
            {msg.whyPopular.title}
          </h2>

          {msg.whyPopular.paragraphs.map((p, i) => (
            <p key={i} style={articleStyle.paragraph} dangerouslySetInnerHTML={{ __html: p }} />
          ))}
        </article>

        {/* Regional links */}
        <section className="seo-section"
          style={{
            padding: "48px 40px",
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          <h2 className="seo-h2"
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: 24,
              color: "var(--text)",
              textAlign: "center",
            }}
          >
            {msg.relatedLinks.title}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 16,
            }}
          >
            {msg.relatedLinks.links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 20px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  textDecoration: "none",
                  transition: "border-color 0.2s",
                }}
              >
                <span style={{ fontSize: "1.5rem" }}>{item.flag}</span>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.95rem" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {item.region}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="seo-cta"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "80px 40px",
            textAlign: "center",
          }}
        >
          <h2 className="seo-h2"
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            {msg.cta.title}
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.9)",
              marginBottom: 12,
              maxWidth: 550,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {msg.cta.description}
          </p>
          <p
            style={{
              fontSize: "0.95rem",
              color: "rgba(255,255,255,0.7)",
              marginBottom: 32,
            }}
          >
            {msg.cta.subdescription}
          </p>
          <RegisterButton label={msg.cta.button} />
        </section>
      </div>

      </PublicPageWrapper>
    </>
  );
}
