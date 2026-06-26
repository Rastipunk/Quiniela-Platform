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
import { getTeamFlag } from "@/data/teamFlags";
import {
  getPoolBarRace,
  getOrCreateShareCode,
  getPublicBarRace,
  type PoolBarRace,
  type BarRaceMatch,
} from "@/lib/api/pools";

const OTHER_BAR = "#A5B4FC"; // constant bar colour for the pack
const STEP_MS = 900; // base ms per match at 1x
const COL_W = 28; // static position column width
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const PODIUM_BG: Record<number, string> = { 1: "#F59E0B", 2: "#94A3B8", 3: "#C2773F" };

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

const PlayIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l11-7z" /></svg>);
const PauseIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>);
const ReplayIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v5h-5" /></svg>);
const CloseIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>);

interface RowRefs { row: HTMLDivElement; bar: HTMLElement; val: HTMLElement }

export function BarChartRaceModal({
  poolId,
  token,
  poolName,
  tournamentKey,
  code,
  mode = "modal",
  isMobile,
  onClose,
}: {
  poolId?: string;
  token?: string | null;
  poolName?: string;
  tournamentKey?: string;
  code?: string; // public mode: resolve the race by its share code (no auth)
  mode?: "modal" | "page";
  isMobile: boolean;
  onClose?: () => void;
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
  const [reachedEnd, setReachedEnd] = useState(false); // race hit the last step
  const [barsOut, setBarsOut] = useState(false); // bars fading out before the podium
  const [finished, setFinished] = useState(false); // podium shown
  const [podiumRisen, setPodiumRisen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentStep, setCurrentStep] = useState(0); // for the clock (flags + score)
  const [poolNameState, setPoolNameState] = useState(poolName ?? "");
  const [tournamentKeyState, setTournamentKeyState] = useState(tournamentKey ?? "");
  const [shareUrl, setShareUrl] = useState("");
  const isPage = mode === "page";

  const VISIBLE = isMobile ? 10 : 15;
  const ROW_H = isMobile ? 36 : 44;
  // Cap the leader bar at this fraction of the track width so the external
  // value label (e.g. "126") always fits — tighter on the narrow mobile view.
  const MAX_BAR_FRAC = isMobile ? 0.72 : 0.84;

  const tRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const rowRefs = useRef(new Map<string, RowRefs>());
  const scrubRef = useRef<HTMLInputElement>(null);
  const pinnedRankRef = useRef<HTMLDivElement>(null);
  const lastFloorRef = useRef(-1);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    let cancelled = false;
    const load = code
      ? getPublicBarRace(code).then((r) => {
          if (cancelled) return;
          setData(r.barRace);
          setPoolNameState(r.poolName);
          setTournamentKeyState(r.tournamentKey);
          setStatus("ready");
        })
      : getPoolBarRace(token ?? "", poolId ?? "").then((r) => {
          if (cancelled) return;
          setData(r.barRace);
          setStatus("ready");
        });
    load.catch(() => !cancelled && setStatus("error"));
    return () => { cancelled = true; };
  }, [poolId, token, code]);

  // Share URL: page mode shares the current public URL. Modal mode seeds the
  // current URL immediately (so the share row never vanishes) then upgrades to
  // the pretty /e/{code} public link once the share code resolves; on failure
  // it keeps the seeded URL — no worse than before this feature.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareUrl(window.location.href);
    if (isPage || !poolId) return;
    let cancelled = false;
    getOrCreateShareCode(token ?? "", poolId)
      .then((r) => {
        if (!cancelled) setShareUrl(`${window.location.origin}/e/${r.shareCode}`);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isPage, poolId, token]);

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
      // Normalize so the leader maps to MAX_BAR_FRAC (never ~100%), leaving room
      // for the value label and preventing horizontal overflow on mobile.
      const span = Math.max(1, (maxVal - lo) / MAX_BAR_FRAC);

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
        setCurrentStep(floor); // clock re-renders (flags + score) only on step change
      }
      if (scrubRef.current && document.activeElement !== scrubRef.current) {
        scrubRef.current.value = String(tt);
      }
    },
    [data, ranksByStep, lastStep, VISIBLE, ROW_H, MAX_BAR_FRAC],
  );

  useEffect(() => {
    if (!playing) return;
    lastTsRef.current = 0;
    const tick = (ts: number) => {
      const dt = lastTsRef.current ? ts - lastTsRef.current : 0;
      lastTsRef.current = ts;
      tRef.current = Math.min(lastStep, tRef.current + dt / (STEP_MS / speedRef.current));
      renderFrame(tRef.current);
      if (tRef.current >= lastStep) { setPlaying(false); setReachedEnd(true); return; }
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

  // End sequence: hold on the final frame ~1.2s, fade the bars out, then swap to
  // the podium (so it doesn't feel abrupt).
  useEffect(() => {
    if (!reachedEnd || finished) return;
    const t1 = setTimeout(() => setBarsOut(true), 1200);
    const t2 = setTimeout(() => setFinished(true), 1750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reachedEnd, finished]);

  // Podium rise-in animation.
  useEffect(() => {
    if (!finished) { setPodiumRisen(false); return; }
    const id = setTimeout(() => setPodiumRisen(true), 80);
    return () => clearTimeout(id);
  }, [finished]);


  const togglePlay = useCallback(() => {
    if (!data) return;
    if (tRef.current >= lastStep) { tRef.current = 0; setReachedEnd(false); setBarsOut(false); setFinished(false); }
    setPlaying((p) => !p);
  }, [data, lastStep]);

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaying(false);
    setReachedEnd(false);
    setBarsOut(false);
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

  return (
    <div
      onClick={isPage ? undefined : onClose}
      style={
        isPage
          ? { minHeight: "100dvh", background: colors.bgLighter, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: isMobile ? 10 : 24, gap: 14 }
          : { position: "fixed", inset: 0, background: "rgba(15,23,42,0.62)", zIndex: zIndex.modalAbove, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 6 : 20 }
      }
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: colors.white, borderRadius: 18, width: "100%", maxWidth: 760, maxHeight: isPage ? "92dvh" : "95vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.4)", marginTop: isPage && !isMobile ? 24 : 0 }}
      >
        {/* Header */}
        <div style={{ background: colors.brandGradient, color: colors.white, padding: isMobile ? "13px 14px" : "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 15 : 19, fontWeight: 800 }}>🏁 {t("barRace.title")}</div>
            <div style={{ fontSize: 12, opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{poolNameState}</div>
          </div>
          {!isPage && (
            <button onClick={onClose} aria-label={t("barRace.close")} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: colors.white, color: colors.brand, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}><CloseIcon /></button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: isMobile ? "12px 12px 0" : "16px 20px 0", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {status === "loading" && <Centered>{t("barRace.loading")}</Centered>}
          {status === "error" && <Centered>{t("barRace.error")}</Centered>}
          {status === "ready" && (!data || data.steps.length === 0) && <Centered>{t("barRace.empty")}</Centered>}

          {ready && (
            <>
              {/* Share row */}
              {shareUrl && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <ShareButtons context="barRace" url={shareUrl} size="sm" showLabels={false} />
                </div>
              )}

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
                <div style={{ opacity: barsOut ? 0 : 1, transition: "opacity 0.5s ease" }}>
                  {/* Clock: the match(es) of this step with flags + score */}
                  {(() => {
                    const cs = data!.steps[Math.min(currentStep, lastStep)];
                    return (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                          {cs?.matches.slice(0, 2).map((m, k) => (
                            <ClockMatch key={k} m={m} tournamentKey={tournamentKeyState} isMobile={isMobile} />
                          ))}
                          {cs && cs.matches.length > 2 && (
                            <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>+{cs.matches.length - 2}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                          {t("barRace.progress", { n: Math.min(currentStep, lastStep) + 1, total: data!.steps.length })} · {fmtDate(cs?.kickoffUtc ?? "")}
                        </div>
                      </div>
                    );
                  })()}

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
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        {ready && (
          <div style={{ flexShrink: 0, borderTop: `1px solid ${colors.borderLight}`, background: colors.bgLighter, padding: isMobile ? "12px 14px" : "14px 20px", display: "flex", alignItems: "center", gap: isMobile ? 12 : 14 }}>
            <button onClick={togglePlay} aria-label={playing ? t("barRace.pause") : t("barRace.play")} style={{ width: 50, height: 50, borderRadius: "50%", border: "none", background: colors.brand, color: colors.white, cursor: "pointer", flexShrink: 0, boxShadow: `0 4px 14px ${colors.brand}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {playing ? <PauseIcon /> : finished || reachedEnd ? <ReplayIcon /> : <PlayIcon />}
            </button>
            <input ref={scrubRef} type="range" min={0} max={lastStep} step={0.01} defaultValue={0} onChange={onScrub} aria-label={t("barRace.title")} style={{ flex: 1, height: 28, accentColor: colors.brand, cursor: "pointer" }} />
            <button onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))} style={{ minWidth: 46, height: 40, borderRadius: 999, border: `1px solid ${colors.borderMedium}`, background: colors.white, color: colors.textDark, fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
              {speed}x
            </button>
          </div>
        )}
      </div>
      {isPage && (
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: colors.brand, fontWeight: 700, fontSize: 13, textDecoration: "none", padding: "4px 14px 10px" }}>
          🏆 Picks4All <span style={{ color: colors.textMuted, fontWeight: 600 }}>· {t("barRace.publicFooter")}</span>
        </a>
      )}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ padding: "56px 16px", textAlign: "center", color: colors.textMuted }}>{children}</div>;
}

function ClockMatch({ m, tournamentKey, isMobile }: { m: BarRaceMatch; tournamentKey: string; isMobile: boolean }) {
  const hf = getTeamFlag(m.homeId.replace("t_", ""), tournamentKey)?.flagUrl;
  const af = getTeamFlag(m.awayId.replace("t_", ""), tournamentKey)?.flagUrl;
  const flagStyle = { width: 22, height: 15, borderRadius: 2, objectFit: "cover" as const, flexShrink: 0 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: isMobile ? 13 : 15, fontWeight: 800, color: colors.text }}>
      {hf && <img src={hf} alt="" style={flagStyle} />}
      <span>{m.home}</span>
      <span style={{ color: colors.brand }}>{m.hg ?? "–"} - {m.ag ?? "–"}</span>
      <span>{m.away}</span>
      {af && <img src={af} alt="" style={flagStyle} />}
    </div>
  );
}
