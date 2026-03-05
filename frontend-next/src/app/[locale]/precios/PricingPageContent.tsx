"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import {
  getPersonalTiers,
  getCorporateTiers,
  CORPORATE_FREE_LIMIT,
  CORPORATE_BASE_PRICE,
} from "@/lib/pricing";

export function PricingPageContent() {
  const t = useTranslations("pricingPage");
  const personalTiers = getPersonalTiers(300);
  const corporateTiers = getCorporateTiers(300);

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
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20 }}>
            {t("personalDesc")}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {personalTiers.map((tier) => (
              <div
                key={tier.maxParticipants}
                style={{
                  position: "relative",
                  padding: "14px 20px",
                  borderRadius: 12,
                  border: tier.isFree ? "2px solid #86efac" : "1px solid var(--border)",
                  background: tier.isFree ? "#f0fdf4" : "var(--surface)",
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
                          color: "#16a34a",
                          background: "#dcfce7",
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
                          color: "#16a34a",
                          background: "#dcfce7",
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
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#16a34a" }}>
                        {t("free")}
                      </span>
                    ) : (
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                        ${tier.totalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                {tier.isFree && (
                  <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>
                    {t("freeForever")}
                  </div>
                )}

                {/* Coming soon overlay for paid tiers */}
                {!tier.isFree && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.82)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      zIndex: 2,
                      backdropFilter: "blur(1px)",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>&#128274;</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#4f46e5" }}>
                      {t("comingSoon")}
                    </span>
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
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20 }}>
            {t("corporateDesc")}
          </p>

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
                    background: isBase ? "#f0fdf4" : "var(--surface)",
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
                            color: "#16a34a",
                            background: "#dcfce7",
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
                            color: "#16a34a",
                            background: "#dcfce7",
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
                              ${CORPORATE_BASE_PRICE.toFixed(2)}
                            </span>
                            <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>
                              $0
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                          ${tier.totalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isBase && (
                    <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>
                      {t("trialDesc")}
                    </div>
                  )}

                  {/* Coming soon overlay for paid tiers (not base) */}
                  {!isBase && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 10,
                        background: "rgba(255, 255, 255, 0.82)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        zIndex: 2,
                        backdropFilter: "blur(1px)",
                      }}
                    >
                      <span style={{ fontSize: 14 }}>&#128274;</span>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#4f46e5" }}>
                        {t("comingSoon")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Coming Soon Note + CTA */}
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
          <p style={{ fontSize: 14, color: "#3730a3", lineHeight: 1.7, margin: "0 0 20px" }}>
            {t("comingSoonNote")}
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              padding: "14px 32px",
              borderRadius: 10,
              background: "#4f46e5",
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
