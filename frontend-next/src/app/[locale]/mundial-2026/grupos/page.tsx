import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";
import { colors } from "@/lib/theme";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";

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

const TEAM_FLAGS: Record<string, string> = {
  Mexico: "mx",
  "Corea del Sur": "kr",
  Sudafrica: "za",
  "Republica Checa": "cz",
  Canada: "ca",
  "Bosnia y Herzegovina": "ba",
  Qatar: "qa",
  Suiza: "ch",
  Brasil: "br",
  Marruecos: "ma",
  Haiti: "ht",
  Escocia: "gb-sct",
  "Estados Unidos": "us",
  Paraguay: "py",
  Australia: "au",
  Turquia: "tr",
  Alemania: "de",
  Ecuador: "ec",
  "Costa de Marfil": "ci",
  Curazao: "cw",
  "Paises Bajos": "nl",
  Japon: "jp",
  Suecia: "se",
  Tunez: "tn",
  Belgica: "be",
  Egipto: "eg",
  Iran: "ir",
  "Nueva Zelanda": "nz",
  Espana: "es",
  Uruguay: "uy",
  "Cabo Verde": "cv",
  "Arabia Saudita": "sa",
  Francia: "fr",
  Senegal: "sn",
  Noruega: "no",
  Irak: "iq",
  Argentina: "ar",
  Argelia: "dz",
  Austria: "at",
  Jordania: "jo",
  Portugal: "pt",
  Colombia: "co",
  "Congo DR": "cd",
  Uzbekistan: "uz",
  Inglaterra: "gb-eng",
  Croacia: "hr",
  Ghana: "gh",
  Panama: "pa",
};

/** Generate the 6 group-stage matches for a group of 4 teams (round-robin). */
function getGroupMatches(
  teams: string[]
): { matchday: number; home: string; away: string }[] {
  // Standard FIFA round-robin schedule for 4 teams
  return [
    { matchday: 1, home: teams[0], away: teams[2] },
    { matchday: 1, home: teams[1], away: teams[3] },
    { matchday: 2, home: teams[0], away: teams[3] },
    { matchday: 2, home: teams[2], away: teams[1] },
    { matchday: 3, home: teams[0], away: teams[1] },
    { matchday: 3, home: teams[2], away: teams[3] },
  ];
}

/* ────────────────── Metadata ────────────────── */

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("worldCupGroups.title"),
    description: t("worldCupGroups.description"),
    path: {
      es: "/mundial-2026/grupos",
      en: "/world-cup-2026/groups",
      pt: "/copa-do-mundo-2026/grupos",
    },
  });
}

/* ────────────────── Page Component ────────────────── */

export default async function GruposMundial2026Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("worldCup");
  const baseUrl = SITE_URL;

  const localePath = locale === "es" ? "" : `/${locale}`;
  const wcSlug =
    locale === "en"
      ? "world-cup-2026"
      : locale === "pt"
        ? "copa-do-mundo-2026"
        : "mundial-2026";
  const groupsSlug = locale === "en" ? "groups" : "grupos";
  const groupsPath = `/${wcSlug}/${groupsSlug}`;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("groups.breadcrumbs.home"), url: `${baseUrl}${localePath}` },
          {
            name: t("groups.breadcrumbs.worldCup"),
            url: `${baseUrl}${localePath}/${wcSlug}`,
          },
          {
            name: t("groups.breadcrumbs.groups"),
            url: `${baseUrl}${localePath}${groupsPath}`,
          },
        ]}
      />

      {/* ItemList JSON-LD */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("groups.hero.title"),
          description: t("groups.hero.subtitle"),
          numberOfItems: 12,
          itemListElement: Object.entries(GROUPS).map(
            ([letter, teams], index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: `Group ${letter}`,
              description: teams.join(", "),
            })
          ),
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
                fontSize: "clamp(1.8rem, 4.5vw, 2.8rem)",
                fontWeight: 800,
                marginBottom: 16,
                lineHeight: 1.15,
              }}
            >
              {t("groups.hero.title")}
            </h1>
            <p
              style={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.9)",
                maxWidth: 700,
                margin: "0 auto",
                lineHeight: 1.6,
              }}
            >
              {t("groups.hero.subtitle")}
            </p>
          </section>

          {/* ═══════════ 12 GROUP CARDS ═══════════ */}
          <section
            style={{
              padding: "80px 24px",
              maxWidth: 1200,
              margin: "0 auto",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 24,
              }}
            >
              {Object.entries(GROUPS).map(([letter, teams]) => {
                const matches = getGroupMatches(teams);
                return (
                  <div
                    key={letter}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 16,
                      overflow: "hidden",
                    }}
                  >
                    {/* Group header */}
                    <div
                      style={{
                        background: colors.brandGradient,
                        padding: "16px 20px",
                        color: "white",
                      }}
                    >
                      <h2
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: 700,
                          margin: 0,
                        }}
                      >
                        {t("groups.groupLabel")} {letter}
                      </h2>
                    </div>

                    {/* Teams */}
                    <div style={{ padding: "20px 20px 16px" }}>
                      <ul
                        style={{
                          listStyle: "none",
                          margin: 0,
                          padding: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {teams.map((team) => {
                          const iso = TEAM_FLAGS[team] ?? "";
                          return (
                            <li
                              key={team}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                fontSize: "0.95rem",
                                color: "var(--text)",
                              }}
                            >
                              {iso && (
                                <img
                                  src={`https://flagcdn.com/w40/${iso}.png`}
                                  alt={`${team} flag`}
                                  width={24}
                                  height={16}
                                  style={{
                                    borderRadius: 2,
                                    objectFit: "cover",
                                    flexShrink: 0,
                                  }}
                                  loading="lazy"
                                />
                              )}
                              <span style={{ fontWeight: 600 }}>{team}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Mini match schedule */}
                    <div
                      style={{
                        borderTop: "1px solid var(--border)",
                        padding: "16px 20px",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          marginBottom: 12,
                        }}
                      >
                        {t("groups.matchesTitle")}
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {matches.map((m, i) => {
                          const homeIso = TEAM_FLAGS[m.home] ?? "";
                          const awayIso = TEAM_FLAGS[m.away] ?? "";
                          return (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: "0.85rem",
                                color: "var(--text)",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--muted)",
                                  fontWeight: 600,
                                  width: 18,
                                  textAlign: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {t("groups.matchday")}
                                {m.matchday}
                              </span>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  flex: 1,
                                  justifyContent: "center",
                                }}
                              >
                                {homeIso && (
                                  <img
                                    src={`https://flagcdn.com/w20/${homeIso}.png`}
                                    alt=""
                                    width={16}
                                    height={11}
                                    style={{
                                      borderRadius: 1,
                                      objectFit: "cover",
                                    }}
                                    loading="lazy"
                                  />
                                )}
                                <span
                                  style={{
                                    fontWeight: 500,
                                    maxWidth: 90,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    textAlign: "right",
                                  }}
                                >
                                  {m.home}
                                </span>
                                <span
                                  style={{
                                    color: "var(--muted)",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    margin: "0 2px",
                                  }}
                                >
                                  {t("groups.vs")}
                                </span>
                                <span
                                  style={{
                                    fontWeight: 500,
                                    maxWidth: 90,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {m.away}
                                </span>
                                {awayIso && (
                                  <img
                                    src={`https://flagcdn.com/w20/${awayIso}.png`}
                                    alt=""
                                    width={16}
                                    height={11}
                                    style={{
                                      borderRadius: 1,
                                      objectFit: "cover",
                                    }}
                                    loading="lazy"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═══════════ ADVANCEMENT EXPLANATION ═══════════ */}
          <section
            style={{
              background: "var(--surface)",
              padding: "80px 24px",
            }}
          >
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  marginBottom: 20,
                  color: "var(--text)",
                  textAlign: "center",
                }}
              >
                {t("groups.advancement.title")}
              </h2>
              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.7,
                  fontSize: "1.05rem",
                  textAlign: "center",
                  maxWidth: 700,
                  margin: "0 auto 32px",
                }}
              >
                {t("groups.advancement.description")}
              </p>

              <div
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 28,
                  maxWidth: 500,
                  margin: "0 auto 24px",
                }}
              >
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    marginBottom: 16,
                    color: "var(--text)",
                  }}
                >
                  {t("groups.advancement.pointsTitle")}
                </h3>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <li
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      color: "var(--text)",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: colors.successBgAlt,
                        color: colors.successDarker,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      3
                    </span>
                    {t("groups.advancement.win")}
                  </li>
                  <li
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      color: "var(--text)",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: colors.warningBgAmber,
                        color: colors.warningDarker,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      1
                    </span>
                    {t("groups.advancement.draw")}
                  </li>
                  <li
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      color: "var(--text)",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: colors.errorBg,
                        color: colors.errorDark,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      0
                    </span>
                    {t("groups.advancement.loss")}
                  </li>
                </ul>
              </div>

              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.7,
                  fontSize: "0.95rem",
                  textAlign: "center",
                  maxWidth: 650,
                  margin: "0 auto",
                }}
              >
                {t("groups.advancement.tiebreaker")}
              </p>
            </div>
          </section>

          {/* ═══════════ CTA ═══════════ */}
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
              {t("groups.cta.title")}
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
              {t("groups.cta.description")}
            </p>
            <RegisterButton label={t("groups.cta.button")} />
          </section>
        </div>
      </PublicPageWrapper>
    </>
  );
}
