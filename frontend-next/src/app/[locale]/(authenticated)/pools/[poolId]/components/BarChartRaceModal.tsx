"use client";

// Animated "Evolución" bar-chart-race (GDP-by-year style).
//
// Driven by requestAnimationFrame with CONTINUOUS interpolation of each player's
// value AND rank-position between the two surrounding matches, written straight
// to the DOM — bars always glide and cross exactly when points cross. The
// POSITION numbers/medals are a STATIC left column; only the bars move. When the
// race ends the bars give way to a 1-2-3 podium. React only re-renders on
// play/pause/speed/finished/data changes; per-frame work is imperative.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { colors, zIndex } from "@/lib/theme";
import { ShareButtons } from "@/components/ShareButtons";
import { getPoolBarRace, type PoolBarRace } from "@/lib/api/pools";

const OTHER_BAR = "#A5B4FC"; // constant bar colour for the pack
const STEP_MS = 900; // base ms per match at 1x
const COL_W = 28; // static position column width
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const PODIUM_BG: Record<number, string> = { 1: "#F59E0B", 2: "#94A3B8", 3: "#C2773F" };

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

interface RowRefs { row: HTMLDivElement; bar: HTMLElement; val: HTMLElement }

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
    return (iso: string) => (iso ? f.format(new Date(iso)) : "");
  }, [locale]);

  const [data, setData] = useState<PoolBarRace | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [podiumRisen, setPodiumRisen] = useState(false);
  const [speed, setSpeed] = useState(1);

  const VISIBLE = isMobile ? 10 : 15;
  const ROW_H = isMobile ? 36 : 44;

  const tRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const rowRefs = useRef(new Map<string, RowRefs>());
  const clockLabelRef = useRef<HTMLDivElement>(null);
  const clockProgressRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const pinnedRankRef = useRef<HTMLDivElement>(null);
  const lastFloorRef = useRef(-1);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    let cancelled = false;
    getPoolBarRace(token ?? "", poolId)
      .then((r) => { if (!cancelled) { setData(r.barRace); setStatus("ready"); } })
      .catch(() => !cancelled && setStatus("error"));
    return () => { cancelled = true; };
  }, [poolId, token]);

  const lastStep = Math.max(0, (data?.steps.length ?? 1) - 1);

  const ranksByStep = useMemo(() => {
    if (!data) return [] as Array<Map<string, number>>;
    return data.steps.map((_s, i) => {
      const order = [...data.players].sort(
        (a, b) => (b.cumulative[i] ?? 0) - (a.cumulative[i] ?? 0) || a.displayName.localeCompare(b.displayName),
      );
      const m = new Map<string, number>();
      order.forEach((p, idx) => m.set(p.userId, idx));
      return m;
    });
  }, [data]);

  const renderFrame = useCallback(
    (time: number) => {
      const d = data;
      if (!d || d.steps.length === 0 || ranksByStep.length === 0) return;
      const tt = Math.max(0, Math.min(time, lastStep));
      const floor = Math.floor(tt);
      const ceil = Math.min(floor + 1, lastStep);
      const frac = tt - floor;
      const rF = ranksByStep[floor]!;
      const rC = ranksByStep[ceil]!;
      const pin = d.totalPlayers > VISIBLE;

      let maxVal = 0;
      let minVisVal = Infinity;
      const items = d.players.map((p) => {
        const v = lerp(p.cumulative[floor] ?? 0, p.cumulative[ceil] ?? 0, frac);
        const rankI = lerp(rF.get(p.userId) ?? 999, rC.get(p.userId) ?? 999, frac);
        if (v > maxVal) maxVal = v;
        if (rankI < VISIBLE && v < minVisVal) minVisVal = v;
        return { p, v, rankI };
      });
      if (!isFinite(minVisVal)) minVisVal = 0;
      // Dynamic scale zoomed to the visible field so the staircase stays legible.
      const range = Math.max(1, maxVal - minVisVal);
      const lo = Math.max(0, minVisVal - range * 0.45);
      const span = Math.max(1, maxVal + range * 0.05 - lo);

      let viewerPinned = false;
      let viewerRank = 0;
      for (const it of items) {
        const refs = rowRefs.current.get(it.p.userId);
        if (!refs) continue;
        let y: number;
        let opacity: number;
        if (it.p.isViewer && pin && it.rankI >= VISIBLE) {
          y = (VISIBLE + 0.45) * ROW_H;
          opacity = 1;
          viewerPinned = true;
          viewerRank = Math.round(it.rankI) + 1;
        } else {
          y = Math.min(it.rankI, VISIBLE + 1) * ROW_H;
          opacity = it.rankI < VISIBLE ? 1 : Math.max(0, 1 - (it.rankI - VISIBLE));
        }
        const widthPct = Math.max(4, Math.min(100, ((it.v - lo) / span) * 100));
        refs.row.style.transform = `translate3d(0, ${y}px, 0)`;
        refs.row.style.opacity = String(opacity);
        refs.bar.style.width = `${widthPct}%`;
        refs.val.textContent = String(Math.round(it.v));
        refs.val.style.left = `max(calc(${widthPct}% + 6px), 34px)`;
      }

      if (pinnedRankRef.current) {
        pinnedRankRef.current.style.opacity = viewerPinned ? "1" : "0";
        if (viewerPinned) pinnedRankRef.current.textContent = String(viewerRank);
      }

      if (floor !== lastFloorRef.current) {
        lastFloorRef.current = floor;
        if (clockLabelRef.current) clockLabelRef.current.textContent = d.steps[floor]?.label ?? "";
        if (clockProgressRef.current) {
          clockProgressRef.current.textContent = `${t("barRace.progress", { n: floor + 1, total: d.steps.length })} · ${fmtDate(d.steps[floor]?.kickoffUtc ?? "")}`;
        }
      }
      if (scrubRef.current && document.activeElement !== scrubRef.current) {
        scrubRef.current.value = String(tt);
      }
    },
    [data, ranksByStep, lastStep, VISIBLE, ROW_H, t, fmtDate],
  );

  useEffect(() => {
    if (!playing) return;
    lastTsRef.current = 0;
    const tick = (ts: number) => {
      const dt = lastTsRef.current ? ts - lastTsRef.current : 0;
      lastTsRef.current = ts;
      tRef.current = Math.min(lastStep, tRef.current + dt / (STEP_MS / speedRef.current));
      renderFrame(tRef.current);
      if (tRef.current >= lastStep) { setPlaying(false); setFinished(true); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, lastStep, renderFrame]);

  // Render a static frame when data loads / when we land paused on a time.
  useEffect(() => {
    if (status === "ready" && data && !finished) {
      lastFloorRef.current = -1;
      renderFrame(tRef.current);
    }
  }, [status, data, finished, renderFrame]);

  // Podium rise-in animation.
  useEffect(() => {
    if (!finished) { setPodiumRisen(false); return; }
    const id = setTimeout(() => setPodiumRisen(true), 80);
    return () => clearTimeout(id);
  }, [finished]);

  const togglePlay = useCallback(() => {
    if (!data) return;
    if (tRef.current >= lastStep) { tRef.current = 0; setFinished(false); }
    setPlaying((p) => !p);
  }, [data, lastStep]);

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaying(false);
    setFinished(false);
    tRef.current = Number(e.target.value);
    renderFrame(tRef.current);
  };

  const setRowRef = (userId: string) => (el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(userId, {
        row: el,
        bar: el.querySelector("[data-bar]") as HTMLElement,
        val: el.querySelector("[data-val]") as HTMLElement,
      });
    } else {
      rowRefs.current.delete(userId);
    }
  };

  const visibleCount = Math.min(VISIBLE, data?.players.length ?? VISIBLE);
  const pinRow = (data?.totalPlayers ?? 0) > VISIBLE;
  const trackH = (visibleCount + (pinRow ? 1.5 : 0)) * ROW_H + 4;
  const ready = status === "ready" && data && data.steps.length > 0;
  const top3 = ready ? [...data!.players].sort((a, b) => (b.cumulative[lastStep] ?? 0) - (a.cumulative[lastStep] ?? 0)).slice(0, 3) : [];
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.62)", zIndex: zIndex.modalAbove, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 6 : 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: colors.white, borderRadius: 18, width: "100%", maxWidth: 760, maxHeight: "95vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}
      >
        {/* Header */}
        <div style={{ background: colors.brandGradient, color: colors.white, padding: isMobile ? "13px 14px" : "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 15 : 19, fontWeight: 800 }}>🏁 {t("barRace.title")}</div>
            <div style={{ fontSize: 12, opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{poolName}</div>
          </div>
          <button onClick={onClose} aria-label={t("barRace.close")} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.12)", color: colors.white, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: isMobile ? "12px 12px 0" : "16px 20px 0", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {status === "loading" && <Centered>{t("barRace.loading")}</Centered>}
          {status === "error" && <Centered>{t("barRace.error")}</Centered>}
          {status === "ready" && (!data || data.steps.length === 0) && <Centered>{t("barRace.empty")}</Centered>}

          {ready && (
            <>
              {/* Share row */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <ShareButtons context="generic" url={shareUrl} size="sm" showLabels={false} />
              </div>

              {finished ? (
                /* ── Podium ── */
                <div style={{ textAlign: "center", paddingBottom: 8 }}>
                  <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800, color: colors.text, marginBottom: 18 }}>
                    🏆 {t("barRace.podiumTitle")}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: isMobile ? 8 : 14, minHeight: 200 }}>
                    {[2, 1, 3].map((pos) => {
                      const p = top3[pos - 1];
                      const h = pos === 1 ? 140 : pos === 2 ? 104 : 80;
                      const delay = pos === 1 ? 0.28 : pos === 2 ? 0.1 : 0.19;
                      return (
                        <div key={pos} style={{ flex: 1, maxWidth: 150, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
                          <div style={{ fontSize: pos === 1 ? 30 : 24, transform: podiumRisen ? "scale(1)" : "scale(0)", transition: `transform 0.5s ${delay + 0.3}s cubic-bezier(.2,1.4,.4,1)` }}>{MEDAL[pos]}</div>
                          <div style={{ fontWeight: 800, fontSize: isMobile ? 12 : 14, color: colors.text, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: podiumRisen ? 1 : 0, transition: `opacity 0.4s ${delay + 0.25}s ease` }}>
                            {p ? (p.isViewer ? t("barRace.you") : p.displayName) : "—"}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 6, opacity: podiumRisen ? 1 : 0, transition: `opacity 0.4s ${delay + 0.3}s ease` }}>
                            {p ? `${p.cumulative[lastStep] ?? 0} ${t("barRace.pts")}` : ""}
                          </div>
                          <div style={{ width: "100%", height: h, background: `linear-gradient(180deg, ${PODIUM_BG[pos]}, ${PODIUM_BG[pos]}cc)`, borderRadius: "10px 10px 0 0", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 8, color: "#fff", fontWeight: 900, fontSize: pos === 1 ? 26 : 22, transform: podiumRisen ? "scaleY(1)" : "scaleY(0)", transformOrigin: "bottom", transition: `transform 0.6s ${delay}s cubic-bezier(.2,.8,.2,1)`, boxShadow: "0 -2px 10px rgba(0,0,0,0.12)" }}>
                            {pos}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {/* Clock */}
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
                    <div ref={clockLabelRef} style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: colors.text }} />
                    <div ref={clockProgressRef} style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }} />
                  </div>

                  {/* Track: static position column + moving bars */}
                  <div style={{ position: "relative", height: trackH }}>
                    {/* Static positions */}
                    {Array.from({ length: visibleCount }).map((_, i) => (
                      <div key={i} style={{ position: "absolute", left: 0, top: i * ROW_H, width: COL_W, height: ROW_H - 6, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, fontSize: 13, fontWeight: 800, background: i < 3 ? PODIUM_BG[i + 1] : "transparent", color: i < 3 ? "#fff" : colors.textMuted }}>
                        {i < 3 ? MEDAL[i + 1] : i + 1}
                      </div>
                    ))}
                    {pinRow && (
                      <div ref={pinnedRankRef} style={{ position: "absolute", left: 0, top: (VISIBLE + 0.45) * ROW_H, width: COL_W, height: ROW_H - 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: colors.brand, opacity: 0, transition: "opacity 0.2s ease" }} />
                    )}

                    {/* Bars */}
                    {data!.players.map((p) => (
                      <div
                        key={p.userId}
                        ref={setRowRef(p.userId)}
                        style={{ position: "absolute", left: COL_W + 8, right: 0, top: 0, height: ROW_H - 6, transform: "translate3d(0,0,0)", opacity: 0, display: "flex", alignItems: "center", pointerEvents: "none", willChange: "transform, opacity", zIndex: p.isViewer ? 3 : 1 }}
                      >
                        <div data-bar style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4%", minWidth: 28, background: p.isViewer ? colors.brand : OTHER_BAR, borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8, boxShadow: p.isViewer ? `0 0 0 2px ${colors.brand}66` : "none" }}>
                          <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: colors.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                            {p.isViewer ? t("barRace.you") : p.displayName}
                          </span>
                        </div>
                        <span data-val style={{ position: "absolute", left: "4%", top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: isMobile ? 12 : 13, fontWeight: 800, color: colors.text, whiteSpace: "nowrap" }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        {ready && (
          <div style={{ flexShrink: 0, borderTop: `1px solid ${colors.borderLight}`, background: colors.bgLighter, padding: isMobile ? "12px 14px" : "14px 20px", display: "flex", alignItems: "center", gap: isMobile ? 12 : 14 }}>
            <button onClick={togglePlay} aria-label={playing ? t("barRace.pause") : t("barRace.play")} style={{ width: 50, height: 50, borderRadius: "50%", border: "none", background: colors.brand, color: colors.white, fontSize: 20, cursor: "pointer", flexShrink: 0, boxShadow: `0 4px 14px ${colors.brand}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {playing ? "⏸" : finished ? "↻" : "▶"}
            </button>
            <input ref={scrubRef} type="range" min={0} max={lastStep} step={0.01} defaultValue={0} onChange={onScrub} aria-label={t("barRace.title")} style={{ flex: 1, height: 28, accentColor: colors.brand, cursor: "pointer" }} />
            <button onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))} style={{ minWidth: 46, height: 40, borderRadius: 999, border: `1px solid ${colors.borderMedium}`, background: colors.white, color: colors.textDark, fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
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
