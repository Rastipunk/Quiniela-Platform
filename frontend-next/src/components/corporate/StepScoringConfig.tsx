"use client";

import type { ReactNode } from "react";
import type { PoolPickTypesConfig } from "@/types/pickConfig";
import { TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { colors, radii, fontSize as fs, fontWeight as fw } from "@/lib/theme";

interface StepScoringConfigProps {
  pickTypesConfig: PoolPickTypesConfig | string | null;
  setShowScoringWizard: (v: boolean) => void;
  navButtons: ReactNode;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}

export function StepScoringConfig({
  pickTypesConfig,
  setShowScoringWizard,
  navButtons,
  t,
}: StepScoringConfigProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          padding: 20,
          border: "2px solid #4f46e5",
          borderRadius: 12,
          background: "linear-gradient(135deg, #312e81 0%, #4f46e5 100%)",
          color: "white",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u{1F4CA}"}</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
          {t("scoring")}
        </div>
        <div style={{ fontSize: 13, marginBottom: 16, opacity: 0.9 }}>
          {t("scoringDesc")}
        </div>
        <button
          type="button"
          onClick={() => setShowScoringWizard(true)}
          style={{
            padding: "12px 24px",
            borderRadius: 8,
            border: "2px solid white",
            background: "white",
            color: "#4f46e5",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
            minHeight: TOUCH_TARGET.minimum,
            ...mobileInteractiveStyles.tapHighlight,
          }}
        >
          {"\u{1F9D9}\u200D\u2642\uFE0F"} {t("configWizard")}
        </button>
      </div>

      {pickTypesConfig ? (
        <div
          style={{
            padding: 14,
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            color: "#065f46",
            textAlign: "center",
          }}
        >
          {"\u2705"} {t("configReady", { count: Array.isArray(pickTypesConfig) ? pickTypesConfig.length : 0 })}
        </div>
      ) : (
        <div
          style={{
            padding: 14,
            background: "#fefce8",
            border: "1px solid #fde68a",
            borderRadius: 10,
            fontSize: 13,
            color: "#92400e",
            textAlign: "center",
          }}
        >
          {t("scoringNeeded")}
        </div>
      )}

      {navButtons}
    </div>
  );
}
