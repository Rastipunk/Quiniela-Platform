"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/hooks/useAuth";
import { useAuthPanel } from "@/contexts/AuthPanelContext";

export function EnterpriseLandingContent() {
  const t = useTranslations("enterprise");
  const router = useRouter();
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuth();
  const { openAuthPanel } = useAuthPanel();

  const handleCta = () => {
    if (isAuthenticated) {
      router.push("/empresas/crear");
    } else {
      openAuthPanel("register", "/empresas/crear");
    }
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
      desc: t("benefits.supportDesc"),
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
            {t("hero.title")}
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
                    background: "#4f46e5",
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
              color: "#4f46e5",
              marginBottom: 4,
            }}
          >
            {t("pricing.free")}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
            Beta
          </p>
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
                <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 16 }}>
                  {"\u2713"}
                </span>
                {t(`pricing.features.${key}`)}
              </li>
            ))}
          </ul>
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
    </div>
  );
}
