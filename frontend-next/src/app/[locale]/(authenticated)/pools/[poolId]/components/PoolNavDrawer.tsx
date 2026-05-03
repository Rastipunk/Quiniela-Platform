"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  useIsMobile,
  BREAKPOINTS,
  TOUCH_TARGET,
  mobileInteractiveStyles,
} from "@/hooks/useIsMobile";
import {
  colors,
  radii,
  spacing,
  fontSize,
  fontWeight,
  shadows,
  zIndex,
} from "@/lib/theme";
import { NotificationBadge } from "@/components/NotificationBadge";

// ── Tab metadata ────────────────────────────────────────────
//
// Section nav for the pool detail page. Below the `tabletLg`
// breakpoint (1024px) we render an off-canvas drawer triggered by
// `<PoolNavTrigger>`; at and above that breakpoint we render a
// persistent left sidebar so wider viewports get the full menu in
// view at all times. URL state stays in `?tab=` to keep deep-links
// intact — the drawer just dispatches `onTabChange`.

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

const PLAYER_ITEMS: NavItem[] = [
  { key: "partidos", icon: "⚽", labelKey: "tabs.matches" },
  { key: "leaderboard", icon: "📊", labelKey: "tabs.leaderboard" },
  { key: "resumen", icon: "📈", labelKey: "tabs.summary" },
  { key: "reglas", icon: "📋", labelKey: "tabs.rules" },
];

const HOST_ITEMS: NavItem[] = [
  { key: "jugadores", icon: "👥", labelKey: "tabs.players" },
  { key: "admin", icon: "⚙️", labelKey: "tabs.admin" },
];

const SIDEBAR_WIDTH_PX = 248;
const DRAWER_MAX_WIDTH = "min(280px, 85%)";

// ── Drawer / sidebar ────────────────────────────────────────

interface PoolNavDrawerProps {
  activeTab: PoolNavTab;
  onTabChange: (tab: PoolNavTab) => void;
  isOpen: boolean;
  onClose: () => void;
  showHostItems: boolean;
  tabBadges: Partial<Record<PoolNavTab, number>>;
  /** Pulse the matches badge when there are imminent deadlines. */
  hasUrgent: boolean;
}

export function PoolNavDrawer({
  activeTab,
  onTabChange,
  isOpen,
  onClose,
  showHostItems,
  tabBadges,
  hasUrgent,
}: PoolNavDrawerProps) {
  const t = useTranslations("pool");
  // Compact = below the tabletLg breakpoint. Above it we mount the
  // persistent sidebar; below it we mount the overlay drawer.
  const isCompact = useIsMobile({ breakpoint: BREAKPOINTS.tabletLg });

  // ESC closes the overlay drawer only when it's actually open.
  useEffect(() => {
    if (!isCompact || !isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isCompact, isOpen, onClose]);

  // Lock body scroll while the overlay drawer is visible so the
  // page underneath can't be scrolled by accident on touch.
  useEffect(() => {
    if (!isCompact || !isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isCompact, isOpen]);

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
          if (isCompact) onClose();
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
          borderLeft: `3px solid ${isActive ? colors.brand : "transparent"}`,
          background: isActive ? colors.brandBg : "transparent",
          color: isActive ? colors.brand : colors.textDark,
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

  function renderGroupLabel(text: string, withTopBorder = false) {
    return (
      <div
        style={{
          padding: `${spacing.lg}px ${spacing.lg}px ${spacing.sm}px`,
          marginTop: withTopBorder ? spacing.sm : 0,
          borderTop: withTopBorder ? `1px solid ${colors.borderLight}` : undefined,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          color: colors.textLight,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {text}
      </div>
    );
  }

  const navItems = (
    <nav
      role="navigation"
      aria-label={t("nav.sectionsTitle")}
      style={{ display: "flex", flexDirection: "column" }}
    >
      {renderGroupLabel(t("nav.playerGroup"))}
      {PLAYER_ITEMS.map(renderItem)}

      {showHostItems && (
        <>
          {renderGroupLabel(t("nav.hostGroup"), true)}
          {HOST_ITEMS.map(renderItem)}
        </>
      )}
    </nav>
  );

  // ── Persistent sidebar (≥1024px) ─────────────────────────
  if (!isCompact) {
    return (
      <aside
        style={{
          position: "sticky",
          top: spacing.lg,
          alignSelf: "flex-start",
          width: SIDEBAR_WIDTH_PX,
          flexShrink: 0,
          background: colors.white,
          border: `1px solid ${colors.borderLight}`,
          borderRadius: radii["3xl"],
          padding: `${spacing.sm}px 0 ${spacing.md}px`,
          boxShadow: shadows.sm,
          overflow: "hidden",
        }}
      >
        {navItems}
      </aside>
    );
  }

  // ── Overlay drawer (<1024px) ────────────────────────────
  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            background: colors.overlay,
            zIndex: zIndex.modal,
            animation: "p4a-nav-fade 0.2s ease",
          }}
        />
      )}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.sectionsTitle")}
        aria-hidden={!isOpen}
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          width: DRAWER_MAX_WIDTH,
          background: colors.white,
          zIndex: zIndex.modalAbove,
          boxShadow: shadows.lg,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          // Prevent screen readers and tab order from reaching the
          // drawer when it's hidden off-screen.
          visibility: isOpen ? "visible" : "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: spacing.lg,
            borderBottom: `1px solid ${colors.borderLight}`,
          }}
        >
          <span
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.bold,
              color: colors.textDark,
            }}
          >
            {t("nav.sectionsTitle")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("nav.closeMenu")}
            style={{
              minWidth: TOUCH_TARGET.minimum,
              minHeight: TOUCH_TARGET.minimum,
              border: "none",
              background: colors.bgLight,
              borderRadius: radii.lg,
              fontSize: fontSize.xl,
              color: colors.textDark,
              cursor: "pointer",
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1 }}>{navItems}</div>
      </aside>

      <style>{`
        @keyframes p4a-nav-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── Inline trigger (visible only on compact viewports) ─────

interface PoolNavTriggerProps {
  activeTab: PoolNavTab;
  onOpen: () => void;
  tabBadges: Partial<Record<PoolNavTab, number>>;
  hasUrgent: boolean;
}

export function PoolNavTrigger({
  activeTab,
  onOpen,
  tabBadges,
  hasUrgent,
}: PoolNavTriggerProps) {
  const t = useTranslations("pool");
  const isCompact = useIsMobile({ breakpoint: BREAKPOINTS.tabletLg });

  if (!isCompact) return null;

  const all = [...PLAYER_ITEMS, ...HOST_ITEMS];
  const current = all.find((item) => item.key === activeTab) ?? PLAYER_ITEMS[0];
  const badge = tabBadges[current.key] ?? 0;
  const pulseBadge = current.key === "partidos" && hasUrgent;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("nav.openMenu")}
      aria-haspopup="dialog"
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        width: "100%",
        padding: `${spacing.md}px ${spacing.lg}px`,
        minHeight: TOUCH_TARGET.comfortable,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: radii["3xl"],
        background: colors.white,
        color: colors.textDark,
        fontSize: fontSize.base,
        fontWeight: fontWeight.semibold,
        cursor: "pointer",
        boxShadow: shadows.sm,
        textAlign: "left",
        ...mobileInteractiveStyles.tapHighlight,
      }}
    >
      {/* Hamburger glyph */}
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 18,
          height: 12,
          flexShrink: 0,
        }}
      >
        <span style={{ height: 2, background: colors.textDark, borderRadius: 2 }} />
        <span style={{ height: 2, background: colors.textDark, borderRadius: 2 }} />
        <span style={{ height: 2, background: colors.textDark, borderRadius: 2 }} />
      </span>
      <span aria-hidden="true" style={{ fontSize: fontSize.xl }}>{current.icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{t(current.labelKey)}</span>
      {badge > 0 && <NotificationBadge count={badge} pulse={pulseBadge} />}
      <span aria-hidden="true" style={{ color: colors.textLight, fontSize: fontSize.lg }}>
        ›
      </span>
    </button>
  );
}
