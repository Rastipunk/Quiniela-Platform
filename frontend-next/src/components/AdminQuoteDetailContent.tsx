"use client";

import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { getToken } from "@/lib/auth";
import {
  cancelQuote,
  getQuote,
  quotePdfUrl,
  type QuoteRow,
  type QuoteStatus,
} from "@/lib/api";
import { formatPrice } from "@/lib/pricing";
import { useIsMobile } from "@/hooks/useIsMobile";
import { colors, fontSize, fontWeight, spacing, radii } from "@/lib/theme";
import AdminSalesHeader from "./AdminSalesHeader";

interface Props {
  quoteId: string;
}

function formatAmount(q: QuoteRow): string {
  if (q.currency === "COP" && q.amountCop !== null) return formatPrice(q.amountCop, "COP");
  if (q.currency === "USD" && q.amountUsdCents !== null) return formatPrice(q.amountUsdCents / 100, "USD");
  return "—";
}

function statusMeta(status: QuoteStatus): { bg: string; fg: string; label: string } {
  const map: Record<QuoteStatus, { bg: string; fg: string; label: string }> = {
    ACTIVE: { bg: "#dcfce7", fg: "#166534", label: "Activa" },
    EXPIRED: { bg: "#f3f4f6", fg: "#374151", label: "Expirada" },
    CANCELLED: { bg: "#fee2e2", fg: "#991b1b", label: "Cancelada" },
  };
  return map[status];
}

export default function AdminQuoteDetailContent({ quoteId }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getToken();
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const result = await getQuote(token, quoteId);
        if (!cancelled) setQuote(result.quote);
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        if (e.status === 403) {
          if (!cancelled) setAccessDenied(true);
        } else if (e.status === 404) {
          if (!cancelled) setError("Cotización no encontrada.");
        } else if (!cancelled) {
          setError(e.message || "Error al cargar la cotización");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  async function handleCancel() {
    if (!quote) return;
    const ok = window.confirm(
      `¿Cancelar la cotización ${quote.consecutive}? Esto cambia su estado a CANCELLED. La operación es reversible solo creando una nueva.`,
    );
    if (!ok) return;
    const token = getToken();
    if (!token) return;
    setCancelling(true);
    try {
      await cancelQuote(token, quote.id);
      setQuote({ ...quote, status: "CANCELLED" });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Error al cancelar");
    } finally {
      setCancelling(false);
    }
  }

  if (accessDenied) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center", padding: "0 16px" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: "var(--text)", marginBottom: 8 }}>Acceso Restringido</h2>
        <Link href="/" style={{ color: colors.brand, textDecoration: "none", fontWeight: 600 }}>
          ← Volver al Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "24px 16px" : "32px 16px" }}>
      <AdminSalesHeader active="quotes" isMobile={isMobile} />

      <Link
        href="/admin/ventas/cotizaciones"
        style={{ color: "var(--muted)", textDecoration: "none", fontSize: fontSize.sm, marginBottom: spacing.md, display: "inline-block" }}
      >
        ← Volver al listado
      </Link>

      {loading && <p style={{ color: "var(--muted)" }}>Cargando…</p>}

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

      {!loading && quote && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: spacing.lg,
            }}
          >
            <h2
              style={{
                fontFamily: "monospace",
                fontSize: isMobile ? "1.4rem" : "1.8rem",
                fontWeight: 700,
                color: "var(--text)",
                margin: 0,
              }}
            >
              {quote.consecutive}
            </h2>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: radii.pill,
                background: statusMeta(quote.status).bg,
                color: statusMeta(quote.status).fg,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
              }}
            >
              {statusMeta(quote.status).label}
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: spacing.lg }}>
            <a
              href={quotePdfUrl(quote.id)}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "12px 20px",
                borderRadius: radii.md,
                background: colors.brandGradient,
                color: "white",
                textDecoration: "none",
                fontWeight: fontWeight.semibold,
                fontSize: fontSize.sm,
                minHeight: 48,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              📄 Descargar PDF
            </a>
            {quote.status === "ACTIVE" && (
              <>
                <Link
                  href={{ pathname: "/admin/ventas/cuentas-de-cobro/nueva", query: { fromQuoteId: quote.id } }}
                  style={{
                    padding: "12px 20px",
                    borderRadius: radii.md,
                    border: `1px solid ${colors.brand}`,
                    background: "var(--surface)",
                    color: colors.brand,
                    fontWeight: fontWeight.semibold,
                    fontSize: fontSize.sm,
                    textDecoration: "none",
                    minHeight: 48,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  → Emitir cuenta de cobro
                </Link>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  style={{
                    padding: "12px 20px",
                    borderRadius: radii.md,
                    border: "1px solid var(--danger-border)",
                    background: "var(--surface)",
                    color: "var(--danger-text)",
                    fontWeight: fontWeight.semibold,
                    fontSize: fontSize.sm,
                    cursor: cancelling ? "not-allowed" : "pointer",
                    minHeight: 48,
                  }}
                >
                  {cancelling ? "Cancelando…" : "Cancelar cotización"}
                </button>
              </>
            )}
          </div>

          <DetailSection title="Cliente">
            <KV label="Razón social" value={quote.clientLegalName} />
            <KV label="Email" value={quote.clientContactEmail} />
          </DetailSection>

          <DetailSection title="Inversión">
            <KV label="Participantes" value={String(quote.participants)} />
            <KV label="Moneda" value={quote.currency} />
            <KV label="Total" value={formatAmount(quote)} valueWeight={fontWeight.bold} />
            {quote.tournament && <KV label="Torneo" value={quote.tournament} />}
            {quote.investmentDescription && (
              <KV label="Descripción" value={quote.investmentDescription} multiline />
            )}
          </DetailSection>

          <DetailSection title="Documento">
            <KV label="Idioma" value={quote.locale.toUpperCase()} />
            <KV label="Término" value={quote.term} />
            <KV label="Página de portada" value={quote.includeCoverPage ? "Sí" : "No"} />
            <KV label="Fecha de emisión" value={quote.issueDate.slice(0, 10)} />
            <KV label="Válida hasta" value={quote.validUntil.slice(0, 10)} />
          </DetailSection>

          {quote.notes && (
            <DetailSection title="Notas internas">
              <p style={{ color: "var(--text)", whiteSpace: "pre-wrap", margin: 0, fontSize: fontSize.sm }}>
                {quote.notes}
              </p>
            </DetailSection>
          )}

          <p style={{ color: "var(--muted)", fontSize: fontSize.xs, marginTop: spacing.lg }}>
            Creada el {new Date(quote.createdAtUtc).toLocaleString("es-CO")}
          </p>
        </>
      )}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: spacing.lg,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: radii.md,
        marginBottom: spacing.md,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: fontSize.md,
          fontWeight: fontWeight.semibold,
          color: "var(--text)",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function KV({
  label,
  value,
  valueWeight,
  multiline,
}: {
  label: string;
  value: string;
  valueWeight?: number;
  multiline?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: multiline ? "1fr" : "minmax(160px, 30%) 1fr",
        gap: multiline ? 4 : 12,
        alignItems: "baseline",
      }}
    >
      <span style={{ color: "var(--muted)", fontSize: fontSize.xs, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </span>
      <span
        style={{
          color: "var(--text)",
          fontSize: fontSize.sm,
          fontWeight: valueWeight ?? fontWeight.medium,
          whiteSpace: multiline ? "pre-wrap" : "normal",
        }}
      >
        {value}
      </span>
    </div>
  );
}
