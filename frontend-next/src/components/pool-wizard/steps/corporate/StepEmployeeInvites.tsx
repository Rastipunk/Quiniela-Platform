"use client";

import { useRef, useMemo, useState } from "react";
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
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ count: number; errors: string[] } | null>(null);

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

  // ── Download template ────────────────────────────────────

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      const { downloadEmployeeTemplate } = await import("@/lib/employeeTemplate");
      await downloadEmployeeTemplate(state.companyName || undefined);
    } catch (err) {
      console.error("Template download failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  // ── Excel upload ─────────────────────────────────────────

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const { parseEmployeeExcel } = await import("@/lib/employeeTemplate");
      const result = await parseEmployeeExcel(file);

      if (result.emails.length > 0) {
        // Append to existing emails
        const existing = state.employeeEmails.trim();
        const newValue = existing
          ? existing + "\n" + result.emails.join("\n")
          : result.emails.join("\n");

        dispatch({
          type: "SET_FIELD",
          field: "employeeEmails",
          value: newValue,
        });
      }

      setUploadResult({ count: result.emails.length, errors: result.errors });
    } catch (err) {
      console.error("Excel parse failed:", err);
      setUploadResult({ count: 0, errors: ["Error al leer el archivo. Verifica que sea un archivo .xlsx válido."] });
    } finally {
      setUploading(false);
      // Reset input so same file can be selected again
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── Styles ────────────────────────────────────────────────

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 140,
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

  const actionBtnStyle = (variant: "primary" | "secondary"): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: `${spacing.md}px ${spacing.lg}px`,
    borderRadius: radii.lg,
    border: variant === "primary"
      ? `2px solid ${colors.brand}`
      : `1px solid ${colors.borderMedium}`,
    background: variant === "primary" ? colors.white : colors.bgLighter,
    color: variant === "primary" ? colors.brand : colors.textDark,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
  });

  return (
    <PoolWizardStepContainer
      title={t("employeeInvites.title", { defaultMessage: "Invitar empleados" })}
      subtitle={t("employeeInvites.subtitle", {
        defaultMessage: "Agrega los emails de los empleados que quieres invitar. Puedes hacer esto después también.",
      })}
      icon="&#x1F4E7;"
    >
      {/* Step 1: Download + Upload template */}
      <div style={{
        padding: isMobile ? spacing.lg : spacing.xl,
        borderRadius: radii["2xl"],
        border: `1px solid ${colors.borderLight}`,
        background: colors.bgLighter,
        marginBottom: spacing.xl,
      }}>
        <div style={{
          fontSize: fontSize.base,
          fontWeight: fontWeight.bold,
          color: colors.textDark,
          marginBottom: spacing.xs,
        }}>
          {t("employeeInvites.excelFlowTitle", { defaultMessage: "Importar desde Excel" })}
        </div>
        <p style={{
          margin: `0 0 ${spacing.md}px`,
          fontSize: fontSize.md,
          color: colors.textMuted,
          lineHeight: 1.5,
        }}>
          {t("employeeInvites.excelFlowDesc", {
            defaultMessage: "Descarga la plantilla, llénala con los correos de tus empleados y súbela aquí.",
          })}
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: spacing.md,
        }}>
          {/* Download template */}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={downloading}
            style={{
              ...actionBtnStyle("primary"),
              opacity: downloading ? 0.6 : 1,
              cursor: downloading ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!downloading) e.currentTarget.style.background = "#EEF2FF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = colors.white; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloading
              ? t("employeeInvites.downloading", { defaultMessage: "Descargando..." })
              : t("employeeInvites.downloadTemplate", { defaultMessage: "Descargar plantilla" })}
          </button>

          {/* Upload filled template */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              ...actionBtnStyle("secondary"),
              opacity: uploading ? 0.6 : 1,
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {uploading
              ? t("employeeInvites.uploading", { defaultMessage: "Procesando..." })
              : t("employeeInvites.uploadExcel", { defaultMessage: "Subir Excel con correos" })}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelUpload}
            style={{ display: "none" }}
          />
        </div>

        {/* Upload result feedback */}
        {uploadResult && (
          <div style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radii.lg,
            background: uploadResult.count > 0 ? colors.successBgLight : colors.warningBgLight,
            border: `1px solid ${uploadResult.count > 0 ? colors.successBorder : colors.warningBorderLight}`,
            fontSize: fontSize.md,
            lineHeight: 1.5,
          }}>
            {uploadResult.count > 0 && (
              <div style={{ color: colors.successDarker, fontWeight: fontWeight.semibold }}>
                {t("employeeInvites.uploadSuccess", {
                  defaultMessage: "{count} emails importados correctamente.",
                  count: uploadResult.count,
                })}
              </div>
            )}
            {uploadResult.errors.length > 0 && (
              <div style={{ color: colors.warningDarker, marginTop: uploadResult.count > 0 ? 4 : 0 }}>
                {uploadResult.errors.slice(0, 3).map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
                {uploadResult.errors.length > 3 && (
                  <div style={{ fontStyle: "italic" }}>
                    +{uploadResult.errors.length - 3} more...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual email entry */}
      <div style={{ marginBottom: spacing.lg }}>
        <label style={{
          display: "block",
          fontSize: fontSize.base,
          fontWeight: fontWeight.semibold,
          color: colors.textDark,
          marginBottom: spacing.xs,
        }}>
          {t("employeeInvites.manualLabel", { defaultMessage: "O escríbelos manualmente" })}{" "}
          <span style={{ color: colors.textLight, fontWeight: fontWeight.normal }}>
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
            defaultMessage: "maria@empresa.com\njuan@empresa.com\ncarlos@empresa.com",
          })}
          style={textareaStyle}
        />
        <div style={{
          fontSize: fontSize.sm,
          color: colors.textLight,
          marginTop: spacing.xs,
        }}>
          {t("employeeInvites.hint", {
            defaultMessage: "Separa los emails con comas o saltos de línea.",
          })}
        </div>
      </div>

      {/* Count display */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: spacing.md,
        borderRadius: radii["2xl"],
        background: emailCount > 0 ? colors.successBgLight : colors.bgLighter,
        border: `1px solid ${emailCount > 0 ? colors.successBorder : colors.borderLight}`,
      }}>
        <div style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: emailCount > 0 ? colors.successDarker : colors.textMuted,
        }}>
          {emailCount > 0
            ? t("employeeInvites.count", { defaultMessage: "{count} emails ingresados", count: emailCount })
            : t("employeeInvites.noEmails", { defaultMessage: "Sin emails ingresados" })}
        </div>

        {emailCount > 0 && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "SET_FIELD", field: "employeeEmails", value: "" });
              setUploadResult(null);
            }}
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
            {t("employeeInvites.clearAll", { defaultMessage: "Limpiar todo" })}
          </button>
        )}
      </div>

      {/* Invalid emails warning */}
      {invalidEmails.length > 0 && (
        <div style={{
          marginTop: spacing.md,
          padding: spacing.md,
          borderRadius: radii["2xl"],
          background: colors.warningBgLight,
          border: `1px solid ${colors.warningBorderLight}`,
          fontSize: fontSize.md,
          color: colors.warningDarker,
          lineHeight: 1.5,
        }}>
          <strong>
            {t("employeeInvites.invalidTitle", { defaultMessage: "Emails con formato inválido:" })}
          </strong>
          <div style={{ marginTop: spacing.xs, fontFamily: "monospace" }}>
            {invalidEmails.slice(0, 5).join(", ")}
            {invalidEmails.length > 5 && ` (+${invalidEmails.length - 5})`}
          </div>
        </div>
      )}

      {/* Info note */}
      <div style={{
        marginTop: spacing.lg,
        padding: spacing.md,
        borderRadius: radii["2xl"],
        background: colors.infoBgLight,
        border: `1px solid ${colors.infoBorder}`,
        fontSize: fontSize.md,
        color: colors.infoDarker,
        lineHeight: 1.5,
      }}>
        {t("employeeInvites.note", {
          defaultMessage: "Este paso es opcional. Puedes agregar empleados desde el panel de administración después de crear el pool.",
        })}
      </div>
    </PoolWizardStepContainer>
  );
}
