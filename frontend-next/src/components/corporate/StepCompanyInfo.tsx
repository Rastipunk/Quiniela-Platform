"use client";

import type { ReactNode } from "react";
import { colors, radii, fontSize as fs, fontWeight as fw } from "@/lib/theme";

interface StepCompanyInfoProps {
  companyName: string;
  setCompanyName: (v: string) => void;
  logoBase64: string | undefined;
  welcomeMessage: string;
  setWelcomeMessage: (v: string) => void;
  invitationMessage: string;
  setInvitationMessage: (v: string) => void;
  logoError: string | null;
  handleLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  navButtons: ReactNode;
  t: (key: string) => string;
}

export function StepCompanyInfo({
  companyName,
  setCompanyName,
  logoBase64,
  welcomeMessage,
  setWelcomeMessage,
  invitationMessage,
  setInvitationMessage,
  logoError,
  handleLogoChange,
  inputStyle,
  labelStyle,
  navButtons,
  t,
}: StepCompanyInfoProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={labelStyle}>{t("companyName")} *</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder={t("companyNamePlaceholder")}
          style={inputStyle}
          maxLength={200}
          autoFocus
        />
      </div>

      <div>
        <label style={labelStyle}>{t("logo")}</label>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>{t("logoHint")}</p>
        {logoBase64 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={logoBase64}
              alt="Logo"
              style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)" }}
            />
            <label style={{ fontSize: 13, color: "#4f46e5", cursor: "pointer", fontWeight: 600 }}>
              {t("logoChange")}
              <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} style={{ display: "none" }} />
            </label>
          </div>
        ) : (
          <label
            style={{
              display: "inline-block",
              padding: "8px 16px",
              border: "1px dashed var(--border)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            {t("logoSelect")}
            <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} style={{ display: "none" }} />
          </label>
        )}
        {logoError && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{logoError}</p>}
      </div>

      <div>
        <label style={labelStyle}>{t("welcomeMessage")}</label>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280" }}>{t("welcomeMessageHint")}</p>
        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          placeholder={t("welcomeMessagePlaceholder")}
          maxLength={1000}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      <div>
        <label style={labelStyle}>{t("invitationMessage")}</label>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280" }}>{t("invitationMessageHint")}</p>
        <textarea
          value={invitationMessage}
          onChange={(e) => setInvitationMessage(e.target.value)}
          placeholder={t("invitationMessagePlaceholder")}
          maxLength={1000}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {navButtons}
    </div>
  );
}
