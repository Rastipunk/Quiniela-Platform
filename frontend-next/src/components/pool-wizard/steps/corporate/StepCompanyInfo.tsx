"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWizard } from "../../PoolWizardContext";
import { PoolWizardStepContainer } from "../../PoolWizardStepContainer";

const MAX_LOGO_SIZE = 500 * 1024; // 500 KB

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
      return;
    }

    if (!file.type.startsWith("image/")) {
      setLogoError(
        t("companyInfo.logoInvalidType", {
          defaultMessage: "El archivo debe ser una imagen (PNG, JPG, SVG).",
        })
      );
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
          {t("companyInfo.nameLabel", { defaultMessage: "Nombre de la empresa" })}{" "}
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
                defaultMessage: "Subir logo (max 500 KB)",
              })}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
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
      </div>
    </PoolWizardStepContainer>
  );
}
