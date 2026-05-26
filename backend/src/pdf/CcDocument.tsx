/**
 * Cuenta de Cobro (Account Receivable) PDF template.
 *
 * Reads from the AccountReceivable row + the issuer snapshot
 * persisted at issue time. Single-page when concept fits; overflows
 * gracefully (every section wraps as a single unit per §11.23).
 *
 * Conditional rendering rules:
 *   - Bancolombia transfer block: ONLY when currency === "COP" (§11.22).
 *   - Régimen tributario (DIAN) phrase: ONLY when locale === "es"
 *     (§11.18 — the legal language is Colombian-specific).
 */

/* eslint-disable react/no-unknown-property */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { AccountReceivable } from "@prisma/client";
import { PDF_BRAND } from "./pdfBrand";
import { brandAsset } from "./pdfAssets";
import { PDF_DICT } from "./i18n";
import type { SaleLocale } from "../lib/saleTerms";
import type { IssuerInfo } from "../lib/issuerInfo";

const cc = StyleSheet.create({
  page: {
    paddingTop: 86,
    paddingBottom: 62,
    paddingHorizontal: 56,
    fontFamily: "Inter",
    fontSize: 10.5,
    color: PDF_BRAND.text,
    lineHeight: 1.55,
  },
  topHeader: {
    position: "absolute",
    top: 28,
    left: 56,
    right: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: PDF_BRAND.green,
  },
  topHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  topHeaderIso: { width: 30, height: 30 },
  topHeaderTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: PDF_BRAND.primary,
    letterSpacing: 2,
  },
  topHeaderRight: { alignItems: "flex-end" },
  topHeaderConsecLabel: {
    fontSize: 8,
    color: PDF_BRAND.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  topHeaderConsec: { fontSize: 13, fontWeight: 700, color: PDF_BRAND.text },

  cityDate: { textAlign: "right", marginTop: 4, marginBottom: 18, color: PDF_BRAND.textMuted, fontSize: 10.5 },

  block: { marginBottom: 14 },
  blockLabel: {
    fontSize: 9,
    fontWeight: 600,
    color: PDF_BRAND.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  blockBox: {
    padding: 14,
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 6,
    backgroundColor: PDF_BRAND.bgSubtle,
  },
  blockNameLine: { fontSize: 12, fontWeight: 700, color: PDF_BRAND.text, marginBottom: 3 },
  blockSubLine: { fontSize: 10.5, color: PDF_BRAND.text, lineHeight: 1.55 },

  amountHighlight: {
    padding: 18,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: PDF_BRAND.primary,
  },
  amountLabel: {
    fontSize: 9,
    color: PDF_BRAND.white,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    opacity: 0.85,
  },
  amountWords: {
    color: PDF_BRAND.white,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    lineHeight: 1.4,
  },
  amountFigures: {
    color: PDF_BRAND.white,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 0.5,
  },

  paymentOption: {
    flexDirection: "row",
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 6,
  },
  paymentBullet: {
    fontSize: 14,
    marginRight: 10,
    color: PDF_BRAND.primary,
    fontWeight: 700,
  },
  paymentMethodTitle: {
    fontWeight: 700,
    fontSize: 11,
    color: PDF_BRAND.text,
    marginBottom: 3,
  },
  paymentMethodBody: { fontSize: 10.5, color: PDF_BRAND.text, lineHeight: 1.5 },

  dualPathRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 8 },
  dualPathItem: {
    flex: 1,
    padding: 8,
    backgroundColor: PDF_BRAND.bgSubtle,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
  },
  dualPathLabel: { fontSize: 9, color: PDF_BRAND.textMuted, fontWeight: 600, marginBottom: 2 },
  dualPathValue: { fontSize: 10, color: PDF_BRAND.text, fontWeight: 600 },

  redemptionInline: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 },
  redemptionInlineLabel: { fontSize: 10.5, color: PDF_BRAND.text },
  redemptionInlineCode: {
    fontSize: 13,
    color: PDF_BRAND.primary,
    fontWeight: 700,
    letterSpacing: 2,
    backgroundColor: PDF_BRAND.bgPurpleSubtle,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },

  validity: { marginTop: 6, marginBottom: 12, fontSize: 10.5, color: PDF_BRAND.text },
  validityLabel: { fontWeight: 700, color: PDF_BRAND.primary },

  regimen: {
    marginTop: 6,
    marginBottom: 16,
    padding: 12,
    backgroundColor: PDF_BRAND.bgSubtle,
    borderLeftWidth: 3,
    borderLeftColor: PDF_BRAND.primary,
    borderRadius: 4,
    fontSize: 9.5,
    fontStyle: "italic",
    color: PDF_BRAND.textMuted,
    lineHeight: 1.55,
  },

  signature: { marginTop: 36, alignItems: "center" },
  signatureLine: { width: 260, borderTopWidth: 1, borderTopColor: PDF_BRAND.text, paddingTop: 6, alignItems: "center" },
  signatureName: { fontWeight: 700, fontSize: 11, color: PDF_BRAND.text, marginTop: 2 },
  signatureId: { fontSize: 10, color: PDF_BRAND.textMuted },

  footer: {
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
});

// Format a date for the cover-area "City, date" line per locale.
function formatLongDate(date: Date, locale: SaleLocale): string {
  const lang = locale === "es" ? "es-CO" : locale === "pt" ? "pt-BR" : "en-US";
  return date.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });
}

function formatMoneyCop(n: number): string {
  return `$ ${n.toLocaleString("es-CO")} COP`;
}

function formatMoneyUsd(cents: number): string {
  return `USD $${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRedemptionCode(raw: string): string {
  // 8 digits → "XXXX-XXXX" for display. The DB stores raw.
  if (raw.length !== 8) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function CcDocument({ cc: row }: { cc: AccountReceivable }) {
  const locale = (row.locale as SaleLocale) ?? "es";
  const dict = PDF_DICT[locale];
  const issuer = row.issuerSnapshotJson as unknown as IssuerInfo;
  const isCop = row.currency === "COP";

  const amountText = isCop
    ? formatMoneyCop(row.amountCop ?? 0)
    : formatMoneyUsd(row.amountUsdCents ?? 0);

  return (
    <Document>
      <Page size="LETTER" style={cc.page}>
        {/* Top header */}
        <View style={cc.topHeader} fixed>
          <View style={cc.topHeaderLeft}>
            <Image src={brandAsset("isotipo-degradado-500.png")} style={cc.topHeaderIso} />
            <Text style={cc.topHeaderTitle}>{dict.ccTitle}</Text>
          </View>
          <View style={cc.topHeaderRight}>
            <Text style={cc.topHeaderConsecLabel}>{dict.ccConsecLabel}</Text>
            <Text style={cc.topHeaderConsec}>{row.consecutive}</Text>
          </View>
        </View>

        <Text style={cc.cityDate}>
          {dict.ccCityDate(issuer.city, formatLongDate(row.issueDate, locale))}
        </Text>

        {/* VALOR A PAGAR A */}
        <View style={cc.block} wrap={false}>
          <Text style={cc.blockLabel}>{dict.ccBlockValueTo}</Text>
          <View style={cc.blockBox}>
            <Text style={cc.blockNameLine}>{issuer.legalName}</Text>
            <Text style={cc.blockSubLine}>{issuer.documentType}. {formatDocumentNumber(issuer.documentNumber)}</Text>
            <Text style={cc.blockSubLine}>{issuer.address}, {issuer.city}</Text>
            <Text style={cc.blockSubLine}>Tel: {issuer.phone} · {issuer.email}</Text>
          </View>
        </View>

        {/* POR CONCEPTO DE */}
        <View style={cc.block} wrap={false}>
          <Text style={cc.blockLabel}>{dict.ccBlockConcept}</Text>
          <View style={cc.blockBox}>
            <Text style={cc.blockSubLine}>{row.concept}</Text>
          </View>
        </View>

        {/* LA SUMA DE */}
        <View style={cc.amountHighlight} wrap={false}>
          <Text style={cc.amountLabel}>{dict.ccBlockAmount}</Text>
          <Text style={cc.amountWords}>{row.amountInWords}</Text>
          <Text style={cc.amountFigures}>{amountText}</Text>
        </View>

        {/* FORMA DE PAGO — Bancolombia only when COP (§11.22) */}
        <View style={cc.block} wrap={false}>
          <Text style={cc.blockLabel}>{dict.ccBlockPayment}</Text>

          {isCop && (
            <View style={cc.paymentOption} wrap={false}>
              <Text style={cc.paymentBullet}>1.</Text>
              <View style={{ flex: 1 }}>
                <Text style={cc.paymentMethodTitle}>{dict.ccPaymentMethod1Title}</Text>
                <Text style={cc.paymentMethodBody}>
                  {issuer.bank.name} · {issuer.bank.accountType} {formatAccountNumber(issuer.bank.accountNumber)}
                </Text>
                <Text style={cc.paymentMethodBody}>{dict.ccBankAccountTitleSuffix} {issuer.bank.accountHolder}</Text>
              </View>
            </View>
          )}

          <View style={cc.paymentOption} wrap={false}>
            <Text style={cc.paymentBullet}>{isCop ? "2." : "1."}</Text>
            <View style={{ flex: 1 }}>
              <Text style={cc.paymentMethodTitle}>{dict.ccPaymentMethod2Title}</Text>
              <Text style={cc.paymentMethodBody}>{dict.ccPaymentMethod2Intro}</Text>
              <View style={cc.dualPathRow}>
                <View style={cc.dualPathItem}>
                  <Text style={cc.dualPathLabel}>{dict.ccPaymentDualNew}</Text>
                  <Text style={cc.dualPathValue}>{dict.ccPaymentDualNewValue}</Text>
                </View>
                <View style={cc.dualPathItem}>
                  <Text style={cc.dualPathLabel}>{dict.ccPaymentDualExisting}</Text>
                  <Text style={cc.dualPathValue}>{dict.ccPaymentDualExistingValue}</Text>
                </View>
              </View>
              <View style={cc.redemptionInline}>
                <Text style={cc.redemptionInlineLabel}>{dict.ccPaymentCodeLabel}</Text>
                <Text style={cc.redemptionInlineCode}>{formatRedemptionCode(row.redemptionCode)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* DATOS DEL CLIENTE */}
        <View style={cc.block} wrap={false}>
          <Text style={cc.blockLabel}>{dict.ccBlockClient}</Text>
          <View style={cc.blockBox}>
            <Text style={cc.blockNameLine}>{row.clientLegalName}</Text>
            {row.clientNit ? <Text style={cc.blockSubLine}>NIT: {row.clientNit}</Text> : null}
            <Text style={cc.blockSubLine}>{row.clientContactEmail}</Text>
            {row.clientCity ? <Text style={cc.blockSubLine}>{row.clientCity}</Text> : null}
          </View>
        </View>

        {/* Vigencia */}
        <Text style={cc.validity} wrap={false}>
          <Text style={cc.validityLabel}>{dict.ccValidityLabel} </Text>
          {dict.ccValidity(formatLongDate(row.validUntil, locale))}
        </Text>

        {/* Régimen tributario — only ES per §11.18 */}
        {locale === "es" && (
          <Text style={cc.regimen} wrap={false}>{dict.ccRegimen}</Text>
        )}

        {/* Firma */}
        <View style={cc.signature} wrap={false}>
          <View style={cc.signatureLine}>
            <Text style={cc.signatureName}>{issuer.legalName}</Text>
            <Text style={cc.signatureId}>{issuer.documentType}. {formatDocumentNumber(issuer.documentNumber)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={cc.footer} fixed>
          <Text>empresas@picks4all.com · Picks4All © 2026</Text>
          <Text render={({ pageNumber }) => `${dict.pageLabel} ${pageNumber}`} />
        </View>
      </Page>
    </Document>
  );
}

/** "1016094585" → "1.016.094.585" (Colombian-style thousands separator). */
function formatDocumentNumber(raw: string): string {
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "18651313496" → "1865-1313-496" (eye-friendly grouping for the bank account). */
function formatAccountNumber(raw: string): string {
  if (raw.length < 8) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}
