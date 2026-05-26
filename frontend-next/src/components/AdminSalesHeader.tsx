"use client";

import { Link } from "@/i18n/navigation";
import { colors, fontSize, fontWeight, spacing } from "@/lib/theme";

interface Props {
  active: "quotes" | "ccs";
  isMobile: boolean;
}

export default function AdminSalesHeader({ active, isMobile }: Props) {
  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: isMobile ? "10px 14px" : "10px 18px",
    borderBottom: isActive ? `2px solid ${colors.brand}` : "2px solid transparent",
    color: isActive ? colors.brand : "var(--muted)",
    fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
    textDecoration: "none",
    fontSize: fontSize.sm,
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <Link
        href="/admin/settings/email"
        style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.85rem" }}
      >
        ← Panel Admin
      </Link>
      <h1
        style={{
          fontSize: isMobile ? "1.5rem" : "1.75rem",
          fontWeight: 700,
          color: "var(--text)",
          marginTop: 8,
          marginBottom: 12,
        }}
      >
        Gestión de Ventas
      </h1>
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          overflowX: "auto",
        }}
      >
        <Link href="/admin/ventas/cotizaciones" style={tabStyle(active === "quotes")}>
          Cotizaciones
        </Link>
        <Link href="/admin/ventas/cuentas-de-cobro" style={tabStyle(active === "ccs")}>
          Cuentas de cobro
        </Link>
      </div>
    </div>
  );
}
