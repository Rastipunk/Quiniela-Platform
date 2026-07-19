"use client";

// Post-World-Cup platform survey modal (ADR-089).
//
// Shows while the survey window is open (server-decided via /survey/status)
// on EVERY app open until the user answers — dismissing only hides it for the
// current session (in-memory state, no localStorage; owner decision to
// maximise responses during the short 5-day window). A 60-second clock check
// flips the modal visible for sessions that were already open when the window
// opened (people watching the final with the app open).
//
// Input is tap-only: every scale is a 10-segment bar (no typing required).
// Screen 1 (three mandatory 1-10 scales) persists immediately on submit;
// screen 2 (comment + share consent, plus the five host dimensions for
// hosts) is optional. Fail-closed: any status-fetch error keeps it hidden.

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { colors } from "@/lib/theme";
import { useIsMobile, TOUCH_TARGET } from "@/hooks/useIsMobile";
import { getToken } from "@/lib/auth";
import {
  getSurveyStatus,
  submitSurvey,
  submitSurveyDetails,
  type SurveyStatus,
  type SurveyDetailsBody,
} from "@/lib/api";

// ─── Tap-only 1-10 scale bar ─────────────────────────────────

function ScaleBar({
  label,
  value,
  onChange,
  lowHint,
  highHint,
  isMobile,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  lowHint: string;
  highHint: string;
  isMobile: boolean;
}) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#111827", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const filled = value != null && n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${label}: ${n}`}
              aria-pressed={value === n}
              style={{
                // Mobile: 5 per row (two rows) so every target stays ≥44px.
                // Desktop: single row of 10.
                flex: isMobile ? "1 1 calc(20% - 5px)" : "1 1 0",
                minWidth: isMobile ? "calc(20% - 5px)" : 0,
                height: Math.max(44, TOUCH_TARGET.minimum),
                borderRadius: 9,
                border: filled ? "1px solid transparent" : "1px solid #d7dbe3",
                background: filled ? colors.brandGradient : "#f4f5f8",
                color: filled ? colors.white : "#6b7280",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                transition: "background 120ms, transform 80ms",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontSize: "0.72rem",
          color: "#9ca3af",
        }}
      >
        <span>{lowHint}</span>
        <span>{highHint}</span>
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────

type Screen = "scores" | "details" | "thanks";

export function PostWorldCupSurveyModal() {
  const t = useTranslations("survey");
  const locale = useLocale();
  const isMobile = useIsMobile();

  const [status, setStatus] = useState<SurveyStatus | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false); // session-only
  const [screen, setScreen] = useState<Screen>("scores");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  // Screen 1
  const [overall, setOverall] = useState<number | null>(null);
  const [recommend, setRecommend] = useState<number | null>(null);
  const [otherTournaments, setOtherTournaments] = useState<number | null>(null);

  // Screen 2
  const [hostScores, setHostScores] = useState<Record<string, number | null>>({
    hostCreateScore: null,
    hostInviteScore: null,
    hostLiveResultsScore: null,
    hostRulesScore: null,
    hostSupportScore: null,
  });
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    void getSurveyStatus()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        if (s.alreadySubmitted) return;
        if (s.open) {
          setVisible(true);
          return;
        }
        // Window not open yet but instants known (allowlisted): flip visible
        // the minute it opens, without a reload — the "watching the final
        // with the app open" case.
        if (s.opensAtUtc && s.closesAtUtc) {
          const opens = new Date(s.opensAtUtc).getTime();
          const closes = new Date(s.closesAtUtc).getTime();
          if (Number.isNaN(opens) || Number.isNaN(closes)) return;
          timerRef.current = setInterval(() => {
            const now = Date.now();
            if (now >= opens && now <= closes) {
              setVisible(true);
              if (timerRef.current) clearInterval(timerRef.current);
            } else if (now > closes && timerRef.current) {
              clearInterval(timerRef.current);
            }
          }, 60_000);
        }
      })
      .catch(() => {
        /* fail-closed: any error keeps the modal hidden */
      });
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!visible || dismissed || !status) return null;

  const isHost = status.isHost;
  const allScored = overall != null && recommend != null && otherTournaments != null;

  const dismiss = () => setDismissed(true);

  async function handleSubmitScores() {
    if (!allScored || submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const r = await submitSurvey({
        overallScore: overall!,
        recommendScore: recommend!,
        otherTournamentsScore: otherTournaments!,
        locale,
      });
      // Answered on another device mid-flight → straight to thanks.
      setScreen(r.alreadySubmitted ? "thanks" : "details");
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitDetails() {
    if (submitting) return;
    const body: SurveyDetailsBody = {};
    const trimmed = comment.trim();
    if (trimmed) body.comment = trimmed.slice(0, 2000);
    if (consent) body.shareConsent = true;
    if (isHost) {
      for (const [k, v] of Object.entries(hostScores)) {
        if (v != null) (body as Record<string, unknown>)[k] = v;
      }
    }
    if (Object.keys(body).length === 0) {
      setScreen("thanks");
      return;
    }
    setSubmitting(true);
    setError(false);
    try {
      await submitSurveyDetails(body);
      setScreen("thanks");
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  const hostDims: Array<{ key: keyof typeof hostScores; label: string }> = [
    { key: "hostCreateScore", label: t("dims.create") },
    { key: "hostInviteScore", label: t("dims.invite") },
    { key: "hostLiveResultsScore", label: t("dims.liveResults") },
    { key: "hostRulesScore", label: t("dims.rules") },
    { key: "hostSupportScore", label: t("dims.support") },
  ];

  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    width: "100%",
    minHeight: 48,
    background: disabled ? "#c7cad1" : colors.brandGradient,
    color: colors.white,
    border: "none",
    borderRadius: 12,
    padding: "13px 24px",
    fontSize: "0.95rem",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.white,
          borderRadius: 18,
          width: "100%",
          maxWidth: 480,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: colors.brandGradient,
            padding: isMobile ? "18px 44px 14px 20px" : "22px 48px 18px 28px",
            color: colors.white,
            flexShrink: 0,
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("notNow")}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.85)",
              fontSize: 24,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <div style={{ fontSize: "1.7rem", lineHeight: 1, marginBottom: 6 }}>🏆</div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0 }}>
            {isHost ? t("host.title") : t("player.title")}
          </h2>
          <p style={{ fontSize: "0.85rem", margin: "4px 0 0", color: colors.white, fontWeight: 500 }}>
            {isHost ? t("host.subtitle") : t("player.subtitle")}
          </p>
        </div>

        {/* Body (only scrolling part) */}
        <div style={{ padding: isMobile ? 18 : 24, overflowY: "auto", flex: 1, minHeight: 0 }}>
          {screen === "scores" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <ScaleBar
                label={t("q.overall")}
                value={overall}
                onChange={setOverall}
                lowHint={t("scaleLow")}
                highHint={t("scaleHigh")}
                isMobile={isMobile}
              />
              <ScaleBar
                label={t("q.recommend")}
                value={recommend}
                onChange={setRecommend}
                lowHint={t("scaleUnlikely")}
                highHint={t("scaleVeryLikely")}
                isMobile={isMobile}
              />
              <ScaleBar
                label={t("q.otherTournaments")}
                value={otherTournaments}
                onChange={setOtherTournaments}
                lowHint={t("scaleUnlikely")}
                highHint={t("scaleVeryLikely")}
                isMobile={isMobile}
              />
            </div>
          )}

          {screen === "details" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {isHost && (
                <>
                  <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#111827" }}>
                    {t("details.hostTitle")}
                  </div>
                  {hostDims.map((d) => (
                    <ScaleBar
                      key={d.key}
                      label={d.label}
                      value={hostScores[d.key]}
                      onChange={(v) => setHostScores((s) => ({ ...s, [d.key]: v }))}
                      lowHint={t("scaleLow")}
                      highHint={t("scaleHigh")}
                      isMobile={isMobile}
                    />
                  ))}
                </>
              )}

              <div>
                <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#111827", marginBottom: 8 }}>
                  {t("details.commentLabel")}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder={t("details.commentPlaceholder")}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: 10,
                    border: "1px solid #d7dbe3",
                    padding: 12,
                    fontSize: "0.9rem",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  fontSize: "0.82rem",
                  color: "#4b5563",
                  lineHeight: 1.5,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0, accentColor: colors.brand }}
                />
                <span>{t("details.consent")}</span>
              </label>
            </div>
          )}

          {screen === "thanks" && (
            <div style={{ textAlign: "center", padding: "18px 4px" }}>
              <div style={{ fontSize: "2.4rem", marginBottom: 10 }}>🙌</div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#111827", marginBottom: 6 }}>
                {t("thanks.title")}
              </div>
              <div style={{ fontSize: "0.9rem", color: "#4b5563", lineHeight: 1.5 }}>
                {t("thanks.body")}
              </div>
            </div>
          )}
        </div>

        {/* Fixed footer — actions always reachable */}
        <div
          style={{
            padding: isMobile ? "12px 18px 18px" : "14px 24px 24px",
            flexShrink: 0,
            borderTop: "1px solid #f1f1f4",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {error && (
            <div style={{ fontSize: "0.8rem", color: "#b91c1c", textAlign: "center" }}>
              {t("error")}
            </div>
          )}

          {screen === "scores" && (
            <>
              <button
                type="button"
                onClick={handleSubmitScores}
                disabled={!allScored || submitting}
                style={primaryBtn(!allScored || submitting)}
              >
                {submitting ? t("sending") : t("send")}
              </button>
              <button
                type="button"
                onClick={dismiss}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  minHeight: 40,
                }}
              >
                {t("notNow")}
              </button>
            </>
          )}

          {screen === "details" && (
            <>
              <button
                type="button"
                onClick={handleSubmitDetails}
                disabled={submitting}
                style={primaryBtn(submitting)}
              >
                {submitting ? t("sending") : t("details.send")}
              </button>
              <button
                type="button"
                onClick={() => setScreen("thanks")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  minHeight: 40,
                }}
              >
                {t("details.skip")}
              </button>
            </>
          )}

          {screen === "thanks" && (
            <button type="button" onClick={dismiss} style={primaryBtn(false)}>
              {t("thanks.close")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
