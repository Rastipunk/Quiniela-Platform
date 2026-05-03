"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  zIndex,
} from "@/lib/theme";
import { getPoolNavMeta, type PoolNavTab } from "@/components/pool/PoolNav";

// Sticky title that anchors the user inside the active section.
// Renders as a full-width dark band right below the navbar — visually
// continues the dark surface so navbar + section header read as a
// single chrome strip on top of the page.
//
// z-index sits at `zIndex.base` so the global navbar's drawer (which
// lives in NavBar's own stacking context at zIndex.sticky) paints on
// top of the header when the user opens the side menu.

const VALID_TABS: ReadonlySet<PoolNavTab> = new Set([
  "partidos",
  "leaderboard",
  "resumen",
  "reglas",
  "jugadores",
  "admin",
]);

// Slightly purpled near-black so the header still belongs to the
// brand instead of feeling like a generic OS toolbar.
const HEADER_BG = "#16121f";
const HEADER_BORDER_BOTTOM = "rgba(255,255,255,0.08)";

export function PoolSectionHeader() {
  const t = useTranslations("pool");
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const rawTab = searchParams.get("tab");
  const activeTab: PoolNavTab =
    rawTab && VALID_TABS.has(rawTab as PoolNavTab)
      ? (rawTab as PoolNavTab)
      : "partidos";

  const { icon, labelKey } = getPoolNavMeta(activeTab);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        // Below NavBar (zIndex.sticky=100) so its drawer covers this
        // band when open — but above page content so it stays
        // readable while users scroll long match lists.
        zIndex: zIndex.base,
        background: HEADER_BG,
        borderBottom: `1px solid ${HEADER_BORDER_BOTTOM}`,
        color: colors.white,
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}
    >
      <h1
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: isMobile
            ? `${spacing.md}px ${spacing.lg}px`
            : `${spacing.md}px ${spacing.xl}px`,
          display: "flex",
          alignItems: "center",
          gap: spacing.md,
          fontSize: isMobile ? fontSize["2xl"] : fontSize["3xl"],
          fontWeight: fontWeight.bold,
          color: colors.white,
          letterSpacing: -0.3,
          lineHeight: 1.2,
        }}
      >
        <span aria-hidden="true" style={{ flexShrink: 0 }}>{icon}</span>
        <span style={{ minWidth: 0 }}>{t(labelKey)}</span>
      </h1>
    </div>
  );
}
