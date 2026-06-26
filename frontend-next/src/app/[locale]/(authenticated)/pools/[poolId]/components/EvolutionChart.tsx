"use client";

// Evolución race chart. Cumulative points over time with a granularity switch
// (per match / daily / 3-day / 7-day). The Y scale auto-fits the lines visible
// in the current scroll window so separation always reads well. Only the top-3
// (medal + name) and the viewer (name) are labelled at their line ends; everyone
// else is a quiet grey line. Tooltip shows which matches scored in that period
// plus each player's points / position change vs the previous period.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
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

const GOLD = "#F59E0B";
const SILVER = "#94A3B8";
const BRONZE = "#C2773F";
const PACK_FILL = "#E2E8F0";
const OTHER_LINE = "#D7DEE8";
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

type Gran = "match" | "day" | "3day" | "7day";
const GRAN_DAYS: Record<Gran, number> = { match: 0, day: 1, "3day": 3, "7day": 7 };
const GRAN_PX: Record<Gran, number> = { match: 54, day: 60, "3day": 92, "7day": 124 };
const GRAN_ORDER: Gran[] = ["match", "day", "3day", "7day"];

type Player = PoolEvolution["players"][number];

function isEmphasized(p: Player): boolean {
  return p.isViewer || (p.rank != null && p.rank <= 3);
}
function lineColor(p: Player): string {
  if (p.isViewer) return colors.brand;
  if (p.rank === 1) return GOLD;
  if (p.rank === 2) return SILVER;
  if (p.rank === 3) return BRONZE;
  return OTHER_LINE;
}

const dayNum = (iso: string) => Math.floor(Date.parse(iso) / 86_400_000);

interface Bucket {
  label: string;
  matches: string[];
  lastIdx: number; // step index whose cumulative this bucket carries
}

function buildBuckets(evo: PoolEvolution, gran: Gran, fmtDay: (iso: string) => string): Bucket[] {
  const steps = evo.steps;
  if (steps.length === 0) return [];
  if (gran === "match") {
    return steps.map((s, i) => ({ label: fmtDay(s.kickoffUtc), matches: [s.label], lastIdx: i }));
  }
  const days = GRAN_DAYS[gran];
  const first = dayNum(steps[0]!.kickoffUtc);
  const groups = new Map<number, number[]>();
  steps.forEach((s, i) => {
    const k = Math.floor((dayNum(s.kickoffUtc) - first) / days);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(i);
  });
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, idxs]) => {
      const lastIdx = idxs[idxs.length - 1]!;
      const a = steps[idxs[0]!]!.kickoffUtc;
      const b = steps[lastIdx]!.kickoffUtc;
      const label = fmtDay(a) === fmtDay(b) ? fmtDay(a) : `${fmtDay(a)}–${fmtDay(b)}`;
      return { label, matches: idxs.map((si) => steps[si]!.label), lastIdx };
    });
}

interface PlayerSeries extends Player {
  values: number[]; // cumulative per bucket
  ranks: number[]; // 1-based rank per bucket (over all players)
}

function buildPlayerSeries(evo: PoolEvolution, buckets: Bucket[]): PlayerSeries[] {
  const base = evo.players.map((p) => ({
    ...p,
    values: buckets.map((b) => p.cumulative[b.lastIdx] ?? 0),
    ranks: [] as number[],
  }));
  buckets.forEach((_, bi) => {
    const order = [...base].sort((a, b) => b.values[bi]! - a.values[bi]!);
    order.forEach((p, idx) => {
      p.ranks[bi] = idx + 1;
    });
  });
  return base;
}

export function EvolutionChart({
  evolution,
  isMobile,
}: {
  evolution: PoolEvolution;
  isMobile: boolean;
}) {
  const t = useTranslations("pool");
  const locale = useLocale();
  const fmtDay = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return (iso: string) => f.format(new Date(iso));
  }, [locale]);

  const [gran, setGran] = useState<Gran>("day");
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(0);
  const [yDomain, setYDomain] = useState<[number, number]>([0, 10]);

  const buckets = useMemo(() => buildBuckets(evolution, gran, fmtDay), [evolution, gran, fmtDay]);
  const players = useMemo(() => buildPlayerSeries(evolution, buckets), [evolution, buckets]);
  const emphasized = useMemo(() => players.filter(isEmphasized), [players]);

  const data = useMemo(
    () =>
      buckets.map((b, i) => {
        const row: Record<string, number | string> = { i, label: b.label };
        for (const p of players) row[`p_${p.userId}`] = p.values[i]!;
        if (evolution.band) {
          const band = evolution.band[b.lastIdx];
          row.bandLo = band?.min ?? 0;
          row.bandRange = (band?.max ?? 0) - (band?.min ?? 0);
        }
        return row;
      }),
    [buckets, players, evolution.band],
  );

  // Measure the container so few-bucket views fill the width and many-bucket
  // views overflow into a horizontal scroll.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWrapW(entries[0]!.contentRect.width));
    ro.observe(el);
    setWrapW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const chartWidth = Math.max(wrapW || 320, buckets.length * GRAN_PX[gran]);

  // Auto-fit Y to the emphasized lines inside the visible scroll window.
  const recomputeY = useCallback(() => {
    const el = scrollRef.current;
    if (!el || buckets.length === 0) return;
    const px = GRAN_PX[gran];
    const start = Math.max(0, Math.floor(el.scrollLeft / px) - 1);
    const end = Math.min(buckets.length - 1, Math.ceil((el.scrollLeft + el.clientWidth) / px));
    const pool = emphasized.length > 0 ? emphasized : players;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pool) {
      for (let bi = start; bi <= end; bi++) {
        lo = Math.min(lo, p.values[bi]!);
        hi = Math.max(hi, p.values[bi]!);
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) {
      setYDomain([0, 10]);
      return;
    }
    const pad = Math.max(4, (hi - lo) * 0.12);
    setYDomain([Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)]);
  }, [buckets.length, gran, emphasized, players]);

  // On mount / granularity change: pin to the most recent period, then fit Y.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
    const id = requestAnimationFrame(recomputeY);
    return () => cancelAnimationFrame(id);
  }, [recomputeY, chartWidth]);

  const onScroll = useCallback(() => {
    requestAnimationFrame(recomputeY);
  }, [recomputeY]);

  // Draw order: pack, grey lines, podium, viewer on top.
  const ordered = useMemo(
    () =>
      [...players].sort((a, b) => {
        const za = a.isViewer ? 4 : isEmphasized(a) ? 3 : 1;
        const zb = b.isViewer ? 4 : isEmphasized(b) ? 3 : 1;
        return za - zb;
      }),
    [players],
  );

  // End-of-line label (medal + name) for emphasized players only, last point only.
  const makeEndLabel = (p: PlayerSeries) => {
    const color = lineColor(p);
    const medal = p.rank && p.rank <= 3 ? MEDAL[p.rank] : "";
    const name = p.isViewer ? t("evolution.you") : p.displayName;
    const text = `${medal ? medal + " " : ""}${name}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (props: any) => {
      if (props.index !== data.length - 1) return null;
      return (
        <text
          x={props.x + 8}
          y={props.y}
          dy={4}
          fontSize={isMobile ? 10 : 12}
          fontWeight={700}
          fill={color}
        >
          {text}
        </text>
      );
    };
  };

  // Tooltip: matches that scored this period + each player's Δpts / Δpos.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ChartTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (!active || !payload?.length) return null;
    const bi: number = payload[0].payload.i;
    const bucket = buckets[bi];
    if (!bucket) return null;
    const ranked = [...players].sort((a, b) => a.ranks[bi]! - b.ranks[bi]!);
    return (
      <div
        style={{
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.lg,
          padding: "10px 12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          maxWidth: 270,
        }}
      >
        <div style={{ fontWeight: fontWeight.bold, fontSize: 12, color: colors.text, marginBottom: 4 }}>
          {bucket.label}
        </div>
        <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 8, lineHeight: 1.35 }}>
          {bucket.matches.slice(0, 6).join(" · ")}
          {bucket.matches.length > 6 ? ` +${bucket.matches.length - 6}` : ""}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {ranked.slice(0, 8).map((p) => {
            const dPts = bi > 0 ? p.values[bi]! - p.values[bi - 1]! : p.values[bi]!;
            const dPos = bi > 0 ? p.ranks[bi - 1]! - p.ranks[bi]! : 0;
            return (
              <div
                key={p.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  fontSize: 12,
                  fontWeight: p.isViewer ? fontWeight.bold : fontWeight.medium,
                  color: p.isViewer ? colors.brand : colors.textDark,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {p.ranks[bi]}. {p.isViewer ? t("evolution.you") : p.displayName}
                </span>
                <span style={{ flexShrink: 0 }}>{p.values[bi]}</span>
                <span style={{ flexShrink: 0, color: dPts > 0 ? "#16a34a" : colors.textMuted, minWidth: 34, textAlign: "right" }}>
                  {dPts > 0 ? `+${dPts}` : "0"}
                </span>
                <span style={{ flexShrink: 0, minWidth: 26, textAlign: "right", color: dPos > 0 ? "#16a34a" : dPos < 0 ? "#dc2626" : colors.textMuted }}>
                  {dPos > 0 ? `▲${dPos}` : dPos < 0 ? `▼${-dPos}` : "–"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const CHART_H = isMobile ? 360 : 460;

  return (
    <div ref={wrapRef}>
      {/* Granularity switch */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {GRAN_ORDER.map((g) => {
          const active = g === gran;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setGran(g)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${active ? colors.brand : colors.borderLight}`,
                background: active ? colors.brand : colors.white,
                color: active ? colors.white : colors.textDark,
                fontSize: 12,
                fontWeight: active ? fontWeight.bold : fontWeight.medium,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {t(`evolution.gran.${g}`)}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}
      >
        <div style={{ width: chartWidth, height: CHART_H }}>
          <ComposedChart
            width={chartWidth}
            height={CHART_H}
            data={data}
            margin={{ top: 16, right: isMobile ? 76 : 96, left: 0, bottom: 8 }}
          >
            <defs>
              <linearGradient id="evoViewerFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.brand} stopOpacity={0.18} />
                <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.borderLight} />
            <XAxis
              dataKey="label"
              interval="preserveStartEnd"
              minTickGap={isMobile ? 28 : 36}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              height={28}
            />
            <YAxis
              domain={yDomain}
              width={40}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: colors.brand, strokeOpacity: 0.3 }} />

            {evolution.band && (
              <>
                <Area dataKey="bandLo" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
                <Area dataKey="bandRange" stackId="band" stroke="none" fill={PACK_FILL} fillOpacity={0.6} isAnimationActive={false} />
              </>
            )}

            {/* Soft gradient under the viewer's line for a highlighted feel. */}
            {(() => {
              const me = players.find((p) => p.isViewer);
              return me ? (
                <Area
                  dataKey={`p_${me.userId}`}
                  stroke="none"
                  fill="url(#evoViewerFill)"
                  isAnimationActive={false}
                />
              ) : null;
            })()}

            {ordered.map((p) => {
              const emph = isEmphasized(p);
              return (
                <Line
                  key={p.userId}
                  type="monotone"
                  dataKey={`p_${p.userId}`}
                  stroke={lineColor(p)}
                  strokeWidth={p.isViewer ? 3.5 : emph ? 2.5 : 1.25}
                  strokeOpacity={emph ? 1 : 0.7}
                  dot={false}
                  activeDot={emph ? { r: 4 } : false}
                  isAnimationActive
                  animationDuration={1000}
                  label={emph ? makeEndLabel(p) : undefined}
                />
              );
            })}
          </ComposedChart>
        </div>
      </div>
    </div>
  );
}
