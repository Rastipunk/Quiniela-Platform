"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updatePoolSettings, manualAdvancePhase, lockPhase, archivePool, promoteMemberToCoAdmin, demoteMemberFromCoAdmin, getPendingMembers, approveMember, rejectMember, kickMember, banMember } from "@/lib/api";
import { NotificationBanner } from "@/components/NotificationBanner";
import CapacitySelector from "@/components/CapacitySelector";
import type { PoolTabBaseProps, PhaseData, ExpulsionModalData } from "./poolTypes";
import { fmtUtc, formatPhaseFullName } from "./poolHelpers";

interface PoolAdminTabProps extends PoolTabBaseProps {
  phases: PhaseData[];
  getPhaseStatus: (phaseId: string) => string;
  hasPhaseAdvanced: (phaseId: string) => boolean;
  nextPhaseMap: Record<string, string | null>;
  notifications: any;
  tabBadges: Record<string, number>;
  pendingMembers: any[];
  loadPendingMembers: () => Promise<void>;
}

export function PoolAdminTab({
  poolId, token, overview, isMobile, busyKey, setBusyKey, error, setError,
  userTimezone, reload, refetchNotifications, friendlyError,
  phases, getPhaseStatus, hasPhaseAdvanced, nextPhaseMap,
  notifications, tabBadges, pendingMembers, loadPendingMembers,
}: PoolAdminTabProps) {
  const t = useTranslations("pool");
  const verbose = false;

  const [expulsionModalData, setExpulsionModalData] = useState<ExpulsionModalData | null>(null);

  return (
    <div style={{ marginTop: 14, padding: 20, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, marginBottom: 16 }}>⚙️ {t("admin.title")}</h3>

      {/* Notification Banner for Admin tab */}
      {notifications && (tabBadges.admin > 0) && (() => {
        const bannerItems: { icon: string; message: string }[] = [];

        if (notifications.pendingJoins > 0) {
          bannerItems.push({
            icon: "👤",
            message: notifications.pendingJoins > 1
              ? t("admin.notifications.pendingJoinsPlural", { count: notifications.pendingJoins })
              : t("admin.notifications.pendingJoins", { count: notifications.pendingJoins })
          });
        }

        if (notifications.phasesReadyToAdvance.length > 0) {
          bannerItems.push({
            icon: "🚀",
            message: notifications.phasesReadyToAdvance.length > 1
              ? t("admin.notifications.phasesReadyPlural", { count: notifications.phasesReadyToAdvance.length })
              : t("admin.notifications.phasesReady", { count: notifications.phasesReadyToAdvance.length })
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
          🤖 {t("admin.autoAdvance.title")}
        </h4>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: "#666", marginBottom: 12 }}>
          {t("admin.autoAdvance.description")}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #dee2e6" }}>
          <div
            onClick={async () => {
              if (busyKey === "auto-advance-toggle" || !token || !poolId) return;
              setBusyKey("auto-advance-toggle");
              setError(null);
              try {
                const newValue = !overview.pool.autoAdvanceEnabled;
                await updatePoolSettings(token, poolId, { autoAdvanceEnabled: newValue });
                await reload();
              } catch (err: any) {
                console.error('[TOGGLE] Error:', err);
                setError(friendlyError(err));
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
              {overview.pool.autoAdvanceEnabled ? `✅ ${t("admin.autoAdvance.enabled")}` : `❌ ${t("admin.autoAdvance.disabled")}`}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {overview.pool.autoAdvanceEnabled
                ? t("admin.autoAdvance.enabledDesc")
                : t("admin.autoAdvance.disabledDesc")}
            </div>
          </div>
        </label>
      </div>

      {/* Require Approval Configuration */}
      <div style={{ marginBottom: 24, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
          🔐 {t("admin.approval.title")}
        </h4>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: "#666", marginBottom: 12 }}>
          {t("admin.approval.description")}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #dee2e6" }}>
          <div
            onClick={async () => {
              if (busyKey === "require-approval-toggle" || !token || !poolId) return;
              setBusyKey("require-approval-toggle");
              setError(null);
              try {
                const newValue = !overview.pool.requireApproval;
                await updatePoolSettings(token, poolId, { requireApproval: newValue });
                await reload();
              } catch (err: any) {
                setError(friendlyError(err));
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
              {overview.pool.requireApproval ? `✅ ${t("admin.approval.required")}` : `❌ ${t("admin.approval.direct")}`}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {overview.pool.requireApproval
                ? t("admin.approval.requiredDesc")
                : t("admin.approval.directDesc")}
            </div>
          </div>
        </label>
      </div>

      {/* Extra Time Configuration */}
      {overview.pool.pickTypesConfig && (() => {
        const ptc = overview.pool.pickTypesConfig as any[];
        const scoringPhases = ptc.filter((pc: any) => pc.requiresScore);
        if (scoringPhases.length === 0) return null;

        const now = Date.now();
        const deadlineMinutes = overview.pool.deadlineMinutesBeforeKickoff ?? 10;

        return (
          <div style={{ marginBottom: 24, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#007bff" }}>
              {"⏱️"} {t("admin.extraTime.title")}
            </h4>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#666", marginBottom: 14 }}>
              {t("admin.extraTime.description")}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {scoringPhases.map((pc: any) => {
                const phase = phases.find((p: any) => p.id === pc.phaseId);
                const phaseName = phase ? formatPhaseFullName(pc.phaseId, t) : pc.phaseName;
                const phaseMatches = overview.matches.filter((m: any) => m.phaseId === pc.phaseId);
                const matchesWithResult = phaseMatches.filter((m: any) => m.result);
                const includeET = pc.includeExtraTime ?? false;

                let locked = false;
                let lockReason = "";

                if (matchesWithResult.length > 0) {
                  locked = true;
                  lockReason = matchesWithResult.length === phaseMatches.length
                    ? t("admin.extraTime.lockedCompleted")
                    : t("admin.extraTime.lockedOldResults");
                }

                if (!locked && phaseMatches.length > 0) {
                  const kickoffs = phaseMatches
                    .filter((m: any) => m.kickoffUtc)
                    .map((m: any) => new Date(m.kickoffUtc).getTime() - deadlineMinutes * 60_000);
                  if (kickoffs.length > 0) {
                    const firstDeadline = Math.min(...kickoffs);
                    const hoursUntil = (firstDeadline - now) / (1000 * 60 * 60);
                    if (hoursUntil < 48) {
                      locked = true;
                      lockReason = t("admin.extraTime.lockedDeadline");
                    }
                  }
                }

                return (
                  <div
                    key={pc.phaseId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: "#fff",
                      borderRadius: 8,
                      border: "1px solid #dee2e6",
                      opacity: locked ? 0.7 : 1,
                    }}
                  >
                    <div
                      onClick={async () => {
                        if (locked || busyKey === `et-${pc.phaseId}` || !token || !poolId) return;
                        setBusyKey(`et-${pc.phaseId}`);
                        setError(null);
                        try {
                          const currentEtPhases = (overview.pool.pickTypesConfig as any[])
                            .filter((p: any) => p.includeExtraTime)
                            .map((p: any) => p.phaseId);
                          const newEtPhases = includeET
                            ? currentEtPhases.filter((id: string) => id !== pc.phaseId)
                            : [...currentEtPhases, pc.phaseId];
                          await updatePoolSettings(token, poolId, { extraTimePhases: newEtPhases });
                          await reload();
                        } catch (err: any) {
                          setError(friendlyError(err));
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                      style={{
                        position: "relative",
                        width: 40,
                        height: 20,
                        borderRadius: 10,
                        background: locked ? "#aaa" : includeET ? "#007bff" : "#ccc",
                        cursor: locked ? "not-allowed" : busyKey === `et-${pc.phaseId}` ? "wait" : "pointer",
                        transition: "background 0.3s ease",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 2,
                          left: includeET ? 22 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "#fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          transition: "left 0.3s ease",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#333" }}>
                        {phaseName}
                      </div>
                      <div style={{ fontSize: 11, color: locked ? "#999" : "#666", marginTop: 1 }}>
                        {locked
                          ? lockReason
                          : includeET
                            ? t("admin.extraTime.labelET")
                            : t("admin.extraTime.label90")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Phase Status Panel */}
      <div style={{ marginBottom: 24, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
          📊 {t("admin.phasePanel.title")}
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
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#333" }}>{formatPhaseFullName(phase.id, t)}</span>
                    <span style={{
                      padding: "2px 8px",
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: colors.text
                    }}>
                      {status === "PENDING" && t("phaseStatus.PENDING")}
                      {status === "ACTIVE" && t("phaseStatus.ACTIVE")}
                      {status === "COMPLETED" && t("phaseStatus.COMPLETED")}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {t("admin.phasePanel.matchesProgress", { completed: completedMatches, total: totalMatches, percent: progress.toFixed(0) })}
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
                    {!hasPhaseAdvanced(phase.id) && nextPhaseMap[phase.id] && (
                      <button
                        disabled={busyKey === `advance:${phase.id}`}
                        onClick={async () => {
                          if (!token || !poolId) return;
                          setBusyKey(`advance:${phase.id}`);
                          setError(null);
                          try {
                            const result = await manualAdvancePhase(token, poolId, phase.id);
                            await reload();
                            alert(`✅ ${t("admin.phasePanel.advanceSuccess")}: ${result.message || ''}`);
                          } catch (err: any) {
                            setError(friendlyError(err));
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
                        {busyKey === `advance:${phase.id}` ? `⏳ ${t("admin.phasePanel.advancing")}` : `🚀 ${t("admin.phasePanel.advanceButton")}`}
                      </button>
                    )}
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
                        ✓ {t("admin.phasePanel.alreadyAdvanced")}
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
                          await reload();
                          alert(isCurrentlyLocked ? `✅ ${t("admin.phasePanel.phaseUnlocked")}` : `🔒 ${t("admin.phasePanel.phaseLocked")}`);
                        } catch (err: any) {
                          setError(friendlyError(err));
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
                        ? `⏳ ${t("admin.phasePanel.processing")}`
                        : (overview.pool.lockedPhases || []).includes(phase.id)
                          ? `🔓 ${t("admin.phasePanel.unlockButton")}`
                          : `🔒 ${t("admin.phasePanel.lockButton")}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Join Requests Section */}
      {overview.permissions.canManageResults && pendingMembers.length > 0 && (
        <div style={{ marginBottom: 24, padding: 16, background: "#fff3cd", borderRadius: 12, border: "1px solid #ffc107" }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#856404" }}>
            🔔 {t("admin.pendingRequests.title", { count: pendingMembers.length })}
          </h4>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "#856404", marginBottom: 12 }}>
            {t("admin.pendingRequests.description")}
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
                    {t("admin.pendingRequests.requestedAt")}: {fmtUtc(member.requestedAt, userTimezone)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={async () => {
                      if (busyKey === `approve-${member.id}` || !token || !poolId) return;
                      if (!window.confirm(t("admin.pendingRequests.approveConfirm", { name: member.displayName }))) return;

                      setBusyKey(`approve-${member.id}`);
                      setError(null);
                      try {
                        await approveMember(token, poolId, member.id);
                        await loadPendingMembers();
                        await reload();
                        refetchNotifications();
                      } catch (err: any) {
                        setError(friendlyError(err));
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
                    ✅ {t("admin.pendingRequests.approveButton")}
                  </button>

                  <button
                    onClick={async () => {
                      if (busyKey === `reject-${member.id}` || !token || !poolId) return;
                      const reason = window.prompt(t("admin.pendingRequests.rejectPrompt", { name: member.displayName }));
                      if (reason === null) return;

                      setBusyKey(`reject-${member.id}`);
                      setError(null);
                      try {
                        await rejectMember(token, poolId, member.id, reason || undefined);
                        await loadPendingMembers();
                        refetchNotifications();
                      } catch (err: any) {
                        setError(friendlyError(err));
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
                    ❌ {t("admin.pendingRequests.rejectButton")}
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
            👥 {t("admin.members.title")}
          </h4>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "#666", marginBottom: 12 }}>
            {t("admin.members.description")}
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
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#007bff20", border: "1px solid #007bff", color: "#007bff", fontWeight: 600 }}>
                          👑 HOST
                        </span>
                      )}
                      {isCoAdmin && (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#28a74520", border: "1px solid #28a745", color: "#28a745", fontWeight: 600 }}>
                          ⭐ CO-ADMIN
                        </span>
                      )}
                      {isPlayer && (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#6c757d20", border: "1px solid #6c757d", color: "#6c757d", fontWeight: 600 }}>
                          PLAYER
                        </span>
                      )}
                      {member.memberStatus === "LEFT" && (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#ef444420", border: "1px solid #ef4444", color: "#ef4444", fontWeight: 600 }}>
                          {t("mobileLeaderboard.retired")}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: "#999" }}>
                        {member.points} {t("admin.members.pts")}
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
                            const confirmed = window.confirm(t("admin.members.promoteConfirm", { name: member.displayName }));
                            if (!confirmed) return;
                            setBusyKey(`promote:${member.userId}`);
                            setError(null);
                            try {
                              await promoteMemberToCoAdmin(token, poolId, member.memberId);
                              await reload();
                              alert(`✅ ${t("admin.members.promoteSuccess", { name: member.displayName })}`);
                            } catch (err: any) {
                              setError(friendlyError(err));
                            } finally {
                              setBusyKey(null);
                            }
                          }}
                          style={{
                            padding: "6px 12px", borderRadius: 6, border: "1px solid #28a745",
                            background: busyKey === `promote:${member.userId}` ? "#ccc" : "#28a745",
                            color: "#fff", cursor: busyKey === `promote:${member.userId}` ? "wait" : "pointer",
                            fontSize: 12, fontWeight: 600, whiteSpace: "nowrap"
                          }}
                        >
                          {busyKey === `promote:${member.userId}` ? "⏳" : `⬆️ ${t("admin.members.promoteButton")}`}
                        </button>
                      )}

                      {isCoAdmin && (
                        <button
                          disabled={busyKey === `demote:${member.userId}`}
                          onClick={async () => {
                            if (!token || !poolId || busyKey) return;
                            const confirmed = window.confirm(t("admin.members.demoteConfirm", { name: member.displayName }));
                            if (!confirmed) return;
                            setBusyKey(`demote:${member.userId}`);
                            setError(null);
                            try {
                              await demoteMemberFromCoAdmin(token, poolId, member.memberId);
                              await reload();
                              alert(`✅ ${t("admin.members.demoteSuccess", { name: member.displayName })}`);
                            } catch (err: any) {
                              setError(friendlyError(err));
                            } finally {
                              setBusyKey(null);
                            }
                          }}
                          style={{
                            padding: "6px 12px", borderRadius: 6, border: "1px solid #dc3545",
                            background: busyKey === `demote:${member.userId}` ? "#ccc" : "#dc3545",
                            color: "#fff", cursor: busyKey === `demote:${member.userId}` ? "wait" : "pointer",
                            fontSize: 12, fontWeight: 600, whiteSpace: "nowrap"
                          }}
                        >
                          {busyKey === `demote:${member.userId}` ? "⏳" : `⬇️ ${t("admin.members.demoteButton")}`}
                        </button>
                      )}

                      <button
                        onClick={() => setExpulsionModalData({ memberId: member.memberId, memberName: member.displayName, type: "KICK" })}
                        style={{
                          padding: "6px 12px", borderRadius: 6, border: "1px solid #ffc107",
                          background: "#fff", color: "#ffc107", cursor: "pointer",
                          fontSize: 12, fontWeight: 600, whiteSpace: "nowrap"
                        }}
                      >
                        👋 {t("admin.members.kickButton")}
                      </button>

                      <button
                        onClick={() => setExpulsionModalData({ memberId: member.memberId, memberName: member.displayName, type: "BAN" })}
                        style={{
                          padding: "6px 12px", borderRadius: 6, border: "1px solid #dc3545",
                          background: "#fff", color: "#dc3545", cursor: "pointer",
                          fontSize: 12, fontWeight: 600, whiteSpace: "nowrap"
                        }}
                      >
                        🚫 {t("admin.members.banButton")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pool Capacity Section */}
      {overview.pool.maxParticipants && (
        <div style={{ marginBottom: 24, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#4f46e5" }}>
            {t("admin.capacity.title")}
          </h4>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
            {t("admin.capacity.current", { current: overview.counts.membersActive, max: overview.pool.maxParticipants })}
          </div>
          <div style={{ height: 8, background: "#e9ecef", borderRadius: 4, marginBottom: 16 }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${Math.min(100, (overview.counts.membersActive / overview.pool.maxParticipants) * 100)}%`,
              background: (overview.counts.membersActive / overview.pool.maxParticipants) > 0.8 ? "#dc3545" : "#28a745",
              transition: "width 0.3s ease",
            }} />
          </div>
          <CapacitySelector
            type={overview.pool.organizationId ? "corporate" : "personal"}
            currentCapacity={overview.pool.maxParticipants}
            selectedCapacity={overview.pool.maxParticipants}
            onSelect={() => {}}
            mode="expansion"
          />
        </div>
      )}

      {/* Archive Pool Section */}
      {overview.pool.status === "COMPLETED" && (
        <div style={{ marginBottom: 24, padding: 16, background: "#fff3cd", borderRadius: 12, border: "1px solid #ffc107" }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#856404" }}>
            📦 {t("admin.archive.title")}
          </h4>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "#856404", marginBottom: 12 }}>
            {t("admin.archive.description")}
          </div>
          <button
            onClick={async () => {
              if (!token || !poolId || busyKey === "archive") return;
              const confirmed = window.confirm(t("admin.archive.confirm"));
              if (!confirmed) return;
              setBusyKey("archive");
              setError(null);
              try {
                await archivePool(token, poolId);
                await reload();
                alert(`✅ ${t("admin.archive.success")}`);
              } catch (err: any) {
                setError(friendlyError(err));
              } finally {
                setBusyKey(null);
              }
            }}
            disabled={busyKey === "archive"}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "1px solid #856404",
              background: busyKey === "archive" ? "#ccc" : "#ffc107",
              color: "#856404", cursor: busyKey === "archive" ? "wait" : "pointer",
              fontSize: 14, fontWeight: 600,
            }}
          >
            {busyKey === "archive" ? `⏳ ${t("admin.archive.archiving")}` : `📦 ${t("admin.archive.archiveButton")}`}
          </button>
        </div>
      )}

      {/* Instructions */}
      <div style={{ padding: 16, background: "#e7f3ff", border: "1px solid #b3d7ff", borderRadius: 12 }}>
        <div style={{ fontSize: 14, color: "#004085", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>ℹ️ {t("admin.hostInfo.title")}</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>{t("admin.hostInfo.tip1")}</li>
            <li>{t.rich("admin.hostInfo.tip2", { b: (chunks) => <b>{chunks}</b> })}</li>
            <li>{t("admin.hostInfo.tip3")}</li>
            <li>{t.rich("admin.hostInfo.tip4", { b: (chunks) => <b>{chunks}</b> })}</li>
            <li>{t("admin.hostInfo.tip5")}</li>
            <li>{t("admin.hostInfo.tip6")}</li>
          </ul>
        </div>
      </div>

      {/* Expulsion Modal */}
      {expulsionModalData && (
        <ExpulsionModal
          data={expulsionModalData}
          onClose={() => setExpulsionModalData(null)}
          poolId={poolId}
          token={token}
          busyKey={busyKey}
          setBusyKey={setBusyKey}
          setError={setError}
          friendlyError={friendlyError}
          reload={reload}
          t={t}
        />
      )}
    </div>
  );
}

function ExpulsionModal({ data, onClose, poolId, token, busyKey, setBusyKey, setError, friendlyError, reload, t }: {
  data: ExpulsionModalData;
  onClose: () => void;
  poolId: string;
  token: string;
  busyKey: string | null;
  setBusyKey: (key: string | null) => void;
  setError: (error: string | null) => void;
  friendlyError: (e: any) => string;
  reload: () => Promise<void>;
  t: ReturnType<typeof useTranslations<"pool">>;
}) {
  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 550, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {data.type === "KICK" ? (
          <>
            <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 700, color: "#ffc107" }}>
              👋 {t("expulsion.kickTitle", { name: data.memberName })}
            </h3>
            <div style={{ marginBottom: 16, padding: 12, background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
              {t.rich("expulsion.kickWarning", { strong: (chunks) => <strong>{chunks}</strong> })}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!token || !poolId || busyKey) return;
                const reason = (new FormData(e.currentTarget).get("reason") as string) || undefined;
                setBusyKey(`kick:${data.memberId}`);
                setError(null);
                try {
                  await kickMember(token, poolId, data.memberId, reason);
                  await reload();
                  onClose();
                  alert(`✅ ${t("expulsion.kickSuccess", { name: data.memberName })}`);
                } catch (err: any) {
                  setError(friendlyError(err));
                } finally {
                  setBusyKey(null);
                }
              }}
              style={{ display: "grid", gap: 12 }}
            >
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#333" }}>
                  {t("expulsion.kickReasonLabel")}
                </label>
                <textarea name="reason" rows={2} placeholder={t("expulsion.kickReasonPlaceholder")}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={onClose} disabled={busyKey !== null}
                  style={{ flex: 1, padding: 12, borderRadius: 6, border: "1px solid #ddd", background: "#fff", color: "#333", cursor: busyKey ? "wait" : "pointer", fontSize: 14, fontWeight: 600 }}>
                  {t("expulsion.cancel")}
                </button>
                <button type="submit" disabled={busyKey !== null}
                  style={{ flex: 1, padding: 12, borderRadius: 6, border: "none", background: busyKey ? "#ccc" : "#ffc107", color: "#fff", cursor: busyKey ? "wait" : "pointer", fontSize: 14, fontWeight: 600 }}>
                  {busyKey ? `⏳ ${t("expulsion.kicking")}` : `👋 ${t("expulsion.kickButton")}`}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 700, color: "#dc3545" }}>
              🚫 {t("expulsion.banTitle", { name: data.memberName })}
            </h3>
            <div style={{ marginBottom: 16, padding: 14, background: "#f8d7da", border: "2px solid #dc3545", borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "#721c24" }}>
                ⚠️ {t("expulsion.banWarning")}
              </div>
              <ul style={{ margin: "8px 0", paddingLeft: 20, color: "#721c24" }}>
                <li>{t("expulsion.banDetail1")}</li>
                <li>{t("expulsion.banDetail2")}</li>
                <li>{t("expulsion.banDetail3")}</li>
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
                  alert(`❌ ${t("expulsion.banReasonRequired")}`);
                  return;
                }
                setBusyKey(`ban:${data.memberId}`);
                setError(null);
                try {
                  await banMember(token, poolId, data.memberId, reason, deletePicks);
                  await reload();
                  onClose();
                  alert(`✅ ${t("expulsion.banSuccess", { name: data.memberName })}`);
                } catch (err: any) {
                  setError(friendlyError(err));
                } finally {
                  setBusyKey(null);
                }
              }}
              style={{ display: "grid", gap: 12 }}
            >
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#333" }}>
                  {t("expulsion.banReasonLabel")}
                </label>
                <textarea name="reason" required rows={3} placeholder={t("expulsion.banReasonPlaceholder")}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" name="deletePicks" value="true" />
                  <span>{t.rich("expulsion.deletePicks", { strong: (chunks) => <strong>{chunks}</strong> })}</span>
                </label>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={onClose} disabled={busyKey !== null}
                  style={{ flex: 1, padding: 12, borderRadius: 6, border: "1px solid #ddd", background: "#fff", color: "#333", cursor: busyKey ? "wait" : "pointer", fontSize: 14, fontWeight: 600 }}>
                  {t("expulsion.cancel")}
                </button>
                <button type="submit" disabled={busyKey !== null}
                  style={{ flex: 1, padding: 12, borderRadius: 6, border: "none", background: busyKey ? "#ccc" : "#dc3545", color: "#fff", cursor: busyKey ? "wait" : "pointer", fontSize: 14, fontWeight: 600 }}>
                  {busyKey ? `⏳ ${t("expulsion.banning")}` : `🚫 ${t("expulsion.banButton")}`}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
