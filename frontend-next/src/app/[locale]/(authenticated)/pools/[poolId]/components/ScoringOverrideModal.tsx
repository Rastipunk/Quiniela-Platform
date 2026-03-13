"use client";

import { useTranslations } from "next-intl";

export interface ScoringOverrideModalData {
  matchId: string;
  matchTitle: string;
  currentEnabled: boolean;
}

interface ScoringOverrideModalProps {
  data: ScoringOverrideModalData;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
}

export function ScoringOverrideModal({ data, reason, onReasonChange, onConfirm, onClose, busy }: ScoringOverrideModalProps) {
  const t = useTranslations("pool");

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>
          {t("scoringToggle")}
        </h3>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#555" }}>
          <strong>{data.matchTitle}</strong>
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#666" }}>
          {data.currentEnabled
            ? t("scoringDisableConfirm")
            : t("scoringEnableConfirm")}
        </p>
        {data.currentEnabled && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#666", display: "block", marginBottom: 4 }}>
              {t("scoringDisableReason")}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              maxLength={500}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14,
                boxSizing: "border-box",
              }}
              placeholder={t("scoringDisableReason")}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: data.currentEnabled ? "#f59e0b" : "#10b981",
              color: "#fff",
              cursor: busy ? "wait" : "pointer",
              fontSize: 14,
              fontWeight: 600,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "..." : data.currentEnabled ? t("scoringDisabled") : t("scoringEnabled")}
          </button>
        </div>
      </div>
    </div>
  );
}
