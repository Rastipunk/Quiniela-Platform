import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
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
    title: t("howItWorks.title"),
    description: t("howItWorks.description"),
    path: { es: "/como-funciona", en: "/how-it-works", pt: "/como-funciona" },
  });
}

/** Replace ICU-style {key} placeholders with values from params */
function interpolate(text: string, params: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}

interface StepData {
  number: number;
  title: string;
  description: string;
}

interface HowItWorksMessages {
  breadcrumbs: { home: string; howItWorks: string };
  hero: { title: string; subtitle: string };
  jsonLd: {
    name: string;
    description: string;
    steps: { name: string; text: string }[];
    tool: string;
  };
  hostSection: {
    title: string;
    steps: StepData[];
  };
  playerSection: {
    title: string;
    steps: StepData[];
  };
  scoringSection: {
    title: string;
    subtitle: string;
    columns: { type: string; points: string };
    rows: { emoji: string; type: string; points: string }[];
    note: string;
  };
  cta: { title: string; description: string; button: string };
  howToPlayCta: string;
}

function StepItem({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "2px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1rem",
          fontWeight: 700,
          color: "var(--text)",
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div>
        <h3
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            marginBottom: 4,
            color: "var(--text)",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            color: "var(--muted)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

export default async function ComoFuncionaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  // IMPORTANT: messages/{locale}/howItWorks.json is loaded via dynamic import (not
  // registered in i18n/request.ts). DO NOT DELETE these files — see commit 27db35b
  // for the regression that occurred when they were removed.
  const rawMsg: HowItWorksMessages = (await import(`@/messages/${locale}/howItWorks.json`)).default;

  // SSR uses the canonical default region — the visitor's actual region
  // is applied client-side by PoolTermProvider after hydration. Reading
  // the cookie here would force this page to be dynamic and emit
  // `Cache-Control: no-store`, which Search Console penalises.
  const pp = getPoolTermParams(locale, DEFAULT_REGION);

  // Interpolate pool term placeholders into all message strings
  const msg: HowItWorksMessages = {
    breadcrumbs: rawMsg.breadcrumbs,
    hero: {
      title: rawMsg.hero.title,
      subtitle: interpolate(rawMsg.hero.subtitle, pp),
    },
    jsonLd: {
      name: interpolate(rawMsg.jsonLd.name, pp),
      description: interpolate(rawMsg.jsonLd.description, pp),
      steps: rawMsg.jsonLd.steps.map((s) => ({
        name: interpolate(s.name, pp),
        text: interpolate(s.text, pp),
      })),
      tool: interpolate(rawMsg.jsonLd.tool, pp),
    },
    hostSection: {
      title: interpolate(rawMsg.hostSection.title, pp),
      steps: rawMsg.hostSection.steps.map((s) => ({
        number: s.number,
        title: interpolate(s.title, pp),
        description: interpolate(s.description, pp),
      })),
    },
    playerSection: {
      title: rawMsg.playerSection.title,
      steps: rawMsg.playerSection.steps.map((s) => ({
        number: s.number,
        title: interpolate(s.title, pp),
        description: interpolate(s.description, pp),
      })),
    },
    scoringSection: {
      ...rawMsg.scoringSection,
      subtitle: interpolate(rawMsg.scoringSection.subtitle, pp),
    },
    cta: {
      title: interpolate(rawMsg.cta.title, pp),
      description: interpolate(rawMsg.cta.description, pp),
      button: rawMsg.cta.button,
    },
    howToPlayCta: rawMsg.howToPlayCta ?? "¿Cómo se juega?",
  };

  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;
  const pagePath = locale === "en" ? "/how-it-works" : "/como-funciona";

  return (
    <>
      <Breadcrumbs
        items={[
          { name: msg.breadcrumbs.home, url: `${baseUrl}${localePath}` },
          { name: msg.breadcrumbs.howItWorks, url: `${baseUrl}${localePath}${pagePath}` },
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

        {/* For Hosts */}
        <section
          className="seo-section"
          style={{
            padding: "80px 40px",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <h2
            className="seo-h2"
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 32,
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                background: colors.brandGradient,
                color: "white",
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              {"\uD83D\uDC51"}
            </span>
            {msg.hostSection.title}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {msg.hostSection.steps.map((step) => (
              <StepItem
                key={step.number}
                number={step.number}
                title={step.title}
                description={step.description}
              />
            ))}
          </div>
        </section>

        {/* For Players */}
        <section
          className="seo-section"
          style={{
            background: "var(--surface)",
            padding: "80px 40px",
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 32,
            }}>
              <h2
                className="seo-h2"
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--text)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "white",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.25rem",
                  }}
                >
                  {"\u26BD"}
                </span>
                {msg.playerSection.title}
              </h2>
              <Link
                href="/como-se-juega"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: colors.brandGradient,
                  color: "white",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  padding: "10px 18px",
                  borderRadius: 10,
                  textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: "1.1em" }}>{"\u26BD"}</span>
                {msg.howToPlayCta}
                <span>{"\u2192"}</span>
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {msg.playerSection.steps.map((step) => (
                <StepItem
                  key={step.number}
                  number={step.number}
                  title={step.title}
                  description={step.description}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Scoring System */}
        <section
          className="seo-section"
          style={{
            padding: "80px 40px",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <h2
            className="seo-h2"
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 16,
              color: "var(--text)",
              textAlign: "center",
            }}
          >
            {msg.scoringSection.title}
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "var(--muted)",
              marginBottom: 32,
              maxWidth: 600,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {msg.scoringSection.subtitle}
          </p>

          <div
            style={{
              background: "var(--surface)",
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
                      padding: "16px",
                      textAlign: "left",
                      fontWeight: 600,
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {msg.scoringSection.columns.type}
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      textAlign: "center",
                      fontWeight: 600,
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {msg.scoringSection.columns.points}
                  </th>
                </tr>
              </thead>
              <tbody>
                {msg.scoringSection.rows.map((row, i) => {
                  const isLast = i === msg.scoringSection.rows.length - 1;
                  return (
                    <tr key={i}>
                      <td style={{ padding: "16px", borderBottom: isLast ? undefined : "1px solid var(--border)" }}>
                        <span aria-hidden="true">{row.emoji}</span> {row.type}
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          fontWeight: 700,
                          borderBottom: isLast ? undefined : "1px solid var(--border)",
                          color: colors.successAlt,
                        }}
                      >
                        {row.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p
            style={{
              textAlign: "center",
              color: "var(--muted)",
              marginTop: 16,
              fontSize: "0.9rem",
            }}
          >
            {msg.scoringSection.note}
          </p>
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
            {msg.cta.title}
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.9)",
              marginBottom: 32,
            }}
          >
            {msg.cta.description}
          </p>
          <RegisterButton label={msg.cta.button} />
        </section>
      </div>

      </PublicPageWrapper>
    </>
  );
}
