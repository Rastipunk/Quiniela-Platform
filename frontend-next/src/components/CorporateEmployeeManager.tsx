"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  getCorporateEmployees,
  addCorporateEmployees,
  sendCorporateInvitations,
  deleteCorporateEmployee,
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
};

export function CorporateEmployeeManager({ poolId, token, isMobile }: Props) {
  const t = useTranslations("pool.admin.employees");

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [emailsText, setEmailsText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage(t("sendResult", { sent: result.sent, activated: result.activated, failed: result.failed }));
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

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const emailRegex = /[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/g;
      const found = text.match(emailRegex) || [];
      const unique = [...new Set(found.map((e) => e.toLowerCase()))];
      setEmailsText((prev) => {
        const existing = prev.trim();
        return existing ? existing + "\n" + unique.join("\n") : unique.join("\n");
      });
    };
    reader.readAsText(file);
  }

  const statusColors: Record<string, { bg: string; color: string; border: string }> = {
    PENDING: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
    SENT: { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
    ACTIVATED: { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
    FAILED: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
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
        {t("subtitle")}
      </p>

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
          <div style={{ fontSize: 12, color: "#059669", marginTop: 4, fontWeight: 600 }}>
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
              background: validEmails.length > 0 ? "#7c3aed" : "#d1d5db",
              color: validEmails.length > 0 ? "white" : "#9ca3af",
              fontSize: 13,
              fontWeight: 600,
              cursor: validEmails.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            {busy === "adding" ? t("adding") : t("addButton")}
          </button>
          <label
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #c4b5fd",
              background: "white",
              fontSize: 13,
              color: "#4c1d95",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {"\u{1F4C1}"} {t("csvUpload")}
            <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} style={{ display: "none" }} />
          </label>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent("email,nombre\nempleado1@empresa.com,Juan\nempleado2@empresa.com,María\n")}`}
            download="employees_template.csv"
            style={{ fontSize: 12, color: "#7c3aed", textDecoration: "none", fontWeight: 500 }}
          >
            {"\u{1F4E5}"} {t("csvTemplate")}
          </a>
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
            color: "#333",
            border: "1px solid #c4b5fd",
          }}
        >
          {message}
        </div>
      )}

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
            background: "#7c3aed",
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
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{inv.name}</div>
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
                        background: "#fef2f2",
                        color: "#b91c1c",
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
