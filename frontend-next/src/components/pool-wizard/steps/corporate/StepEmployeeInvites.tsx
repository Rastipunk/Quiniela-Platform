"use client";

import { useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWizard } from "../../PoolWizardContext";
import { PoolWizardStepContainer } from "../../PoolWizardStepContainer";

export function StepEmployeeInvites() {
  const t = useTranslations("poolWizard");
  const isMobile = useIsMobile();
  const { state, dispatch } = useWizard();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Parse email count ─────────────────────────────────────

  const parsedEmails = useMemo(() => {
    return state.employeeEmails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  }, [state.employeeEmails]);

  const emailCount = parsedEmails.length;

  // Simple email validation
  const invalidEmails = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return parsedEmails.filter((e) => !emailRegex.test(e));
  }, [parsedEmails]);

  // ── CSV upload ────────────────────────────────────────────

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      // Parse CSV: look for email-like values in each row
      const emailRegex = /[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/g;
      const found = text.match(emailRegex) || [];
      const unique = [...new Set(found.map((e) => e.toLowerCase()))];

      if (unique.length === 0) return;

      // Append to existing emails
      const existing = state.employeeEmails.trim();
      const newValue = existing
        ? existing + "\n" + unique.join("\n")
        : unique.join("\n");

      dispatch({
        type: "SET_FIELD",
        field: "employeeEmails",
        value: newValue,
      });
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Styles ────────────────────────────────────────────────

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 160,
    padding: isMobile ? "14px 12px" : "12px",
    borderRadius: radii.lg,
    border: `1px solid ${colors.borderMedium}`,
    fontSize: isMobile ? fontSize.xl : fontSize.base,
    fontFamily: "monospace",
    lineHeight: 1.6,
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  return (
    <PoolWizardStepContainer
      title={t("employeeInvites.title", {
        defaultMessage: "Invitar empleados",
      })}
      subtitle={t("employeeInvites.subtitle", {
        defaultMessage:
          "Agrega los emails de los empleados que quieres invitar. Puedes hacer esto despues tambien.",
      })}
      icon="&#x1F4E7;"
    >
      {/* Email textarea */}
      <div style={{ marginBottom: spacing.lg }}>
        <label
          style={{
            display: "block",
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: colors.textDark,
            marginBottom: spacing.xs,
          }}
        >
          {t("employeeInvites.emailsLabel", {
            defaultMessage: "Emails de empleados",
          })}{" "}
          <span
            style={{
              color: colors.textLight,
              fontWeight: fontWeight.normal,
            }}
          >
            ({t("employeeInvites.optional", { defaultMessage: "opcional" })})
          </span>
        </label>
        <textarea
          value={state.employeeEmails}
          onChange={(e) =>
            dispatch({
              type: "SET_FIELD",
              field: "employeeEmails",
              value: e.target.value,
            })
          }
          placeholder={t("employeeInvites.placeholder", {
            defaultMessage:
              "maria@empresa.com\njuan@empresa.com\ncarlos@empresa.com",
          })}
          style={textareaStyle}
        />
        <div
          style={{
            fontSize: fontSize.sm,
            color: colors.textLight,
            marginTop: spacing.xs,
          }}
        >
          {t("employeeInvites.hint", {
            defaultMessage:
              "Separa los emails con comas o saltos de linea.",
          })}
        </div>
      </div>

      {/* CSV upload */}
      <div style={{ marginBottom: spacing.lg }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            width: "100%",
            padding: `${spacing.md}px ${spacing.lg}px`,
            borderRadius: radii.lg,
            border: `1px solid ${colors.borderMedium}`,
            background: colors.bgLighter,
            color: colors.textDark,
            fontSize: fontSize.base,
            fontWeight: fontWeight.medium,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          <span style={{ fontSize: 18 }}>&#128196;</span>
          {t("employeeInvites.uploadCsv", {
            defaultMessage: "Importar desde CSV",
          })}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleCsvUpload}
          style={{ display: "none" }}
        />
      </div>

      {/* Count display */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: spacing.md,
          borderRadius: radii["2xl"],
          background:
            emailCount > 0 ? colors.successBgLight : colors.bgLighter,
          border: `1px solid ${
            emailCount > 0 ? colors.successBorder : colors.borderLight
          }`,
        }}
      >
        <div
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color:
              emailCount > 0 ? colors.successDarker : colors.textMuted,
          }}
        >
          {emailCount > 0
            ? t("employeeInvites.count", {
                defaultMessage: "{count} emails ingresados",
                count: emailCount,
              })
            : t("employeeInvites.noEmails", {
                defaultMessage: "Sin emails ingresados",
              })}
        </div>

        {emailCount > 0 && (
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "SET_FIELD",
                field: "employeeEmails",
                value: "",
              })
            }
            style={{
              background: "none",
              border: "none",
              color: colors.error,
              fontSize: fontSize.md,
              fontWeight: fontWeight.medium,
              cursor: "pointer",
              padding: `${spacing.xs}px ${spacing.sm}px`,
            }}
          >
            {t("employeeInvites.clearAll", {
              defaultMessage: "Limpiar todo",
            })}
          </button>
        )}
      </div>

      {/* Invalid emails warning */}
      {invalidEmails.length > 0 && (
        <div
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radii["2xl"],
            background: colors.warningBgLight,
            border: `1px solid ${colors.warningBorderLight}`,
            fontSize: fontSize.md,
            color: colors.warningDarker,
            lineHeight: 1.5,
          }}
        >
          <strong>
            {t("employeeInvites.invalidTitle", {
              defaultMessage: "Emails con formato invalido:",
            })}
          </strong>
          <div style={{ marginTop: spacing.xs, fontFamily: "monospace" }}>
            {invalidEmails.slice(0, 5).join(", ")}
            {invalidEmails.length > 5 && ` (+${invalidEmails.length - 5})`}
          </div>
        </div>
      )}

      {/* Info note */}
      <div
        style={{
          marginTop: spacing.lg,
          padding: spacing.md,
          borderRadius: radii["2xl"],
          background: colors.infoBgLight,
          border: `1px solid ${colors.infoBorder}`,
          fontSize: fontSize.md,
          color: colors.infoDarker,
          lineHeight: 1.5,
        }}
      >
        {t("employeeInvites.note", {
          defaultMessage:
            "Este paso es opcional. Puedes agregar empleados desde el panel de administracion despues de crear el pool.",
        })}
      </div>
    </PoolWizardStepContainer>
  );
}
