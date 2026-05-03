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

// Sticky title that anchors the user inside the active section. Sits
// at the top of the main column (just under the pool header) and
// pins to the viewport top while scrolling so the section identity
// is never lost on long pages (matches list, leaderboard, etc.).
//
// Pulls the active tab from `?tab=` in the URL — same source of
// truth used by the drawer and sidebar — so the three surfaces are
// always in sync.

const VALID_TABS: ReadonlySet<PoolNavTab> = new Set([
  "partidos",
  "leaderboard",
  "resumen",
  "reglas",
  "jugadores",
  "admin",
]);

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
    <h1
      style={{
        position: "sticky",
        top: 0,
        zIndex: zIndex.sticky,
        margin: 0,
        marginBottom: spacing.lg,
        padding: isMobile
          ? `${spacing.md}px ${spacing.lg}px`
          : `${spacing.md}px ${spacing.xl}px`,
        background: colors.white,
        borderBottom: `1px solid ${colors.borderLight}`,
        borderRadius: 0,
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        fontSize: isMobile ? fontSize["3xl"] : fontSize["4xl"],
        fontWeight: fontWeight.bold,
        color: colors.text,
        letterSpacing: -0.3,
        lineHeight: 1.2,
      }}
    >
      <span aria-hidden="true" style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>{t(labelKey)}</span>
    </h1>
  );
}
