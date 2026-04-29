"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuthPanel } from "@/contexts/AuthPanelContext";
import { usePoolTerm } from "@/contexts/PoolTermContext";
import { TOURNAMENT_CATALOG } from "@/lib/tournamentCatalog";
import { colors } from "@/lib/theme";
import { BRAND } from "@/lib/brand";
import { trackEvent } from "@/lib/analytics";
import { trackMetaEvent } from "@/lib/metaPixel";
import { getPaymentCountry } from "@/lib/api/payments";
import { WORLD_CUP_FOCUS } from "@/lib/siteConfig";

export function LandingContent() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const useWorldCupCopy = WORLD_CUP_FOCUS && locale === "es";
  const isMobile = useIsMobile();
  const { openAuthPanel } = useAuthPanel();
  const { params: poolParams } = usePoolTerm();
  const searchParams = useSearchParams();
  const [isColombia, setIsColombia] = useState(true);

  // World Cup 2026 kickoff: June 11, 2026, 18:00 UTC
  const WORLD_CUP_KICKOFF = new Date("2026-06-11T18:00:00Z").getTime();

  const calcTimeLeft = useCallback(() => {
    const diff = WORLD_CUP_KICKOFF - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [WORLD_CUP_KICKOFF]);

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [countdownReady, setCountdownReady] = useState(false);

  useEffect(() => {
    setTimeLeft(calcTimeLeft());
    setCountdownReady(true);
    const timer = setInterval(() => setTimeLeft(calcTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [calcTimeLeft]);

  // Detect country for pricing display
  useEffect(() => {
    getPaymentCountry().then((c) => setIsColombia(c === "CO")).catch(() => {});
  }, []);

  // Auto-open login panel when arriving from /login redirect (e.g. ?redirect=/dashboard)
  useEffect(() => {
    const redirectParam = searchParams.get("redirect");
    if (redirectParam) {
      openAuthPanel("login", redirectParam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const strongTag = (chunks: React.ReactNode) => (
    <strong style={{ color: "var(--text)" }}>{chunks}</strong>
  );

  return (
    <div style={{ background: "var(--bg)" }}>
      {/* Hero Section */}
      <section
        style={{
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          color: "white",
          padding: isMobile ? "48px 20px" : "80px 40px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: isMobile ? 40 : 48,
          }}
        >
          {/* Left column: text + CTAs */}
          <div style={{ flex: isMobile ? 1 : "1 0 320px", textAlign: isMobile ? "center" : "left" }}>
            <h1
              style={{
                fontSize: isMobile ? "2rem" : "3rem",
                fontWeight: 800,
                marginBottom: 16,
                lineHeight: 1.2,
              }}
            >
              {t("hero.title")}
            </h1>
            <p
              style={{
                fontSize: isMobile ? "1rem" : "1.15rem",
                color: "rgba(255,255,255,0.75)",
                marginBottom: 12,
                lineHeight: 1.6,
                maxWidth: 550,
                marginLeft: isMobile ? "auto" : undefined,
                marginRight: isMobile ? "auto" : undefined,
              }}
            >
              {t("hero.subtitle", poolParams)}
            </p>
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: isMobile ? "center" : "flex-start",
                flexWrap: "wrap",
                marginTop: 32,
              }}
            >
              <button
                onClick={() => { trackEvent("cta_clicked", { cta_text: useWorldCupCopy ? "register_world_cup" : "register", page: "landing" }); trackMetaEvent("Lead", { content_name: "register_cta" }); openAuthPanel("register"); }}
                style={{
                  background: "white",
                  color: "#1a1a1a",
                  padding: isMobile ? "14px 28px" : "16px 32px",
                  borderRadius: 8,
                  fontSize: isMobile ? "1rem" : "1.1rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-block",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {t(useWorldCupCopy ? "hero.ctaWorldCup" : "hero.cta")}
              </button>
              <Link
                href={useWorldCupCopy ? "/mundial-2026" : "/como-funciona"}
                style={{
                  background: "transparent",
                  color: "white",
                  border: "2px solid rgba(255,255,255,0.5)",
                  padding: isMobile ? "12px 26px" : "14px 30px",
                  borderRadius: 8,
                  fontSize: isMobile ? "1rem" : "1.1rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {t(useWorldCupCopy ? "hero.secondaryCtaWorldCup" : "hero.secondaryCta")}
              </Link>
            </div>
          </div>

          {/* Right column: World Cup image + countdown */}
          <div
            style={{
              flex: isMobile ? undefined : "0 0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              margin: "0 auto",
            }}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: isMobile ? 350 : 460,
                  height: isMobile ? 350 : 460,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0) 70%)",
                  filter: "blur(16px)",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
              <Image
                src="/world-cup-2026-trophy.webp"
                alt="FIFA World Cup 2026"
                width={200}
                height={147}
                style={{
                  position: "relative",
                  width: isMobile ? 210 : 285,
                  height: "auto",
                  filter: "drop-shadow(0 4px 20px rgba(255,255,255,0.2))",
                }}
                priority
              />
              {/* Custom text with gold gradient */}
              <div
                style={{
                  position: "relative",
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    fontSize: isMobile ? "0.95rem" : "1.1rem",
                    fontWeight: 800,
                    letterSpacing: 4,
                    textTransform: "uppercase",
                    background: "linear-gradient(180deg, #E8C95A 0%, #D4A84B 35%, #B8912E 65%, #96751A 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    display: "block",
                    lineHeight: 1.4,
                  }}
                >
                  {t("hero.worldCupLabel")}
                </span>
                <span
                  style={{
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    fontSize: isMobile ? "1.9rem" : "2.3rem",
                    fontWeight: 900,
                    letterSpacing: 6,
                    background: "linear-gradient(180deg, #E8C95A 0%, #D4A84B 35%, #B8912E 65%, #96751A 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    display: "block",
                    lineHeight: 1.1,
                  }}
                >
                  {t("hero.worldCupYear")}
                </span>
              </div>
            </div>
            <p
              style={{
                fontSize: isMobile ? "0.85rem" : "0.95rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.7)",
                textTransform: "uppercase",
                letterSpacing: 1.5,
                margin: 0,
              }}
            >
              {t("hero.countdownTitle")}
            </p>
            <div style={{ display: "flex", gap: isMobile ? 10 : 14 }}>
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
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 10,
                      width: isMobile ? 56 : 68,
                      height: isMobile ? 56 : 68,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: isMobile ? "1.5rem" : "1.9rem",
                        fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                        color: "white",
                      }}
                    >
                      {countdownReady ? String(timeLeft[unit]).padStart(2, "0") : "--"}
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

      {/* What is Picks4All? — SEO text with regional keywords */}
      <section
        style={{
          padding: isMobile ? "48px 20px" : "64px 40px",
          maxWidth: 900,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.5rem" : "2rem",
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--text)",
          }}
        >
          {t("whatIs.title")}
        </h2>
        <p
          style={{
            color: "var(--muted)",
            fontSize: isMobile ? "0.95rem" : "1.05rem",
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
            fontSize: isMobile ? "0.95rem" : "1.05rem",
            lineHeight: 1.7,
            maxWidth: 750,
            margin: "0 auto",
          }}
        >
          {t.rich("whatIs.p2", { strong: strongTag, ...poolParams })}
        </p>

        {/* How to play CTA — prominent */}
        <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
          <Link
            href="/como-se-juega"
            onClick={() => trackEvent("cta_clicked", { cta_text: "how_to_play", page: "landing" })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: colors.brandGradient,
              color: "white",
              fontSize: isMobile ? "0.95rem" : "1.05rem",
              fontWeight: 700,
              padding: isMobile ? "14px 22px" : "16px 36px",
              borderRadius: 12,
              textDecoration: "none",
              boxShadow: "0 6px 20px rgba(102, 126, 234, 0.35), 0 2px 6px rgba(0,0,0,0.08)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              letterSpacing: 0.3,
            }}
          >
            <span style={{ fontSize: "1.3em" }}>&#9917;</span>
            <span>{t("pricing.howToPlayCta")}</span>
            <span style={{ fontSize: "1.1em" }}>&#8594;</span>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section
        style={{
          padding: isMobile ? "48px 20px" : "64px 40px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: isMobile ? "1.75rem" : "2.25rem",
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
            fontSize: isMobile ? "1rem" : "1.1rem",
            maxWidth: 600,
            marginLeft: "auto",
            marginRight: "auto",
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
          <FeatureCard
            icon={"\u26BD"}
            title={t("feature1.title", poolParams)}
            description={t("feature1.description", poolParams)}
          />
          <FeatureCard
            icon={"\uD83D\uDCCA"}
            title={t("feature2.title")}
            description={t("feature2.description")}
          />
          <FeatureCard
            icon={"\uD83C\uDFAF"}
            title={t("feature3.title")}
            description={t("feature3.description")}
          />
          <FeatureCard
            icon={"\uD83D\uDC65"}
            title={t("feature4.title")}
            description={t("feature4.description")}
          />
          <FeatureCard
            icon={"\u26A1"}
            title={t("feature5.title")}
            description={t("feature5.description")}
          />
          <FeatureCard
            icon={"\uD83D\uDCE7"}
            title={t("feature6.title")}
            description={t("feature6.description")}
          />
          <FeatureCard
            icon={"\uD83C\uDFC6"}
            title={t("feature7.title")}
            description={t("feature7.description", poolParams)}
          />
          <FeatureCard
            icon={"\uD83D\uDCF1"}
            title={t("feature8.title")}
            description={t("feature8.description")}
          />
        </div>
      </section>

      {/* How it Works (Brief) */}
      <section
        style={{
          background: "var(--surface)",
          padding: isMobile ? "60px 20px" : "80px 40px",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2
            style={{
              textAlign: "center",
              fontSize: isMobile ? "1.75rem" : "2.25rem",
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
            <StepCard
              number={1}
              title={t("step1.title")}
              description={t("step1.description", poolParams)}
            />
            <StepCard
              number={2}
              title={t("step2.title")}
              description={t("step2.description")}
            />
            <StepCard
              number={3}
              title={t("step3.title")}
              description={t("step3.description")}
            />
          </div>

          <div style={{ textAlign: "center", marginTop: 48 }}>
            <Link
              href="/como-funciona"
              style={{
                color: "var(--text)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "1rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {t("seeMore")}
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        style={{
          padding: isMobile ? "60px 20px" : "80px 40px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: isMobile ? "1.75rem" : "2.25rem",
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
            fontSize: isMobile ? "1rem" : "1.1rem",
          }}
        >
          {t("pricing.subtitle")}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
            gap: 24,
            alignItems: "stretch",
          }}
        >
          {/* Personal Free Card */}
          <div
            style={{
              border: "2px solid #86efac",
              borderRadius: 16,
              padding: 28,
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
                {t("pricing.personal.title")}
              </h3>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.successAlt,
                  background: colors.successBgLight,
                  padding: "3px 10px",
                  borderRadius: 999,
                }}
              >
                {t("pricing.personal.badge")}
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 20px" }}>
              {t("pricing.personal.subtitle")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <FeatureCheck label={t("pricing.features.liveResults")} />
              <FeatureCheck label={t("pricing.features.scoringModes")} />
              <FeatureCheck label={t("pricing.features.autoResults")} />
              <FeatureCheck label={t("pricing.features.emailNotifications")} />
              <FeatureCheck label={t("pricing.features.multiTournament")} />
              <FeatureCheck label={t("pricing.features.inviteByLink")} />
              <FeatureCheck label={t("pricing.features.mobileOptimized")} />
            </div>

            <button
              onClick={() => { trackEvent("cta_clicked", { cta_text: "register", page: "landing" }); trackMetaEvent("Lead", { content_name: "register_cta" }); openAuthPanel("register"); }}
              style={{
                marginTop: 24,
                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "14px 24px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                width: "100%",
              }}
            >
              {t("pricing.personal.cta")}
            </button>
          </div>

          {/* Personal Pro Card */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 28,
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
                {t("pricing.personalPro.title")}
              </h3>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.brand,
                  background: "#e0e7ff",
                  padding: "3px 10px",
                  borderRadius: 999,
                }}
              >
                {isColombia ? t("pricing.personalPro.badgeCop") : t("pricing.personalPro.badgeUsd")}
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 20px" }}>
              {t("pricing.personalPro.subtitle")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <FeatureCheck label={t("pricing.personalPro.includesBase")} />
              <FeatureCheck label={t("pricing.personalPro.extraPlayers")} highlight />
            </div>

            <button
              onClick={() => { trackEvent("cta_clicked", { cta_text: "personal_pro", page: "landing" }); trackMetaEvent("Lead", { content_name: "personal_pro_cta" }); openAuthPanel("register"); }}
              style={{
                marginTop: 24,
                background: colors.brandGradient,
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "14px 24px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                width: "100%",
              }}
            >
              {t("pricing.personalPro.cta")}
            </button>
          </div>

          {/* Corporate Card — wrapper with sticker floating above */}
          <div
            style={{
              position: "relative",
              border: "2px solid #818cf8",
              borderRadius: 16,
              padding: 28,
              paddingTop: 28,
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Sticker floating above the card */}
            <div style={{
              position: "absolute",
              top: -44,
              left: "50%",
              transform: "translateX(-50%) rotate(-2deg)",
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              color: "white",
              fontSize: 11,
              fontWeight: 800,
              padding: "8px 20px",
              borderRadius: 10,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              boxShadow: "0 4px 14px rgba(22, 163, 74, 0.45), 0 2px 4px rgba(0,0,0,0.12)",
              border: "2px solid white",
              textAlign: "center",
              lineHeight: 1.3,
              zIndex: 3,
              maxWidth: 240,
            }}>
              &#127881; {t("pricing.corporate.trialBanner")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
                {t("pricing.corporate.title")}
              </h3>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: BRAND.primary, margin: "4px 0 4px" }}>
              {isColombia ? t("pricing.corporate.priceCop") : t("pricing.corporate.priceUsd")}
            </p>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 20px" }}>
              {t("pricing.corporate.subtitle")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <FeatureCheck label={t("pricing.corporate.includesPersonal")} />
              <FeatureCheck label={t("pricing.corporateFeatures.companyLogo")} highlight />
              <FeatureCheck label={t("pricing.corporateFeatures.emailInvites")} highlight />
              <FeatureCheck label={t("pricing.corporateFeatures.csvImport")} highlight />
              <FeatureCheck label={t("pricing.corporateFeatures.employeeDashboard")} highlight />
              <FeatureCheck label={t("pricing.corporateFeatures.brandedExperience")} highlight />
            </div>

            <Link
              href="/empresas"
              style={{
                marginTop: 24,
                background: colors.brandGradient,
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "14px 24px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                width: "100%",
                textDecoration: "none",
                textAlign: "center",
                display: "block",
                boxSizing: "border-box",
              }}
            >
              {t("pricing.corporate.cta")}
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Link
            href="/precios"
            style={{
              color: "var(--text)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "1rem",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {t("pricing.seeAllPlans")}
          </Link>
        </div>
      </section>

      {/* Tournament Section */}
      <section
        style={{
          padding: isMobile ? "60px 20px" : "80px 40px",
          maxWidth: 1100,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.75rem" : "2.25rem",
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
            fontSize: isMobile ? "1rem" : "1.1rem",
            maxWidth: 600,
            marginLeft: "auto",
            marginRight: "auto",
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
            <TournamentCard
              key={tournament.key}
              emoji={tournament.emoji}
              name={t(`tournaments.items.${tournament.i18nKey}.name`)}
              description={t(`tournaments.items.${tournament.i18nKey}.description`)}
              active={tournament.active}
              comingSoonLabel={t("tournaments.comingSoon")}
              ctaLabel={t("tournaments.createPool")}
              onCta={() => openAuthPanel("register")}
              isMobile={isMobile}
            />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          background: colors.brandGradient,
          color: "white",
          padding: isMobile ? "60px 20px" : "80px 40px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.75rem" : "2.25rem",
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          {t("final.title")}
        </h2>
        <p
          style={{
            fontSize: isMobile ? "1.1rem" : "1.25rem",
            color: "rgba(255,255,255,0.9)",
            marginBottom: 12,
          }}
        >
          {t("final.subtitle")}
        </p>
        <p
          style={{
            fontSize: isMobile ? "0.9rem" : "1rem",
            color: "rgba(255,255,255,0.75)",
            marginBottom: 32,
          }}
        >
          {t("final.hint", poolParams)}
        </p>
        <button
          onClick={() => { trackEvent("cta_clicked", { cta_text: "register", page: "landing" }); trackMetaEvent("Lead", { content_name: "register_cta" }); openAuthPanel("register"); }}
          style={{
            background: "white",
            color: "#764ba2",
            padding: isMobile ? "14px 28px" : "16px 32px",
            borderRadius: 8,
            fontSize: isMobile ? "1rem" : "1.1rem",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-block",
            border: "none",
            cursor: "pointer",
          }}
        >
          {t("final.cta")}
        </button>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 28,
      }}
    >
      <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>{icon}</div>
      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          marginBottom: 8,
          color: "var(--text)",
        }}
      >
        {title}
      </h3>
      <p style={{ color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: colors.brandGradient,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
          fontWeight: 700,
          margin: "0 auto 16px",
        }}
      >
        {number}
      </div>
      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          marginBottom: 8,
          color: "var(--text)",
        }}
      >
        {title}
      </h3>
      <p style={{ color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function FeatureCheck({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ color: colors.successAlt, fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>&#10003;</span>
      <span
        style={{
          fontSize: 14,
          color: highlight ? "var(--text)" : "var(--muted)",
          fontWeight: highlight ? 600 : 400,
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function TournamentCard({
  emoji,
  name,
  description,
  active,
  comingSoonLabel,
  ctaLabel,
  onCta,
  isMobile,
}: {
  emoji: string;
  name: string;
  description: string;
  active: boolean;
  comingSoonLabel: string;
  ctaLabel: string;
  onCta: () => void;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        background: active ? "var(--surface)" : "var(--surface)",
        border: active ? "2px solid var(--border)" : "1px solid var(--border)",
        borderRadius: 14,
        padding: isMobile ? 16 : 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        position: "relative",
        opacity: active ? 1 : 0.5,
        filter: active ? "none" : "grayscale(100%)",
        transition: "transform 0.15s, box-shadow 0.15s",
        ...(active
          ? {
              cursor: "default",
            }
          : {}),
      }}
    >
      {!active && (
        <div
          style={{
            position: "absolute",
            top: isMobile ? 6 : 8,
            right: isMobile ? 6 : 8,
            background: colors.textLighter,
            color: "white",
            fontSize: isMobile ? "0.6rem" : "0.65rem",
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {comingSoonLabel}
        </div>
      )}
      <div style={{ fontSize: isMobile ? "2rem" : "2.5rem" }}>{emoji}</div>
      <h3
        style={{
          fontSize: isMobile ? "0.85rem" : "0.95rem",
          fontWeight: 700,
          color: "var(--text)",
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {name}
      </h3>
      <p
        style={{
          fontSize: isMobile ? "0.7rem" : "0.75rem",
          color: "var(--muted)",
          margin: 0,
          lineHeight: 1.4,
          flex: 1,
        }}
      >
        {description}
      </p>
      {active && (
        <button
          onClick={onCta}
          style={{
            marginTop: 4,
            background: colors.brandGradient,
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: isMobile ? "6px 12px" : "7px 16px",
            fontSize: isMobile ? "0.7rem" : "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
