"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { getToken } from "@/lib/auth";
import {
  createAccountReceivable,
  getQuote,
  type SaleCurrency,
  type SaleLocale,
} from "@/lib/api";
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

// 30 days mirrors the quote default — CCs usually expire on the same
// rhythm as the quote that backs them.
const DEFAULT_VALIDITY_DAYS = 30;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Build the default concept text in the right language using the
// chosen term. Admin can edit before submit.
function defaultConcept(locale: SaleLocale, term: string, capacity: number): string {
  if (locale === "en") return `Pre-payment for your ${term} for ${capacity} participants.`;
  if (locale === "pt") return `Pré-pagamento do seu ${term} para ${capacity} participantes.`;
  return `Pre-pago de tu ${term} para ${capacity} participantes.`;
}

export default function AdminCcCreateContent() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuoteId = searchParams.get("fromQuoteId") ?? undefined;

  const initialIssue = today();
  const initialValid = plusDays(initialIssue, DEFAULT_VALIDITY_DAYS);

  const [clientLegalName, setClientLegalName] = useState("");
  const [clientNit, setClientNit] = useState("");
  const [clientContactEmail, setClientContactEmail] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [issueDate, setIssueDate] = useState(initialIssue);
  const [validUntil, setValidUntil] = useState(initialValid);
  const [locale, setLocale] = useState<SaleLocale>("es");
  const [term, setTerm] = useState<string>(DEFAULT_TERM_FOR_LOCALE.es);
  const [targetCapacity, setTargetCapacity] = useState<number>(50);
  const [currency, setCurrency] = useState<SaleCurrency>("COP");
  const [concept, setConcept] = useState(defaultConcept("es", DEFAULT_TERM_FOR_LOCALE.es, 50));
  const [tournament, setTournament] = useState("");
  const [notes, setNotes] = useState("");
  const [linkedQuoteId, setLinkedQuoteId] = useState<string | undefined>(undefined);
  const [linkedQuoteConsec, setLinkedQuoteConsec] = useState<string | null>(null);

  // True until the user manually edits `concept` so the prefilled
  // template tracks the term/capacity/locale changes; once edited we
  // stop overriding so the admin's text is preserved.
  const [conceptIsAuto, setConceptIsAuto] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  // Pre-fill from a quote when ?fromQuoteId=… is set.
  useEffect(() => {
    let cancelled = false;
    if (!fromQuoteId) return;
    async function load() {
      const token = getToken();
      if (!token) return;
      try {
        const { quote } = await getQuote(token, fromQuoteId!);
        if (cancelled) return;
        setClientLegalName(quote.clientLegalName);
        setClientContactEmail(quote.clientContactEmail);
        setLocale(quote.locale);
        setTerm(quote.term);
        setTargetCapacity(quote.participants);
        setCurrency(quote.currency);
        setTournament(quote.tournament ?? "");
        setLinkedQuoteId(quote.id);
        setLinkedQuoteConsec(quote.consecutive);
        setConcept(defaultConcept(quote.locale, quote.term, quote.participants));
        setConceptIsAuto(true);
      } catch (err: unknown) {
        const e = err as { message?: string };
        if (!cancelled) setPrefillError(e.message || "No se pudo cargar la cotización origen");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [fromQuoteId]);

  // Live amount preview.
  const livePreview = useMemo(() => {
    if (!targetCapacity || targetCapacity <= CORPORATE_FREE_LIMIT) return null;
    if (currency === "COP") {
      const cop = getUpgradePrice("corporate", CORPORATE_FREE_LIMIT, targetCapacity);
      return { amount: cop, formatted: formatPrice(cop, "COP") };
    }
    const usd = getUpgradePriceUsd("corporate", CORPORATE_FREE_LIMIT, targetCapacity);
    return { amount: usd, formatted: formatPrice(usd, "USD") };
  }, [targetCapacity, currency]);

  // Keep the auto-concept in sync until the admin touches it.
  useEffect(() => {
    if (conceptIsAuto) {
      setConcept(defaultConcept(locale, term, targetCapacity));
    }
  }, [locale, term, targetCapacity, conceptIsAuto]);

  function changeLocale(next: SaleLocale) {
    setLocale(next);
    setTerm(DEFAULT_TERM_FOR_LOCALE[next]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (targetCapacity <= CORPORATE_FREE_LIMIT) {
      setError(`Los cupos (${targetCapacity}) están dentro del cupo gratuito (${CORPORATE_FREE_LIMIT}). No hay nada que cobrar.`);
      return;
    }

    const token = getToken();
    if (!token) {
      setError("Sesión expirada. Inicia sesión de nuevo.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createAccountReceivable(token, {
        clientLegalName: clientLegalName.trim(),
        clientNit: clientNit.trim() || undefined,
        clientContactEmail: clientContactEmail.trim().toLowerCase(),
        clientCity: clientCity.trim() || undefined,
        issueDate,
        validUntil,
        locale,
        term,
        concept: concept.trim(),
        tournament: tournament.trim() || undefined,
        notes: notes.trim() || undefined,
        targetCapacity,
        currency,
        poolType: "corporate",
        linkedQuoteId,
      });
      router.push({ pathname: "/admin/ventas/cuentas-de-cobro/[id]", params: { id: result.id } });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      setError(e.message || "Error al crear la cuenta de cobro");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "24px 16px" : "32px 16px" }}>
      <AdminSalesHeader active="ccs" isMobile={isMobile} />

      <Link
        href={{ pathname: "/admin/ventas/cuentas-de-cobro" }}
        style={{ color: "var(--muted)", textDecoration: "none", fontSize: fontSize.sm, marginBottom: spacing.md, display: "inline-block" }}
      >
        ← Volver al listado
      </Link>

      <h2 style={{ fontSize: isMobile ? "1.25rem" : "1.4rem", fontWeight: 700, color: "var(--text)", marginTop: 8, marginBottom: spacing.lg }}>
        Nueva cuenta de cobro
      </h2>

      {linkedQuoteConsec && (
        <div
          style={{
            padding: 12,
            background: colors.brandBg,
            border: `1px solid ${colors.brand}`,
            borderRadius: radii.md,
            marginBottom: spacing.lg,
            fontSize: fontSize.sm,
            color: "var(--text)",
          }}
        >
          Pre-rellenado desde la cotización <strong style={{ fontFamily: "monospace" }}>{linkedQuoteConsec}</strong>.
          El cliente y los detalles vienen de la cotización; puedes ajustarlos antes de emitir.
        </div>
      )}

      {prefillError && (
        <div
          style={{
            padding: 12,
            background: "var(--danger-bg)",
            color: "var(--danger-text)",
            border: "1px solid var(--danger-border)",
            borderRadius: radii.md,
            marginBottom: spacing.lg,
          }}
        >
          {prefillError}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <Section title="Cliente">
          <Field label="Razón social *">
            <input
              type="text" required maxLength={200}
              value={clientLegalName}
              onChange={(e) => setClientLegalName(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: spacing.md }}>
            <Field label="NIT / Documento (opcional)">
              <input
                type="text" maxLength={50}
                value={clientNit}
                onChange={(e) => setClientNit(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Ciudad (opcional)">
              <input
                type="text" maxLength={100}
                value={clientCity}
                onChange={(e) => setClientCity(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="Email de contacto *">
            <input
              type="email" required
              value={clientContactEmail}
              onChange={(e) => setClientContactEmail(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Section>

        <Section title="Fechas">
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: spacing.md }}>
            <Field label="Fecha de emisión *">
              <input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Válida hasta *">
              <input type="date" required value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </Section>

        <Section title="Localización del documento">
          <Field label="Idioma">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["es", "en", "pt"] as const).map((l) => (
                <button key={l} type="button" onClick={() => changeLocale(l)} style={pillStyle(locale === l)}>
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
          </Field>
        </Section>

        <Section title="Inversión">
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: spacing.md }}>
            <Field label="Cupos a pre-pagar *">
              <input
                type="number" required min={CORPORATE_FREE_LIMIT + 1}
                value={targetCapacity}
                onChange={(e) => setTargetCapacity(parseInt(e.target.value, 10) || 0)}
                style={inputStyle}
              />
            </Field>
            <Field label="Moneda">
              <div style={{ display: "flex", gap: 8 }}>
                {(["COP", "USD"] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setCurrency(c)} style={pillStyle(currency === c)}>{c}</button>
                ))}
              </div>
            </Field>
          </div>

          {livePreview && (
            <div style={previewBoxStyle}>
              <span style={{ fontSize: fontSize.xs, color: "#166534", fontWeight: fontWeight.semibold }}>Total a cobrar</span>
              <span style={{ fontSize: "1.25rem", fontWeight: fontWeight.bold, color: "#166534" }}>{livePreview.formatted}</span>
            </div>
          )}

          <Field label="Concepto (aparece en el PDF) *">
            <textarea
              required rows={3} maxLength={1000}
              value={concept}
              onChange={(e) => {
                setConcept(e.target.value);
                setConceptIsAuto(false);
              }}
              style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
            />
            {conceptIsAuto && (
              <p style={hintStyle}>Generado automáticamente a partir del término y los cupos. Edítalo si quieres otro texto.</p>
            )}
          </Field>

          <Field label="Torneo (opcional)">
            <input
              type="text" maxLength={200} placeholder="Ej. Mundial 2026"
              value={tournament}
              onChange={(e) => setTournament(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Section>

        <Section title="Notas">
          <Field label="Notas internas (opcional)">
            <textarea
              rows={2} maxLength={2000}
              placeholder="Recordatorios para ti — no aparecen en el PDF"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
            />
          </Field>
        </Section>

        {error && (
          <div style={{ padding: 12, background: "var(--danger-bg)", color: "var(--danger-text)", border: "1px solid var(--danger-border)", borderRadius: radii.md }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: spacing.md }}>
          <button type="button" onClick={() => router.push({ pathname: "/admin/ventas/cuentas-de-cobro" })} disabled={submitting} style={secondaryBtnStyle(submitting)}>
            Cancelar
          </button>
          <button type="submit" disabled={submitting} style={primaryBtnStyle(submitting)}>
            {submitting ? "Creando…" : "Crear cuenta de cobro"}
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
