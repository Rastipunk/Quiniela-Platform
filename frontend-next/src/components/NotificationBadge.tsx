"use client";

import { colors } from "@/lib/theme";

// Componente de badge para notificaciones internas
// Sprint 3 - Sistema de Notificaciones
// Estilo: Badge pequeño con azul primary de la app

type NotificationBadgeProps = {
  count: number;
  pulse?: boolean;
  size?: "small" | "medium";
  /**
   * `floating` (default, legacy): badge is `position:absolute` and pokes out
   * from the top-right of its parent. The parent must be `position:relative`
   * and NOT have `overflow:hidden`, or the badge gets clipped.
   *
   * `inline`: badge is a static flex/inline item that participates in the
   * parent's layout. Use this in containers that DO need `overflow:hidden`
   * (sidebars with rounded corners, dropdowns, etc.) so the count stays
   * fully visible regardless of the parent's clip rectangle.
   */
  variant?: "floating" | "inline";
};

export function NotificationBadge({
  count,
  pulse = false,
  size = "medium",
  variant = "floating",
}: NotificationBadgeProps) {
  if (count === 0) return null;

  const dimensions = size === "small"
    ? { minWidth: 16, height: 16, fontSize: 9, padding: "0 4px" }
    : { minWidth: 18, height: 18, fontSize: 10, padding: "0 5px" };

  const positionStyles: React.CSSProperties = variant === "inline"
    ? { position: "static", flexShrink: 0 }
    : { position: "absolute", top: -6, right: -8, zIndex: 10 };

  return (
    <span
      role="status"
      aria-label={`${count > 99 ? "99+" : count} notifications`}
      style={{
        ...positionStyles,
        background: colors.brand,
        color: colors.white,
        borderRadius: 9,
        minWidth: dimensions.minWidth,
        height: dimensions.height,
        fontSize: dimensions.fontSize,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: dimensions.padding,
        boxShadow: "0 1px 3px rgba(37, 99, 235, 0.4)",
        animation: pulse ? "pulse 2s ease-in-out infinite" : "none",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Componente auxiliar para wrapper con posición relativa
type BadgeWrapperProps = {
  children: React.ReactNode;
  badge?: {
    count: number;
    pulse?: boolean;
  };
};

export function BadgeWrapper({ children, badge }: BadgeWrapperProps) {
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      {children}
      {badge && badge.count > 0 && (
        <NotificationBadge
          count={badge.count}
          pulse={badge.pulse}
        />
      )}
    </span>
  );
}
