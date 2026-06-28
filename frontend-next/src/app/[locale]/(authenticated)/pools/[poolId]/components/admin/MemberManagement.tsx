"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { promoteMemberToCoAdmin, demoteMemberFromCoAdmin } from "@/lib/api";
import type { PoolOverview } from "@/lib/api";
import type { ExpulsionModalData } from "../poolTypes";
import {
  colors, fontSize, fontWeight, radii, spacing,
  adminSectionStyle, adminHeadingStyle,
} from "@/lib/theme";
import { useIsMobile, TOUCH_TARGET } from "@/hooks/useIsMobile";
import { PaginationControls } from "@/components/PaginationControls";

const PAGE_SIZE = 20;

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
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  if (!overview.permissions.canManageResults) return null;

  const allRows = overview.leaderboard.rows;

  const filtered = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter((m: any) =>
      m.displayName?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  }, [allRows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  return (
    <div style={adminSectionStyle}>
      <h4 style={adminHeadingStyle}>
        {t("players.title")}
      </h4>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t("players.searchPlaceholder")}
          style={{
            width: "100%",
            padding: isMobile ? "12px 14px" : "10px 14px",
            borderRadius: radii.lg,
            border: `1px solid ${colors.borderMedium}`,
            fontSize: isMobile ? fontSize.xl : fontSize.base,
            outline: "none",
            boxSizing: "border-box",
            minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
          }}
        />
      </div>

      {/* Member count */}
      <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 12 }}>
        {filtered.length} {t("admin.members.description")}
      </div>

      {/* Member list */}
      {paged.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: colors.textMuted, fontSize: fontSize.md }}>
          {t("players.noResults")}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {paged.map((member: any) => {
            const isHost = member.role === "HOST";
            const isCoAdmin = member.role === "CO_ADMIN";
            const isPlayer = member.role === "PLAYER";

            return (
              <div
                key={member.userId}
                style={{
                  padding: 12,
                  background: colors.white,
                  borderRadius: 8,
                  border: "1px solid #dee2e6",
                  display: "flex",
                  // Mobile: stack the info over the actions (like the buttonless
                  // host card) so the name/email/role never truncate to fit the
                  // buttons inline. Desktop keeps the side-by-side row.
                  flexDirection: isMobile ? "column" : "row",
                  justifyContent: "space-between",
                  alignItems: isMobile ? "stretch" : "center",
                  gap: isMobile ? 10 : 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {member.displayName}
                  </div>
                  {member.email && (
                    <div style={{ fontSize: 12, color: colors.textLight, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {member.email}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {isHost && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#007bff20", border: "1px solid #007bff", color: colors.brand, fontWeight: 600 }}>
                        HOST
                      </span>
                    )}
                    {isCoAdmin && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#28a74520", border: "1px solid #28a745", color: colors.success, fontWeight: 600 }}>
                        CO-ADMIN
                      </span>
                    )}
                    {isPlayer && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#6c757d20", border: "1px solid #6c757d", color: colors.textMuted, fontWeight: 600 }}>
                        PLAYER
                      </span>
                    )}
                    {member.memberStatus === "LEFT" && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#ef444420", border: "1px solid #ef4444", color: colors.errorBorderStrong, fontWeight: 600 }}>
                        {t("mobileLeaderboard.retired")}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: colors.textLight }}>
                      {member.points} {t("admin.members.pts")}
                    </span>
                  </div>
                </div>

                {!isHost && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : undefined }}>
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
                            alert(`${t("admin.members.promoteSuccess", { name: member.displayName })}`);
                          } catch (err: any) {
                            setError(friendlyError(err));
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        style={{
                          padding: "6px 12px", borderRadius: 6, border: "1px solid #28a745",
                          background: busyKey === `promote:${member.userId}` ? colors.disabled : colors.success,
                          color: colors.white, cursor: busyKey === `promote:${member.userId}` ? "wait" : "pointer",
                          fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                          flex: isMobile ? 1 : undefined,
                          minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                        }}
                      >
                        {busyKey === `promote:${member.userId}` ? "..." : t("admin.members.promoteButton")}
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
                            alert(`${t("admin.members.demoteSuccess", { name: member.displayName })}`);
                          } catch (err: any) {
                            setError(friendlyError(err));
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        style={{
                          padding: "6px 12px", borderRadius: 6, border: "1px solid #dc3545",
                          background: busyKey === `demote:${member.userId}` ? colors.disabled : colors.errorAlt,
                          color: colors.white, cursor: busyKey === `demote:${member.userId}` ? "wait" : "pointer",
                          fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                          flex: isMobile ? 1 : undefined,
                          minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                        }}
                      >
                        {busyKey === `demote:${member.userId}` ? "..." : t("admin.members.demoteButton")}
                      </button>
                    )}

                    <button
                      onClick={() => setExpulsionModalData({ memberId: member.memberId, memberName: member.displayName, type: "KICK" })}
                      style={{
                        padding: "6px 12px", borderRadius: 6, border: "1px solid #ffc107",
                        background: colors.white, color: colors.warning, cursor: "pointer",
                        fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                        flex: isMobile ? 1 : undefined,
                        minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                      }}
                    >
                      {t("admin.members.kickButton")}
                    </button>

                    <button
                      onClick={() => setExpulsionModalData({ memberId: member.memberId, memberName: member.displayName, type: "BAN" })}
                      style={{
                        padding: "6px 12px", borderRadius: 6, border: "1px solid #dc3545",
                        background: colors.white, color: colors.errorAlt, cursor: "pointer",
                        fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                        flex: isMobile ? 1 : undefined,
                        minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                      }}
                    >
                      {t("admin.members.banButton")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PaginationControls
        page={safePage}
        totalPages={totalPages}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        isMobile={isMobile}
      />
    </div>
  );
}
