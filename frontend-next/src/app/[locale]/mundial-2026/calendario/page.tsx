import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
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
    title: t("worldCupSchedule.title"),
    description: t("worldCupSchedule.description"),
    path: {
      es: "/mundial-2026/calendario",
      en: "/world-cup-2026/schedule",
      pt: "/copa-do-mundo-2026/calendario",
    },
  });
}

// ── Match Data ───────────────────────────────────────────────

interface GroupMatch {
  group: string;
  md: number;
  date: string;
  time: string;
  home: string;
  away: string;
  venue: string;
  homeFlag: string;
  awayFlag: string;
}

const GROUP_MATCHES: GroupMatch[] = [
  // Group A
  { group: "A", md: 1, date: "2026-06-11", time: "19:00", home: "México", away: "Sudáfrica", venue: "Estadio Azteca", homeFlag: "mx", awayFlag: "za" },
  { group: "A", md: 1, date: "2026-06-12", time: "02:00", home: "Corea del Sur", away: "República Checa", venue: "Estadio Akron", homeFlag: "kr", awayFlag: "cz" },
  { group: "A", md: 2, date: "2026-06-18", time: "16:00", home: "República Checa", away: "Sudáfrica", venue: "Mercedes-Benz Stadium", homeFlag: "cz", awayFlag: "za" },
  { group: "A", md: 2, date: "2026-06-19", time: "01:00", home: "México", away: "Corea del Sur", venue: "Estadio Akron", homeFlag: "mx", awayFlag: "kr" },
  { group: "A", md: 3, date: "2026-06-25", time: "01:00", home: "República Checa", away: "México", venue: "Estadio Azteca", homeFlag: "cz", awayFlag: "mx" },
  { group: "A", md: 3, date: "2026-06-25", time: "01:00", home: "Sudáfrica", away: "Corea del Sur", venue: "Estadio BBVA", homeFlag: "za", awayFlag: "kr" },
  // Group B
  { group: "B", md: 1, date: "2026-06-12", time: "19:00", home: "Canadá", away: "Bosnia y Herzegovina", venue: "BMO Field", homeFlag: "ca", awayFlag: "ba" },
  { group: "B", md: 1, date: "2026-06-13", time: "19:00", home: "Qatar", away: "Suiza", venue: "TBD", homeFlag: "qa", awayFlag: "ch" },
  { group: "B", md: 2, date: "2026-06-18", time: "19:00", home: "Suiza", away: "Bosnia y Herzegovina", venue: "SoFi Stadium", homeFlag: "ch", awayFlag: "ba" },
  { group: "B", md: 2, date: "2026-06-18", time: "22:00", home: "Canadá", away: "Qatar", venue: "BC Place", homeFlag: "ca", awayFlag: "qa" },
  { group: "B", md: 3, date: "2026-06-24", time: "19:00", home: "Suiza", away: "Canadá", venue: "BC Place", homeFlag: "ch", awayFlag: "ca" },
  { group: "B", md: 3, date: "2026-06-24", time: "19:00", home: "Bosnia y Herzegovina", away: "Qatar", venue: "Lumen Field", homeFlag: "ba", awayFlag: "qa" },
  // Group C
  { group: "C", md: 1, date: "2026-06-13", time: "22:00", home: "Brasil", away: "Marruecos", venue: "MetLife Stadium", homeFlag: "br", awayFlag: "ma" },
  { group: "C", md: 1, date: "2026-06-14", time: "01:00", home: "Haití", away: "Escocia", venue: "Gillette Stadium", homeFlag: "ht", awayFlag: "gb-sct" },
  { group: "C", md: 2, date: "2026-06-19", time: "22:00", home: "Escocia", away: "Marruecos", venue: "Gillette Stadium", homeFlag: "gb-sct", awayFlag: "ma" },
  { group: "C", md: 2, date: "2026-06-20", time: "01:00", home: "Brasil", away: "Haití", venue: "Lincoln Financial Field", homeFlag: "br", awayFlag: "ht" },
  { group: "C", md: 3, date: "2026-06-24", time: "22:00", home: "Marruecos", away: "Haití", venue: "Mercedes-Benz Stadium", homeFlag: "ma", awayFlag: "ht" },
  { group: "C", md: 3, date: "2026-06-24", time: "22:00", home: "Escocia", away: "Brasil", venue: "Hard Rock Stadium", homeFlag: "gb-sct", awayFlag: "br" },
  // Group D
  { group: "D", md: 1, date: "2026-06-13", time: "01:00", home: "Estados Unidos", away: "Paraguay", venue: "SoFi Stadium", homeFlag: "us", awayFlag: "py" },
  { group: "D", md: 1, date: "2026-06-14", time: "04:00", home: "Australia", away: "Turquía", venue: "BC Place", homeFlag: "au", awayFlag: "tr" },
  { group: "D", md: 2, date: "2026-06-19", time: "04:00", home: "Turquía", away: "Paraguay", venue: "TBD", homeFlag: "tr", awayFlag: "py" },
  { group: "D", md: 2, date: "2026-06-19", time: "19:00", home: "Estados Unidos", away: "Australia", venue: "Lumen Field", homeFlag: "us", awayFlag: "au" },
  { group: "D", md: 3, date: "2026-06-26", time: "02:00", home: "Turquía", away: "Estados Unidos", venue: "SoFi Stadium", homeFlag: "tr", awayFlag: "us" },
  { group: "D", md: 3, date: "2026-06-26", time: "02:00", home: "Paraguay", away: "Australia", venue: "TBD", homeFlag: "py", awayFlag: "au" },
  // Group E
  { group: "E", md: 1, date: "2026-06-14", time: "17:00", home: "Alemania", away: "Curazao", venue: "NRG Stadium", homeFlag: "de", awayFlag: "cw" },
  { group: "E", md: 1, date: "2026-06-14", time: "23:00", home: "Costa de Marfil", away: "Ecuador", venue: "Lincoln Financial Field", homeFlag: "ci", awayFlag: "ec" },
  { group: "E", md: 2, date: "2026-06-20", time: "20:00", home: "Alemania", away: "Costa de Marfil", venue: "BMO Field", homeFlag: "de", awayFlag: "ci" },
  { group: "E", md: 2, date: "2026-06-21", time: "00:00", home: "Ecuador", away: "Curazao", venue: "Arrowhead Stadium", homeFlag: "ec", awayFlag: "cw" },
  { group: "E", md: 3, date: "2026-06-25", time: "20:00", home: "Ecuador", away: "Alemania", venue: "MetLife Stadium", homeFlag: "ec", awayFlag: "de" },
  { group: "E", md: 3, date: "2026-06-25", time: "20:00", home: "Curazao", away: "Costa de Marfil", venue: "Lincoln Financial Field", homeFlag: "cw", awayFlag: "ci" },
  // Group F
  { group: "F", md: 1, date: "2026-06-14", time: "20:00", home: "Países Bajos", away: "Japón", venue: "TBD", homeFlag: "nl", awayFlag: "jp" },
  { group: "F", md: 1, date: "2026-06-15", time: "02:00", home: "Suecia", away: "Túnez", venue: "Estadio BBVA", homeFlag: "se", awayFlag: "tn" },
  { group: "F", md: 2, date: "2026-06-20", time: "04:00", home: "Túnez", away: "Japón", venue: "Estadio BBVA", homeFlag: "tn", awayFlag: "jp" },
  { group: "F", md: 2, date: "2026-06-20", time: "17:00", home: "Países Bajos", away: "Suecia", venue: "NRG Stadium", homeFlag: "nl", awayFlag: "se" },
  { group: "F", md: 3, date: "2026-06-25", time: "23:00", home: "Japón", away: "Suecia", venue: "TBD", homeFlag: "jp", awayFlag: "se" },
  { group: "F", md: 3, date: "2026-06-25", time: "23:00", home: "Túnez", away: "Países Bajos", venue: "Arrowhead Stadium", homeFlag: "tn", awayFlag: "nl" },
  // Group G
  { group: "G", md: 1, date: "2026-06-15", time: "19:00", home: "Bélgica", away: "Egipto", venue: "Lumen Field", homeFlag: "be", awayFlag: "eg" },
  { group: "G", md: 1, date: "2026-06-16", time: "01:00", home: "Irán", away: "Nueva Zelanda", venue: "SoFi Stadium", homeFlag: "ir", awayFlag: "nz" },
  { group: "G", md: 2, date: "2026-06-21", time: "19:00", home: "Bélgica", away: "Irán", venue: "SoFi Stadium", homeFlag: "be", awayFlag: "ir" },
  { group: "G", md: 2, date: "2026-06-22", time: "01:00", home: "Nueva Zelanda", away: "Egipto", venue: "BC Place", homeFlag: "nz", awayFlag: "eg" },
  { group: "G", md: 3, date: "2026-06-27", time: "03:00", home: "Egipto", away: "Irán", venue: "Lumen Field", homeFlag: "eg", awayFlag: "ir" },
  { group: "G", md: 3, date: "2026-06-27", time: "03:00", home: "Nueva Zelanda", away: "Bélgica", venue: "BC Place", homeFlag: "nz", awayFlag: "be" },
  // Group H
  { group: "H", md: 1, date: "2026-06-15", time: "16:00", home: "España", away: "Cabo Verde", venue: "Mercedes-Benz Stadium", homeFlag: "es", awayFlag: "cv" },
  { group: "H", md: 1, date: "2026-06-15", time: "22:00", home: "Arabia Saudita", away: "Uruguay", venue: "Hard Rock Stadium", homeFlag: "sa", awayFlag: "uy" },
  { group: "H", md: 2, date: "2026-06-21", time: "16:00", home: "España", away: "Arabia Saudita", venue: "Mercedes-Benz Stadium", homeFlag: "es", awayFlag: "sa" },
  { group: "H", md: 2, date: "2026-06-21", time: "22:00", home: "Uruguay", away: "Cabo Verde", venue: "Hard Rock Stadium", homeFlag: "uy", awayFlag: "cv" },
  { group: "H", md: 3, date: "2026-06-27", time: "00:00", home: "Uruguay", away: "España", venue: "Estadio Akron", homeFlag: "uy", awayFlag: "es" },
  { group: "H", md: 3, date: "2026-06-27", time: "00:00", home: "Cabo Verde", away: "Arabia Saudita", venue: "NRG Stadium", homeFlag: "cv", awayFlag: "sa" },
  // Group I
  { group: "I", md: 1, date: "2026-06-16", time: "19:00", home: "Francia", away: "Senegal", venue: "MetLife Stadium", homeFlag: "fr", awayFlag: "sn" },
  { group: "I", md: 1, date: "2026-06-16", time: "22:00", home: "Irak", away: "Noruega", venue: "TBD", homeFlag: "iq", awayFlag: "no" },
  { group: "I", md: 2, date: "2026-06-22", time: "21:00", home: "Francia", away: "Irak", venue: "TBD", homeFlag: "fr", awayFlag: "iq" },
  { group: "I", md: 2, date: "2026-06-23", time: "00:00", home: "Noruega", away: "Senegal", venue: "MetLife Stadium", homeFlag: "no", awayFlag: "sn" },
  { group: "I", md: 3, date: "2026-06-26", time: "19:00", home: "Senegal", away: "Irak", venue: "TBD", homeFlag: "sn", awayFlag: "iq" },
  { group: "I", md: 3, date: "2026-06-26", time: "19:00", home: "Noruega", away: "Francia", venue: "Gillette Stadium", homeFlag: "no", awayFlag: "fr" },
  // Group J
  { group: "J", md: 1, date: "2026-06-16", time: "04:00", home: "Austria", away: "Jordania", venue: "TBD", homeFlag: "at", awayFlag: "jo" },
  { group: "J", md: 1, date: "2026-06-17", time: "01:00", home: "Argentina", away: "Argelia", venue: "Arrowhead Stadium", homeFlag: "ar", awayFlag: "dz" },
  { group: "J", md: 2, date: "2026-06-22", time: "17:00", home: "Argentina", away: "Austria", venue: "TBD", homeFlag: "ar", awayFlag: "at" },
  { group: "J", md: 2, date: "2026-06-23", time: "03:00", home: "Jordania", away: "Argelia", venue: "TBD", homeFlag: "jo", awayFlag: "dz" },
  { group: "J", md: 3, date: "2026-06-28", time: "02:00", home: "Argelia", away: "Austria", venue: "Arrowhead Stadium", homeFlag: "dz", awayFlag: "at" },
  { group: "J", md: 3, date: "2026-06-28", time: "02:00", home: "Jordania", away: "Argentina", venue: "TBD", homeFlag: "jo", awayFlag: "ar" },
  // Group K
  { group: "K", md: 1, date: "2026-06-17", time: "17:00", home: "Portugal", away: "Congo DR", venue: "NRG Stadium", homeFlag: "pt", awayFlag: "cd" },
  { group: "K", md: 1, date: "2026-06-18", time: "02:00", home: "Uzbekistán", away: "Colombia", venue: "Estadio Azteca", homeFlag: "uz", awayFlag: "co" },
  { group: "K", md: 2, date: "2026-06-23", time: "17:00", home: "Portugal", away: "Uzbekistán", venue: "NRG Stadium", homeFlag: "pt", awayFlag: "uz" },
  { group: "K", md: 2, date: "2026-06-24", time: "02:00", home: "Colombia", away: "Congo DR", venue: "Estadio Akron", homeFlag: "co", awayFlag: "cd" },
  { group: "K", md: 3, date: "2026-06-27", time: "23:30", home: "Colombia", away: "Portugal", venue: "Hard Rock Stadium", homeFlag: "co", awayFlag: "pt" },
  { group: "K", md: 3, date: "2026-06-27", time: "23:30", home: "Congo DR", away: "Uzbekistán", venue: "Mercedes-Benz Stadium", homeFlag: "cd", awayFlag: "uz" },
  // Group L
  { group: "L", md: 1, date: "2026-06-17", time: "20:00", home: "Inglaterra", away: "Croacia", venue: "TBD", homeFlag: "gb-eng", awayFlag: "hr" },
  { group: "L", md: 1, date: "2026-06-17", time: "23:00", home: "Ghana", away: "Panamá", venue: "BMO Field", homeFlag: "gh", awayFlag: "pa" },
  { group: "L", md: 2, date: "2026-06-23", time: "20:00", home: "Inglaterra", away: "Ghana", venue: "Gillette Stadium", homeFlag: "gb-eng", awayFlag: "gh" },
  { group: "L", md: 2, date: "2026-06-23", time: "23:00", home: "Panamá", away: "Croacia", venue: "BMO Field", homeFlag: "pa", awayFlag: "hr" },
  { group: "L", md: 3, date: "2026-06-27", time: "21:00", home: "Croacia", away: "Ghana", venue: "Lincoln Financial Field", homeFlag: "hr", awayFlag: "gh" },
  { group: "L", md: 3, date: "2026-06-27", time: "21:00", home: "Panamá", away: "Inglaterra", venue: "MetLife Stadium", homeFlag: "pa", awayFlag: "gb-eng" },
];

// ── Knockout rounds ──────────────────────────────────────────

interface KnockoutRound {
  titleKey: string;
  datesKey: string;
  matchCountKey: string;
  matchCount: number;
}

const KNOCKOUT_ROUNDS: KnockoutRound[] = [
  { titleKey: "roundOf32Title", datesKey: "roundOf32Dates", matchCountKey: "roundOf32Matches", matchCount: 16 },
  { titleKey: "roundOf16Title", datesKey: "roundOf16Dates", matchCountKey: "roundOf16Matches", matchCount: 8 },
  { titleKey: "quarterFinalsTitle", datesKey: "quarterFinalsDates", matchCountKey: "quarterFinalsMatches", matchCount: 4 },
  { titleKey: "semiFinalsTitle", datesKey: "semiFinalsDates", matchCountKey: "semiFinalsMatches", matchCount: 2 },
  { titleKey: "thirdPlaceTitle", datesKey: "thirdPlaceDates", matchCountKey: "thirdPlaceMatches", matchCount: 1 },
  { titleKey: "finalTitle", datesKey: "finalDates", matchCountKey: "finalMatches", matchCount: 1 },
];

// ── Helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const months: Record<string, string[]> = {
    es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  };
  const ml = months[locale] || months.es;
  return `${d} ${ml[date.getUTCMonth()]} ${y}`;
}

function flagUrl(code: string): string {
  return `https://flagcdn.com/24x18/${code}.png`;
}

function groupMatchesByGroup(matches: GroupMatch[]): Record<string, GroupMatch[]> {
  const result: Record<string, GroupMatch[]> = {};
  for (const m of matches) {
    if (!result[m.group]) result[m.group] = [];
    result[m.group].push(m);
  }
  return result;
}

// ── Phase Tab Anchors ────────────────────────────────────────

const PHASES = [
  { key: "groupStage", anchor: "#groups" },
  { key: "roundOf32", anchor: "#knockout" },
  { key: "roundOf16", anchor: "#knockout" },
  { key: "quarterFinals", anchor: "#knockout" },
  { key: "semiFinals", anchor: "#knockout" },
  { key: "final", anchor: "#knockout" },
] as const;

// ── Page Component ───────────────────────────────────────────

export default async function CalendarioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("worldCup.schedule");

  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;
  const paths: Record<string, string> = {
    es: "/mundial-2026/calendario",
    en: "/world-cup-2026/schedule",
    pt: "/copa-do-mundo-2026/calendario",
  };
  const worldCupPaths: Record<string, string> = {
    es: "/mundial-2026",
    en: "/world-cup-2026",
    pt: "/copa-do-mundo-2026",
  };

  const grouped = groupMatchesByGroup(GROUP_MATCHES);
  const groups = Object.keys(grouped).sort();

  // Build a sequential match number for knockout
  let knockoutMatchNum = 73;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("breadcrumbs.home"), url: `${baseUrl}${localePath}` },
          { name: t("breadcrumbs.worldCup"), url: `${baseUrl}${localePath}${worldCupPaths[locale]}` },
          { name: t("breadcrumbs.schedule"), url: `${baseUrl}${localePath}${paths[locale]}` },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: "FIFA World Cup 2026",
          description: t("hero.subtitle"),
          startDate: "2026-06-11",
          endDate: "2026-07-19",
          location: {
            "@type": "Place",
            name: "Multiple venues — USA, Mexico, Canada",
          },
          organizer: {
            "@type": "Organization",
            name: "FIFA",
          },
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

          {/* Phase filter tabs */}
          <nav
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 8,
              padding: "24px 20px",
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            {PHASES.map((phase) => (
              <a
                key={phase.key}
                href={phase.anchor}
                style={{
                  padding: "8px 18px",
                  borderRadius: 20,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {t(`phases.${phase.key}`)}
              </a>
            ))}
          </nav>

          {/* Group Stage */}
          <section
            id="groups"
            style={{
              padding: "60px 20px",
              maxWidth: 1100,
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: 8,
                color: "var(--text)",
                textAlign: "center",
              }}
            >
              {t("groupStage.title")}
            </h2>
            <p
              style={{
                textAlign: "center",
                color: "var(--muted)",
                marginBottom: 48,
                fontSize: "1.05rem",
              }}
            >
              {t("groupStage.subtitle")}
            </p>

            {groups.map((group) => {
              const matches = grouped[group];
              const matchdays = [1, 2, 3];
              return (
                <div key={group} style={{ marginBottom: 48 }}>
                  <h3
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: 20,
                      paddingBottom: 8,
                      borderBottom: "2px solid var(--border)",
                    }}
                  >
                    {t("groupStage.group", { letter: group })}
                  </h3>

                  {matchdays.map((md) => {
                    const mdMatches = matches.filter((m) => m.md === md);
                    if (mdMatches.length === 0) return null;
                    return (
                      <div key={md} style={{ marginBottom: 24 }}>
                        <h4
                          style={{
                            fontSize: "1rem",
                            fontWeight: 600,
                            color: "var(--muted)",
                            marginBottom: 12,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {t("groupStage.matchday", { number: String(md) })}
                        </h4>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {mdMatches.map((match, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: 12,
                                padding: "14px 20px",
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                flexWrap: "wrap",
                              }}
                            >
                              {/* Date & time */}
                              <div
                                style={{
                                  minWidth: 140,
                                  fontSize: "0.85rem",
                                  color: "var(--muted)",
                                  fontWeight: 500,
                                }}
                              >
                                {formatDate(match.date, locale)}, {match.time} {t("utc")}
                              </div>

                              {/* Teams */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  flex: 1,
                                  minWidth: 260,
                                  justifyContent: "center",
                                }}
                              >
                                {/* Home */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flex: 1,
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.95rem" }}>
                                    {match.home}
                                  </span>
                                  <img
                                    src={flagUrl(match.homeFlag)}
                                    alt={match.home}
                                    width={24}
                                    height={18}
                                    style={{ borderRadius: 2, flexShrink: 0 }}
                                    loading="lazy"
                                  />
                                </div>

                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: "var(--muted)",
                                    fontSize: "0.8rem",
                                    padding: "2px 8px",
                                    background: "var(--bg)",
                                    borderRadius: 4,
                                  }}
                                >
                                  {t("vs")}
                                </span>

                                {/* Away */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flex: 1,
                                  }}
                                >
                                  <img
                                    src={flagUrl(match.awayFlag)}
                                    alt={match.away}
                                    width={24}
                                    height={18}
                                    style={{ borderRadius: 2, flexShrink: 0 }}
                                    loading="lazy"
                                  />
                                  <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.95rem" }}>
                                    {match.away}
                                  </span>
                                </div>
                              </div>

                              {/* Venue */}
                              <div
                                style={{
                                  minWidth: 160,
                                  fontSize: "0.8rem",
                                  color: "var(--muted)",
                                  textAlign: "right",
                                }}
                              >
                                {match.venue}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </section>

          {/* Knockout Stage */}
          <section
            id="knockout"
            style={{
              padding: "60px 20px",
              maxWidth: 1100,
              margin: "0 auto",
              borderTop: "1px solid var(--border)",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: 8,
                color: "var(--text)",
                textAlign: "center",
              }}
            >
              {t("knockout.title")}
            </h2>
            <p
              style={{
                textAlign: "center",
                color: "var(--muted)",
                marginBottom: 48,
                fontSize: "1.05rem",
              }}
            >
              {t("knockout.subtitle")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
              {KNOCKOUT_ROUNDS.map((round) => {
                const matchNumbers: number[] = [];
                for (let i = 0; i < round.matchCount; i++) {
                  matchNumbers.push(knockoutMatchNum++);
                }

                return (
                  <div key={round.titleKey}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 16,
                        marginBottom: 16,
                        flexWrap: "wrap",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "1.3rem",
                          fontWeight: 700,
                          color: "var(--text)",
                          margin: 0,
                        }}
                      >
                        {t(`knockout.${round.titleKey}`)}
                      </h3>
                      <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                        {t(`knockout.${round.datesKey}`)} — {t(`knockout.${round.matchCountKey}`)}
                      </span>
                    </div>

                    {round.titleKey === "finalTitle" && (
                      <p
                        style={{
                          color: "var(--muted)",
                          fontSize: "0.9rem",
                          marginBottom: 12,
                          marginTop: -8,
                        }}
                      >
                        {t("knockout.finalVenue")}
                      </p>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                        gap: 10,
                      }}
                    >
                      {matchNumbers.map((num) => (
                        <div
                          key={num}
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            padding: "16px 20px",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--muted)",
                              marginBottom: 8,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {t("knockout.match", { number: String(num) })}
                          </div>
                          <div
                            style={{
                              fontSize: "1rem",
                              fontWeight: 600,
                              color: "var(--text)",
                              opacity: 0.6,
                            }}
                          >
                            {t("knockout.tbd")} {t("vs")} {t("knockout.tbd")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Key Dates */}
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
                {t("keyDates.title")}
              </h2>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {(
                  [
                    "groupStage",
                    "roundOf32",
                    "roundOf16",
                    "quarterFinals",
                    "semiFinals",
                    "thirdPlace",
                    "final",
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
                      fontWeight: key === "final" ? 700 : 500,
                    }}
                  >
                    {t(`keyDates.${key}`)}
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
