"use client";

import type { ReactNode } from "react";
import { colors, spacing, fontSize, fontWeight, radii } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";

// Reusable section block for wizard steps that group multiple
// configuration items into clearly numbered sub-stages. Renders a
// brand-colored circular badge with the index, a large title, an
// optional helper subtitle, and a thin top divider that visually
// separates each sub-step. Drop in a `<WizardSubStep>` for every
// distinct decision the host makes inside a step (name → logo →
// colors → message …) so the flow reads as a checklist instead of
// a wall of look-alike labels.

interface Props {
  number: number;
  title: string;
  subtitle?: string;
  /** Skip the top divider/padding for the first sub-step in a step. */
  isFirst?: boolean;
  /** Show a red asterisk after the title to mark a required field. */
  requiredMark?: boolean;
  /**
   * If provided, renders a small muted pill next to the title with
   * this text — typically the localized word for "optional".
   */
  optionalLabel?: string;
  children: ReactNode;
}

export function WizardSubStep({
  number,
  title,
  subtitle,
  isFirst,
  requiredMark,
  optionalLabel,
  children,
}: Props) {
  const isMobile = useIsMobile();

  const badgeSize = isMobile ? 28 : 32;
  // Subtitle and content align with the title text (after the badge),
  // not with the badge itself, so the eye reads "header → body" cleanly.
  const contentIndent = badgeSize + spacing.md;

  return (
    <section
      style={{
        paddingTop: isFirst ? 0 : (isMobile ? spacing["2xl"] : spacing["3xl"]),
        borderTop: isFirst ? undefined : `1px solid ${colors.borderLight}`,
        marginTop: isFirst ? 0 : (isMobile ? spacing.xl : spacing["2xl"]),
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.md,
          marginBottom: subtitle ? spacing.xs : spacing.lg,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: badgeSize,
            height: badgeSize,
            borderRadius: radii.circle as string,
            background: colors.brandGradient,
            color: colors.white,
            fontSize: isMobile ? fontSize.base : fontSize.lg,
            fontWeight: fontWeight.bold,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {number}
        </span>
        <h3
          style={{
            margin: 0,
            fontSize: isMobile ? fontSize["2xl"] : fontSize["3xl"],
            fontWeight: fontWeight.bold,
            color: colors.text,
            lineHeight: 1.25,
            letterSpacing: -0.2,
            display: "flex",
            alignItems: "baseline",
            gap: spacing.sm,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <span>{title}</span>
          {requiredMark && (
            <span aria-hidden="true" style={{ color: colors.error }}>
              *
            </span>
          )}
          {optionalLabel && (
            <span
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: colors.textLight,
                background: colors.bgLight,
                border: `1px solid ${colors.borderLight}`,
                borderRadius: radii.pill,
                padding: "2px 10px",
                textTransform: "lowercase",
                letterSpacing: 0.2,
                lineHeight: 1.4,
              }}
            >
              {optionalLabel}
            </span>
          )}
        </h3>
      </header>
      {subtitle && (
        <p
          style={{
            margin: `0 0 ${spacing.lg}px ${contentIndent}px`,
            fontSize: fontSize.sm,
            color: colors.textMuted,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
      <div>{children}</div>
    </section>
  );
}
