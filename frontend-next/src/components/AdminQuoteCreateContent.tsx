"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { getToken } from "@/lib/auth";
import { createQuote, type SaleCurrency, type SaleLocale } from "@/lib/api";
import { SALE_TERMS, DEFAULT_TERM_FOR_LOCALE } from "@/lib/saleTerms";
import {
  CORPORATE_FREE_LIMIT,
  formatPrice,
  getUpgradePrice,
  getUpgradePriceUsd,
} from "@/lib/pricing";
import { useIsMobile } from "@/hooks/useIsMobile";
import { colors, fontSize, fontWeight, spacing, radii } from "@/lib/theme";
import AdminSalesHeader from "./AdminSalesHeader";

// Default validity window for a quote — typical sales practice +
// matches the validUntil column shown in the PDF footer.
const DEFAULT_VALIDITY_DAYS = 30;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AdminQuoteCreateContent() {
  const isMobile = useIsMobile();
  const router = useRouter();

  const initialIssue = today();
  const initialValid = plusDays(initialIssue, DEFAULT_VALIDITY_DAYS);

  const [clientLegalName, setClientLegalName] = useState("");
  const [clientContactEmail, setClientContactEmail] = useState("");
  const [issueDate, setIssueDate] = useState(initialIssue);
  const [validUntil, setValidUntil] = useState(initialValid);
  const [locale, setLocale] = useState<SaleLocale>("es");
  const [term, setTerm] = useState<string>(DEFAULT_TERM_FOR_LOCALE.es);
  const [participants, setParticipants] = useState<number>(50);
  const [currency, setCurrency] = useState<SaleCurrency>("COP");
  const [tournament, setTournament] = useState("");
  const [investmentDescription, setInvestmentDescription] = useState("");
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live amount preview. Mirrors backend pricing exactly — same
  // CORPORATE_FREE_LIMIT, same getUpgradePrice* helpers.
  const livePreview = useMemo(() => {
    if (!participants || participants <= CORPORATE_FREE_LIMIT) return null;
    if (currency === "COP") {
      const cop = getUpgradePrice("corporate", CORPORATE_FREE_LIMIT, participants);
      return { amount: cop, formatted: formatPrice(cop, "COP") };
    }
    const usd = getUpgradePriceUsd("corporate", CORPORATE_FREE_LIMIT, participants);
    return { amount: usd, formatted: formatPrice(usd, "USD") };
  }, [participants, currency]);

  // When locale changes, reset term to the locale's default to avoid
  // submitting a term not allowed for the new locale.
  function changeLocale(next: SaleLocale) {
    setLocale(next);
    setTerm(DEFAULT_TERM_FOR_LOCALE[next]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (participants <= CORPORATE_FREE_LIMIT) {
      setError(`Los participantes (${participants}) están dentro del cupo gratuito (${CORPORATE_FREE_LIMIT}). No hay nada que cotizar.`);
      return;
    }

    const token = getToken();
    if (!token) {
      setError("Sesión expirada. Inicia sesión de nuevo.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createQuote(token, {
        clientLegalName: clientLegalName.trim(),
        clientContactEmail: clientContactEmail.trim().toLowerCase(),
        issueDate,
        validUntil,
        locale,
        term,
        participants,
        currency,
        tournament: tournament.trim() || undefined,
        investmentDescription: investmentDescription.trim() || undefined,
        includeCoverPage,
        notes: notes.trim() || undefined,
      });
      router.push({ pathname: "/admin/ventas/cotizaciones/[id]", params: { id: result.id } });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      setError(e.message || "Error al crear la cotización");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "24px 16px" : "32px 16px" }}>
      <AdminSalesHeader active="quotes" isMobile={isMobile} />

      <Link
        href="/admin/ventas/cotizaciones"
        style={{ color: "var(--muted)", textDecoration: "none", fontSize: fontSize.sm, marginBottom: spacing.md, display: "inline-block" }}
      >
        ← Volver al listado
      </Link>

      <h2 style={{ fontSize: isMobile ? "1.25rem" : "1.4rem", fontWeight: 700, color: "var(--text)", marginTop: 8, marginBottom: spacing.lg }}>
        Nueva cotización
      </h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <Section title="Cliente">
          <Field label="Razón social *">
            <input
              type="text"
              required
              maxLength={200}
              value={clientLegalName}
              onChange={(e) => setClientLegalName(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Email de contacto *">
            <input
              type="email"
              required
              value={clientContactEmail}
              onChange={(e) => setClientContactEmail(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Section>

        <Section title="Fechas">
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: spacing.md }}>
            <Field label="Fecha de emisión *">
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Válida hasta *">
              <input
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>
        </Section>

        <Section title="Localización del documento">
          <Field label="Idioma">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["es", "en", "pt"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => changeLocale(l)}
                  style={pillStyle(locale === l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Término para «pool»">
            <select value={term} onChange={(e) => setTerm(e.target.value)} style={inputStyle}>
              {SALE_TERMS[locale].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p style={hintStyle}>{`Sustituye el placeholder {term} en el PDF (ej: «Tu polla pre-pagada»).`}</p>
          </Field>
        </Section>

        <Section title="Inversión">
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: spacing.md }}>
            <Field label="Participantes *">
              <input
                type="number"
                required
                min={CORPORATE_FREE_LIMIT + 1}
                value={participants}
                onChange={(e) => setParticipants(parseInt(e.target.value, 10) || 0)}
                style={inputStyle}
              />
            </Field>
            <Field label="Moneda">
              <div style={{ display: "flex", gap: 8 }}>
                {(["COP", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    style={pillStyle(currency === c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {livePreview && (
            <div style={previewBoxStyle}>
              <span style={{ fontSize: fontSize.xs, color: "#166534", fontWeight: fontWeight.semibold }}>
                Total calculado
              </span>
              <span style={{ fontSize: "1.25rem", fontWeight: fontWeight.bold, color: "#166534" }}>
                {livePreview.formatted}
              </span>
            </div>
          )}

          <Field label="Torneo (opcional)">
            <input
              type="text"
              maxLength={200}
              placeholder="Ej. Mundial 2026"
              value={tournament}
              onChange={(e) => setTournament(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Descripción de la inversión (opcional)">
            <textarea
              rows={3}
              maxLength={2000}
              value={investmentDescription}
              onChange={(e) => setInvestmentDescription(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
            />
          </Field>
        </Section>

        <Section title="Presentación">
          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={includeCoverPage}
              onChange={(e) => setIncludeCoverPage(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: colors.brand }}
            />
            <span>Incluir página de portada en el PDF</span>
          </label>

          <Field label="Notas internas (opcional)">
            <textarea
              rows={2}
              maxLength={2000}
              placeholder="Recordatorios para ti — no aparecen en el PDF"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
            />
          </Field>
        </Section>

        {error && (
          <div
            style={{
              padding: 12,
              background: "var(--danger-bg)",
              color: "var(--danger-text)",
              border: "1px solid var(--danger-border)",
              borderRadius: radii.md,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: spacing.md }}>
          <button
            type="button"
            onClick={() => router.push({ pathname: "/admin/ventas/cotizaciones" })}
            disabled={submitting}
            style={secondaryBtnStyle(submitting)}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={primaryBtnStyle(submitting)}
          >
            {submitting ? "Creando…" : "Crear cotización"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Style helpers ─────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: radii.md,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: fontSize.sm,
  minHeight: 44,
  boxSizing: "border-box",
};

const hintStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: fontSize.xs,
  marginTop: 4,
  marginBottom: 0,
};

const previewBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "12px 16px",
  background: "#dcfce7",
  border: "1px solid #86efac",
  borderRadius: radii.md,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "var(--text)",
  fontSize: fontSize.sm,
  cursor: "pointer",
  minHeight: 44,
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: radii.pill,
    border: active ? `1px solid ${colors.brand}` : "1px solid var(--border)",
    background: active ? colors.brandBg : "var(--surface)",
    color: active ? colors.brand : "var(--text)",
    fontWeight: active ? fontWeight.semibold : fontWeight.medium,
    fontSize: fontSize.sm,
    cursor: "pointer",
    minHeight: 44,
  };
}

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "12px 20px",
    borderRadius: radii.md,
    border: "none",
    background: disabled ? "#9ca3af" : colors.brandGradient,
    color: "white",
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
    cursor: disabled ? "not-allowed" : "pointer",
    minHeight: 48,
  };
}

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 20px",
    borderRadius: radii.md,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontWeight: fontWeight.medium,
    fontSize: fontSize.sm,
    cursor: disabled ? "not-allowed" : "pointer",
    minHeight: 48,
  };
}

// ─── Small layout helpers ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: spacing.lg,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: radii.md,
        display: "flex",
        flexDirection: "column",
        gap: spacing.md,
      }}
    >
      <h3 style={{ margin: 0, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: "var(--text)" }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: fontSize.sm, color: "var(--text)", fontWeight: fontWeight.medium }}>{label}</label>
      {children}
    </div>
  );
}
