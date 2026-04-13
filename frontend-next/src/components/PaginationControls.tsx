"use client";

import { useTranslations } from "next-intl";
import { colors, radii, fontSize, fontWeight } from "@/lib/theme";
import { TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  isMobile?: boolean;
}

export function PaginationControls({ page, totalPages, onPrev, onNext, isMobile }: PaginationControlsProps) {
  const t = useTranslations("pool");

  if (totalPages <= 1) return null;

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: isMobile ? "10px 16px" : "8px 16px",
    borderRadius: radii.lg,
    border: `1px solid ${disabled ? colors.borderLight : colors.brand}`,
    background: disabled ? colors.bgLighter : colors.white,
    color: disabled ? colors.disabled : colors.brand,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    cursor: disabled ? "not-allowed" : "pointer",
    minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
    opacity: disabled ? 0.5 : 1,
    ...mobileInteractiveStyles.tapHighlight,
  });

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginTop: 16,
    }}>
      <button onClick={onPrev} disabled={page === 0} style={btnStyle(page === 0)}>
        {t("pagination.prev")}
      </button>
      <span style={{ fontSize: fontSize.md, color: colors.textMuted, fontWeight: fontWeight.medium }}>
        {t("pagination.page", { current: page + 1, total: totalPages })}
      </span>
      <button onClick={onNext} disabled={page >= totalPages - 1} style={btnStyle(page >= totalPages - 1)}>
        {t("pagination.next")}
      </button>
    </div>
  );
}
