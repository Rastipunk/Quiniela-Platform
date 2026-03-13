"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StructuralPicksManager } from "@/components/StructuralPicksManager";
import { NotificationBanner } from "@/components/NotificationBanner";
import { getMatchPicks, setScoringOverride, type MatchPicksResponse } from "@/lib/api";
import type { PoolOverview, PoolMatchCard, PoolFixturePhase, PhasePickConfigItem } from "@/lib/poolTypes";
import { formatPhaseName, formatPhaseFullName, isPlaceholder } from "./poolHelpers";
import { MatchCard } from "./MatchCard";
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
  notifications: any;
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
      {/* Phase Navigation Sub-tabs */}
      {phases.length > 0 && (
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
                <span>{formatPhaseName(phase.id, t)}</span>
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
      {notifications && (tabBadges.partidos > 0) && (() => {
        const bannerItems: { icon: string; message: string }[] = [];

        if (notifications.urgentDeadlines.length > 0) {
          const byPhase: Record<string, number> = {};
          for (const d of notifications.urgentDeadlines) {
            byPhase[d.phaseId] = (byPhase[d.phaseId] || 0) + 1;
          }

          const phaseDetails = Object.entries(byPhase)
            .map(([phaseId, count]) => t("notifications.countInPhase", { count, phase: formatPhaseFullName(phaseId, t) }))
            .join(", ");

          bannerItems.push({
            icon: "⏰",
            message: notifications.pendingPicks > 1
              ? t("notifications.urgentPicksPlural", { count: notifications.pendingPicks, details: phaseDetails })
              : t("notifications.urgentPicks", { count: notifications.pendingPicks, details: phaseDetails })
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
              {t("pendingPhase.title")}
            </div>
            <div style={{ fontSize: 13, color: "#856404", lineHeight: 1.6 }}>
              {t("pendingPhase.description")}
            </div>
          </div>
        </div>
      )}

      {/* Invite (Host) */}
      {overview.permissions.canInvite && (
        <div style={{ marginTop: 14, padding: 14, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontWeight: 900 }}>{t("invite.title")}</div>
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
              {busyKey === "invite" ? "..." : t("invite.createCode")}
            </button>
          </div>

          {inviteCode && (
            <div style={{ marginTop: 10, fontSize: 13 }}>
              <div style={{ color: "#666" }}>{t("invite.codeCopied")}</div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1 }}>{inviteCode}</div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Partidos - UX toolbar */}
      {!requiresStructuralPicks && (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              style={{ flex: "1 1 280px", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#444" }}>
              <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
              {t("filters.onlyOpen")}
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#444" }}>
              <input type="checkbox" checked={onlyNoPick} onChange={(e) => setOnlyNoPick(e.target.checked)} />
              {t("filters.noPick")}
            </label>
            {overview?.permissions?.canManageResults && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#444" }}>
                <input type="checkbox" checked={onlyNoResult} onChange={(e) => setOnlyNoResult(e.target.checked)} />
                {t("filters.noResult")}
              </label>
            )}
            <div style={{ fontSize: 12, color: "#666" }}>
              {t("filters.total")}: <b>{filteredMatches.length}</b> {t("filters.matches")} • {t("filters.suggestedGroup")}: <b>{nextOpenGroup}</b>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Partidos - Structural Picks Manager (SIMPLE preset) */}
      {requiresStructuralPicks && activePhaseData && activePhaseConfig && (
        <div style={{ marginTop: 14 }}>
          <StructuralPicksManager
            poolId={poolId!}
            phaseId={activePhase!}
            phaseName={activePhaseData.name}
            phaseType={activePhaseData.type as "GROUP" | "KNOCKOUT"}
            phaseConfig={activePhaseConfig as any}
            tournamentData={overview.tournamentInstance.dataJson}
            token={token!}
            isHost={overview.permissions.canManageResults}
            isLocked={getPhaseStatus(activePhase!) === "COMPLETED" || overview.myMembership.status === "LEFT"}
            matchResults={phaseMatchResults}
            onDataChanged={() => reload()}
            onShowBreakdown={() => setBreakdownModalData({
              phaseId: activePhase!,
              phaseTitle: t("breakdown.phaseTitle", { name: activePhaseData.name }),
            })}
          />
        </div>
      )}

      {/* Tab Content: Partidos - Group Tabs (hide when only SIN_GRUPO) */}
      {!requiresStructuralPicks && !(groupOrder.length === 1 && groupOrder[0] === "SIN_GRUPO") && (
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
            {t("filters.all")}
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
                {g === "SIN_GRUPO" ? t("filters.others") : t("filters.group", { name: g })}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Content: Partidos - Matches by group */}
      {!requiresStructuralPicks && (
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {groupOrder.filter(g => !selectedGroup || g === selectedGroup).map((g) => {
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
            return (
              <details
                key={g}
                open={g === nextOpenGroup}
                style={{ border: "1px solid #ddd", borderRadius: 14, background: "#fff", padding: 12 }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                  {g === "SIN_GRUPO" ? t("filters.others") : t("filters.group", { name: g })} ({matchesByGroup[g]?.length ?? 0})
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
