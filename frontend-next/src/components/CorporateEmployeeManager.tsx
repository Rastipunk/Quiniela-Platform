"use client";

import { useRouter } from "@/i18n/navigation";
import { colors, radii, fontSize, fontWeight } from "@/lib/theme";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePoolTerm } from "@/contexts/PoolTermContext";
import {
  getCorporateEmployees,
  addCorporateEmployees,
  sendCorporateInvitations,
  deleteCorporateEmployee,
  resendCorporateInvitation,
  bulkResendExpiredInvitations,
  type CorporateInvite,
  type CorporateEmployeesResponse,
  type DerivedInviteStatus,
} from "@/lib/api";
import { PaginationControls } from "@/components/PaginationControls";
import { TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";

// Debounce window for the search input — same as MemberManagement so
// the keyboard feel is consistent across the host's listing surfaces.
const SEARCH_DEBOUNCE_MS = 300;
// 24h. Used to decide whether to ask "are you sure?" before rotating
// a freshly-issued token. Older invites resend without prompt because
// their original link is either expired or the recipient never acted.
const RESEND_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 25;

const FILTER_OPTIONS: ReadonlyArray<{
  value: DerivedInviteStatus;
  labelKey: string;
}> = [
  { value: "PENDING", labelKey: "filterPending" },
  { value: "SENT", labelKey: "filterSent" },
  { value: "ACTIVATED", labelKey: "filterActivated" },
  { value: "EXPIRED", labelKey: "filterExpired" },
  { value: "FAILED", labelKey: "filterFailed" },
];

type Props = {
  poolId: string;
  token: string;
  isMobile: boolean;
  maxParticipants?: number;
  currentMembers?: number;
};

export function CorporateEmployeeManager({
  poolId,
  token,
  isMobile,
  maxParticipants,
  currentMembers,
}: Props) {
  const t = useTranslations("pool.admin.employees");
  const router = useRouter();
  const { params: poolParams } = usePoolTerm();

  // ── List state ──────────────────────────────────────────
  const [data, setData] = useState<CorporateEmployeesResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DerivedInviteStatus[]>([]);
  const [page, setPage] = useState(0);

  // ── Add / send state ────────────────────────────────────
  const [emailsText, setEmailsText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const excelFileRef = useRef<HTMLInputElement>(null);

  // ── Debounced search → real query ────────────────────────
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  // Reset page when filters/search change so the user doesn't end up
  // staring at "Página 5 de 1" after a typo.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter]);

  const fetchPage = useCallback(async () => {
    setListLoading(true);
    try {
      const result = await getCorporateEmployees(token, poolId, {
        search: debouncedSearch || undefined,
        status: statusFilter.length > 0 ? statusFilter : undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setData(result);
    } catch {
      // Surface in the inline message bar — the list keeps the prior
      // page so a transient network blip doesn't blank the UI.
      setMessage(t("resendFailed", { email: "" }));
    } finally {
      setListLoading(false);
    }
  }, [token, poolId, debouncedSearch, statusFilter, page, t]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // ── Derived helpers ─────────────────────────────────────
  const validEmails = useMemo(() => {
    if (!emailsText.trim()) return [];
    const lines = emailsText
      .split(/[\n,;]+/)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return [...new Set(lines.filter((l) => emailRegex.test(l)))];
  }, [emailsText]);

  const summary = data?.summary;
  const totalPages = data?.totalPages ?? 1;

  // ── Action handlers ─────────────────────────────────────
  async function handleAdd() {
    if (!validEmails.length) return;
    setBusy("adding");
    setMessage(null);
    try {
      const result = await addCorporateEmployees(token, poolId, validEmails);
      setMessage(t("addResult", { added: result.added, skipped: result.skipped }));
      setEmailsText("");
      await fetchPage();
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
      await fetchPage();
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
      await fetchPage();
    } catch (e: any) {
      setMessage(e?.message ?? "Error");
    } finally {
      setBusy(null);
    }
  }

  async function handleResend(invite: CorporateInvite) {
    // Only confirm when the original was issued recently — for older
    // invites the link is either expired or the recipient never acted,
    // so rotating the token is the obvious right move.
    if (
      invite.status === "SENT" &&
      Date.now() - new Date(invite.createdAtUtc).getTime() < RESEND_RECENT_WINDOW_MS
    ) {
      const ok = window.confirm(t("resendRecentConfirm"));
      if (!ok) return;
    }
    setBusy(`resend-${invite.id}`);
    setMessage(null);
    try {
      const result = await resendCorporateInvitation(token, poolId, invite.id);
      setMessage(
        result.status === "SENT"
          ? t("resendSuccess", { email: result.email })
          : t("resendFailed", { email: result.email }),
      );
      await fetchPage();
    } catch (e: any) {
      setMessage(e?.message ?? "Error");
    } finally {
      setBusy(null);
    }
  }

  async function handleBulkResendExpired() {
    if (!summary || summary.expired === 0) return;
    const ok = window.confirm(t("bulkResendConfirm", { count: summary.expired }));
    if (!ok) return;
    setBusy("bulk-resend");
    setMessage(null);
    try {
      const result = await bulkResendExpiredInvitations(token, poolId);
      setMessage(
        result.hasMore
          ? `${t("bulkResendResult", { sent: result.sent, failed: result.failed })} · ${t("bulkResendHasMore")}`
          : t("bulkResendResult", { sent: result.sent, failed: result.failed }),
      );
      await fetchPage();
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

  function toggleStatusFilter(status: DerivedInviteStatus) {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }

  // ── Style maps ──────────────────────────────────────────
  const statusColors: Record<DerivedInviteStatus, { bg: string; color: string; border: string }> = {
    PENDING: { bg: colors.warningBgAmber, color: colors.warningDarker, border: "#fcd34d" },
    SENT: { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
    ACTIVATED: { bg: colors.successBgLight, color: colors.successDarker, border: "#6ee7b7" },
    EXPIRED: { bg: "#fee2e2", color: colors.errorDarker, border: colors.errorBorderLight },
    FAILED: { bg: "#fee2e2", color: colors.errorDarker, border: colors.errorBorderLight },
  };

  const statusLabels: Record<DerivedInviteStatus, string> = {
    PENDING: t("statusPending"),
    SENT: t("statusSent"),
    ACTIVATED: t("statusActivated"),
    EXPIRED: t("statusExpired"),
    FAILED: t("statusFailed"),
  };

  const filterCounts: Record<DerivedInviteStatus, number> = useMemo(
    () => ({
      PENDING: summary?.pending ?? 0,
      SENT: summary?.sent ?? 0,
      ACTIVATED: summary?.activated ?? 0,
      EXPIRED: summary?.expired ?? 0,
      FAILED: summary?.failed ?? 0,
    }),
    [summary],
  );

  // ── Render ──────────────────────────────────────────────
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

      {/* Capacity badge */}
      {maxParticipants != null && currentMembers != null && maxParticipants > 0 && (() => {
        const pct = Math.min(100, Math.round((currentMembers / maxParticipants) * 100));
        const isFull = currentMembers >= maxParticipants;
        const isWarning = !isFull && pct >= 95;
        const palette = isFull
          ? { bg: colors.errorBg, border: colors.errorBorder, text: colors.errorDarker, fill: colors.error }
          : isWarning
            ? { bg: colors.warningBgAmber, border: colors.warningBorder, text: colors.warningDarker, fill: colors.warning }
            : { bg: "white", border: "#c4b5fd", text: "#4c1d95", fill: colors.purple };
        const noteKey = isFull ? "capacityBadgeFullNote" : isWarning ? "capacityBadgeWarningNote" : null;
        return (
          <div style={{ marginBottom: 16, padding: 12, background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: palette.text }}>
                {t("capacityBadge", { current: currentMembers, max: maxParticipants, pct })}
              </span>
              {(isWarning || isFull) && (
                <button
                  type="button"
                  onClick={() => router.push(`/pools/${poolId}?tab=capacidad` as never)}
                  style={{ fontSize: 12, color: palette.text, fontWeight: 600, textDecoration: "underline", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {t("capacityCta")}
                </button>
              )}
            </div>
            <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 6, borderRadius: 3, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
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

      {/* Activated progress */}
      {summary && summary.total > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 10,
            background: "white",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: "#4c1d95",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span>{t("activated", { count: summary.activated, total: summary.total })}</span>
          {summary.expired > 0 && (
            <span style={{ color: colors.errorDarker }}>
              {t("summaryWithExpired", { total: summary.total, expired: summary.expired })}
            </span>
          )}
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
            {"✅"} {validEmails.length} emails
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

      {/* Inline message */}
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

      {/* Capacity warning when pending invites would overflow */}
      {summary && maxParticipants != null && currentMembers != null && (() => {
        const remaining = maxParticipants - currentMembers;
        const pendingToSend = summary.pending + summary.sent;
        if (pendingToSend > remaining && remaining >= 0) {
          return (
            <div style={{ padding: 12, borderRadius: 8, background: "#fef3c7", border: "1px solid #fcd34d", marginBottom: 12, fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
              {t("capacityWarning", { remaining })}
            </div>
          );
        }
        return null;
      })()}

      {/* Send invitations button */}
      {summary && summary.pending > 0 && (
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
            : `${t("sendInvitations")} (${summary.pending})`}
        </button>
      )}

      {/* List header */}
      {summary && summary.total > 0 && (
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#4c1d95" }}>
          {t("listTitle")}
        </div>
      )}

      {/* Search */}
      {summary && summary.total > 0 && (
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            style={{
              width: "100%",
              padding: isMobile ? "12px 14px" : "10px 14px",
              borderRadius: radii.lg,
              border: `1px solid #c4b5fd`,
              fontSize: isMobile ? fontSize.xl : fontSize.base,
              outline: "none",
              boxSizing: "border-box",
              minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
              background: "white",
            }}
          />
        </div>
      )}

      {/* Filter chips (multi-select) */}
      {summary && summary.total > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {FILTER_OPTIONS.map((opt) => {
            const active = statusFilter.includes(opt.value);
            const count = filterCounts[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleStatusFilter(opt.value)}
                aria-pressed={active}
                style={{
                  padding: "6px 12px",
                  borderRadius: radii.pill,
                  border: `1px solid ${active ? colors.purple : "#c4b5fd"}`,
                  background: active ? colors.purple : "white",
                  color: active ? "white" : "#4c1d95",
                  fontSize: 12,
                  fontWeight: fontWeight.semibold,
                  cursor: "pointer",
                  minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {t(opt.labelKey)} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Bulk-resend-expired CTA */}
      {summary && summary.expired > 0 && (
        <button
          type="button"
          onClick={handleBulkResendExpired}
          disabled={busy === "bulk-resend"}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: radii.lg,
            border: `1px solid ${colors.errorBorder}`,
            background: busy === "bulk-resend" ? colors.disabled : "#fef2f2",
            color: colors.errorDarker,
            fontSize: 13,
            fontWeight: fontWeight.semibold,
            cursor: busy === "bulk-resend" ? "wait" : "pointer",
            marginBottom: 12,
          }}
        >
          {busy === "bulk-resend"
            ? t("bulkResendingExpired")
            : `⚡ ${t("bulkResendExpiredButton", { count: summary.expired })}`}
        </button>
      )}

      {/* Employee list */}
      {data && data.invites.length === 0 && !listLoading && (
        <div style={{ fontSize: 13, color: "#6b21a8", fontStyle: "italic", padding: 12 }}>
          {summary && summary.total === 0 ? t("noEmployees") : t("noResults")}
        </div>
      )}

      {data && data.invites.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: listLoading ? 0.6 : 1, transition: "opacity 0.15s" }}>
          {data.invites.map((inv) => {
            const sc = statusColors[inv.status];
            const isActivated = inv.status === "ACTIVATED";
            const canResend =
              inv.status === "SENT" || inv.status === "FAILED" || inv.status === "EXPIRED";
            const canDelete = !isActivated;
            const tokenDaysLeft = Math.max(
              0,
              Math.ceil(
                (new Date(inv.activationTokenExpiresAt).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
              ),
            );

            return (
              <div
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: "white",
                  borderRadius: 8,
                  fontSize: 13,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inv.email}
                  </div>
                  {inv.name && (
                    <div style={{ fontSize: 11, color: colors.textLighter }}>{inv.name}</div>
                  )}
                  {inv.status === "SENT" && (
                    <div style={{ fontSize: 11, color: colors.textLight, marginTop: 2 }}>
                      {t("tokenExpiresIn", { days: tokenDaysLeft })}
                    </div>
                  )}
                  {inv.status === "EXPIRED" && (
                    <div style={{ fontSize: 11, color: colors.errorDarker, marginTop: 2 }}>
                      {t("tokenExpired")}
                    </div>
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
                  {statusLabels[inv.status]}
                </span>
                {canResend && (
                  <button
                    onClick={() => handleResend(inv)}
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
                {canDelete && (
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
              </div>
            );
          })}
        </div>
      )}

      {data && totalPages > 1 && (
        <PaginationControls
          page={Math.min(page, totalPages - 1)}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          isMobile={isMobile}
        />
      )}

      {!data && listLoading && (
        <div style={{ fontSize: 13, color: "#6b21a8", fontStyle: "italic", padding: 12 }}>
          {t("loadingEmployees")}
        </div>
      )}
    </div>
  );
}
