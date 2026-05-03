"use client";

import { colors, radii, spacing, fontSize, fontWeight } from "@/lib/theme";
import { resolveBrandColors } from "@/lib/brandColors";

// Live miniature of the corporate pool header band. Mirrors the
// component that lives in `pools/[poolId]/page.tsx` for corporate
// pools (`headerBg`, `headerBorderBottom`, `headerLogoBg`) so what
// the host sees here matches the production surface 1:1.
//
// Pure presentational — labels are passed in by the parent so this
// component can live outside the i18n provider tree if needed.

interface Props {
  primary: string;
  secondary: string;
  companyName: string;
  logoBase64: string;
  /** Sample pool name shown inside the preview band. */
  poolNameSample: string;
  /** Translated "by {company}" line under the pool name. */
  byCompanyLabel: string;
  /** Small uppercase tag rendered to the right of the band. */
  badgeLabel: string;
}

export function HeaderPreview({
  primary,
  secondary,
  companyName,
  logoBase64,
  poolNameSample,
  byCompanyLabel,
  badgeLabel,
}: Props) {
  const resolved = resolveBrandColors(primary || null, secondary || null);
  const previewName = companyName.trim() || "Acme Corp";

  return (
    <div
      aria-hidden="true"
      style={{
        marginTop: spacing.md,
        borderRadius: radii.lg,
        background: `linear-gradient(135deg, ${resolved.primary}33 0%, ${resolved.secondary}33 100%)`,
        borderBottom: `3px solid ${resolved.primary}`,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        overflow: "hidden",
      }}
    >
      {logoBase64 ? (
        <img
          src={logoBase64}
          alt=""
          width={56}
          height={56}
          style={{
            width: 56,
            height: 56,
            objectFit: "contain",
            borderRadius: radii.md,
            flexShrink: 0,
            background: colors.white,
            padding: 4,
            border: `1px solid ${colors.borderLight}`,
          }}
        />
      ) : (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: radii.md,
            background: `linear-gradient(135deg, ${resolved.secondary}, ${resolved.primary})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: fontWeight.extrabold,
            color: colors.white,
            flexShrink: 0,
          }}
        >
          {previewName.charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.extrabold,
            color: colors.textDark,
            lineHeight: 1.2,
            letterSpacing: -0.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {poolNameSample}
        </div>
        <div
          style={{
            fontSize: fontSize.xs,
            color: resolved.primary,
            fontWeight: fontWeight.semibold,
            marginTop: 2,
          }}
        >
          {byCompanyLabel}
        </div>
      </div>
      <div
        style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          color: colors.textLight,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          flexShrink: 0,
        }}
      >
        {badgeLabel}
      </div>
    </div>
  );
}
