"use client";

import { useTranslations } from "next-intl";
import { approveMember, rejectMember } from "@/lib/api";
import { fmtUtc } from "../poolHelpers";
import { colors, fontSize, fontWeight, radii, spacing } from "@/lib/theme";

export interface PendingJoinRequestsProps {
  poolId: string;
  token: string;
  pendingMembers: any[];
  busyKey: string | null;
  setBusyKey: (key: string | null) => void;
  setError: (error: string | null) => void;
  friendlyError: (e: any) => string;
  userTimezone: string | null;
  reload: () => Promise<void>;
  refetchNotifications: () => void;
  loadPendingMembers: () => Promise<void>;
}

export function PendingJoinRequests({
  poolId, token, pendingMembers,
  busyKey, setBusyKey, setError, friendlyError,
  userTimezone, reload, refetchNotifications, loadPendingMembers,
}: PendingJoinRequestsProps) {
  const t = useTranslations("pool");

  if (pendingMembers.length === 0) return null;

  return (
    <div style={{ marginBottom: spacing["2xl"], padding: spacing.lg, background: colors.warningBg, borderRadius: radii["2xl"], border: `1px solid ${colors.warning}` }}>
      <h4 style={{ margin: 0, fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.md, color: colors.warningDark }}>
        🔔 {t("admin.pendingRequests.title", { count: pendingMembers.length })}
      </h4>
      <div style={{ fontSize: fontSize.base, lineHeight: 1.8, color: colors.warningDark, marginBottom: spacing.md }}>
        {t("admin.pendingRequests.description")}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {pendingMembers.map((member: any) => (
          <div
            key={member.id}
            style={{
              padding: spacing.md,
              background: colors.white,
              borderRadius: radii.lg,
              border: `1px solid ${colors.warning}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: fontWeight.semibold, fontSize: fontSize.base, marginBottom: 4 }}>
                {member.displayName}
              </div>
              <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                @{member.username} • {member.email}
              </div>
              <div style={{ fontSize: fontSize.sm, color: colors.textLight, marginTop: 4 }}>
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
                  background: colors.success,
                  color: colors.white,
                  border: "none",
                  borderRadius: radii.md,
                  cursor: busyKey === `approve-${member.id}` ? "wait" : "pointer",
                  fontWeight: fontWeight.semibold,
                  fontSize: fontSize.md,
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
                  background: colors.errorAlt,
                  color: colors.white,
                  border: "none",
                  borderRadius: radii.md,
                  cursor: busyKey === `reject-${member.id}` ? "wait" : "pointer",
                  fontWeight: fontWeight.semibold,
                  fontSize: fontSize.md,
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
  );
}
