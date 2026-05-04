import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";
import { PredictionSubscribeButton } from "@/components/PredictionSubscribeButton";
import { ShareButtons } from "@/components/ShareButtons";
import { colors } from "@/lib/theme";
import { SITE_URL } from "@/lib/siteConfig";
import { buildPageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/brand";

/* ────────────────── Static Data ────────────────── */

interface GroupPrediction {
  teams: string[];
  flags: string[];
}

const GROUP_PREDICTIONS: Record<string, GroupPrediction> = {
  A: { teams: ["Mexico", "Rep. Checa", "Corea del Sur", "Sudafrica"], flags: ["mx", "cz", "kr", "za"] },
  B: { teams: ["Suiza", "Canada", "Bosnia", "Qatar"], flags: ["ch", "ca", "ba", "qa"] },
  C: { teams: ["Brasil", "Marruecos", "Escocia", "Haiti"], flags: ["br", "ma", "gb-sct", "ht"] },
  D: { teams: ["Estados Unidos", "Turquia", "Paraguay", "Australia"], flags: ["us", "tr", "py", "au"] },
  E: { teams: ["Alemania", "Ecuador", "Costa de Marfil", "Curazao"], flags: ["de", "ec", "ci", "cw"] },
  F: { teams: ["Paises Bajos", "Japon", "Suecia", "Tunez"], flags: ["nl", "jp", "se", "tn"] },
  G: { teams: ["Belgica", "Egipto", "Iran", "Nueva Zelanda"], flags: ["be", "eg", "ir", "nz"] },
  H: { teams: ["Espana", "Uruguay", "Arabia Saudita", "Cabo Verde"], flags: ["es", "uy", "sa", "cv"] },
  I: { teams: ["Francia", "Senegal", "Noruega", "Irak"], flags: ["fr", "sn", "no", "iq"] },
  J: { teams: ["Argentina", "Austria", "Argelia", "Jordania"], flags: ["ar", "at", "dz", "jo"] },
  K: { teams: ["Portugal", "Colombia", "Congo DR", "Uzbekistan"], flags: ["pt", "co", "cd", "uz"] },
  L: { teams: ["Inglaterra", "Croacia", "Ghana", "Panama"], flags: ["gb-eng", "hr", "gh", "pa"] },
};

/** Position labels per finishing place */
const POSITION_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32", "#94a3b8"];

interface KnockoutMatch {
  teamA: string;
  flagA: string;
  teamB: string;
  flagB: string;
  winner: string;
}

const R32_MATCHES: KnockoutMatch[] = [
  { teamA: "Mexico", flagA: "mx", teamB: "Austria", flagB: "at", winner: "Mexico" },
  { teamA: "Japon", flagA: "jp", teamB: "Corea del Sur", flagB: "kr", winner: "Japon" },
  { teamA: "Estados Unidos", flagA: "us", teamB: "Marruecos", flagB: "ma", winner: "Estados Unidos" },
  { teamA: "Belgica", flagA: "be", teamB: "Suecia", flagB: "se", winner: "Belgica" },
  { teamA: "Francia", flagA: "fr", teamB: "Croacia", flagB: "hr", winner: "Francia" },
  { teamA: "Portugal", flagA: "pt", teamB: "Noruega", flagB: "no", winner: "Portugal" },
  { teamA: "Argentina", flagA: "ar", teamB: "Egipto", flagB: "eg", winner: "Argentina" },
  { teamA: "Espana", flagA: "es", teamB: "Ecuador", flagB: "ec", winner: "Espana" },
  { teamA: "Rep. Checa", flagA: "cz", teamB: "Suiza", flagB: "ch", winner: "Suiza" },
  { teamA: "Paises Bajos", flagA: "nl", teamB: "Escocia", flagB: "gb-sct", winner: "Paises Bajos" },
  { teamA: "Alemania", flagA: "de", teamB: "Canada", flagB: "ca", winner: "Alemania" },
  { teamA: "Uruguay", flagA: "uy", teamB: "Costa de Marfil", flagB: "ci", winner: "Uruguay" },
  { teamA: "Brasil", flagA: "br", teamB: "Senegal", flagB: "sn", winner: "Brasil" },
  { teamA: "Inglaterra", flagA: "gb-eng", teamB: "Argelia", flagB: "dz", winner: "Inglaterra" },
  { teamA: "Colombia", flagA: "co", teamB: "Arabia Saudita", flagB: "sa", winner: "Colombia" },
  { teamA: "Turquia", flagA: "tr", teamB: "Ghana", flagB: "gh", winner: "Turquia" },
];

const R16_MATCHES: KnockoutMatch[] = [
  { teamA: "Mexico", flagA: "mx", teamB: "Japon", flagB: "jp", winner: "Mexico" },
  { teamA: "Estados Unidos", flagA: "us", teamB: "Belgica", flagB: "be", winner: "Belgica" },
  { teamA: "Francia", flagA: "fr", teamB: "Portugal", flagB: "pt", winner: "Francia" },
  { teamA: "Argentina", flagA: "ar", teamB: "Espana", flagB: "es", winner: "Argentina" },
  { teamA: "Suiza", flagA: "ch", teamB: "Paises Bajos", flagB: "nl", winner: "Paises Bajos" },
  { teamA: "Alemania", flagA: "de", teamB: "Uruguay", flagB: "uy", winner: "Alemania" },
  { teamA: "Brasil", flagA: "br", teamB: "Inglaterra", flagB: "gb-eng", winner: "Brasil" },
  { teamA: "Colombia", flagA: "co", teamB: "Turquia", flagB: "tr", winner: "Colombia" },
];

const QF_MATCHES: KnockoutMatch[] = [
  { teamA: "Mexico", flagA: "mx", teamB: "Belgica", flagB: "be", winner: "Belgica" },
  { teamA: "Francia", flagA: "fr", teamB: "Argentina", flagB: "ar", winner: "Argentina" },
  { teamA: "Paises Bajos", flagA: "nl", teamB: "Alemania", flagB: "de", winner: "Alemania" },
  { teamA: "Brasil", flagA: "br", teamB: "Colombia", flagB: "co", winner: "Brasil" },
];

const SF_MATCHES: KnockoutMatch[] = [
  { teamA: "Belgica", flagA: "be", teamB: "Argentina", flagB: "ar", winner: "Argentina" },
  { teamA: "Alemania", flagA: "de", teamB: "Brasil", flagB: "br", winner: "Brasil" },
];

const FINAL_MATCH: KnockoutMatch = {
  teamA: "Argentina",
  flagA: "ar",
  teamB: "Brasil",
  flagB: "br",
  winner: "Argentina",
};

/* ────────────────── Metadata ────────────────── */

const PUBLISHED_AT = "2026-04-04T00:00:00Z";
const MODIFIED_AT = "2026-04-16T00:00:00Z";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("seo");
  return buildPageMetadata({
    locale,
    title: t("worldCupPredictions.title"),
    description: t("worldCupPredictions.description"),
    path: {
      es: "/mundial-2026/predicciones",
      en: "/world-cup-2026/predictions",
      pt: "/copa-do-mundo-2026/previsoes",
    },
    type: "article",
    article: { publishedTime: PUBLISHED_AT, modifiedTime: MODIFIED_AT },
  });
}

/* ────────────────── Helper Components ────────────────── */

function TeamRow({
  name,
  flag,
  position,
  isWinner,
  tPosition,
}: {
  name: string;
  flag: string;
  position: number;
  isWinner?: boolean;
  tPosition: string;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 8,
        background: isWinner ? "rgba(79, 70, 229, 0.06)" : "transparent",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: POSITION_COLORS[position] || colors.borderLight,
          color: position < 2 ? "#1a1a1a" : colors.white,
          fontSize: "0.7rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
        title={tPosition}
      >
        {position + 1}
      </span>
      <img
        src={`https://flagcdn.com/w40/${flag}.png`}
        alt={name}
        width={24}
        height={16}
        style={{ borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
        loading="lazy"
      />
      <span
        style={{
          fontSize: "0.9rem",
          fontWeight: position < 2 ? 600 : 400,
          color: "var(--text)",
        }}
      >
        {name}
      </span>
      {position < 2 && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.65rem",
            fontWeight: 600,
            color: BRAND.primary,
            background: `${BRAND.primary}14`,
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          Q
        </span>
      )}
    </li>
  );
}

function KnockoutMatchCard({
  match,
  roundLabel,
}: {
  match: KnockoutMatch;
  roundLabel?: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {roundLabel && (
        <div
          style={{
            fontSize: "0.65rem",
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "var(--muted)",
            fontWeight: 600,
          }}
        >
          {roundLabel}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <img
          src={`https://flagcdn.com/w40/${match.flagA}.png`}
          alt={match.teamA}
          width={20}
          height={14}
          style={{ borderRadius: 2, objectFit: "cover" }}
          loading="lazy"
        />
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: match.winner === match.teamA ? 700 : 400,
            color: match.winner === match.teamA ? "var(--text)" : "var(--muted)",
            flex: 1,
          }}
        >
          {match.teamA}
        </span>
        {match.winner === match.teamA && (
          <span style={{ color: BRAND.primary, fontSize: "0.75rem", fontWeight: 700 }}>W</span>
        )}
      </div>
      <div
        style={{
          height: 1,
          background: "var(--border)",
          margin: "0 4px",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <img
          src={`https://flagcdn.com/w40/${match.flagB}.png`}
          alt={match.teamB}
          width={20}
          height={14}
          style={{ borderRadius: 2, objectFit: "cover" }}
          loading="lazy"
        />
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: match.winner === match.teamB ? 700 : 400,
            color: match.winner === match.teamB ? "var(--text)" : "var(--muted)",
            flex: 1,
          }}
        >
          {match.teamB}
        </span>
        {match.winner === match.teamB && (
          <span style={{ color: BRAND.primary, fontSize: "0.75rem", fontWeight: 700 }}>W</span>
        )}
      </div>
    </div>
  );
}

/* ────────────────── Page Component ────────────────── */

export default async function PredictionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("worldCup");
  const baseUrl = SITE_URL;
  const localePath = locale === "es" ? "" : `/${locale}`;
  const pathMap: Record<string, string> = {
    es: "/mundial-2026/predicciones",
    en: "/world-cup-2026/predictions",
    pt: "/copa-do-mundo-2026/previsoes",
  };
  const pagePath = pathMap[locale] || pathMap.es;
  const wcPathMap: Record<string, string> = {
    es: "/mundial-2026",
    en: "/world-cup-2026",
    pt: "/copa-do-mundo-2026",
  };
  const wcPath = wcPathMap[locale] || wcPathMap.es;

  const bestThirds = [
    { team: t("predictions.bestThirds.team1"), flag: "kr" },
    { team: t("predictions.bestThirds.team2"), flag: "gb-sct" },
    { team: t("predictions.bestThirds.team3"), flag: "ci" },
    { team: t("predictions.bestThirds.team4"), flag: "se" },
    { team: t("predictions.bestThirds.team5"), flag: "sa" },
    { team: t("predictions.bestThirds.team6"), flag: "no" },
    { team: t("predictions.bestThirds.team7"), flag: "dz" },
    { team: t("predictions.bestThirds.team8"), flag: "gh" },
  ];

  return (
    <>
      <Breadcrumbs
        items={[
          { name: t("predictions.breadcrumbs.home"), url: `${baseUrl}${localePath}` },
          {
            name: t("predictions.breadcrumbs.worldCup"),
            url: `${baseUrl}${localePath}${wcPath}`,
          },
          {
            name: t("predictions.breadcrumbs.predictions"),
            url: `${baseUrl}${localePath}${pagePath}`,
          },
        ]}
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: t("predictions.hero.title"),
          datePublished: "2026-04-04",
          dateModified: "2026-04-04",
          author: {
            "@type": "Organization",
            name: "Picks4All",
            url: baseUrl,
          },
          publisher: {
            "@type": "Organization",
            name: "Picks4All",
            url: baseUrl,
          },
          description: t("predictions.hero.subtitle"),
          mainEntityOfPage: `${baseUrl}${localePath}${pagePath}`,
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
            <div
              style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.18)",
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: "0.8rem",
                fontWeight: 600,
                letterSpacing: 0.5,
                marginBottom: 20,
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {t("predictions.hero.badge")}
            </div>
            <h1
              style={{
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: 800,
                marginBottom: 16,
                lineHeight: 1.1,
              }}
            >
              {t("predictions.hero.title")}
            </h1>
            <p
              style={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.9)",
                maxWidth: 720,
                margin: "0 auto",
                lineHeight: 1.7,
              }}
            >
              {t("predictions.hero.subtitle")}
            </p>

            {/* Hero action buttons */}
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
                marginTop: 32,
              }}
            >
              <a
                href="#champion"
                style={{
                  background: "white",
                  color: "#1a1a1a",
                  padding: "14px 28px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: "1rem",
                  textDecoration: "none",
                  border: "none",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                }}
              >
                🏆 {t("predictions.hero.seePrediction")}
              </a>
              <a
                href="#methodology"
                style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  padding: "14px 28px",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: "1rem",
                  textDecoration: "none",
                  border: "2px solid rgba(255,255,255,0.5)",
                }}
              >
                {t("predictions.hero.seeMethodology")}
              </a>
            </div>

            {/* Subscription pitch in hero */}
            <div
              style={{
                marginTop: 48,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 16,
                padding: "20px 28px",
                maxWidth: 600,
                marginLeft: "auto",
                marginRight: "auto",
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: "1.2rem" }}>🤖</span>
                <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                  {t("predictions.hero.subscribePitch.title")}
                </span>
              </div>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.6,
                  marginBottom: 0,
                }}
              >
                {t("predictions.hero.subscribePitch.desc")}
              </p>
              <a
                href="#subscribe"
                style={{
                  display: "inline-block",
                  marginTop: 14,
                  background: "white",
                  color: "#1a1a1a",
                  padding: "10px 24px",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  textDecoration: "none",
                }}
              >
                {t("predictions.hero.subscribePitch.cta")}
              </a>
            </div>
          </section>

          {/* ═══════════ CHAMPION REVEAL ═══════════ */}
          <section
            id="champion"
            style={{
              padding: "80px 24px",
              maxWidth: 900,
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            {/* The Final */}
            <div
              style={{
                background: "var(--surface)",
                border: `2px solid ${BRAND.primary}`,
                borderRadius: 20,
                padding: "32px 24px",
                maxWidth: 500,
                margin: "0 auto 32px",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  color: BRAND.primary,
                  marginBottom: 16,
                }}
              >
                {t("predictions.knockout.final")}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 24,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <img
                    src={`https://flagcdn.com/w80/${FINAL_MATCH.flagA}.png`}
                    alt={FINAL_MATCH.teamA}
                    width={56}
                    height={37}
                    style={{ borderRadius: 4, objectFit: "cover", marginBottom: 8 }}
                  />
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "1rem",
                      color: "var(--text)",
                    }}
                  >
                    {t("predictions.knockout.finalTeamA")}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 300,
                    color: "var(--muted)",
                  }}
                >
                  vs
                </span>
                <div style={{ textAlign: "center" }}>
                  <img
                    src={`https://flagcdn.com/w80/${FINAL_MATCH.flagB}.png`}
                    alt={FINAL_MATCH.teamB}
                    width={56}
                    height={37}
                    style={{ borderRadius: 4, objectFit: "cover", marginBottom: 8 }}
                  />
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "1rem",
                      color: "var(--text)",
                    }}
                  >
                    {t("predictions.knockout.finalTeamB")}
                  </div>
                </div>
              </div>
            </div>

            {/* Champion card */}
            <div
              style={{
                background: "var(--surface)",
                border: `3px solid #FFD700`,
                borderRadius: 20,
                padding: "32px 24px",
                maxWidth: 500,
                margin: "0 auto",
                boxShadow: "0 8px 32px rgba(255,215,0,0.2)",
              }}
            >
              <div
                style={{
                  fontSize: "2.5rem",
                  marginBottom: 8,
                }}
                aria-hidden="true"
              >
                🏆
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  color: "#b8860b",
                  marginBottom: 10,
                }}
              >
                {t("predictions.champion.label")}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16 }}>
                <img
                  src="https://flagcdn.com/w80/ar.png"
                  alt="Argentina"
                  width={52}
                  height={35}
                  style={{ borderRadius: 4, objectFit: "cover" }}
                />
                <span
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 800,
                    color: "var(--text)",
                  }}
                >
                  {t("predictions.champion.team")}
                </span>
              </div>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  marginBottom: 16,
                }}
              >
                {t("predictions.champion.reasoning")}
              </p>
              {/* Share buttons inline with champion */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <ShareButtons
                  context="predictions"
                  url={`${baseUrl}${localePath}${pagePath}`}
                  size="sm"
                />
              </div>
            </div>
          </section>

          {/* ═══════════ SUBSCRIBE CTA ═══════════ */}
          <section id="subscribe" style={{ padding: "0 24px 60px", maxWidth: 900, margin: "0 auto" }}>
            <PredictionSubscribeButton />
          </section>

          {/* ═══════════ KNOCKOUT BRACKET ═══════════ */}
          <section
            style={{
              background: "var(--surface)",
              padding: "80px 24px",
            }}
          >
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <h2
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  marginBottom: 12,
                  color: "var(--text)",
                  textAlign: "center",
                }}
              >
                {t("predictions.knockout.title")}
              </h2>
              <p
                style={{
                  color: "var(--muted)",
                  textAlign: "center",
                  maxWidth: 700,
                  margin: "0 auto 48px",
                  lineHeight: 1.7,
                }}
              >
                {t("predictions.knockout.subtitle")}
              </p>

              {/* Round of 32 */}
              <h3
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 16,
                  paddingBottom: 8,
                  borderBottom: `2px solid ${BRAND.primary}`,
                  display: "inline-block",
                }}
              >
                {t("predictions.knockout.r32")}
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 12,
                  marginBottom: 48,
                }}
              >
                {R32_MATCHES.map((m, i) => (
                  <KnockoutMatchCard key={i} match={m} />
                ))}
              </div>

              {/* Round of 16 */}
              <h3
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 16,
                  paddingBottom: 8,
                  borderBottom: `2px solid ${BRAND.primary}`,
                  display: "inline-block",
                }}
              >
                {t("predictions.knockout.r16")}
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 12,
                  marginBottom: 48,
                }}
              >
                {R16_MATCHES.map((m, i) => (
                  <KnockoutMatchCard key={i} match={m} />
                ))}
              </div>

              {/* Quarter Finals */}
              <h3
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 16,
                  paddingBottom: 8,
                  borderBottom: `2px solid ${BRAND.primary}`,
                  display: "inline-block",
                }}
              >
                {t("predictions.knockout.qf")}
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 12,
                  marginBottom: 48,
                }}
              >
                {QF_MATCHES.map((m, i) => (
                  <KnockoutMatchCard key={i} match={m} />
                ))}
              </div>

              {/* Semi Finals */}
              <h3
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 16,
                  paddingBottom: 8,
                  borderBottom: `2px solid ${BRAND.primary}`,
                  display: "inline-block",
                }}
              >
                {t("predictions.knockout.sf")}
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 16,
                  marginBottom: 48,
                }}
              >
                {SF_MATCHES.map((m, i) => (
                  <KnockoutMatchCard key={i} match={m} />
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════ GROUP STAGE PREDICTIONS ═══════════ */}
          <section
            style={{
              background: "var(--surface)",
              padding: "80px 24px",
            }}
          >
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <h2
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  marginBottom: 12,
                  color: "var(--text)",
                  textAlign: "center",
                }}
              >
                {t("predictions.groups.title")}
              </h2>
              <p
                style={{
                  color: "var(--muted)",
                  textAlign: "center",
                  maxWidth: 700,
                  margin: "0 auto 40px",
                  lineHeight: 1.7,
                }}
              >
                {t("predictions.groups.subtitle")}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 16,
                }}
              >
                {Object.entries(GROUP_PREDICTIONS).map(([letter, group]) => (
                  <div
                    key={letter}
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 16,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: colors.brandGradient,
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          color: "white",
                          fontWeight: 700,
                          fontSize: "0.9rem",
                        }}
                      >
                        {t("predictions.groups.groupLabel")} {letter}
                      </span>
                      <span
                        style={{
                          color: "rgba(255,255,255,0.7)",
                          fontSize: "0.7rem",
                        }}
                      >
                        {t("predictions.groups.aiPick")}
                      </span>
                    </div>
                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: "8px 4px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      {group.teams.map((team, i) => (
                        <TeamRow
                          key={team}
                          name={t(`predictions.groups.teams.${letter}${i + 1}`)}
                          flag={group.flags[i]}
                          position={i}
                          isWinner={i === 0}
                          tPosition={t(`predictions.groups.pos${i + 1}`)}
                        />
                      ))}
                    </ul>
                    {/* Group analysis snippet */}
                    <div
                      style={{
                        padding: "8px 16px 14px",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <p
                        style={{
                          color: "var(--muted)",
                          fontSize: "0.78rem",
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        {t(`predictions.groups.analysis${letter}`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════ BEST THIRD-PLACE TEAMS ═══════════ */}
          <section
            style={{
              padding: "60px 24px",
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: 12,
                color: "var(--text)",
              }}
            >
              {t("predictions.bestThirds.title")}
            </h2>
            <p
              style={{
                color: "var(--muted)",
                lineHeight: 1.7,
                marginBottom: 24,
              }}
            >
              {t("predictions.bestThirds.subtitle")}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {bestThirds.map(({ team, flag }) => (
                <div
                  key={flag}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <img
                    src={`https://flagcdn.com/w40/${flag}.png`}
                    alt={team}
                    width={22}
                    height={15}
                    style={{ borderRadius: 2, objectFit: "cover" }}
                    loading="lazy"
                  />
                  <span style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text)" }}>
                    {team}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ═══════════ DETAILED ANALYSIS ═══════════ */}
          <section
            style={{
              padding: "80px 24px",
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontSize: "1.8rem",
                fontWeight: 700,
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              {t("predictions.analysis.title")}
            </h2>
            <div style={{ color: "var(--muted)", lineHeight: 1.8, fontSize: "1rem" }}>
              <p>{t("predictions.analysis.p1")}</p>
              <p>{t("predictions.analysis.p2")}</p>
              <p>{t("predictions.analysis.p3")}</p>
              <p>{t("predictions.analysis.p4")}</p>
            </div>
          </section>

          {/* ═══════════ METHODOLOGY ═══════════ */}
          <section
            id="methodology"
            style={{
              padding: "80px 24px",
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontSize: "1.8rem",
                fontWeight: 700,
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              {t("predictions.methodology.title")}
            </h2>
            <p
              style={{
                color: "var(--muted)",
                lineHeight: 1.8,
                fontSize: "1rem",
                marginBottom: 24,
              }}
            >
              {t("predictions.methodology.intro")}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 16,
                marginBottom: 32,
              }}
            >
              {(["rankings", "history", "form", "squad", "home", "h2h"] as const).map(
                (key) => (
                  <div
                    key={key}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "20px 18px",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        marginBottom: 8,
                        color: "var(--text)",
                      }}
                    >
                      {t(`predictions.methodology.${key}Title`)}
                    </h3>
                    <p
                      style={{
                        color: "var(--muted)",
                        lineHeight: 1.6,
                        fontSize: "0.88rem",
                        margin: 0,
                      }}
                    >
                      {t(`predictions.methodology.${key}Desc`)}
                    </p>
                  </div>
                ),
              )}
            </div>

            <div
              style={{
                background: `linear-gradient(135deg, ${BRAND.primary}0a, ${BRAND.secondary}0a)`,
                border: `1px solid ${BRAND.primary}30`,
                borderRadius: 12,
                padding: "20px 24px",
              }}
            >
              <p
                style={{
                  color: "var(--text)",
                  lineHeight: 1.7,
                  fontSize: "0.95rem",
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                {t("predictions.methodology.aiNote")}
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
              {t("predictions.cta.title")}
            </h2>
            <p
              style={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.9)",
                maxWidth: 650,
                margin: "0 auto 32px",
                lineHeight: 1.7,
              }}
            >
              {t("predictions.cta.description")}
            </p>
            <RegisterButton label={t("predictions.cta.button")} />
          </section>

          {/* ═══════════ DISCLAIMER ═══════════ */}
          <section
            style={{
              padding: "32px 24px",
              maxWidth: 800,
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.8rem",
                lineHeight: 1.6,
                fontStyle: "italic",
              }}
            >
              {t("predictions.disclaimer")}
            </p>
          </section>
        </div>
      </PublicPageWrapper>
    </>
  );
}
