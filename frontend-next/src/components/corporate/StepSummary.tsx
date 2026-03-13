"use client";

import type { ReactNode } from "react";
import type { PoolPickTypesConfig } from "@/types/pickConfig";
import { colors, radii, fontSize as fs, fontWeight as fw } from "@/lib/theme";

interface StepSummaryProps {
  companyName: string;
  tournamentName: string;
  poolName: string;
  deadline: number;
  pickTypesConfig: PoolPickTypesConfig | string | null;
  maxParticipants: number;
  validEmails: string[];
  requireApproval: boolean;
  error: string | null;
  navButtons: ReactNode;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}

export function StepSummary({
  companyName,
  tournamentName,
  poolName,
  deadline,
  pickTypesConfig,
  maxParticipants,
  validEmails,
  requireApproval,
  error,
  navButtons,
  t,
}: StepSummaryProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Summary card */}
      <div
        style={{
          borderRadius: 12,
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}
      >
        {[
          { label: t("summaryCompany"), value: companyName, icon: "\u{1F3E2}" },
          { label: t("summaryTournament"), value: tournamentName, icon: "\u26BD" },
          { label: t("summaryPool"), value: poolName, icon: "\u{1F3AF}" },
          { label: t("summaryDeadline"), value: t("summaryMinutes", { min: deadline }), icon: "\u23F0" },
          { label: t("summaryScoring"), value: pickTypesConfig ? t("summaryConfigured") : "\u2014", icon: "\u{1F4CA}" },
          { label: t("summaryCapacity"), value: `${maxParticipants} ${t("summaryPlayers")}`, icon: "\u{1F465}" },
          {
            label: t("summaryEmployees"),
            value: validEmails.length > 0
              ? `${validEmails.length} emails`
              : t("summaryNone"),
            icon: "\u{1F4E7}",
          },
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderBottom: i < 6 ? "1px solid var(--border)" : "none",
              background: i % 2 === 0 ? "var(--bg)" : "var(--surface)",
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{row.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{row.label}</div>
              <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>{row.value}</div>
            </div>
          </div>
        ))}

        {requireApproval && (
          <div
            style={{
              padding: "10px 16px",
              background: "#fefce8",
              fontSize: 13,
              color: "#92400e",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {"\u{1F512}"} {t("summaryApproval")}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#b91c1c",
            fontSize: 13,
            marginTop: 16,
          }}
        >
          {error}
        </div>
      )}

      {navButtons}
    </div>
  );
}
