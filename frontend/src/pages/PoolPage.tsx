import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createInvite, getPoolOverview, upsertPick, upsertResult, updatePoolSettings, manualAdvancePhase, lockPhase, archivePool, promoteMemberToCoAdmin, demoteMemberFromCoAdmin, getPendingMembers, approveMember, rejectMember, kickMember, banMember, getUserProfile, getMatchPicks, type PoolOverview, type MatchPicksResponse } from "../lib/api";
import { getToken } from "../lib/auth";
import { TeamFlag } from "../components/TeamFlag";
import { getTeamFlag, getCountryName } from "../data/teamFlags";
import { formatMatchDateTime } from "../lib/timezone";
import { PickRulesDisplay } from "../components/PickRulesDisplay";
import type { PoolPickTypesConfig } from "../types/pickConfig";
import { StructuralPicksManager } from "../components/StructuralPicksManager";
import { ScoringBreakdownModal } from "../components/ScoringBreakdownModal";
import { PlayerSummary } from "../components/PlayerSummary";
import { NotificationBadge } from "../components/NotificationBadge";
import { NotificationBanner } from "../components/NotificationBanner";
import { usePoolNotifications, calculateTabBadges, hasUrgentDeadlines } from "../hooks/usePoolNotifications";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";
import { MobileLeaderboard } from "../components/MobileLeaderboard";

function fmtUtc(iso: string, userTimezone: string | null = null) {
  return formatMatchDateTime(iso, userTimezone);
}

function norm(s: string) {
  return (s ?? "").toLowerCase().trim();
}

// Helper para formatear nombres de fases para mostrar en columnas del leaderboard
function formatPhaseName(phaseId: string): string {
  const phaseNames: Record<string, string> = {
    group_stage: "Grupos",
    round_of_32: "R32",
    round_of_16: "R16",
    quarter_finals: "QF",
    quarterfinals: "QF",
    semi_finals: "SF",
    semifinals: "SF",
    third_place: "3er",
    finals: "Final",
    final: "Final",
    // UCL two-legged phases
    r32_leg1: "16avos Ida",
    r32_leg2: "16avos Vta",
    r16_leg1: "8vos Ida",
    r16_leg2: "8vos Vta",
    qf_leg1: "4tos Ida",
    qf_leg2: "4tos Vta",
    sf_leg1: "Semi Ida",
    sf_leg2: "Semi Vta",
  };
  return phaseNames[phaseId] || phaseId.replace(/_/g, " ").slice(0, 6);
}

// Helper para nombre completo de fase (para tooltips)
function formatPhaseFullName(phaseId: string): string {
  const phaseNames: Record<string, string> = {
    group_stage: "Fase de Grupos",
    round_of_32: "Dieciseisavos de Final",
    round_of_16: "Octavos de Final",
    quarter_finals: "Cuartos de Final",
    quarterfinals: "Cuartos de Final",
    semi_finals: "Semifinales",
    semifinals: "Semifinales",
    third_place: "Tercer Lugar",
    finals: "Final",
    final: "Final",
    // UCL two-legged phases
    r32_leg1: "Play Offs (16avos) - Ida",
    r32_leg2: "Play Offs (16avos) - Vuelta",
    r16_leg1: "Octavos de Final - Ida",
    r16_leg2: "Octavos de Final - Vuelta",
    qf_leg1: "Cuartos de Final - Ida",
    qf_leg2: "Cuartos de Final - Vuelta",
    sf_leg1: "Semifinales - Ida",
    sf_leg2: "Semifinales - Vuelta",
  };
  return phaseNames[phaseId] || phaseId.replace(/_/g, " ");
}

function getPoolStatusBadge(status: string): { label: string; color: string; emoji: string } {
  switch (status) {
    case "DRAFT":
      return { label: "Borrador", color: "#f59e0b", emoji: "📝" };
    case "ACTIVE":
      return { label: "En curso", color: "#10b981", emoji: "⚽" };
    case "COMPLETED":
      return { label: "Finalizada", color: "#3b82f6", emoji: "🏆" };
    case "ARCHIVED":
      return { label: "Archivada", color: "#6b7280", emoji: "📦" };
    default:
      return { label: "Desconocido", color: "#9ca3af", emoji: "❓" };
  }
}

export function PoolPage() {
  const { poolId } = useParams();
  const token = useMemo(() => getToken(), []);
  const isMobile = useIsMobile();

  const [overview, setOverview] = useState<PoolOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verbose, setVerbose] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"partidos" | "leaderboard" | "resumen" | "reglas" | "admin">("partidos");

  // Phase navigation (new for WC2026)
  const [activePhase, setActivePhase] = useState<string | null>(null);

  // Group filter (for group stage)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Pending members (for join approval)
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);

  // Expulsion modal state (KICK or BAN)
  const [expulsionModalData, setExpulsionModalData] = useState<{ memberId: string; memberName: string; type: "KICK" | "BAN" } | null>(null);

  // Scoring breakdown modal state
  const [breakdownModalData, setBreakdownModalData] = useState<{
    matchId?: string;
    matchTitle?: string;
    phaseId?: string;
    phaseTitle?: string;
  } | null>(null);

  // Player summary modal state (for clicking on leaderboard)
  const [playerSummaryModal, setPlayerSummaryModal] = useState<{
    userId: string;
    displayName: string;
    initialPhase?: string; // Para abrir el resumen expandido en una fase específica
  } | null>(null);

  // Match picks modal state (for viewing other players' picks)
  const [matchPicksModal, setMatchPicksModal] = useState<{
    matchId: string;
    matchTitle: string;
    picks: MatchPicksResponse | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  // UX filtros (volumen)
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyNoPick, setOnlyNoPick] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyNoResult, setOnlyNoResult] = useState(false);

  // Invite
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Notificaciones internas (badges)
  const { notifications, refetch: refetchNotifications } = usePoolNotifications(poolId, {
    pollingInterval: 60000, // 60 segundos
    enabled: !!poolId,
  });
  const tabBadges = calculateTabBadges(notifications);
  const hasUrgent = hasUrgentDeadlines(notifications);

  async function load(v: boolean) {
    if (!token || !poolId) return;
    setError(null);
    try {
      const data = await getPoolOverview(token, poolId, v);
      setOverview(data);

      // Cargar timezone del usuario
      const profileData = await getUserProfile(token);
      setUserTimezone(profileData.user.timezone);

      // Si es HOST o CO_ADMIN, cargar pending members
      if (data.permissions.canManageResults) {
        loadPendingMembers();
      }
    } catch (e: any) {
      setError(e?.message ?? "Error");
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

  async function loadMatchPicks(matchId: string, matchTitle: string) {
    if (!token || !poolId) return;
    setMatchPicksModal({ matchId, matchTitle, picks: null, loading: true, error: null });
    try {
      const data = await getMatchPicks(token, poolId, matchId);
      setMatchPicksModal({ matchId, matchTitle, picks: data, loading: false, error: null });
    } catch (e: any) {
      setMatchPicksModal({ matchId, matchTitle, picks: null, loading: false, error: e?.message ?? "Error" });
    }
  }

  useEffect(() => {
    load(verbose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, verbose]);

  // Helper: check if a teamId is a placeholder
  const isPlaceholder = (teamId: string) => {
    return teamId === "t_TBD" || teamId.startsWith("W_") || teamId.startsWith("RU_") || teamId.startsWith("L_") || teamId.startsWith("3rd_");
  };

  // Helper: get display name for placeholder
  const getPlaceholderName = (teamId: string): string => {
    if (teamId.startsWith("W_")) {
      const group = teamId.replace("W_", "");
      if (group.startsWith("R") || group.startsWith("Q") || group.startsWith("S")) {
        // Knockout match winner (e.g., W_R32_1)
        return `Ganador ${teamId.replace("W_", "")}`;
      }
      return `Ganador Grupo ${group}`;
    }
    if (teamId.startsWith("RU_")) {
      const group = teamId.replace("RU_", "");
      return `2° Grupo ${group}`;
    }
    if (teamId.startsWith("L_")) {
      const matchRef = teamId.replace("L_", "");
      return `Perdedor ${matchRef}`;
    }
    if (teamId.startsWith("3rd_POOL_")) {
      const rank = teamId.replace("3rd_POOL_", "");
      return `${rank}° Mejor 3ro`;
    }
    return teamId;
  };

  // Extract phases from tournament data
  const phases = useMemo(() => {
    if (!overview) return [];
    const data = (overview.tournamentInstance as any).dataJson;
    if (!data?.phases) return [];
    return data.phases.sort((a: any, b: any) => a.order - b.order);
  }, [overview]);

  // Initialize activePhase to first phase on load
  useEffect(() => {
    if (phases.length > 0 && !activePhase) {
      setActivePhase(phases[0].id);
    }
  }, [phases, activePhase]);

  // Get phase status: PENDING (has placeholders) | ACTIVE (no placeholders, incomplete) | COMPLETED (all results)
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

  // Mapa de siguiente fase: generado dinámicamente del orden de fases del torneo
  const nextPhaseMap: Record<string, string | null> = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (let i = 0; i < phases.length; i++) {
      map[phases[i].id] = i < phases.length - 1 ? phases[i + 1].id : null;
    }
    return map;
  }, [phases]);

  // Verificar si una fase ya avanzó (la siguiente fase ya NO tiene placeholders)
  const hasPhaseAdvanced = (phaseId: string): boolean => {
    if (!overview) return false;

    const nextPhaseId = nextPhaseMap[phaseId];
    if (!nextPhaseId) return false; // Finals/third_place no tienen siguiente fase

    const nextPhaseMatches = overview.matches.filter((m: any) => m.phaseId === nextPhaseId);
    if (nextPhaseMatches.length === 0) return false; // Si no hay partidos, no avanzó

    // Si la siguiente fase NO tiene placeholders, significa que ya avanzó
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

  // Detect if active phase requires structural picks (SIMPLE preset)
  const activePhaseConfig = useMemo(() => {
    if (!overview || !activePhase || !overview.pool.pickTypesConfig) return null;
    const config = overview.pool.pickTypesConfig as PoolPickTypesConfig;
    if (!Array.isArray(config)) return null;
    return config.find((pc: any) => pc.phaseId === activePhase) || null;
  }, [overview, activePhase]);

  const requiresStructuralPicks = useMemo(() => {
    if (!activePhaseConfig) return false;
    // Si requiresScore es false, significa que esta fase usa structural picks
    return activePhaseConfig.requiresScore === false && activePhaseConfig.structuralPicks;
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
      // Filter by active phase
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

  // Map de resultados de partidos por matchId (para knockout phases)
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

  async function onCreateInvite() {
    if (!token || !poolId) return;
    setBusyKey("invite");
    setError(null);
    try {
      const inv = await createInvite(token, poolId);
      setInviteCode(inv.code);
      try {
        await navigator.clipboard.writeText(inv.code);
      } catch {}
    } catch (e: any) {
      setError(e?.message ?? "Error");
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
          throw new Error("Marcador inválido");
        }

        normalizedPick = { ...pick, homeGoals: hg, awayGoals: ag };
      }

      await upsertPick(token, poolId, matchId, { pick: normalizedPick });
      await load(verbose);
      refetchNotifications();
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveResult(matchId: string, input: { homeGoals: number; awayGoals: number; reason?: string; homePenalties?: number; awayPenalties?: number }) {
    if (!token || !poolId) return;
    setBusyKey(`res:${matchId}`);
    setError(null);
    try {
      await upsertResult(token, poolId, matchId, input);
      await load(verbose);
      refetchNotifications();
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setBusyKey(null);
    }
  }

  if (!poolId) return <div style={{ padding: 16 }}>PoolId missing</div>;

  return (
    <div style={{ maxWidth: 1180, margin: "18px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Link to="/">&larr; Dashboard</Link>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fee", border: "1px solid #fbb", color: "#700" }}>
          {error}
        </div>
      )}

      {!overview && !error && <p style={{ marginTop: 16 }}>Cargando overview...</p>}

      {overview && (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, marginBottom: 6 }}>
            <h2 style={{ margin: 0 }}>{overview.pool.name}</h2>
            {overview.pool.status && (() => {
              const badge = getPoolStatusBadge(overview.pool.status);
              return (
                <span
                  style={{
                    fontSize: 13,
                    padding: "4px 12px",
                    borderRadius: 999,
                    border: `1px solid ${badge.color}`,
                    background: `${badge.color}20`,
                    color: badge.color,
                    fontWeight: 600,
                  }}
                >
                  {badge.emoji} {badge.label}
                </span>
              );
            })()}
          </div>

          <div style={{ color: "#666", fontSize: 12 }}>
            {overview.tournamentInstance.name} • {overview.counts.membersActive} miembros • Tu rol: <b>{overview.myMembership.role}</b>
          </div>

          {/* Tabs Navigation con Notification Badges */}
          <div style={{
            marginTop: isMobile ? 12 : 16,
            paddingTop: 8,
            borderBottom: "2px solid #e0e0e0",
            display: "flex",
            gap: isMobile ? 4 : 8,
            overflowX: "auto",
            overflowY: "visible",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            ...mobileInteractiveStyles.tapHighlight,
          }}>
            {(["partidos", "leaderboard", "resumen", "reglas", ...(overview.permissions.canManageResults ? ["admin" as const] : [])] as const).map((tab) => {
              const badgeCount = tabBadges[tab] || 0;
              const isUrgent = tab === "partidos" && hasUrgent;

              // Nombres cortos para móvil
              const tabLabels = {
                partidos: isMobile ? "⚽" : "⚽ Partidos",
                leaderboard: isMobile ? "📊" : "📊 Leaderboard",
                resumen: isMobile ? "📈" : "📈 Mi Resumen",
                reglas: isMobile ? "📋" : "📋 Reglas",
                admin: isMobile ? "⚙️" : "⚙️ Administración",
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
                  {badgeCount > 0 && (
                    <NotificationBadge
                      count={badgeCount}
                      pulse={isUrgent}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab name indicator for mobile */}
          {isMobile && (
            <div style={{
              marginTop: 12,
              fontSize: 14,
              fontWeight: 600,
              color: "#007bff",
              textAlign: "center",
            }}>
              {activeTab === "partidos" && "Partidos"}
              {activeTab === "leaderboard" && "Leaderboard"}
              {activeTab === "resumen" && "Mi Resumen"}
              {activeTab === "reglas" && "Reglas"}
              {activeTab === "admin" && "Administración"}
            </div>
          )}

          {/* Tab Content: Administración (solo HOST) */}
          {activeTab === "admin" && overview.permissions.canManageResults && (
            <div style={{ marginTop: 14, padding: 20, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, marginBottom: 16 }}>⚙️ Panel de Administración del Host</h3>

              {/* Notification Banner for Admin tab */}
              {notifications && (tabBadges.admin > 0) && (() => {
                const bannerItems: { icon: string; message: string }[] = [];

                if (notifications.pendingJoins > 0) {
                  bannerItems.push({
                    icon: "👤",
                    message: `${notifications.pendingJoins} solicitud${notifications.pendingJoins > 1 ? "es" : ""} de ingreso pendiente${notifications.pendingJoins > 1 ? "s" : ""}.`
                  });
                }

                if (notifications.phasesReadyToAdvance.length > 0) {
                  bannerItems.push({
                    icon: "🚀",
                    message: `${notifications.phasesReadyToAdvance.length} fase${notifications.phasesReadyToAdvance.length > 1 ? "s lista" : " lista"}s para avanzar.`
                  });
                }

                return bannerItems.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    <NotificationBanner items={bannerItems} />
                  </div>
                ) : null;
              })()}

              {/* Auto-Advance Configuration */}
              <div style={{ marginBottom: 24, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
                  🤖 Avance Automático de Fases
                </h4>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: "#666", marginBottom: 12 }}>
                  Cuando está habilitado, el sistema avanzará automáticamente a la siguiente fase cuando se completen todos los partidos de la fase actual.
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #dee2e6" }}>
                  {/* Toggle Switch Component (iOS style) */}
                  <div
                    onClick={async () => {
                      if (busyKey === "auto-advance-toggle" || !token || !poolId) return;
                      console.log('[TOGGLE] Clicked. Current state:', overview.pool.autoAdvanceEnabled);
                      setBusyKey("auto-advance-toggle");
                      setError(null);
                      try {
                        const newValue = !overview.pool.autoAdvanceEnabled;
                        console.log('[TOGGLE] Sending update to:', newValue);
                        const result = await updatePoolSettings(token, poolId, { autoAdvanceEnabled: newValue });
                        console.log('[TOGGLE] Update result:', result);
                        await load(verbose);
                        console.log('[TOGGLE] Reloaded. New state:', overview.pool.autoAdvanceEnabled);
                      } catch (err: any) {
                        console.error('[TOGGLE] Error:', err);
                        setError(err?.message ?? "Error al actualizar configuración");
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                    style={{
                      position: "relative",
                      width: 48,
                      height: 24,
                      borderRadius: 12,
                      background: overview.pool.autoAdvanceEnabled ? "#28a745" : "#ccc",
                      cursor: busyKey === "auto-advance-toggle" ? "wait" : "pointer",
                      transition: "background 0.3s ease",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 2,
                        left: overview.pool.autoAdvanceEnabled ? 26 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        transition: "left 0.3s ease",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#333" }}>
                      {overview.pool.autoAdvanceEnabled ? "✅ Avance automático HABILITADO" : "❌ Avance automático DESHABILITADO"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                      {overview.pool.autoAdvanceEnabled
                        ? "Las fases avanzarán automáticamente cuando se completen todos los resultados"
                        : "Deberás avanzar las fases manualmente usando los botones de abajo"}
                    </div>
                  </div>
                </label>
              </div>

              {/* Require Approval Configuration */}
              <div style={{ marginBottom: 24, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
                  🔐 Aprobación de Solicitudes de Ingreso
                </h4>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: "#666", marginBottom: 12 }}>
                  Cuando está habilitado, los jugadores que intenten unirse deberán esperar aprobación del host o co-admins.
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #dee2e6" }}>
                  {/* Toggle Switch Component (iOS style) */}
                  <div
                    onClick={async () => {
                      if (busyKey === "require-approval-toggle" || !token || !poolId) return;
                      setBusyKey("require-approval-toggle");
                      setError(null);
                      try {
                        const newValue = !overview.pool.requireApproval;
                        await updatePoolSettings(token, poolId, { requireApproval: newValue });
                        await load(verbose);
                      } catch (err: any) {
                        setError(err?.message ?? "Error al actualizar configuración");
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                    style={{
                      position: "relative",
                      width: 48,
                      height: 24,
                      borderRadius: 12,
                      background: overview.pool.requireApproval ? "#28a745" : "#ccc",
                      cursor: busyKey === "require-approval-toggle" ? "wait" : "pointer",
                      transition: "background 0.3s ease",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 2,
                        left: overview.pool.requireApproval ? 26 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        transition: "left 0.3s ease",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#333" }}>
                      {overview.pool.requireApproval ? "✅ Aprobación REQUERIDA" : "❌ Ingreso DIRECTO"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                      {overview.pool.requireApproval
                        ? "Los jugadores deberán esperar tu aprobación para unirse"
                        : "Los jugadores pueden unirse directamente con el código de invitación"}
                    </div>
                  </div>
                </label>
              </div>

              {/* Phase Status Panel */}
              <div style={{ marginBottom: 24, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
                  📊 Estado de las Fases del Torneo
                </h4>
                <div style={{ display: "grid", gap: 10 }}>
                  {phases.map((phase: any) => {
                    const status = getPhaseStatus(phase.id);
                    const phaseMatches = overview.matches.filter((m: any) => m.phaseId === phase.id);
                    const completedMatches = phaseMatches.filter((m: any) => m.result).length;
                    const totalMatches = phaseMatches.length;
                    const progress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

                    const statusColors = {
                      PENDING: { bg: "#fff3cd", border: "#ffc107", text: "#856404", icon: "🔒" },
                      ACTIVE: { bg: "#d4edda", border: "#28a745", text: "#155724", icon: "⚽" },
                      COMPLETED: { bg: "#d1ecf1", border: "#17a2b8", text: "#0c5460", icon: "✅" }
                    };

                    const colors = statusColors[status as keyof typeof statusColors];

                    return (
                      <div
                        key={phase.id}
                        style={{
                          padding: 14,
                          background: "#fff",
                          borderRadius: 8,
                          border: `2px solid ${colors.border}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 20 }}>{colors.icon}</span>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "#333" }}>{phase.name}</span>
                            <span style={{
                              padding: "2px 8px",
                              background: colors.bg,
                              border: `1px solid ${colors.border}`,
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              color: colors.text
                            }}>
                              {status === "PENDING" && "PENDIENTE"}
                              {status === "ACTIVE" && "ACTIVA"}
                              {status === "COMPLETED" && "COMPLETADA"}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#666" }}>
                            {completedMatches} de {totalMatches} partidos con resultado ({progress.toFixed(0)}%)
                          </div>
                          {status !== "PENDING" && (
                            <div style={{ marginTop: 6, background: "#e9ecef", borderRadius: 4, height: 6, overflow: "hidden" }}>
                              <div style={{
                                height: "100%",
                                width: `${progress}%`,
                                background: status === "COMPLETED" ? "#17a2b8" : "#28a745",
                                transition: "width 0.3s"
                              }} />
                            </div>
                          )}
                        </div>
                        {status === "COMPLETED" && (
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {/* Mostrar botón "Avanzar" solo si la fase no ha avanzado todavía */}
                            {!hasPhaseAdvanced(phase.id) && nextPhaseMap[phase.id] && (
                              <button
                                disabled={busyKey === `advance:${phase.id}`}
                                onClick={async () => {
                                  if (!token || !poolId) return;
                                  setBusyKey(`advance:${phase.id}`);
                                  setError(null);
                                  try {
                                    const result = await manualAdvancePhase(token, poolId, phase.id);
                                    await load(verbose);
                                    alert(`✅ Fase avanzada exitosamente: ${result.message || 'Avance completado'}`);
                                  } catch (err: any) {
                                    setError(err?.message ?? "Error al avanzar fase");
                                  } finally {
                                    setBusyKey(null);
                                  }
                                }}
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: 8,
                                  border: "1px solid #007bff",
                                  background: busyKey === `advance:${phase.id}` ? "#ccc" : "#007bff",
                                  color: "#fff",
                                  cursor: busyKey === `advance:${phase.id}` ? "wait" : "pointer",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  whiteSpace: "nowrap"
                                }}
                              >
                                {busyKey === `advance:${phase.id}` ? "⏳ Avanzando..." : "🚀 Avanzar Fase"}
                              </button>
                            )}
                            {/* Mostrar indicador de "Ya avanzó" si la fase ya avanzó */}
                            {hasPhaseAdvanced(phase.id) && (
                              <span style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                background: "#d4edda",
                                border: "1px solid #28a745",
                                color: "#155724",
                                fontSize: 13,
                                fontWeight: 600,
                                whiteSpace: "nowrap"
                              }}>
                                ✓ Ya avanzó
                              </span>
                            )}
                            <button
                              disabled={busyKey === `lock:${phase.id}`}
                              onClick={async () => {
                                if (!token || !poolId) return;
                                const isCurrentlyLocked = (overview.pool.lockedPhases || []).includes(phase.id);
                                setBusyKey(`lock:${phase.id}`);
                                setError(null);
                                try {
                                  await lockPhase(token, poolId, phase.id, !isCurrentlyLocked);
                                  await load(verbose);
                                  alert(isCurrentlyLocked ? '✅ Fase desbloqueada' : '🔒 Fase bloqueada');
                                } catch (err: any) {
                                  setError(err?.message ?? "Error al bloquear/desbloquear fase");
                                } finally {
                                  setBusyKey(null);
                                }
                              }}
                              style={{
                                padding: "8px 16px",
                                borderRadius: 8,
                                border: `1px solid ${(overview.pool.lockedPhases || []).includes(phase.id) ? "#28a745" : "#ffc107"}`,
                                background: busyKey === `lock:${phase.id}` ? "#ccc" : ((overview.pool.lockedPhases || []).includes(phase.id) ? "#28a745" : "#ffc107"),
                                color: "#fff",
                                cursor: busyKey === `lock:${phase.id}` ? "wait" : "pointer",
                                fontSize: 13,
                                fontWeight: 600,
                                whiteSpace: "nowrap"
                              }}
                            >
                              {busyKey === `lock:${phase.id}`
                                ? "⏳ Procesando..."
                                : (overview.pool.lockedPhases || []).includes(phase.id)
                                  ? "🔓 Desbloquear"
                                  : "🔒 Bloquear"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pending Join Requests Section (HOST/CO_ADMIN) */}
              {overview.permissions.canManageResults && pendingMembers.length > 0 && (
                <div style={{ marginBottom: 24, padding: 16, background: "#fff3cd", borderRadius: 12, border: "1px solid #ffc107" }}>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#856404" }}>
                    🔔 Solicitudes Pendientes ({pendingMembers.length})
                  </h4>
                  <div style={{ fontSize: 14, lineHeight: 1.8, color: "#856404", marginBottom: 12 }}>
                    Los siguientes usuarios han solicitado unirse al pool y están esperando tu aprobación.
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {pendingMembers.map((member: any) => (
                      <div
                        key={member.id}
                        style={{
                          padding: 12,
                          background: "#fff",
                          borderRadius: 8,
                          border: "1px solid #ffc107",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                            {member.displayName}
                          </div>
                          <div style={{ fontSize: 12, color: "#666" }}>
                            @{member.username} • {member.email}
                          </div>
                          <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                            Solicitó unirse: {fmtUtc(member.requestedAt, userTimezone)}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={async () => {
                              if (busyKey === `approve-${member.id}` || !token || !poolId) return;
                              if (!window.confirm(`¿Aprobar a ${member.displayName}?`)) return;

                              setBusyKey(`approve-${member.id}`);
                              setError(null);
                              try {
                                await approveMember(token, poolId, member.id);
                                await loadPendingMembers();
                                await load(verbose);
                                refetchNotifications();
                              } catch (err: any) {
                                setError(err?.message ?? "Error al aprobar");
                              } finally {
                                setBusyKey(null);
                              }
                            }}
                            disabled={busyKey === `approve-${member.id}`}
                            style={{
                              padding: "8px 16px",
                              background: "#28a745",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              cursor: busyKey === `approve-${member.id}` ? "wait" : "pointer",
                              fontWeight: 600,
                              fontSize: 13,
                              opacity: busyKey === `approve-${member.id}` ? 0.6 : 1
                            }}
                          >
                            ✅ Aprobar
                          </button>

                          <button
                            onClick={async () => {
                              if (busyKey === `reject-${member.id}` || !token || !poolId) return;
                              const reason = window.prompt(`¿Rechazar a ${member.displayName}?\n\nRazón (opcional):`);
                              if (reason === null) return; // User cancelled

                              setBusyKey(`reject-${member.id}`);
                              setError(null);
                              try {
                                await rejectMember(token, poolId, member.id, reason || undefined);
                                await loadPendingMembers();
                                refetchNotifications();
                              } catch (err: any) {
                                setError(err?.message ?? "Error al rechazar");
                              } finally {
                                setBusyKey(null);
                              }
                            }}
                            disabled={busyKey === `reject-${member.id}`}
                            style={{
                              padding: "8px 16px",
                              background: "#dc3545",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              cursor: busyKey === `reject-${member.id}` ? "wait" : "pointer",
                              fontWeight: 600,
                              fontSize: 13,
                              opacity: busyKey === `reject-${member.id}` ? 0.6 : 1
                            }}
                          >
                            ❌ Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Member Management Section (only for HOST) */}
              {overview.myMembership.role === "HOST" && (
                <div style={{ marginBottom: 24, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
                    👥 Gestión de Miembros
                  </h4>
                  <div style={{ fontSize: 14, lineHeight: 1.8, color: "#666", marginBottom: 12 }}>
                    Puedes promover jugadores a Co-Admins para que te ayuden a gestionar resultados y crear invitaciones.
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {overview.leaderboard.rows.map((member: any) => {
                      const isHost = member.role === "HOST";
                      const isCoAdmin = member.role === "CO_ADMIN";
                      const isPlayer = member.role === "PLAYER";

                      return (
                        <div
                          key={member.userId}
                          style={{
                            padding: 12,
                            background: "#fff",
                            borderRadius: 8,
                            border: "1px solid #dee2e6",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                              {member.displayName}
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              {isHost && (
                                <span style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: "#007bff20",
                                  border: "1px solid #007bff",
                                  color: "#007bff",
                                  fontWeight: 600
                                }}>
                                  👑 HOST
                                </span>
                              )}
                              {isCoAdmin && (
                                <span style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: "#28a74520",
                                  border: "1px solid #28a745",
                                  color: "#28a745",
                                  fontWeight: 600
                                }}>
                                  ⭐ CO-ADMIN
                                </span>
                              )}
                              {isPlayer && (
                                <span style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: "#6c757d20",
                                  border: "1px solid #6c757d",
                                  color: "#6c757d",
                                  fontWeight: 600
                                }}>
                                  PLAYER
                                </span>
                              )}
                              <span style={{ fontSize: 12, color: "#999" }}>
                                {member.points} pts
                              </span>
                            </div>
                          </div>

                          {!isHost && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {isPlayer && (
                                <button
                                  disabled={busyKey === `promote:${member.userId}`}
                                  onClick={async () => {
                                    if (!token || !poolId || busyKey) return;

                                    const confirmed = window.confirm(
                                      `¿Promover a ${member.displayName} a Co-Admin?\n\n` +
                                      `Los Co-Admins pueden:\n` +
                                      `• Publicar y corregir resultados\n` +
                                      `• Crear códigos de invitación\n` +
                                      `• Ver el panel de administración`
                                    );

                                    if (!confirmed) return;

                                    setBusyKey(`promote:${member.userId}`);
                                    setError(null);

                                    try {
                                      await promoteMemberToCoAdmin(token, poolId, member.memberId);
                                      await load(verbose);
                                      alert(`✅ ${member.displayName} promovido a Co-Admin`);
                                    } catch (err: any) {
                                      setError(err?.message ?? "Error al promover miembro");
                                    } finally {
                                      setBusyKey(null);
                                    }
                                  }}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    border: "1px solid #28a745",
                                    background: busyKey === `promote:${member.userId}` ? "#ccc" : "#28a745",
                                    color: "#fff",
                                    cursor: busyKey === `promote:${member.userId}` ? "wait" : "pointer",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    whiteSpace: "nowrap"
                                  }}
                                >
                                  {busyKey === `promote:${member.userId}` ? "⏳" : "⬆️ Promover"}
                                </button>
                              )}

                              {isCoAdmin && (
                                <button
                                  disabled={busyKey === `demote:${member.userId}`}
                                  onClick={async () => {
                                    if (!token || !poolId || busyKey) return;

                                    const confirmed = window.confirm(
                                      `¿Degradar a ${member.displayName} a jugador normal?\n\n` +
                                      `Perderá los permisos de Co-Admin.`
                                    );

                                    if (!confirmed) return;

                                    setBusyKey(`demote:${member.userId}`);
                                    setError(null);

                                    try {
                                      await demoteMemberFromCoAdmin(token, poolId, member.memberId);
                                      await load(verbose);
                                      alert(`✅ ${member.displayName} degradado a Player`);
                                    } catch (err: any) {
                                      setError(err?.message ?? "Error al degradar miembro");
                                    } finally {
                                      setBusyKey(null);
                                    }
                                  }}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    border: "1px solid #dc3545",
                                    background: busyKey === `demote:${member.userId}` ? "#ccc" : "#dc3545",
                                    color: "#fff",
                                    cursor: busyKey === `demote:${member.userId}` ? "wait" : "pointer",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    whiteSpace: "nowrap"
                                  }}
                                >
                                  {busyKey === `demote:${member.userId}` ? "⏳" : "⬇️ Degradar"}
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setExpulsionModalData({
                                    memberId: member.memberId,
                                    memberName: member.displayName,
                                    type: "KICK"
                                  });
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  border: "1px solid #ffc107",
                                  background: "#fff",
                                  color: "#ffc107",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  whiteSpace: "nowrap"
                                }}
                              >
                                👋 Expulsar
                              </button>

                              <button
                                onClick={() => {
                                  setExpulsionModalData({
                                    memberId: member.memberId,
                                    memberName: member.displayName,
                                    type: "BAN"
                                  });
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  border: "1px solid #dc3545",
                                  background: "#fff",
                                  color: "#dc3545",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  whiteSpace: "nowrap"
                                }}
                              >
                                🚫 Banear
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Archive Pool Section (only if COMPLETED) */}
              {overview.pool.status === "COMPLETED" && (
                <div style={{ marginBottom: 24, padding: 16, background: "#fff3cd", borderRadius: 12, border: "1px solid #ffc107" }}>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#856404" }}>
                    📦 Archivar Pool
                  </h4>
                  <div style={{ fontSize: 14, lineHeight: 1.8, color: "#856404", marginBottom: 12 }}>
                    El torneo ha finalizado. Puedes archivar este pool para moverlo fuera de la vista principal.
                    Los pools archivados permanecen accesibles pero se marcan como históricos.
                  </div>
                  <button
                    onClick={async () => {
                      if (!token || !poolId || busyKey === "archive") return;

                      const confirmed = window.confirm(
                        "¿Estás seguro de que deseas archivar este pool?\n\n" +
                        "Esta acción marcará el pool como archivado. " +
                        "Los miembros aún podrán ver el leaderboard y resultados finales, " +
                        "pero no se permitirán más cambios."
                      );

                      if (!confirmed) return;

                      setBusyKey("archive");
                      setError(null);

                      try {
                        await archivePool(token, poolId);
                        await load(verbose);
                        alert("✅ Pool archivado exitosamente");
                      } catch (err: any) {
                        setError(err?.message ?? "Error al archivar pool");
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                    disabled={busyKey === "archive"}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: "1px solid #856404",
                      background: busyKey === "archive" ? "#ccc" : "#ffc107",
                      color: "#856404",
                      cursor: busyKey === "archive" ? "wait" : "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {busyKey === "archive" ? "⏳ Archivando..." : "📦 Archivar Pool"}
                  </button>
                </div>
              )}

              {/* Instructions */}
              <div style={{ padding: 16, background: "#e7f3ff", border: "1px solid #b3d7ff", borderRadius: 12 }}>
                <div style={{ fontSize: 14, color: "#004085", lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>ℹ️ Información para el Host</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Las fases se avanzan automáticamente cuando todos los partidos tienen resultado (si auto-advance está habilitado)</li>
                    <li>Si detectamos una <b>errata reciente</b> (últimas 24h), el avance automático se bloqueará y deberás avanzar manualmente</li>
                    <li>Puedes usar el botón "🚀 Avanzar Fase" para forzar el avance manual cuando sea necesario</li>
                    <li>Usa el botón "🔒 Bloquear" para <b>prevenir avances automáticos y permitir correcciones</b> en una fase completada</li>
                    <li>Las fases bloqueadas permitirán modificar resultados incluso después de avanzar a la siguiente fase</li>
                    <li>El sistema aplicará criterios de desempate automáticamente (puntos, diferencia de goles, head-to-head)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: Mi Resumen */}
          {activeTab === "resumen" && (
            <div style={{ marginTop: 14, padding: 20, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
              <PlayerSummary
                poolId={poolId!}
                userId={overview.myMembership.userId ?? ""}
                tournamentKey={overview.tournamentInstance.templateKey ?? "wc_2026_sandbox"}
              />
            </div>
          )}

          {/* Tab Content: Reglas */}
          {activeTab === "reglas" && (
            <div style={{ marginTop: 14, padding: 20, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
              {/* Check if pool has advanced pick types configuration */}
              {overview.pool.pickTypesConfig ? (
                <PickRulesDisplay
                  pickTypesConfig={overview.pool.pickTypesConfig as PoolPickTypesConfig}
                  poolDeadlineMinutes={overview.pool.deadlineMinutesBeforeKickoff}
                  poolTimeZone={overview.pool.timeZone}
                />
              ) : (
                <>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, marginBottom: 16 }}>Reglas de la Pool</h3>

              {/* Scoring System */}
              <div style={{ marginBottom: 20, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
                  📊 Sistema de Puntuación
                </h4>
                <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Preset:</span>{" "}
                    <span style={{ background: "#fff", padding: "2px 8px", borderRadius: 4, border: "1px solid #dee2e6" }}>
                      {(overview as any)?.leaderboard?.scoringPreset?.name ?? overview.pool.scoringPresetKey ?? "CLASSIC"}
                    </span>
                  </div>
                  <div style={{ color: "#666", fontSize: 13, marginBottom: 12, fontStyle: "italic" }}>
                    {(overview as any)?.leaderboard?.scoringPreset?.description ?? "Sistema de puntuación clásico para quinielas deportivas"}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 24, fontWeight: 900, color: "#28a745", minWidth: 40 }}>
                        {overview.leaderboard.scoring.exactScoreBonus}
                      </span>
                      <span>puntos por acertar el <b>marcador exacto</b></span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 24, fontWeight: 900, color: "#ffc107", minWidth: 40 }}>
                        {overview.leaderboard.scoring.outcomePoints}
                      </span>
                      <span>puntos por acertar solo el <b>resultado</b> (ganador o empate)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pick Rules */}
              <div style={{ marginBottom: 20, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
                  ⚽ Tipos de Pronóstico
                </h4>
                <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Método permitido:</span>{" "}
                    <span style={{
                      background: allowScorePick ? "#d4edda" : "#fff3cd",
                      padding: "4px 12px",
                      borderRadius: 6,
                      border: allowScorePick ? "1px solid #c3e6cb" : "1px solid #ffeeba",
                      fontWeight: 600
                    }}>
                      {allowScorePick ? "📝 Marcador Exacto (SCORE)" : "🎯 Solo Resultado (OUTCOME)"}
                    </span>
                  </div>
                  <div style={{ color: "#666", fontSize: 13 }}>
                    {allowScorePick
                      ? "Debes predecir el marcador exacto del partido (ej: 2-1). Si aciertas el marcador exacto ganas más puntos."
                      : "Solo debes predecir el resultado del partido (Victoria Local, Empate, Victoria Visitante)."
                    }
                  </div>
                </div>
              </div>

              {/* Deadline Policy */}
              <div style={{ marginBottom: 20, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
                  ⏰ Política de Deadline
                </h4>
                <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Tiempo límite:</span>{" "}
                    <span style={{ background: "#fff", padding: "2px 8px", borderRadius: 4, border: "1px solid #dee2e6", fontWeight: 600 }}>
                      {overview.pool.deadlineMinutesBeforeKickoff} minutos antes del kickoff
                    </span>
                  </div>
                  <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
                    Puedes hacer y modificar tus pronósticos hasta {overview.pool.deadlineMinutesBeforeKickoff} minutos antes del inicio de cada partido. Una vez que se alcanza el deadline, el partido queda <b>LOCKED</b> y no podrás editar tu pick.
                  </div>
                  <div style={{ marginTop: 8, padding: 10, background: "#fff3cd", borderRadius: 8, border: "1px solid #ffeeba" }}>
                    <div style={{ fontSize: 13, color: "#856404" }}>
                      <b>⚠️ Importante:</b> Asegúrate de revisar las fechas y horas de los partidos. Todos los horarios se muestran en la zona horaria: <b>{overview.pool.timeZone}</b>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tournament Info */}
              <div style={{ padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
                  🏆 Información del Torneo
                </h4>
                <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>Torneo:</span> {overview.tournamentInstance.name}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>Miembros activos:</span> {overview.counts.membersActive}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>Visibilidad:</span>{" "}
                    <span style={{
                      background: overview.pool.visibility === "PRIVATE" ? "#fff3cd" : "#d4edda",
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: overview.pool.visibility === "PRIVATE" ? "1px solid #ffeeba" : "1px solid #c3e6cb",
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      {overview.pool.visibility === "PRIVATE" ? "🔒 PRIVADA" : "🌍 PÚBLICA"}
                    </span>
                  </div>
                  {overview.pool.description && (
                    <div style={{ marginTop: 12, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #dee2e6" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>Descripción:</div>
                      <div style={{ color: "#333" }}>{overview.pool.description}</div>
                    </div>
                  )}
                </div>
              </div>
              </>
            )}
            </div>
          )}

          {/* Phase Navigation Sub-tabs */}
          {activeTab === "partidos" && phases.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "thin" }}>
              {phases.map((phase: any) => {
                const status = getPhaseStatus(phase.id);
                const matchCount = overview.matches.filter((m: any) => m.phaseId === phase.id).length;
                const isActive = activePhase === phase.id;

                return (
                  <button
                    key={phase.id}
                    onClick={() => setActivePhase(phase.id)}
                    style={{
                      padding: "10px 16px",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      background: isActive ? "#007bff" : status === "PENDING" ? "#f8f9fa" : "#fff",
                      color: isActive ? "#fff" : status === "PENDING" ? "#999" : "#333",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.2s",
                      boxShadow: isActive ? "0 2px 4px rgba(0,123,255,0.3)" : "none",
                      opacity: status === "PENDING" ? 0.8 : 1,
                    }}
                  >
                    <span>{phase.name}</span>
                    <span style={{ fontSize: 11, opacity: 0.85 }}>({matchCount})</span>
                    {status === "PENDING" && <span style={{ fontSize: 14 }}>🔒</span>}
                    {status === "COMPLETED" && <span style={{ fontSize: 14 }}>✅</span>}
                    {status === "ACTIVE" && !isActive && <span style={{ fontSize: 14 }}>⚽</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Notification Banner for Partidos tab */}
          {activeTab === "partidos" && notifications && (tabBadges.partidos > 0) && (() => {
            const bannerItems: { icon: string; message: string }[] = [];

            // Agrupar partidos urgentes por fase
            if (notifications.urgentDeadlines.length > 0) {
              const byPhase: Record<string, number> = {};
              for (const d of notifications.urgentDeadlines) {
                byPhase[d.phaseId] = (byPhase[d.phaseId] || 0) + 1;
              }

              // Formatear nombres de fases
              const phaseNames: Record<string, string> = {
                group_stage: "Fase de Grupos",
                round_of_32: "Dieciseisavos",
                round_of_16: "Octavos de Final",
                quarter_finals: "Cuartos de Final",
                semi_finals: "Semifinales",
                third_place: "Tercer Lugar",
                finals: "Final",
              };

              const phaseDetails = Object.entries(byPhase)
                .map(([phaseId, count]) => `${count} en ${phaseNames[phaseId] || phaseId}`)
                .join(", ");

              bannerItems.push({
                icon: "⏰",
                message: `Tienes ${notifications.pendingPicks} partido${notifications.pendingPicks > 1 ? "s" : ""} sin pick que cierra${notifications.pendingPicks > 1 ? "n" : ""} en las próximas horas (${phaseDetails}).`
              });
            }

            if (notifications.isHostOrCoAdmin && notifications.pendingResults > 0) {
              bannerItems.push({
                icon: "📝",
                message: `${notifications.pendingResults} partido${notifications.pendingResults > 1 ? "s" : ""} jugado${notifications.pendingResults > 1 ? "s" : ""} sin resultado publicado.`
              });
            }

            return bannerItems.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <NotificationBanner items={bannerItems} />
              </div>
            ) : null;
          })()}

          {/* Phase Status Banner (for pending phases) */}
          {activeTab === "partidos" && activePhase && getPhaseStatus(activePhase) === "PENDING" && (
            <div style={{
              marginTop: 14,
              padding: 16,
              background: "#fff3cd",
              border: "1px solid #ffeeba",
              borderRadius: 12,
              display: "flex",
              alignItems: "start",
              gap: 12
            }}>
              <span style={{ fontSize: 24 }}>⏳</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#856404", marginBottom: 4 }}>
                  Fase Pendiente - Equipos Por Definir
                </div>
                <div style={{ fontSize: 13, color: "#856404", lineHeight: 1.6 }}>
                  Los equipos de esta fase se determinarán automáticamente cuando se completen los partidos de la fase anterior.
                  Por ahora, puedes ver los partidos programados con placeholders (ej: "Ganador Grupo A", "3er Mejor Tercero").
                </div>
              </div>
            </div>
          )}

          {/* Invite (Host) */}
          {activeTab === "partidos" && overview.permissions.canInvite && (
            <div style={{ marginTop: 14, padding: 14, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontWeight: 900 }}>Invitaciones</div>
                <button
                  onClick={onCreateInvite}
                  disabled={busyKey === "invite"}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {busyKey === "invite" ? "..." : "Crear código"}
                </button>
              </div>

              {inviteCode && (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <div style={{ color: "#666" }}>Código (copiado si el navegador lo permitió):</div>
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1 }}>{inviteCode}</div>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Partidos - UX toolbar */}
          {activeTab === "partidos" && !requiresStructuralPicks && (
            <div style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por equipo / grupo / roundLabel..."
                  style={{ flex: "1 1 280px", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
                />
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#444" }}>
                  <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
                  Solo OPEN
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#444" }}>
                  <input type="checkbox" checked={onlyNoPick} onChange={(e) => setOnlyNoPick(e.target.checked)} />
                  Sin pick
                </label>
                {overview?.permissions?.canManageResults && (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#444" }}>
                    <input type="checkbox" checked={onlyNoResult} onChange={(e) => setOnlyNoResult(e.target.checked)} />
                    Solo sin resultado
                  </label>
                )}
                <div style={{ fontSize: 12, color: "#666" }}>
                  Total: <b>{filteredMatches.length}</b> partidos • Grupo sugerido: <b>{nextOpenGroup}</b>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: Partidos - Structural Picks Manager (SIMPLE preset) */}
          {activeTab === "partidos" && requiresStructuralPicks && activePhaseData && activePhaseConfig && (
            <div style={{ marginTop: 14 }}>
              <StructuralPicksManager
                poolId={poolId!}
                phaseId={activePhase!}
                phaseName={activePhaseData.name}
                phaseType={activePhaseData.type}
                phaseConfig={activePhaseConfig}
                tournamentData={(overview.tournamentInstance as any).dataJson}
                token={token!}
                isHost={overview.permissions.canManageResults}
                isLocked={getPhaseStatus(activePhase!) === "COMPLETED"}
                matchResults={phaseMatchResults}
                onDataChanged={() => load(verbose)}
                onShowBreakdown={() => setBreakdownModalData({
                  phaseId: activePhase!,
                  phaseTitle: `Desglose - ${activePhaseData.name}`,
                })}
              />
            </div>
          )}

          {/* Tab Content: Partidos - Group Tabs */}
          {activeTab === "partidos" && !requiresStructuralPicks && (
            <div style={{
              marginTop: 14,
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 4,
              scrollbarWidth: "thin"
            }}>
              <button
                onClick={() => setSelectedGroup(null)}
                style={{
                  padding: "10px 18px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  background: !selectedGroup ? "#007bff" : "#fff",
                  color: !selectedGroup ? "#fff" : "#666",
                  fontWeight: !selectedGroup ? 600 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                  boxShadow: !selectedGroup ? "0 2px 4px rgba(0,123,255,0.3)" : "none",
                }}
              >
                Todos
              </button>
              {groupOrder.map((g) => {
                const count = matchesByGroup[g]?.length ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={g}
                    onClick={() => setSelectedGroup(g)}
                    style={{
                      padding: "10px 18px",
                      border: selectedGroup === g ? "1px solid #007bff" : "1px solid #ddd",
                      borderRadius: 8,
                      background: selectedGroup === g ? "#007bff" : "#fff",
                      color: selectedGroup === g ? "#fff" : "#666",
                      fontWeight: selectedGroup === g ? 600 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.2s",
                      boxShadow: selectedGroup === g ? "0 2px 4px rgba(0,123,255,0.3)" : "none",
                    }}
                  >
                    {g === "SIN_GRUPO" ? "Otros" : `Grupo ${g}`}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab Content: Partidos - Matches by group */}
          {activeTab === "partidos" && !requiresStructuralPicks && (
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {groupOrder.filter(g => !selectedGroup || g === selectedGroup).map((g) => (
                <details
                  key={g}
                  open={g === nextOpenGroup}
                  style={{ border: "1px solid #ddd", borderRadius: 14, background: "#fff", padding: 12 }}
                >
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                    {g === "SIN_GRUPO" ? "Otros" : `Grupo ${g}`} ({matchesByGroup[g]?.length ?? 0})
                  </summary>

                  <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                    {matchesByGroup[g].map((m: any) => {
                      const busyPick = busyKey === `pick:${m.id}`;
                      const busyRes = busyKey === `res:${m.id}`;
                      const isHost = overview.permissions.canManageResults;

                      // Check if match has placeholders
                      const homeIsPlaceholder = isPlaceholder(m.homeTeam?.id || "");
                      const awayIsPlaceholder = isPlaceholder(m.awayTeam?.id || "");
                      const hasAnyPlaceholder = homeIsPlaceholder || awayIsPlaceholder;

                      return (
                        <div
                          key={m.id}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 14,
                            padding: 14,
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                            background: hasAnyPlaceholder ? "#f8f9fa" : "#fff",
                            opacity: hasAnyPlaceholder ? 0.85 : 1,
                          }}
                        >
                          {/* Match Header with Flags or Placeholders */}
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                              {/* Home team - flag on left or placeholder */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {homeIsPlaceholder ? (
                                  <>
                                    <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#e9ecef", borderRadius: 2, border: "1px solid #ced4da" }}>
                                      <span style={{ fontSize: 14 }}>🔒</span>
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: "#6c757d", fontStyle: "italic" }}>
                                      {getPlaceholderName(m.homeTeam.id)}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    {(() => {
                                      const flag = getTeamFlag(m.homeTeam.id.replace("t_", ""), overview.tournamentInstance.templateKey ?? "wc_2026_sandbox");
                                      return flag?.flagUrl ? (
                                        <img
                                          src={flag.flagUrl}
                                          alt={getCountryName(m.homeTeam.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")}
                                          style={{ width: 32, height: "auto", borderRadius: 2, border: "1px solid #ddd" }}
                                        />
                                      ) : (
                                        <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 2, border: "1px solid #ddd" }}>
                                          <span style={{ fontSize: 16 }}>⚽</span>
                                        </div>
                                      );
                                    })()}
                                    <span style={{ fontSize: 14, fontWeight: 500 }}>
                                      {getCountryName(m.homeTeam.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")}
                                    </span>
                                  </>
                                )}
                              </div>
                              <span style={{ fontWeight: 900, fontSize: 18, color: "#666", margin: "0 4px" }}>VS</span>
                              {/* Away team - flag on right or placeholder */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {awayIsPlaceholder ? (
                                  <>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: "#6c757d", fontStyle: "italic" }}>
                                      {getPlaceholderName(m.awayTeam.id)}
                                    </span>
                                    <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#e9ecef", borderRadius: 2, border: "1px solid #ced4da" }}>
                                      <span style={{ fontSize: 14 }}>🔒</span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ fontSize: 14, fontWeight: 500 }}>
                                      {getCountryName(m.awayTeam.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")}
                                    </span>
                                    {(() => {
                                      const flag = getTeamFlag(m.awayTeam.id.replace("t_", ""), overview.tournamentInstance.templateKey ?? "wc_2026_sandbox");
                                      return flag?.flagUrl ? (
                                        <img
                                          src={flag.flagUrl}
                                          alt={getCountryName(m.awayTeam.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")}
                                          style={{ width: 32, height: "auto", borderRadius: 2, border: "1px solid #ddd" }}
                                        />
                                      ) : (
                                        <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 2, border: "1px solid #ddd" }}>
                                          <span style={{ fontSize: 16 }}>⚽</span>
                                        </div>
                                      );
                                    })()}
                                  </>
                                )}
                              </div>
                            </div>

                            <div style={{ fontSize: 12 }}>
                              {m.isLocked ? (
                                <span style={{ padding: "4px 10px", border: "1px solid #f99", borderRadius: 999, background: "#fee" }}>
                                  🔒 LOCKED
                                </span>
                              ) : (
                                <span style={{ padding: "4px 10px", border: "1px solid #9f9", borderRadius: 999, background: "#efe" }}>
                                  ✅ OPEN
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Match Info */}
                          <div style={{ color: "#666", fontSize: 12, marginBottom: 12, paddingLeft: 4 }}>
                            {m.label ?? m.roundLabel ?? `Partido ${m.matchNumber ?? m.id}`} • {fmtUtc(m.kickoffUtc, userTimezone)}
                          </div>

                          {/* Content: Picks and Results OR Placeholder Message */}
                          {hasAnyPlaceholder ? (
                            <div style={{
                              padding: 20,
                              background: "#fff3cd",
                              border: "1px solid #ffeeba",
                              borderRadius: 12,
                              textAlign: "center"
                            }}>
                              <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
                              <div style={{ fontWeight: 700, color: "#856404", marginBottom: 4 }}>
                                Partido Pendiente
                              </div>
                              <div style={{ fontSize: 13, color: "#856404" }}>
                                Este partido se habilitará cuando se definan los equipos participantes.
                              </div>
                            </div>
                          ) : (
                            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              {/* Pick */}
                              <PickSection
                                pick={m.myPick}
                                isLocked={m.isLocked}
                                allowScorePick={allowScorePick}
                                onSave={(pick: any) => savePick(m.id, pick)}
                                disabled={busyPick}
                                homeTeam={m.homeTeam}
                                awayTeam={m.awayTeam}
                                tournamentKey={overview.tournamentInstance.templateKey ?? "wc_2026_sandbox"}
                              />

                              {/* Result + Host */}
                              <ResultSection
                                result={m.result}
                                isHost={isHost}
                                onSave={(homeGoals, awayGoals, reason, homePenalties, awayPenalties) =>
                                  saveResult(m.id, {
                                    homeGoals,
                                    awayGoals,
                                    ...(reason ? { reason } : {}),
                                    ...(homePenalties !== undefined ? { homePenalties } : {}),
                                    ...(awayPenalties !== undefined ? { awayPenalties } : {}),
                                  })
                                }
                                disabled={busyRes}
                                homeTeam={m.homeTeam}
                                awayTeam={m.awayTeam}
                                tournamentKey={overview.tournamentInstance.templateKey ?? "wc_2026_sandbox"}
                                phaseId={m.phaseId}
                              />
                            </div>
                          )}

                          {/* Botones de acción - en una sola línea */}
                          {(m.isLocked && !isPlaceholder(m.homeTeamId ?? "") && !isPlaceholder(m.awayTeamId ?? "")) && (
                            <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                              {/* Botón Ver Desglose - solo si hay resultado y la fase usa requiresScore */}
                              {m.result && overview.pool.pickTypesConfig && (() => {
                                const phaseConfig = (overview.pool.pickTypesConfig as any[])?.find(
                                  (p: any) => p.phaseId === m.phaseId
                                );
                                return phaseConfig?.requiresScore === true;
                              })() && (
                                <button
                                  onClick={() => setBreakdownModalData({
                                    matchId: m.id,
                                    matchTitle: `${getCountryName(m.homeTeam?.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")} vs ${getCountryName(m.awayTeam?.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")}`,
                                  })}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    border: "none",
                                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  Ver desglose
                                </button>
                              )}

                              {/* Botón Ver picks de otros */}
                              <button
                                onClick={() => loadMatchPicks(
                                  m.id,
                                  `${getCountryName(m.homeTeam?.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")} vs ${getCountryName(m.awayTeam?.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")}`
                                )}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  border: "1px solid #17a2b8",
                                  background: "#e7f6f8",
                                  color: "#17a2b8",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                Ver picks de otros
                              </button>
                            </div>
                          )}

                          {verbose && (
                            <details style={{ marginTop: 10 }}>
                              <summary>Debug JSON</summary>
                              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(m, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          )}

          {/* Tab Content: Leaderboard */}
          {activeTab === "leaderboard" && (
            <div style={{ marginTop: 14, padding: isMobile ? 12 : 20, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 900 }}>Clasificación General</h3>
              </div>

              {/* Mobile Leaderboard (cards) */}
              {isMobile ? (
                <MobileLeaderboard
                  rows={overview.leaderboard.rows}
                  phases={overview.leaderboard.phases || []}
                  onPlayerClick={(userId, displayName, initialPhase) => {
                    setPlayerSummaryModal({ userId, displayName, initialPhase });
                  }}
                  formatPhaseName={formatPhaseName}
                  formatPhaseFullName={formatPhaseFullName}
                />
              ) : (
                /* Desktop Leaderboard (table) */
                <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                      <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700, color: "#444" }}>Pos</th>
                      <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700, color: "#444" }}>Jugador</th>
                      <th style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: "#007bff", background: "#e7f3ff", borderRadius: "8px 8px 0 0" }}>Total</th>
                      {/* Columnas por fase */}
                      {(overview.leaderboard.phases || []).map((phaseId: string) => (
                        <th
                          key={phaseId}
                          title={formatPhaseFullName(phaseId)}
                          style={{
                            padding: "12px 6px",
                            textAlign: "center",
                            fontWeight: 600,
                            color: "#666",
                            fontSize: 12,
                            minWidth: 50,
                          }}
                        >
                          {formatPhaseName(phaseId)}
                        </th>
                      ))}
                      <th style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: "#444" }}>Dif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.leaderboard.rows.map((r: any, idx: number) => {
                      const leaderPoints = overview.leaderboard.rows[0]?.points ?? 0;
                      const diff = leaderPoints - r.points;
                      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "";
                      const phases = overview.leaderboard.phases || [];

                      return (
                        <tr
                          key={r.userId}
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            background: idx < 3 ? (idx === 0 ? "#fff9e6" : idx === 1 ? "#f5f5f5" : "#fafafa") : "transparent",
                          }}
                        >
                          <td style={{ padding: "14px 8px", fontWeight: 700, fontSize: 16 }}>
                            {medal ? <span style={{ marginRight: 4 }}>{medal}</span> : null}
                            {r.rank}
                          </td>
                          <td
                            onClick={() => setPlayerSummaryModal({ userId: r.userId, displayName: r.displayName })}
                            style={{ padding: "14px 8px", cursor: "pointer" }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                          >
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.displayName}</div>
                            <div style={{ display: "flex", gap: 4 }}>
                              {r.role === "HOST" && (
                                <span style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 3,
                                  background: "#007bff20",
                                  border: "1px solid #007bff",
                                  color: "#007bff",
                                  fontWeight: 600
                                }}>
                                  👑 HOST
                                </span>
                              )}
                              {r.role === "CO_ADMIN" && (
                                <span style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 3,
                                  background: "#28a74520",
                                  border: "1px solid #28a745",
                                  color: "#28a745",
                                  fontWeight: 600
                                }}>
                                  ⭐ CO-ADMIN
                                </span>
                              )}
                              {r.role === "PLAYER" && (
                                <span style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 3,
                                  background: "#6c757d20",
                                  border: "1px solid #6c757d",
                                  color: "#6c757d",
                                  fontWeight: 600
                                }}>
                                  PLAYER
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "14px 8px", textAlign: "center", fontWeight: 900, fontSize: 18, color: "#007bff", background: "#f8fbff" }}>
                            {r.points}
                          </td>
                          {/* Celdas de puntos por fase - clickeables para abrir resumen en esa fase */}
                          {phases.map((phaseId: string) => {
                            const phasePoints = r.pointsByPhase?.[phaseId] ?? 0;
                            const hasPoints = phasePoints > 0;
                            return (
                              <td
                                key={phaseId}
                                onClick={() => {
                                  if (hasPoints) {
                                    setPlayerSummaryModal({ userId: r.userId, displayName: r.displayName, initialPhase: phaseId });
                                  }
                                }}
                                style={{
                                  padding: "10px 6px",
                                  textAlign: "center",
                                  fontSize: 13,
                                  fontWeight: hasPoints ? 600 : 400,
                                  color: hasPoints ? "#333" : "#ccc",
                                  cursor: hasPoints ? "pointer" : "default",
                                  transition: "background 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  if (hasPoints) e.currentTarget.style.background = "#e7f3ff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "transparent";
                                }}
                                title={hasPoints ? `Ver detalle de ${formatPhaseFullName(phaseId)}` : "Sin puntos aún"}
                              >
                                {hasPoints ? phasePoints : "-"}
                              </td>
                            );
                          })}
                          <td style={{ padding: "14px 8px", textAlign: "center", fontSize: 13, color: "#666" }}>
                            {idx === 0 ? (
                              <span style={{ fontWeight: 700, color: "#2e7d32" }}>Líder</span>
                            ) : (
                              <span>-{diff}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {overview.leaderboard.rows.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
                  Aún no hay datos en el leaderboard
                </div>
              )}

              {verbose && (
                <details style={{ marginTop: 16, padding: 12, background: "#f9f9f9", borderRadius: 8 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Ver desglose detallado (Debug)</summary>
                  <div style={{ marginTop: 10 }}>
                    {overview.leaderboard.rows.map((r: any) => (
                      <div key={r.userId} style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.displayName}</div>
                        {r.breakdown && (
                          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", background: "#fff", padding: 8, borderRadius: 4, overflow: "auto" }}>
                            {JSON.stringify(r.breakdown, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
                </>
              )}
            </div>
          )}

          {/* Expulsion Modal (KICK or BAN) */}
          {expulsionModalData && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: 20
              }}
              onClick={() => setExpulsionModalData(null)}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 24,
                  maxWidth: 550,
                  width: "100%",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {expulsionModalData.type === "KICK" ? (
                  <>
                    <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 700, color: "#ffc107" }}>
                      👋 Expulsar a {expulsionModalData.memberName}
                    </h3>
                    <div style={{ marginBottom: 16, padding: 12, background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
                      <strong>Expulsión simple:</strong> El jugador será removido del pool pero <strong>podrá volver a solicitar acceso</strong> más adelante usando un código de invitación.
                    </div>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!token || !poolId || busyKey) return;

                        const reason = (new FormData(e.currentTarget).get("reason") as string) || undefined;

                        setBusyKey(`kick:${expulsionModalData.memberId}`);
                        setError(null);

                        try {
                          await kickMember(token, poolId, expulsionModalData.memberId, reason);
                          await load(verbose);
                          setExpulsionModalData(null);
                          alert(`✅ ${expulsionModalData.memberName} ha sido expulsado del pool`);
                        } catch (err: any) {
                          setError(err?.message ?? "Error al expulsar miembro");
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                      style={{ display: "grid", gap: 12 }}
                    >
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#333" }}>
                          Razón (opcional)
                        </label>
                        <textarea
                          name="reason"
                          rows={2}
                          placeholder="Ej: Solicitó salir del pool"
                          style={{
                            width: "100%",
                            padding: 10,
                            border: "1px solid #ddd",
                            borderRadius: 6,
                            fontSize: 14,
                            fontFamily: "inherit",
                            resize: "vertical"
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => setExpulsionModalData(null)}
                          disabled={busyKey !== null}
                          style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "#fff",
                            color: "#333",
                            cursor: busyKey ? "wait" : "pointer",
                            fontSize: 14,
                            fontWeight: 600
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={busyKey !== null}
                          style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 6,
                            border: "none",
                            background: busyKey ? "#ccc" : "#ffc107",
                            color: "#fff",
                            cursor: busyKey ? "wait" : "pointer",
                            fontSize: 14,
                            fontWeight: 600
                          }}
                        >
                          {busyKey ? "⏳ Expulsando..." : "👋 Expulsar"}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 700, color: "#dc3545" }}>
                      🚫 Banear a {expulsionModalData.memberName}
                    </h3>
                    <div style={{ marginBottom: 16, padding: 14, background: "#f8d7da", border: "2px solid #dc3545", borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "#721c24" }}>
                        ⚠️ ADVERTENCIA: Esta acción es PERMANENTE e IRREVERSIBLE
                      </div>
                      <ul style={{ margin: "8px 0", paddingLeft: 20, color: "#721c24" }}>
                        <li><strong>El jugador NO podrá volver a unirse</strong> a este pool nunca más</li>
                        <li>Opcionalmente puedes <strong>eliminar todas sus selecciones</strong></li>
                        <li>Esta acción queda registrada en el historial de auditoría</li>
                      </ul>
                    </div>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!token || !poolId || busyKey) return;

                        const formData = new FormData(e.currentTarget);
                        const reason = formData.get("reason") as string;
                        const deletePicks = (formData.get("deletePicks") as string) === "true";

                        if (!reason || reason.trim().length === 0) {
                          alert("❌ Debes proporcionar una razón para el baneo");
                          return;
                        }

                        setBusyKey(`ban:${expulsionModalData.memberId}`);
                        setError(null);

                        try {
                          await banMember(token, poolId, expulsionModalData.memberId, reason, deletePicks);
                          await load(verbose);
                          setExpulsionModalData(null);
                          alert(`✅ ${expulsionModalData.memberName} ha sido baneado permanentemente`);
                        } catch (err: any) {
                          setError(err?.message ?? "Error al banear miembro");
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                      style={{ display: "grid", gap: 12 }}
                    >
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#333" }}>
                          Razón del baneo *
                        </label>
                        <textarea
                          name="reason"
                          required
                          rows={3}
                          placeholder="Ej: Comportamiento inapropiado, trampas, lenguaje ofensivo, etc."
                          style={{
                            width: "100%",
                            padding: 10,
                            border: "1px solid #ddd",
                            borderRadius: 6,
                            fontSize: 14,
                            fontFamily: "inherit",
                            resize: "vertical"
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            name="deletePicks"
                            value="true"
                          />
                          <span>
                            <strong>Eliminar todas sus selecciones</strong> (afectará el leaderboard)
                          </span>
                        </label>
                      </div>

                      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => setExpulsionModalData(null)}
                          disabled={busyKey !== null}
                          style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "#fff",
                            color: "#333",
                            cursor: busyKey ? "wait" : "pointer",
                            fontSize: 14,
                            fontWeight: 600
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={busyKey !== null}
                          style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 6,
                            border: "none",
                            background: busyKey ? "#ccc" : "#dc3545",
                            color: "#fff",
                            cursor: busyKey ? "wait" : "pointer",
                            fontSize: 14,
                            fontWeight: 600
                          }}
                        >
                          {busyKey ? "⏳ Baneando..." : "🚫 Banear Permanentemente"}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
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

          {/* Player Summary Modal (from leaderboard click) */}
          {playerSummaryModal && poolId && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: 20
              }}
              onClick={() => setPlayerSummaryModal(null)}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  maxWidth: 950,
                  width: "100%",
                  maxHeight: "90vh",
                  overflow: "auto",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  position: "sticky",
                  top: 0,
                  background: "#fff",
                  padding: "16px 20px",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  zIndex: 10
                }}>
                  <h2 style={{ margin: 0, fontSize: 20 }}>
                    Resumen de {playerSummaryModal.displayName}
                  </h2>
                  <button
                    onClick={() => setPlayerSummaryModal(null)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 24,
                      cursor: "pointer",
                      color: "#666",
                      padding: "4px 8px"
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ padding: 20 }}>
                  <PlayerSummary
                    poolId={poolId}
                    userId={playerSummaryModal.userId}
                    tournamentKey={overview.tournamentInstance.templateKey ?? "wc_2026_sandbox"}
                    initialPhase={playerSummaryModal.initialPhase}
                    onClose={() => setPlayerSummaryModal(null)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Match Picks Modal (ver picks de otros jugadores) */}
          {matchPicksModal && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: 20
              }}
              onClick={() => setMatchPicksModal(null)}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  maxWidth: 500,
                  width: "100%",
                  maxHeight: "80vh",
                  overflow: "auto",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  position: "sticky",
                  top: 0,
                  background: "#fff",
                  padding: "16px 20px",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  zIndex: 10
                }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>
                    Picks: {matchPicksModal.matchTitle}
                  </h3>
                  <button
                    onClick={() => setMatchPicksModal(null)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 24,
                      cursor: "pointer",
                      color: "#666",
                      padding: "4px 8px"
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ padding: 20 }}>
                  {matchPicksModal.loading && (
                    <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
                      Cargando picks...
                    </div>
                  )}
                  {matchPicksModal.error && (
                    <div style={{ textAlign: "center", padding: 20, color: "#dc3545" }}>
                      Error: {matchPicksModal.error}
                    </div>
                  )}
                  {matchPicksModal.picks && !matchPicksModal.picks.isUnlocked && (
                    <div style={{ textAlign: "center", padding: 20, color: "#856404", background: "#fff3cd", borderRadius: 8 }}>
                      El deadline aún no ha pasado. Solo puedes ver tu propio pick.
                    </div>
                  )}
                  {matchPicksModal.picks && matchPicksModal.picks.picks.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {matchPicksModal.picks.picks.map((p) => (
                        <div
                          key={p.userId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "12px 16px",
                            borderRadius: 8,
                            background: p.isCurrentUser ? "#e7f3ff" : "#f8f9fa",
                            border: p.isCurrentUser ? "2px solid #007bff" : "1px solid #eee"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: p.isCurrentUser ? 700 : 500 }}>
                              {p.displayName}
                            </span>
                            {p.isCurrentUser && (
                              <span style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "#007bff",
                                color: "#fff"
                              }}>
                                Tú
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>
                            {p.pick ? (
                              p.pick.type === "SCORE" ? (
                                <span style={{ color: "#28a745" }}>
                                  {p.pick.homeGoals} - {p.pick.awayGoals}
                                </span>
                              ) : p.pick.type === "OUTCOME" ? (
                                <span style={{ color: "#007bff" }}>
                                  {p.pick.outcome === "HOME" ? "Local" : p.pick.outcome === "DRAW" ? "Empate" : "Visitante"}
                                </span>
                              ) : (
                                <span style={{ color: "#666" }}>{JSON.stringify(p.pick)}</span>
                              )
                            ) : (
                              <span style={{ color: "#dc3545", fontWeight: 500 }}>Sin pick</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {matchPicksModal.picks && matchPicksModal.picks.picks.length === 0 && !matchPicksModal.loading && (
                    <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
                      No hay picks para este partido
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ========== PICK SECTION (con modo lectura/edición) ==========
function PickSection(props: {
  pick: any;
  isLocked: boolean;
  allowScorePick: boolean;
  onSave: (pick: any) => void;
  disabled: boolean;
  homeTeam: any;
  awayTeam: any;
  tournamentKey: string;
}) {
  const [editMode, setEditMode] = useState(false);

  const hasPick = !!props.pick;
  const _pickType = props.pick?.type;
  void _pickType; // Reserved for future pick type display

  // Si está locked o no hay pick, no puede editar
  const _canEdit = !props.isLocked;
  void _canEdit; // Used implicitly through !props.isLocked checks

  return (
    <div style={{ border: "1px solid #f2f2f2", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#555" }}>Mi Pick</div>

      {props.isLocked && !hasPick && (
        <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>🔒 No hiciste pick (deadline pasado)</div>
      )}

      {props.isLocked && hasPick && (
        <PickDisplay
          pick={props.pick}
          homeTeam={props.homeTeam}
          awayTeam={props.awayTeam}
          tournamentKey={props.tournamentKey}
        />
      )}

      {!props.isLocked && !editMode && hasPick && (
        <>
          <PickDisplay
            pick={props.pick}
            homeTeam={props.homeTeam}
            awayTeam={props.awayTeam}
            tournamentKey={props.tournamentKey}
          />
          <button
            onClick={() => setEditMode(true)}
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #666",
              background: "#fff",
              color: "#333",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ✏️ Modificar elección
          </button>
        </>
      )}

      {!props.isLocked && (editMode || !hasPick) && (
        <PickEditor
          pick={props.pick}
          allowScorePick={props.allowScorePick}
          onSave={(pick) => {
            props.onSave(pick);
            setEditMode(false);
          }}
          onCancel={hasPick ? () => setEditMode(false) : undefined}
          disabled={props.disabled}
          homeTeam={props.homeTeam}
          awayTeam={props.awayTeam}
          tournamentKey={props.tournamentKey}
        />
      )}

      {!props.isLocked && !hasPick && !editMode && (
        <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>Sin pick aún</div>
      )}
    </div>
  );
}

function PickDisplay(props: { pick: any; homeTeam: any; awayTeam: any; tournamentKey: string }) {
  const { pick } = props;
  const homeFlag = getTeamFlag(props.homeTeam.id.replace("t_", ""), props.tournamentKey);
  const awayFlag = getTeamFlag(props.awayTeam.id.replace("t_", ""), props.tournamentKey);
  const homeName = getCountryName(props.homeTeam.id, props.tournamentKey);
  const awayName = getCountryName(props.awayTeam.id, props.tournamentKey);

  if (pick.type === "SCORE") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {/* Home team flag + score */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {homeFlag?.flagUrl ? (
            <img
              src={homeFlag.flagUrl}
              alt={homeName}
              title={homeName}
              style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 3, border: "1px solid #ddd" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 36, fontWeight: 900, color: "#111" }}>{pick.homeGoals}</span>
        </div>

        <span style={{ fontSize: 20, fontWeight: 700, color: "#999", margin: "0 4px" }}>-</span>

        {/* Away team score + flag */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: "#111" }}>{pick.awayGoals}</span>
          {awayFlag?.flagUrl ? (
            <img
              src={awayFlag.flagUrl}
              alt={awayName}
              title={awayName}
              style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 3, border: "1px solid #ddd" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (pick.type === "OUTCOME") {
    const labels: Record<string, string> = {
      HOME: "🏠 Gana Local",
      DRAW: "🤝 Empate",
      AWAY: "🚪 Gana Visitante",
    };
    return (
      <div>
        {/* Team flags header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
          <TeamFlag teamId={props.homeTeam.id} tournamentKey={props.tournamentKey} size="sm" showName={true} layout="horizontal" />
          <TeamFlag teamId={props.awayTeam.id} tournamentKey={props.tournamentKey} size="sm" showName={true} layout="horizontal" />
        </div>
        {/* Outcome display */}
        <div
          style={{
            padding: "12px",
            fontSize: 16,
            fontWeight: 700,
            textAlign: "center",
            color: "#111",
            background: "#f9f9f9",
            borderRadius: 8,
          }}
        >
          {labels[pick.outcome] ?? pick.outcome}
        </div>
      </div>
    );
  }

  return <pre style={{ margin: 0, fontSize: 12, color: "#666" }}>{JSON.stringify(pick, null, 2)}</pre>;
}

function PickEditor(props: {
  pick: any;
  allowScorePick: boolean;
  onSave: (pick: any) => void;
  onCancel?: () => void;
  disabled: boolean;
  homeTeam: any;
  awayTeam: any;
  tournamentKey: string;
}) {
  const pickType = props.pick?.type;
  const isScore = pickType === "SCORE";
  const isOutcome = pickType === "OUTCOME";

  const [homeGoals, setHomeGoals] = useState(isScore ? String(props.pick.homeGoals ?? "") : "");
  const [awayGoals, setAwayGoals] = useState(isScore ? String(props.pick.awayGoals ?? "") : "");
  const [outcome, setOutcome] = useState<string>(isOutcome ? (props.pick.outcome ?? "") : "");

  const homeFlag = getTeamFlag(props.homeTeam.id.replace("t_", ""), props.tournamentKey);
  const awayFlag = getTeamFlag(props.awayTeam.id.replace("t_", ""), props.tournamentKey);
  const homeName = getCountryName(props.homeTeam.id, props.tournamentKey);
  const awayName = getCountryName(props.awayTeam.id, props.tournamentKey);

  const handleSave = () => {
    if (props.allowScorePick) {
      props.onSave({ type: "SCORE", homeGoals: Number(homeGoals), awayGoals: Number(awayGoals) });
    } else {
      props.onSave({ type: "OUTCOME", outcome: outcome as "HOME" | "DRAW" | "AWAY" });
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {props.allowScorePick ? (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 10 }}>
          {/* Home team: logo + name stacked */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 56 }}>
            {homeFlag?.flagUrl ? (
              <img src={homeFlag.flagUrl} alt={homeName} style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
            ) : (
              <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 3, border: "1px solid #ddd" }}>
                <span style={{ fontSize: 18 }}>⚽</span>
              </div>
            )}
            <span style={{ fontSize: 10, color: "#666", fontWeight: 500, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{homeName}</span>
          </div>
          {/* Score inputs */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
            <input
              type="number" min={0} value={homeGoals} onChange={(e) => setHomeGoals(e.target.value)} placeholder="0"
              style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: 22, fontWeight: 700 }}
            />
            <span style={{ fontWeight: 900, fontSize: 18, color: "#666" }}>-</span>
            <input
              type="number" min={0} value={awayGoals} onChange={(e) => setAwayGoals(e.target.value)} placeholder="0"
              style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: 22, fontWeight: 700 }}
            />
          </div>
          {/* Away team: logo + name stacked */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 56 }}>
            {awayFlag?.flagUrl ? (
              <img src={awayFlag.flagUrl} alt={awayName} style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
            ) : (
              <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 3, border: "1px solid #ddd" }}>
                <span style={{ fontSize: 18 }}>⚽</span>
              </div>
            )}
            <span style={{ fontSize: 10, color: "#666", fontWeight: 500, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{awayName}</span>
          </div>
        </div>
      ) : (
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", fontSize: 14 }}
        >
          <option value="">Selecciona...</option>
          <option value="HOME">🏠 Gana Local</option>
          <option value="DRAW">🤝 Empate</option>
          <option value="AWAY">🚪 Gana Visitante</option>
        </select>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={props.disabled}
          onClick={handleSave}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {props.disabled ? "..." : "💾 Guardar"}
        </button>
        {props.onCancel && (
          <button
            onClick={props.onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid #999",
              background: "#fff",
              color: "#666",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

// ========== RESULT SECTION (con modo lectura/edición) ==========
function ResultSection(props: {
  result: any;
  isHost: boolean;
  onSave: (homeGoals: number, awayGoals: number, reason?: string, homePenalties?: number, awayPenalties?: number) => void;
  disabled: boolean;
  homeTeam: any;
  awayTeam: any;
  tournamentKey: string;
  phaseId?: string;
}) {
  const [editMode, setEditMode] = useState(false);

  const hasResult = !!props.result;

  return (
    <div style={{ border: "1px solid #f2f2f2", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#555" }}>Resultado</div>

      {!hasResult && !editMode && (
        <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>
          {props.isHost ? "Sin resultado (publicar cuando termine)" : "Pendiente de resultado oficial"}
        </div>
      )}

      {hasResult && !editMode && (
        <>
          <ResultDisplay
            result={props.result}
            homeTeam={props.homeTeam}
            awayTeam={props.awayTeam}
            tournamentKey={props.tournamentKey}
          />
          {props.isHost && (
            <button
              onClick={() => setEditMode(true)}
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #666",
                background: "#fff",
                color: "#333",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ✏️ Corregir resultado
            </button>
          )}
        </>
      )}

      {props.isHost && (editMode || !hasResult) && (
        <div style={{ marginTop: hasResult ? 10 : 0, borderTop: hasResult ? "1px solid #eee" : "none", paddingTop: hasResult ? 10 : 0 }}>
          <ResultEditor
            result={props.result}
            requireReason={hasResult}
            onSave={(homeGoals, awayGoals, reason, homePenalties, awayPenalties) => {
              props.onSave(homeGoals, awayGoals, reason, homePenalties, awayPenalties);
              setEditMode(false);
            }}
            onCancel={hasResult ? () => setEditMode(false) : undefined}
            disabled={props.disabled}
            homeTeam={props.homeTeam}
            awayTeam={props.awayTeam}
            tournamentKey={props.tournamentKey}
            phaseId={props.phaseId}
          />
        </div>
      )}
    </div>
  );
}

function ResultDisplay(props: { result: any; homeTeam: any; awayTeam: any; tournamentKey: string }) {
  const { result } = props;
  const homeFlag = getTeamFlag(props.homeTeam.id.replace("t_", ""), props.tournamentKey);
  const awayFlag = getTeamFlag(props.awayTeam.id.replace("t_", ""), props.tournamentKey);
  const homeName = getCountryName(props.homeTeam.id, props.tournamentKey);
  const awayName = getCountryName(props.awayTeam.id, props.tournamentKey);

  return (
    <div>
      {/* Score display with team flags - compact horizontal layout */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%)", borderRadius: 8, padding: "10px 12px" }}>
        {/* Home team flag + score */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {homeFlag?.flagUrl ? (
            <img
              src={homeFlag.flagUrl}
              alt={homeName}
              title={homeName}
              style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #b3d9ff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: 3, border: "1px solid #b3d9ff" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 36, fontWeight: 900, color: "#007bff" }}>{result.homeGoals}</span>
        </div>

        <span style={{ fontSize: 20, fontWeight: 700, color: "#99c2e8", margin: "0 4px" }}>-</span>

        {/* Away team score + flag */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: "#007bff" }}>{result.awayGoals}</span>
          {awayFlag?.flagUrl ? (
            <img
              src={awayFlag.flagUrl}
              alt={awayName}
              title={awayName}
              style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #b3d9ff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: 3, border: "1px solid #b3d9ff" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
        </div>
      </div>

      {/* Penalties display (if any) */}
      {(result.homePenalties !== null && result.homePenalties !== undefined) && (
        <div style={{ marginTop: 12, padding: 10, background: "#fffbf0", border: "1px solid #ffc107", borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#856404", marginBottom: 6, textAlign: "center" }}>
            ⚽ Penalties
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: result.homePenalties > (result.awayPenalties || 0) ? "#28a745" : "#666" }}>
              {result.homePenalties}
            </span>
            <span style={{ fontSize: 14, color: "#856404" }}>-</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: (result.awayPenalties || 0) > result.homePenalties ? "#28a745" : "#666" }}>
              {result.awayPenalties || 0}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "#856404", textAlign: "center", marginTop: 4 }}>
            {result.homePenalties > (result.awayPenalties || 0)
              ? `✅ ${homeName} gana`
              : `✅ ${awayName} gana`}
          </div>
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 10, color: "#999", textAlign: "center" }}>
        Resultado oficial{result.version > 1 ? ` (v${result.version})` : ""}
      </div>
      {result.reason && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 6,
            fontSize: 12,
            color: "#856404",
          }}
        >
          <b>Corrección:</b> {result.reason}
        </div>
      )}
    </div>
  );
}

function ResultEditor(props: {
  result: any;
  requireReason: boolean;
  onSave: (homeGoals: number, awayGoals: number, reason?: string, homePenalties?: number, awayPenalties?: number) => void;
  onCancel?: () => void;
  disabled: boolean;
  homeTeam: any;
  awayTeam: any;
  tournamentKey: string;
  phaseId?: string; // Para detectar si es fase eliminatoria
}) {
  const [homeGoals, setHomeGoals] = useState(props.result ? String(props.result.homeGoals) : "");
  const [awayGoals, setAwayGoals] = useState(props.result ? String(props.result.awayGoals) : "");
  const [homePenalties, setHomePenalties] = useState(props.result?.homePenalties ? String(props.result.homePenalties) : "");
  const [awayPenalties, setAwayPenalties] = useState(props.result?.awayPenalties ? String(props.result.awayPenalties) : "");
  const [reason, setReason] = useState("");

  // Detectar si es fase eliminatoria (no puede haber empates)
  const isKnockoutPhase = props.phaseId && !props.phaseId.includes("group");
  // Normalizar a números para comparar (fix para '03' vs '3')
  const homeNum = homeGoals.trim() !== "" ? Number(homeGoals) : null;
  const awayNum = awayGoals.trim() !== "" ? Number(awayGoals) : null;
  const isDraw = homeNum !== null && awayNum !== null && homeNum === awayNum;
  const showPenalties = isKnockoutPhase && isDraw;

  const homeFlag = getTeamFlag(props.homeTeam.id.replace("t_", ""), props.tournamentKey);
  const awayFlag = getTeamFlag(props.awayTeam.id.replace("t_", ""), props.tournamentKey);
  const homeName = getCountryName(props.homeTeam.id, props.tournamentKey);
  const awayName = getCountryName(props.awayTeam.id, props.tournamentKey);

  const needReason = props.requireReason && reason.trim().length === 0;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 10 }}>
        {/* Home team: logo + name stacked */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 56 }}>
          {homeFlag?.flagUrl ? (
            <img src={homeFlag.flagUrl} alt={homeName} style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 3, border: "1px solid #ddd" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 10, color: "#666", fontWeight: 500, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{homeName}</span>
        </div>
        {/* Score inputs */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          <input
            type="number" min={0} value={homeGoals} onChange={(e) => setHomeGoals(e.target.value)} placeholder="0"
            style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: 22, fontWeight: 700 }}
          />
          <span style={{ fontWeight: 900, fontSize: 18, color: "#666" }}>-</span>
          <input
            type="number" min={0} value={awayGoals} onChange={(e) => setAwayGoals(e.target.value)} placeholder="0"
            style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: 22, fontWeight: 700 }}
          />
        </div>
        {/* Away team: logo + name stacked */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 56 }}>
          {awayFlag?.flagUrl ? (
            <img src={awayFlag.flagUrl} alt={awayName} style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 3, border: "1px solid #ddd" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 10, color: "#666", fontWeight: 500, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{awayName}</span>
        </div>
      </div>

      {/* Penalties Section (solo para fases eliminatorias con empate) */}
      {showPenalties && (
        <div style={{ marginTop: 12, padding: 12, background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#856404", marginBottom: 8, textAlign: "center" }}>
            ⚠️ Empate en tiempo regular - Se requieren penalties
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#666" }}>Penalties {homeName}</span>
              <input
                type="number"
                min={0}
                max={99}
                value={homePenalties}
                onChange={(e) => setHomePenalties(e.target.value)}
                placeholder="0"
                style={{ width: 60, padding: 8, borderRadius: 8, border: "1px solid #ffc107", textAlign: "center", fontSize: 16, fontWeight: 700, background: "#fffbf0" }}
              />
            </div>
            <span style={{ fontWeight: 900, fontSize: 16, color: "#856404", marginTop: 20 }}>-</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#666" }}>Penalties {awayName}</span>
              <input
                type="number"
                min={0}
                max={99}
                value={awayPenalties}
                onChange={(e) => setAwayPenalties(e.target.value)}
                placeholder="0"
                style={{ width: 60, padding: 8, borderRadius: 8, border: "1px solid #ffc107", textAlign: "center", fontSize: 16, fontWeight: 700, background: "#fffbf0" }}
              />
            </div>
          </div>
        </div>
      )}

      {props.requireReason && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="⚠️ Razón de la corrección (obligatorio)"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", fontSize: 13 }}
        />
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={props.disabled || needReason}
          onClick={() => {
            const hp = showPenalties && homePenalties ? Number(homePenalties) : undefined;
            const ap = showPenalties && awayPenalties ? Number(awayPenalties) : undefined;
            props.onSave(
              Number(homeGoals),
              Number(awayGoals),
              props.requireReason ? reason.trim() : undefined,
              hp,
              ap
            );
          }}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #111",
            background: needReason ? "#ccc" : "#111",
            color: "#fff",
            cursor: needReason ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {props.disabled ? "..." : props.requireReason ? "📝 Publicar corrección" : "📢 Publicar resultado"}
        </button>
        {props.onCancel && (
          <button
            onClick={props.onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid #999",
              background: "#fff",
              color: "#666",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        )}
      </div>

      {needReason && (
        <div style={{ fontSize: 11, color: "#d00", textAlign: "center" }}>
          ⚠️ Para corregir un resultado, debes proporcionar una razón
        </div>
      )}
    </div>
  );
}
