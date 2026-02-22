"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { RegisterButton } from "@/components/RegisterButton";

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

interface RegionalArticlePageProps {
  namespace: string;
  relatedLinks: { key: string; href: string }[];
}

export function RegionalArticlePage({ namespace, relatedLinks }: RegionalArticlePageProps) {
  const t = useTranslations(namespace);

  return (
    <PublicPageWrapper>
      <div style={{ background: "var(--bg)" }}>
        {/* Hero Header */}
        <section
          className="seo-hero"
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
          {/* Section 1 */}
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

          {/* Section 2: How it works */}
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

          {/* Steps */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              marginBottom: 32,
            }}
          >
            {[1, 2, 3].map((n) => (
              <div
                key={n}
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
                  {n}
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
                    {t(`step${n}Title`)}
                  </p>
                  <p
                    style={{
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {t(`step${n}Desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p
            style={articleStyle.paragraph}
            dangerouslySetInnerHTML={{ __html: t("stepsOutro") }}
          />

          {/* Section 3: Why Picks4All */}
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

          <p style={articleStyle.paragraph}>{t("section3P1")}</p>
          <p
            style={articleStyle.paragraph}
            dangerouslySetInnerHTML={{ __html: t("section3P2") }}
          />
          <p
            style={articleStyle.paragraph}
            dangerouslySetInnerHTML={{ __html: t("section3P3") }}
          />

          {/* Pull Quote */}
          <div style={articleStyle.pullQuote}>{t("pullQuote")}</div>

          <p
            style={articleStyle.paragraph}
            dangerouslySetInnerHTML={{ __html: t("closingP1") }}
          />
          <p
            style={articleStyle.paragraph}
            dangerouslySetInnerHTML={{ __html: t("closingP2") }}
          />

          {/* Related Links */}
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
              {relatedLinks.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                      fontWeight: 500,
                    }}
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </article>

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
  );
}
