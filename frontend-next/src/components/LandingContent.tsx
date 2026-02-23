"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuthPanel } from "@/contexts/AuthPanelContext";
import { TOURNAMENT_CATALOG } from "@/lib/tournamentCatalog";

export function LandingContent() {
  const t = useTranslations("landing");
  const isMobile = useIsMobile();
  const { openAuthPanel } = useAuthPanel();

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
          padding: isMobile ? "60px 20px" : "100px 40px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
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
              maxWidth: 650,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {t("hero.subtitle")}
          </p>
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 32,
            }}
          >
            <button
              onClick={() => openAuthPanel("register")}
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
              {t("hero.cta")}
            </button>
            <Link
              href="/como-funciona"
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
              {t("hero.secondaryCta")}
            </Link>
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
          {t.rich("whatIs.p1", { strong: strongTag })}
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
          {t.rich("whatIs.p2", { strong: strongTag })}
        </p>
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
          {t("features.subtitle")}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: 24,
          }}
        >
          <FeatureCard
            icon={"\u26BD"}
            title={t("feature1.title")}
            description={t("feature1.description")}
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
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: 32,
            }}
          >
            <StepCard
              number={1}
              title={t("step1.title")}
              description={t("step1.description")}
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
          {t("tournaments.subtitle")}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            gap: isMobile ? 12 : 16,
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
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
          {t("final.hint")}
        </p>
        <button
          onClick={() => openAuthPanel("register")}
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
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
            background: "#6b7280",
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
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
