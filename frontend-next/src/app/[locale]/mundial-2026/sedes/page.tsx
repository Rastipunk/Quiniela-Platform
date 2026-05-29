import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";
import { colors } from "@/lib/theme";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

// ── Metadata ─────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("worldCupVenues.title"),
    description: t("worldCupVenues.description"),
    path: {
      es: "/mundial-2026/sedes",
      en: "/world-cup-2026/venues",
      pt: "/copa-do-mundo-2026/sedes",
    },
  });
}

// ── Venue Data ───────────────────────────────────────────────

interface Venue {
  name: string;
  city: string;
  country: "USA" | "México" | "Canadá";
  capacity: number;
  note: string;
}

const VENUES: Venue[] = [
  // USA (11)
  { name: "MetLife Stadium", city: "East Rutherford, NJ", country: "USA", capacity: 82500, note: "Sede de la Final" },
  { name: "SoFi Stadium", city: "Los Angeles, CA", country: "USA", capacity: 70240, note: "Sede del partido inaugural USA" },
  { name: "Hard Rock Stadium", city: "Miami, FL", country: "USA", capacity: 64767, note: "Semifinal" },
  { name: "NRG Stadium", city: "Houston, TX", country: "USA", capacity: 72220, note: "" },
  { name: "Mercedes-Benz Stadium", city: "Atlanta, GA", country: "USA", capacity: 71000, note: "" },
  { name: "Lumen Field", city: "Seattle, WA", country: "USA", capacity: 69000, note: "" },
  { name: "Lincoln Financial Field", city: "Philadelphia, PA", country: "USA", capacity: 69796, note: "" },
  { name: "Gillette Stadium", city: "Foxborough, MA", country: "USA", capacity: 65878, note: "" },
  { name: "Arrowhead Stadium", city: "Kansas City, MO", country: "USA", capacity: 76416, note: "" },
  { name: "AT&T Stadium", city: "Dallas, TX", country: "USA", capacity: 80000, note: "Cuartos de Final" },
  { name: "Levi's Stadium", city: "Santa Clara, CA", country: "USA", capacity: 68500, note: "Cuartos de Final" },
  // México (3)
  { name: "Estadio Azteca", city: "Ciudad de México", country: "México", capacity: 87523, note: "Tercer Mundial que alberga — récord histórico" },
  { name: "Estadio Akron", city: "Guadalajara", country: "México", capacity: 49850, note: "" },
  { name: "Estadio BBVA", city: "Monterrey", country: "México", capacity: 53500, note: "" },
  // Canadá (2)
  { name: "BMO Field", city: "Toronto", country: "Canadá", capacity: 30000, note: "El más pequeño del Mundial" },
  { name: "BC Place", city: "Vancouver", country: "Canadá", capacity: 54500, note: "" },
];

type CountryKey = "USA" | "México" | "Canadá";

const COUNTRY_FLAGS: Record<CountryKey, string> = {
  USA: "us",
  México: "mx",
  Canadá: "ca",
};

const COUNTRY_TRANSLATE_KEY: Record<CountryKey, string> = {
  USA: "usa",
  México: "mexico",
  Canadá: "canada",
};

const COUNTRY_ORDER: CountryKey[] = ["USA", "México", "Canadá"];

function flagUrl(code: string): string {
  return `https://flagcdn.com/32x24/${code}.png`;
}

function formatCapacity(num: number): string {
  return num.toLocaleString("en-US");
}

// ── Page Component ───────────────────────────────────────────

export default async function SedesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("worldCup.venues");

  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;
  const paths: Record<string, string> = {
    es: "/mundial-2026/sedes",
    en: "/world-cup-2026/venues",
    pt: "/copa-do-mundo-2026/sedes",
  };
  const worldCupPaths: Record<string, string> = {
    es: "/mundial-2026",
    en: "/world-cup-2026",
    pt: "/copa-do-mundo-2026",
  };

  // Group venues by country
  const venuesByCountry: Record<CountryKey, Venue[]> = {
    USA: [],
    México: [],
    Canadá: [],
  };
  for (const venue of VENUES) {
    venuesByCountry[venue.country].push(venue);
  }

  // JSON-LD for each venue
  const venueJsonLd = VENUES.map((v) => ({
    "@type": "Place",
    name: v.name,
    address: {
      "@type": "PostalAddress",
      addressLocality: v.city,
      addressCountry: v.country === "USA" ? "US" : v.country === "México" ? "MX" : "CA",
    },
    maximumAttendeeCapacity: v.capacity,
  }));

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbs.home"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbs.worldCup"), url: `${baseUrl}${localePath}${worldCupPaths[locale]}` },
          { name: t("breadcrumbs.venues"), url: `${baseUrl}${localePath}${paths[locale]}` },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("hero.title"),
          description: t("hero.subtitle"),
          numberOfItems: VENUES.length,
          itemListElement: venueJsonLd.map((v, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: v,
          })),
        }}
      />
      <PublicPageWrapper>
        <div style={{ background: "var(--bg)" }}>
          {/* Hero */}
          <section
            style={{
              background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
              color: "white",
              padding: "60px 40px",
              textAlign: "center",
            }}
          >
            <h1
              style={{
                fontSize: "2.5rem",
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              {t("hero.title")}
            </h1>
            <p
              style={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.8)",
                maxWidth: 700,
                margin: "0 auto",
              }}
            >
              {t("hero.subtitle")}
            </p>
          </section>

          {/* Country overview — text-based map */}
          <section
            style={{
              padding: "48px 20px",
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h2
              style={{
                fontSize: "1.6rem",
                fontWeight: 700,
                textAlign: "center",
                marginBottom: 32,
                color: "var(--text)",
              }}
            >
              {t("venueMap.title")}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 20,
                maxWidth: 800,
                margin: "0 auto",
              }}
            >
              {COUNTRY_ORDER.map((country) => {
                const flag = COUNTRY_FLAGS[country];
                const tKey = COUNTRY_TRANSLATE_KEY[country];
                const countKey = `${tKey}Count` as "usaCount" | "mexicoCount" | "canadaCount";
                return (
                  <div
                    key={country}
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: "28px 24px",
                      textAlign: "center",
                    }}
                  >
                    <img
                      src={flagUrl(flag)}
                      alt={t(`countries.${tKey}`)}
                      width={32}
                      height={24}
                      style={{ borderRadius: 3, marginBottom: 12 }}
                      loading="lazy"
                    />
                    <div
                      style={{
                        fontSize: "1.2rem",
                        fontWeight: 700,
                        color: "var(--text)",
                        marginBottom: 4,
                      }}
                    >
                      {t(`countries.${tKey}`)}
                    </div>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        color: "var(--muted)",
                        fontWeight: 500,
                      }}
                    >
                      {t(`venueMap.${countKey}`)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Venues by Country */}
          <section
            style={{
              padding: "60px 20px",
              maxWidth: 1100,
              margin: "0 auto",
            }}
          >
            {COUNTRY_ORDER.map((country) => {
              const venues = venuesByCountry[country];
              const flag = COUNTRY_FLAGS[country];
              const tKey = COUNTRY_TRANSLATE_KEY[country];

              return (
                <div key={country} style={{ marginBottom: 56 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 24,
                      paddingBottom: 12,
                      borderBottom: "2px solid var(--border)",
                    }}
                  >
                    <img
                      src={flagUrl(flag)}
                      alt={t(`countries.${tKey}`)}
                      width={32}
                      height={24}
                      style={{ borderRadius: 3 }}
                      loading="lazy"
                    />
                    <h2
                      style={{
                        fontSize: "1.6rem",
                        fontWeight: 700,
                        color: "var(--text)",
                        margin: 0,
                      }}
                    >
                      {t(`countries.${tKey}`)}
                    </h2>
                    <span
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--muted)",
                        fontWeight: 500,
                      }}
                    >
                      ({t("stadiumCount", { count: String(venues.length) })})
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {venues.map((venue) => (
                      <div
                        key={venue.name}
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 14,
                          padding: "24px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "1.15rem",
                            fontWeight: 700,
                            color: "var(--text)",
                            margin: 0,
                          }}
                        >
                          {venue.name}
                        </h3>

                        <div
                          style={{
                            fontSize: "0.9rem",
                            color: "var(--muted)",
                          }}
                        >
                          {venue.city}
                        </div>

                        <div
                          style={{
                            fontSize: "0.9rem",
                            color: "var(--text)",
                            fontWeight: 500,
                          }}
                        >
                          {t("capacity", { number: formatCapacity(venue.capacity) })}
                        </div>

                        {venue.note && (
                          <div
                            style={{
                              marginTop: 4,
                              padding: "6px 12px",
                              background: "var(--bg)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              color: "var(--text)",
                            }}
                          >
                            <span style={{ color: "var(--muted)", marginRight: 6 }}>
                              {t("notable")}:
                            </span>
                            {venue.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Facts */}
          <section
            style={{
              padding: "60px 20px",
              background: "var(--surface)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              <h2
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  marginBottom: 24,
                  color: "var(--text)",
                  textAlign: "center",
                }}
              >
                {t("facts.title")}
              </h2>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {(
                  [
                    "totalVenues",
                    "totalCapacity",
                    "threeCountries",
                    "largestVenue",
                    "smallestVenue",
                    "finalVenue",
                  ] as const
                ).map((key) => (
                  <div
                    key={key}
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "14px 20px",
                      fontSize: "1rem",
                      color: "var(--text)",
                      fontWeight: key === "finalVenue" ? 700 : 500,
                    }}
                  >
                    {t(`facts.${key}`)}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section
            style={{
              background: colors.brandGradient,
              color: "white",
              padding: "80px 40px",
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
              {t("cta.title")}
            </h2>
            <p
              style={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.9)",
                marginBottom: 32,
              }}
            >
              {t("cta.description")}
            </p>
            <RegisterButton label={t("cta.button")} />
          </section>
        </div>
      </PublicPageWrapper>
    </>
  );
}
