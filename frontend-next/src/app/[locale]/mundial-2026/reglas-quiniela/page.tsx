import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";
import { colors } from "@/lib/theme";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

const PUBLISHED_AT = "2026-04-04T00:00:00Z";
const MODIFIED_AT = "2026-04-16T00:00:00Z";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("worldCupRules.title"),
    description: t("worldCupRules.description"),
    path: {
      es: "/mundial-2026/reglas-quiniela",
      en: "/world-cup-2026/pool-rules",
      pt: "/copa-do-mundo-2026/regras-bolao",
    },
    type: "article",
    article: { publishedTime: PUBLISHED_AT, modifiedTime: MODIFIED_AT },
  });
}

interface RulesMessages {
  breadcrumbs: { home: string; worldCup: string; rules: string };
  hero: { title: string; subtitle: string };
  whatIs: { title: string; p1: string; p2: string };
  scoring: {
    title: string;
    exact: { title: string; text: string };
    winner: { title: string; text: string };
    difference: { title: string; text: string };
    miss: { title: string; text: string };
  };
  multipliers: {
    title: string;
    intro: string;
    table: {
      phase: string;
      multiplier: string;
      groups: string;
      groupsMultiplier: string;
      r32: string;
      r32Multiplier: string;
      quarters: string;
      quartersMultiplier: string;
      semis: string;
      semisMultiplier: string;
      thirdPlace: string;
      thirdPlaceMultiplier: string;
      final: string;
      finalMultiplier: string;
    };
    example: string;
  };
  deadlines: { title: string; p1: string; p2: string; p3: string };
  results: { title: string; p1: string; p2: string };
  leaderboard: { title: string; p1: string; p2: string };
  cta: { text: string; button: string };
  jsonLd: { headline: string; description: string; author: string };
}

export default async function ReglasQuinielaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const msg: RulesMessages = (
    await import(`@/messages/${locale}/worldCup.json`)
  ).default.rules;

  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;
  const pathMap: Record<string, string> = {
    es: "/mundial-2026/reglas-quiniela",
    en: "/world-cup-2026/pool-rules",
    pt: "/copa-do-mundo-2026/regras-bolao",
  };
  const wcPathMap: Record<string, string> = {
    es: "/mundial-2026",
    en: "/world-cup-2026",
    pt: "/copa-do-mundo-2026",
  };
  const pagePath = pathMap[locale] || pathMap.es;
  const wcPath = wcPathMap[locale] || wcPathMap.es;

  const multiplierRows = [
    {
      phase: msg.multipliers.table.groups,
      mult: msg.multipliers.table.groupsMultiplier,
    },
    {
      phase: msg.multipliers.table.r32,
      mult: msg.multipliers.table.r32Multiplier,
    },
    {
      phase: msg.multipliers.table.quarters,
      mult: msg.multipliers.table.quartersMultiplier,
    },
    {
      phase: msg.multipliers.table.semis,
      mult: msg.multipliers.table.semisMultiplier,
    },
    {
      phase: msg.multipliers.table.thirdPlace,
      mult: msg.multipliers.table.thirdPlaceMultiplier,
    },
    {
      phase: msg.multipliers.table.final,
      mult: msg.multipliers.table.finalMultiplier,
    },
  ];

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
            name: msg.breadcrumbs.rules,
            url: `${baseUrl}${localePath}${pagePath}`,
          },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: msg.jsonLd.headline,
          description: msg.jsonLd.description,
          author: {
            "@type": "Organization",
            name: msg.jsonLd.author,
            url: baseUrl,
          },
          publisher: {
            "@type": "Organization",
            name: msg.jsonLd.author,
            url: baseUrl,
          },
          mainEntityOfPage: `${baseUrl}${localePath}${pagePath}`,
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
                maxWidth: 650,
                margin: "0 auto",
                lineHeight: 1.6,
              }}
            >
              {msg.hero.subtitle}
            </p>
          </section>

          {/* What is a quiniela */}
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
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              {msg.whatIs.title}
            </h2>
            <p
              style={{
                fontSize: "1.1rem",
                lineHeight: 1.8,
                color: "var(--text)",
                marginBottom: 16,
              }}
            >
              {msg.whatIs.p1}
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                lineHeight: 1.8,
                color: "var(--muted)",
                fontStyle: "italic",
              }}
            >
              {msg.whatIs.p2}
            </p>
          </section>

          {/* Scoring — asymmetric layout, not identical cards */}
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
                  marginBottom: 32,
                  color: "var(--text)",
                }}
              >
                {msg.scoring.title}
              </h2>

              {/* Exact score — big highlight */}
              <div
                style={{
                  background: "var(--bg)",
                  border: "2px solid var(--border)",
                  borderRadius: 12,
                  padding: "28px 28px",
                  marginBottom: 24,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -1,
                    left: 28,
                    background: colors.successAlt,
                    color: "white",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: "0 0 6px 6px",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  3 pts
                </div>
                <h3
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 8,
                    marginTop: 12,
                  }}
                >
                  {msg.scoring.exact.title}
                </h3>
                <p
                  style={{
                    color: "var(--muted)",
                    lineHeight: 1.7,
                    margin: 0,
                    fontSize: "1rem",
                  }}
                >
                  {msg.scoring.exact.text}
                </p>
              </div>

              {/* Correct winner — medium emphasis */}
              <div
                style={{
                  borderLeft: `4px solid ${colors.brand}`,
                  paddingLeft: 24,
                  marginBottom: 24,
                }}
              >
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 6,
                  }}
                >
                  {msg.scoring.winner.title}
                </h3>
                <p
                  style={{
                    color: "var(--muted)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {msg.scoring.winner.text}
                </p>
              </div>

              {/* Goal difference — lighter treatment */}
              <div
                style={{
                  borderLeft: `4px solid #f59e0b`,
                  paddingLeft: 24,
                  marginBottom: 24,
                }}
              >
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 6,
                  }}
                >
                  {msg.scoring.difference.title}
                </h3>
                <p
                  style={{
                    color: "var(--muted)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {msg.scoring.difference.text}
                </p>
              </div>

              {/* Miss — minimal, almost dismissive */}
              <div
                style={{
                  paddingLeft: 24,
                  opacity: 0.85,
                }}
              >
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "var(--muted)",
                    marginBottom: 4,
                  }}
                >
                  {msg.scoring.miss.title}
                </h3>
                <p
                  style={{
                    color: "var(--muted)",
                    lineHeight: 1.7,
                    margin: 0,
                    fontSize: "0.95rem",
                  }}
                >
                  {msg.scoring.miss.text}
                </p>
              </div>
            </div>
          </section>

          {/* Phase multipliers — table + explanation */}
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
                marginBottom: 16,
                color: "var(--text)",
              }}
            >
              {msg.multipliers.title}
            </h2>
            <p
              style={{
                color: "var(--muted)",
                lineHeight: 1.7,
                marginBottom: 28,
                fontSize: "1rem",
              }}
            >
              {msg.multipliers.intro}
            </p>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
                marginBottom: 20,
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
                  <tr
                    style={{ background: "var(--surface-2, var(--surface))" }}
                  >
                    <th
                      style={{
                        padding: "14px 20px",
                        textAlign: "left",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    >
                      {msg.multipliers.table.phase}
                    </th>
                    <th
                      style={{
                        padding: "14px 20px",
                        textAlign: "center",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    >
                      {msg.multipliers.table.multiplier}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {multiplierRows.map((row, i) => {
                    const isLast = i === multiplierRows.length - 1;
                    return (
                      <tr
                        key={i}
                        style={
                          isLast
                            ? {
                                background:
                                  "linear-gradient(90deg, rgba(118,75,162,0.08) 0%, rgba(16,185,129,0.08) 100%)",
                              }
                            : undefined
                        }
                      >
                        <td
                          style={{
                            padding: "12px 20px",
                            borderBottom: isLast
                              ? undefined
                              : "1px solid var(--border)",
                            color: "var(--text)",
                            fontWeight: isLast ? 600 : 400,
                          }}
                        >
                          {row.phase}
                        </td>
                        <td
                          style={{
                            padding: "12px 20px",
                            textAlign: "center",
                            borderBottom: isLast
                              ? undefined
                              : "1px solid var(--border)",
                            fontWeight: 700,
                            color: isLast
                              ? colors.brand
                              : colors.successAlt,
                            fontSize: isLast ? "1.1rem" : "1rem",
                          }}
                        >
                          {row.mult}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p
              style={{
                color: "var(--muted)",
                lineHeight: 1.7,
                fontSize: "0.95rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "16px 20px",
              }}
            >
              {msg.multipliers.example}
            </p>
          </section>

          {/* Deadlines */}
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
                  marginBottom: 20,
                  color: "var(--text)",
                }}
              >
                {msg.deadlines.title}
              </h2>
              <p
                style={{
                  fontSize: "1.05rem",
                  lineHeight: 1.8,
                  color: "var(--text)",
                  marginBottom: 14,
                }}
              >
                {msg.deadlines.p1}
              </p>
              <p
                style={{
                  fontSize: "1rem",
                  lineHeight: 1.8,
                  color: "var(--muted)",
                  marginBottom: 14,
                }}
              >
                {msg.deadlines.p2}
              </p>
              <p
                style={{
                  fontSize: "0.95rem",
                  lineHeight: 1.8,
                  color: "var(--muted)",
                }}
              >
                {msg.deadlines.p3}
              </p>
            </div>
          </section>

          {/* Results */}
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
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              {msg.results.title}
            </h2>
            <p
              style={{
                fontSize: "1.05rem",
                lineHeight: 1.8,
                color: "var(--text)",
                marginBottom: 14,
              }}
            >
              {msg.results.p1}
            </p>
            <p
              style={{
                fontSize: "1rem",
                lineHeight: 1.8,
                color: "var(--muted)",
              }}
            >
              {msg.results.p2}
            </p>
          </section>

          {/* Leaderboard */}
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
                  marginBottom: 20,
                  color: "var(--text)",
                }}
              >
                {msg.leaderboard.title}
              </h2>
              <p
                style={{
                  fontSize: "1.05rem",
                  lineHeight: 1.8,
                  color: "var(--text)",
                  marginBottom: 14,
                }}
              >
                {msg.leaderboard.p1}
              </p>
              <p
                style={{
                  fontSize: "1rem",
                  lineHeight: 1.8,
                  color: "var(--muted)",
                }}
              >
                {msg.leaderboard.p2}
              </p>
            </div>
          </section>

          {/* CTA — light close */}
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
