import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";
import { colors } from "@/lib/theme";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

const PUBLISHED_AT = "2026-04-04T00:00:00Z";
const MODIFIED_AT = "2026-04-16T00:00:00Z";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("worldCupHowTo.title"),
    description: t("worldCupHowTo.description"),
    path: {
      es: "/mundial-2026/como-hacer-quiniela",
      en: "/world-cup-2026/how-to-create-pool",
      pt: "/copa-do-mundo-2026/como-criar-bolao",
    },
    type: "article",
    article: { publishedTime: PUBLISHED_AT, modifiedTime: MODIFIED_AT },
  });
}

interface HowToMessages {
  breadcrumbs: { home: string; worldCup: string; howTo: string };
  hero: { title: string; subtitle: string };
  intro: { p1: string; p2: string };
  process: {
    title: string;
    registration: { title: string; text: string };
    tournament: { title: string; text: string };
    scoring: { title: string; text: string };
    invite: { title: string; text: string };
  };
  during: { title: string; p1: string; p2: string; p3: string };
  scoring: {
    title: string;
    intro: string;
    basic: { name: string; description: string };
    cumulative: { name: string; description: string };
    advanced: { name: string; description: string };
    custom: { name: string; description: string };
  };
  tips: { title: string; p1: string; p2: string; p3: string; p4: string };
  cta: { text: string; button: string };
  jsonLd: {
    name: string;
    description: string;
    steps: { name: string; text: string }[];
    tool: string;
  };
}

export default async function ComoHacerQuinielaPage() {
  const locale = await getLocale();
  const msg: HowToMessages = (
    await import(`@/messages/${locale}/worldCup.json`)
  ).default.howTo;

  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;
  const pathMap: Record<string, string> = {
    es: "/mundial-2026/como-hacer-quiniela",
    en: "/world-cup-2026/how-to-create-pool",
    pt: "/copa-do-mundo-2026/como-criar-bolao",
  };
  const wcPathMap: Record<string, string> = {
    es: "/mundial-2026",
    en: "/world-cup-2026",
    pt: "/copa-do-mundo-2026",
  };
  const pagePath = pathMap[locale] || pathMap.es;
  const wcPath = wcPathMap[locale] || wcPathMap.es;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: msg.breadcrumbs.home, url: `${baseUrl}${localePath}` },
          {
            name: msg.breadcrumbs.worldCup,
            url: `${baseUrl}${localePath}${wcPath}`,
          },
          {
            name: msg.breadcrumbs.howTo,
            url: `${baseUrl}${localePath}${pagePath}`,
          },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: msg.jsonLd.name,
          description: msg.jsonLd.description,
          step: msg.jsonLd.steps.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
          tool: {
            "@type": "HowToTool",
            name: msg.jsonLd.tool,
          },
        }}
      />
      <PublicPageWrapper>
        <div style={{ background: "var(--bg)" }}>
          {/* Hero */}
          <section
            className="seo-hero"
            style={{
              background:
                "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
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
              {msg.hero.title}
            </h1>
            <p
              style={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.8)",
                maxWidth: 600,
                margin: "0 auto",
              }}
            >
              {msg.hero.subtitle}
            </p>
          </section>

          {/* Intro — narrative opening */}
          <section
            className="seo-section"
            style={{
              padding: "60px 40px",
              maxWidth: 780,
              margin: "0 auto",
            }}
          >
            <p
              style={{
                fontSize: "1.1rem",
                lineHeight: 1.8,
                color: "var(--text)",
                marginBottom: 20,
              }}
            >
              {msg.intro.p1}
            </p>
            <p
              style={{
                fontSize: "1.05rem",
                lineHeight: 1.8,
                color: "var(--muted)",
              }}
            >
              {msg.intro.p2}
            </p>
          </section>

          {/* The process — flowing narrative with left-border accent */}
          <section
            className="seo-section"
            style={{
              background: "var(--surface)",
              padding: "60px 40px",
            }}
          >
            <div style={{ maxWidth: 780, margin: "0 auto" }}>
              <h2
                className="seo-h2"
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  marginBottom: 40,
                  color: "var(--text)",
                }}
              >
                {msg.process.title}
              </h2>

              {[
                msg.process.registration,
                msg.process.tournament,
                msg.process.scoring,
                msg.process.invite,
              ].map((step, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: `3px solid ${i === 0 ? colors.brand : i === 1 ? colors.successAlt : i === 2 ? colors.warning : colors.brand}`,
                    paddingLeft: 24,
                    marginBottom: i < 3 ? 36 : 0,
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: 6,
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      color: "var(--muted)",
                      lineHeight: 1.7,
                      margin: 0,
                      fontSize: "1rem",
                    }}
                  >
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* During the tournament */}
          <section
            className="seo-section"
            style={{
              padding: "60px 40px",
              maxWidth: 780,
              margin: "0 auto",
            }}
          >
            <h2
              className="seo-h2"
              style={{
                fontSize: "1.8rem",
                fontWeight: 700,
                marginBottom: 24,
                color: "var(--text)",
              }}
            >
              {msg.during.title}
            </h2>
            <p
              style={{
                fontSize: "1.05rem",
                lineHeight: 1.8,
                color: "var(--text)",
                marginBottom: 16,
              }}
            >
              {msg.during.p1}
            </p>
            <p
              style={{
                fontSize: "1rem",
                lineHeight: 1.8,
                color: "var(--muted)",
                marginBottom: 16,
              }}
            >
              {msg.during.p2}
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                lineHeight: 1.8,
                color: "var(--muted)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "16px 20px",
              }}
            >
              {msg.during.p3}
            </p>
          </section>

          {/* Scoring systems — each gets a distinct visual treatment */}
          <section
            className="seo-section"
            style={{
              background: "var(--surface)",
              padding: "60px 40px",
            }}
          >
            <div style={{ maxWidth: 780, margin: "0 auto" }}>
              <h2
                className="seo-h2"
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  marginBottom: 12,
                  color: "var(--text)",
                }}
              >
                {msg.scoring.title}
              </h2>
              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.7,
                  marginBottom: 32,
                  fontSize: "1rem",
                }}
              >
                {msg.scoring.intro}
              </p>

              {/* Basic — clean box */}
              <div
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "24px 28px",
                  marginBottom: 20,
                }}
              >
                <h3
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  {msg.scoring.basic.name}
                </h3>
                <p
                  style={{
                    color: "var(--muted)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {msg.scoring.basic.description}
                </p>
              </div>

              {/* Cumulative — slightly different styling */}
              <div
                style={{
                  background: "var(--bg)",
                  borderLeft: `4px solid ${colors.successAlt}`,
                  borderRadius: 4,
                  padding: "24px 28px",
                  marginBottom: 20,
                }}
              >
                <h3
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  {msg.scoring.cumulative.name}
                </h3>
                <p
                  style={{
                    color: "var(--muted)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {msg.scoring.cumulative.description}
                </p>
              </div>

              {/* Advanced — highlighted with gradient border top */}
              <div
                style={{
                  background: "var(--bg)",
                  borderTop: `3px solid transparent`,
                  borderImage: `${colors.brandGradient} 1`,
                  borderRadius: 0,
                  padding: "24px 28px",
                  marginBottom: 20,
                }}
              >
                <h3
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  {msg.scoring.advanced.name}
                </h3>
                <p
                  style={{
                    color: "var(--muted)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {msg.scoring.advanced.description}
                </p>
              </div>

              {/* Custom — dashed border */}
              <div
                style={{
                  background: "var(--bg)",
                  border: "2px dashed var(--border)",
                  borderRadius: 12,
                  padding: "24px 28px",
                }}
              >
                <h3
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  {msg.scoring.custom.name}
                </h3>
                <p
                  style={{
                    color: "var(--muted)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {msg.scoring.custom.description}
                </p>
              </div>
            </div>
          </section>

          {/* Tips — natural paragraphs, not bullet points */}
          <section
            className="seo-section"
            style={{
              padding: "60px 40px",
              maxWidth: 780,
              margin: "0 auto",
            }}
          >
            <h2
              className="seo-h2"
              style={{
                fontSize: "1.8rem",
                fontWeight: 700,
                marginBottom: 24,
                color: "var(--text)",
              }}
            >
              {msg.tips.title}
            </h2>
            <p
              style={{
                fontSize: "1.05rem",
                lineHeight: 1.8,
                color: "var(--text)",
                marginBottom: 20,
              }}
            >
              {msg.tips.p1}
            </p>
            <p
              style={{
                fontSize: "1rem",
                lineHeight: 1.8,
                color: "var(--muted)",
                marginBottom: 20,
              }}
            >
              {msg.tips.p2}
            </p>
            <p
              style={{
                fontSize: "1rem",
                lineHeight: 1.8,
                color: "var(--muted)",
                marginBottom: 20,
              }}
            >
              {msg.tips.p3}
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                lineHeight: 1.8,
                color: "var(--muted)",
                fontStyle: "italic",
              }}
            >
              {msg.tips.p4}
            </p>
          </section>

          {/* CTA — understated, not a giant banner */}
          <section
            style={{
              background: colors.brandGradient,
              color: "white",
              padding: "48px 40px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.9)",
                maxWidth: 600,
                margin: "0 auto 24px",
                lineHeight: 1.7,
              }}
            >
              {msg.cta.text}
            </p>
            <RegisterButton label={msg.cta.button} />
          </section>
        </div>
      </PublicPageWrapper>
    </>
  );
}
