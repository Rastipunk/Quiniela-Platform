"use client";

// Evolución tab — fetches the curated cumulative-points series and renders the
// race chart with a legend (you + podium + your zone). The heavy compute is
// server-side and cached (ADR-079); this just reads.

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { colors, radii, fontSize, fontWeight } from "@/lib/theme";
import { getPoolEvolution, type PoolEvolution } from "@/lib/api/pools";
import { EvolutionChart, playerColor } from "./EvolutionChart";

function Centered({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "48px 16px", textAlign: "center", color: colors.textMuted, fontSize: fontSize.base }}>
      {children}
    </div>
  );
}

export function PoolEvolutionTab({
  poolId,
  token,
  isMobile,
}: {
  poolId: string;
  token: string | null;
  isMobile: boolean;
}) {
  const t = useTranslations("pool");
  const [data, setData] = useState<PoolEvolution | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getPoolEvolution(token ?? "", poolId)
      .then((res) => {
        if (cancelled) return;
        setData(res.evolution);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [poolId, token]);

  const card = (children: ReactNode) => (
    <div
      style={{
        background: colors.white,
        border: `1px solid ${colors.border}`,
        borderRadius: radii["3xl"],
        padding: isMobile ? 16 : 24,
      }}
    >
      {children}
    </div>
  );

  if (status === "loading") return card(<Centered>{t("evolution.loading")}</Centered>);
  if (status === "error") return card(<Centered>{t("evolution.error")}</Centered>);
  if (!data || data.steps.length === 0) return card(<Centered>{t("evolution.empty")}</Centered>);

  const legendPlayers = [...data.players].sort(
    (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity),
  );
  const hiddenCount = data.curated ? data.totalPlayers - data.players.length : 0;

  return card(
    <>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? fontSize.xl : fontSize["2xl"], fontWeight: fontWeight.bold, color: colors.text }}>
          🏁 {t("evolution.title")}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 1.4 }}>
          {t("evolution.subtitle")}
        </p>
      </div>

      {/* Legend chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {legendPlayers.map((p) => (
          <span
            key={p.userId}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: p.isViewer ? colors.brandBg : colors.bgLighter,
              border: `1px solid ${p.isViewer ? colors.brand : colors.borderLight}`,
              fontSize: 12,
              fontWeight: p.isViewer ? fontWeight.bold : fontWeight.medium,
              color: p.isViewer ? colors.brand : colors.textDark,
              maxWidth: "100%",
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: playerColor(p), flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.rank ? `${p.rank}° ` : ""}
              {p.isViewer ? t("evolution.you") : p.displayName}
            </span>
            <span style={{ color: colors.textMuted, flexShrink: 0 }}>{p.cumulative.at(-1) ?? 0}</span>
          </span>
        ))}
        {hiddenCount > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: colors.bgLighter,
              border: `1px dashed ${colors.borderMedium}`,
              fontSize: 12,
              color: colors.textMuted,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "#E2E8F0", flexShrink: 0 }} />
            {t("evolution.packMore", { count: hiddenCount })}
          </span>
        )}
      </div>

      {/* Chart */}
      <EvolutionChart evolution={data} isMobile={isMobile} />

      {/* Scroll hint */}
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: colors.textMuted }}>
        ← {t("evolution.scrollHint")} →
      </div>
    </>,
  );
}
