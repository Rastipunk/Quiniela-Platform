"use client";

import { colors, fontSize, fontWeight } from "@/lib/theme";
import { resolveBrandColors, darken } from "@/lib/brandColors";

// Compact mock of the corporate welcome splash that runs at
// `pools/[poolId]/page.tsx` when an employee opens the pool. Updates
// live as the host edits brand colors / message / logo so they can
// see exactly what their team will see.

interface Props {
  primary: string;
  secondary: string;
  companyName: string;
  logoBase64: string;
  welcomeMessage: string;
  /** Placeholder rendered (italicized) when message is empty. */
  welcomePlaceholder: string;
  previewLabel: string;
  badgeLabel: string;
  ctaLabel: string;
}

export function WelcomeSplashPreview({
  primary,
  secondary,
  companyName,
  logoBase64,
  welcomeMessage,
  welcomePlaceholder,
  previewLabel,
  badgeLabel,
  ctaLabel,
}: Props) {
  const brand = resolveBrandColors(primary || null, secondary || null);
  // Mirror what pools/[poolId]/page.tsx renders. We keep the user's
  // colors verbatim so the preview matches the picker — the contrast
  // warning already nudges hosts toward darker tones when needed.
  const splashBg = brand.isCustom
    ? `linear-gradient(160deg, ${brand.primary} 0%, ${brand.secondary} 100%)`
    : "linear-gradient(160deg, #0f0a2e 0%, #1a1145 35%, #2d1b69 65%, #1e1b4b 100%)";
  const previewName = companyName.trim() || "Acme Corp";
  const showsMessage = welcomeMessage.trim().length > 0;
  const messageBody = showsMessage ? welcomeMessage : welcomePlaceholder;

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          color: colors.textLight,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {previewLabel}
      </div>
      <div
        aria-hidden="true"
        style={{
          padding: "20px 16px 22px",
          borderRadius: 14,
          background: splashBg,
          textAlign: "center",
          color: "#fff",
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
              borderRadius: 10,
              background: "rgba(255,255,255,0.12)",
              padding: 4,
              marginBottom: 10,
            }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              background: "rgba(255,255,255,0.18)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: fontWeight.extrabold,
              marginBottom: 10,
            }}
          >
            {previewName.charAt(0).toUpperCase()}
          </div>
        )}
        <div
          style={{
            fontSize: 18,
            fontWeight: fontWeight.extrabold,
            lineHeight: 1.2,
            letterSpacing: -0.3,
          }}
        >
          {previewName}
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: 6,
            padding: "2px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.22)",
            color: "rgba(255,255,255,0.9)",
            fontSize: 10,
            fontWeight: fontWeight.semibold,
            letterSpacing: 0.4,
          }}
        >
          {badgeLabel}
        </span>
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 12,
            lineHeight: 1.5,
            fontStyle: "italic",
            color: showsMessage ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.5)",
            textAlign: "left",
          }}
        >
          &ldquo;{messageBody}&rdquo;
        </div>
        <div
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "8px 22px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #fff 0%, #e0e7ff 100%)",
            color: darken(brand.primary, 0.2),
            fontSize: 12,
            fontWeight: fontWeight.bold,
            letterSpacing: 0.3,
          }}
        >
          {ctaLabel}
        </div>
      </div>
    </div>
  );
}
