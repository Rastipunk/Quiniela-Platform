import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";
  const localePath = locale === "es" ? "" : `/${locale}`;
  const url = `${baseUrl}${localePath}/penca-futbol`;

  return {
    title: t("pencaFutbol.title"),
    description: t("pencaFutbol.description"),
    openGraph: {
      title: t("pencaFutbol.title"),
      description: t("pencaFutbol.description"),
      url,
      type: "article",
    },
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/penca-futbol`,
        pt: `${baseUrl}/pt/penca-futbol`,
      },
    },
  };
}

const articleStyle = {
  paragraph: {
    color: "var(--text)",
    lineHeight: 1.85,
    fontSize: "1.05rem",
    marginBottom: 24,
  } as const,
  highlight: {
    color: "var(--text)",
    fontWeight: 600 as const,
  },
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

export default async function PencaFutbolPage() {
  const locale = await getLocale();
  if (locale !== "es" && locale !== "pt") notFound();

  const t = await getTranslations("penca");

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t("heroTitle"),
    description:
      locale === "pt"
        ? "Tudo sobre pencas de futebol: historia, tradicao e como montar sua penca online gratis com amigos no Picks4All."
        : "Todo sobre las pencas de futbol en Uruguay: historia, tradicion y como armar tu penca online gratis con amigos en Picks4All.",
    inLanguage: locale,
    datePublished: "2026-02-13",
    dateModified: "2026-02-22",
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
      "@id": "https://picks4all.com/penca-futbol",
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbHome"), url: "https://picks4all.com" },
          {
            name: t("breadcrumbPenca"),
            url: "https://picks4all.com/penca-futbol",
          },
        ]}
      />
      <JsonLd data={articleJsonLd} />
      <PublicPageWrapper>
        <div style={{ background: "var(--bg)" }}>
          {/* Hero Header */}
          <section
            className="seo-hero"
            style={{
              background:
                "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
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
              {t("heroLabel")}
            </p>
            <h1
              className="seo-h1"
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
              {t("heroTitle")}
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
              {t("heroSubtitle")}
            </p>
          </section>

          {/* Article Body */}
          <article
            className="seo-article"
            style={{
              padding: "64px 40px",
              maxWidth: 780,
              margin: "0 auto",
            }}
          >
            {/* Section: What is a penca */}
            <h2
              className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              {t("section1Title")}
            </h2>

            <p
              style={articleStyle.paragraph}
              dangerouslySetInnerHTML={{ __html: t("section1P1") }}
            />

            <p
              style={articleStyle.paragraph}
              dangerouslySetInnerHTML={{ __html: t("section1P2") }}
            />

            <p
              style={articleStyle.paragraph}
              dangerouslySetInnerHTML={{ __html: t("section1P3") }}
            />

            <p
              style={articleStyle.paragraph}
              dangerouslySetInnerHTML={{ __html: t("section1P4") }}
            />

            {/* Section: How it works in Picks4All */}
            <h2
              className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                marginTop: 48,
                color: "var(--text)",
              }}
            >
              {t("section2Title")}
            </h2>

            <p
              style={articleStyle.paragraph}
              dangerouslySetInnerHTML={{ __html: t("section2Intro") }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
                marginBottom: 32,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: 4,
                      fontSize: "1.05rem",
                    }}
                  >
                    {t("step1Title")}
                  </p>
                  <p
                    style={{
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {t("step1Desc")}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: 4,
                      fontSize: "1.05rem",
                    }}
                  >
                    {t("step2Title")}
                  </p>
                  <p
                    style={{
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {t("step2Desc")}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: 4,
                      fontSize: "1.05rem",
                    }}
                  >
                    {t("step3Title")}
                  </p>
                  <p
                    style={{
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {t("step3Desc")}
                  </p>
                </div>
              </div>
            </div>

            <p
              style={articleStyle.paragraph}
              dangerouslySetInnerHTML={{ __html: t("stepsOutro") }}
            />

            {/* Section: Why Picks4All */}
            <h2
              className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                marginTop: 48,
                color: "var(--text)",
              }}
            >
              {t("section3Title")}
            </h2>

            <p style={articleStyle.paragraph}>
              {t("section3P1")}
            </p>

            <p
              style={articleStyle.paragraph}
              dangerouslySetInnerHTML={{ __html: t("section3P2") }}
            />

            <p
              style={articleStyle.paragraph}
              dangerouslySetInnerHTML={{ __html: t("section3P3") }}
            />

            {/* Pull Quote */}
            <div style={articleStyle.pullQuote}>
              {t("pullQuote")}
            </div>

            <p
              style={articleStyle.paragraph}
              dangerouslySetInnerHTML={{ __html: t("closingP1") }}
            />

            <p
              style={articleStyle.paragraph}
              dangerouslySetInnerHTML={{ __html: t("closingP2") }}
            />

            {/* Internal Links */}
            <div
              style={{
                marginTop: 48,
                padding: 24,
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 12,
                  fontSize: "1rem",
                }}
              >
                {t("relatedTitle")}
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <li>
                  <Link
                    href="/que-es-una-quiniela"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {t("relatedQuiniela")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/como-funciona"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {t("relatedHowItWorks")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/faq"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {t("relatedFaq")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/polla-futbolera"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {t("relatedPolla")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/prode-deportivo"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {t("relatedProde")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/porra-deportiva"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {t("relatedPorra")}
                  </Link>
                </li>
              </ul>
            </div>
          </article>

          {/* CTA */}
          <section
            className="seo-cta"
            style={{
              background:
                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
              {t("ctaTitle")}
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
              {t("ctaSubtitle")}
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                color: "rgba(255,255,255,0.7)",
                marginBottom: 32,
              }}
            >
              {t("ctaHint")}
            </p>
            <RegisterButton />
          </section>
        </div>
      </PublicPageWrapper>
    </>
  );
}
