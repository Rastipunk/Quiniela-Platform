"use client";

import { colors, radii } from "../../lib/theme";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  children: ReactNode;
}

export function PoolWizardStepContainer({ title, subtitle, icon, children }: Props) {
  const isMobile = useIsMobile();

  return (
    <div style={{
      maxWidth: 720,
      margin: "0 auto",
      padding: isMobile ? "0 16px" : "0 24px",
    }}>
      {/* Step header */}
      <div style={{
        marginBottom: isMobile ? 20 : 28,
        textAlign: "center",
      }}>
        {icon && (
          <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
        )}
        <h2 style={{
          fontSize: isMobile ? 22 : 26,
          fontWeight: 700,
          color: colors.text,
          margin: 0,
          lineHeight: 1.2,
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{
            fontSize: isMobile ? 14 : 15,
            color: colors.textMuted,
            margin: "8px 0 0",
            lineHeight: 1.5,
          }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Step content */}
      <div style={{
        background: colors.white,
        borderRadius: radii["3xl"],
        border: `1px solid ${colors.borderLight}`,
        padding: isMobile ? 20 : 32,
      }}>
        {children}
      </div>
    </div>
  );
}
