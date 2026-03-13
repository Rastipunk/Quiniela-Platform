"use client";

import type { ReactNode } from "react";
import type { CatalogInstance } from "@/lib/api";
import { TOURNAMENT_CATALOG } from "@/lib/tournamentCatalog";
import type { PoolPickTypesConfig } from "@/types/pickConfig";
import { colors, radii, fontSize as fs, fontWeight as fw } from "@/lib/theme";

interface StepTournamentSelectProps {
  instanceId: string;
  setInstanceId: (v: string) => void;
  instances: CatalogInstance[] | null;
  setPickTypesConfig: (v: PoolPickTypesConfig | string | null) => void;
  loadError: string | null;
  navButtons: ReactNode;
  t: (key: string) => string;
  tc: (key: string) => string;
  labelStyle: React.CSSProperties;
}

export function StepTournamentSelect({
  instanceId,
  setInstanceId,
  instances,
  setPickTypesConfig,
  loadError,
  navButtons,
  t,
  tc,
  labelStyle,
}: StepTournamentSelectProps) {
  return (
    <div>
      <label style={labelStyle}>{t("tournament")}</label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
          marginTop: 8,
        }}
      >
        {TOURNAMENT_CATALOG.map((tournament) => {
          const matchingInstance = (instances ?? []).find(
            (inst) => inst.template?.key === tournament.templateKey
          );
          const isAvailable = tournament.active && !!matchingInstance;
          const isSelected = isAvailable && instanceId === matchingInstance?.id;

          return (
            <button
              key={tournament.key}
              type="button"
              disabled={!isAvailable}
              onClick={() => {
                if (matchingInstance) {
                  setInstanceId(matchingInstance.id);
                  setPickTypesConfig(null);
                }
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "16px 8px",
                borderRadius: 12,
                border: isSelected ? "2px solid #4f46e5" : "1px solid var(--border)",
                background: isSelected
                  ? "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(79,70,229,0.04))"
                  : isAvailable
                    ? "var(--bg)"
                    : "var(--surface)",
                cursor: isAvailable ? "pointer" : "default",
                opacity: isAvailable ? 1 : 0.45,
                filter: isAvailable ? "none" : "grayscale(100%)",
                position: "relative",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              {!isAvailable && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    fontSize: "0.55rem",
                    fontWeight: 600,
                    color: "#fff",
                    background: "#9ca3af",
                    padding: "1px 4px",
                    borderRadius: 3,
                    textTransform: "uppercase",
                    letterSpacing: "0.3px",
                  }}
                >
                  {tc("comingSoon")}
                </span>
              )}
              <span style={{ fontSize: "2rem" }}>{tournament.emoji}</span>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: isAvailable ? "var(--text)" : "var(--muted)",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {tc(`items.${tournament.i18nKey}.name`)}
              </span>
            </button>
          );
        })}
      </div>

      {loadError && (
        <div style={{ padding: 12, background: "#fef2f2", borderRadius: 8, color: "#b91c1c", fontSize: 13, marginTop: 12 }}>
          {loadError}
        </div>
      )}

      {navButtons}
    </div>
  );
}
