"use client";

import {
  useIsMobile,
  BREAKPOINTS,
} from "@/hooks/useIsMobile";
import {
  colors,
  radii,
  spacing,
  shadows,
} from "@/lib/theme";
import {
  PoolNavItems,
  type PoolNavTab,
} from "@/components/pool/PoolNav";

// Persistent left sidebar shown on viewports ≥ tabletLg (1024px).
// Below that breakpoint, the consolidated mobile drawer in NavBar
// renders the same items at the top of the global menu — see
// `usePoolNavSnapshot` in components/pool/PoolNav.tsx.

const SIDEBAR_WIDTH_PX = 248;

interface Props {
  showHostItems: boolean;
  showBrandingTab: boolean;
  tabBadges: Partial<Record<PoolNavTab, number>>;
  hasUrgent: boolean;
}

export function PoolNavDrawer({ showHostItems, showBrandingTab, tabBadges, hasUrgent }: Props) {
  const isCompact = useIsMobile({ breakpoint: BREAKPOINTS.tabletLg });
  if (isCompact) return null;

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
      <PoolNavItems
        showHostItems={showHostItems}
        showBrandingTab={showBrandingTab}
        tabBadges={tabBadges}
        hasUrgent={hasUrgent}
      />
    </aside>
  );
}

export type { PoolNavTab };
