/**
 * Cotización (Quote) PDF template.
 *
 * Trilingual: copy comes from PDF_DICT[locale]; `{term}` placeholders
 * are substituted with the document's term. Single-investment layout
 * per §11.14 (no multi-option). Every section uses `wrap={false}` per
 * §11.23 so blocks never split across pages.
 *
 * Pricing: rendered directly from the Quote row. The values are
 * server-derived (commit 2 ensures this) so the PDF is the source of
 * truth for what the customer sees.
 */

/* eslint-disable react/no-unknown-property */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { Quote } from "@prisma/client";
import { PDF_BRAND } from "./pdfBrand";
import { brandAsset } from "./pdfAssets";
import { PDF_DICT, substitute } from "./i18n";
import type { SaleLocale } from "../lib/saleTerms";

// ─────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────

const shared = StyleSheet.create({
  pageCover: {
    paddingHorizontal: 56,
    paddingVertical: 56,
    alignItems: "center",
    fontFamily: "Inter",
    color: PDF_BRAND.text,
  },
  pageBody: {
    paddingTop: 90,
    paddingBottom: 60,
    paddingHorizontal: 56,
    fontFamily: "Inter",
    fontSize: 10.5,
    color: PDF_BRAND.text,
    lineHeight: 1.55,
  },
  headerBar: {
    position: "absolute",
    top: 30,
    left: 56,
    right: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: PDF_BRAND.green,
  },
  headerIso: { width: 26, height: 26 },
  headerLogo: { width: 92, height: 22 },
  footerBar: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 8,
    color: PDF_BRAND.textMuted,
  },
  sectionTitle: {
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: 700,
    color: PDF_BRAND.primary,
    marginTop: 22,
    marginBottom: 14,
    letterSpacing: 0.1,
  },
  paragraph: {
    marginBottom: 9,
    lineHeight: 1.6,
  },
});

const cover = StyleSheet.create({
  iso: { width: 160, height: 160, marginTop: 80, marginBottom: 18 },
  logo: { width: 320, height: 77, marginBottom: 22 },
  greenRule: { width: 96, height: 3, backgroundColor: PDF_BRAND.green, marginBottom: 28 },
  title: {
    fontSize: 38,
    fontWeight: 700,
    color: PDF_BRAND.primary,
    letterSpacing: 4,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 13,
    fontStyle: "italic",
    color: PDF_BRAND.textMuted,
    marginBottom: 50,
  },
  metaWrap: { alignItems: "center", marginBottom: 28 },
  metaRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 6 },
  metaLabel: { fontSize: 12, color: PDF_BRAND.textMuted },
  metaValue: { fontSize: 14, fontWeight: 700, color: PDF_BRAND.text },
  metaDate: { fontSize: 12, color: PDF_BRAND.textMuted },
  contact: { marginTop: 14, alignItems: "center" },
  contactPrimary: { fontSize: 14, fontWeight: 700, color: PDF_BRAND.primary, marginBottom: 4 },
  contactSecondary: { fontSize: 11, color: PDF_BRAND.textMuted },
});

const body = StyleSheet.create({
  clientTable: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  clientHeaderRow: {
    flexDirection: "row",
    backgroundColor: PDF_BRAND.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  clientHeaderCell: { color: PDF_BRAND.white, fontWeight: 600, fontSize: 10.5 },
  clientHeaderCellLeft: { flex: 1 },
  clientHeaderCellRight: { flex: 2 },
  clientRow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: PDF_BRAND.border,
    backgroundColor: PDF_BRAND.white,
  },
  clientRowAlt: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: PDF_BRAND.border,
    backgroundColor: PDF_BRAND.bgPurpleSubtle,
  },
  clientCellLabel: { flex: 1, fontWeight: 600, color: PDF_BRAND.primary },
  clientCellValue: { flex: 2, color: PDF_BRAND.text },

  bullet: { flexDirection: "row", marginTop: 11, alignItems: "center", gap: 8 },
  bulletCheck: { color: PDF_BRAND.green, fontWeight: 700, fontSize: 13 },
  bulletHeading: { fontWeight: 700, color: PDF_BRAND.primary, fontSize: 12 },
  bulletBody: { marginLeft: 21, marginTop: 3, marginBottom: 2, fontSize: 10.5, lineHeight: 1.55 },

  intro: { fontStyle: "italic", color: PDF_BRAND.textMuted, fontSize: 10.5, marginBottom: 9, lineHeight: 1.5 },
  priceTable: { borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: PDF_BRAND.border },
  priceHeader: { flexDirection: "row", backgroundColor: PDF_BRAND.primary, paddingVertical: 9, paddingHorizontal: 12 },
  priceHeaderCell: { flex: 1, color: PDF_BRAND.white, fontWeight: 600, fontSize: 10.5, textAlign: "center" },
  priceTotalRow: {
    flexDirection: "row",
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: PDF_BRAND.totalRowBg,
    borderTopWidth: 1,
    borderTopColor: PDF_BRAND.totalRowBorder,
  },
  priceTotalCell: {
    flex: 1,
    color: PDF_BRAND.totalRowText,
    fontWeight: 700,
    fontSize: 11,
    textAlign: "center",
  },
  disclaimer: {
    fontSize: 9.5,
    color: PDF_BRAND.textMuted,
    fontStyle: "italic",
    marginTop: 12,
    lineHeight: 1.5,
  },

  step: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  stepEven: { backgroundColor: PDF_BRAND.bgPurpleSubtle },
  stepOdd: { backgroundColor: PDF_BRAND.bgGreenSubtle },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PDF_BRAND.primary,
    color: PDF_BRAND.white,
    fontWeight: 700,
    fontSize: 11,
    textAlign: "center",
    paddingTop: 5,
    marginRight: 12,
  },
  stepText: { flex: 1, fontSize: 10.5, lineHeight: 1.4 },

  cta: {
    marginTop: 16,
    padding: 16,
    backgroundColor: PDF_BRAND.bgPurpleSubtle,
    borderRadius: 8,
    alignItems: "center",
  },
  ctaTitle: { fontWeight: 700, fontSize: 14, color: PDF_BRAND.primary, marginBottom: 6 },
  ctaBody: { fontSize: 10.5, color: PDF_BRAND.text, textAlign: "center", marginBottom: 6, lineHeight: 1.45 },
  ctaUrl: { fontSize: 11, color: PDF_BRAND.primary, fontWeight: 700 },
});

// ─────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────

function RunningHeader() {
  return (
    <View style={shared.headerBar} fixed>
      <Image src={brandAsset("isotipo-degradado-500.png")} style={shared.headerIso} />
      <Image src={brandAsset("logotipo-degradado-120.png")} style={shared.headerLogo} />
    </View>
  );
}

function RunningFooter({ pageLabel }: { pageLabel: string }) {
  return (
    <View style={shared.footerBar} fixed>
      <Text>empresas@picks4all.com · Picks4All © 2026</Text>
      <Text render={({ pageNumber }) => `${pageLabel} ${pageNumber}`} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────────────────────────

function formatMoneyCop(n: number): string {
  return `$ ${n.toLocaleString("es-CO")} COP`;
}

function formatMoneyUsd(cents: number): string {
  return `USD $${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date, locale: SaleLocale): string {
  const lang = locale === "es" ? "es-CO" : locale === "pt" ? "pt-BR" : "en-US";
  return date.toLocaleDateString(lang, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function QuoteDocument({ quote }: { quote: Quote }) {
  const locale = (quote.locale as SaleLocale) ?? "es";
  const dict = PDF_DICT[locale];
  const term = quote.term;

  const dateString = formatDate(quote.issueDate, locale);

  const amountText = quote.currency === "COP"
    ? formatMoneyCop(quote.amountCop ?? 0)
    : formatMoneyUsd(quote.amountUsdCents ?? 0);
  const perPersonText = quote.currency === "COP"
    ? formatMoneyCop(quote.perPersonAmount)
    : formatMoneyUsd(quote.perPersonAmount);

  return (
    <Document>
      {/* ── COVER PAGE (optional) ── */}
      {quote.includeCoverPage && (
        <Page size="LETTER" style={shared.pageCover}>
          <Image src={brandAsset("isotipo-degradado-500.png")} style={cover.iso} />
          <Image src={brandAsset("logotipo-degradado-120.png")} style={cover.logo} />
          <View style={cover.greenRule} />
          <Text style={cover.title}>{dict.quoteTitle}</Text>
          <Text style={cover.tagline}>{substitute(dict.quoteTagline, { term })}</Text>

          <View style={cover.metaWrap}>
            <View style={cover.metaRow}>
              <Text style={cover.metaLabel}>{dict.preparedFor} </Text>
              <Text style={cover.metaValue}>{quote.clientLegalName}</Text>
            </View>
            <Text style={cover.metaDate}>{dict.dateLabel} {dateString}</Text>
          </View>

          <View style={cover.contact}>
            <Text style={cover.contactPrimary}>empresas@picks4all.com</Text>
            <Text style={cover.contactSecondary}>www.picks4all.com</Text>
          </View>
        </Page>
      )}

      {/* ── BODY: §1, §2, §3 ── */}
      <Page size="LETTER" style={shared.pageBody}>
        <RunningHeader />

        {/* §1 — Datos del cliente */}
        <View wrap={false}>
          <Text style={shared.sectionTitle}><Text>1. </Text>{dict.quoteSec1Title}</Text>
          <View style={body.clientTable}>
            <View style={body.clientHeaderRow}>
              <Text style={[body.clientHeaderCell, body.clientHeaderCellLeft]}>{dict.quoteSec1ColLeft}</Text>
              <Text style={[body.clientHeaderCell, body.clientHeaderCellRight]}>{dict.quoteSec1ColRight}</Text>
            </View>
            <View style={body.clientRowAlt}>
              <Text style={body.clientCellLabel}>{dict.quoteSec1FieldName}</Text>
              <Text style={body.clientCellValue}>{quote.clientLegalName}</Text>
            </View>
            <View style={body.clientRow}>
              <Text style={body.clientCellLabel}>{dict.quoteSec1FieldEmail}</Text>
              <Text style={body.clientCellValue}>{quote.clientContactEmail}</Text>
            </View>
            <View style={body.clientRowAlt}>
              <Text style={body.clientCellLabel}>{dict.quoteSec1FieldDate}</Text>
              <Text style={body.clientCellValue}>{dateString}</Text>
            </View>
          </View>
        </View>

        {/* §2 — ¿Qué es Picks4All? */}
        <View wrap={false}>
          <Text style={shared.sectionTitle}><Text>2. </Text>{dict.quoteSec2Title}</Text>
          <Text style={shared.paragraph}>{substitute(dict.quoteSec2Body1, { term })}</Text>
          <Text style={shared.paragraph}>{dict.quoteSec2Body2}</Text>
        </View>

        {/* §3 — ¿Qué incluye? */}
        <Text style={shared.sectionTitle}><Text>3. </Text>{dict.quoteSec3Title}</Text>
        {dict.quoteSec3Bullets.map(([heading, b], i) => (
          <View key={i} wrap={false}>
            <View style={body.bullet}>
              <Text style={body.bulletCheck}>✓</Text>
              <Text style={body.bulletHeading}>{heading}</Text>
            </View>
            <Text style={body.bulletBody}>{b}</Text>
          </View>
        ))}

        <RunningFooter pageLabel={dict.pageLabel} />
      </Page>

      {/* ── BODY: §4 + §5 ── */}
      <Page size="LETTER" style={shared.pageBody}>
        <RunningHeader />

        {/* §4 — Inversión */}
        <View wrap={false}>
          <Text style={shared.sectionTitle}><Text>4. </Text>{dict.quoteSec4Title}</Text>
          <Text style={shared.paragraph}>
            {dict.quoteSec4Intro}
            {quote.tournament ? substitute(dict.quoteSec4TournamentSuffix, { tournament: quote.tournament }) : "."}
          </Text>
          {quote.investmentDescription && (
            <Text style={body.intro}>{quote.investmentDescription}</Text>
          )}

          <View style={body.priceTable}>
            <View style={body.priceHeader}>
              <Text style={body.priceHeaderCell}>{dict.quoteSec4ColConcept}</Text>
              <Text style={body.priceHeaderCell}>{dict.quoteSec4ColTotal}</Text>
              <Text style={body.priceHeaderCell}>{dict.quoteSec4ColPerPerson}</Text>
            </View>
            <View style={body.priceTotalRow}>
              <Text style={body.priceTotalCell}>
                {substitute(dict.quoteSec4TotalLabel, { participants: quote.participants })}
              </Text>
              <Text style={body.priceTotalCell}>{amountText}</Text>
              <Text style={body.priceTotalCell}>{perPersonText}</Text>
            </View>
          </View>

          <Text style={body.disclaimer}>{dict.quoteSec4Disclaimer}</Text>
        </View>

        {/* §5 — Cómo empezamos + CTA */}
        <View wrap={false}>
          <Text style={shared.sectionTitle}><Text>5. </Text>{dict.quoteSec5Title}</Text>
          {dict.quoteSec5Steps.map((text, i) => (
            <View key={i} style={[body.step, i % 2 === 0 ? body.stepEven : body.stepOdd]}>
              <Text style={body.stepNum}>{i + 1}</Text>
              <Text style={body.stepText}>{substitute(text, { term })}</Text>
            </View>
          ))}

          <View style={body.cta}>
            <Text style={body.ctaTitle}>{dict.ctaTitle}</Text>
            <Text style={body.ctaBody}>{dict.ctaBody}</Text>
            <Text style={body.ctaUrl}>www.picks4all.com</Text>
          </View>
        </View>

        <RunningFooter pageLabel={dict.pageLabel} />
      </Page>
    </Document>
  );
}
