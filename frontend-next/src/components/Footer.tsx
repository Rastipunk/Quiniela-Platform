"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
// Used for cross-locale links to single-locale pages (e.g. ES-only
// regional landing pages, EN-only football-pool). next-intl's `Link`
// auto-prefixes with the current/explicit locale, which produced URLs
// like `/es/polla-futbolera` even though the canonical is `/polla-
// futbolera` — that costs a 307 redirect on every internal click and
// muddies Google's view of which URL is canonical. Next.js's plain
// `Link` renders the href verbatim while keeping prefetch + client
// navigation.
import NextLink from "next/link";
import { BrandIsotipo } from "./BrandLogo";
import { openCookieConsent } from "./CookieConsent";
import { usePoolTerm } from "@/contexts/PoolTermContext";
import type { PoolRegion } from "@/lib/poolTerms";

const REGION_OPTIONS: { value: PoolRegion; flag: string; label: string }[] = [
  { value: "quiniela", flag: "\uD83C\uDDF2\uD83C\uDDFD", label: "Quiniela" },
  { value: "polla", flag: "\uD83C\uDDE8\uD83C\uDDF4", label: "Polla" },
  { value: "prode", flag: "\uD83C\uDDE6\uD83C\uDDF7", label: "Prode" },
  { value: "penca", flag: "\uD83C\uDDFA\uD83C\uDDFE", label: "Penca" },
  { value: "porra", flag: "\uD83C\uDDEA\uD83C\uDDF8", label: "Porra" },
];

export function Footer() {
  const t = useTranslations("footer");
  const { params: poolParams, region, setRegion } = usePoolTerm();
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
            <BrandIsotipo size={28} variant="degradado" />
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
            {t("tagline", poolParams)}
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
          <Link
            href="/precios"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("pricing")}
          </Link>
          <Link
            href="/reembolsos"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("refundPolicy")}
          </Link>
          {/* GDPR / CCPA require the consent decision to be as easy to
              revoke as it was to grant. The button reopens the same
              banner users saw on first visit — tracked nowhere else. */}
          <button
            type="button"
            onClick={openCookieConsent}
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
              background: "transparent",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              textAlign: "left",
              font: "inherit",
            }}
          >
            {t("manageCookies")}
          </button>
        </div>

        {/* Explore (Resources + Regional merged) */}
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
            {t("explore")}
          </div>
          <Link
            href="/mundial-2026"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {t("worldCup")}
          </Link>
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
          {/* Regional pages are single-locale (see /[locale]/{polla|prode|
              penca|porra|football-pool}/page.tsx — each calls notFound()
              for non-supported locales). We use NextLink with the canonical
              URL so the rendered href matches the canonical declared on
              the target page (no `/es/...` prefix for ES, explicit `/en/...`
              for football-pool). The same URL works for every visiting
              locale: the page is single-locale on purpose, and Google
              indexes that single canonical instead of seeing redirect
              chains through `/es/...` variants. */}
          <NextLink
            href="/polla-futbolera"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("pollaFutbolera")}
          </NextLink>
          <NextLink
            href="/prode-deportivo"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("prodeDeportivo")}
          </NextLink>
          <NextLink
            href="/penca-futbol"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("pencaFutbol")}
          </NextLink>
          <NextLink
            href="/porra-deportiva"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("porraDeportiva")}
          </NextLink>
          <NextLink
            href="/en/football-pool"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("footballPool")}
          </NextLink>
          <Link
            href="/empresas"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {t("enterprises")}
          </Link>
        </div>

        {/* Contact + Region */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
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
              href={`mailto:${t("supportEmail")}`}
              style={{
                fontSize: 13,
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              {t("supportEmail")}
            </a>
          </div>

          {/* Region Selector */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              {t("regionLabel")}
            </div>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as PoolRegion)}
              style={{
                fontSize: 13,
                color: "var(--text)",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 10px",
                cursor: "pointer",
                width: "100%",
                maxWidth: 180,
              }}
            >
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.flag} {opt.label}
                </option>
              ))}
            </select>
          </div>
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
