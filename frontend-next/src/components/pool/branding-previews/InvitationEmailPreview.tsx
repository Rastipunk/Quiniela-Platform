"use client";

import { colors, fontSize, fontWeight } from "@/lib/theme";
import { resolveBrandColors } from "@/lib/brandColors";

// Compact mock of the corporate invitation email body — mirrors
// `backend/src/lib/emailTemplates.ts` (getCorporateActivationTemplate)
// so the host sees in the wizard / branding panel what their team
// will actually receive in their inbox.
//
// IMPORTANT: the strings in PREVIEW_STRINGS below must stay in sync
// with the i18n block of the backend template. When you change the
// email copy there, change it here too — there's no shared source of
// truth across the backend/frontend boundary today, so a sync break
// silently misleads the host about what's being sent.
//
// The dictionary is keyed by `previewLocale` (the host's
// `Organization.invitationLocale`), NOT by the UI locale — the preview
// must show what the EMPLOYEE will receive, not the host's interface
// language.

interface Props {
  primary: string;
  secondary: string;
  companyName: string;
  logoBase64: string;
  invitationMessage: string;
  previewLabel: string;
  /** Which locale to render the preview in. Drives all strings —
   *  greeting, subjectLine, body, CTA. Defaults to "es" so legacy
   *  call sites that haven't been migrated keep working. */
  previewLocale: "es" | "en" | "pt";
}

interface LocaleStrings {
  subjectLine: string;
  greeting: string;
  /** Text rendered AFTER the bolded company name in the body. Keeping
   *  the company name out of the string lets us render it as
   *  <strong>…</strong> exactly like the real email does. */
  bodyAfterCompany: string;
  ctaLabel: string;
}

const PREVIEW_STRINGS: Record<"es" | "en" | "pt", LocaleStrings> = {
  es: {
    subjectLine: "te reta a jugar",
    greeting: "Hola María!",
    bodyAfterCompany:
      " te invita a unirte y competir con tus compañeros/as demostrando quién sabe más de fútbol.",
    ctaLabel: "Entrar a jugar →",
  },
  en: {
    subjectLine: "challenges you to play",
    greeting: "Hi Maria!",
    bodyAfterCompany:
      " is inviting you to join and compete with your teammates to show who knows football best.",
    ctaLabel: "Get in the game →",
  },
  pt: {
    subjectLine: "te desafia a jogar",
    greeting: "Olá Maria!",
    bodyAfterCompany:
      " está te convidando para entrar e competir com seus colegas mostrando quem sabe mais de futebol.",
    ctaLabel: "Entrar no jogo →",
  },
};

export function InvitationEmailPreview({
  primary,
  secondary,
  companyName,
  logoBase64,
  invitationMessage,
  previewLabel,
  previewLocale,
}: Props) {
  const t = PREVIEW_STRINGS[previewLocale];
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
            {t.subjectLine}
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
            {t.greeting}
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: colors.textDark,
              marginBottom: 10,
            }}
          >
            <strong>{previewName}</strong>{t.bodyAfterCompany}
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
              &ldquo;{showsMessage ? invitationMessage : `${previewName}${t.bodyAfterCompany}`}&rdquo;
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
            {t.ctaLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
