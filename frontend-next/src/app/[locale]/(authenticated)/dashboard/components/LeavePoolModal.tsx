"use client";

import { TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import type { MePoolRow } from "@/lib/api";
import { colors, radii, zIndex, fontSize, fontWeight, spacing } from "@/lib/theme";

export interface LeavePoolModalProps {
  pool: MePoolRow;
  isMobile: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  t: any;
}

export function LeavePoolModal({ pool, isMobile, busy, onConfirm, onCancel, t }: LeavePoolModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: colors.overlayDarker,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
        zIndex: zIndex.modalAbove,
      }}
      onClick={() => !busy && onCancel()}
    >
      <div
        style={{
          width: isMobile ? "100%" : "min(420px, 100%)",
          background: colors.white,
          borderRadius: radii["4xl"],
          padding: isMobile ? 24 : 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: fontWeight.bold, fontSize: isMobile ? 18 : fontSize.xl, marginBottom: spacing.md }}>
          {t("leaveConfirmTitle")}
        </div>
        <div style={{ fontWeight: fontWeight.extrabold, fontSize: isMobile ? 16 : fontSize.lg, marginBottom: spacing.sm }}>
          {pool.pool.name}
        </div>
        <div style={{
          background: colors.errorBg,
          border: `1px solid ${colors.errorBorderLight}`,
          borderRadius: radii.xl,
          padding: isMobile ? 14 : spacing.md,
          color: colors.errorDarker,
          fontSize: isMobile ? fontSize.base : fontSize.md,
          lineHeight: 1.5,
          marginBottom: spacing.xl,
        }}>
          {t("leaveConfirmMessage")}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1,
              padding: isMobile ? 14 : 10,
              borderRadius: radii.xl,
              border: `1px solid ${colors.border}`,
              background: colors.white,
              color: colors.textDark,
              fontSize: isMobile ? fontSize.lg : fontSize.base,
              fontWeight: fontWeight.semibold,
              cursor: "pointer",
              minHeight: TOUCH_TARGET.minimum,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {t("leaveCancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1,
              padding: isMobile ? 14 : 10,
              borderRadius: radii.xl,
              border: "none",
              background: colors.error,
              color: colors.white,
              fontSize: isMobile ? fontSize.lg : fontSize.base,
              fontWeight: fontWeight.semibold,
              cursor: "pointer",
              minHeight: TOUCH_TARGET.minimum,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {busy ? t("leaving") : t("leaveConfirmButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
