"use client";

import { useTranslations } from "next-intl";
import { PickRulesDisplay } from "@/components/PickRulesDisplay";
import type { PoolPickTypesConfig } from "@/types/pickConfig";
import type { PoolOverview } from "@/lib/api";

interface PoolRulesTabProps {
  overview: PoolOverview;
  allowScorePick: boolean;
}

export function PoolRulesTab({ overview, allowScorePick }: PoolRulesTabProps) {
  const t = useTranslations("pool");

  return (
    <div style={{ marginTop: 14, padding: 20, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
      {overview.pool.pickTypesConfig ? (
        <PickRulesDisplay
          pickTypesConfig={overview.pool.pickTypesConfig as PoolPickTypesConfig}
          poolDeadlineMinutes={overview.pool.deadlineMinutesBeforeKickoff}
          poolTimeZone={overview.pool.timeZone}
        />
      ) : (
        <>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, marginBottom: 16 }}>{t("rules.title")}</h3>

          {/* Scoring System */}
          <div style={{ marginBottom: 20, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
              📊 {t("rules.scoring.title")}
            </h4>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{t("rules.scoring.preset")}:</span>{" "}
                <span style={{ background: "#fff", padding: "2px 8px", borderRadius: 4, border: "1px solid #dee2e6" }}>
                  {(overview as any)?.leaderboard?.scoringPreset?.name ?? overview.pool.scoringPresetKey ?? "CLASSIC"}
                </span>
              </div>
              <div style={{ color: "#666", fontSize: 13, marginBottom: 12, fontStyle: "italic" }}>
                {(overview as any)?.leaderboard?.scoringPreset?.description ?? t("rules.scoring.defaultDesc")}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: "#28a745", minWidth: 40 }}>
                    {overview.leaderboard.scoring.exactScoreBonus}
                  </span>
                  <span>{t.rich("rules.scoring.exactScore", { b: (chunks) => <b>{chunks}</b> })}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: "#ffc107", minWidth: 40 }}>
                    {overview.leaderboard.scoring.outcomePoints}
                  </span>
                  <span>{t.rich("rules.scoring.outcomeOnly", { b: (chunks) => <b>{chunks}</b> })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pick Rules */}
          <div style={{ marginBottom: 20, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
              ⚽ {t("rules.pickTypes.title")}
            </h4>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{t("rules.pickTypes.method")}:</span>{" "}
                <span style={{
                  background: allowScorePick ? "#d4edda" : "#fff3cd",
                  padding: "4px 12px", borderRadius: 6,
                  border: allowScorePick ? "1px solid #c3e6cb" : "1px solid #ffeeba",
                  fontWeight: 600
                }}>
                  {allowScorePick ? `📝 ${t("rules.pickTypes.scoreMethod")}` : `🎯 ${t("rules.pickTypes.outcomeMethod")}`}
                </span>
              </div>
              <div style={{ color: "#666", fontSize: 13 }}>
                {allowScorePick ? t("rules.pickTypes.scoreDesc") : t("rules.pickTypes.outcomeDesc")}
              </div>
            </div>
          </div>

          {/* Deadline Policy */}
          <div style={{ marginBottom: 20, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
              ⏰ {t("rules.deadline.title")}
            </h4>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{t("rules.deadline.timeLimit")}:</span>{" "}
                <span style={{ background: "#fff", padding: "2px 8px", borderRadius: 4, border: "1px solid #dee2e6", fontWeight: 600 }}>
                  {t("rules.deadline.minutesBefore", { minutes: overview.pool.deadlineMinutesBeforeKickoff })}
                </span>
              </div>
              <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
                {t.rich("rules.deadline.description", { minutes: overview.pool.deadlineMinutesBeforeKickoff, b: (chunks) => <b>{chunks}</b> })}
              </div>
              <div style={{ marginTop: 8, padding: 10, background: "#fff3cd", borderRadius: 8, border: "1px solid #ffeeba" }}>
                <div style={{ fontSize: 13, color: "#856404" }}>
                  {t.rich("rules.deadline.important", { b: (chunks) => <b>{chunks}</b>, timezone: overview.pool.timeZone })}
                </div>
              </div>
            </div>
          </div>

          {/* Tournament Info */}
          <div style={{ padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e9ecef" }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#007bff" }}>
              🏆 {t("rules.tournament.title")}
            </h4>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>{t("rules.tournament.name")}:</span> {overview.tournamentInstance.name}
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>{t("rules.tournament.activeMembers")}:</span> {overview.counts.membersActive}
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>{t("rules.tournament.visibility")}:</span>{" "}
                <span style={{
                  background: overview.pool.visibility === "PRIVATE" ? "#fff3cd" : "#d4edda",
                  padding: "2px 8px", borderRadius: 4,
                  border: overview.pool.visibility === "PRIVATE" ? "1px solid #ffeeba" : "1px solid #c3e6cb",
                  fontSize: 12, fontWeight: 600
                }}>
                  {overview.pool.visibility === "PRIVATE" ? `🔒 ${t("rules.tournament.private")}` : `🌍 ${t("rules.tournament.public")}`}
                </span>
              </div>
              {overview.pool.description && (
                <div style={{ marginTop: 12, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #dee2e6" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>{t("rules.tournament.description")}:</div>
                  <div style={{ color: "#333" }}>{overview.pool.description}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
