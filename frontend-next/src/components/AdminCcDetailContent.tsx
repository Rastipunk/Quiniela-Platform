"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { getToken } from "@/lib/auth";
import {
  accountReceivablePdfUrl,
  cancelAccountReceivable,
  getAccountReceivable,
  markAccountReceivablePaid,
  type AccountReceivableRow,
  type AccountReceivableStatus,
} from "@/lib/api";
import { formatPrice } from "@/lib/pricing";
import { useIsMobile } from "@/hooks/useIsMobile";
import { colors, fontSize, fontWeight, spacing, radii } from "@/lib/theme";
import AdminSalesHeader from "./AdminSalesHeader";

interface Props {
  ccId: string;
}

function formatAmount(cc: AccountReceivableRow): string {
  if (cc.currency === "COP" && cc.amountCop !== null) return formatPrice(cc.amountCop, "COP");
  if (cc.currency === "USD" && cc.amountUsdCents !== null) return formatPrice(cc.amountUsdCents / 100, "USD");
  return "—";
}

// Format the redemption code as XXXX-XXXX for display (the wire format
// is the raw 8-digit string).
function formatRedemptionCode(raw: string): string {
  if (raw.length === 8) return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  return raw;
}

function statusMeta(status: AccountReceivableStatus): { bg: string; fg: string; label: string } {
  const map: Record<AccountReceivableStatus, { bg: string; fg: string; label: string }> = {
    PENDING: { bg: "#fef3c7", fg: "#92400e", label: "Pendiente" },
    REDEEMED: { bg: "#dbeafe", fg: "#1e40af", label: "En checkout" },
    PAID: { bg: "#dcfce7", fg: "#166534", label: "Pagada" },
    EXPIRED: { bg: "#f3f4f6", fg: "#374151", label: "Expirada" },
    CANCELLED: { bg: "#fee2e2", fg: "#991b1b", label: "Cancelada" },
  };
  return map[status];
}

export default function AdminCcDetailContent({ ccId }: Props) {
  const isMobile = useIsMobile();
  const [cc, setCc] = useState<AccountReceivableRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [action, setAction] = useState<"" | "paying" | "cancelling">("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getToken();
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const result = await getAccountReceivable(token, ccId);
        if (!cancelled) setCc(result.accountReceivable);
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        if (e.status === 403) {
          if (!cancelled) setAccessDenied(true);
        } else if (e.status === 404) {
          if (!cancelled) setError("Cuenta de cobro no encontrada.");
        } else if (!cancelled) {
          setError(e.message || "Error al cargar la cuenta de cobro");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [ccId]);

  async function handleMarkPaid() {
    if (!cc) return;
    const ok = window.confirm(
      `¿Marcar ${cc.consecutive} como PAGADA? Úsalo solo si el cliente pagó fuera de la plataforma (transferencia, etc.). Estado actual: ${statusMeta(cc.status).label}.`,
    );
    if (!ok) return;
    const token = getToken();
    if (!token) return;
    setAction("paying");
    try {
      await markAccountReceivablePaid(token, cc.id);
      // Refetch for paidAtUtc + updatedAtUtc.
      const { accountReceivable } = await getAccountReceivable(token, cc.id);
      setCc(accountReceivable);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Error al marcar como pagada");
    } finally {
      setAction("");
    }
  }

  async function handleCancel() {
    if (!cc) return;
    const ok = window.confirm(
      `¿Cancelar la cuenta de cobro ${cc.consecutive}? El cliente ya no podrá usarla. La operación es reversible solo emitiendo una nueva.`,
    );
    if (!ok) return;
    const token = getToken();
    if (!token) return;
    setAction("cancelling");
    try {
      await cancelAccountReceivable(token, cc.id);
      setCc({ ...cc, status: "CANCELLED" });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Error al cancelar");
    } finally {
      setAction("");
    }
  }

  if (accessDenied) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center", padding: "0 16px" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: "var(--text)", marginBottom: 8 }}>Acceso Restringido</h2>
        <Link href={{ pathname: "/" }} style={{ color: colors.brand, textDecoration: "none", fontWeight: 600 }}>
          ← Volver al Dashboard
        </Link>
      </div>
    );
  }

  const canMarkPaid = cc && (cc.status === "PENDING" || cc.status === "REDEEMED");
  const canCancel = cc && (cc.status === "PENDING" || cc.status === "REDEEMED");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "24px 16px" : "32px 16px" }}>
      <AdminSalesHeader active="ccs" isMobile={isMobile} />

      <Link
        href={{ pathname: "/admin/ventas/cuentas-de-cobro" }}
        style={{ color: "var(--muted)", textDecoration: "none", fontSize: fontSize.sm, marginBottom: spacing.md, display: "inline-block" }}
      >
        ← Volver al listado
      </Link>

      {loading && <p style={{ color: "var(--muted)" }}>Cargando…</p>}

      {error && (
        <div style={{ padding: 12, background: "var(--danger-bg)", color: "var(--danger-text)", border: "1px solid var(--danger-border)", borderRadius: radii.md }}>
          {error}
        </div>
      )}

      {!loading && cc && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: spacing.lg }}>
            <h2 style={{ fontFamily: "monospace", fontSize: isMobile ? "1.4rem" : "1.8rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
              {cc.consecutive}
            </h2>
            <span style={{ padding: "4px 12px", borderRadius: radii.pill, background: statusMeta(cc.status).bg, color: statusMeta(cc.status).fg, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
              {statusMeta(cc.status).label}
            </span>
          </div>

          {/* Redemption code highlight — the customer types this at checkout */}
          <div
            style={{
              background: colors.brandBg,
              border: `1px solid ${colors.brand}`,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            <div style={{ color: "var(--muted)", fontSize: fontSize.xs, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Código de redención
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "1.6rem", fontWeight: fontWeight.bold, color: colors.brand, letterSpacing: "0.1em" }}>
              {formatRedemptionCode(cc.redemptionCode)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: spacing.lg }}>
            <a
              href={accountReceivablePdfUrl(cc.id)}
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
            {canMarkPaid && (
              <button
                type="button"
                onClick={handleMarkPaid}
                disabled={action !== ""}
                style={{
                  padding: "12px 20px",
                  borderRadius: radii.md,
                  border: `1px solid #166534`,
                  background: "#dcfce7",
                  color: "#166534",
                  fontWeight: fontWeight.semibold,
                  fontSize: fontSize.sm,
                  cursor: action !== "" ? "not-allowed" : "pointer",
                  minHeight: 48,
                }}
              >
                {action === "paying" ? "Marcando…" : "✓ Marcar como pagada"}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={action !== ""}
                style={{
                  padding: "12px 20px",
                  borderRadius: radii.md,
                  border: "1px solid var(--danger-border)",
                  background: "var(--surface)",
                  color: "var(--danger-text)",
                  fontWeight: fontWeight.semibold,
                  fontSize: fontSize.sm,
                  cursor: action !== "" ? "not-allowed" : "pointer",
                  minHeight: 48,
                }}
              >
                {action === "cancelling" ? "Cancelando…" : "Cancelar"}
              </button>
            )}
          </div>

          <DetailSection title="Cliente">
            <KV label="Razón social" value={cc.clientLegalName} />
            {cc.clientNit && <KV label="NIT / Documento" value={cc.clientNit} />}
            <KV label="Email" value={cc.clientContactEmail} />
            {cc.clientCity && <KV label="Ciudad" value={cc.clientCity} />}
          </DetailSection>

          <DetailSection title="Cobro">
            <KV label="Cupos" value={String(cc.targetCapacity)} />
            <KV label="Moneda" value={cc.currency} />
            <KV label="Total" value={formatAmount(cc)} valueWeight={fontWeight.bold} />
            <KV label="En palabras" value={cc.amountInWords} multiline />
            <KV label="Concepto" value={cc.concept} multiline />
            {cc.tournament && <KV label="Torneo" value={cc.tournament} />}
          </DetailSection>

          <DetailSection title="Documento">
            <KV label="Idioma" value={cc.locale.toUpperCase()} />
            <KV label="Término" value={cc.term} />
            <KV label="Fecha de emisión" value={cc.issueDate.slice(0, 10)} />
            <KV label="Válida hasta" value={cc.validUntil.slice(0, 10)} />
            {cc.linkedQuoteId && (
              <KV label="Cotización origen" value={cc.linkedQuoteId.slice(0, 8)} />
            )}
          </DetailSection>

          {cc.notes && (
            <DetailSection title="Notas internas">
              <p style={{ color: "var(--text)", whiteSpace: "pre-wrap", margin: 0, fontSize: fontSize.sm }}>{cc.notes}</p>
            </DetailSection>
          )}

          <DetailSection title="Trazabilidad">
            <KV label="Creada" value={new Date(cc.createdAtUtc).toLocaleString("es-CO")} />
            {cc.redeemedAtUtc && <KV label="En checkout desde" value={new Date(cc.redeemedAtUtc).toLocaleString("es-CO")} />}
            {cc.paidAtUtc && <KV label="Pagada" value={new Date(cc.paidAtUtc).toLocaleString("es-CO")} />}
            {cc.poolPaymentId && <KV label="Pago asociado" value={cc.poolPaymentId.slice(0, 8)} />}
          </DetailSection>
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
      <h3 style={{ margin: 0, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: "var(--text)" }}>{title}</h3>
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
