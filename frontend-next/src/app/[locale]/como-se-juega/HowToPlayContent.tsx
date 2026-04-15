"use client";

import { useTranslations } from "next-intl";
import { colors, radii } from "@/lib/theme";
import { BRAND } from "@/lib/brand";
import { RegisterButton } from "@/components/RegisterButton";
import { useIsMobile } from "@/hooks/useIsMobile";

const SECTION_MAX_WIDTH = 720;

function Section({ children, bg }: { children: React.ReactNode; bg?: string }) {
  return (
    <section style={{
      padding: "48px 20px",
      background: bg || "transparent",
    }}>
      <div style={{ maxWidth: SECTION_MAX_WIDTH, margin: "0 auto" }}>
        {children}
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 24, fontWeight: 800, color: colors.text, marginBottom: 8 }}>
      {children}
    </h2>
  );
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 15, color: colors.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
      {children}
    </p>
  );
}

// ── Mock: Match Prediction Card ──────────────────────────────
function MockPredictionCard({ t }: { t: (key: string) => string }) {
  return (
    <div style={{
      border: `1px solid ${colors.borderLight}`,
      borderRadius: 16,
      padding: 20,
      background: colors.white,
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>
          UEFA Champions League
        </span>
        <span style={{ fontSize: 12, color: BRAND.primary, fontWeight: 700, background: "#eef2ff", padding: "2px 10px", borderRadius: 99 }}>
          {t("prediction.deadline")}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 28 }}>&#9917;</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>Barcelona</div>
          <div style={{ fontSize: 11, color: colors.textMuted }}>{t("prediction.homeLabel")}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, border: `2px solid ${BRAND.primary}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: BRAND.primary, background: "#f0f0ff",
          }}>2</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.textMuted }}>-</span>
          <div style={{
            width: 48, height: 48, borderRadius: 12, border: `2px solid ${BRAND.primary}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: BRAND.primary, background: "#f0f0ff",
          }}>1</div>
        </div>

        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 28 }}>&#9917;</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>PSG</div>
          <div style={{ fontSize: 11, color: colors.textMuted }}>{t("prediction.awayLabel")}</div>
        </div>
      </div>

      <div style={{
        marginTop: 16, padding: "10px 0", borderRadius: 10,
        background: `linear-gradient(135deg, ${BRAND.primary}, #764ba2)`,
        color: "white", textAlign: "center", fontWeight: 700, fontSize: 14,
      }}>
        &#10003; {t("prediction.saved")}
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: colors.textMuted, textAlign: "center", fontStyle: "italic" }}>
        {t("prediction.note")}
      </div>
    </div>
  );
}

// ── Mock: Live Match ─────────────────────────────────────────
function MockLiveMatch({ t }: { t: (key: string) => string }) {
  return (
    <div style={{
      border: `2px solid #ef4444`,
      borderRadius: 16,
      padding: 20,
      background: colors.white,
      boxShadow: "0 2px 12px rgba(239,68,68,0.1)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{
          fontSize: 12, fontWeight: 800, color: "white",
          background: "#ef4444", padding: "3px 10px", borderRadius: 99,
          animation: "pulse 2s infinite",
        }}>
          &#9679; {t("liveResults.live")}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted }}>
          67&apos; {t("liveResults.minute")}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Barcelona</div>
        </div>
        <div style={{
          fontSize: 36, fontWeight: 900, color: colors.text,
          background: colors.bgLighter, padding: "8px 20px", borderRadius: 12,
          letterSpacing: 4,
        }}>
          2 - 1
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>PSG</div>
        </div>
      </div>

      <div style={{
        marginTop: 12, display: "flex", justifyContent: "center", gap: 24,
        fontSize: 12, color: colors.textMuted,
      }}>
        <span>{t("liveResults.halftime")}: 1-0</span>
        <span>&#9917; Gol 52&apos;, 67&apos; - 38&apos;</span>
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
    </div>
  );
}

// ── Mock: Scoring Breakdown ──────────────────────────────────
function MockScoringBreakdown({ t }: { t: (key: string) => string }) {
  const rows = [
    { label: t("scoring.matchOutcome"), pts: 10 },
    { label: t("scoring.homeGoals"), pts: 5 },
    { label: t("scoring.awayGoals"), pts: 5 },
    { label: t("scoring.goalDifference"), pts: 3 },
    { label: t("scoring.exactScore"), pts: 20 },
  ];
  const total = rows.reduce((s, r) => s + r.pts, 0);

  return (
    <div style={{
      border: `1px solid ${colors.borderLight}`,
      borderRadius: 16,
      overflow: "hidden",
      background: colors.white,
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", gap: 0 }}>
        <div style={{ flex: 1, padding: 16, textAlign: "center", borderRight: `1px solid ${colors.borderLight}` }}>
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>{t("scoring.yourPrediction")}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: BRAND.primary }}>2 - 1</div>
        </div>
        <div style={{ flex: 1, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>{t("scoring.actualResult")}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#16a34a" }}>2 - 1 &#10003;</div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", background: colors.bgLighter, fontSize: 13, fontWeight: 700, color: colors.textDark }}>
        {t("scoring.breakdown")}
      </div>
      {rows.map((row) => (
        <div key={row.label} style={{
          display: "flex", justifyContent: "space-between", padding: "10px 16px",
          borderTop: `1px solid ${colors.borderLight}`, fontSize: 14,
        }}>
          <span style={{ color: colors.textDark }}>{row.label}</span>
          <span style={{ fontWeight: 700, color: "#16a34a" }}>+{row.pts} {t("scoring.pts")}</span>
        </div>
      ))}
      <div style={{
        display: "flex", justifyContent: "space-between", padding: "12px 16px",
        borderTop: `2px solid ${colors.borderMedium}`, fontSize: 16, fontWeight: 800,
        background: "#f0fdf4",
      }}>
        <span style={{ color: colors.text }}>{t("scoring.total")}</span>
        <span style={{ color: "#16a34a" }}>{total} {t("scoring.pts")}</span>
      </div>
    </div>
  );
}

// ── Mock: Leaderboard ────────────────────────────────────────
function MockLeaderboard({ t }: { t: (key: string) => string }) {
  const players = [
    { pos: 1, name: "Carlos M.", pts: 143, played: 12, exact: 3, trend: "up", medal: "&#129351;" },
    { pos: 2, name: "Ana R.", pts: 138, played: 12, exact: 2, trend: "up", medal: "&#129352;" },
    { pos: 3, name: "Pedro L. " + t("leaderboard.you"), pts: 131, played: 12, exact: 2, trend: "same", medal: "&#129353;", highlight: true },
    { pos: 4, name: "Laura G.", pts: 125, played: 11, exact: 1, trend: "down", medal: "" },
    { pos: 5, name: "Miguel F.", pts: 119, played: 12, exact: 1, trend: "down", medal: "" },
  ];

  const trendIcon = (t: string) => t === "up" ? "&#9650;" : t === "down" ? "&#9660;" : "&#9644;";
  const trendColor = (t: string) => t === "up" ? "#16a34a" : t === "down" ? "#ef4444" : colors.textMuted;

  return (
    <div style={{
      border: `1px solid ${colors.borderLight}`,
      borderRadius: 16,
      overflow: "hidden",
      background: colors.white,
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      <div style={{
        display: "grid", gridTemplateColumns: "40px 1fr 60px 50px 50px 30px",
        padding: "10px 16px", background: colors.bgLighter,
        fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase",
      }}>
        <span>{t("leaderboard.position")}</span>
        <span>{t("leaderboard.player")}</span>
        <span style={{ textAlign: "right" }}>{t("leaderboard.points")}</span>
        <span style={{ textAlign: "center" }}>{t("leaderboard.played")}</span>
        <span style={{ textAlign: "center" }}>{t("leaderboard.exact")}</span>
        <span></span>
      </div>
      {players.map((p) => (
        <div key={p.pos} style={{
          display: "grid", gridTemplateColumns: "40px 1fr 60px 50px 50px 30px",
          padding: "12px 16px", borderTop: `1px solid ${colors.borderLight}`,
          fontSize: 14, alignItems: "center",
          background: p.highlight ? "#eef2ff" : "transparent",
        }}>
          <span style={{ fontWeight: 800, color: p.pos <= 3 ? BRAND.primary : colors.textMuted }}>
            <span dangerouslySetInnerHTML={{ __html: p.medal || String(p.pos) }} />
          </span>
          <span style={{ fontWeight: p.highlight ? 700 : 500, color: colors.text }}>
            {p.name}
          </span>
          <span style={{ textAlign: "right", fontWeight: 800, color: colors.text }}>{p.pts}</span>
          <span style={{ textAlign: "center", color: colors.textMuted }}>{p.played}</span>
          <span style={{ textAlign: "center", color: colors.textMuted }}>{p.exact}</span>
          <span style={{ textAlign: "center", fontSize: 10 }}
            dangerouslySetInnerHTML={{ __html: trendIcon(p.trend) }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Mock: Tournament Phases Timeline ─────────────────────────
function MockPhaseTimeline({ t }: { t: (key: string) => string }) {
  const phases = [
    { name: t("allMatches.groupStage"), matches: 48, active: true },
    { name: t("allMatches.roundOf16"), matches: 16, active: false },
    { name: t("allMatches.quarterFinals"), matches: 8, active: false },
    { name: t("allMatches.semiFinals"), matches: 4, active: false },
    { name: t("allMatches.final"), matches: 1, active: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {phases.map((phase, i) => (
        <div key={phase.name} style={{ display: "flex", alignItems: "stretch", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: phase.active ? BRAND.primary : colors.borderMedium,
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800, flexShrink: 0,
            }}>{i + 1}</div>
            {i < phases.length - 1 && (
              <div style={{ width: 2, flex: 1, background: colors.borderLight, minHeight: 32 }} />
            )}
          </div>
          <div style={{ paddingBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{phase.name}</div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>
              {phase.matches} {t("allMatches.matchesPerPhase")}
            </div>
          </div>
        </div>
      ))}
      <div style={{
        marginTop: 8, padding: "10px 16px", borderRadius: 10,
        background: "#eef2ff", color: BRAND.primary,
        fontSize: 14, fontWeight: 700, textAlign: "center",
      }}>
        &#127942; {t("allMatches.predictAll")}
      </div>
    </div>
  );
}

// ── Mock: Winners Podium ─────────────────────────────────────
function MockWinnersPodium({ t }: { t: (key: string) => string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12, padding: "20px 0" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28 }}>&#129352;</div>
        <div style={{
          width: 80, height: 80, borderRadius: 12,
          background: "linear-gradient(135deg, #c0c0c0, #e8e8e8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#555",
        }}>Ana R.</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginTop: 4 }}>{t("winners.second")}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36 }}>&#129351;</div>
        <div style={{
          width: 90, height: 110, borderRadius: 12,
          background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, color: "#7c2d12",
        }}>Carlos M.</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: colors.text, marginTop: 4 }}>{t("winners.first")}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28 }}>&#129353;</div>
        <div style={{
          width: 80, height: 65, borderRadius: 12,
          background: "linear-gradient(135deg, #cd7f32, #daa520)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#fff",
        }}>Pedro L.</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginTop: 4 }}>{t("winners.third")}</div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export function HowToPlayContent() {
  const t = useTranslations("howToPlay");
  const isMobile = useIsMobile();

  return (
    <div>
      {/* Hero */}
      <Section bg={`linear-gradient(135deg, ${BRAND.primary}15, #764ba215)`}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: 12 }}>&#9917;</div>
          <h1 style={{ fontSize: isMobile ? 28 : 36, fontWeight: 900, color: colors.text, marginBottom: 8 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 17, color: colors.textMuted, maxWidth: 500, margin: "0 auto", lineHeight: 1.5 }}>
            {t("subtitle")}
          </p>
        </div>
      </Section>

      {/* 1. Prediction */}
      <Section>
        <SectionTitle>{t("prediction.title")}</SectionTitle>
        <SectionDesc>{t("prediction.description")}</SectionDesc>
        <MockPredictionCard t={t} />
      </Section>

      {/* 2. Live Results */}
      <Section bg={colors.bgLighter}>
        <SectionTitle>{t("liveResults.title")}</SectionTitle>
        <SectionDesc>{t("liveResults.description")}</SectionDesc>
        <MockLiveMatch t={t} />
      </Section>

      {/* 3. Scoring */}
      <Section>
        <SectionTitle>{t("scoring.title")}</SectionTitle>
        <SectionDesc>{t("scoring.description")}</SectionDesc>
        <MockScoringBreakdown t={t} />
      </Section>

      {/* 4. Leaderboard */}
      <Section bg={colors.bgLighter}>
        <SectionTitle>{t("leaderboard.title")}</SectionTitle>
        <SectionDesc>{t("leaderboard.description")}</SectionDesc>
        <MockLeaderboard t={t} />
      </Section>

      {/* 5. All Matches */}
      <Section>
        <SectionTitle>{t("allMatches.title")}</SectionTitle>
        <SectionDesc>{t("allMatches.description")}</SectionDesc>
        <MockPhaseTimeline t={t} />
      </Section>

      {/* 6. Winners */}
      <Section bg={colors.bgLighter}>
        <SectionTitle>{t("winners.title")}</SectionTitle>
        <SectionDesc>{t("winners.description")}</SectionDesc>
        <MockWinnersPodium t={t} />
      </Section>

      {/* CTA */}
      <Section bg={`linear-gradient(135deg, ${BRAND.primary}, #764ba2)`}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <h2 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: "white", marginBottom: 8 }}>
            {t("cta.title")}
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", marginBottom: 24 }}>
            {t("cta.subtitle")}
          </p>
          <RegisterButton
            label={t("cta.button")}
            style={{
              padding: "14px 32px",
              borderRadius: radii.lg,
              fontSize: 16,
              fontWeight: 700,
              background: "white",
              color: BRAND.primary,
              border: "none",
              cursor: "pointer",
            }}
          />
        </div>
      </Section>
    </div>
  );
}
