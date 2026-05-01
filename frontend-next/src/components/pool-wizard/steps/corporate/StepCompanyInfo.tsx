"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWizard } from "../../PoolWizardContext";
import { PoolWizardStepContainer } from "../../PoolWizardStepContainer";
import { ColorField } from "../../ColorField";
import {
  PICKS4ALL_DEFAULT_PRIMARY,
  PICKS4ALL_DEFAULT_SECONDARY,
  buildSplashGradient,
  darken,
  hasGoodContrastAgainstWhite,
  resolveBrandColors,
} from "@/lib/brandColors";

const MAX_LOGO_SIZE = 500 * 1024; // 500 KB

// Allowed logo MIME types — kept in sync with the backend Zod
// regex in routes/corporate.ts. SVG is intentionally excluded
// because email clients (Gmail, Outlook, Apple Mail) strip SVG,
// and SVG can carry scripts that complicate sanitization.
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
const LOGO_ACCEPT_ATTR = ALLOWED_LOGO_TYPES.join(",");

export function StepCompanyInfo() {
  const t = useTranslations("poolWizard");
  const isMobile = useIsMobile();
  const { state, dispatch } = useWizard();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  // ── Logo handling ─────────────────────────────────────────

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError(null);

    if (file.size > MAX_LOGO_SIZE) {
      setLogoError(
        t("companyInfo.logoTooLarge", {
          defaultMessage: "El logo no puede exceder 500 KB.",
        })
      );
      // Reset the input so picking the same bad file again still
      // fires onChange (browsers de-dupe by name+lastModified).
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type as typeof ALLOWED_LOGO_TYPES[number])) {
      setLogoError(
        t("companyInfo.logoInvalidType", {
          defaultMessage:
            "Sube tu logo en PNG, JPG, GIF o WebP. Los SVG no son compatibles con todos los clientes de email.",
        })
      );
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      dispatch({
        type: "SET_FIELD",
        field: "logoBase64",
        value: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    dispatch({ type: "SET_FIELD", field: "logoBase64", value: "" });
    if (fileRef.current) fileRef.current.value = "";
    setLogoError(null);
  }

  // ── Styles ────────────────────────────────────────────────

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textDark,
    marginBottom: spacing.xs,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: isMobile ? "14px 12px" : "10px 12px",
    borderRadius: radii.lg,
    border: `1px solid ${colors.borderMedium}`,
    fontSize: isMobile ? fontSize.xl : fontSize.base,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 80,
    resize: "vertical" as const,
    fontFamily: "inherit",
  };

  const fieldGap = isMobile ? spacing.xl : spacing["2xl"];

  return (
    <PoolWizardStepContainer
      title={t("companyInfo.title", {
        defaultMessage: "Informacion de la empresa",
      })}
      subtitle={t("companyInfo.subtitle", {
        defaultMessage:
          "Estos datos se mostraran en la pagina del pool corporativo.",
      })}
      icon="&#x1F3E2;"
    >
      {/* Company name */}
      <div style={{ marginBottom: fieldGap }}>
        <label style={labelStyle}>
          {t("companyInfo.nameLabel", { defaultMessage: "Nombre de tu empresa" })}{" "}
          <span style={{ color: colors.error }}>*</span>
        </label>
        <input
          type="text"
          value={state.companyName}
          onChange={(e) =>
            dispatch({
              type: "SET_FIELD",
              field: "companyName",
              value: e.target.value,
            })
          }
          placeholder={t("companyInfo.namePlaceholder", {
            defaultMessage: "Ej: Acme Corp",
          })}
          style={inputStyle}
          maxLength={100}
          autoFocus
        />
        {state.companyName.length > 0 && state.companyName.trim().length < 2 && (
          <div
            style={{
              marginTop: spacing.xs,
              fontSize: fontSize.sm,
              color: colors.error,
            }}
          >
            {t("companyInfo.nameMinLength", {
              defaultMessage: "El nombre debe tener al menos 2 caracteres.",
            })}
          </div>
        )}
      </div>

      {/* Logo upload */}
      <div style={{ marginBottom: fieldGap }}>
        <label style={labelStyle}>
          {t("companyInfo.logoLabel", { defaultMessage: "Logo de la empresa" })}{" "}
          <span style={{ color: colors.textLight, fontWeight: fontWeight.normal }}>
            ({t("companyInfo.optional", { defaultMessage: "opcional" })})
          </span>
        </label>

        {state.logoBase64 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radii["2xl"],
              border: `1px solid ${colors.borderLight}`,
              background: colors.bgLighter,
            }}
          >
            <img
              src={state.logoBase64}
              alt="Company logo preview"
              width={64}
              height={64}
              loading="lazy"
              decoding="async"
              style={{
                width: 64,
                height: 64,
                objectFit: "contain",
                borderRadius: radii.lg,
                background: colors.white,
                border: `1px solid ${colors.borderLight}`,
              }}
            />
            <button
              type="button"
              onClick={removeLogo}
              style={{
                background: colors.errorBg,
                color: colors.error,
                border: `1px solid ${colors.errorBorder}`,
                borderRadius: radii.lg,
                padding: `${spacing.sm}px ${spacing.md}px`,
                fontSize: fontSize.md,
                fontWeight: fontWeight.medium,
                cursor: "pointer",
              }}
            >
              {t("companyInfo.removeLogo", { defaultMessage: "Quitar" })}
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                width: "100%",
                padding: `${spacing.lg}px ${spacing.md}px`,
                borderRadius: radii["2xl"],
                border: `2px dashed ${colors.borderMedium}`,
                background: colors.bgLighter,
                color: colors.textMuted,
                fontSize: fontSize.base,
                fontWeight: fontWeight.medium,
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <span style={{ fontSize: 20 }}>&#128247;</span>
              {t("companyInfo.uploadLogo", {
                defaultMessage: "Subir logo",
              })}
            </button>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: fontSize.xs,
                color: colors.textLight,
                lineHeight: 1.5,
              }}
            >
              {t("companyInfo.logoFormats", {
                defaultMessage: "PNG, JPG, GIF o WebP. Máximo 500 KB.",
              })}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept={LOGO_ACCEPT_ATTR}
              onChange={handleLogoChange}
              style={{ display: "none" }}
            />
          </div>
        )}

        {logoError && (
          <div
            style={{
              marginTop: spacing.xs,
              fontSize: fontSize.sm,
              color: colors.error,
            }}
          >
            {logoError}
          </div>
        )}
      </div>

      {/* Brand colors */}
      <BrandColorsSection
        primary={state.primaryColor}
        secondary={state.secondaryColor}
        companyName={state.companyName}
        logoBase64={state.logoBase64}
        onPrimaryChange={(value) =>
          dispatch({ type: "SET_FIELD", field: "primaryColor", value })
        }
        onSecondaryChange={(value) =>
          dispatch({ type: "SET_FIELD", field: "secondaryColor", value })
        }
        onReset={() => {
          dispatch({ type: "SET_FIELD", field: "primaryColor", value: "" });
          dispatch({ type: "SET_FIELD", field: "secondaryColor", value: "" });
        }}
        marginBottom={fieldGap}
        t={t}
        isMobile={isMobile}
      />

      {/* Welcome message */}
      <div style={{ marginBottom: fieldGap }}>
        <label style={labelStyle}>
          {t("companyInfo.welcomeLabel", {
            defaultMessage: "Mensaje de bienvenida",
          })}{" "}
          <span style={{ color: colors.textLight, fontWeight: fontWeight.normal }}>
            ({t("companyInfo.optional", { defaultMessage: "opcional" })})
          </span>
        </label>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: fontSize.sm,
            color: colors.textLight,
            lineHeight: 1.5,
          }}
        >
          {t("companyInfo.welcomeHelp", {
            defaultMessage:
              "Este es el mensaje que verán tus colaboradores cada vez que entren a la polla.",
          })}
        </p>
        <textarea
          value={state.welcomeMessage}
          onChange={(e) =>
            dispatch({
              type: "SET_FIELD",
              field: "welcomeMessage",
              value: e.target.value,
            })
          }
          placeholder={t("companyInfo.welcomePlaceholder", {
            defaultMessage:
              "Ej: Bienvenidos a la quiniela corporativa de Acme Corp. Buena suerte!",
          })}
          style={textareaStyle}
          maxLength={500}
        />
        <div
          style={{
            textAlign: "right",
            fontSize: fontSize.xs,
            color: colors.textLight,
            marginTop: 2,
          }}
        >
          {state.welcomeMessage.length}/500
        </div>

        <WelcomeSplashPreview
          primary={state.primaryColor}
          secondary={state.secondaryColor}
          companyName={state.companyName}
          logoBase64={state.logoBase64}
          welcomeMessage={state.welcomeMessage}
          welcomePlaceholder={t("companyInfo.welcomePlaceholder", {
            defaultMessage:
              "Ej: Bienvenidos a la quiniela corporativa de Acme Corp. Buena suerte!",
          })}
          previewLabel={t("companyInfo.welcomePreviewLabel", {
            defaultMessage: "Vista previa: pantalla de bienvenida",
          })}
          badgeLabel={t("companyInfo.previewBadge", { defaultMessage: "Corporativo" })}
          ctaLabel={t("companyInfo.previewCta", { defaultMessage: "Jugar" })}
        />
      </div>

      {/* Invitation message */}
      <div>
        <label style={labelStyle}>
          {t("companyInfo.invitationLabel", {
            defaultMessage: "Mensaje de invitacion",
          })}{" "}
          <span style={{ color: colors.textLight, fontWeight: fontWeight.normal }}>
            ({t("companyInfo.optional", { defaultMessage: "opcional" })})
          </span>
        </label>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: fontSize.sm,
            color: colors.textLight,
            lineHeight: 1.5,
          }}
        >
          {t("companyInfo.invitationHelp", {
            defaultMessage:
              "Este es el mensaje que recibirán tus colaboradores en su correo cuando los invites a unirse.",
          })}
        </p>
        <textarea
          value={state.invitationMessage}
          onChange={(e) =>
            dispatch({
              type: "SET_FIELD",
              field: "invitationMessage",
              value: e.target.value,
            })
          }
          placeholder={t("companyInfo.invitationPlaceholder", {
            defaultMessage:
              "Este mensaje se incluira en el email de invitacion a los empleados.",
          })}
          style={textareaStyle}
          maxLength={500}
        />
        <div
          style={{
            textAlign: "right",
            fontSize: fontSize.xs,
            color: colors.textLight,
            marginTop: 2,
          }}
        >
          {state.invitationMessage.length}/500
        </div>

        <InvitationEmailPreview
          primary={state.primaryColor}
          secondary={state.secondaryColor}
          companyName={state.companyName}
          logoBase64={state.logoBase64}
          invitationMessage={state.invitationMessage}
          previewLabel={t("companyInfo.invitationPreviewLabel", {
            defaultMessage: "Vista previa: email de invitación",
          })}
          subjectLine={t("companyInfo.previewEmailSubject", {
            defaultMessage: "te reta a jugar",
          })}
          greeting={t("companyInfo.previewEmailGreeting", {
            defaultMessage: "Hey María!",
          })}
          body={t("companyInfo.previewEmailBody", {
            company: state.companyName.trim() || "tu empresa",
          })}
          ctaLabel={t("companyInfo.previewEmailCta", {
            defaultMessage: "Entrar a jugar →",
          })}
        />
      </div>
    </PoolWizardStepContainer>
  );
}

// ─── Brand colors subsection ─────────────────────────────────

interface BrandColorsSectionProps {
  primary: string;
  secondary: string;
  companyName: string;
  logoBase64: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  onReset: () => void;
  marginBottom: number;
  t: (key: string, opts?: Record<string, string | number | Date>) => string;
  isMobile: boolean;
}

function BrandColorsSection({
  primary,
  secondary,
  companyName,
  logoBase64,
  onPrimaryChange,
  onSecondaryChange,
  onReset,
  marginBottom,
  t,
  isMobile,
}: BrandColorsSectionProps) {
  const resolved = resolveBrandColors(primary || null, secondary || null);
  // Show the contrast warning only when the user has actually picked
  // colors — never nag about the safe Picks4All default.
  const showContrastWarning =
    resolved.isCustom && !hasGoodContrastAgainstWhite(resolved.primary, resolved.secondary);
  const hasOverride = primary !== "" || secondary !== "";
  const previewName = companyName.trim() || "Acme Corp";

  return (
    <div style={{ marginBottom }}>
      <label
        style={{
          display: "block",
          fontSize: fontSize.base,
          fontWeight: fontWeight.semibold,
          color: colors.textDark,
          marginBottom: 4,
        }}
      >
        {t("companyInfo.colorsLabel", { defaultMessage: "Colores de tu marca" })}{" "}
        <span style={{ color: colors.textLight, fontWeight: fontWeight.normal }}>
          ({t("companyInfo.optional", { defaultMessage: "opcional" })})
        </span>
      </label>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: fontSize.sm,
          color: colors.textLight,
          lineHeight: 1.5,
        }}
      >
        {t("companyInfo.colorsHelp", {
          defaultMessage:
            "Personaliza el splash, el header y los emails de invitación. Podrás cambiarlos más adelante desde el panel de administración.",
        })}
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: spacing.md,
        }}
      >
        <ColorField
          label={t("companyInfo.colorPrimary", { defaultMessage: "Color primario" })}
          value={primary}
          onChange={onPrimaryChange}
          fallback={PICKS4ALL_DEFAULT_PRIMARY}
        />
        <ColorField
          label={t("companyInfo.colorSecondary", { defaultMessage: "Color secundario" })}
          value={secondary}
          onChange={onSecondaryChange}
          fallback={PICKS4ALL_DEFAULT_SECONDARY}
        />
      </div>

      {hasOverride && (
        <button
          type="button"
          onClick={onReset}
          style={{
            marginTop: spacing.sm,
            background: "transparent",
            border: "none",
            color: colors.brand,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {t("companyInfo.colorsReset", {
            defaultMessage: "Restablecer al default Picks4All",
          })}
        </button>
      )}

      {/* Live preview */}
      <div
        aria-hidden="true"
        style={{
          marginTop: spacing.md,
          height: 88,
          borderRadius: radii.lg,
          background: buildSplashGradient(resolved.primary, resolved.secondary),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.md,
          padding: `0 ${spacing.lg}px`,
          color: colors.white,
          overflow: "hidden",
        }}
      >
        {logoBase64 ? (
          <img
            src={logoBase64}
            alt=""
            width={48}
            height={48}
            style={{
              width: 48,
              height: 48,
              objectFit: "contain",
              borderRadius: radii.md,
              background: "rgba(255,255,255,0.12)",
              padding: 4,
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.md,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: fontWeight.extrabold,
              flexShrink: 0,
            }}
          >
            {previewName.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.extrabold,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {previewName}
          </div>
          <div style={{ fontSize: fontSize.xs, opacity: 0.85 }}>
            {t("companyInfo.previewSubtitle", {
              defaultMessage: "Vista previa del splash",
            })}
          </div>
        </div>
      </div>

      {showContrastWarning && (
        <div
          role="alert"
          style={{
            marginTop: spacing.sm,
            padding: spacing.sm,
            borderRadius: radii.md,
            background: colors.warningBg,
            border: `1px solid ${colors.warningBorder}`,
            color: colors.warningDarker,
            fontSize: fontSize.sm,
            lineHeight: 1.5,
          }}
        >
          {t("companyInfo.contrastWarning", {
            defaultMessage:
              "Estos colores podrían dificultar la lectura del texto blanco. Te recomendamos elegir tonos más oscuros.",
          })}
        </div>
      )}
    </div>
  );
}

// ─── Welcome splash preview ───────────────────────────────────
//
// Mirrors the runtime splash at pools/[poolId]/page.tsx in miniature
// so the host can see exactly what their employees will see when
// they open the pool. Updates live as the host types the welcome
// message or changes brand colors.

interface WelcomeSplashPreviewProps {
  primary: string;
  secondary: string;
  companyName: string;
  logoBase64: string;
  welcomeMessage: string;
  welcomePlaceholder: string;
  previewLabel: string;
  badgeLabel: string;
  ctaLabel: string;
}

function WelcomeSplashPreview({
  primary,
  secondary,
  companyName,
  logoBase64,
  welcomeMessage,
  welcomePlaceholder,
  previewLabel,
  badgeLabel,
  ctaLabel,
}: WelcomeSplashPreviewProps) {
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

// ─── Invitation email preview ─────────────────────────────────
//
// Compact mock of the corporate invitation email body. Shows the
// hero band (gradient + logo + company name + subhead) and the
// message highlight box exactly as it lands in inbox. The greeting
// + body copy below are realistic samples so the host can see how
// their custom invitation message slots in.

interface InvitationEmailPreviewProps {
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

function InvitationEmailPreview({
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
}: InvitationEmailPreviewProps) {
  const brand = resolveBrandColors(primary || null, secondary || null);
  // Mirror backend/src/lib/emailTemplates.ts. Same philosophy as the
  // splash: keep custom colors literal so the preview matches what
  // the host picked.
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
