"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { createInvite, getPoolOverview, upsertPick, upsertResult, getUserProfile, type PoolOverview } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { usePoolNotifications, calculateTabBadges, hasUrgentDeadlines } from "@/hooks/usePoolNotifications";
import { NotificationBadge } from "@/components/NotificationBadge";
import { ScoringBreakdownModal } from "@/components/ScoringBreakdownModal";
import { PlayerSummary } from "@/components/PlayerSummary";
import { CorporateEmployeeManager } from "@/components/CorporateEmployeeManager";
import { getPendingMembers } from "@/lib/api";
import type { PoolPickTypesConfig } from "@/types/pickConfig";

// Extracted tab components
import { PoolAdminTab } from "./components/PoolAdminTab";
import { PoolMatchesTab } from "./components/PoolMatchesTab";
import { PoolLeaderboardTab } from "./components/PoolLeaderboardTab";
import { PoolRulesTab } from "./components/PoolRulesTab";
import { norm, isPlaceholder, getPoolStatusBadge, formatPhaseName } from "./components/poolHelpers";
import type { BreakdownModalData, PlayerSummaryModalData } from "./components/poolTypes";

export default function PoolPage() {
  const { poolId } = useParams() as { poolId: string };
  const token = useMemo(() => getToken(), []);
  const isMobile = useIsMobile();
  const t = useTranslations("pool");

  // Helper: translate raw API error messages
  function friendlyError(e: any): string {
    const msg = e?.message ?? "";
    if (msg === "FORBIDDEN" || e?.status === 403) return t("httpErrors.FORBIDDEN");
    if (e?.status === 404) return t("httpErrors.NOT_FOUND");
    if (e?.status === 401) return t("httpErrors.UNAUTHORIZED");
    if (msg.startsWith("HTTP ")) return t("httpErrors.GENERIC");
    return msg || t("httpErrors.GENERIC");
  }

  // ── Core state ──
  const [overview, setOverview] = useState<PoolOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verbose = false;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string | null>(null);

  // ── UI state ──
  const [showSplash, setShowSplash] = useState(false);
  const [showCapacityPopup, setShowCapacityPopup] = useState(false);
  const [activeTab, setActiveTab] = useState<"partidos" | "leaderboard" | "resumen" | "reglas" | "jugadores" | "admin">("partidos");

  // Phase navigation
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Pending members
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);

  // Modals
  const [breakdownModalData, setBreakdownModalData] = useState<BreakdownModalData | null>(null);
  const [playerSummaryModal, setPlayerSummaryModal] = useState<PlayerSummaryModalData | null>(null);

  // UCL incident banner
  const [uclBannerDismissed, setUclBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(`ucl_incident_banner_${poolId}`) === "1";
  });

  // Match filters
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyNoPick, setOnlyNoPick] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyNoResult, setOnlyNoResult] = useState(false);

  // Invite
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Notifications
  const { notifications, refetch: refetchNotifications } = usePoolNotifications(poolId, {
    pollingInterval: 60000,
    enabled: !!poolId,
  });
  const tabBadges = calculateTabBadges(notifications);
  const hasUrgent = hasUrgentDeadlines(notifications);

  // ── Data loading ──
  async function load() {
    if (!token || !poolId) return;
    setError(null);
    try {
      const data = await getPoolOverview(token, poolId, verbose);
      setOverview(data);

      if (data.pool.organization && typeof sessionStorage !== "undefined") {
        const key = `corporate-splash-${poolId}`;
        if (!sessionStorage.getItem(key)) {
          setShowSplash(true);
        }
      }

      if (
        data.pool.maxParticipants &&
        data.counts.membersActive >= data.pool.maxParticipants &&
        (data.myMembership.role === "HOST" || data.myMembership.role === "CORPORATE_HOST") &&
        typeof localStorage !== "undefined"
      ) {
        const dismissKey = `pool-capacity-full-dismissed-${poolId}`;
        if (!localStorage.getItem(dismissKey)) {
          setShowCapacityPopup(true);
        }
      }

      const profileData = await getUserProfile(token);
      setUserTimezone(profileData.user.timezone);

      if (data.permissions.canManageResults) {
        loadPendingMembers();
      }
    } catch (e: any) {
      setError(friendlyError(e));
    }
  }

  async function loadPendingMembers() {
    if (!token || !poolId) return;
    try {
      const data = await getPendingMembers(token, poolId);
      setPendingMembers(data.pendingMembers || []);
    } catch (e: any) {
      console.error("Error loading pending members:", e);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, verbose]);

  // ── Computed values ──
  const phases = useMemo(() => {
    if (!overview) return [];
    const data = (overview.tournamentInstance as any).dataJson;
    if (!data?.phases) return [];
    return data.phases.sort((a: any, b: any) => a.order - b.order);
  }, [overview]);

  useEffect(() => {
    if (phases.length > 0 && !activePhase) {
      setActivePhase(phases[0].id);
    }
  }, [phases, activePhase]);

  const getPhaseStatus = (phaseId: string) => {
    if (!overview) return "PENDING";
    const phaseMatches = overview.matches.filter((m: any) => m.phaseId === phaseId);
    if (phaseMatches.length === 0) return "PENDING";
    const hasPlaceholders = phaseMatches.some((m: any) =>
      isPlaceholder(m.homeTeam?.id || "") || isPlaceholder(m.awayTeam?.id || "")
    );
    if (hasPlaceholders) return "PENDING";
    const hasAllResults = phaseMatches.every((m: any) => m.result);
    return hasAllResults ? "COMPLETED" : "ACTIVE";
  };

  const nextPhaseMap: Record<string, string | null> = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (let i = 0; i < phases.length; i++) {
      map[phases[i].id] = i < phases.length - 1 ? phases[i + 1].id : null;
    }
    return map;
  }, [phases]);

  const hasPhaseAdvanced = (phaseId: string): boolean => {
    if (!overview) return false;
    const nextPhaseId = nextPhaseMap[phaseId];
    if (!nextPhaseId) return false;
    const nextPhaseMatches = overview.matches.filter((m: any) => m.phaseId === nextPhaseId);
    if (nextPhaseMatches.length === 0) return false;
    const hasPlaceholdersInNext = nextPhaseMatches.some((m: any) =>
      isPlaceholder(m.homeTeam?.id || "") || isPlaceholder(m.awayTeam?.id || "")
    );
    return !hasPlaceholdersInNext;
  };

  const allowScorePick = useMemo(() => {
    if (!overview) return true;
    const allow = (overview as any)?.leaderboard?.scoringPreset?.allowScorePick;
    if (typeof allow === "boolean") return allow;
    return overview.pool.scoringPresetKey !== "OUTCOME_ONLY";
  }, [overview]);

  const activePhaseConfig = useMemo(() => {
    if (!overview || !activePhase || !overview.pool.pickTypesConfig) return null;
    const config = overview.pool.pickTypesConfig as PoolPickTypesConfig;
    if (!Array.isArray(config)) return null;
    return config.find((pc: any) => pc.phaseId === activePhase) || null;
  }, [overview, activePhase]);

  const requiresStructuralPicks = useMemo(() => {
    if (!activePhaseConfig) return false;
    return activePhaseConfig.requiresScore === false && !!activePhaseConfig.structuralPicks;
  }, [activePhaseConfig]);

  const activePhaseData = useMemo(() => {
    if (!activePhase) return null;
    return phases.find((p: any) => p.id === activePhase) || null;
  }, [phases, activePhase]);

  const nextOpenGroup = useMemo(() => {
    if (!overview) return "A";
    const next = overview.matches
      .filter((m: any) => !m.isLocked)
      .sort((a: any, b: any) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())[0];
    return next?.groupId ?? "A";
  }, [overview]);

  const filteredMatches = useMemo(() => {
    if (!overview) return [];
    const q = norm(search);
    return overview.matches.filter((m: any) => {
      if (activePhase && (m as any).phaseId !== activePhase) return false;
      if (onlyOpen && m.isLocked) return false;
      if (onlyNoPick && m.myPick) return false;
      if (onlyNoResult && m.result) return false;
      if (q) {
        const ht = norm(m.homeTeam?.name ?? m.homeTeam?.code ?? m.homeTeam?.id ?? "");
        const at = norm(m.awayTeam?.name ?? m.awayTeam?.code ?? m.awayTeam?.id ?? "");
        const round = norm(m.roundLabel ?? "");
        const group = norm(m.groupId ?? "");
        const venue = norm(m.venue ?? "");
        if (![ht, at, round, group, venue].some((x) => x.includes(q))) return false;
      }
      return true;
    });
  }, [overview, activePhase, onlyOpen, onlyNoPick, onlyNoResult, search]);

  const matchesByGroup = useMemo(() => {
    const by: Record<string, typeof filteredMatches> = {};
    for (const m of filteredMatches) {
      const g = m.groupId ?? "SIN_GRUPO";
      (by[g] ??= []).push(m);
    }
    for (const g of Object.keys(by)) {
      by[g].sort((a: any, b: any) => {
        const ta = new Date(a.kickoffUtc).getTime();
        const tb = new Date(b.kickoffUtc).getTime();
        if (ta !== tb) return ta - tb;
        return a.id.localeCompare(b.id);
      });
    }
    return by;
  }, [filteredMatches]);

  const groupOrder = useMemo(() => {
    const keys = Object.keys(matchesByGroup);
    const priority = "ABCDEFGHIJKL".split("");
    const set = new Set(keys);
    const ordered: string[] = [];
    for (const g of priority) if (set.has(g)) ordered.push(g);
    const rest = keys.filter((k) => !priority.includes(k) && k !== "SIN_GRUPO").sort((a, b) => a.localeCompare(b));
    ordered.push(...rest);
    if (set.has("SIN_GRUPO")) ordered.push("SIN_GRUPO");
    return ordered;
  }, [matchesByGroup]);

  const phaseMatchResults = useMemo(() => {
    if (!overview || !activePhase) return new Map();
    const resultsMap = new Map<string, { homeGoals: number; awayGoals: number; homePenalties?: number | null; awayPenalties?: number | null }>();
    for (const m of overview.matches) {
      if ((m as any).phaseId === activePhase && m.result) {
        resultsMap.set(m.id, {
          homeGoals: m.result.homeGoals,
          awayGoals: m.result.awayGoals,
          homePenalties: m.result.homePenalties,
          awayPenalties: m.result.awayPenalties,
        });
      }
    }
    return resultsMap;
  }, [overview, activePhase]);

  // ── Actions ──
  async function onCreateInvite() {
    if (!token || !poolId) return;
    setBusyKey("invite");
    setError(null);
    try {
      const inv = await createInvite(token, poolId);
      setInviteCode(inv.code);
      try { await navigator.clipboard.writeText(inv.code); } catch {}
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function savePick(matchId: string, pick: any) {
    if (!token || !poolId) return;
    setBusyKey(`pick:${matchId}`);
    setError(null);
    try {
      let normalizedPick = pick;
      if (pick?.type === "SCORE") {
        const hg = Number(pick.homeGoals);
        const ag = Number(pick.awayGoals);
        if (!Number.isFinite(hg) || !Number.isFinite(ag)) {
          throw new Error(t("invalidScore"));
        }
        normalizedPick = { ...pick, homeGoals: hg, awayGoals: ag };
      }
      await upsertPick(token, poolId, matchId, { pick: normalizedPick });
      await load();
      refetchNotifications();
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function saveResult(matchId: string, input: { homeGoals: number; awayGoals: number; reason?: string; homePenalties?: number; awayPenalties?: number }) {
    if (!token || !poolId) return;
    setBusyKey(`res:${matchId}`);
    setError(null);
    try {
      await (await import("@/lib/api")).upsertResult(token, poolId, matchId, input);
      await load();
      refetchNotifications();
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleScoringOverride(matchId: string, currentEnabled: boolean, reason: string) {
    if (!token || !poolId) return;
    const newEnabled = !currentEnabled;
    await (await import("@/lib/api")).setScoringOverride(token, poolId, matchId, newEnabled, reason || undefined);
    await load();
  }

  // ── Early returns ──
  if (!poolId) return <div style={{ padding: 16 }}>{t("poolIdMissing")}</div>;

  // ── Render ──
  return (
    <div style={{ maxWidth: 1180, margin: "18px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "#007bff", textDecoration: "none", fontWeight: 600, fontSize: 14,
            padding: "6px 12px", borderRadius: 8, background: "#f0f7ff",
            border: "1px solid #007bff30", transition: "background 0.15s ease",
          }}
        >
          {t("backToDashboard")}
        </Link>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fee", border: "1px solid #fbb", color: "#700" }}>
          {error}
        </div>
      )}

      {!overview && !error && <p style={{ marginTop: 16 }}>{t("loading")}</p>}

      {/* Capacity Full Popup */}
      {showCapacityPopup && overview?.pool.maxParticipants && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }}
          onClick={() => setShowCapacityPopup(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#128680;</div>
            <h3 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 800, color: "#DC2626" }}>
              {t("admin.capacity.fullTitle")}
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
              {t("admin.capacity.fullMessage", { max: overview.pool.maxParticipants })}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => { setShowCapacityPopup(false); setActiveTab("admin"); }}
                style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "#4f46e5", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                {t("admin.capacity.title")}
              </button>
              <button
                onClick={() => setShowCapacityPopup(false)}
                style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid #d1d5db", background: "transparent", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                {t("admin.capacity.fullDismiss")}
              </button>
              <button
                onClick={() => {
                  setShowCapacityPopup(false);
                  if (typeof localStorage !== "undefined") {
                    localStorage.setItem(`pool-capacity-full-dismissed-${poolId}`, "true");
                  }
                }}
                style={{ padding: "8px 24px", borderRadius: 10, border: "none", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}
              >
                {t("admin.capacity.fullDontShow")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Corporate Splash Screen */}
      {overview && showSplash && overview.pool.organization && (() => {
        const org = overview.pool.organization;
        return (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #0f0a2e 0%, #1a1145 35%, #2d1b69 65%, #1e1b4b 100%)", padding: 24, overflow: "hidden" }}
          >
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
              <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", top: "-5%", right: "-5%" }} />
              <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)", bottom: "-10%", left: "-10%" }} />
              <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)", top: "40%", left: "60%" }} />
            </div>
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 420, width: "100%", padding: "48px 36px 40px", borderRadius: 24, background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
              {org.logoBase64 ? (
                <div style={{ position: "relative", marginBottom: 28 }}>
                  <div style={{ position: "absolute", inset: -6, borderRadius: 24, background: "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.4))", filter: "blur(12px)" }} />
                  <img src={org.logoBase64} alt={org.name} style={{ position: "relative", maxHeight: 200, maxWidth: 320, borderRadius: 16, objectFit: "contain", border: "3px solid rgba(255,255,255,0.15)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }} />
                </div>
              ) : (
                <div style={{ width: 180, height: 180, borderRadius: 24, marginBottom: 28, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, fontWeight: 800, color: "#fff", border: "3px solid rgba(255,255,255,0.15)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
                  {org.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: -0.5, lineHeight: 1.2, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                {org.name}
              </h1>
              <span style={{ display: "inline-block", marginTop: 12, padding: "5px 16px", borderRadius: 999, background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd", fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>
                {t("corporate.badge")}
              </span>
              {org.welcomeMessage && (
                <div style={{ marginTop: 28, padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.85)", fontStyle: "italic" }}>
                    &ldquo;{org.welcomeMessage}&rdquo;
                  </p>
                </div>
              )}
              <button
                onClick={() => { sessionStorage.setItem(`corporate-splash-${poolId}`, "1"); setShowSplash(false); }}
                style={{ marginTop: 32, padding: "16px 48px", fontSize: 17, fontWeight: 700, background: "linear-gradient(135deg, #fff 0%, #e0e7ff 100%)", color: "#3730a3", border: "none", borderRadius: 14, cursor: "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.3), 0 0 0 1px rgba(255,255,255,0.1)", transition: "transform 0.15s, box-shadow 0.15s", letterSpacing: 0.3 }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(99,102,241,0.4), 0 0 0 1px rgba(255,255,255,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.3), 0 0 0 1px rgba(255,255,255,0.1)"; }}
              >
                {t("corporate.playButton")}
              </button>
              <p style={{ marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: 0.3 }}>
                {overview.pool.name} &middot; {overview.counts.membersActive} {t("corporate.players")}
              </p>
            </div>
          </div>
        );
      })()}

      {overview && (
        <>
          {/* UCL incident banner */}
          {!uclBannerDismissed && overview.tournamentInstance?.templateKey === "ucl-2025" && (
            <div style={{ marginTop: 12, marginBottom: 12, padding: "16px 20px", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)", borderRadius: 14, border: "1px solid #2d5a8e", color: "#e0eaf5", position: "relative" }}>
              <button
                onClick={() => { localStorage.setItem(`ucl_incident_banner_${poolId}`, "1"); setUclBannerDismissed(true); }}
                style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "#8ba8c8", fontSize: 20, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}
                aria-label="Close"
              >
                ×
              </button>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8, color: "#fff" }}>{t("uclIncidentBanner.title")}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{t("uclIncidentBanner.body")}</div>
              <div style={{ fontSize: 13, marginTop: 10, color: "#93c5fd", fontWeight: 600 }}>{t("uclIncidentBanner.thanks")}</div>
            </div>
          )}

          {/* Pool header - Corporate */}
          {!showSplash && overview.pool.organization && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, marginBottom: 8 }}>
              {overview.pool.organization.logoBase64 ? (
                <img src={overview.pool.organization.logoBase64} alt={overview.pool.organization.name} style={{ maxHeight: 128, maxWidth: 200, objectFit: "contain", borderRadius: 12, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 100, height: 100, borderRadius: 14, flexShrink: 0, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: 800, color: "#fff" }}>
                  {overview.pool.organization.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1a2e", lineHeight: 1.2, letterSpacing: "-0.5px" }}>{overview.pool.name}</div>
                <div style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600, marginTop: 2 }}>{t("corporate.byCompany", { company: overview.pool.organization.name })}</div>
              </div>
              {overview.pool.status && (() => {
                const badge = getPoolStatusBadge(overview.pool.status, t);
                return (
                  <span style={{ fontSize: 13, padding: "4px 12px", borderRadius: 999, border: `1px solid ${badge.color}`, background: `${badge.color}20`, color: badge.color, fontWeight: 600, marginLeft: "auto", flexShrink: 0 }}>
                    {badge.emoji} {badge.label}
                  </span>
                );
              })()}
            </div>
          )}

          {/* Pool header - Standard */}
          {!overview.pool.organization && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>{overview.pool.name}</h2>
              {overview.pool.status && (() => {
                const badge = getPoolStatusBadge(overview.pool.status, t);
                return (
                  <span style={{ fontSize: 13, padding: "4px 12px", borderRadius: 999, border: `1px solid ${badge.color}`, background: `${badge.color}20`, color: badge.color, fontWeight: 600 }}>
                    {badge.emoji} {badge.label}
                  </span>
                );
              })()}
            </div>
          )}

          <div style={{ color: "#666", fontSize: 12 }}>
            {overview.tournamentInstance.name} • {overview.pool.maxParticipants ? `${overview.counts.membersActive}/${overview.pool.maxParticipants}` : overview.counts.membersActive} {t("members")} • {t("yourRole")}: <b>{overview.myMembership.role}</b>
          </div>

          {/* LEFT member banner */}
          {overview.myMembership.status === "LEFT" && (
            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", fontSize: 13, fontWeight: 500 }}>
              {t("retiredBanner")}
            </div>
          )}

          {/* Tab Navigation */}
          <div style={{
            marginTop: isMobile ? 12 : 16, paddingTop: 8, borderBottom: "2px solid #e0e0e0",
            display: "flex", gap: isMobile ? 4 : 8, overflowX: "auto", overflowY: "visible",
            WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none",
            ...mobileInteractiveStyles.tapHighlight,
          }}>
            {(["partidos", "leaderboard", "resumen", "reglas", ...(overview.pool.organizationId && overview.myMembership.role === "CORPORATE_HOST" ? ["jugadores" as const] : []), ...(overview.permissions.canManageResults ? ["admin" as const] : [])] as const).map((tab) => {
              const badgeCount = tabBadges[tab] || 0;
              const isUrgent = tab === "partidos" && hasUrgent;
              const tabLabels: Record<string, string> = {
                partidos: isMobile ? "⚽" : `⚽ ${t("tabs.matches")}`,
                leaderboard: isMobile ? "📊" : `📊 ${t("tabs.leaderboard")}`,
                resumen: isMobile ? "📈" : `📈 ${t("tabs.summary")}`,
                reglas: isMobile ? "📋" : `📋 ${t("tabs.rules")}`,
                jugadores: isMobile ? "👥" : `👥 ${t("tabs.players")}`,
                admin: isMobile ? "⚙️" : `⚙️ ${t("tabs.admin")}`,
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    position: "relative",
                    padding: isMobile ? "12px 16px" : "12px 24px",
                    border: "none",
                    borderBottom: activeTab === tab ? "3px solid #007bff" : "3px solid transparent",
                    background: "transparent",
                    color: activeTab === tab ? "#007bff" : "#666",
                    fontWeight: activeTab === tab ? 600 : 400,
                    fontSize: isMobile ? 18 : 16,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    flexShrink: 0,
                    minHeight: TOUCH_TARGET.minimum,
                    ...mobileInteractiveStyles.tapHighlight,
                  }}
                  title={tab.charAt(0).toUpperCase() + tab.slice(1)}
                >
                  {tabLabels[tab]}
                  {badgeCount > 0 && <NotificationBadge count={badgeCount} pulse={isUrgent} />}
                </button>
              );
            })}
          </div>

          {/* Mobile tab label */}
          {isMobile && (
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "#007bff", textAlign: "center" }}>
              {activeTab === "partidos" && t("tabs.matches")}
              {activeTab === "leaderboard" && t("tabs.leaderboard")}
              {activeTab === "resumen" && t("tabs.summary")}
              {activeTab === "reglas" && t("tabs.rules")}
              {activeTab === "jugadores" && t("tabs.players")}
              {activeTab === "admin" && t("tabs.admin")}
            </div>
          )}

          {/* ── Tab Content ── */}

          {activeTab === "jugadores" && overview.pool.organizationId && overview.myMembership.role === "CORPORATE_HOST" && token && (
            <div style={{ marginTop: 14, padding: 20, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
              <CorporateEmployeeManager poolId={poolId!} token={token} isMobile={isMobile} />
            </div>
          )}

          {activeTab === "admin" && overview.permissions.canManageResults && (
            <PoolAdminTab
              poolId={poolId} token={token!} overview={overview} isMobile={isMobile}
              busyKey={busyKey} setBusyKey={setBusyKey} error={error} setError={setError}
              userTimezone={userTimezone} reload={load} refetchNotifications={refetchNotifications}
              friendlyError={friendlyError} phases={phases} getPhaseStatus={getPhaseStatus}
              hasPhaseAdvanced={hasPhaseAdvanced} nextPhaseMap={nextPhaseMap}
              notifications={notifications} tabBadges={tabBadges}
              pendingMembers={pendingMembers} loadPendingMembers={loadPendingMembers}
            />
          )}

          {activeTab === "resumen" && (
            <div style={{ marginTop: 14, padding: 20, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
              <PlayerSummary
                poolId={poolId!}
                userId={overview.myMembership.userId ?? ""}
                tournamentKey={overview.tournamentInstance.templateKey ?? "wc_2026_sandbox"}
              />
            </div>
          )}

          {activeTab === "reglas" && (
            <PoolRulesTab overview={overview} allowScorePick={allowScorePick} />
          )}

          {activeTab === "partidos" && (
            <PoolMatchesTab
              poolId={poolId} token={token!} overview={overview} isMobile={isMobile}
              busyKey={busyKey} setBusyKey={setBusyKey} error={error} setError={setError}
              userTimezone={userTimezone} reload={load} refetchNotifications={refetchNotifications}
              friendlyError={friendlyError}
              phases={phases} activePhase={activePhase} setActivePhase={setActivePhase}
              getPhaseStatus={getPhaseStatus}
              allowScorePick={allowScorePick} activePhaseConfig={activePhaseConfig}
              requiresStructuralPicks={requiresStructuralPicks} activePhaseData={activePhaseData}
              nextOpenGroup={nextOpenGroup} filteredMatches={filteredMatches}
              matchesByGroup={matchesByGroup} groupOrder={groupOrder} phaseMatchResults={phaseMatchResults}
              search={search} setSearch={setSearch} onlyOpen={onlyOpen} setOnlyOpen={setOnlyOpen}
              onlyNoPick={onlyNoPick} setOnlyNoPick={setOnlyNoPick}
              onlyNoResult={onlyNoResult} setOnlyNoResult={setOnlyNoResult}
              selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup}
              savePick={savePick} saveResult={saveResult}
              onCreateInvite={onCreateInvite} inviteCode={inviteCode}
              notifications={notifications} tabBadges={tabBadges}
              setBreakdownModalData={setBreakdownModalData}
            />
          )}

          {activeTab === "leaderboard" && (
            <PoolLeaderboardTab
              overview={overview} poolId={poolId} isMobile={isMobile}
              playerSummaryModal={playerSummaryModal}
              setPlayerSummaryModal={setPlayerSummaryModal}
            />
          )}

          {/* Scoring Breakdown Modal */}
          {poolId && (
            <ScoringBreakdownModal
              isOpen={!!breakdownModalData}
              onClose={() => setBreakdownModalData(null)}
              poolId={poolId}
              matchId={breakdownModalData?.matchId}
              matchTitle={breakdownModalData?.matchTitle}
              phaseId={breakdownModalData?.phaseId}
              phaseTitle={breakdownModalData?.phaseTitle}
            />
          )}
        </>
      )}
    </div>
  );
}
