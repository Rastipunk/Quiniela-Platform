"use client";

import { colors, fontSize, fontWeight } from "@/lib/theme";
import { resolveBrandColors } from "@/lib/brandColors";

// Compact mock of the corporate invitation email body. Hero band
// (gradient + logo + company name + subhead) and a highlight box
// for the host's custom message — mirrors `backend/src/lib/
// emailTemplates.ts` so the preview matches what lands in inbox.

interface Props {
  primary: string;
  secondary: string;
  companyName: string;
  logoBase64: string;
  invitationMessage: string;
  previewLabel: string;
  subjectLine: string;
  greeting: string;
  body: string;
  ctaLabel: string;
}

export function InvitationEmailPreview({
  primary,
  secondary,
  companyName,
  logoBase64,
  invitationMessage,
  previewLabel,
  subjectLine,
  greeting,
  body,
  ctaLabel,
}: Props) {
  const brand = resolveBrandColors(primary || null, secondary || null);
  const heroGradient = brand.isCustom
    ? `linear-gradient(135deg,${brand.primary} 0%,${brand.secondary} 100%)`
    : "linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4338ca 100%)";
  const ctaGradient = brand.isCustom
    ? `linear-gradient(135deg,${brand.primary} 0%,${brand.secondary} 100%)`
    : "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)";
  const previewName = companyName.trim() || "Acme Corp";
  const showsMessage = invitationMessage.trim().length > 0;

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
          borderRadius: 14,
          overflow: "hidden",
          border: `1px solid ${colors.borderLight}`,
          background: "#ffffff",
        }}
      >
        {/* Hero */}
        <div
          style={{
            padding: "20px 18px 18px",
            background: heroGradient,
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
                marginBottom: 8,
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
                marginBottom: 8,
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
          <div
            style={{
              fontSize: 11,
              opacity: 0.85,
              marginTop: 4,
              fontWeight: fontWeight.semibold,
            }}
          >
            {subjectLine}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px 18px" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: fontWeight.semibold,
              color: colors.textDark,
              marginBottom: 6,
            }}
          >
            {greeting}
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: colors.textDark,
              marginBottom: 10,
            }}
          >
            {body}
          </div>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "#F5F3FF",
              border: "1px solid #ede9fe",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: showsMessage ? "#4c1d95" : "#a78bfa",
                fontStyle: "italic",
              }}
            >
              &ldquo;{showsMessage ? invitationMessage : body}&rdquo;
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                color: "#7c3aed",
                textAlign: "right",
                fontWeight: fontWeight.semibold,
              }}
            >
              — {previewName}
            </div>
          </div>
          <div
            style={{
              display: "inline-block",
              padding: "9px 22px",
              borderRadius: 10,
              background: ctaGradient,
              color: "#fff",
              fontSize: 12,
              fontWeight: fontWeight.bold,
              letterSpacing: 0.3,
            }}
          >
            {ctaLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
