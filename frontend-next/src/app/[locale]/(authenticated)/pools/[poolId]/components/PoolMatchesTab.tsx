"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TeamFlag } from "@/components/TeamFlag";
import { getTeamFlag, getCountryName } from "@/data/teamFlags";
import { StructuralPicksManager } from "@/components/StructuralPicksManager";
import { NotificationBanner } from "@/components/NotificationBanner";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { getMatchPicks, setScoringOverride, type PoolOverview, type MatchPicksResponse } from "@/lib/api";
import { fmtUtc, formatPhaseName, formatPhaseFullName, isPlaceholder, getPlaceholderName } from "./poolHelpers";
import type { BreakdownModalData } from "./poolTypes";

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
  phases: any[];
  activePhase: string | null;
  setActivePhase: (phase: string) => void;
  getPhaseStatus: (phaseId: string) => string;
  // Computed values
  allowScorePick: boolean;
  activePhaseConfig: any;
  requiresStructuralPicks: boolean;
  activePhaseData: any;
  nextOpenGroup: string;
  filteredMatches: any[];
  matchesByGroup: Record<string, any[]>;
  groupOrder: string[];
  phaseMatchResults: Map<string, any>;
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
  const verbose = false;

  // Match picks modal state
  const [matchPicksModal, setMatchPicksModal] = useState<{
    matchId: string;
    matchTitle: string;
    picks: MatchPicksResponse | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  // Scoring override modal state
  const [scoringOverrideModal, setScoringOverrideModal] = useState<{
    matchId: string;
    matchTitle: string;
    currentEnabled: boolean;
  } | null>(null);
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

        // Agrupar partidos urgentes por fase
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
            phaseType={activePhaseData.type}
            phaseConfig={activePhaseConfig}
            tournamentData={(overview.tournamentInstance as any).dataJson}
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
                      <div style={{ display: "flex", justifyContent: "space-between", gap: isMobile ? 8 : 16, alignItems: "center", marginBottom: isMobile ? 10 : 16, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                          {/* Home team - flag on left or placeholder */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {homeIsPlaceholder ? (
                              <>
                                <div style={{ width: 32, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#e9ecef", borderRadius: 2, border: "1px solid #ced4da" }}>
                                  <span style={{ fontSize: 14 }}>🔒</span>
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 500, color: "#6c757d", fontStyle: "italic" }}>
                                  {getPlaceholderName(m.homeTeam.id, t)}
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
                                  {getPlaceholderName(m.awayTeam.id, t)}
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

                        <div style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          {m.isLocked ? (
                            <span style={{ padding: "4px 10px", border: "1px solid #f99", borderRadius: 999, background: "#fee" }}>
                              🔒 {t("matchCard.locked")}
                            </span>
                          ) : (
                            <span style={{ padding: "4px 10px", border: "1px solid #9f9", borderRadius: 999, background: "#efe" }}>
                              ✅ {t("matchCard.open")}
                            </span>
                          )}
                          {m.scoringEnabled === false && (
                            <span style={{ padding: "4px 10px", border: "1px solid #fbbf24", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
                              ⚠️ {t("scoringDisabledBadge")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Match Info: kickoff + deadline */}
                      <div style={{ color: "#666", fontSize: 12, marginBottom: 12, paddingLeft: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                        <div>
                          {m.label ?? m.roundLabel ?? t("matchCard.matchLabel", { id: m.matchNumber ?? m.id })} • {t("matchCard.kickoff")}: {fmtUtc(m.kickoffUtc, userTimezone)}
                        </div>
                        <div style={{ color: m.isLocked ? "#999" : "#c0392b" }}>
                          {t("matchCard.deadline")}: {fmtUtc(m.deadlineUtc, userTimezone)}
                        </div>
                      </div>

                      {/* Scoring disabled banner */}
                      {m.scoringEnabled === false && (
                        <div style={{
                          padding: "8px 12px",
                          background: "#fef3c7",
                          border: "1px solid #fbbf24",
                          borderRadius: 8,
                          marginBottom: 10,
                          fontSize: 13,
                          color: "#92400e",
                        }}>
                          ⚠️ {t("scoringDisabledByHost")}
                          {m.scoringOverrideReason && (
                            <span style={{ fontStyle: "italic" }}> — {m.scoringOverrideReason}</span>
                          )}
                        </div>
                      )}

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
                            {t("matchCard.pendingTitle")}
                          </div>
                          <div style={{ fontSize: 13, color: "#856404" }}>
                            {t("matchCard.pendingDesc")}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                          {/* Pick */}
                          <PickSection
                            pick={m.myPick}
                            isLocked={m.isLocked || overview.myMembership.status === "LEFT"}
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
                                padding: isMobile ? "10px 16px" : "6px 12px",
                                borderRadius: 6,
                                border: "none",
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                color: "white",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                                minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                                ...mobileInteractiveStyles.tapHighlight,
                              }}
                            >
                              {t("matchCard.viewBreakdown")}
                            </button>
                          )}

                          {/* Botón Ver picks de otros */}
                          <button
                            onClick={() => loadMatchPicks(
                              m.id,
                              `${getCountryName(m.homeTeam?.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")} vs ${getCountryName(m.awayTeam?.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")}`
                            )}
                            style={{
                              padding: isMobile ? "10px 16px" : "6px 12px",
                              borderRadius: 6,
                              border: "1px solid #17a2b8",
                              background: "#e7f6f8",
                              color: "#17a2b8",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                              ...mobileInteractiveStyles.tapHighlight,
                            }}
                          >
                            {t("matchCard.viewOtherPicks")}
                          </button>

                          {/* Host: Toggle scoring for this match */}
                          {isHost && (
                            <button
                              onClick={() => {
                                const matchTitle = `${getCountryName(m.homeTeam?.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")} vs ${getCountryName(m.awayTeam?.id, overview.tournamentInstance.templateKey ?? "wc_2026_sandbox")}`;
                                setScoringOverrideModal({
                                  matchId: m.id,
                                  matchTitle,
                                  currentEnabled: m.scoringEnabled !== false,
                                });
                                setScoringOverrideReason("");
                              }}
                              style={{
                                padding: isMobile ? "10px 16px" : "6px 12px",
                                borderRadius: 6,
                                border: `1px solid ${m.scoringEnabled !== false ? "#fbbf24" : "#10b981"}`,
                                background: m.scoringEnabled !== false ? "#fef9c3" : "#d1fae5",
                                color: m.scoringEnabled !== false ? "#92400e" : "#065f46",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                                minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                                ...mobileInteractiveStyles.tapHighlight,
                              }}
                            >
                              {m.scoringEnabled !== false ? t("scoringDisabled") : t("scoringEnabled")}
                            </button>
                          )}
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
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => { setScoringOverrideModal(null); setScoringOverrideReason(""); }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>
              {t("scoringToggle")}
            </h3>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "#555" }}>
              <strong>{scoringOverrideModal.matchTitle}</strong>
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#666" }}>
              {scoringOverrideModal.currentEnabled
                ? t("scoringDisableConfirm")
                : t("scoringEnableConfirm")}
            </p>
            {scoringOverrideModal.currentEnabled && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: "#666", display: "block", marginBottom: 4 }}>
                  {t("scoringDisableReason")}
                </label>
                <input
                  type="text"
                  value={scoringOverrideReason}
                  onChange={(e) => setScoringOverrideReason(e.target.value)}
                  maxLength={500}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                  placeholder={t("scoringDisableReason")}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setScoringOverrideModal(null); setScoringOverrideReason(""); }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {t("cancel")}
              </button>
              <button
                onClick={toggleScoringOverride}
                disabled={scoringOverrideBusy}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: scoringOverrideModal.currentEnabled ? "#f59e0b" : "#10b981",
                  color: "#fff",
                  cursor: scoringOverrideBusy ? "wait" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  opacity: scoringOverrideBusy ? 0.7 : 1,
                }}
              >
                {scoringOverrideBusy ? "..." : scoringOverrideModal.currentEnabled ? t("scoringDisabled") : t("scoringEnabled")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Picks Modal */}
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
                {t("matchPicks.title")}: {matchPicksModal.matchTitle}
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
                  {t("matchPicks.loading")}
                </div>
              )}
              {matchPicksModal.error && (
                <div style={{ textAlign: "center", padding: 20, color: "#dc3545" }}>
                  {t("matchPicks.error")}: {matchPicksModal.error}
                </div>
              )}
              {matchPicksModal.picks && !matchPicksModal.picks.isUnlocked && (
                <div style={{ textAlign: "center", padding: 20, color: "#856404", background: "#fff3cd", borderRadius: 8 }}>
                  {t("matchPicks.notUnlocked")}
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
                            {t("matchPicks.you")}
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
                              {p.pick.outcome === "HOME" ? t("matchPicks.home") : p.pick.outcome === "DRAW" ? t("matchPicks.drawLabel") : t("matchPicks.away")}
                            </span>
                          ) : (
                            <span style={{ color: "#666" }}>{JSON.stringify(p.pick)}</span>
                          )
                        ) : (
                          <span style={{ color: "#dc3545", fontWeight: 500 }}>{t("matchPicks.noPick")}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {matchPicksModal.picks && matchPicksModal.picks.picks.length === 0 && !matchPicksModal.loading && (
                <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
                  {t("matchPicks.empty")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
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
  const t = useTranslations("pool");
  const [editMode, setEditMode] = useState(false);

  const hasPick = !!props.pick;
  const _pickType = props.pick?.type;
  void _pickType; // Reserved for future pick type display

  // Si está locked o no hay pick, no puede editar
  const _canEdit = !props.isLocked;
  void _canEdit; // Used implicitly through !props.isLocked checks

  return (
    <div style={{ border: "1px solid #f2f2f2", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#555" }}>{t("pick.myPick")}</div>

      {props.isLocked && !hasPick && (
        <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>🔒 {t("pick.noPick")}</div>
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
            ✏️ {t("pick.modify")}
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
        <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>{t("pick.noPickYet")}</div>
      )}
    </div>
  );
}

function PickDisplay(props: { pick: any; homeTeam: any; awayTeam: any; tournamentKey: string }) {
  const t = useTranslations("pool");
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
      HOME: `🏠 ${t("pick.homeWin")}`,
      DRAW: `🤝 ${t("pick.draw")}`,
      AWAY: `🚪 ${t("pick.awayWin")}`,
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
  const t = useTranslations("pool");
  const isMobile = useIsMobile();
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
              style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: isMobile ? 16 : 22, fontWeight: 700, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
            />
            <span style={{ fontWeight: 900, fontSize: 18, color: "#666" }}>-</span>
            <input
              type="number" min={0} value={awayGoals} onChange={(e) => setAwayGoals(e.target.value)} placeholder="0"
              style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: isMobile ? 16 : 22, fontWeight: 700, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
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
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", fontSize: isMobile ? 16 : 14, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
        >
          <option value="">{t("pick.selectPlaceholder")}</option>
          <option value="HOME">🏠 {t("pick.homeWin")}</option>
          <option value="DRAW">🤝 {t("pick.draw")}</option>
          <option value="AWAY">🚪 {t("pick.awayWin")}</option>
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
            minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
            ...mobileInteractiveStyles.tapHighlight,
          }}
        >
          {props.disabled ? "..." : `💾 ${t("pick.save")}`}
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
              minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {t("pick.cancel")}
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
  const t = useTranslations("pool");
  const [editMode, setEditMode] = useState(false);

  const hasResult = !!props.result;

  return (
    <div style={{ border: "1px solid #f2f2f2", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#555" }}>{t("result.title")}</div>

      {!hasResult && !editMode && (
        <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>
          {props.isHost ? t("result.noResultHost") : t("result.noResultPlayer")}
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
              ✏️ {t("result.correctResult")}
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
  const t = useTranslations("pool");
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
            ⚽ {t("result.penalties")}
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
              ? `✅ ${t("result.teamWins", { team: homeName })}`
              : `✅ ${t("result.teamWins", { team: awayName })}`}
          </div>
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 10, color: "#999", textAlign: "center" }}>
        {t("result.officialResult")}{result.version > 1 ? ` (v${result.version})` : ""}
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
          <b>{t("result.correctionLabel")}:</b> {result.reason}
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
  const t = useTranslations("pool");
  const isMobile = useIsMobile();
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
            style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: isMobile ? 16 : 22, fontWeight: 700, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
          />
          <span style={{ fontWeight: 900, fontSize: 18, color: "#666" }}>-</span>
          <input
            type="number" min={0} value={awayGoals} onChange={(e) => setAwayGoals(e.target.value)} placeholder="0"
            style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: isMobile ? 16 : 22, fontWeight: 700, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
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
            ⚠️ {t("result.penaltiesRequired")}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#666" }}>{t("result.penaltiesLabel", { team: homeName })}</span>
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
              <span style={{ fontSize: 10, color: "#666" }}>{t("result.penaltiesLabel", { team: awayName })}</span>
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
          placeholder={`⚠️ ${t("result.correctionPlaceholder")}`}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", fontSize: isMobile ? 16 : 13, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
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
            minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
            ...mobileInteractiveStyles.tapHighlight,
          }}
        >
          {props.disabled ? "..." : props.requireReason ? `📝 ${t("result.publishCorrection")}` : `📢 ${t("result.publishResult")}`}
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
              minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {t("result.cancel")}
          </button>
        )}
      </div>

      {needReason && (
        <div style={{ fontSize: 11, color: "#d00", textAlign: "center" }}>
          ⚠️ {t("result.correctionRequired")}
        </div>
      )}
    </div>
  );
}
