"use client";

// Evolución tab — fetches the curated cumulative-points series and renders the
// race chart with a legend (you + podium + your zone). The heavy compute is
// server-side and cached (ADR-079); this just reads.

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { colors, radii, fontSize, fontWeight } from "@/lib/theme";
import { getPoolEvolution, type PoolEvolution } from "@/lib/api/pools";
import { EvolutionChart } from "./EvolutionChart";

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
          {hiddenCount > 0 ? ` · ${t("evolution.packMore", { count: hiddenCount })}` : ""}
        </p>
      </div>

      {/* Chart (granularity switch lives inside) */}
      <EvolutionChart evolution={data} isMobile={isMobile} />
    </>,
  );
}
