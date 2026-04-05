import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";
import { ShareButtons } from "@/components/ShareButtons";
import { colors } from "@/lib/theme";
import { SITE_URL } from "@/lib/siteConfig";
import { BRAND } from "@/lib/brand";

/* ────────────────── Static Data ────────────────── */

const GROUPS: Record<string, string[]> = {
  A: ["Mexico", "Corea del Sur", "Sudafrica", "Republica Checa"],
  B: ["Canada", "Bosnia y Herzegovina", "Qatar", "Suiza"],
  C: ["Brasil", "Marruecos", "Haiti", "Escocia"],
  D: ["Estados Unidos", "Paraguay", "Australia", "Turquia"],
  E: ["Alemania", "Ecuador", "Costa de Marfil", "Curazao"],
  F: ["Paises Bajos", "Japon", "Suecia", "Tunez"],
  G: ["Belgica", "Egipto", "Iran", "Nueva Zelanda"],
  H: ["Espana", "Uruguay", "Cabo Verde", "Arabia Saudita"],
  I: ["Francia", "Senegal", "Noruega", "Irak"],
  J: ["Argentina", "Argelia", "Austria", "Jordania"],
  K: ["Portugal", "Colombia", "Congo DR", "Uzbekistan"],
  L: ["Inglaterra", "Croacia", "Ghana", "Panama"],
};

const GROUP_FLAGS: Record<string, string[]> = {
  A: ["mx", "kr", "za", "cz"],
  B: ["ca", "ba", "qa", "ch"],
  C: ["br", "ma", "ht", "gb-sct"],
  D: ["us", "py", "au", "tr"],
  E: ["de", "ec", "ci", "cw"],
  F: ["nl", "jp", "se", "tn"],
  G: ["be", "eg", "ir", "nz"],
  H: ["es", "uy", "cv", "sa"],
  I: ["fr", "sn", "no", "iq"],
  J: ["ar", "dz", "at", "jo"],
  K: ["pt", "co", "cd", "uz"],
  L: ["gb-eng", "hr", "gh", "pa"],
};

/* ────────────────── Metadata ────────────────── */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = SITE_URL;

  const localePath = locale === "es" ? "" : `/${locale}`;
  const pagePath =
    locale === "en"
      ? "/world-cup-2026"
      : locale === "pt"
        ? "/copa-do-mundo-2026"
        : "/mundial-2026";
  const url = `${baseUrl}${localePath}${pagePath}`;

  return {
    title: t("worldCup.title"),
    description: t("worldCup.description"),
    openGraph: {
      title: t("worldCup.title"),
      description: t("worldCup.description"),
      url,
      type: "website",
    },
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/mundial-2026`,
        en: `${baseUrl}/en/world-cup-2026`,
        pt: `${baseUrl}/pt/copa-do-mundo-2026`,
        "x-default": `${baseUrl}/mundial-2026`,
      },
    },
  };
}

/* ────────────────── Sub-page link config ────────────────── */

interface SubPage {
  titleKey: string;
  descKey: string;
  href: string;
  icon: string;
}

function getSubPages(locale: string): SubPage[] {
  const prefix = locale === "es" ? "" : `/${locale}`;
  const wcSlug =
    locale === "en"
      ? "world-cup-2026"
      : locale === "pt"
        ? "copa-do-mundo-2026"
        : "mundial-2026";

  return [
    {
      titleKey: "hub.subPages.groupsTitle",
      descKey: "hub.subPages.groupsDesc",
      href: `${prefix}/${wcSlug}/${locale === "en" ? "groups" : "grupos"}`,
      icon: "\uD83C\uDFDF\uFE0F",
    },
    {
      titleKey: "hub.subPages.calendarTitle",
      descKey: "hub.subPages.calendarDesc",
      href: `${prefix}/${wcSlug}/${locale === "en" ? "schedule" : "calendario"}`,
      icon: "\uD83D\uDCC5",
    },
    {
      titleKey: "hub.subPages.venuesTitle",
      descKey: "hub.subPages.venuesDesc",
      href: `${prefix}/${wcSlug}/${locale === "en" ? "venues" : "sedes"}`,
      icon: "\uD83C\uDFDF\uFE0F",
    },
    {
      titleKey: "hub.subPages.guideTitle",
      descKey: "hub.subPages.guideDesc",
      href: `${prefix}/${wcSlug}/${locale === "en" ? "how-to-create-pool" : "como-hacer-quiniela"}`,
      icon: "\uD83D\uDCCB",
    },
    {
      titleKey: "hub.subPages.rulesTitle",
      descKey: "hub.subPages.rulesDesc",
      href: `${prefix}/${wcSlug}/${locale === "en" ? "pool-rules" : locale === "pt" ? "regras-bolao" : "reglas-quiniela"}`,
      icon: "\uD83D\uDCDC",
    },
    {
      titleKey: "hub.subPages.predictionsTitle",
      descKey: "hub.subPages.predictionsDesc",
      href: `${prefix}/${wcSlug}/${locale === "en" ? "predictions" : locale === "pt" ? "previsoes" : "predicciones"}`,
      icon: "\uD83E\uDD16",
    },
  ];
}

/* ────────────────── Page Component ────────────────── */

export default async function Mundial2026Page() {
  const locale = await getLocale();
  const t = await getTranslations("worldCup");
  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;
  const pagePath =
    locale === "en"
      ? "/world-cup-2026"
      : locale === "pt"
        ? "/copa-do-mundo-2026"
        : "/mundial-2026";

  const subPages = getSubPages(locale);

  const faqItems = [
    { q: t("hub.faq.q1"), a: t("hub.faq.a1") },
    { q: t("hub.faq.q2"), a: t("hub.faq.a2") },
    { q: t("hub.faq.q3"), a: t("hub.faq.a3") },
    { q: t("hub.faq.q4"), a: t("hub.faq.a4") },
    { q: t("hub.faq.q5"), a: t("hub.faq.a5") },
  ];

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("hub.breadcrumbs.home"), url: `${baseUrl}${localePath}` },
          {
            name: t("hub.breadcrumbs.worldCup"),
            url: `${baseUrl}${localePath}${pagePath}`,
          },
        ]}
      />

      {/* SportsEvent + WebPage JSON-LD */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SportsEvent",
              name: "FIFA World Cup 2026",
              description: t("hub.hero.subtitle"),
              startDate: "2026-06-11",
              endDate: "2026-07-19",
              location: [
                {
                  "@type": "Place",
                  name: "Mexico",
                  address: { "@type": "PostalAddress", addressCountry: "MX" },
                },
                {
                  "@type": "Place",
                  name: "United States",
                  address: { "@type": "PostalAddress", addressCountry: "US" },
                },
                {
                  "@type": "Place",
                  name: "Canada",
                  address: { "@type": "PostalAddress", addressCountry: "CA" },
                },
              ],
              organizer: {
                "@type": "Organization",
                name: "FIFA",
                url: "https://www.fifa.com",
              },
              sport: "Football",
              competitor: Object.values(GROUPS)
                .flat()
                .map((team) => ({
                  "@type": "SportsTeam",
                  name: team,
                })),
            },
            {
              "@type": "WebPage",
              name: t("hub.hero.title"),
              url: `${baseUrl}${localePath}${pagePath}`,
              description: t("hub.hero.subtitle"),
              publisher: {
                "@type": "Organization",
                name: BRAND.name,
                url: baseUrl,
              },
            },
          ],
        }}
      />

      {/* FAQPage JSON-LD */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.a,
            },
          })),
        }}
      />

      <PublicPageWrapper>
        <div style={{ background: "var(--bg)" }}>
          {/* ═══════════ HERO ═══════════ */}
          <section
            style={{
              background: colors.brandGradient,
              color: "white",
              padding: "80px 24px 60px",
              textAlign: "center",
            }}
          >
            <h1
              style={{
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: 800,
                marginBottom: 12,
                lineHeight: 1.1,
              }}
            >
              {t("hub.hero.title")}
            </h1>
            <p
              style={{
                fontSize: "1.15rem",
                color: "rgba(255,255,255,0.9)",
                maxWidth: 700,
                margin: "0 auto 40px",
                lineHeight: 1.6,
              }}
            >
              {t("hub.hero.subtitle")}
            </p>

            {/* Stats cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 16,
                maxWidth: 640,
                margin: "0 auto 40px",
              }}
            >
              {(
                [
                  ["teams", "teamsLabel"],
                  ["matches", "matchesLabel"],
                  ["venues", "venuesLabel"],
                  ["countries", "countriesLabel"],
                ] as const
              ).map(([valKey, labelKey]) => (
                <div
                  key={valKey}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                    borderRadius: 16,
                    padding: "20px 12px",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      lineHeight: 1.2,
                    }}
                  >
                    {t(`hub.hero.stats.${valKey}`)}
                  </div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "rgba(255,255,255,0.8)",
                      marginTop: 4,
                    }}
                  >
                    {t(`hub.hero.stats.${labelKey}`)}
                  </div>
                </div>
              ))}
            </div>

            <RegisterButton label={t("hub.hero.cta")} />

            {/* Sub-page pills integrated in hero */}
            <nav
              style={{
                marginTop: 40,
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                padding: "0 8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  flexWrap: "wrap",
                  minWidth: "max-content",
                  margin: "0 auto",
                }}
              >
                {subPages.map((page) => (
                  <a
                    key={page.href}
                    href={page.href}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 18px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.15)",
                      border: "1px solid rgba(255,255,255,0.25)",
                      color: "white",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <span style={{ fontSize: "0.95rem" }}>{page.icon}</span>
                    {t(page.titleKey)}
                  </a>
                ))}
              </div>
            </nav>
          </section>

          {/* ═══════════ GROUPS OVERVIEW ═══════════ */}
          <section
            style={{
              padding: "80px 24px",
              maxWidth: 1100,
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: 12,
                color: "var(--text)",
                textAlign: "center",
              }}
            >
              {t("hub.groups.title")}
            </h2>
            <p
              style={{
                color: "var(--muted)",
                textAlign: "center",
                maxWidth: 700,
                margin: "0 auto 40px",
                lineHeight: 1.6,
              }}
            >
              {t("hub.groups.subtitle")}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
              {Object.entries(GROUPS).map(([letter, teams]) => (
                <div
                  key={letter}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 20,
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      marginBottom: 12,
                      color: BRAND.primary,
                    }}
                  >
                    {t("hub.groups.groupLabel")} {letter}
                  </h3>
                  <ul
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {teams.map((team, i) => (
                      <li
                        key={team}
                        style={{
                          fontSize: "0.95rem",
                          color: "var(--text)",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <img
                          src={`https://flagcdn.com/w40/${GROUP_FLAGS[letter]?.[i] ?? "xx"}.png`}
                          alt={team}
                          width={24}
                          height={16}
                          style={{ borderRadius: 2, objectFit: "cover" }}
                          loading="lazy"
                        />
                        {team}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 32 }}>
              <a
                href={`${localePath}/${locale === "en" ? "world-cup-2026/groups" : locale === "pt" ? "copa-do-mundo-2026/grupos" : "mundial-2026/grupos"}`}
                style={{
                  color: BRAND.primary,
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  textDecoration: "underline",
                }}
              >
                {t("hub.groups.viewAll")}
              </a>
            </div>
          </section>

          {/* ═══════════ HOW IT WORKS ═══════════ */}
          <section
            style={{
              background: "var(--surface)",
              padding: "80px 24px",
            }}
          >
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  marginBottom: 12,
                  color: "var(--text)",
                  textAlign: "center",
                }}
              >
                {t("hub.howItWorks.title")}
              </h2>
              <p
                style={{
                  color: "var(--muted)",
                  textAlign: "center",
                  maxWidth: 650,
                  margin: "0 auto 48px",
                  lineHeight: 1.6,
                }}
              >
                {t("hub.howItWorks.subtitle")}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 32,
                }}
              >
                {([1, 2, 3, 4] as const).map((n) => {
                  const icons = ["\uD83C\uDFC6", "\uD83D\uDCE8", "\u26BD", "\uD83D\uDCCA"];
                  return (
                    <div key={n} style={{ textAlign: "center" }}>
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          background: colors.brandGradient,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.5rem",
                          margin: "0 auto 16px",
                          color: "white",
                        }}
                      >
                        <span aria-hidden="true">{icons[n - 1]}</span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: BRAND.primary,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          marginBottom: 8,
                        }}
                      >
                        {n}
                      </div>
                      <h3
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 700,
                          marginBottom: 8,
                          color: "var(--text)",
                        }}
                      >
                        {t(`hub.howItWorks.step${n}Title`)}
                      </h3>
                      <p
                        style={{
                          color: "var(--muted)",
                          lineHeight: 1.6,
                          fontSize: "0.95rem",
                          margin: 0,
                        }}
                      >
                        {t(`hub.howItWorks.step${n}Desc`)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ═══════════ FEATURES ═══════════ */}
          <section
            style={{
              padding: "80px 24px",
              maxWidth: 1000,
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: 12,
                color: "var(--text)",
                textAlign: "center",
              }}
            >
              {t("hub.features.title")}
            </h2>
            <p
              style={{
                color: "var(--muted)",
                textAlign: "center",
                maxWidth: 650,
                margin: "0 auto 48px",
                lineHeight: 1.6,
              }}
            >
              {t("hub.features.subtitle")}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 24,
              }}
            >
              {(
                [
                  { key: "free", icon: "\uD83D\uDCB0" },
                  { key: "auto", icon: "\uD83E\uDD16" },
                  { key: "custom", icon: "\u2699\uFE0F" },
                  { key: "multi", icon: "\uD83C\uDF0D" },
                ] as const
              ).map(({ key, icon }) => (
                <div
                  key={key}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 28,
                  }}
                >
                  <div
                    style={{ fontSize: "2rem", marginBottom: 12 }}
                    aria-hidden="true"
                  >
                    {icon}
                  </div>
                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      marginBottom: 8,
                      color: "var(--text)",
                    }}
                  >
                    {t(`hub.features.${key}`)}
                  </h3>
                  <p
                    style={{
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      fontSize: "0.95rem",
                      margin: 0,
                    }}
                  >
                    {t(`hub.features.${key}Desc`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ═══════════ SUB-PAGES NAVIGATION ═══════════ */}
          <section
            style={{
              background: "var(--surface)",
              padding: "80px 24px",
            }}
          >
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>
              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  marginBottom: 12,
                  color: "var(--text)",
                  textAlign: "center",
                }}
              >
                {t("hub.subPages.title")}
              </h2>
              <p
                style={{
                  color: "var(--muted)",
                  textAlign: "center",
                  maxWidth: 600,
                  margin: "0 auto 48px",
                  lineHeight: 1.6,
                }}
              >
                {t("hub.subPages.subtitle")}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 20,
                }}
              >
                {subPages.map((page) => (
                  <a
                    key={page.href}
                    href={page.href}
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 16,
                      padding: 24,
                      textDecoration: "none",
                      display: "block",
                      transition: "box-shadow 0.2s",
                    }}
                  >
                    <div
                      style={{ fontSize: "1.5rem", marginBottom: 12 }}
                      aria-hidden="true"
                    >
                      {page.icon}
                    </div>
                    <h3
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 700,
                        marginBottom: 8,
                        color: "var(--text)",
                      }}
                    >
                      {t(page.titleKey)}
                    </h3>
                    <p
                      style={{
                        color: "var(--muted)",
                        lineHeight: 1.5,
                        fontSize: "0.9rem",
                        margin: 0,
                      }}
                    >
                      {t(page.descKey)}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════ FAQ ═══════════ */}
          <section
            style={{
              padding: "80px 24px",
              maxWidth: 800,
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: 40,
                color: "var(--text)",
                textAlign: "center",
              }}
            >
              {t("hub.faq.title")}
            </h2>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {faqItems.map((item, i) => (
                <details
                  key={i}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  <summary
                    style={{
                      padding: "20px 24px",
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      color: "var(--text)",
                      cursor: "pointer",
                      listStyle: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {item.q}
                    <span
                      aria-hidden="true"
                      style={{
                        fontSize: "1.2rem",
                        color: "var(--muted)",
                        flexShrink: 0,
                        marginLeft: 12,
                      }}
                    >
                      +
                    </span>
                  </summary>
                  <div
                    style={{
                      padding: "0 24px 20px",
                      color: "var(--muted)",
                      lineHeight: 1.7,
                      fontSize: "0.95rem",
                    }}
                  >
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* ═══════════ SHARE ═══════════ */}
          <div style={{ textAlign: "center", marginTop: 32, marginBottom: 16 }}>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 12 }}>
              {t("hub.share.label")}
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <ShareButtons
                context="worldCupHub"
                url={`${baseUrl}${localePath}${pagePath}`}
                size="sm"
              />
            </div>
          </div>

          {/* ═══════════ BOTTOM CTA ═══════════ */}
          <section
            style={{
              background: colors.brandGradient,
              color: "white",
              padding: "80px 24px",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              {t("hub.bottomCta.title")}
            </h2>
            <p
              style={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.9)",
                maxWidth: 600,
                margin: "0 auto 32px",
                lineHeight: 1.6,
              }}
            >
              {t("hub.bottomCta.description")}
            </p>
            <RegisterButton label={t("hub.bottomCta.cta")} />
          </section>
        </div>
      </PublicPageWrapper>
    </>
  );
}
