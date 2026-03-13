"use client";

import { Link } from "@/i18n/navigation";
import { TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import type { MePoolRow } from "@/lib/api";
import { colors, radii, fontSize as fs, fontWeight as fw, pillBadgeStyle } from "@/lib/theme";

export interface PoolCardProps {
  row: MePoolRow;
  isMobile: boolean;
  t: any;
  te: any;
  getPoolStatusBadge: (status: string) => { label: string; color: string; emoji: string };
  onLeave: (row: MePoolRow) => void;
}

export function PoolCard({ row: r, isMobile, t, te, getPoolStatusBadge, onLeave }: PoolCardProps) {
  return (
    <div
      key={r.poolId}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: radii["3xl"],
        padding: isMobile ? 16 : 14,
        background: colors.white,
        opacity: r.status === "LEFT" ? 0.75 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          gap: 12,
          alignItems: isMobile ? "stretch" : "flex-start",
        }}
      >
        <div style={{ flex: 1 }}>
          {/* Pool Name + Badges */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: fw.extrabold, fontSize: isMobile ? 17 : fs.xl }}>{r.pool.name}</div>
            <span
              style={pillBadgeStyle(
                colors.border,
                r.role === "HOST" || r.role === "CORPORATE_HOST" ? colors.text : colors.white,
                r.role === "HOST" || r.role === "CORPORATE_HOST" ? colors.white : colors.text,
              )}
            >
              {r.role === "CORPORATE_HOST" ? "HOST" : r.role}
            </span>
            {r.pool.organizationId && (
              <span
                style={pillBadgeStyle(colors.purpleBorder, colors.purpleBg, colors.purpleDark)}
              >
                {"\u{1F3E2}"} {te("badge")}
              </span>
            )}
            {r.status === "PENDING_APPROVAL" && (
              <span
                style={pillBadgeStyle(colors.warning, colors.warningBg, colors.warningDark)}
              >
                {"\u23F3"} {t("pendingBadge")}
              </span>
            )}
            {r.status === "LEFT" && (
              <span
                style={pillBadgeStyle(colors.errorBorderStrong, colors.errorBg, colors.error)}
              >
                {t("retired")}
              </span>
            )}
            {r.pool.status && (() => {
              const badge = getPoolStatusBadge(r.pool.status);
              return (
                <span
                  style={pillBadgeStyle(badge.color, `${badge.color}20`, badge.color)}
                >
                  {badge.emoji} {badge.label}
                </span>
              );
            })()}
          </div>

          {/* Meta info */}
          <div style={{ color: colors.textMuted, fontSize: isMobile ? fs.md : fs.sm, marginTop: 4 }}>
            {t("poolCard.timezone")}: {r.pool.timeZone} {"\u2022"} {t("poolCard.deadline")}: {r.pool.deadlineMinutesBeforeKickoff}m
          </div>

          {r.tournamentInstance && (
            <div style={{ marginTop: 6, color: colors.textMuted, fontSize: isMobile ? fs.md : fs.sm }}>
              {t("poolCard.tournament")}: {r.tournamentInstance.name}
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "row" : "column",
            gap: 8,
            alignItems: isMobile ? "stretch" : "flex-end",
          }}
        >
          {r.status === "PENDING_APPROVAL" ? (
            <span
              style={{
                color: colors.textLight,
                fontSize: fs.base,
                fontStyle: "italic",
                padding: isMobile ? "12px 0" : 0,
                textAlign: "center",
              }}
            >
              {t("waitingApproval")}
            </span>
          ) : (
            <Link
              href={{ pathname: "/pools/[poolId]", params: { poolId: r.poolId } }}
              style={{
                textDecoration: "none",
                padding: isMobile ? 14 : 8,
                background: colors.blue,
                color: colors.white,
                borderRadius: radii.lg,
                fontWeight: fw.semibold,
                textAlign: "center",
                minHeight: isMobile ? TOUCH_TARGET.minimum : "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: isMobile ? 1 : undefined,
                ...mobileInteractiveStyles.tapHighlight,
              }}
            >
              {t("openPool")}
            </Link>
          )}
          {/* Leave button: only for active players who are not hosts */}
          {r.status === "ACTIVE" &&
            r.role !== "HOST" &&
            r.role !== "CORPORATE_HOST" &&
            r.pool.status !== "COMPLETED" &&
            r.pool.status !== "ARCHIVED" && (
              <button
                onClick={() => onLeave(r)}
                style={{
                  padding: isMobile ? 14 : 8,
                  background: colors.white,
                  color: colors.error,
                  border: `1px solid ${colors.errorBorderLight}`,
                  borderRadius: radii.lg,
                  fontWeight: fw.semibold,
                  fontSize: isMobile ? fs.base : fs.md,
                  cursor: "pointer",
                  textAlign: "center",
                  minHeight: isMobile ? TOUCH_TARGET.minimum : "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {t("leavePool")}
              </button>
            )}
        </div>
      </div>
    </div>
  );
}
