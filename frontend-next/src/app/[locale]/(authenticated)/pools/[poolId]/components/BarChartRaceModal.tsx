"use client";

// Animated "Evolución" bar-chart-race (GDP-by-year style). On play, time advances
// match by match: bars grow and REORDER smoothly (CSS transitions on transform +
// width) as players overtake each other. The viewer is highlighted and pinned at
// the bottom if they fall outside the visible top-N. Data + curation are
// server-side (cached); this just animates.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { colors, radii, fontWeight, zIndex } from "@/lib/theme";
import { getPoolBarRace, type PoolBarRace } from "@/lib/api/pools";

const GOLD = "#F59E0B";
const SILVER = "#94A3B8";
const BRONZE = "#C2773F";
const OTHER_BAR = "#A5B4FC"; // light indigo for the pack

function barColor(isViewer: boolean, rank: number): string {
  if (isViewer) return colors.brand;
  if (rank === 1) return GOLD;
  if (rank === 2) return SILVER;
  if (rank === 3) return BRONZE;
  return OTHER_BAR;
}

export function BarChartRaceModal({
  poolId,
  token,
  poolName,
  isMobile,
  onClose,
}: {
  poolId: string;
  token: string | null;
  poolName: string;
  isMobile: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("pool");
  const locale = useLocale();
  const fmtDate = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return (iso: string) => f.format(new Date(iso));
  }, [locale]);

  const [data, setData] = useState<PoolBarRace | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const VISIBLE = isMobile ? 10 : 15;
  const ROW_H = isMobile ? 34 : 42;
  const STEP_MS = 850 / speed;

  useEffect(() => {
    let cancelled = false;
    getPoolBarRace(token ?? "", poolId)
      .then((r) => {
        if (cancelled) return;
        setData(r.barRace);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [poolId, token]);

  const lastStep = (data?.steps.length ?? 1) - 1;

  // Advance one step per STEP_MS while playing; stop at the end.
  useEffect(() => {
    if (!playing || !data) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= lastStep) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [playing, data, STEP_MS, lastStep]);

  const togglePlay = useCallback(() => {
    if (!data) return;
    setStep((s) => (s >= lastStep ? 0 : s)); // replay from start if at the end
    setPlaying((p) => !p);
  }, [data, lastStep]);

  // Layout for the current step: rank everyone, place the top-N, pin the viewer.
  const frame = useMemo(() => {
    if (!data || data.steps.length === 0) return null;
    const s = Math.max(0, Math.min(step, lastStep));
    const ranked = data.players
      .map((p) => ({ ...p, value: p.cumulative[s] ?? 0 }))
      .sort((a, b) => b.value - a.value || a.displayName.localeCompare(b.displayName));
    // 15% headroom so the leader's bar never slams the right edge (the value
    // label sits just past the bar end).
    const scaleMax = Math.max(1, (ranked[0]?.value ?? 1) * 1.15);
    const pinViewer = data.totalPlayers > VISIBLE;
    const rows = ranked.map((p, j) => {
      const rank = j + 1;
      let layoutIndex: number | null;
      if (j < VISIBLE) layoutIndex = j;
      else if (p.isViewer && pinViewer) layoutIndex = VISIBLE; // pinned below
      else layoutIndex = null; // off-screen
      return { ...p, rank, value: p.value, layoutIndex };
    });
    return { rows, scaleMax, pinViewer };
  }, [data, step, lastStep, VISIBLE]);

  const trackH = ((frame?.pinViewer ? VISIBLE + 1.4 : Math.min(VISIBLE, data?.players.length ?? VISIBLE)) ) * ROW_H + 6;
  const atEnd = step >= lastStep && lastStep > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
        zIndex: zIndex.modalAbove, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 8 : 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.white, borderRadius: 18, width: "100%", maxWidth: 760, maxHeight: "94vh",
          display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div style={{ background: colors.brandGradient, color: colors.white, padding: isMobile ? "14px 16px" : "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: isMobile ? 16 : 19, fontWeight: 800 }}>🏁 {t("barRace.title")}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>{poolName}</div>
          </div>
          <button onClick={onClose} aria-label={t("barRace.close")} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.12)", color: colors.white, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: isMobile ? 14 : 20, overflowY: "auto", flex: 1, minHeight: 0 }}>
          {status === "loading" && <Centered>{t("barRace.loading")}</Centered>}
          {status === "error" && <Centered>{t("barRace.error")}</Centered>}
          {status === "ready" && (!data || data.steps.length === 0) && <Centered>{t("barRace.empty")}</Centered>}

          {status === "ready" && data && frame && data.steps.length > 0 && (
            <>
              {/* Clock */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: colors.text }}>
                  {data.steps[Math.min(step, lastStep)]?.label}
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>
                  {t("barRace.progress", { n: Math.min(step, lastStep) + 1, total: data.steps.length })}
                  {" · "}
                  {fmtDate(data.steps[Math.min(step, lastStep)]?.kickoffUtc ?? "")}
                </div>
              </div>

              {/* Bars */}
              <div style={{ position: "relative", height: trackH, transition: "height 0.3s ease" }}>
                {frame.rows.map((p) => {
                  const visible = p.layoutIndex !== null;
                  const top = (p.layoutIndex ?? VISIBLE + 2.2) * ROW_H + (p.layoutIndex === VISIBLE ? ROW_H * 0.4 : 0);
                  const widthPct = Math.max(2, (p.value / frame.scaleMax) * 100);
                  const color = barColor(p.isViewer, p.rank);
                  const isWinner = atEnd && p.rank === 1;
                  return (
                    <div
                      key={p.userId}
                      style={{
                        position: "absolute", left: 0, right: 0, top: 0, height: ROW_H - 6,
                        transform: `translateY(${top}px)`, opacity: visible ? 1 : 0,
                        transition: `transform ${STEP_MS}ms linear, opacity 0.3s ease`,
                        display: "flex", alignItems: "center", gap: 8, pointerEvents: "none",
                      }}
                    >
                      {/* Rank */}
                      <div style={{ width: 22, textAlign: "right", fontSize: 12, fontWeight: 800, color: colors.textMuted, flexShrink: 0 }}>
                        {p.rank}
                      </div>
                      {/* Bar */}
                      <div style={{ flex: 1, position: "relative", height: "100%" }}>
                        <div
                          style={{
                            position: "absolute", left: 0, top: 0, bottom: 0,
                            width: `${widthPct}%`, minWidth: 30,
                            background: color, borderRadius: 6,
                            transition: `width ${STEP_MS}ms linear, background 0.3s ease`,
                            display: "flex", alignItems: "center", paddingLeft: 8,
                            boxShadow: p.isViewer ? `0 0 0 2px ${colors.brand}55` : "none",
                          }}
                        >
                          <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: colors.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 2px rgba(0,0,0,0.25)" }}>
                            {isWinner ? "🏆 " : ""}{p.isViewer ? t("barRace.you") : p.displayName}
                          </span>
                        </div>
                        {/* Value at the bar end */}
                        <span style={{ position: "absolute", left: `calc(${widthPct}% + 6px)`, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: isMobile ? 12 : 13, fontWeight: 800, color: colors.text, transition: `left ${STEP_MS}ms linear`, whiteSpace: "nowrap" }}>
                          {Math.round(p.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {atEnd && (
                <div style={{ textAlign: "center", marginTop: 10, fontSize: 14, fontWeight: 800, color: colors.brand }}>
                  🏆 {t("barRace.winner", { name: frame.rows[0]?.isViewer ? t("barRace.you") : (frame.rows[0]?.displayName ?? "") })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        {status === "ready" && data && data.steps.length > 0 && (
          <div style={{ flexShrink: 0, borderTop: `1px solid ${colors.borderLight}`, padding: isMobile ? "10px 14px" : "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={togglePlay} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: colors.brand, color: colors.white, fontSize: 18, cursor: "pointer", flexShrink: 0, boxShadow: `0 4px 12px ${colors.brand}55` }}>
              {playing ? "⏸" : atEnd ? "↻" : "▶"}
            </button>
            <input
              type="range" min={0} max={lastStep} value={Math.min(step, lastStep)}
              onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }}
              style={{ flex: 1, accentColor: colors.brand, cursor: "pointer" }}
            />
            <button
              onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
              style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${colors.borderMedium}`, background: colors.white, color: colors.textDark, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
            >
              {speed}x
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ padding: "56px 16px", textAlign: "center", color: colors.textMuted }}>{children}</div>;
}
