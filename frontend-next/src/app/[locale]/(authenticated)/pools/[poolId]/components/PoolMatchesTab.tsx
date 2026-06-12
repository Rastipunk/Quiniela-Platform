"use client";

import { colors, radii } from "@/lib/theme";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { StructuralPicksManager } from "@/components/StructuralPicksManager";
import { NotificationBanner } from "@/components/NotificationBanner";
import { getMatchPicks, setScoringOverride, type MatchPicksResponse, type PoolNotifications } from "@/lib/api";
import type { PoolOverview, PoolMatchCard, PoolFixturePhase, PhasePickConfigItem } from "@/lib/poolTypes";
import { formatPhaseName, formatPhaseFullName, isPlaceholder } from "./poolHelpers";
import { MatchCard } from "./MatchCard";
import { PendingPicksBanner } from "./PendingPicksBanner";
import { MatchPicksModal, type MatchPicksModalData } from "./MatchPicksModal";
import { ScoringOverrideModal, type ScoringOverrideModalData } from "./ScoringOverrideModal";

interface PoolMatchesTabProps {
  poolId: string;
  token: string;
  overview: PoolOverview;
  isMobile: boolean;
  busyKey: string | null;
  setBusyKey: (key: string | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  userTimezone: string | null;
  reload: () => Promise<void>;
  refetchNotifications: () => void;
  friendlyError: (e: any) => string;
  // Phase state
  phases: PoolFixturePhase[];
  activePhase: string | null;
  setActivePhase: (phase: string) => void;
  getPhaseStatus: (phaseId: string) => string;
  // Computed values
  allowScorePick: boolean;
  activePhaseConfig: PhasePickConfigItem | null;
  requiresStructuralPicks: boolean;
  activePhaseData: PoolFixturePhase | null;
  nextOpenGroup: string;
  filteredMatches: PoolMatchCard[];
  matchesByGroup: Record<string, PoolMatchCard[]>;
  groupOrder: string[];
  phaseMatchResults: Map<string, { homeGoals: number; awayGoals: number; homePenalties?: number | null; awayPenalties?: number | null }>;
  // Filter state
  search: string;
  setSearch: (s: string) => void;
  onlyOpen: boolean;
  setOnlyOpen: (v: boolean) => void;
  onlyNoPick: boolean;
  setOnlyNoPick: (v: boolean) => void;
  onlyNoResult: boolean;
  setOnlyNoResult: (v: boolean) => void;
  selectedGroup: string | null;
  setSelectedGroup: (g: string | null) => void;
  // Actions
  savePick: (matchId: string, pick: any) => Promise<void>;
  saveResult: (matchId: string, input: any) => Promise<void>;
  onCreateInvite: () => Promise<void>;
  inviteCode: string | null;
  // Notifications
  notifications: PoolNotifications | null;
  tabBadges: Record<string, number>;
  // Modals
  setBreakdownModalData: (data: any) => void;
}

export function PoolMatchesTab(props: PoolMatchesTabProps) {
  const {
    poolId,
    token,
    overview,
    isMobile,
    busyKey,
    setBusyKey,
    error,
    setError,
    userTimezone,
    reload,
    refetchNotifications,
    friendlyError,
    phases,
    activePhase,
    setActivePhase,
    getPhaseStatus,
    allowScorePick,
    activePhaseConfig,
    requiresStructuralPicks,
    activePhaseData,
    nextOpenGroup,
    filteredMatches,
    matchesByGroup,
    groupOrder,
    phaseMatchResults,
    search,
    setSearch,
    onlyOpen,
    setOnlyOpen,
    onlyNoPick,
    setOnlyNoPick,
    onlyNoResult,
    setOnlyNoResult,
    selectedGroup,
    setSelectedGroup,
    savePick,
    saveResult,
    onCreateInvite,
    inviteCode,
    notifications,
    tabBadges,
    setBreakdownModalData,
  } = props;

  const t = useTranslations("pool");

  // Match picks modal state
  const [matchPicksModal, setMatchPicksModal] = useState<MatchPicksModalData | null>(null);

  // ── Pending-picks banner + focus filter ───────────────────────
  // Matches the member can still predict, closing within 24 h, across
  // ALL phases (the banner must warn about tomorrow even while you
  // browse today's phase). Derives live from the overview, so saving a
  // pick removes its row on the next reload — and the banner vanishes
  // when nothing is pending.
  const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;
  const pendingSoon = useMemo(() => {
    const now = Date.now();
    const cfgs = overview.pool.pickTypesConfig ?? [];
    return (overview.matches as PoolMatchCard[])
      .filter((m: any) => {
        if (m.myPick || m.isLocked || !m.deadlineUtc) return false;
        if (isPlaceholder(m.homeTeam?.id ?? "") || isPlaceholder(m.awayTeam?.id ?? "")) return false;
        // Structural phases (Estratega) have no per-match picks.
        const pc = cfgs.find((p) => p.phaseId === m.phaseId);
        if (pc && !pc.requiresScore) return false;
        const deadline = new Date(m.deadlineUtc).getTime();
        return deadline > now && deadline - now <= PENDING_WINDOW_MS;
      })
      .sort((a: any, b: any) => new Date(a.deadlineUtc).getTime() - new Date(b.deadlineUtc).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview.matches, overview.pool.pickTypesConfig]);

  // Focused match (tapping a banner row): the list shows only that
  // card. Auto-clears once the pick is saved (the reload removes it
  // from pendingSoon) or if its deadline passes.
  const [focusMatchId, setFocusMatchId] = useState<string | null>(null);
  const focusedMatch = focusMatchId
    ? (overview.matches as any[]).find((m) => m.id === focusMatchId) ?? null
    : null;
  useEffect(() => {
    if (!focusMatchId) return;
    const stillPending = pendingSoon.some((m: any) => m.id === focusMatchId);
    if (!stillPending) setFocusMatchId(null);
  }, [focusMatchId, pendingSoon]);

  // Scoring override modal state
  const [scoringOverrideModal, setScoringOverrideModal] = useState<ScoringOverrideModalData | null>(null);
  const [scoringOverrideReason, setScoringOverrideReason] = useState("");
  const [scoringOverrideBusy, setScoringOverrideBusy] = useState(false);

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

  async function toggleScoringOverride() {
    if (!token || !poolId || !scoringOverrideModal) return;
    setScoringOverrideBusy(true);
    try {
      const newEnabled = !scoringOverrideModal.currentEnabled;
      await setScoringOverride(token, poolId, scoringOverrideModal.matchId, newEnabled, scoringOverrideReason || undefined);
      setScoringOverrideModal(null);
      setScoringOverrideReason("");
      await reload();
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setScoringOverrideBusy(false);
    }
  }

  return (
    <>
      {/* Phase Navigation — segmented control style (subtle, secondary level) */}
      {phases.length > 0 && (
        <div style={{
          marginTop: 12,
          display: "flex",
          gap: 0,
          overflowX: "auto",
          paddingBottom: 4,
          background: colors.bgLight,
          borderRadius: radii.lg,
          padding: 4,
          border: `1px solid ${colors.borderLight}`,
        }}>
          {phases.map((phase: any) => {
            const status = getPhaseStatus(phase.id);
            const matchCount = overview.matches.filter((m: any) => m.phaseId === phase.id).length;
            const isActive = activePhase === phase.id;
            const isLocked = status === "PENDING";

            return (
              <button
                key={phase.id}
                onClick={() => setActivePhase(phase.id)}
                style={{
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: radii.md,
                  background: isActive ? colors.white : "transparent",
                  color: isActive ? colors.brand : isLocked ? colors.textLight : colors.textMuted,
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.15s",
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  opacity: isLocked ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                <span>{formatPhaseName(phase.id, t)}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>({matchCount})</span>
                {isLocked && <span style={{ fontSize: 10 }}>🔒</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Detailed pending-picks banner: which matches, group and times.
          Tapping a row focuses that match below. */}
      <PendingPicksBanner
        matches={pendingSoon}
        tournamentKey={overview.tournamentInstance.templateKey ?? "wc_2026_sandbox"}
        userTimezone={userTimezone}
        isMobile={isMobile}
        onSelect={(matchId, phaseId) => {
          setFocusMatchId(matchId);
          if (activePhase !== phaseId) setActivePhase(phaseId);
        }}
      />

      {/* Notification Banner for Partidos tab */}
      {notifications && (tabBadges.partidos > 0) && (() => {
        const bannerItems: { icon: string; message: string }[] = [];

        // The ⏰ urgent-picks summary is superseded by the detailed
        // PendingPicksBanner above whenever it has rows — only fall
        // back to the counter when our client-side list is empty
        // (e.g. timezone edge where backend and client windows differ).
        if (notifications.urgentDeadlines.length > 0 && pendingSoon.length === 0) {
          const byPhase: Record<string, number> = {};
          for (const d of notifications.urgentDeadlines) {
            byPhase[d.phaseId] = (byPhase[d.phaseId] || 0) + 1;
          }

          const phaseDetails = Object.entries(byPhase)
            .map(([phaseId, count]) => t("notifications.countInPhase", { count, phase: formatPhaseFullName(phaseId, t) }))
            .join(", ");

          // pendingPicks ahora es el TOTAL de unidades (ADR-070) — este
          // item solo cubre picks de partido, usar su conteo propio.
          const matchPickCount = notifications.pendingMatchPicks ?? notifications.pendingPicks;
          bannerItems.push({
            icon: "⏰",
            message: matchPickCount > 1
              ? t("notifications.urgentPicksPlural", { count: matchPickCount, details: phaseDetails })
              : t("notifications.urgentPicks", { count: matchPickCount, details: phaseDetails })
          });
        }

        // Estratega: grupos sin guardar con cierre próximo (ADR-070)
        const urgentGroups = notifications.urgentGroups ?? [];
        if (urgentGroups.length > 0) {
          const groupCount = notifications.pendingGroupPicks ?? urgentGroups.length;
          const groupList = urgentGroups.map((g) => g.groupId).join(", ");
          bannerItems.push({
            icon: "📋",
            message: groupCount > 1
              ? t("notifications.urgentGroupsPlural", { count: groupCount, groups: groupList })
              : t("notifications.urgentGroups", { count: groupCount, groups: groupList })
          });
        }

        // Estratega: eliminatorias sin ganador con cierre próximo (ADR-070)
        const urgentKnockouts = notifications.urgentKnockouts ?? [];
        if (urgentKnockouts.length > 0) {
          const knockoutCount = notifications.pendingKnockoutPicks ?? urgentKnockouts.length;
          const byPhase: Record<string, number> = {};
          for (const d of urgentKnockouts) {
            byPhase[d.phaseId] = (byPhase[d.phaseId] || 0) + 1;
          }
          const phaseDetails = Object.entries(byPhase)
            .map(([phaseId, count]) => t("notifications.countInPhase", { count, phase: formatPhaseFullName(phaseId, t) }))
            .join(", ");
          bannerItems.push({
            icon: "🏆",
            message: knockoutCount > 1
              ? t("notifications.urgentKnockoutsPlural", { count: knockoutCount, details: phaseDetails })
              : t("notifications.urgentKnockouts", { count: knockoutCount, details: phaseDetails })
          });
        }

        if (notifications.isHostOrCoAdmin && notifications.pendingResults > 0) {
          bannerItems.push({
            icon: "📝",
            message: notifications.pendingResults > 1
              ? t("notifications.pendingResultsPlural", { count: notifications.pendingResults })
              : t("notifications.pendingResults", { count: notifications.pendingResults })
          });
        }

        return bannerItems.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <NotificationBanner items={bannerItems} />
          </div>
        ) : null;
      })()}

      {/* Phase Status Banner (for pending phases) */}
      {activePhase && getPhaseStatus(activePhase) === "PENDING" && (
        <div style={{
          marginTop: 14,
          padding: 16,
          background: colors.warningBg,
          border: "1px solid #ffeeba",
          borderRadius: 12,
          display: "flex",
          alignItems: "start",
          gap: 12
        }}>
          <span style={{ fontSize: 24 }}>⏳</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: colors.warningDark, marginBottom: 4 }}>
              {t("pendingPhase.title")}
            </div>
            <div style={{ fontSize: 13, color: colors.warningDark, lineHeight: 1.6 }}>
              {t("pendingPhase.description")}
            </div>
          </div>
        </div>
      )}

      {/* Invite section moved to pool page header */}

      {/* Tab Content: Partidos - Collapsible filters */}
      {!requiresStructuralPicks && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: colors.textMuted, padding: "8px 0", display: "flex", alignItems: "center", gap: 6 }}>
            {"\uD83D\uDD0D"} {t("filters.title", { defaultMessage: "Filtros" })} ({filteredMatches.length} {t("filters.matches")})
          </summary>
          <div style={{ padding: 12, border: `1px solid ${colors.borderLight}`, borderRadius: 12, background: colors.white, marginTop: 4 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                style={{ flex: "1 1 280px", padding: 10, borderRadius: 12, border: `1px solid ${colors.borderLight}` }}
              />
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: colors.textDark }}>
                <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
                {t("filters.onlyOpen")}
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: colors.textDark }}>
                <input type="checkbox" checked={onlyNoPick} onChange={(e) => setOnlyNoPick(e.target.checked)} />
                {t("filters.noPick")}
              </label>
              {overview?.permissions?.canManageResults && (
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: colors.textDark }}>
                  <input type="checkbox" checked={onlyNoResult} onChange={(e) => setOnlyNoResult(e.target.checked)} />
                  {t("filters.noResult")}
                </label>
              )}
            </div>
          </div>
        </details>
      )}

      {/* Tab Content: Partidos - Structural Picks Manager (SIMPLE preset) */}
      {requiresStructuralPicks && activePhaseData && activePhaseConfig && (
        <div style={{ marginTop: 14 }}>
          <StructuralPicksManager
            poolId={poolId!}
            phaseId={activePhase!}
            phaseName={formatPhaseFullName(activePhase!, t)}
            phaseType={activePhaseData.type as "GROUP" | "KNOCKOUT"}
            phaseConfig={activePhaseConfig as any}
            tournamentData={overview.tournamentInstance.dataJson}
            token={token!}
            isHost={overview.permissions.canManageResults}
            isLocked={getPhaseStatus(activePhase!) === "COMPLETED" || overview.myMembership.status === "LEFT"}
            deadlineMinutesBeforeKickoff={overview.pool.deadlineMinutesBeforeKickoff}
            userTimezone={userTimezone}
            matchResults={phaseMatchResults}
            onDataChanged={() => reload()}
            onShowBreakdown={() => setBreakdownModalData({
              phaseId: activePhase!,
              phaseTitle: t("breakdown.phaseTitle", { name: formatPhaseFullName(activePhase!, t) }),
            })}
          />
        </div>
      )}

      {/* Group selector removed — collapsed group cards below serve as both selector and content */}

      {/* Focused mode: a banner row was tapped — show ONLY that match
          with a clear way back. Clears itself when the pick is saved. */}
      {!requiresStructuralPicks && focusedMatch && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "10px 12px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 12,
            flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>
              🎯 {t("pendingPicks.focusChip")}
            </span>
            <button
              onClick={() => setFocusMatchId(null)}
              style={{
                padding: "8px 12px",
                minHeight: 44,
                border: "1px solid #93c5fd",
                borderRadius: 8,
                background: colors.white,
                color: "#1d4ed8",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ✕ {t("pendingPicks.showAllMatches")}
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <MatchCard
              match={focusedMatch}
              overview={overview}
              isMobile={isMobile}
              busyPick={busyKey === `pick:${focusedMatch.id}`}
              busyRes={busyKey === `res:${focusedMatch.id}`}
              userTimezone={userTimezone}
              allowScorePick={allowScorePick}
              savePick={(pick) => savePick(focusedMatch.id, pick)}
              saveResult={(input) => saveResult(focusedMatch.id, input)}
              onViewBreakdown={(matchId, matchTitle) => setBreakdownModalData({ matchId, matchTitle })}
              onViewMatchPicks={(matchId, matchTitle) => loadMatchPicks(matchId, matchTitle)}
              onToggleScoring={(matchId, matchTitle, currentEnabled) => {
                setScoringOverrideModal({ matchId, matchTitle, currentEnabled });
                setScoringOverrideReason("");
              }}
            />
          </div>
        </div>
      )}

      {/* Tab Content: Partidos - Matches by group (each group is a collapsible card) */}
      {!requiresStructuralPicks && !focusedMatch && (
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          {groupOrder.map((g) => {
            const noGroups = groupOrder.length === 1 && groupOrder[0] === "SIN_GRUPO";
            const matchList = (
              <div key={g} style={noGroups ? { display: "grid", gap: 12 } : { marginTop: 12, display: "grid", gap: 12 }}>
                {matchesByGroup[g].map((m: any) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    overview={overview}
                    isMobile={isMobile}
                    busyPick={busyKey === `pick:${m.id}`}
                    busyRes={busyKey === `res:${m.id}`}
                    userTimezone={userTimezone}
                    allowScorePick={allowScorePick}
                    savePick={(pick) => savePick(m.id, pick)}
                    saveResult={(input) => saveResult(m.id, input)}
                    onViewBreakdown={(matchId, matchTitle) => setBreakdownModalData({ matchId, matchTitle })}
                    onViewMatchPicks={(matchId, matchTitle) => loadMatchPicks(matchId, matchTitle)}
                    onToggleScoring={(matchId, matchTitle, currentEnabled) => {
                      setScoringOverrideModal({ matchId, matchTitle, currentEnabled });
                      setScoringOverrideReason("");
                    }}
                  />
                ))}
              </div>
            );
            if (noGroups) return matchList;
            // Each group as collapsible card (single source of truth for grouping)
            return (
              <details
                key={g}
                style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 14, background: colors.white, padding: "10px 14px" }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, color: colors.textDark, listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{g === "SIN_GRUPO" ? t("filters.others") : t("filters.group", { name: g })}</span>
                  <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500 }}>{t("filters.matchesCount", { count: matchesByGroup[g]?.length ?? 0 })}</span>
                </summary>
                {matchList}
              </details>
            );
          })}
        </div>
      )}

      {/* Scoring Override Modal */}
      {scoringOverrideModal && (
        <ScoringOverrideModal
          data={scoringOverrideModal}
          reason={scoringOverrideReason}
          onReasonChange={setScoringOverrideReason}
          onConfirm={toggleScoringOverride}
          onClose={() => { setScoringOverrideModal(null); setScoringOverrideReason(""); }}
          busy={scoringOverrideBusy}
        />
      )}

      {/* Match Picks Modal */}
      {matchPicksModal && (
        <MatchPicksModal
          data={matchPicksModal}
          onClose={() => setMatchPicksModal(null)}
        />
      )}
    </>
  );
}
