"use client";

import { useTranslations } from "next-intl";
import { promoteMemberToCoAdmin, demoteMemberFromCoAdmin } from "@/lib/api";
import type { PoolOverview } from "@/lib/api";
import type { ExpulsionModalData } from "../poolTypes";
import {
  colors, fontSize, fontWeight, radii, spacing,
  adminSectionStyle, adminHeadingStyle, badgeStyle,
} from "@/lib/theme";

export interface MemberManagementProps {
  poolId: string;
  token: string;
  overview: PoolOverview;
  busyKey: string | null;
  setBusyKey: (key: string | null) => void;
  setError: (error: string | null) => void;
  friendlyError: (e: any) => string;
  reload: () => Promise<void>;
  setExpulsionModalData: (data: ExpulsionModalData | null) => void;
}

export function MemberManagement({
  poolId, token, overview,
  busyKey, setBusyKey, setError, friendlyError, reload,
  setExpulsionModalData,
}: MemberManagementProps) {
  const t = useTranslations("pool");

  if (overview.myMembership.role !== "HOST") return null;

  return (
    <div style={adminSectionStyle}>
      <h4 style={adminHeadingStyle}>
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
  );
}
