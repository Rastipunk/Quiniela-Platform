"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "./BrandLogo";

export function Footer() {
  const t = useTranslations("footer");
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="footer-outer"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        padding: "24px 32px",
        marginTop: "auto",
      }}
    >
      <div
        className="footer-inner"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 40,
        }}
      >
        {/* Brand & Disclaimer */}
        <div style={{ maxWidth: 420 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 8,
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <BrandLogo size={22} />
            Picks4All
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {t("tagline")}
            {" "}
            {t("disclaimer")}
          </p>
        </div>

        {/* Legal Links */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            {t("legal")}
          </div>
          <Link
            href="/terminos"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("terms")}
          </Link>
          <Link
            href="/privacidad"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("privacy")}
          </Link>
        </div>

        {/* Resources */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            {t("resources")}
          </div>
          <Link
            href="/como-funciona"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("howItWorks")}
          </Link>
          <Link
            href="/faq"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("faqTitle")}
          </Link>
          <Link
            href="/que-es-una-quiniela"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("whatIsQuiniela")}
          </Link>
        </div>

        {/* Regional */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            {t("byCountry")}
          </div>
          <Link
            href="/polla-futbolera"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("pollaFutbolera")}
          </Link>
          <Link
            href="/prode-deportivo"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("prodeDeportivo")}
          </Link>
          <Link
            href="/penca-futbol"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("pencaFutbol")}
          </Link>
          <Link
            href="/porra-deportiva"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("porraDeportiva")}
          </Link>
        </div>

        {/* Contact */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            {t("contact")}
          </div>
          <a
            href="mailto:soporte@picks4all.com"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            soporte@picks4all.com
          </a>
        </div>
      </div>

      {/* Copyright */}
      <div
        style={{
          maxWidth: 1200,
          margin: "16px auto 0",
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
          textAlign: "center",
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        &copy; {currentYear} Picks4All. {t("copyright")}
      </div>
    </footer>
  );
}
