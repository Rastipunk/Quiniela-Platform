"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createInvite, getPoolOverview, upsertPick, upsertResult, getUserProfile, type PoolOverview } from "@/lib/api";
import type { PoolMatchCard, PoolFixturePhase, PhasePickConfigItem } from "@/lib/poolTypes";
import { getToken } from "@/lib/auth";
import { useIsMobile, BREAKPOINTS } from "@/hooks/useIsMobile";
import { usePoolNotifications, calculateTabBadges, hasUrgentDeadlines } from "@/hooks/usePoolNotifications";
import { ScoringBreakdownModal } from "@/components/ScoringBreakdownModal";
import { PlayerSummary } from "@/components/PlayerSummary";
import { PoolPlayersTab } from "./components/PoolPlayersTab";
import { PoolStatsTab } from "./components/PoolStatsTab";
import { ShareButtons } from "@/components/ShareButtons";
import { getPendingMembers } from "@/lib/api";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { trackEvent } from "@/lib/analytics";
import { trackMetaEvent, trackMetaCustomEvent } from "@/lib/metaPixel";
import { resolveBrandColors, darken } from "@/lib/brandColors";

// Dynamic imports for heavy tab components (HI-06)
const PoolAdminTab = dynamic(() => import("./components/PoolAdminTab").then(m => ({ default: m.PoolAdminTab })), {
  loading: () => <div style={{ padding: 20, textAlign: "center", color: colors.textLight }}>Loading...</div>,
});
const PoolMatchesTab = dynamic(() => import("./components/PoolMatchesTab").then(m => ({ default: m.PoolMatchesTab })), {
  loading: () => <div style={{ padding: 20, textAlign: "center", color: colors.textLight }}>Loading...</div>,
});
const PoolLeaderboardTab = dynamic(() => import("./components/PoolLeaderboardTab").then(m => ({ default: m.PoolLeaderboardTab })), {
  loading: () => <div style={{ padding: 20, textAlign: "center", color: colors.textLight }}>Loading...</div>,
});
const PoolRulesTab = dynamic(() => import("./components/PoolRulesTab").then(m => ({ default: m.PoolRulesTab })), {
  loading: () => <div style={{ padding: 20, textAlign: "center", color: colors.textLight }}>Loading...</div>,
});
import { norm, isPlaceholder, getPoolStatusBadge, formatPhaseName, getTournamentName, derivePhaseTabState } from "./components/poolHelpers";
import type { BreakdownModalData, PlayerSummaryModalData } from "./components/poolTypes";
import { PoolNavDrawer } from "./components/PoolNavDrawer";
import { ExtraTimeHostBanner } from "./components/ExtraTimeHostBanner";
import { DeadlineConfigHostBanner } from "./components/DeadlineConfigHostBanner";
import { PoolSectionHeader } from "./components/PoolSectionHeader";
import { PoolCapacityTab } from "./components/PoolCapacityTab";
import { PoolBrandingTab } from "./components/PoolBrandingTab";
import { usePublishPoolNav } from "@/components/pool/PoolNav";
import { colors, radii, fontSize, fontWeight, shadows, spacing, zIndex } from "@/lib/theme";

const VALID_TABS = ["partidos", "leaderboard", "estadisticas", "resumen", "reglas", "jugadores", "capacidad", "personalizacion", "admin"] as const;
type PoolTab = typeof VALID_TABS[number];

export default function PoolPage() {
  const { poolId } = useParams() as { poolId: string };
  const token = useMemo(() => getToken(), []);
  const isMobile = useIsMobile();
  // Compact = below tabletLg (1024px) — same threshold as the hamburger
  // menu. We hide the in-page "back to dashboard" link in compact mode
  // because the hamburger drawer already exposes "Mis Pools".
  const isCompact = useIsMobile({ breakpoint: BREAKPOINTS.tabletLg });
  const t = useTranslations("pool");
  const tTournaments = useTranslations("tournaments");
  const router = useRouter();
  const searchParams = useSearchParams();

  // HI-05: Read UI state from URL search params
  const activeTab: PoolTab = useMemo(() => {
    const param = searchParams.get("tab");
    if (param && VALID_TABS.includes(param as PoolTab)) return param as PoolTab;
    return "partidos";
  }, [searchParams]);

  const activePhase: string | null = searchParams.get("phase") || null;
  const selectedGroup: string | null = searchParams.get("group") || null;

  const setActiveTab = useCallback((tab: PoolTab) => {
    trackEvent("tab_changed", { tab });
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "partidos") params.delete("tab"); else params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const setActivePhase = useCallback((phase: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (phase) params.set("phase", phase); else params.delete("phase");
    params.delete("group"); // reset group when phase changes
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const setSelectedGroup = useCallback((group: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (group) params.set("group", group); else params.delete("group");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Helper: translate raw API error messages
  function friendlyError(e: unknown): string {
    const err = e as { message?: string; status?: number };
    const msg = err?.message ?? "";
    if (msg === "PENDING_APPROVAL") return "PENDING_APPROVAL";
    if (msg === "POOL_DRAFT") return t("httpErrors.POOL_DRAFT");
    if (msg === "FORBIDDEN" || err?.status === 403) return t("httpErrors.FORBIDDEN");
    if (err?.status === 404) return t("httpErrors.NOT_FOUND");
    if (err?.status === 401) return t("httpErrors.UNAUTHORIZED");
    if (msg.startsWith("HTTP ")) return t("httpErrors.GENERIC");
    const friendly = msg || t("httpErrors.GENERIC");
    trackEvent("error_displayed", { error_code: msg, status: err?.status, page: "pool" });
    return friendly;
  }

  // ── Core state ──
  const [overview, setOverview] = useState<PoolOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string | null>(null);

  // ── UI state ──
  const [showSplash, setShowSplash] = useState(false);
  const [showCapacityPopup, setShowCapacityPopup] = useState(false);
  const [extraTimeBannerDismissed, setExtraTimeBannerDismissed] = useState(false);
  const [deadlineBannerDismissed, setDeadlineBannerDismissed] = useState(false);

  // Pending members
  const [pendingMembers, setPendingMembers] = useState<Array<{ id: string; userId: string; user: { displayName: string; email: string } }>>([]);

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
  // "Show finished matches" — default OFF (declutters the list down to
  // upcoming/in-play). Persisted like the sort mode; applied post-mount
  // so SSR and first client paint agree (no hydration mismatch).
  const SHOW_FINALIZED_KEY = "p4a-matches-show-finalized";
  const [showFinalized, setShowFinalized] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SHOW_FINALIZED_KEY) === "1") setShowFinalized(true);
    } catch { /* private mode */ }
  }, []);
  const changeShowFinalized = (v: boolean) => {
    setShowFinalized(v);
    try { window.localStorage.setItem(SHOW_FINALIZED_KEY, v ? "1" : "0"); } catch { /* private mode */ }
  };

  // Invite
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Notifications
  const { notifications, refetch: refetchNotifications } = usePoolNotifications(poolId, {
    pollingInterval: 60000,
    enabled: !!poolId,
  });
  const tabBadges = calculateTabBadges(notifications);
  const hasUrgent = hasUrgentDeadlines(notifications);

  // Publish pool nav state to the layout-level store so the global
  // navbar drawer can render pool sections at the top of its menu
  // on mobile. Snapshot clears on unmount so other routes are clean.
  // showBrandingTab is host-only AND corporate-only — standard pools
  // never see Personalización because they have no Organization.
  usePublishPoolNav(
    overview
      ? {
          showHostItems: overview.permissions.canManageResults,
          showBrandingTab:
            overview.permissions.canManageResults && !!overview.pool.organizationId,
          tabBadges,
          hasUrgent,
        }
      : null,
  );

  // ── Data loading ──
  async function load() {
    if (!token || !poolId) return;
    setError(null);
    try {
      const data = await getPoolOverview(token, poolId);
      setOverview(data);
      // First-time visit detection: a localStorage flag per (user, pool).
      // Cohort reports use `first_time:true` pool_viewed events as
      // "activation" vs subsequent visits as "engagement".
      let firstTime = false;
      if (typeof localStorage !== "undefined") {
        const key = `p4a_viewed_pool_${poolId}`;
        if (!localStorage.getItem(key)) {
          firstTime = true;
          try {
            localStorage.setItem(key, String(Date.now()));
          } catch { /* storage full — still fire with first_time=true */ }
        }
      }
      trackEvent("pool_viewed", {
        pool_name: data.pool.name,
        tournament: data.tournamentInstance.name,
        role: data.myMembership.role,
        first_time: firstTime,
      });
      trackMetaEvent("ViewContent", { content_type: "pool", content_name: data.pool.name });

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
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function loadPendingMembers() {
    if (!token || !poolId) return;
    try {
      const data = await getPendingMembers(token, poolId);
      setPendingMembers(data.pendingMembers || []);
    } catch (e) {
      console.error("Error loading pending members:", e);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  // Auto-refresh when any match is live (polls every 15s)
  const liveRefetch = useCallback(async () => {
    if (!token || !poolId) return;
    try {
      const data = await getPoolOverview(token, poolId);
      setOverview(data);
    } catch { /* silent — don't overwrite existing data on refresh failure */ }
  }, [token, poolId]);
  useLiveRefresh(overview?.matches ?? [], liveRefetch);

  // ── Computed values ──
  const phases = useMemo((): PoolFixturePhase[] => {
    if (!overview) return [];
    const data = overview.tournamentInstance.dataJson;
    if (!data?.phases) return [];
    return [...data.phases].sort((a, b) => a.order - b.order);
  }, [overview]);

  useEffect(() => {
    if (phases.length > 0 && !activePhase && overview) {
      // Default tab = the phase being PLAYED (⚽); else the first one open
      // for predictions; else the first not-yet-finalized; else the first.
      const stateOf = (phaseId: string) =>
        derivePhaseTabState(phaseId, overview.matches, overview.tournamentInstance.knockoutRelease);
      const live = phases.find((p) => stateOf(p.id) === "LIVE");
      const open = phases.find((p) => stateOf(p.id) === "OPEN");
      const notDone = phases.find((p) => stateOf(p.id) !== "FINALIZED");
      setActivePhase((live ?? open ?? notDone ?? phases[0]).id);
    }
  }, [phases, activePhase, setActivePhase, overview]);

  const getPhaseStatus = (phaseId: string) => {
    if (!overview) return "PENDING";
    const phaseMatches = overview.matches.filter((m) => m.phaseId === phaseId);
    if (phaseMatches.length === 0) return "PENDING";
    const hasPlaceholders = phaseMatches.some((m) =>
      isPlaceholder(m.homeTeam?.id || "") || isPlaceholder(m.awayTeam?.id || "")
    );
    if (hasPlaceholders) return "PENDING";
    const hasAllResults = phaseMatches.every((m) => m.result);
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
    const nextPhaseMatches = overview.matches.filter((m) => m.phaseId === nextPhaseId);
    if (nextPhaseMatches.length === 0) return false;
    const hasPlaceholdersInNext = nextPhaseMatches.some((m) =>
      isPlaceholder(m.homeTeam?.id || "") || isPlaceholder(m.awayTeam?.id || "")
    );
    return !hasPlaceholdersInNext;
  };

  const allowScorePick = useMemo(() => {
    if (!overview) return true;
    const allow = overview.leaderboard?.scoringPreset?.allowScorePick;
    if (typeof allow === "boolean") return allow;
    return overview.pool.scoringPresetKey !== "OUTCOME_ONLY";
  }, [overview]);

  const activePhaseConfig = useMemo(() => {
    if (!overview || !activePhase || !overview.pool.pickTypesConfig) return null;
    const config = overview.pool.pickTypesConfig;
    if (!Array.isArray(config)) return null;
    return config.find((pc) => pc.phaseId === activePhase) || null;
  }, [overview, activePhase]);

  const requiresStructuralPicks = useMemo(() => {
    if (!activePhaseConfig) return false;
    return activePhaseConfig.requiresScore === false && !!activePhaseConfig.structuralPicks;
  }, [activePhaseConfig]);

  const activePhaseData = useMemo(() => {
    if (!activePhase) return null;
    return phases.find((p) => p.id === activePhase) || null;
  }, [phases, activePhase]);

  const nextOpenGroup = useMemo(() => {
    if (!overview) return "A";
    const next = overview.matches
      .filter((m) => !m.isLocked)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())[0];
    return next?.groupId ?? "A";
  }, [overview]);

  const filteredMatches = useMemo(() => {
    if (!overview) return [];
    const q = norm(search);
    return overview.matches.filter((m) => {
      if (activePhase && m.phaseId !== activePhase) return false;
      if (onlyOpen && m.isLocked) return false;
      if (onlyNoPick && m.myPick) return false;
      if (onlyNoResult && m.result) return false;
      // Hide finished matches by default (Option A): a match with a
      // published result that is no longer live. In-play/grace matches
      // (isLive) and past-but-resultless (stuck) matches stay visible.
      if (!showFinalized && m.result && !m.isLive) return false;
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
  }, [overview, activePhase, onlyOpen, onlyNoPick, onlyNoResult, search, showFinalized]);

  const matchesByGroup = useMemo(() => {
    const by: Record<string, typeof filteredMatches> = {};
    for (const m of filteredMatches) {
      const g = m.groupId ?? "SIN_GRUPO";
      (by[g] ??= []).push(m);
    }
    for (const g of Object.keys(by)) {
      by[g].sort((a, b) => {
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
    const resultsMap = new Map<string, { homeGoals: number; awayGoals: number; homeGoals90?: number | null; awayGoals90?: number | null; homePenalties?: number | null; awayPenalties?: number | null }>();
    for (const m of overview.matches) {
      if (m.phaseId === activePhase && m.result) {
        resultsMap.set(m.id, {
          homeGoals: m.result.homeGoals,
          awayGoals: m.result.awayGoals,
          // goals90 reaches the wire but was dropped here (audit F4-2) —
          // KnockoutMatchCard needs it to show "90': X-X" on AET matches.
          homeGoals90: m.result.homeGoals90,
          awayGoals90: m.result.awayGoals90,
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
      trackEvent("invite_code_created");
      try { await navigator.clipboard.writeText(inv.code); } catch {}
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function savePick(matchId: string, pick: Record<string, unknown>) {
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
      trackEvent("pick_saved", { match_id: matchId, pick_type: normalizedPick.type });
      trackMetaCustomEvent("PickSaved", { content_name: matchId });
      await load();
      refetchNotifications();
    } catch (e) {
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
    } catch (e) {
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
    <>
      {/* Sticky section header sits flush under the navbar so the
          dark navbar + section band read as one continuous chrome.
          Only renders once the overview is loaded so we don't show
          a stale section title during the loading state. */}
      {overview && <PoolSectionHeader />}

      <div style={{ maxWidth: 1180, margin: "8px auto", padding: isMobile ? "8px 12px" : "8px 16px" }}>
      {!isCompact && (
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            color: colors.brand, textDecoration: "none", fontWeight: fontWeight.semibold, fontSize: fontSize.sm,
            padding: "6px 12px", borderRadius: radii.lg,
            border: `1px solid ${colors.brand}30`,
            background: `${colors.brand}08`,
            marginBottom: 8,
          }}
        >
          {t("backToDashboard")}
        </Link>
      )}

      {error && error === "PENDING_APPROVAL" ? (
        <div style={{
          marginTop: 24,
          padding: isMobile ? 24 : 32,
          borderRadius: radii["2xl"],
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
          border: "1px solid #fde68a",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>&#9203;</div>
          <h3 style={{ margin: "0 0 8px", fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.warningDarker }}>
            {t("pendingApproval.title")}
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: fontSize.base, color: "#a16207", lineHeight: 1.5 }}>
            {t("pendingApproval.description")}
          </p>
          <p style={{ margin: 0, fontSize: fontSize.sm, color: colors.warningDarker }}>
            {t("pendingApproval.hint")}
          </p>
        </div>
      ) : error ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: radii["2xl"], background: "#fee", border: "1px solid #fbb", color: "#700" }}>
          {error}
        </div>
      ) : null}

      {!overview && !error && <p style={{ marginTop: 16 }}>{t("loading")}</p>}

      {/* Capacity Full Popup */}
      {showCapacityPopup && overview?.pool.maxParticipants && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: zIndex.expulsion - 1, display: "flex", alignItems: "center", justifyContent: "center", background: colors.overlay, padding: 16 }}
          onClick={() => setShowCapacityPopup(false)}
        >
          <div
            style={{ background: colors.white, borderRadius: radii["4xl"], padding: 24, maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#128680;</div>
            <h3 style={{ margin: "0 0 12px", fontSize: fontSize["3xl"], fontWeight: fontWeight.extrabold, color: colors.error }}>
              {t("admin.capacity.fullTitle")}
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: fontSize.base, color: colors.textDark, lineHeight: 1.6 }}>
              {t("admin.capacity.fullMessage", { max: overview.pool.maxParticipants })}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => { setShowCapacityPopup(false); setActiveTab("capacidad"); }}
                style={{ padding: "12px 24px", borderRadius: radii.xl, border: "none", background: colors.brand, color: "white", fontSize: fontSize.base, fontWeight: fontWeight.bold, cursor: "pointer" }}
              >
                {t("admin.capacity.title")}
              </button>
              <button
                onClick={() => setShowCapacityPopup(false)}
                style={{ padding: "10px 24px", borderRadius: radii.xl, border: `1px solid ${colors.borderMedium}`, background: "transparent", color: colors.textDark, fontSize: fontSize.base, fontWeight: fontWeight.semibold, cursor: "pointer" }}
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
                style={{ padding: "8px 24px", borderRadius: radii.xl, border: "none", background: "transparent", color: colors.textLighter, fontSize: fontSize.sm, cursor: "pointer" }}
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
        const brand = resolveBrandColors(org.primaryColor, org.secondaryColor);
        // For non-customized orgs, preserve the original deep
        // indigo/violet gradient. For customized ones, render the
        // host-picked colors verbatim so the splash matches the
        // wizard preview. The contrast warning at creation time
        // already nudges hosts toward darker tones if needed.
        const splashBg = brand.isCustom
          ? `linear-gradient(160deg, ${brand.primary} 0%, ${brand.secondary} 100%)`
          : "linear-gradient(160deg, #0f0a2e 0%, #1a1145 35%, #2d1b69 65%, #1e1b4b 100%)";
        const logoBg = `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})`;
        // Play button sits on a near-white pill, so we tint the text
        // with a darker primary to keep contrast regardless of how
        // light the host's primary is.
        const playTextColor = darken(brand.primary, 0.25);
        return (
          <div
            style={{ position: "fixed", inset: 0, zIndex: zIndex.expulsion, display: "flex", alignItems: "center", justifyContent: "center", background: splashBg, padding: 24, overflow: "hidden" }}
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
                  <img src={org.logoBase64} alt={org.name} width={320} height={200} loading="lazy" decoding="async" style={{ position: "relative", maxHeight: 200, maxWidth: 320, height: "auto", width: "auto", borderRadius: 16, objectFit: "contain", border: "3px solid rgba(255,255,255,0.15)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }} />
                </div>
              ) : (
                <div style={{ width: 180, height: 180, borderRadius: 24, marginBottom: 28, background: logoBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, fontWeight: 800, color: colors.white, border: "3px solid rgba(255,255,255,0.15)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
                  {org.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h1 style={{ margin: 0, fontSize: fontSize["5xl"], fontWeight: fontWeight.extrabold, color: colors.white, letterSpacing: -0.5, lineHeight: 1.2, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                {org.name}
              </h1>
              <span style={{ display: "inline-block", marginTop: 12, padding: "5px 16px", borderRadius: radii.pill, background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd", fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: 0.5 }}>
                {t("corporate.badge")}
              </span>
              {org.welcomeMessage && (
                <div style={{ marginTop: 28, padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p style={{ margin: 0, fontSize: fontSize.lg, lineHeight: 1.6, color: "rgba(255,255,255,0.85)", fontStyle: "italic" }}>
                    &ldquo;{org.welcomeMessage}&rdquo;
                  </p>
                </div>
              )}
              <button
                onClick={() => { sessionStorage.setItem(`corporate-splash-${poolId}`, "1"); setShowSplash(false); }}
                style={{ marginTop: 32, padding: "16px 48px", fontSize: 17, fontWeight: fontWeight.bold, background: "linear-gradient(135deg, #fff 0%, #e0e7ff 100%)", color: playTextColor, border: "none", borderRadius: radii["3xl"], cursor: "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.3), 0 0 0 1px rgba(255,255,255,0.1)", transition: "transform 0.15s, box-shadow 0.15s", letterSpacing: 0.3 }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(99,102,241,0.4), 0 0 0 1px rgba(255,255,255,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.3), 0 0 0 1px rgba(255,255,255,0.1)"; }}
              >
                {t("corporate.playButton")}
              </button>
              <p style={{ marginTop: 20, fontSize: fontSize.md, color: "rgba(255,255,255,0.4)", fontWeight: fontWeight.medium, letterSpacing: 0.3 }}>
                {overview.pool.name} &middot; {overview.counts.membersActive} {t("corporate.players")}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Knockout extra-time host banner (v2) — blocking, gated + acked in DB */}
      {overview?.extraTime?.needsBanner && !extraTimeBannerDismissed && token && (
        <ExtraTimeHostBanner
          poolId={poolId}
          token={token}
          isMobile={isMobile}
          onAck={() => setExtraTimeBannerDismissed(true)}
          onGoToConfig={() => setActiveTab("admin")}
        />
      )}

      {/* Deadline-config host announcement (ADR-085) — gated + acked in DB.
          Shown after the extra-time banner so they don't overlap. */}
      {overview?.deadlineConfig?.needsBanner && !deadlineBannerDismissed
        && !(overview?.extraTime?.needsBanner && !extraTimeBannerDismissed) && token && (
        <DeadlineConfigHostBanner
          poolId={poolId}
          token={token}
          isMobile={isMobile}
          onAck={() => setDeadlineBannerDismissed(true)}
          onGoToConfig={() => setActiveTab("admin")}
        />
      )}

      {overview && (
        <>
          {/* UCL incident banner */}
          {!uclBannerDismissed && overview.tournamentInstance?.templateKey === "ucl-2025" && (
            <div style={{ marginTop: 12, marginBottom: 12, padding: "16px 20px", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)", borderRadius: radii["3xl"], border: "1px solid #2d5a8e", color: "#e0eaf5", position: "relative" }}>
              <button
                onClick={() => { localStorage.setItem(`ucl_incident_banner_${poolId}`, "1"); setUclBannerDismissed(true); }}
                style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "#8ba8c8", fontSize: 20, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}
                aria-label="Close"
              >
                ×
              </button>
              <div style={{ fontWeight: fontWeight.extrabold, fontSize: fontSize.xl, marginBottom: 8, color: colors.white }}>{t("uclIncidentBanner.title")}</div>
              <div style={{ fontSize: fontSize.md, lineHeight: 1.6 }}>{t("uclIncidentBanner.body")}</div>
              <div style={{ fontSize: fontSize.md, marginTop: 10, color: "#93c5fd", fontWeight: fontWeight.semibold }}>{t("uclIncidentBanner.thanks")}</div>
            </div>
          )}

          {/* Pool header - Corporate */}
          {!showSplash && overview.pool.organization && (() => {
            const headerOrg = overview.pool.organization;
            const headerBrand = resolveBrandColors(headerOrg.primaryColor, headerOrg.secondaryColor);
            const headerAccent = headerBrand.isCustom ? headerBrand.primary : colors.purple;
            const headerLogoBg = `linear-gradient(135deg, ${headerBrand.secondary}, ${headerBrand.primary})`;
            // Tinted band when the org has custom colors. 33 = 20% alpha,
            // visible enough that pale colors still register but light
            // enough that the tabs and content below keep their hierarchy.
            // A 3px solid border at the bottom in the saturated primary
            // marks the edge of the corporate zone.
            const headerBg = headerBrand.isCustom
              ? `linear-gradient(135deg, ${headerBrand.primary}33 0%, ${headerBrand.secondary}33 100%)`
              : "transparent";
            const headerBorderBottom = headerBrand.isCustom
              ? `3px solid ${headerBrand.primary}`
              : undefined;
            return (
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, marginBottom: 16, padding: headerBrand.isCustom ? "16px 18px" : 0, borderRadius: headerBrand.isCustom ? radii["2xl"] : 0, background: headerBg, borderBottom: headerBorderBottom }}>
              {headerOrg.logoBase64 ? (
                <img src={headerOrg.logoBase64} alt={headerOrg.name} width={200} height={128} loading="lazy" decoding="async" style={{ maxHeight: 128, maxWidth: 200, height: "auto", width: "auto", objectFit: "contain", borderRadius: 12, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 100, height: 100, borderRadius: radii["3xl"], flexShrink: 0, background: headerLogoBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: fontWeight.extrabold, color: colors.white }}>
                  {headerOrg.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 28, fontWeight: fontWeight.extrabold, color: "#1a1a2e", lineHeight: 1.2, letterSpacing: "-0.5px" }}>{overview.pool.name}</div>
                <div style={{ fontSize: fontSize.md, color: headerAccent, fontWeight: fontWeight.semibold, marginTop: 2 }}>{t("corporate.byCompany", { company: headerOrg.name })}</div>
              </div>
              {overview.pool.status && (() => {
                const badge = getPoolStatusBadge(overview.pool.status, t);
                return (
                  <span style={{ fontSize: fontSize.md, padding: "4px 12px", borderRadius: radii.pill, border: `1px solid ${badge.color}`, background: `${badge.color}20`, color: badge.color, fontWeight: fontWeight.semibold, marginLeft: "auto", flexShrink: 0 }}>
                    {badge.emoji} {badge.label}
                  </span>
                );
              })()}
            </div>
            );
          })()}

          {/* Pool header - Standard (with invite button integrated) */}
          {!overview.pool.organization && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: isMobile ? 8 : 10,
              alignItems: "center",
              marginTop: 8,
              marginBottom: 4,
            }}>
              <h2 style={{ margin: 0, flex: "1 1 auto", minWidth: 0 }}>{overview.pool.name}</h2>
              {overview.pool.status && (() => {
                const badge = getPoolStatusBadge(overview.pool.status, t);
                return (
                  <span style={{ fontSize: fontSize.md, padding: "4px 12px", borderRadius: radii.pill, border: `1px solid ${badge.color}`, background: `${badge.color}20`, color: badge.color, fontWeight: fontWeight.semibold, flexShrink: 0 }}>
                    {badge.emoji} {badge.label}
                  </span>
                );
              })()}
              {overview.permissions.canInvite && (
                <button
                  onClick={onCreateInvite}
                  disabled={busyKey === "invite"}
                  style={{
                    padding: isMobile ? "8px 16px" : "8px 20px",
                    borderRadius: radii.lg,
                    border: `1px solid ${colors.brand}`,
                    background: colors.brand,
                    color: colors.white,
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: fontWeight.semibold,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {busyKey === "invite" ? "..." : `+ ${t("invite.inviteMore")}`}
                </button>
              )}
            </div>
          )}

          <div style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {getTournamentName(overview.tournamentInstance.templateKey, overview.tournamentInstance.name, tTournaments)} • {overview.pool.maxParticipants ? `${overview.counts.membersActive}/${overview.pool.maxParticipants}` : overview.counts.membersActive} {t("members")} • {t("yourRole")}: <b>{overview.myMembership.role}</b>
          </div>

          {/* Invite code display (shown after creating code) */}
          {inviteCode && overview.permissions.canInvite && (
            <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: radii.lg, background: colors.white, border: `1px solid ${colors.borderLight}` }}>
              <div style={{ fontSize: 11, color: colors.textMuted }}>{t("invite.codeCopied")}</div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 1, marginTop: 2 }}>{inviteCode}</div>
              <div style={{ marginTop: 8 }}>
                <ShareButtons
                  context="poolInvite"
                  url={`${typeof window !== "undefined" ? window.location.origin : ""}/invite?code=${inviteCode}`}
                  data={{ poolName: overview.pool.name, inviteCode }}
                  size="sm"
                />
              </div>
            </div>
          )}

          {/* LEFT member banner */}
          {overview.myMembership.status === "LEFT" && (
            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: radii.lg, background: colors.errorBg, border: `1px solid ${colors.errorBorderLight}`, color: colors.error, fontSize: fontSize.md, fontWeight: fontWeight.medium }}>
              {t("retiredBanner")}
            </div>
          )}

          {/* ── Section navigation + content (sidebar at ≥1024px; mobile menu lives in global navbar) ── */}
          <div style={{
            display: "flex",
            gap: spacing.xl,
            alignItems: "flex-start",
            marginTop: isMobile ? spacing.md : spacing.lg,
          }}>
            <PoolNavDrawer
              showHostItems={overview.permissions.canManageResults}
              showBrandingTab={
                overview.permissions.canManageResults && !!overview.pool.organizationId
              }
              tabBadges={tabBadges}
              hasUrgent={hasUrgent}
            />

            <main style={{ flex: 1, minWidth: 0 }}>
              {activeTab === "jugadores" && overview.permissions.canManageResults && token && (
                <PoolPlayersTab
                  poolId={poolId!} token={token} overview={overview} isMobile={isMobile}
                  busyKey={busyKey} setBusyKey={setBusyKey} error={error} setError={setError}
                  friendlyError={friendlyError} reload={load}
                  userTimezone={userTimezone}
                  pendingMembers={pendingMembers}
                  loadPendingMembers={loadPendingMembers}
                  refetchNotifications={refetchNotifications}
                />
              )}

              {activeTab === "capacidad" && overview.permissions.canManageResults && (
                <PoolCapacityTab poolId={poolId!} overview={overview} />
              )}

              {activeTab === "personalizacion" &&
                overview.permissions.canManageResults &&
                overview.pool.organizationId && (
                  <PoolBrandingTab
                    poolId={poolId!}
                    overview={overview}
                    onSaved={load}
                  />
                )}

              {activeTab === "admin" && overview.permissions.canManageResults && (
                <PoolAdminTab
                  poolId={poolId} token={token!} overview={overview} isMobile={isMobile}
                  busyKey={busyKey} setBusyKey={setBusyKey} error={error} setError={setError}
                  userTimezone={userTimezone} reload={load} refetchNotifications={refetchNotifications}
                  friendlyError={friendlyError} phases={phases} getPhaseStatus={getPhaseStatus}
                  hasPhaseAdvanced={hasPhaseAdvanced} nextPhaseMap={nextPhaseMap}
                  notifications={notifications} tabBadges={tabBadges}
                />
              )}

              {activeTab === "estadisticas" && (
                <PoolStatsTab overview={overview} poolId={poolId!} isMobile={isMobile} />
              )}

              {activeTab === "resumen" && (
                <div style={{ padding: 20, border: `1px solid ${colors.border}`, borderRadius: radii["3xl"], background: colors.white }}>
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
                  showFinalized={showFinalized} setShowFinalized={changeShowFinalized}
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
            </main>
          </div>

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
    </>
  );
}
