"use client";

import { useRouter } from "@/i18n/navigation";
import { colors } from "@/lib/theme";

import { useState, useMemo, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePoolTerm } from "@/contexts/PoolTermContext";
import {
  getCorporateEmployees,
  addCorporateEmployees,
  sendCorporateInvitations,
  deleteCorporateEmployee,
  resendCorporateInvitation,
} from "@/lib/api";

type Invite = {
  id: string;
  email: string;
  name?: string | null;
  status: "PENDING" | "SENT" | "ACTIVATED" | "FAILED";
  activatedAt?: string | null;
};

type Props = {
  poolId: string;
  token: string;
  isMobile: boolean;
  maxParticipants?: number;
  currentMembers?: number;
};

export function CorporateEmployeeManager({ poolId, token, isMobile, maxParticipants, currentMembers }: Props) {
  const t = useTranslations("pool.admin.employees");
  const router = useRouter();
  const { params: poolParams } = usePoolTerm();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [emailsText, setEmailsText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const excelFileRef = useRef<HTMLInputElement>(null);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await getCorporateEmployees(token, poolId);
      setInvites(data.invites ?? []);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [token, poolId]);

  // Load on first render
  if (!loaded) {
    loadEmployees();
  }

  const validEmails = useMemo(() => {
    if (!emailsText.trim()) return [];
    const lines = emailsText
      .split(/[\n,;]+/)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return [...new Set(lines.filter((l) => emailRegex.test(l)))];
  }, [emailsText]);

  const activatedCount = invites.filter((i) => i.status === "ACTIVATED").length;
  const pendingCount = invites.filter((i) => i.status === "PENDING").length;

  async function handleAdd() {
    if (!validEmails.length) return;
    setBusy("adding");
    setMessage(null);
    try {
      const result = await addCorporateEmployees(token, poolId, validEmails);
      setMessage(t("addResult", { added: result.added, skipped: result.skipped }));
      setEmailsText("");
      await loadEmployees();
    } catch (e: any) {
      setMessage(e?.message ?? "Error");
    } finally {
      setBusy(null);
    }
  }

  async function handleSendInvitations() {
    setBusy("sending");
    setMessage(null);
    try {
      const result = await sendCorporateInvitations(token, poolId);
      setMessage(t("sendResult", { sent: result.sent, failed: result.failed }));
      await loadEmployees();
    } catch (e: any) {
      setMessage(e?.message ?? "Error");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(inviteId: string) {
    setBusy(`delete-${inviteId}`);
    setMessage(null);
    try {
      await deleteCorporateEmployee(token, poolId, inviteId);
      await loadEmployees();
    } catch (e: any) {
      setMessage(e?.message ?? "Error");
    } finally {
      setBusy(null);
    }
  }

  async function handleResend(inviteId: string) {
    setBusy(`resend-${inviteId}`);
    setMessage(null);
    try {
      const result = await resendCorporateInvitation(token, poolId, inviteId);
      // Reflect the actual outcome — the backend rotates the token and tries
      // to send. Email-provider failures are surfaced as result.status="FAILED"
      // so the host sees real status (the row is now FAILED in the list too).
      setMessage(
        result.status === "SENT"
          ? t("resendSuccess", { email: result.email })
          : t("resendFailed", { email: result.email }),
      );
      await loadEmployees();
    } catch (e: any) {
      setMessage(e?.message ?? "Error");
    } finally {
      setBusy(null);
    }
  }

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    try {
      const { downloadEmployeeTemplate } = await import("@/lib/employeeTemplate");
      await downloadEmployeeTemplate();
    } catch (err) {
      console.error("Template download failed:", err);
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingExcel(true);
    try {
      const { parseEmployeeExcel } = await import("@/lib/employeeTemplate");
      const result = await parseEmployeeExcel(file);
      if (result.emails.length > 0) {
        setEmailsText((prev) => {
          const existing = prev.trim();
          return existing ? existing + "\n" + result.emails.join("\n") : result.emails.join("\n");
        });
        setMessage(t("excelUploadSuccess", { count: result.emails.length }));
      } else {
        setMessage(t("excelUploadEmpty"));
      }
    } catch {
      setMessage(t("excelUploadError"));
    } finally {
      setUploadingExcel(false);
      if (excelFileRef.current) excelFileRef.current.value = "";
    }
  }

  const statusColors: Record<string, { bg: string; color: string; border: string }> = {
    PENDING: { bg: colors.warningBgAmber, color: colors.warningDarker, border: "#fcd34d" },
    SENT: { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
    ACTIVATED: { bg: colors.successBgLight, color: colors.successDarker, border: "#6ee7b7" },
    FAILED: { bg: "#fee2e2", color: colors.errorDarker, border: colors.errorBorderLight },
  };

  const statusLabels: Record<string, string> = {
    PENDING: t("statusPending"),
    SENT: t("statusSent"),
    ACTIVATED: t("statusActivated"),
    FAILED: t("statusFailed"),
  };

  return (
    <div
      style={{
        marginTop: 24,
        padding: isMobile ? 16 : 20,
        background: "linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)",
        border: "2px solid #a78bfa",
        borderRadius: 12,
      }}
    >
      <h4 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: "#4c1d95" }}>
        {"\u{1F3E2}"} {t("title")}
      </h4>
      <p style={{ fontSize: 13, color: "#6b21a8", margin: "0 0 16px" }}>
        {t("subtitle", poolParams)}
      </p>

      {/* Capacity badge — always visible when capacity is configured.
          Three states: normal (<95%), warning (95–99%), full (100%). */}
      {maxParticipants != null && currentMembers != null && maxParticipants > 0 && (() => {
        const pct = Math.min(100, Math.round((currentMembers / maxParticipants) * 100));
        const isFull = currentMembers >= maxParticipants;
        // 95% threshold mirrors the backend default (CAPACITY_WARNING_THRESHOLD_PCT).
        // The UI doesn't know per-pool overrides, so we treat 95 as the universal trigger
        // for the visual alert; backend dispatches the actual email by its own threshold.
        const isWarning = !isFull && pct >= 95;
        const palette = isFull
          ? { bg: colors.errorBg, border: colors.errorBorder, text: colors.errorDarker, fill: colors.error }
          : isWarning
            ? { bg: colors.warningBgAmber, border: colors.warningBorder, text: colors.warningDarker, fill: colors.warning }
            : { bg: "white", border: "#c4b5fd", text: "#4c1d95", fill: colors.purple };
        const noteKey = isFull ? "capacityBadgeFullNote" : isWarning ? "capacityBadgeWarningNote" : null;
        return (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: palette.bg,
              border: `1px solid ${palette.border}`,
              borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: palette.text }}>
                {t("capacityBadge", { current: currentMembers, max: maxParticipants, pct })}
              </span>
              {(isWarning || isFull) && (
                <button
                  type="button"
                  onClick={() => router.push(`/pools/${poolId}?tab=admin` as never)}
                  style={{
                    fontSize: 12,
                    color: palette.text,
                    fontWeight: 600,
                    textDecoration: "underline",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {t("capacityCta")}
                </button>
              )}
            </div>
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ height: 6, borderRadius: 3, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}
            >
              <div style={{ width: `${pct}%`, height: "100%", background: palette.fill, transition: "width 0.3s ease" }} />
            </div>
            {noteKey && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: palette.text, lineHeight: 1.4 }}>
                {t(noteKey)}
              </p>
            )}
          </div>
        );
      })()}

      {/* Progress */}
      {invites.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 10,
            background: "white",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: "#4c1d95",
          }}
        >
          {t("activated", { count: activatedCount, total: invites.length })}
        </div>
      )}

      {/* Add emails */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#4c1d95" }}>
          {t("addTitle")}
        </div>
        <textarea
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          placeholder={t("emailsPlaceholder")}
          rows={3}
          style={{
            width: "100%",
            padding: 10,
            fontSize: 13,
            borderRadius: 8,
            border: "1px solid #c4b5fd",
            background: "white",
            fontFamily: "monospace",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
        {validEmails.length > 0 && (
          <div style={{ fontSize: 12, color: colors.successAlt, marginTop: 4, fontWeight: 600 }}>
            {"\u2705"} {validEmails.length} emails
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={handleAdd}
            disabled={!validEmails.length || busy === "adding"}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: validEmails.length > 0 ? colors.purple : colors.borderMedium,
              color: validEmails.length > 0 ? "white" : colors.textLighter,
              fontSize: 13,
              fontWeight: 600,
              cursor: validEmails.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            {busy === "adding" ? t("adding") : t("addButton")}
          </button>
          <button
            onClick={() => excelFileRef.current?.click()}
            disabled={uploadingExcel}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #c4b5fd",
              background: "white",
              fontSize: 13,
              color: "#4c1d95",
              cursor: uploadingExcel ? "not-allowed" : "pointer",
              fontWeight: 500,
              opacity: uploadingExcel ? 0.6 : 1,
            }}
          >
            {uploadingExcel ? t("uploading") : `\u{1F4C1} ${t("excelUpload")}`}
          </button>
          <input
            ref={excelFileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              fontSize: 12,
              color: colors.purple,
              cursor: downloadingTemplate ? "not-allowed" : "pointer",
              fontWeight: 500,
              opacity: downloadingTemplate ? 0.6 : 1,
            }}
          >
            {downloadingTemplate ? t("downloading") : `\u{1F4E5} ${t("excelTemplate")}`}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          style={{
            padding: 10,
            background: "white",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 12,
            color: colors.textDark,
            border: "1px solid #c4b5fd",
          }}
        >
          {message}
        </div>
      )}

      {/* Capacity warning */}
      {maxParticipants != null && currentMembers != null && (() => {
        const remaining = maxParticipants - currentMembers;
        const totalPending = invites.filter((i) => i.status === "PENDING" || i.status === "SENT").length;
        if (totalPending > remaining && remaining >= 0) {
          return (
            <div style={{
              padding: 12,
              borderRadius: 8,
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              marginBottom: 12,
              fontSize: 13,
              color: "#92400e",
              lineHeight: 1.5,
            }}>
              {t("capacityWarning", {
                defaultMessage: "Puedes enviar las invitaciones pero solo los primeros {remaining} podrán unirse. Amplía la capacidad de tu pool para que todos puedan participar.",
                remaining,
              })}
            </div>
          );
        }
        return null;
      })()}

      {/* Send invitations button */}
      {pendingCount > 0 && (
        <button
          onClick={handleSendInvitations}
          disabled={busy === "sending"}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "none",
            background: colors.purple,
            color: "white",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 16,
            opacity: busy === "sending" ? 0.7 : 1,
          }}
        >
          {busy === "sending"
            ? t("sending")
            : `${t("sendInvitations")} (${pendingCount})`}
        </button>
      )}

      {/* Employee list */}
      {invites.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#4c1d95" }}>
            {t("listTitle")}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {invites.map((inv) => {
              const sc = statusColors[inv.status] ?? statusColors.PENDING;
              return (
                <div
                  key={inv.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "white",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inv.email}
                    </div>
                    {inv.name && (
                      <div style={{ fontSize: 11, color: colors.textLighter }}>{inv.name}</div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: sc.bg,
                      color: sc.color,
                      border: `1px solid ${sc.border}`,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {statusLabels[inv.status] ?? inv.status}
                  </span>
                  {inv.status === "PENDING" && (
                    <button
                      onClick={() => handleDelete(inv.id)}
                      disabled={busy === `delete-${inv.id}`}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #fca5a5",
                        background: colors.errorBg,
                        color: colors.errorDark,
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {busy === `delete-${inv.id}` ? "..." : t("delete")}
                    </button>
                  )}
                  {(inv.status === "SENT" || inv.status === "FAILED") && (
                    <button
                      onClick={() => handleResend(inv.id)}
                      disabled={busy === `resend-${inv.id}`}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #c4b5fd",
                        background: "#ede9fe",
                        color: "#4c1d95",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {busy === `resend-${inv.id}`
                        ? "..."
                        : inv.status === "FAILED"
                          ? t("retry")
                          : t("resend")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loaded && invites.length === 0 && (
        <div style={{ fontSize: 13, color: "#6b21a8", fontStyle: "italic" }}>
          {t("noEmployees")}
        </div>
      )}
    </div>
  );
}
