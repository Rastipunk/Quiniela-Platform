"use client";

import type { ReactNode } from "react";
import { colors, radii, fontSize as fs, fontWeight as fw } from "@/lib/theme";

interface StepPoolDetailsProps {
  poolName: string;
  setPoolName: (v: string) => void;
  poolDesc: string;
  setPoolDesc: (v: string) => void;
  deadline: number;
  setDeadline: (v: number) => void;
  timeZone: string;
  setTimeZone: (v: string) => void;
  requireApproval: boolean;
  setRequireApproval: (v: boolean) => void;
  isMobile: boolean;
  inputStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  navButtons: ReactNode;
  t: (key: string) => string;
}

export function StepPoolDetails({
  poolName,
  setPoolName,
  poolDesc,
  setPoolDesc,
  deadline,
  setDeadline,
  timeZone,
  setTimeZone,
  requireApproval,
  setRequireApproval,
  isMobile,
  inputStyle,
  labelStyle,
  navButtons,
  t,
}: StepPoolDetailsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={labelStyle}>{t("poolName")} *</label>
        <input
          type="text"
          value={poolName}
          onChange={(e) => setPoolName(e.target.value)}
          placeholder={t("poolNamePlaceholder")}
          style={inputStyle}
          maxLength={120}
          autoFocus
        />
      </div>

      <div>
        <label style={labelStyle}>{t("poolDescription")}</label>
        <input
          type="text"
          value={poolDesc}
          onChange={(e) => setPoolDesc(e.target.value)}
          placeholder={t("poolDescriptionPlaceholder")}
          style={inputStyle}
          maxLength={500}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>{t("deadline")}</label>
          <input
            type="number"
            value={deadline}
            min={0}
            max={1440}
            onChange={(e) => setDeadline(Number(e.target.value))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{t("timezone")}</label>
          <input
            type="text"
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            placeholder="America/Bogota"
            style={inputStyle}
          />
        </div>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
          background: "var(--bg)",
          borderRadius: 10,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={requireApproval}
          onChange={(e) => setRequireApproval(e.target.checked)}
          style={{ width: 20, height: 20, cursor: "pointer" }}
        />
        <div>
          <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{t("requireApproval")}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{t("requireApprovalDesc")}</div>
        </div>
      </label>

      {navButtons}
    </div>
  );
}
