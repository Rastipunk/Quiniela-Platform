"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  TOUCH_TARGET,
  mobileInteractiveStyles,
} from "@/hooks/useIsMobile";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
} from "@/lib/theme";
import { NotificationBadge } from "@/components/NotificationBadge";

// ── Types ──────────────────────────────────────────────────────
//
// Single source of truth for the pool's section navigation. Used by
// the persistent sidebar at desktop (PoolNavDrawer) AND by the
// global navbar's mobile drawer (NavBar) so a host has one place to
// reach every section regardless of viewport.

export type PoolNavTab =
  | "partidos"
  | "leaderboard"
  | "resumen"
  | "reglas"
  | "jugadores"
  | "admin";

interface NavItem {
  key: PoolNavTab;
  icon: string;
  labelKey: string;
}

export const POOL_NAV_PLAYER_ITEMS: ReadonlyArray<NavItem> = [
  { key: "partidos", icon: "⚽", labelKey: "tabs.matches" },
  { key: "leaderboard", icon: "📊", labelKey: "tabs.leaderboard" },
  { key: "resumen", icon: "📈", labelKey: "tabs.summary" },
  { key: "reglas", icon: "📋", labelKey: "tabs.rules" },
];

export const POOL_NAV_HOST_ITEMS: ReadonlyArray<NavItem> = [
  { key: "jugadores", icon: "👥", labelKey: "tabs.players" },
  { key: "admin", icon: "⚙️", labelKey: "tabs.admin" },
];

// ── Context ────────────────────────────────────────────────────
//
// Pool detail page publishes its nav state via this provider so the
// global NavBar can render pool sections at the top of its drawer
// without having to refetch overview data or duplicate role gating.

export interface PoolNavContextValue {
  activeTab: PoolNavTab;
  onTabChange: (tab: PoolNavTab) => void;
  showHostItems: boolean;
  tabBadges: Partial<Record<PoolNavTab, number>>;
  /** Pulse the matches badge when there are imminent deadlines. */
  hasUrgent: boolean;
}

const PoolNavContext = createContext<PoolNavContextValue | null>(null);

export function PoolNavProvider({
  value,
  children,
}: {
  value: PoolNavContextValue;
  children: ReactNode;
}) {
  return (
    <PoolNavContext.Provider value={value}>{children}</PoolNavContext.Provider>
  );
}

export function usePoolNavContext(): PoolNavContextValue | null {
  return useContext(PoolNavContext);
}

// ── Shared item list renderer ─────────────────────────────────
//
// Renders the player + (optional) host sections with badges and
// active-state styling. Both the desktop sidebar and the navbar
// drawer mount this same list so behaviour stays consistent.

interface PoolNavItemsProps {
  activeTab: PoolNavTab;
  onTabChange: (tab: PoolNavTab) => void;
  showHostItems: boolean;
  tabBadges: Partial<Record<PoolNavTab, number>>;
  hasUrgent: boolean;
  /** Optional callback fired after a tab is selected (e.g. close drawer). */
  onAfterSelect?: () => void;
  /** Variant: dark (navbar drawer) or light (sidebar). */
  variant?: "light" | "dark";
}

export function PoolNavItems({
  activeTab,
  onTabChange,
  showHostItems,
  tabBadges,
  hasUrgent,
  onAfterSelect,
  variant = "light",
}: PoolNavItemsProps) {
  const t = useTranslations("pool");
  const isDark = variant === "dark";

  const inactiveColor = isDark ? "#fff" : colors.textDark;
  const activeBg = isDark ? "rgba(255,255,255,0.08)" : colors.brandBg;
  const activeColor = isDark ? "#fff" : colors.brand;
  const groupColor = isDark ? "rgba(255,255,255,0.55)" : colors.textLight;
  const dividerColor = isDark ? "rgba(255,255,255,0.1)" : colors.borderLight;

  function renderItem(item: NavItem) {
    const isActive = activeTab === item.key;
    const badge = tabBadges[item.key] ?? 0;
    const pulseBadge = item.key === "partidos" && hasUrgent;
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => {
          onTabChange(item.key);
          onAfterSelect?.();
        }}
        aria-current={isActive ? "page" : undefined}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: spacing.md,
          width: "100%",
          padding: `${spacing.md}px ${spacing.lg}px`,
          minHeight: TOUCH_TARGET.comfortable,
          border: "none",
          borderLeft: `3px solid ${isActive ? (isDark ? colors.brandLight : colors.brand) : "transparent"}`,
          background: isActive ? activeBg : "transparent",
          color: isActive ? activeColor : inactiveColor,
          fontWeight: isActive ? fontWeight.bold : fontWeight.medium,
          fontSize: fontSize.base,
          textAlign: "left",
          cursor: "pointer",
          transition: "background 0.15s ease, color 0.15s ease",
          ...mobileInteractiveStyles.tapHighlight,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: fontSize.xl, flexShrink: 0 }}>
          {item.icon}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>{t(item.labelKey)}</span>
        {badge > 0 && <NotificationBadge count={badge} pulse={pulseBadge} />}
      </button>
    );
  }

  function renderGroupLabel(text: string, withTopBorder: boolean) {
    return (
      <div
        style={{
          padding: `${spacing.lg}px ${spacing.lg}px ${spacing.sm}px`,
          marginTop: withTopBorder ? spacing.sm : 0,
          borderTop: withTopBorder ? `1px solid ${dividerColor}` : undefined,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          color: groupColor,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {text}
      </div>
    );
  }

  return (
    <nav
      role="navigation"
      aria-label={t("nav.sectionsTitle")}
      style={{ display: "flex", flexDirection: "column" }}
    >
      {renderGroupLabel(t("nav.playerGroup"), false)}
      {POOL_NAV_PLAYER_ITEMS.map(renderItem)}
      {showHostItems && (
        <>
          {renderGroupLabel(t("nav.hostGroup"), true)}
          {POOL_NAV_HOST_ITEMS.map(renderItem)}
        </>
      )}
    </nav>
  );
}
