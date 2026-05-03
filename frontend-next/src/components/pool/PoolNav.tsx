"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
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
import { trackEvent } from "@/lib/analytics";

// ── Types & item config ─────────────────────────────────────
//
// Single source of truth for the pool's section navigation. Used
// by the persistent sidebar at desktop AND by the global navbar's
// mobile drawer so both surfaces stay in sync.

export type PoolNavTab =
  | "partidos"
  | "leaderboard"
  | "resumen"
  | "reglas"
  | "jugadores"
  | "admin";

const VALID_TABS: ReadonlySet<PoolNavTab> = new Set([
  "partidos",
  "leaderboard",
  "resumen",
  "reglas",
  "jugadores",
  "admin",
]);

interface NavItem {
  key: PoolNavTab;
  icon: string;
  labelKey: string;
}

const PLAYER_ITEMS: ReadonlyArray<NavItem> = [
  { key: "partidos", icon: "⚽", labelKey: "tabs.matches" },
  { key: "leaderboard", icon: "📊", labelKey: "tabs.leaderboard" },
  { key: "resumen", icon: "📈", labelKey: "tabs.summary" },
  { key: "reglas", icon: "📋", labelKey: "tabs.rules" },
];

const HOST_ITEMS: ReadonlyArray<NavItem> = [
  { key: "jugadores", icon: "👥", labelKey: "tabs.players" },
  { key: "admin", icon: "⚙️", labelKey: "tabs.admin" },
];

// ── Cross-tree state (layout-level) ─────────────────────────
//
// The global navbar lives in the authenticated layout, above the
// pool page in the React tree. To let the navbar render the pool's
// own sections at the top of its drawer, we hoist a tiny store to
// the layout: the pool page publishes its current snapshot via
// `usePublishPoolNav`, and the navbar reads it via
// `usePoolNavSnapshot`. Outside a pool page the snapshot stays null
// and the navbar falls back to app-only items.

export interface PoolNavSnapshot {
  showHostItems: boolean;
  tabBadges: Partial<Record<PoolNavTab, number>>;
  hasUrgent: boolean;
}

interface PoolNavStore {
  snapshot: PoolNavSnapshot | null;
  setSnapshot: (snapshot: PoolNavSnapshot | null) => void;
}

const PoolNavContext = createContext<PoolNavStore | null>(null);

export function PoolNavRootProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<PoolNavSnapshot | null>(null);
  const value = useMemo<PoolNavStore>(
    () => ({ snapshot, setSnapshot }),
    [snapshot],
  );
  return (
    <PoolNavContext.Provider value={value}>{children}</PoolNavContext.Provider>
  );
}

export function usePoolNavSnapshot(): PoolNavSnapshot | null {
  return useContext(PoolNavContext)?.snapshot ?? null;
}

/**
 * Pool page calls this to publish its current nav state to the
 * layout-level store so the navbar drawer can render pool sections.
 * Snapshot clears automatically on unmount so other routes don't
 * inherit stale pool nav.
 *
 * Implementation note: depends on `setSnapshot` (stable identity from
 * useState) and a stringified `signature`, NEVER on the ctx wrapper.
 * Including `ctx` in deps creates a feedback loop because every
 * setSnapshot call re-memoizes the provider's value, which changes
 * `ctx`, which re-runs the effect — that loop blocked all click
 * handlers in production.
 */
export function usePublishPoolNav(snapshot: PoolNavSnapshot | null) {
  const ctx = useContext(PoolNavContext);
  const setSnapshot = ctx?.setSnapshot;

  // Hold the latest snapshot in a ref so the effect can apply it
  // without listing `snapshot` (a fresh object every render) in deps.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const signature = snapshot
    ? `${snapshot.showHostItems}|${snapshot.hasUrgent}|${JSON.stringify(snapshot.tabBadges)}`
    : null;

  useEffect(() => {
    if (!setSnapshot) return;
    setSnapshot(snapshotRef.current);
    return () => setSnapshot(null);
  }, [setSnapshot, signature]);
}

// ── Shared item list renderer ───────────────────────────────
//
// PoolNavItems is mounted by both the desktop sidebar and the
// navbar drawer. It owns the navigation: reads the active tab from
// the URL, and on click swaps `?tab=` via relative `router.replace`
// so the current path (and locale prefix) are preserved.

interface PoolNavItemsProps {
  showHostItems: boolean;
  tabBadges: Partial<Record<PoolNavTab, number>>;
  hasUrgent: boolean;
  /** Fired after a tab is selected — typically to close a drawer. */
  onAfterSelect?: () => void;
  /** Visual variant. "dark" is for the navbar drawer. */
  variant?: "light" | "dark";
}

export function PoolNavItems({
  showHostItems,
  tabBadges,
  hasUrgent,
  onAfterSelect,
  variant = "light",
}: PoolNavItemsProps) {
  const t = useTranslations("pool");
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDark = variant === "dark";

  const rawTab = searchParams.get("tab");
  const activeTab: PoolNavTab =
    rawTab && VALID_TABS.has(rawTab as PoolNavTab)
      ? (rawTab as PoolNavTab)
      : "partidos";

  function handleSelect(tab: PoolNavTab) {
    trackEvent("tab_changed", { tab });
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "partidos") params.delete("tab");
    else params.set("tab", tab);
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
    onAfterSelect?.();
  }

  const inactiveColor = isDark ? "#fff" : colors.textDark;
  const activeBg = isDark ? "rgba(255,255,255,0.08)" : colors.brandBg;
  const activeColor = isDark ? "#fff" : colors.brand;
  const activeAccent = isDark ? colors.brandLight : colors.brand;
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
        onClick={() => handleSelect(item.key)}
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
          borderLeft: `3px solid ${isActive ? activeAccent : "transparent"}`,
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
      {PLAYER_ITEMS.map(renderItem)}
      {showHostItems && (
        <>
          {renderGroupLabel(t("nav.hostGroup"), true)}
          {HOST_ITEMS.map(renderItem)}
        </>
      )}
    </nav>
  );
}
