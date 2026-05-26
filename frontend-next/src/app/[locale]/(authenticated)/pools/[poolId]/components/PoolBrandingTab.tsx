"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getToken } from "@/lib/auth";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  colors,
  radii,
  spacing,
  fontSize,
  fontWeight,
} from "@/lib/theme";
import { WizardSubStep } from "@/components/pool-wizard/WizardSubStep";
import { ColorField } from "@/components/pool-wizard/ColorField";
import { HeaderPreview } from "@/components/pool/branding-previews/HeaderPreview";
import { WelcomeSplashPreview } from "@/components/pool/branding-previews/WelcomeSplashPreview";
import { InvitationEmailPreview } from "@/components/pool/branding-previews/InvitationEmailPreview";
import {
  PICKS4ALL_DEFAULT_PRIMARY,
  PICKS4ALL_DEFAULT_SECONDARY,
  hasGoodContrastAgainstWhite,
  resolveBrandColors,
} from "@/lib/brandColors";
import { updatePoolBranding, type UpdatePoolBrandingInput } from "@/lib/api";
import type { PoolOverview } from "@/lib/api";

// Post-creation branding editor for corporate pools. Mirrors the
// shape of the wizard's StepCompanyInfo (logo / colors / welcome /
// invitation) but skips the company name (identity is locked after
// creation) and replaces the wizard's "next step" navigation with
// a save-or-discard footer.
//
// Live previews come from `components/pool/branding-previews/` —
// the very same components the wizard uses. The form sends a diff
// payload to PATCH /corporate/pools/:poolId/branding so unchanged
// fields are never touched.

const MAX_LOGO_SIZE = 500 * 1024; // 500 KB — backend caps at 700 KB raw
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
const LOGO_ACCEPT_ATTR = ALLOWED_LOGO_TYPES.join(",");

interface Props {
  poolId: string;
  overview: PoolOverview;
  /** Refetch overview so splash + header pick up the new branding. */
  onSaved: () => void;
}

export function PoolBrandingTab({ poolId, overview, onSaved }: Props) {
  const t = useTranslations("poolWizard");
  const tPool = useTranslations("pool");
  const isMobile = useIsMobile();
  const fileRef = useRef<HTMLInputElement>(null);

  const org = overview.pool.organization;

  // Initial values from current organization. Empty string is the
  // "unset" sentinel for color/textarea fields throughout the app.
  // invitationLocale is non-nullable so it falls back to "es" only if
  // the org somehow lacks the field (legacy rows pre-migration).
  const initial = useMemo(
    () => ({
      logoBase64: org?.logoBase64 ?? "",
      primaryColor: org?.primaryColor ?? "",
      secondaryColor: org?.secondaryColor ?? "",
      welcomeMessage: org?.welcomeMessage ?? "",
      invitationMessage: org?.invitationMessage ?? "",
      invitationLocale: (org?.invitationLocale ?? "es") as "es" | "en" | "pt",
    }),
    [org],
  );

  const [logoBase64, setLogoBase64] = useState(initial.logoBase64);
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(initial.secondaryColor);
  const [welcomeMessage, setWelcomeMessage] = useState(initial.welcomeMessage);
  const [invitationMessage, setInvitationMessage] = useState(initial.invitationMessage);
  const [invitationLocale, setInvitationLocale] = useState(initial.invitationLocale);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<
    | { kind: "success"; text: string }
    | { kind: "error"; text: string }
    | null
  >(null);

  // Bail out gracefully if the pool has no organization. The drawer
  // already hides this tab in that case (showBrandingTab=false), but
  // a manually crafted ?tab=personalizacion URL on a non-corporate
  // pool would otherwise crash on `org!.logoBase64`.
  if (!org) {
    return (
      <div
        style={{
          marginTop: 14,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 14,
          background: colors.white,
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        {tPool("branding.futureOnlyNote")}
      </div>
    );
  }

  const companyName = org.name;
  const hasChanges =
    logoBase64 !== initial.logoBase64 ||
    primaryColor !== initial.primaryColor ||
    secondaryColor !== initial.secondaryColor ||
    welcomeMessage !== initial.welcomeMessage ||
    invitationMessage !== initial.invitationMessage ||
    invitationLocale !== initial.invitationLocale;

  const optionalLabel = t("companyInfo.optional", { defaultMessage: "opcional" });

  // ── Logo handling ───────────────────────────────────────

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);

    if (file.size > MAX_LOGO_SIZE) {
      setLogoError(
        t("companyInfo.logoTooLarge", { defaultMessage: "El logo no puede exceder 500 KB." }),
      );
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type as typeof ALLOWED_LOGO_TYPES[number])) {
      setLogoError(
        t("companyInfo.logoInvalidType", {
          defaultMessage:
            "Sube tu logo en PNG, JPG, GIF o WebP. Los SVG no son compatibles con todos los clientes de email.",
        }),
      );
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLogoBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogoBase64("");
    setLogoError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function discard() {
    setLogoBase64(initial.logoBase64);
    setPrimaryColor(initial.primaryColor);
    setSecondaryColor(initial.secondaryColor);
    setWelcomeMessage(initial.welcomeMessage);
    setInvitationMessage(initial.invitationMessage);
    setInvitationLocale(initial.invitationLocale);
    setLogoError(null);
    setStatusMessage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetColors() {
    setPrimaryColor("");
    setSecondaryColor("");
  }

  async function save() {
    if (!hasChanges || busy) return;
    const token = getToken();
    if (!token) {
      setStatusMessage({ kind: "error", text: tPool("branding.saveError") });
      return;
    }

    // Build a diff payload — undefined = leave untouched, null = clear.
    // We treat empty string as "clear" to match the rest of the flow.
    const payload: UpdatePoolBrandingInput = {};
    if (logoBase64 !== initial.logoBase64) {
      payload.logoBase64 = logoBase64 || null;
    }
    if (primaryColor !== initial.primaryColor) {
      payload.primaryColor = primaryColor || null;
    }
    if (secondaryColor !== initial.secondaryColor) {
      payload.secondaryColor = secondaryColor || null;
    }
    if (welcomeMessage !== initial.welcomeMessage) {
      payload.welcomeMessage = welcomeMessage || null;
    }
    if (invitationMessage !== initial.invitationMessage) {
      payload.invitationMessage = invitationMessage || null;
    }
    if (invitationLocale !== initial.invitationLocale) {
      // Non-nullable on the server — never send null here.
      payload.invitationLocale = invitationLocale;
    }

    setBusy(true);
    setStatusMessage(null);
    try {
      await updatePoolBranding(token, poolId, payload);
      onSaved();
      setStatusMessage({ kind: "success", text: tPool("branding.saved") });
    } catch {
      setStatusMessage({ kind: "error", text: tPool("branding.saveError") });
    } finally {
      setBusy(false);
    }
  }

  // ── Styles shared with form fields ──────────────────────

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

  const resolved = resolveBrandColors(primaryColor || null, secondaryColor || null);
  const showContrastWarning =
    resolved.isCustom && !hasGoodContrastAgainstWhite(resolved.primary, resolved.secondary);
  const hasOverride = primaryColor !== "" || secondaryColor !== "";
  const previewName = companyName.trim() || "Acme Corp";

  return (
    <div
      style={{
        marginTop: 14,
        padding: isMobile ? 16 : 24,
        border: "1px solid #ddd",
        borderRadius: 14,
        background: colors.white,
      }}
    >
      {/* 1. Logo */}
      <WizardSubStep
        isFirst
        number={1}
        title={t("companyInfo.logoLabel", { defaultMessage: "Logo de la empresa" })}
        subtitle={t("companyInfo.subSteps.logoHelp", {
          defaultMessage:
            "Lo verán tus colaboradores en el splash, el header de la pool y los emails. Recomendado cuadrado, con fondo transparente.",
        })}
        optionalLabel={optionalLabel}
      >
        {logoBase64 ? (
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
              src={logoBase64}
              alt="Logo"
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
          <>
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
              }}
            >
              <span style={{ fontSize: 20 }}>&#128247;</span>
              {t("companyInfo.uploadLogo", { defaultMessage: "Subir logo" })}
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
          </>
        )}
        {logoError && (
          <div style={{ marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.error }}>
            {logoError}
          </div>
        )}
      </WizardSubStep>

      {/* 2. Brand colors */}
      <WizardSubStep
        number={2}
        title={t("companyInfo.colorsLabel", { defaultMessage: "Colores de tu marca" })}
        subtitle={t("companyInfo.colorsHelp", {
          defaultMessage:
            "Personaliza el splash, el header y los emails de invitación. Podrás cambiarlos cuando quieras desde aquí.",
        })}
        optionalLabel={optionalLabel}
      >
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: spacing.md,
          }}
        >
          <ColorField
            label={t("companyInfo.colorPrimary", { defaultMessage: "Color primario" })}
            value={primaryColor}
            onChange={setPrimaryColor}
            fallback={PICKS4ALL_DEFAULT_PRIMARY}
          />
          <ColorField
            label={t("companyInfo.colorSecondary", { defaultMessage: "Color secundario" })}
            value={secondaryColor}
            onChange={setSecondaryColor}
            fallback={PICKS4ALL_DEFAULT_SECONDARY}
          />
        </div>
        {hasOverride && (
          <button
            type="button"
            onClick={resetColors}
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
        <HeaderPreview
          primary={primaryColor}
          secondary={secondaryColor}
          companyName={companyName}
          logoBase64={logoBase64}
          poolNameSample={t("companyInfo.headerPreviewPoolName", {
            defaultMessage: "Tu polla aquí",
          })}
          byCompanyLabel={t("companyInfo.headerPreviewByCompany", { company: previewName })}
          badgeLabel={t("companyInfo.headerPreviewSubtitle", {
            defaultMessage: "Vista previa del header",
          })}
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
      </WizardSubStep>

      {/* 3. Welcome message */}
      <WizardSubStep
        number={3}
        title={t("companyInfo.welcomeLabel", { defaultMessage: "Mensaje de bienvenida" })}
        subtitle={t("companyInfo.welcomeHelp", {
          defaultMessage:
            "Este es el mensaje que verán tus colaboradores cada vez que entren a la polla.",
        })}
        optionalLabel={optionalLabel}
      >
        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          placeholder={t("companyInfo.welcomePlaceholder", {
            defaultMessage:
              "Ej: Bienvenidos a la quiniela corporativa de Acme Corp. Buena suerte!",
          })}
          aria-label={t("companyInfo.welcomeLabel", { defaultMessage: "Mensaje de bienvenida" })}
          style={textareaStyle}
          maxLength={1000}
        />
        <div
          style={{
            textAlign: "right",
            fontSize: fontSize.xs,
            color: colors.textLight,
            marginTop: 2,
          }}
        >
          {welcomeMessage.length}/1000
        </div>
        <WelcomeSplashPreview
          primary={primaryColor}
          secondary={secondaryColor}
          companyName={companyName}
          logoBase64={logoBase64}
          welcomeMessage={welcomeMessage}
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

      {/* 4. Invitation message */}
      <WizardSubStep
        number={4}
        title={t("companyInfo.invitationLabel", { defaultMessage: "Mensaje de invitacion" })}
        subtitle={t("companyInfo.invitationHelp", {
          defaultMessage:
            "Este es el mensaje que recibirán tus colaboradores en su correo cuando los invites a unirse.",
        })}
        optionalLabel={optionalLabel}
      >
        <textarea
          value={invitationMessage}
          onChange={(e) => setInvitationMessage(e.target.value)}
          placeholder={t("companyInfo.invitationPlaceholder", {
            defaultMessage:
              "Este mensaje se incluira en el email de invitacion a los empleados.",
          })}
          aria-label={t("companyInfo.invitationLabel", { defaultMessage: "Mensaje de invitacion" })}
          style={textareaStyle}
          maxLength={1000}
        />
        <div
          style={{
            textAlign: "right",
            fontSize: fontSize.xs,
            color: colors.textLight,
            marginTop: 2,
          }}
        >
          {invitationMessage.length}/1000
        </div>
        <InvitationEmailPreview
          primary={primaryColor}
          secondary={secondaryColor}
          companyName={companyName}
          logoBase64={logoBase64}
          invitationMessage={invitationMessage}
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
            company: companyName.trim() || "tu empresa",
          })}
          ctaLabel={t("companyInfo.previewEmailCta", {
            defaultMessage: "Entrar a jugar →",
          })}
        />
        <div
          role="note"
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            background: colors.infoBgLight,
            border: `1px solid ${colors.infoBorder}`,
            fontSize: fontSize.sm,
            color: colors.infoDarker,
            lineHeight: 1.5,
          }}
        >
          {tPool("branding.futureOnlyNote")}
        </div>
      </WizardSubStep>

      {/* 5. Invitation locale */}
      <WizardSubStep
        number={5}
        title={t("companyInfo.invitationLocaleLabel", {
          defaultMessage: "Idioma de las invitaciones",
        })}
        subtitle={t("companyInfo.invitationLocaleHelp", {
          defaultMessage:
            "El primer correo a tus colaboradores se envía en este idioma. Cuando activen su cuenta, ellos pueden elegir su propio idioma para los correos siguientes.",
        })}
      >
        <BrandingInvitationLocalePicker
          value={invitationLocale}
          onChange={setInvitationLocale}
          isMobile={isMobile}
        />
      </WizardSubStep>

      {/* Save / Discard footer */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: spacing["2xl"],
          paddingTop: spacing.md,
          background: colors.white,
          borderTop: `1px solid ${colors.borderLight}`,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: spacing.sm,
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "flex-end",
        }}
      >
        {statusMessage && (
          <span
            role={statusMessage.kind === "error" ? "alert" : "status"}
            style={{
              flex: isMobile ? undefined : 1,
              fontSize: fontSize.sm,
              color: statusMessage.kind === "error" ? colors.error : colors.successDarker,
              fontWeight: fontWeight.semibold,
              textAlign: isMobile ? "center" : "left",
            }}
          >
            {statusMessage.text}
          </span>
        )}
        <button
          type="button"
          onClick={discard}
          disabled={!hasChanges || busy}
          style={{
            padding: "12px 18px",
            borderRadius: radii.lg,
            border: `1px solid ${colors.borderMedium}`,
            background: colors.white,
            color: hasChanges && !busy ? colors.textDark : colors.textLight,
            fontSize: fontSize.base,
            fontWeight: fontWeight.medium,
            cursor: hasChanges && !busy ? "pointer" : "not-allowed",
          }}
        >
          {tPool("branding.discardChanges")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!hasChanges || busy}
          style={{
            padding: "12px 22px",
            borderRadius: radii.lg,
            border: "none",
            background: hasChanges && !busy ? colors.brand : colors.disabled,
            color: colors.white,
            fontSize: fontSize.base,
            fontWeight: fontWeight.bold,
            cursor: hasChanges && !busy ? "pointer" : "not-allowed",
          }}
        >
          {busy ? tPool("branding.saving") : tPool("branding.saveChanges")}
        </button>
      </div>
    </div>
  );
}

// ─── Invitation locale picker ────────────────────────────────

const LOCALE_OPTIONS: Array<{
  value: "es" | "en" | "pt";
  label: string;
  flag: string;
}> = [
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "pt", label: "Português", flag: "🇧🇷" },
];

function BrandingInvitationLocalePicker({
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
            <span style={{ fontSize: "1.2em" }}>{opt.flag}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
