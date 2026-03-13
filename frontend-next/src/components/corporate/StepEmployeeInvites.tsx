"use client";

import type { ReactNode } from "react";
import { colors, radii, fontSize as fs, fontWeight as fw } from "@/lib/theme";

interface StepEmployeeInvitesProps {
  emailsText: string;
  setEmailsText: (v: string) => void;
  validEmails: string[];
  handleCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  navButtons: ReactNode;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}

export function StepEmployeeInvites({
  emailsText,
  setEmailsText,
  validEmails,
  handleCsvUpload,
  inputStyle,
  labelStyle,
  navButtons,
  t,
}: StepEmployeeInvitesProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        padding: "12px 16px",
        borderRadius: 10,
        background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
        border: "1px solid #93c5fd",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontSize: 13,
        color: "#1e40af",
        lineHeight: 1.6,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>&#8505;&#65039;</span>
        <span>{t("employeesLaterNotice")}</span>
      </div>

      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
        {t("employeesDesc")}
      </p>

      <textarea
        value={emailsText}
        onChange={(e) => setEmailsText(e.target.value)}
        placeholder={t("emailsPlaceholder")}
        rows={5}
        style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace" }}
      />

      {validEmails.length > 0 && (
        <div style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>
          {"\u2705"} {t("emailCount", { count: validEmails.length })}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-block",
            padding: "8px 14px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text)",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {"\u{1F4C1}"} {t("csvUpload")}
          <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} style={{ display: "none" }} />
        </label>

        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFFemail,nombre\nempleado1@empresa.com,Juan Perez\nempleado2@empresa.com,Maria Garcia\n")}`}
          download="employees_template.csv"
          style={{ fontSize: 13, color: "#4f46e5", textDecoration: "none", fontWeight: 500 }}
        >
          {"\u{1F4E5}"} {t("csvTemplate")}
        </a>
      </div>

      {navButtons}
    </div>
  );
}
