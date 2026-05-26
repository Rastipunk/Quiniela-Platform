"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWizard } from "../../PoolWizardContext";
import { PoolWizardStepContainer } from "../../PoolWizardStepContainer";
import { WizardSubStep } from "../../WizardSubStep";
import { ColorField } from "../../ColorField";
import { HeaderPreview } from "@/components/pool/branding-previews/HeaderPreview";
import { WelcomeSplashPreview } from "@/components/pool/branding-previews/WelcomeSplashPreview";
import { InvitationEmailPreview } from "@/components/pool/branding-previews/InvitationEmailPreview";
import {
  PICKS4ALL_DEFAULT_PRIMARY,
  PICKS4ALL_DEFAULT_SECONDARY,
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

  const optionalLabel = t("companyInfo.optional", { defaultMessage: "opcional" });

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
      {/* 1. Company name */}
      <WizardSubStep
        isFirst
        number={1}
        title={t("companyInfo.nameLabel", { defaultMessage: "Nombre de tu empresa" })}
        subtitle={t("companyInfo.subSteps.nameHelp", {
          defaultMessage:
            "Cómo aparecerá tu empresa en la pool, los emails de invitación y el splash de bienvenida.",
        })}
        requiredMark
      >
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
          aria-label={t("companyInfo.nameLabel", {
            defaultMessage: "Nombre de tu empresa",
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
      </WizardSubStep>

      {/* 2. Logo upload */}
      <WizardSubStep
        number={2}
        title={t("companyInfo.logoLabel", { defaultMessage: "Logo de la empresa" })}
        subtitle={t("companyInfo.subSteps.logoHelp", {
          defaultMessage:
            "Lo verán tus colaboradores en el splash, el header de la pool y los emails. Recomendado: cuadrado, fondo transparente.",
        })}
        optionalLabel={optionalLabel}
      >
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
      </WizardSubStep>

      {/* 3. Brand colors */}
      <WizardSubStep
        number={3}
        title={t("companyInfo.colorsLabel", {
          defaultMessage: "Colores de tu marca",
        })}
        subtitle={t("companyInfo.colorsHelp", {
          defaultMessage:
            "Personaliza el splash, el header y los emails de invitación. Podrás cambiarlos más adelante desde el panel de administración.",
        })}
        optionalLabel={optionalLabel}
      >
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
          t={t}
          isMobile={isMobile}
        />
      </WizardSubStep>

      {/* 4. Welcome message */}
      <WizardSubStep
        number={4}
        title={t("companyInfo.welcomeLabel", {
          defaultMessage: "Mensaje de bienvenida",
        })}
        subtitle={t("companyInfo.welcomeHelp", {
          defaultMessage:
            "Este es el mensaje que verán tus colaboradores cada vez que entren a la polla.",
        })}
        optionalLabel={optionalLabel}
      >
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
          aria-label={t("companyInfo.welcomeLabel", {
            defaultMessage: "Mensaje de bienvenida",
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
      </WizardSubStep>

      {/* 5. Invitation message */}
      <WizardSubStep
        number={5}
        title={t("companyInfo.invitationLabel", {
          defaultMessage: "Mensaje de invitacion",
        })}
        subtitle={t("companyInfo.invitationHelp", {
          defaultMessage:
            "Este es el mensaje que recibirán tus colaboradores en su correo cuando los invites a unirse.",
        })}
        optionalLabel={optionalLabel}
      >
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
          aria-label={t("companyInfo.invitationLabel", {
            defaultMessage: "Mensaje de invitacion",
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
      </WizardSubStep>

      {/* 6. Invitation locale */}
      <WizardSubStep
        number={6}
        title={t("companyInfo.invitationLocaleLabel", {
          defaultMessage: "Idioma de las invitaciones",
        })}
        subtitle={t("companyInfo.invitationLocaleHelp", {
          defaultMessage:
            "El primer correo a tus colaboradores se envía en este idioma. Cuando activen su cuenta, ellos pueden elegir su propio idioma para los correos siguientes.",
        })}
      >
        <InvitationLocalePicker
          value={state.invitationLocale}
          onChange={(value) =>
            dispatch({ type: "SET_FIELD", field: "invitationLocale", value })
          }
          isMobile={isMobile}
        />
      </WizardSubStep>
    </PoolWizardStepContainer>
  );
}

// ─── Invitation locale picker ────────────────────────────────

// Plain text labels — emoji flags render as letter codes (ES / GB / BR)
// on Windows because Microsoft never shipped Regional Indicator glyphs.
// Use the native language name + a small short-code pill on the side so
// the option is recognisable in every locale without OS-dependent fonts.
const LOCALE_OPTIONS: Array<{
  value: "es" | "en" | "pt";
  label: string;
  code: string;
}> = [
  { value: "es", label: "Español", code: "ES" },
  { value: "en", label: "English", code: "EN" },
  { value: "pt", label: "Português", code: "PT" },
];

function InvitationLocalePicker({
  value,
  onChange,
  isMobile,
}: {
  value: "es" | "en" | "pt";
  onChange: (next: "es" | "en" | "pt") => void;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: spacing.sm,
        flexWrap: "wrap",
        flexDirection: isMobile ? "column" : "row",
      }}
    >
      {LOCALE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: isMobile ? "1 1 auto" : "1 1 0",
              padding: `${spacing.md}px ${spacing.lg}px`,
              borderRadius: radii.lg,
              border: active
                ? `2px solid ${colors.brand}`
                : `1px solid ${colors.borderMedium}`,
              background: active ? colors.brandBg : colors.white,
              color: active ? colors.brand : colors.textDark,
              fontWeight: active ? fontWeight.semibold : fontWeight.medium,
              fontSize: fontSize.base,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              minHeight: 48,
              transition: "background 0.15s, border-color 0.15s",
            }}
            aria-pressed={active}
          >
            <span
              style={{
                fontSize: "0.7em",
                padding: "2px 8px",
                borderRadius: radii.md,
                background: active ? colors.brand : colors.bgLighter,
                color: active ? colors.white : colors.textMuted,
                fontWeight: fontWeight.bold,
                letterSpacing: "0.05em",
              }}
            >
              {opt.code}
            </span>
            {opt.label}
          </button>
        );
      })}
    </div>
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
    <div>
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

      {/* Live header band preview — same component used by
          PoolBrandingTab for post-creation editing. */}
      <HeaderPreview
        primary={primary}
        secondary={secondary}
        companyName={companyName}
        logoBase64={logoBase64}
        poolNameSample={t("companyInfo.headerPreviewPoolName", { defaultMessage: "Tu polla aquí" })}
        byCompanyLabel={t("companyInfo.headerPreviewByCompany", { company: previewName })}
        badgeLabel={t("companyInfo.headerPreviewSubtitle", { defaultMessage: "Vista previa del header" })}
      />

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
