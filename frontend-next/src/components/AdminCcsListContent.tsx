"use client";

import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { getToken } from "@/lib/auth";
import {
  listAccountReceivables,
  type AccountReceivableRow,
  type AccountReceivableStatus,
  type ListAccountReceivablesResponse,
} from "@/lib/api";
import { formatPrice } from "@/lib/pricing";
import { useIsMobile } from "@/hooks/useIsMobile";
import { colors, fontSize, fontWeight, spacing, radii } from "@/lib/theme";
import AdminSalesHeader from "./AdminSalesHeader";

const PAGE_LIMIT = 25;

function formatCurrency(row: AccountReceivableRow): string {
  if (row.currency === "COP" && row.amountCop !== null) return formatPrice(row.amountCop, "COP");
  if (row.currency === "USD" && row.amountUsdCents !== null) return formatPrice(row.amountUsdCents / 100, "USD");
  return "—";
}

function StatusBadge({ status }: { status: AccountReceivableStatus }) {
  const map: Record<AccountReceivableStatus, { bg: string; fg: string; label: string }> = {
    PENDING: { bg: "#fef3c7", fg: "#92400e", label: "Pendiente" },
    REDEEMED: { bg: "#dbeafe", fg: "#1e40af", label: "En checkout" },
    PAID: { bg: "#dcfce7", fg: "#166534", label: "Pagada" },
    EXPIRED: { bg: "#f3f4f6", fg: "#374151", label: "Expirada" },
    CANCELLED: { bg: "#fee2e2", fg: "#991b1b", label: "Cancelada" },
  };
  const s = map[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: radii.pill,
        background: s.bg,
        color: s.fg,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export default function AdminCcsListContent() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [data, setData] = useState<ListAccountReceivablesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [clientEmail, setClientEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountReceivableStatus | "">("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getToken();
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const result = await listAccountReceivables(token, {
          clientEmail: clientEmail || undefined,
          status: statusFilter || undefined,
          page,
          limit: PAGE_LIMIT,
        });
        if (!cancelled) setData(result);
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        if (e.status === 403) {
          if (!cancelled) setAccessDenied(true);
        } else if (!cancelled) {
          setError(e.message || "Error al cargar cuentas de cobro");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [clientEmail, statusFilter, page]);

  if (accessDenied) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center", padding: "0 16px" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: "var(--text)", marginBottom: 8 }}>Acceso Restringido</h2>
        <p style={{ color: "var(--muted)" }}>Solo administradores pueden ver esta página.</p>
        <Link href={{ pathname: "/" }} style={{ color: colors.brand, textDecoration: "none", fontWeight: 600 }}>
          ← Volver al Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "24px 16px" : "32px 16px" }}>
      <AdminSalesHeader active="ccs" isMobile={isMobile} />

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "stretch" }}>
        <input
          type="email"
          placeholder="Filtrar por email"
          value={clientEmail}
          onChange={(e) => { setClientEmail(e.target.value); setPage(0); }}
          style={{
            flex: "1 1 200px", minWidth: 0,
            padding: "10px 12px", borderRadius: radii.md,
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text)", fontSize: fontSize.sm, minHeight: 44,
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as AccountReceivableStatus | ""); setPage(0); }}
          style={{
            flex: "0 0 auto", padding: "10px 12px", borderRadius: radii.md,
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text)", fontSize: fontSize.sm, minHeight: 44,
          }}
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendientes</option>
          <option value="REDEEMED">En checkout</option>
          <option value="PAID">Pagadas</option>
          <option value="EXPIRED">Expiradas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
        <button
          type="button"
          onClick={() => router.push({ pathname: "/admin/ventas/cuentas-de-cobro/nueva" })}
          style={{
            padding: "10px 16px", borderRadius: radii.md, border: "none",
            background: colors.brandGradient, color: "white",
            fontWeight: fontWeight.semibold, fontSize: fontSize.sm,
            cursor: "pointer", minHeight: 44, whiteSpace: "nowrap",
          }}
        >
          + Nueva cuenta de cobro
        </button>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>Cargando…</p>}
      {error && (
        <div style={{ padding: 12, background: "var(--danger-bg)", color: "var(--danger-text)", border: "1px solid var(--danger-border)", borderRadius: radii.md, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!loading && data && data.items.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", background: "var(--surface)", borderRadius: radii.md, border: "1px dashed var(--border)" }}>
          No hay cuentas de cobro todavía. Crea la primera con el botón de arriba.
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.items.map((cc) => (
                <Link
                  key={cc.id}
                  href={{ pathname: "/admin/ventas/cuentas-de-cobro/[id]", params: { id: cc.id } }}
                  style={{
                    display: "block", padding: 14, borderRadius: radii.md,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    textDecoration: "none", color: "var(--text)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: fontWeight.semibold, fontFamily: "monospace" }}>{cc.consecutive}</span>
                    <StatusBadge status={cc.status} />
                  </div>
                  <div style={{ color: "var(--text)", fontSize: fontSize.sm, marginBottom: 4 }}>{cc.clientLegalName}</div>
                  <div style={{ color: "var(--muted)", fontSize: fontSize.xs, marginBottom: 6 }}>{cc.clientContactEmail}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: fontSize.xs }}>
                    <span>{cc.targetCapacity} cupos</span>
                    <span style={{ fontWeight: fontWeight.semibold, color: "var(--text)" }}>{formatCurrency(cc)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fontSize.sm }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    <th style={thStyle}>Consecutivo</th>
                    <th style={thStyle}>Cliente</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Cupos</th>
                    <th style={thStyle}>Total</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Emitida</th>
                    <th style={thStyle}>Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((cc) => (
                    <tr
                      key={cc.id}
                      onClick={() => router.push({ pathname: "/admin/ventas/cuentas-de-cobro/[id]", params: { id: cc.id } })}
                      style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                    >
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: fontWeight.semibold }}>{cc.consecutive}</td>
                      <td style={tdStyle}>{cc.clientLegalName}</td>
                      <td style={tdStyle}>{cc.clientContactEmail}</td>
                      <td style={tdStyle}>{cc.targetCapacity}</td>
                      <td style={{ ...tdStyle, fontWeight: fontWeight.semibold }}>{formatCurrency(cc)}</td>
                      <td style={tdStyle}><StatusBadge status={cc.status} /></td>
                      <td style={tdStyle}>{cc.issueDate.slice(0, 10)}</td>
                      <td style={tdStyle}>{cc.validUntil.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center", marginTop: spacing.lg }}>
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={paginationBtn(page === 0)}>
                ← Anterior
              </button>
              <span style={{ color: "var(--muted)", fontSize: fontSize.sm }}>
                Página {data.page + 1} de {data.totalPages}
              </span>
              <button type="button" disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)} style={paginationBtn(page + 1 >= data.totalPages)}>
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "10px 12px", fontWeight: 600,
  color: "var(--muted)", fontSize: "0.8rem",
  textTransform: "uppercase", letterSpacing: "0.03em",
};

const tdStyle: React.CSSProperties = {
  padding: "12px", color: "var(--text)",
};

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: radii.md,
    border: "1px solid var(--border)", background: "var(--surface)",
    color: disabled ? "var(--muted)" : "var(--text)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: fontSize.sm, opacity: disabled ? 0.5 : 1, minHeight: 40,
  };
}
