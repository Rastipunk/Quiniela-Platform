"use client";

import { colors } from "@/lib/theme";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { trackEvent } from "@/lib/analytics";
import {
  getPersonalTiers,
  getCorporateTiers,
  formatCOP,
  CORPORATE_FREE_LIMIT,
  CORPORATE_BASE_PRICE,
} from "@/lib/pricing";

function FeatureCheck({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ color: colors.successAlt, fontSize: 15, lineHeight: 1.3, flexShrink: 0 }}>&#10003;</span>
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

export function PricingPageContent() {
  const t = useTranslations("pricingPage");
  const f = useTranslations("landing");
  useEffect(() => { trackEvent("pricing_page_viewed"); }, []);
  const personalTiers = getPersonalTiers(300);
  const corporateTiers = getCorporateTiers(300);

  const baseFeatures = [
    f("pricing.features.leaderboard"),
    f("pricing.features.scoringModes"),
    f("pricing.features.autoResults"),
    f("pricing.features.emailNotifications"),
    f("pricing.features.multiTournament"),
    f("pricing.features.inviteByLink"),
    f("pricing.features.mobileOptimized"),
  ];

  const corporateExtraFeatures = [
    f("pricing.corporateFeatures.companyLogo"),
    f("pricing.corporateFeatures.emailInvites"),
    f("pricing.corporateFeatures.csvImport"),
    f("pricing.corporateFeatures.employeeDashboard"),
    f("pricing.corporateFeatures.brandedExperience"),
  ];

  return (
    <PublicPageWrapper>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px", minHeight: "60vh" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 24,
            color: "var(--muted)",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          {"<-"} Picks4All
        </Link>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
          {t("title")}
        </h1>
        <p style={{ fontSize: 16, color: "var(--muted)", marginBottom: 40, lineHeight: 1.6 }}>
          {t("subtitle")}
        </p>

        {/* Personal Pools */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
            {t("personalTitle")}
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
            {t("personalDesc")}
          </p>

          {/* Features included */}
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 12,
              background: colors.successBgAlt,
              border: "1px solid #bbf7d0",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#15803d", marginBottom: 12 }}>
              {t("featuresTitle")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
              {baseFeatures.map((feat) => (
                <FeatureCheck key={feat} label={feat} />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {personalTiers.map((tier) => (
              <div
                key={tier.maxParticipants}
                style={{
                  position: "relative",
                  padding: "14px 20px",
                  borderRadius: 12,
                  border: tier.isFree ? "2px solid #86efac" : "1px solid var(--border)",
                  background: tier.isFree ? colors.successBgAlt : "var(--surface)",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                      {t("upTo", { count: tier.maxParticipants })}
                    </span>
                    {tier.isFree && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          color: colors.successAlt,
                          background: colors.successBgLight,
                          padding: "2px 8px",
                          borderRadius: 999,
                        }}
                      >
                        {t("freeBadge")}
                      </span>
                    )}
                    {tier.savingsPercent > 0 && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          color: colors.successAlt,
                          background: colors.successBgLight,
                          padding: "2px 8px",
                          borderRadius: 999,
                        }}
                      >
                        {t("save", { percent: tier.savingsPercent })}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {tier.isFree ? (
                      <span style={{ fontSize: 16, fontWeight: 700, color: colors.successAlt }}>
                        {t("free")}
                      </span>
                    ) : (
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                        {formatCOP(tier.totalPrice)}
                      </span>
                    )}
                  </div>
                </div>
                {tier.isFree && (
                  <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>
                    {t("freeForever")}
                  </div>
                )}

              </div>
            ))}
          </div>
        </section>

        {/* Corporate Pools */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
            {t("corporateTitle")}
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
            {t("corporateDesc")}
          </p>

          {/* Features included */}
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 12,
              background: "#eef2ff",
              border: "1px solid #c7d2fe",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#3730a3", marginBottom: 12 }}>
              {t("featuresTitle")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
              {baseFeatures.map((feat) => (
                <FeatureCheck key={feat} label={feat} />
              ))}
              {corporateExtraFeatures.map((feat) => (
                <FeatureCheck key={feat} label={feat} highlight />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {corporateTiers.map((tier) => {
              const isBase = tier.maxParticipants === CORPORATE_FREE_LIMIT;
              return (
                <div
                  key={tier.maxParticipants}
                  style={{
                    position: "relative",
                    padding: "14px 20px",
                    borderRadius: 12,
                    border: isBase ? "2px solid #86efac" : "1px solid var(--border)",
                    background: isBase ? colors.successBgAlt : "var(--surface)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                        {isBase
                          ? t("included", { count: CORPORATE_FREE_LIMIT })
                          : t("upTo", { count: tier.maxParticipants })}
                      </span>
                      {isBase && (
                        <span
                          style={{
                            marginLeft: 10,
                            fontSize: 11,
                            fontWeight: 700,
                            color: colors.successAlt,
                            background: colors.successBgLight,
                            padding: "2px 8px",
                            borderRadius: 999,
                          }}
                        >
                          {t("trialBadge")}
                        </span>
                      )}
                      {tier.savingsPercent > 0 && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            color: colors.successAlt,
                            background: colors.successBgLight,
                            padding: "2px 8px",
                            borderRadius: 999,
                          }}
                        >
                          {t("save", { percent: tier.savingsPercent })}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {isBase ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, color: "var(--muted)", textDecoration: "line-through" }}>
                              {formatCOP(CORPORATE_BASE_PRICE)}
                            </span>
                            <span style={{ fontSize: 16, fontWeight: 800, color: colors.successAlt }}>
                              $0
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                          {formatCOP(tier.totalPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isBase && (
                    <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>
                      {t("trialDesc")}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <div
          style={{
            padding: "24px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #eef2ff, #e0e7ff)",
            border: "1px solid #c7d2fe",
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <Link
            href="/login"
            style={{
              display: "inline-block",
              padding: "14px 32px",
              borderRadius: 10,
              background: colors.brand,
              color: "white",
              fontSize: 16,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("cta")}
          </Link>
        </div>

        {/* Refund link */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Link
            href="/reembolsos"
            style={{ fontSize: 13, color: "var(--muted)", textDecoration: "underline" }}
          >
            {t("refundNote")}
          </Link>
        </div>
      </div>
    </PublicPageWrapper>
  );
}
