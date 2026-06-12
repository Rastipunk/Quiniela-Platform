"use client";

import { colors } from "@/lib/theme";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MatchPicksResponse } from "@/lib/api";

export interface MatchPicksModalData {
  matchId: string;
  matchTitle: string;
  picks: MatchPicksResponse | null;
  loading: boolean;
  error: string | null;
}

/** Context for the shareable PDF (joined with leaderboard position). */
export interface MatchPicksPdfContext {
  poolName: string;
  tournamentName: string | null;
  /** "2-0" when a result exists for the match, null otherwise. */
  resultLabel: string | null;
  leaderboardRows: Array<{
    userId: string;
    displayName: string;
    rank: number;
    isTied?: boolean;
    points: number;
  }>;
}

interface MatchPicksModalProps {
  data: MatchPicksModalData;
  onClose: () => void;
  pdfContext: MatchPicksPdfContext;
}

export function MatchPicksModal({ data, onClose, pdfContext }: MatchPicksModalProps) {
  const t = useTranslations("pool");
  const [exportingPdf, setExportingPdf] = useState(false);

  // PDF rows: every member with their pick, ordered by leaderboard
  // position (the host's ask: "ordenado por posición en la leaderboard").
  async function handleDownloadPdf() {
    if (!data.picks) return;
    setExportingPdf(true);
    try {
      const { generateBrandedTablePdf } = await import("@/lib/exportPdf");
      const lbByUser = new Map(pdfContext.leaderboardRows.map((r) => [r.userId, r]));
      const entries = data.picks.picks
        .map((p) => {
          const lb = lbByUser.get(p.userId);
          let pickLabel = t("matchPicks.noPick");
          let isRandom = false;
          if (p.pick?.type === "SCORE") {
            pickLabel = `${p.pick.homeGoals} - ${p.pick.awayGoals}`;
            isRandom = !!p.pick.autoAssigned;
          } else if (p.pick?.type === "OUTCOME") {
            pickLabel = p.pick.outcome === "HOME"
              ? t("matchPicks.home")
              : p.pick.outcome === "DRAW"
                ? t("matchPicks.drawLabel")
                : t("matchPicks.away");
          }
          return {
            rank: lb?.rank ?? null,
            isTied: lb?.isTied ?? false,
            name: p.displayName,
            pickLabel: isRandom ? `${pickLabel} *` : pickLabel,
            points: lb?.points ?? null,
            hasRandom: isRandom,
          };
        })
        .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));

      const anyRandom = entries.some((e) => e.hasRandom);
      const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

      await generateBrandedTablePdf({
        docTitle: t("pdf.matchDoc"),
        poolName: pdfContext.poolName,
        subtitleLines: [
          data.matchTitle,
          pdfContext.resultLabel ? t("pdf.resultLine", { score: pdfContext.resultLabel }) : t("pdf.noResultYet"),
          ...(pdfContext.tournamentName ? [pdfContext.tournamentName] : []),
          t("pdf.generatedLine", { date: dateStr }),
        ],
        head: [t("pdf.posHeader"), t("pdf.playerHeader"), t("pdf.pickHeader"), t("pdf.pointsHeader")],
        body: entries.map((e) => [
          e.rank == null ? "—" : e.isTied ? `${e.rank}=` : String(e.rank),
          e.name,
          e.pickLabel,
          e.points ?? "—",
        ]),
        totalColIndex: 3,
        podiumRows: true,
        ...(anyRandom ? { footnote: t("pdf.randomFootnote") } : {}),
        footerText: t("pdf.footerPlayers", { count: entries.length }),
        filenameBase: `${t("pdf.matchDoc")}_${pdfContext.poolName}_${data.matchTitle}`,
      });
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  }

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
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Shareable PDF — only once picks are revealed (post-deadline). */}
            {data.picks?.isUnlocked && data.picks.picks.length > 0 && (
              <button
                onClick={handleDownloadPdf}
                disabled={exportingPdf}
                title={t("pdf.download")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 12px", minHeight: 44, borderRadius: 8,
                  border: `1px solid ${colors.brand}`, background: colors.brand,
                  color: colors.white, cursor: exportingPdf ? "not-allowed" : "pointer",
                  fontSize: 12, fontWeight: 600, opacity: exportingPdf ? 0.6 : 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {exportingPdf ? t("pdf.generating") : t("pdf.download")}
              </button>
            )}
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
