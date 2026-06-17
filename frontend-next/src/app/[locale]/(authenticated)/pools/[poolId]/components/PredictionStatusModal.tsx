"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { colors } from "@/lib/theme";
import { TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import type { PredictionStatusResponse } from "@/lib/api";

export interface PredictionStatusModalData {
  matchId: string;
  matchTitle: string;
  status: PredictionStatusResponse | null;
  loading: boolean;
  error: string | null;
}

type Filter = "all" | "pending" | "ready";

interface PredictionStatusModalProps {
  data: PredictionStatusModalData;
  onClose: () => void;
}

export function PredictionStatusModal({ data, onClose }: PredictionStatusModalProps) {
  const t = useTranslations("pool");
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");

  const status = data.status;

  const visibleMembers = useMemo(() => {
    if (!status) return [];
    const q = search.trim().toLowerCase();
    return status.members.filter((m) => {
      if (filter === "pending" && m.hasPredicted) return false;
      if (filter === "ready" && !m.hasPredicted) return false;
      if (q && !m.displayName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [status, filter, search]);

  const filterChips: Array<{ key: Filter; label: string }> = [
    { key: "all", label: t("predictionStatus.filterAll") },
    { key: "pending", label: t("predictionStatus.filterPending") },
    { key: "ready", label: t("predictionStatus.filterReady") },
  ];

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
        padding: 20,
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
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: colors.white,
            padding: "16px 20px",
            borderBottom: "1px solid #eee",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>{t("predictionStatus.title")}</h3>
            <span style={{ fontSize: 12, color: colors.textMuted }}>{data.matchTitle}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: colors.textMuted,
              padding: "4px 8px",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflow: "auto" }}>
          {data.loading && (
            <div style={{ textAlign: "center", padding: 20, color: colors.textMuted }}>
              {t("predictionStatus.loading")}
            </div>
          )}
          {data.error && (
            <div style={{ textAlign: "center", padding: 20, color: colors.errorAlt }}>
              {t("predictionStatus.error")}: {data.error}
            </div>
          )}

          {status && !data.loading && !data.error && (
            <>
              {/* Summary */}
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.textDark, marginBottom: 12 }}>
                {t("predictionStatus.summary", {
                  ready: status.predictedCount,
                  total: status.totalMembers,
                })}
              </div>

              {/* Filter chips */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {filterChips.map((c) => {
                  const active = filter === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setFilter(c.key)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: `1px solid ${active ? colors.brand : "#ddd"}`,
                        background: active ? colors.brand : colors.white,
                        color: active ? colors.white : colors.textDark,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        ...mobileInteractiveStyles.tapHighlight,
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("predictionStatus.searchPlaceholder")}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  fontSize: 14,
                  marginBottom: 12,
                  boxSizing: "border-box",
                }}
              />

              {/* List */}
              {visibleMembers.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {visibleMembers.map((m) => (
                    <div
                      key={m.userId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderRadius: 8,
                        background: m.isCurrentUser ? colors.infoBgLight : colors.bgLight,
                        border: m.isCurrentUser ? "2px solid #007bff" : "1px solid #eee",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: m.isCurrentUser ? 700 : 500 }}>{m.displayName}</span>
                        {m.isCurrentUser && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: colors.brand,
                              color: colors.white,
                            }}
                          >
                            {t("predictionStatus.you")}
                          </span>
                        )}
                      </div>
                      {m.hasPredicted ? (
                        <span style={{ color: colors.success, fontWeight: 700, fontSize: 14 }}>
                          ✓ {t("predictionStatus.ready")}
                        </span>
                      ) : (
                        <span style={{ color: colors.errorAlt, fontWeight: 700, fontSize: 14 }}>
                          ✗ {t("predictionStatus.pending")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 20, color: colors.textMuted }}>
                  {t("predictionStatus.empty")}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
