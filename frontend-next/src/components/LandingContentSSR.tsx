/**
 * Server-rendered fallback for the landing page.
 *
 * The interactive `LandingContent` is a client component (uses
 * `useSearchParams`, `useState`, a live countdown, `useIsMobile`,
 * `useAuthPanel`, etc.). To keep the page statically prerenderable
 * we wrap it in `<Suspense>`, but a `fallback={null}` meant the
 * initial HTML had no headings or copy — Google indexed the URL but
 * couldn't see the content, hurting ranking.
 *
 * This component renders the SEO-critical structure of the page
 * server-side: every `<h1>`, `<h2>`, paragraph, feature card title,
 * step label, pricing card, tournament name. It uses `getTranslations`
 * from next-intl/server so it stays an async server component, with
 * the same translations the client version uses. When React hydrates
 * the client `LandingContent`, this fallback is replaced — but Google
 * (and any visitor with slow JS) sees the content immediately.
 *
 * Styling intentionally stays simple: no `isMobile` branches, no
 * client hooks, no live timers. The countdown is rendered as static
 * placeholders ("--"). Layout uses the desktop variant of the styles
 * because that conveys the full content; the client version replaces
 * it with the proper responsive version on hydration.
 */
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TOURNAMENT_CATALOG } from "@/lib/tournamentCatalog";
import { DEFAULT_REGION, getPoolTermParams } from "@/lib/poolTerms";
import { colors } from "@/lib/theme";
import { BRAND } from "@/lib/brand";
import { WORLD_CUP_FOCUS } from "@/lib/siteConfig";

interface Props {
  locale: string;
}

export async function LandingContentSSR({ locale }: Props) {
  const t = await getTranslations("landing");
  const useWorldCupCopy = WORLD_CUP_FOCUS && locale === "es";
  // Crawlers don't have an IP geolocation we can use — render the
  // pool term placeholders with the default region so headings and
  // descriptions still substitute their {term} / {plural} tokens with
  // a sensible canonical (Colombia/Quiniela for ES, etc.).
  const poolParams = getPoolTermParams(locale, DEFAULT_REGION);

  const strongTag = (chunks: React.ReactNode) => (
    <strong style={{ color: "var(--text)" }}>{chunks}</strong>
  );

  return (
    <div style={{ background: "var(--bg)" }}>
      {/* Hero */}
      <section
        style={{
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          color: "white",
          padding: "80px 40px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 48,
          }}
        >
          <div style={{ flex: "1 0 320px" }}>
            <h1
              style={{
                fontSize: "3rem",
                fontWeight: 800,
                marginBottom: 16,
                lineHeight: 1.2,
              }}
            >
              {t("hero.title")}
            </h1>
            <p
              style={{
                fontSize: "1.15rem",
                color: "rgba(255,255,255,0.75)",
                marginBottom: 12,
                lineHeight: 1.6,
                maxWidth: 550,
              }}
            >
              {t("hero.subtitle", poolParams)}
            </p>
            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                marginTop: 32,
              }}
            >
              {/* CTAs render as anchors during SSR so a no-JS visitor
                  still has a working "Crear cuenta" link. The client
                  component replaces this with the in-page auth panel
                  on hydration. */}
              <Link
                href="/login"
                style={{
                  background: "white",
                  color: "#1a1a1a",
                  padding: "16px 32px",
                  borderRadius: 8,
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {t(useWorldCupCopy ? "hero.ctaWorldCup" : "hero.cta")}
              </Link>
              <Link
                href={useWorldCupCopy ? "/mundial-2026" : "/como-funciona"}
                style={{
                  background: "transparent",
                  color: "white",
                  border: "2px solid rgba(255,255,255,0.5)",
                  padding: "14px 30px",
                  borderRadius: 8,
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {t(useWorldCupCopy ? "hero.secondaryCtaWorldCup" : "hero.secondaryCta")}
              </Link>
            </div>
          </div>

          <div
            style={{
              flex: "0 0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
            }}
          >
            <p
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.7)",
                textTransform: "uppercase",
                letterSpacing: 1.5,
                margin: 0,
              }}
            >
              {t("hero.countdownTitle")}
            </p>
            {/* Static countdown skeleton — the live timer ticks on the
                client component once it hydrates. Google sees the
                labels (Días / Horas / Minutos / Segundos) which are
                what matters for indexing. */}
            <div style={{ display: "flex", gap: 14 }}>
              {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
                <div
                  key={unit}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 10,
                      width: 68,
                      height: 68,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: "1.9rem", fontWeight: 800, color: "white" }}>
                      --
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.5)",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {t(`hero.${unit}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What is Picks4All? */}
      <section
        style={{
          padding: "64px 40px",
          maxWidth: 900,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 16, color: "var(--text)" }}>
          {t("whatIs.title")}
        </h2>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "1.05rem",
            lineHeight: 1.7,
            maxWidth: 750,
            margin: "0 auto 16px",
          }}
        >
          {t.rich(useWorldCupCopy ? "whatIs.p1WorldCup" : "whatIs.p1", { strong: strongTag })}
        </p>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "1.05rem",
            lineHeight: 1.7,
            maxWidth: 750,
            margin: "0 auto",
          }}
        >
          {t.rich("whatIs.p2", { strong: strongTag, ...poolParams })}
        </p>
      </section>

      {/* Features */}
      <section style={{ padding: "64px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: "2.25rem",
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--text)",
          }}
        >
          {t("features.title")}
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "var(--muted)",
            marginBottom: 48,
            fontSize: "1.1rem",
            maxWidth: 600,
            margin: "0 auto 48px",
          }}
        >
          {t("features.subtitle", poolParams)}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
            gap: 24,
          }}
        >
          {[
            { title: t("feature1.title", poolParams), description: t("feature1.description", poolParams) },
            { title: t("feature2.title"), description: t("feature2.description") },
            { title: t("feature3.title"), description: t("feature3.description") },
            { title: t("feature4.title"), description: t("feature4.description") },
            { title: t("feature5.title"), description: t("feature5.description") },
            { title: t("feature6.title"), description: t("feature6.description") },
            { title: t("feature7.title"), description: t("feature7.description", poolParams) },
            { title: t("feature8.title"), description: t("feature8.description") },
          ].map((f, i) => (
            <div
              key={i}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 28,
              }}
            >
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  marginBottom: 8,
                  color: "var(--text)",
                }}
              >
                {f.title}
              </h3>
              <p style={{ color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: "var(--surface)", padding: "80px 40px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2
            style={{
              textAlign: "center",
              fontSize: "2.25rem",
              fontWeight: 700,
              marginBottom: 48,
              color: "var(--text)",
            }}
          >
            {t("howItWorks.title")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
              gap: 32,
            }}
          >
            {[
              { number: 1, title: t("step1.title"), description: t("step1.description", poolParams) },
              { number: 2, title: t("step2.title"), description: t("step2.description") },
              { number: 3, title: t("step3.title"), description: t("step3.description") },
            ].map((s) => (
              <div key={s.number} style={{ textAlign: "center" }}>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    marginBottom: 8,
                    color: "var(--text)",
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: "2.25rem",
            fontWeight: 700,
            marginBottom: 12,
            color: "var(--text)",
          }}
        >
          {t("pricing.title")}
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "var(--muted)",
            marginBottom: 48,
            fontSize: "1.1rem",
          }}
        >
          {t("pricing.subtitle")}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
            gap: 24,
          }}
        >
          <PricingCard
            title={t("pricing.personal.title")}
            badge={t("pricing.personal.badge")}
            badgeColor={colors.successAlt}
            badgeBg={colors.successBgLight}
            subtitle={t("pricing.personal.subtitle")}
            features={[
              t("pricing.features.liveResults"),
              t("pricing.features.scoringModes"),
              t("pricing.features.autoResults"),
              t("pricing.features.emailNotifications"),
              t("pricing.features.multiTournament"),
              t("pricing.features.inviteByLink"),
              t("pricing.features.mobileOptimized"),
            ]}
          />
          <PricingCard
            title={t("pricing.personalPro.title")}
            badge={t("pricing.personalPro.badgeCop")}
            badgeColor={colors.brand}
            badgeBg="#e0e7ff"
            subtitle={t("pricing.personalPro.subtitle")}
            features={[
              t("pricing.personalPro.includesBase"),
              t("pricing.personalPro.extraPlayers"),
            ]}
          />
          <PricingCard
            title={t("pricing.corporate.title")}
            badge={null}
            price={t("pricing.corporate.priceCop")}
            subtitle={t("pricing.corporate.subtitle")}
            features={[
              t("pricing.corporate.includesPersonal"),
              t("pricing.corporateFeatures.companyLogo"),
              t("pricing.corporateFeatures.emailInvites"),
              t("pricing.corporateFeatures.csvImport"),
              t("pricing.corporateFeatures.employeeDashboard"),
              t("pricing.corporateFeatures.brandedExperience"),
            ]}
            highlight
          />
        </div>
      </section>

      {/* Tournaments */}
      <section
        style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto", textAlign: "center" }}
      >
        <h2
          style={{
            fontSize: "2.25rem",
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--text)",
          }}
        >
          {t("tournaments.title")}
        </h2>
        <p
          style={{
            color: "var(--muted)",
            marginBottom: 40,
            fontSize: "1.1rem",
            maxWidth: 600,
            margin: "0 auto 40px",
          }}
        >
          {t("tournaments.subtitle", poolParams)}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))",
            gap: 16,
          }}
        >
          {TOURNAMENT_CATALOG.map((tournament) => (
            <div
              key={tournament.key}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 20,
                opacity: tournament.active ? 1 : 0.5,
              }}
            >
              <h3
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  margin: "0 0 6px",
                  lineHeight: 1.3,
                }}
              >
                {t(`tournaments.items.${tournament.i18nKey}.name`)}
              </h3>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {t(`tournaments.items.${tournament.i18nKey}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          background: colors.brandGradient,
          color: "white",
          padding: "80px 40px",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "2.25rem", fontWeight: 700, marginBottom: 16 }}>
          {t("final.title")}
        </h2>
        <p style={{ fontSize: "1.25rem", color: "rgba(255,255,255,0.9)", marginBottom: 12 }}>
          {t("final.subtitle")}
        </p>
        <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.75)", marginBottom: 32 }}>
          {t("final.hint", poolParams)}
        </p>
        <Link
          href="/login"
          style={{
            background: "white",
            color: BRAND.secondary,
            padding: "16px 32px",
            borderRadius: 8,
            fontSize: "1.1rem",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          {t("final.cta")}
        </Link>
      </section>
    </div>
  );
}

// Local presentational sub-component used only inside this fallback.
function PricingCard({
  title,
  badge,
  badgeColor,
  badgeBg,
  price,
  subtitle,
  features,
  highlight,
}: {
  title: string;
  badge?: string | null;
  badgeColor?: string;
  badgeBg?: string;
  price?: string;
  subtitle: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        border: highlight ? "2px solid #818cf8" : "1px solid var(--border)",
        borderRadius: 16,
        padding: 28,
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
          {title}
        </h3>
        {badge && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: badgeColor,
              background: badgeBg,
              padding: "3px 10px",
              borderRadius: 999,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {price && (
        <p style={{ fontSize: 15, fontWeight: 700, color: BRAND.primary, margin: "4px 0 4px" }}>
          {price}
        </p>
      )}
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 20px" }}>{subtitle}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {features.map((feature, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ color: colors.successAlt, fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>
              {"✓"}
            </span>
            <span style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.4 }}>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
