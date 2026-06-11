"use client";

import { colors } from "@/lib/theme";

import { useTranslations } from "next-intl";
import type { MatchPicksResponse } from "@/lib/api";

export interface MatchPicksModalData {
  matchId: string;
  matchTitle: string;
  picks: MatchPicksResponse | null;
  loading: boolean;
  error: string | null;
}

interface MatchPicksModalProps {
  data: MatchPicksModalData;
  onClose: () => void;
}

export function MatchPicksModal({ data, onClose }: MatchPicksModalProps) {
  const t = useTranslations("pool");

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.white,
          borderRadius: 16,
          maxWidth: 500,
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          position: "sticky",
          top: 0,
          background: colors.white,
          padding: "16px 20px",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10
        }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>
            {t("matchPicks.title")}: {data.matchTitle}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: colors.textMuted,
              padding: "4px 8px"
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 20 }}>
          {data.loading && (
            <div style={{ textAlign: "center", padding: 20, color: colors.textMuted }}>
              {t("matchPicks.loading")}
            </div>
          )}
          {data.error && (
            <div style={{ textAlign: "center", padding: 20, color: colors.errorAlt }}>
              {t("matchPicks.error")}: {data.error}
            </div>
          )}
          {data.picks && !data.picks.isUnlocked && (
            <div style={{ textAlign: "center", padding: 20, color: colors.warningDark, background: colors.warningBg, borderRadius: 8 }}>
              {t("matchPicks.notUnlocked")}
            </div>
          )}
          {data.picks && data.picks.picks.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.picks.picks.map((p) => (
                <div
                  key={p.userId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: 8,
                    background: p.isCurrentUser ? colors.infoBgLight : colors.bgLight,
                    border: p.isCurrentUser ? "2px solid #007bff" : "1px solid #eee"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: p.isCurrentUser ? 700 : 500 }}>
                      {p.displayName}
                    </span>
                    {p.isCurrentUser && (
                      <span style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: colors.brand,
                        color: colors.white
                      }}>
                        {t("matchPicks.you")}
                      </span>
                    )}
                    {/* Capricho San: the pick was randomly auto-assigned at
                        deadline — every player must be able to tell. */}
                    {p.pick?.autoAssigned && (
                      <span
                        title={t("matchPicks.randomPickTooltip")}
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#f3e8ff",
                          border: "1px solid #8b5cf6",
                          color: "#6d28d9",
                          fontWeight: 700,
                        }}
                      >
                        🎲 {t("matchPicks.randomPick")}
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {p.pick ? (
                      p.pick.type === "SCORE" ? (
                        <span style={{ color: colors.success }}>
                          {p.pick.homeGoals} - {p.pick.awayGoals}
                        </span>
                      ) : p.pick.type === "OUTCOME" ? (
                        <span style={{ color: colors.brand }}>
                          {p.pick.outcome === "HOME" ? t("matchPicks.home") : p.pick.outcome === "DRAW" ? t("matchPicks.drawLabel") : t("matchPicks.away")}
                        </span>
                      ) : (
                        <span style={{ color: colors.textMuted }}>{JSON.stringify(p.pick)}</span>
                      )
                    ) : (
                      <span style={{ color: colors.errorAlt, fontWeight: 500 }}>{t("matchPicks.noPick")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.picks && data.picks.picks.length === 0 && !data.loading && (
            <div style={{ textAlign: "center", padding: 20, color: colors.textMuted }}>
              {t("matchPicks.empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
