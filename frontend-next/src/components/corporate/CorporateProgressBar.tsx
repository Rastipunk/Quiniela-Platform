"use client";

import type { ReactNode } from "react";
import { colors, radii, fontSize as fs, fontWeight as fw } from "@/lib/theme";

interface CorporateProgressBarProps {
  step: number;
  totalSteps: number;
  stepLabels: string[];
  stepDescriptions: Record<number, string>;
  isMobile: boolean;
  onStepClick: (step: number) => void;
  stepOfLabel: string;
}

export function CorporateProgressBar({
  step,
  totalSteps,
  stepLabels,
  stepDescriptions,
  isMobile,
  onStepClick,
  stepOfLabel,
}: CorporateProgressBarProps) {
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Step counter */}
      <div style={{ textAlign: "center", fontSize: fs.md, color: colors.varMuted, marginBottom: 12, fontWeight: fw.medium }}>
        {stepOfLabel}
      </div>

      {/* Progress dots + lines */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
        {stepLabels.map((_, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < step;
          const isCurrent = stepNum === step;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              {/* Dot */}
              <div
                style={{
                  width: isCurrent ? 36 : 28,
                  height: isCurrent ? 36 : 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isCurrent ? fs.base : fs.sm,
                  fontWeight: fw.bold,
                  flexShrink: 0,
                  background: isCompleted
                    ? colors.brand
                    : isCurrent
                      ? colors.brandGradientAlt
                      : colors.varSurface,
                  color: isCompleted || isCurrent ? "white" : colors.varMuted,
                  border: isCompleted || isCurrent ? `2px solid ${colors.brand}` : `2px solid ${colors.varBorder}`,
                  transition: "all 0.2s ease",
                  cursor: isCompleted ? "pointer" : "default",
                }}
                onClick={() => { if (isCompleted) onStepClick(stepNum); }}
              >
                {isCompleted ? "\u2713" : stepNum}
              </div>
              {/* Connector line */}
              {i < stepLabels.length - 1 && (
                <div
                  style={{
                    width: isMobile ? 16 : 32,
                    height: 2,
                    background: stepNum < step ? "#4f46e5" : "var(--border)",
                    transition: "background 0.2s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current step label */}
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          {stepLabels[step - 1]}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
          {stepDescriptions[step] ?? ""}
        </div>
      </div>
    </div>
  );
}
