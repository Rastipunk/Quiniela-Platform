"use client";

// Evolución race chart — cumulative points per match (chronological).
// Horizontally scrollable (opens pinned to the most recent), your line is
// highlighted, the podium is coloured, and (for big pools) the rest of the
// field is a shaded "pack" band. Tap a point → standings at that moment.

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { colors, radii, fontWeight } from "@/lib/theme";
import type { PoolEvolution } from "@/lib/api/pools";

// Podium + pack palette (kept local — these are chart-only accents, not brand).
const GOLD = "#F59E0B";
const SILVER = "#94A3B8";
const BRONZE = "#C2773F";
const PACK_FILL = "#E2E8F0";
const OTHER_LINE = "#CBD5E1";

type Role = { color: string; width: number; z: number };

function roleFor(p: PoolEvolution["players"][number]): Role {
  if (p.isViewer) return { color: colors.brand, width: 3.5, z: 4 };
  if (p.rank === 1) return { color: GOLD, width: 2.5, z: 3 };
  if (p.rank === 2) return { color: SILVER, width: 2.5, z: 3 };
  if (p.rank === 3) return { color: BRONZE, width: 2.5, z: 3 };
  return { color: OTHER_LINE, width: 1.5, z: 1 };
}

/** Line/legend colour for a player (shared with the legend chips). */
export function playerColor(p: PoolEvolution["players"][number]): string {
  return roleFor(p).color;
}

export function EvolutionChart({
  evolution,
  isMobile,
}: {
  evolution: PoolEvolution;
  isMobile: boolean;
}) {
  const t = useTranslations("pool");
  const scrollRef = useRef<HTMLDivElement>(null);

  const PX_PER_STEP = isMobile ? 56 : 66;
  const CHART_H = isMobile ? 380 : 460;
  const chartWidth = Math.max(340, evolution.steps.length * PX_PER_STEP);

  // recharts rows: one per step, with a key per player + the band bounds.
  const data = useMemo(() => {
    return evolution.steps.map((step, i) => {
      const row: Record<string, number | string> = { idx: i, label: step.label };
      for (const p of evolution.players) row[`p_${p.userId}`] = p.cumulative[i] ?? 0;
      if (evolution.band) {
        const b = evolution.band[i];
        row.bandLo = b?.min ?? 0;
        row.bandRange = (b?.max ?? 0) - (b?.min ?? 0);
      }
      return row;
    });
  }, [evolution]);

  const niceMax = useMemo(() => {
    let m = 0;
    for (const p of evolution.players) m = Math.max(m, p.cumulative.at(-1) ?? 0);
    if (evolution.band) for (const b of evolution.band) m = Math.max(m, b.max);
    return Math.ceil((m * 1.06) / 50) * 50 || 50;
  }, [evolution]);

  // Draw order: pack first, then others, podium, and the viewer on top.
  const orderedPlayers = useMemo(
    () => [...evolution.players].sort((a, b) => roleFor(a).z - roleFor(b).z),
    [evolution.players],
  );

  // Open scrolled to the most recent match (right edge).
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [chartWidth]);

  // Tooltip: standings at the hovered step (full field for small pools).
  const ChartTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { idx: number } }> }) => {
    if (!active || !payload?.length) return null;
    const idx = payload[0]!.payload.idx;
    const step = evolution.steps[idx];
    if (!step) return null;
    const ranked = evolution.players
      .map((p) => ({ ...p, pts: p.cumulative[idx] ?? 0 }))
      .sort((a, b) => b.pts - a.pts);
    return (
      <div
        style={{
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.lg,
          padding: "10px 12px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
          maxWidth: 240,
        }}
      >
        <div style={{ fontWeight: fontWeight.bold, fontSize: 12, color: colors.text, marginBottom: 6 }}>
          {step.label}
        </div>
        <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 6 }}>
          {t("evolution.standingsAt")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {ranked.slice(0, 8).map((p, i) => (
            <div
              key={p.userId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 12,
                fontWeight: p.isViewer ? fontWeight.bold : fontWeight.medium,
                color: p.isViewer ? colors.brand : colors.textDark,
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {i + 1}. {p.isViewer ? t("evolution.you") : p.displayName}
              </span>
              <span>{p.pts}</span>
            </div>
          ))}
          {evolution.curated && evolution.totalPlayers > evolution.players.length && (
            <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
              {t("evolution.packMore", { count: evolution.totalPlayers - evolution.players.length })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={scrollRef}
      style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}
    >
      <div style={{ width: chartWidth, height: CHART_H }}>
        <ComposedChart
          width={chartWidth}
          height={CHART_H}
          data={data}
          margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.borderLight} />
          <XAxis
            dataKey="label"
            interval={0}
            angle={-45}
            textAnchor="end"
            height={64}
            tick={{ fontSize: 9, fill: colors.textMuted }}
          />
          <YAxis
            domain={[0, niceMax]}
            width={36}
            tick={{ fontSize: 10, fill: colors.textMuted }}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: colors.brand, strokeOpacity: 0.3 }} />

          {/* Pack band (big pools): min..max as a shaded area, drawn under the lines. */}
          {evolution.band && (
            <>
              <Area dataKey="bandLo" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
              <Area
                dataKey="bandRange"
                stackId="band"
                stroke="none"
                fill={PACK_FILL}
                fillOpacity={0.6}
                isAnimationActive={false}
              />
            </>
          )}

          {orderedPlayers.map((p) => {
            const r = roleFor(p);
            return (
              <Line
                key={p.userId}
                type="monotone"
                dataKey={`p_${p.userId}`}
                stroke={r.color}
                strokeWidth={r.width}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive
                animationDuration={1100}
                name={p.displayName}
              />
            );
          })}
        </ComposedChart>
      </div>
    </div>
  );
}
