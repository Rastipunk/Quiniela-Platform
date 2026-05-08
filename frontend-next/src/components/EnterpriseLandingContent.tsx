"use client";

import { useState } from "react";
import { colors } from "@/lib/theme";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/hooks/useAuth";
import { useAuthPanel } from "@/contexts/AuthPanelContext";
import { usePoolTerm } from "@/contexts/PoolTermContext";
import { trackEvent } from "@/lib/analytics";
import { trackMetaEvent } from "@/lib/metaPixel";
import { CorporateQuotePanel } from "@/components/CorporateQuotePanel";

export function EnterpriseLandingContent() {
  const t = useTranslations("enterprise");
  const router = useRouter();
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuth();
  const { openAuthPanel } = useAuthPanel();
  const { params: poolParams } = usePoolTerm();

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteCardHovered, setQuoteCardHovered] = useState(false);

  const handleCta = () => {
    trackEvent("corporate_inquiry", { authenticated: isAuthenticated });
    trackMetaEvent("SubmitApplication", { content_name: "corporate" });
    if (isAuthenticated) {
      router.push("/empresas/crear");
    } else {
      openAuthPanel("register", "/empresas/crear");
    }
  };

  const handleQuoteOpen = () => {
    trackEvent("corporate_quote_opened", { source: "empresas_page" });
    setQuoteOpen(true);
  };

  const benefits = [
    {
      icon: "\u{1F91D}",
      title: t("benefits.teamBuilding"),
      desc: t("benefits.teamBuildingDesc"),
    },
    {
      icon: "\u26A1",
      title: t("benefits.easySetup"),
      desc: t("benefits.easySetupDesc"),
    },
    {
      icon: "\u{1F525}",
      title: t("benefits.engagement"),
      desc: t("benefits.engagementDesc"),
    },
    {
      icon: "\u{1F3AF}",
      title: t("benefits.support"),
      desc: t("benefits.supportDesc", poolParams),
    },
  ];

  const steps = [
    { num: "1", title: t("howItWorks.step1Title"), desc: t("howItWorks.step1Desc") },
    { num: "2", title: t("howItWorks.step2Title"), desc: t("howItWorks.step2Desc") },
    { num: "3", title: t("howItWorks.step3Title"), desc: t("howItWorks.step3Desc") },
  ];

  return (
    <div style={{ background: "var(--bg)" }}>
      {/* Hero */}
      <section
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
          color: "white",
          padding: isMobile ? "60px 20px" : "100px 40px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.15)",
              padding: "6px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 24,
              letterSpacing: 0.5,
            }}
          >
            {"\u{1F3E2}"} Picks4All for Business
          </div>
          <h1
            style={{
              fontSize: isMobile ? "2rem" : "3rem",
              fontWeight: 800,
              marginBottom: 16,
              lineHeight: 1.2,
            }}
          >
            {t("hero.title", poolParams)}
          </h1>
          <p
            style={{
              fontSize: isMobile ? "1rem" : "1.15rem",
              color: "rgba(255,255,255,0.8)",
              marginBottom: 12,
              lineHeight: 1.6,
              maxWidth: 650,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {t("hero.subtitle", poolParams)}
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
              onClick={handleCta}
              style={{
                background: "white",
                color: "#312e81",
                padding: isMobile ? "14px 28px" : "16px 32px",
                borderRadius: 8,
                fontSize: isMobile ? "1rem" : "1.1rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              {t("hero.cta")}
            </button>
            <a
              href="#how-it-works"
              style={{
                background: "transparent",
                color: "white",
                border: "2px solid rgba(255,255,255,0.4)",
                padding: isMobile ? "12px 26px" : "14px 30px",
                borderRadius: 8,
                fontSize: isMobile ? "1rem" : "1.1rem",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {t("hero.secondaryCta")}
            </a>
          </div>
          {/* Tertiary path: companies that need a formal quote.
              Two-line card — visible enough to invite the click without
              competing with the primary CTA above. Hover state is driven
              by React state instead of styled-jsx because globals.css has
              a `button { background: var(--primary); }` rule that races
              with styled-jsx scoping during hydration and made the card
              flash white before hover took effect. */}
          <button
            type="button"
            onClick={handleQuoteOpen}
            onMouseEnter={() => setQuoteCardHovered(true)}
            onMouseLeave={() => setQuoteCardHovered(false)}
            onFocus={() => setQuoteCardHovered(true)}
            onBlur={() => setQuoteCardHovered(false)}
            style={{
              marginTop: 28,
              background: quoteCardHovered
                ? "rgba(255,255,255,0.18)"
                : "rgba(255,255,255,0.10)",
              color: "white",
              border: `1.5px solid ${
                quoteCardHovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)"
              }`,
              borderRadius: 12,
              padding: isMobile ? "14px 18px" : "16px 24px",
              cursor: "pointer",
              textAlign: "left",
              display: "inline-flex",
              flexDirection: "column",
              gap: 4,
              maxWidth: isMobile ? "100%" : 360,
              transition: "background 0.15s ease, border-color 0.15s ease",
            }}
          >
            <span
              style={{
                fontSize: isMobile ? "0.95rem" : "1rem",
                fontWeight: 700,
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {t("hero.quoteHint")}
              <span aria-hidden="true" style={{ fontSize: "1.05em" }}>
                →
              </span>
            </span>
            <span
              style={{
                fontSize: isMobile ? "0.8rem" : "0.85rem",
                color: "rgba(255,255,255,0.8)",
                fontWeight: 400,
                lineHeight: 1.4,
              }}
            >
              {t("hero.quoteHintSubtitle")}
            </span>
          </button>
        </div>
      </section>

      {/* Benefits */}
      <section
        style={{
          padding: isMobile ? "48px 20px" : "80px 40px",
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.5rem" : "2rem",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: 48,
            color: "var(--text)",
          }}
        >
          {t("benefits.title")}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 24,
          }}
        >
          {benefits.map((b, i) => (
            <div
              key={i}
              style={{
                padding: 24,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{b.icon}</div>
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  marginBottom: 8,
                  color: "var(--text)",
                }}
              >
                {b.title}
              </h3>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        style={{
          padding: isMobile ? "48px 20px" : "80px 40px",
          background: "var(--surface)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: isMobile ? "1.5rem" : "2rem",
              fontWeight: 700,
              textAlign: "center",
              marginBottom: 48,
              color: "var(--text)",
            }}
          >
            {t("howItWorks.title")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {steps.map((s) => (
              <div
                key={s.num}
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    minWidth: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: colors.brand,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {s.num}
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      marginBottom: 4,
                      color: "var(--text)",
                    }}
                  >
                    {s.title}
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        style={{
          padding: isMobile ? "48px 20px" : "80px 40px",
          maxWidth: 600,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.5rem" : "2rem",
            fontWeight: 700,
            marginBottom: 8,
            color: "var(--text)",
          }}
        >
          {t("pricing.title")}
        </h2>
        <p style={{ color: "var(--muted)", marginBottom: 32, fontSize: 15 }}>
          {t("pricing.subtitle")}
        </p>
        <div
          style={{
            border: "2px solid #4f46e5",
            borderRadius: 16,
            padding: 32,
            background: "var(--surface)",
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: colors.brand,
              marginBottom: 4,
            }}
          >
            {t("pricing.free")}
          </div>
          <div style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#dcfce7",
            border: "1px solid #86efac",
            color: "#166534",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 24,
            textAlign: "center",
          }}>
            {t("pricing.trialAvailable")}
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {(["unlimited", "logo", "csv", "support"] as const).map((key) => (
              <li
                key={key}
                style={{
                  fontSize: 14,
                  color: "var(--text)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ color: colors.successAlt, fontWeight: 700, fontSize: 16 }}>
                  {"\u2713"}
                </span>
                {t(`pricing.features.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Quote section — for companies that need a formal proposal */}
      <section
        style={{
          padding: isMobile ? "48px 20px" : "80px 40px",
          maxWidth: 800,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: isMobile ? 24 : 40,
            background: "var(--surface)",
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? "1.4rem" : "1.75rem",
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--text)",
            }}
          >
            {t("quoteSection.title")}
          </h2>
          <p
            style={{
              color: "var(--muted)",
              marginBottom: 24,
              fontSize: 15,
              lineHeight: 1.6,
              maxWidth: 600,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {t("quoteSection.subtitle")}
          </p>
          <button
            type="button"
            onClick={handleQuoteOpen}
            style={{
              background: "transparent",
              color: colors.brand,
              border: `2px solid ${colors.brand}`,
              padding: isMobile ? "12px 26px" : "14px 32px",
              borderRadius: 8,
              fontSize: isMobile ? "1rem" : "1.05rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("quoteSection.button")}
          </button>
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          padding: isMobile ? "48px 20px" : "80px 40px",
          textAlign: "center",
          background: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)",
          color: "white",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.5rem" : "2rem",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          {t("cta.title")}
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.75)",
            marginBottom: 32,
            fontSize: 15,
          }}
        >
          {t("cta.subtitle")}
        </p>
        <button
          onClick={handleCta}
          style={{
            background: "white",
            color: "#312e81",
            padding: isMobile ? "14px 28px" : "16px 36px",
            borderRadius: 8,
            fontSize: isMobile ? "1rem" : "1.1rem",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          {t("cta.button")}
        </button>
      </section>

      <CorporateQuotePanel isOpen={quoteOpen} onClose={() => setQuoteOpen(false)} />
    </div>
  );
}
