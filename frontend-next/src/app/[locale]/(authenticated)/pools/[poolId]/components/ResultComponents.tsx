"use client";

import { colors } from "@/lib/theme";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getTeamFlag } from "@/data/teamFlags";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { getTeamName } from "./poolHelpers";

// ========== RESULT SECTION (con modo lectura/edición) ==========
export function ResultSection(props: {
  result: any;
  resultSource?: string | null;
  isHost: boolean;
  isLive?: boolean;
  elapsed?: number | null;
  extra?: number | null;
  matchStatus?: string | null;
  onSave: (homeGoals: number, awayGoals: number, reason?: string, homePenalties?: number, awayPenalties?: number, homeGoals90?: number, awayGoals90?: number) => void;
  disabled: boolean;
  homeTeam: any;
  awayTeam: any;
  tournamentKey: string;
  phaseId?: string;
}) {
  const t = useTranslations("pool");
  const [editMode, setEditMode] = useState(false);

  const hasResult = !!props.result;

  return (
    <div style={{ border: "1px solid #f2f2f2", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: colors.textMuted }}>{t("result.title")}</div>
      </div>

      {/* No result yet — informative pending state */}
      {!hasResult && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "16px 12px",
          background: "linear-gradient(135deg, #f0f4ff 0%, #f5f3ff 100%)",
          borderRadius: 10,
          border: "1px solid #e0e7ff",
        }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>⏳</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#4338ca", textAlign: "center" }}>
            {t("result.awaitingResult")}
          </div>
          <div style={{ fontSize: 11, color: "#6366f1", textAlign: "center", lineHeight: 1.4 }}>
            {t("result.autoUpdateHint")}
          </div>
        </div>
      )}

      {/* Result exists — show it */}
      {hasResult && !editMode && (
        <>
          <ResultDisplay
            result={props.result}
            resultSource={props.resultSource ?? null}
            homeTeam={props.homeTeam}
            awayTeam={props.awayTeam}
            tournamentKey={props.tournamentKey}
            isLive={props.isLive ?? false}
            elapsed={props.elapsed ?? null}
            extra={props.extra ?? null}
            matchStatus={props.matchStatus ?? null}
          />
          {/* Modify result button: only when match has finished (not live, not in grace period) */}
          {props.isHost && !props.isLive && (
            <button
              onClick={() => setEditMode(true)}
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #e53e3e",
                background: "#fff5f5",
                color: "#c53030",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ✏️ {t("result.correctResult")}
            </button>
          )}
        </>
      )}

      {/* Override editor — ONLY when result exists and host clicks edit */}
      {props.isHost && hasResult && editMode && (
        <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
          {/* Warning banner */}
          <div style={{
            padding: "10px 14px",
            background: colors.errorBg,
            border: "1px solid #fecaca",
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 13,
            color: colors.errorDarker,
            fontWeight: 600,
            lineHeight: 1.5,
          }}>
            ⚠️ {t("result.overrideWarning")}
          </div>
          <ResultEditor
            result={props.result}
            requireReason={true}
            onSave={(homeGoals, awayGoals, reason, homePenalties, awayPenalties, homeGoals90, awayGoals90) => {
              props.onSave(homeGoals, awayGoals, reason, homePenalties, awayPenalties, homeGoals90, awayGoals90);
              setEditMode(false);
            }}
            onCancel={() => setEditMode(false)}
            disabled={props.disabled}
            homeTeam={props.homeTeam}
            awayTeam={props.awayTeam}
            tournamentKey={props.tournamentKey}
            phaseId={props.phaseId}
          />
        </div>
      )}
    </div>
  );
}

function ResultDisplay(props: {
  result: any;
  resultSource: string | null;
  homeTeam: any;
  awayTeam: any;
  tournamentKey: string;
  isLive: boolean;
  elapsed: number | null;
  extra: number | null;
  matchStatus: string | null;
}) {
  const t = useTranslations("pool");
  const tTeams = useTranslations("teams");
  const { result } = props;
  const homeFlag = getTeamFlag(props.homeTeam.id.replace("t_", ""), props.tournamentKey);
  const awayFlag = getTeamFlag(props.awayTeam.id.replace("t_", ""), props.tournamentKey);
  const homeName = getTeamName(props.homeTeam, tTeams);
  const awayName = getTeamName(props.awayTeam, tTeams);

  // Terminal scraper statuses: the match is over even though the result
  // may still be provisional (confirmation grace period). In that window
  // the card must read "finished, confirming" — not "live".
  const isFinished = ["FT", "AET", "PEN", "ABD"].includes(props.matchStatus ?? "");
  const inPlay = props.isLive && !isFinished;

  // Live ticker label: "45+3", "HT", or just elapsed minute
  const isHalftime = props.matchStatus === "HT";
  const showLiveTicker = inPlay && !isHalftime && props.elapsed != null;
  const elapsedLabel = props.elapsed != null
    ? (props.extra != null && props.extra > 0 ? `${props.elapsed}+${props.extra}'` : `${props.elapsed}'`)
    : "";

  return (
    <div>
      {/* Score display with team flags - compact horizontal layout */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%)", borderRadius: 8, padding: "10px 12px" }}>
        {/* Home team flag + score */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {homeFlag?.flagUrl ? (
            <img
              src={homeFlag.flagUrl}
              alt={homeName}
              title={homeName}
              width={48}
              height={36}
              loading="lazy"
              decoding="async"
              style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #b3d9ff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: colors.white, borderRadius: 3, border: "1px solid #b3d9ff" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 36, fontWeight: 900, color: colors.brand }}>{result.homeGoals}</span>
        </div>

        <span style={{ fontSize: 20, fontWeight: 700, color: "#99c2e8", margin: "0 4px" }}>-</span>

        {/* Away team score + flag */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: colors.brand }}>{result.awayGoals}</span>
          {awayFlag?.flagUrl ? (
            <img
              src={awayFlag.flagUrl}
              alt={awayName}
              title={awayName}
              width={48}
              height={36}
              loading="lazy"
              decoding="async"
              style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #b3d9ff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: colors.white, borderRadius: 3, border: "1px solid #b3d9ff" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
        </div>
      </div>

      {/* Live ticker — minute + indeterminate progress bar (only while match is in play) */}
      {(inPlay && (showLiveTicker || isHalftime)) && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            color: isHalftime ? "#92400e" : "#15803d",
            letterSpacing: 0.3,
            marginBottom: 4,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isHalftime ? "#f59e0b" : "#16a34a",
              animation: "pulse 1.6s ease-in-out infinite",
              flexShrink: 0,
            }} />
            {isHalftime ? t("result.halftime").toUpperCase() : elapsedLabel}
          </div>
          <div
            role="progressbar"
            aria-label={t("result.liveTickerLabel")}
            style={{
              position: "relative",
              height: 3,
              borderRadius: 999,
              background: isHalftime ? "#fef3c7" : "#dcfce7",
              overflow: "hidden",
            }}
          >
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              background: `linear-gradient(90deg, transparent 0%, ${isHalftime ? "#f59e0b" : "#16a34a"} 50%, transparent 100%)`,
              animation: "liveSweep 1.6s ease-in-out infinite",
              width: "40%",
            }} />
          </div>
        </div>
      )}

      {/* Extra time note (audit F4-2): a 2-1 after extra time used to be
          visually identical to a 2-1 in regulation — and most pools score
          against the 90' figure, so show it. goals90 != null ⇔ went to ET. */}
      {result.homeGoals90 != null && result.awayGoals90 != null && (
        <div style={{ marginTop: 8, padding: "6px 10px", background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#854d0e", textAlign: "center" }}>
          ⏱️ {t("result.extraTime90", { home: result.homeGoals90, away: result.awayGoals90 })}
        </div>
      )}

      {/* Penalties display (if any) */}
      {(result.homePenalties !== null && result.homePenalties !== undefined) && (
        <div style={{ marginTop: 12, padding: 10, background: "#fffbf0", border: "1px solid #ffc107", borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.warningDark, marginBottom: 6, textAlign: "center" }}>
            ⚽ {t("result.penalties")}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: result.homePenalties > (result.awayPenalties || 0) ? colors.success : colors.textMuted }}>
              {result.homePenalties}
            </span>
            <span style={{ fontSize: 14, color: colors.warningDark }}>-</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: (result.awayPenalties || 0) > result.homePenalties ? colors.success : colors.textMuted }}>
              {result.awayPenalties || 0}
            </span>
          </div>
          <div style={{ fontSize: 10, color: colors.warningDark, textAlign: "center", marginTop: 4 }}>
            {result.homePenalties > (result.awayPenalties || 0)
              ? `✅ ${t("result.teamWins", { team: homeName })}`
              : `✅ ${t("result.teamWins", { team: awayName })}`}
          </div>
        </div>
      )}

      {/* Footer: be honest about provenance (audit F4-3) without noise.
          In play → nothing (the live ticker says it all). Finished but
          inside the confirmation grace → "Finalizado · provisional".
          Confirmed → "Finalizado · oficial". No version suffix — host
          corrections already surface via the reason box below. */}
      {inPlay ? null : props.resultSource === "SCRAPER_PROVISIONAL" ? (
        <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: "#b45309", textAlign: "center" }}>
          {t("result.finishedProvisional")}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 10, color: colors.textLight, textAlign: "center" }}>
          {t("result.finishedOfficial")}
        </div>
      )}
      {result.reason && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: colors.warningBg,
            border: "1px solid #ffc107",
            borderRadius: 6,
            fontSize: 12,
            color: colors.warningDark,
          }}
        >
          <b>{t("result.correctionLabel")}:</b> {result.reason}
        </div>
      )}
    </div>
  );
}

function ResultEditor(props: {
  result: any;
  requireReason: boolean;
  onSave: (homeGoals: number, awayGoals: number, reason?: string, homePenalties?: number, awayPenalties?: number, homeGoals90?: number, awayGoals90?: number) => void;
  onCancel?: () => void;
  disabled: boolean;
  homeTeam: any;
  awayTeam: any;
  tournamentKey: string;
  phaseId?: string;
}) {
  const t = useTranslations("pool");
  const isMobile = useIsMobile();
  const [homeGoals, setHomeGoals] = useState(props.result ? String(props.result.homeGoals) : "");
  const [awayGoals, setAwayGoals] = useState(props.result ? String(props.result.awayGoals) : "");
  const [homePenalties, setHomePenalties] = useState(props.result?.homePenalties ? String(props.result.homePenalties) : "");
  const [awayPenalties, setAwayPenalties] = useState(props.result?.awayPenalties ? String(props.result.awayPenalties) : "");
  // Marcador al minuto 90 (audit F2-7/F4-7): sin estos campos, un
  // override del host en partido con prórroga borraba el goals90 de la
  // versión nueva y las fases con scoring a 90' puntuaban contra el
  // marcador con prórroga.
  const [wentToExtraTime, setWentToExtraTime] = useState(props.result?.homeGoals90 != null);
  const [homeGoals90, setHomeGoals90] = useState(props.result?.homeGoals90 != null ? String(props.result.homeGoals90) : "");
  const [awayGoals90, setAwayGoals90] = useState(props.result?.awayGoals90 != null ? String(props.result.awayGoals90) : "");
  const [reason, setReason] = useState("");

  // Detectar si es fase eliminatoria (no puede haber empates)
  const isKnockoutPhase = props.phaseId && !props.phaseId.includes("group");
  // Normalizar a números para comparar (fix para '03' vs '3')
  const homeNum = homeGoals.trim() !== "" ? Number(homeGoals) : null;
  const awayNum = awayGoals.trim() !== "" ? Number(awayGoals) : null;
  const isDraw = homeNum !== null && awayNum !== null && homeNum === awayNum;
  const showPenalties = isKnockoutPhase && isDraw;

  const home90Num = homeGoals90.trim() !== "" ? Number(homeGoals90) : null;
  const away90Num = awayGoals90.trim() !== "" ? Number(awayGoals90) : null;
  // Con prórroga activada: ambos 90' obligatorios y nunca mayores al final.
  const et90Invalid =
    !!wentToExtraTime &&
    (home90Num === null || away90Num === null ||
      (homeNum !== null && home90Num > homeNum) ||
      (awayNum !== null && away90Num > awayNum));

  const homeFlag = getTeamFlag(props.homeTeam.id.replace("t_", ""), props.tournamentKey);
  const awayFlag = getTeamFlag(props.awayTeam.id.replace("t_", ""), props.tournamentKey);
  const tTeams = useTranslations("teams");
  const homeName = getTeamName(props.homeTeam, tTeams);
  const awayName = getTeamName(props.awayTeam, tTeams);

  const needReason = props.requireReason && reason.trim().length === 0;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 10 }}>
        {/* Home team: logo + name stacked */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 56 }}>
          {homeFlag?.flagUrl ? (
            <img src={homeFlag.flagUrl} alt={homeName} width={48} height={36} loading="lazy" decoding="async" style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: colors.bgLight, borderRadius: 3, border: "1px solid #ddd" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 500, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{homeName}</span>
        </div>
        {/* Score inputs */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          <input
            type="number" min={0} value={homeGoals} onChange={(e) => setHomeGoals(e.target.value)} placeholder="0"
            style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: isMobile ? 16 : 22, fontWeight: 700, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
          />
          <span style={{ fontWeight: 900, fontSize: 18, color: colors.textMuted }}>-</span>
          <input
            type="number" min={0} value={awayGoals} onChange={(e) => setAwayGoals(e.target.value)} placeholder="0"
            style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: isMobile ? 16 : 22, fontWeight: 700, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
          />
        </div>
        {/* Away team: logo + name stacked */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 56 }}>
          {awayFlag?.flagUrl ? (
            <img src={awayFlag.flagUrl} alt={awayName} width={48} height={36} loading="lazy" decoding="async" style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: colors.bgLight, borderRadius: 3, border: "1px solid #ddd" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 500, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{awayName}</span>
        </div>
      </div>

      {/* Extra time (solo eliminatorias): captura el marcador al 90' */}
      {isKnockoutPhase && (
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, color: colors.textMuted, cursor: "pointer", minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}>
            <input
              type="checkbox"
              checked={!!wentToExtraTime}
              onChange={(e) => setWentToExtraTime(e.target.checked)}
            />
            {t("result.extraTimeToggle")}
          </label>
          {wentToExtraTime && (
            <div style={{ marginTop: 8, padding: 12, background: colors.bgLighter, border: "1px solid #d1d5db", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 8, textAlign: "center" }}>
                {t("result.ninetyMinLabel")}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <input
                  type="number" min={0} value={homeGoals90} onChange={(e) => setHomeGoals90(e.target.value)} placeholder="0"
                  style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #d1d5db", textAlign: "center", fontSize: 16, fontWeight: 700 }}
                />
                <span style={{ fontWeight: 900, fontSize: 16, color: colors.textMuted }}>-</span>
                <input
                  type="number" min={0} value={awayGoals90} onChange={(e) => setAwayGoals90(e.target.value)} placeholder="0"
                  style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #d1d5db", textAlign: "center", fontSize: 16, fontWeight: 700 }}
                />
              </div>
              {et90Invalid && (
                <div style={{ marginTop: 8, fontSize: 11, color: colors.error, textAlign: "center" }}>
                  {t("result.ninetyMinInvalid")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Penalties Section (solo para fases eliminatorias con empate) */}
      {showPenalties && (
        <div style={{ marginTop: 12, padding: 12, background: colors.warningBg, border: "1px solid #ffc107", borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.warningDark, marginBottom: 8, textAlign: "center" }}>
            ⚠️ {t("result.penaltiesRequired")}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: colors.textMuted }}>{t("result.penaltiesLabel", { team: homeName })}</span>
              <input
                type="number"
                min={0}
                max={99}
                value={homePenalties}
                onChange={(e) => setHomePenalties(e.target.value)}
                placeholder="0"
                style={{ width: 60, padding: 8, borderRadius: 8, border: "1px solid #ffc107", textAlign: "center", fontSize: 16, fontWeight: 700, background: "#fffbf0" }}
              />
            </div>
            <span style={{ fontWeight: 900, fontSize: 16, color: colors.warningDark, marginTop: 20 }}>-</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: colors.textMuted }}>{t("result.penaltiesLabel", { team: awayName })}</span>
              <input
                type="number"
                min={0}
                max={99}
                value={awayPenalties}
                onChange={(e) => setAwayPenalties(e.target.value)}
                placeholder="0"
                style={{ width: 60, padding: 8, borderRadius: 8, border: "1px solid #ffc107", textAlign: "center", fontSize: 16, fontWeight: 700, background: "#fffbf0" }}
              />
            </div>
          </div>
        </div>
      )}

      {props.requireReason && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`⚠️ ${t("result.correctionPlaceholder")}`}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", fontSize: isMobile ? 16 : 13, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
        />
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={props.disabled || needReason || et90Invalid}
          onClick={() => {
            const hp = showPenalties && homePenalties ? Number(homePenalties) : undefined;
            const ap = showPenalties && awayPenalties ? Number(awayPenalties) : undefined;
            const hg90 = wentToExtraTime && home90Num !== null ? home90Num : undefined;
            const ag90 = wentToExtraTime && away90Num !== null ? away90Num : undefined;
            props.onSave(
              Number(homeGoals),
              Number(awayGoals),
              props.requireReason ? reason.trim() : undefined,
              hp,
              ap,
              hg90,
              ag90
            );
          }}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #111",
            background: needReason || et90Invalid ? colors.disabled : colors.text,
            color: colors.white,
            cursor: needReason || et90Invalid ? "not-allowed" : "pointer",
            fontWeight: 600,
            minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
            ...mobileInteractiveStyles.tapHighlight,
          }}
        >
          {props.disabled ? "..." : props.requireReason ? `📝 ${t("result.publishCorrection")}` : `📢 ${t("result.publishResult")}`}
        </button>
        {props.onCancel && (
          <button
            onClick={props.onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid #999",
              background: colors.white,
              color: colors.textMuted,
              cursor: "pointer",
              minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            {t("result.cancel")}
          </button>
        )}
      </div>

      {needReason && (
        <div style={{ fontSize: 11, color: "#d00", textAlign: "center" }}>
          ⚠️ {t("result.correctionRequired")}
        </div>
      )}
    </div>
  );
}
