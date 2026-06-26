"use client";

// Evolución race chart. Cumulative points over time with a granularity switch
// (per match / daily / 3-day / 7-day). Shows a WINDOW of the last 5 periods at a
// time (page back for older); the Y scale fits exactly that window so the lines
// always read well-separated. Straight segments (no smoothing). Only the top-3
// (medal + name) and the viewer (name) are labelled at their line ends; everyone
// else is a quiet grey line. Tooltip shows the matches that scored that period
// plus each player's points / position change vs the previous period.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { colors, radii, fontWeight } from "@/lib/theme";
import type { PoolEvolution } from "@/lib/api/pools";

const GOLD = "#F59E0B";
const SILVER = "#94A3B8";
const BRONZE = "#C2773F";
const PACK_FILL = "#E2E8F0";
const OTHER_LINE = "#D7DEE8";
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const WINDOW = 5; // periods shown at once

type Gran = "match" | "day" | "3day" | "7day";
const GRAN_DAYS: Record<Gran, number> = { match: 0, day: 1, "3day": 3, "7day": 7 };
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
  lastIdx: number;
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
  values: number[];
  ranks: number[];
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
  const [winStart, setWinStart] = useState(0);

  const buckets = useMemo(() => buildBuckets(evolution, gran, fmtDay), [evolution, gran, fmtDay]);
  const players = useMemo(() => buildPlayerSeries(evolution, buckets), [evolution, buckets]);
  const emphasized = useMemo(() => players.filter(isEmphasized), [players]);

  // Default to the most recent window; reset when the granularity changes.
  useEffect(() => {
    setWinStart(Math.max(0, buckets.length - WINDOW));
  }, [buckets.length]);

  const winEnd = Math.min(buckets.length, winStart + WINDOW);

  // recharts rows for the visible window only (so the Y fits exactly these).
  // `i` stays the ABSOLUTE bucket index so deltas reach back past the window.
  const data = useMemo(() => {
    const rows: Record<string, number | string>[] = [];
    for (let i = winStart; i < winEnd; i++) {
      const b = buckets[i]!;
      const row: Record<string, number | string> = { i, label: b.label };
      for (const p of players) row[`p_${p.userId}`] = p.values[i]!;
      if (evolution.band) {
        const band = evolution.band[b.lastIdx];
        row.bandLo = band?.min ?? 0;
        row.bandRange = (band?.max ?? 0) - (band?.min ?? 0);
      }
      rows.push(row);
    }
    return rows;
  }, [buckets, players, winStart, winEnd, evolution.band]);

  // Y fits the emphasized lines inside the current window.
  const yDomain = useMemo<[number, number]>(() => {
    const pool = emphasized.length > 0 ? emphasized : players;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pool) {
      for (let i = winStart; i < winEnd; i++) {
        lo = Math.min(lo, p.values[i]!);
        hi = Math.max(hi, p.values[i]!);
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) return [0, 10];
    const pad = Math.max(4, (hi - lo) * 0.12);
    return [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)];
  }, [emphasized, players, winStart, winEnd]);

  const ordered = useMemo(
    () =>
      [...players].sort((a, b) => {
        const za = a.isViewer ? 4 : isEmphasized(a) ? 3 : 1;
        const zb = b.isViewer ? 4 : isEmphasized(b) ? 3 : 1;
        return za - zb;
      }),
    [players],
  );

  const makeEndLabel = (p: PlayerSeries) => {
    const color = lineColor(p);
    const medal = p.rank && p.rank <= 3 ? MEDAL[p.rank] : "";
    const name = p.isViewer ? t("evolution.you") : p.displayName;
    const text = `${medal ? medal + " " : ""}${name}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (props: any) => {
      if (props.index !== data.length - 1) return null;
      return (
        <text x={props.x + 8} y={props.y} dy={4} fontSize={isMobile ? 10 : 12} fontWeight={700} fill={color}>
          {text}
        </text>
      );
    };
  };

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
  const canOlder = winStart > 0;
  const canNewer = winEnd < buckets.length;
  const navBtn = (enabled: boolean): CSSProperties => ({
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${colors.borderLight}`,
    background: colors.white,
    color: enabled ? colors.brand : colors.textLight,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.5,
  });

  return (
    <div>
      {/* Granularity switch */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
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

      {/* Window navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button type="button" onClick={() => canOlder && setWinStart((s) => Math.max(0, s - WINDOW))} disabled={!canOlder} style={navBtn(canOlder)}>
          ← {t("evolution.older")}
        </button>
        <span style={{ fontSize: 12, fontWeight: fontWeight.semibold, color: colors.textMuted }}>
          {data.length > 0 ? `${data[0]!.label} – ${data[data.length - 1]!.label}` : ""}
        </span>
        <button
          type="button"
          onClick={() => canNewer && setWinStart((s) => Math.min(Math.max(0, buckets.length - WINDOW), s + WINDOW))}
          disabled={!canNewer}
          style={navBtn(canNewer)}
        >
          {t("evolution.newer")} →
        </button>
      </div>

      <ResponsiveContainer width="100%" height={CHART_H}>
        <ComposedChart data={data} margin={{ top: 16, right: isMobile ? 80 : 104, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="evoViewerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.brand} stopOpacity={0.18} />
              <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.borderLight} />
          <XAxis dataKey="label" interval={0} tick={{ fontSize: 11, fill: colors.textMuted }} height={28} />
          <YAxis domain={yDomain} width={40} tick={{ fontSize: 10, fill: colors.textMuted }} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: colors.brand, strokeOpacity: 0.3 }} />

          {evolution.band && (
            <>
              <Area type="linear" dataKey="bandLo" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
              <Area type="linear" dataKey="bandRange" stackId="band" stroke="none" fill={PACK_FILL} fillOpacity={0.6} isAnimationActive={false} />
            </>
          )}

          {(() => {
            const me = players.find((p) => p.isViewer);
            return me ? (
              <Area type="linear" dataKey={`p_${me.userId}`} stroke="none" fill="url(#evoViewerFill)" isAnimationActive={false} />
            ) : null;
          })()}

          {ordered.map((p) => {
            const emph = isEmphasized(p);
            return (
              <Line
                key={p.userId}
                type="linear"
                dataKey={`p_${p.userId}`}
                stroke={lineColor(p)}
                strokeWidth={p.isViewer ? 3.5 : emph ? 2.5 : 1.25}
                strokeOpacity={emph ? 1 : 0.7}
                dot={emph ? { r: 2.5 } : false}
                activeDot={emph ? { r: 4 } : false}
                isAnimationActive
                animationDuration={800}
                label={emph ? makeEndLabel(p) : undefined}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
