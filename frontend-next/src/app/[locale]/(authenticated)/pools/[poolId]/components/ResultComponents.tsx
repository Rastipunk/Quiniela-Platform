"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getTeamFlag, getCountryName } from "@/data/teamFlags";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";

// ========== RESULT SECTION (con modo lectura/edición) ==========
export function ResultSection(props: {
  result: any;
  isHost: boolean;
  onSave: (homeGoals: number, awayGoals: number, reason?: string, homePenalties?: number, awayPenalties?: number) => void;
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
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#555" }}>{t("result.title")}</div>

      {!hasResult && !editMode && (
        <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>
          {props.isHost ? t("result.noResultHost") : t("result.noResultPlayer")}
        </div>
      )}

      {hasResult && !editMode && (
        <>
          <ResultDisplay
            result={props.result}
            homeTeam={props.homeTeam}
            awayTeam={props.awayTeam}
            tournamentKey={props.tournamentKey}
          />
          {props.isHost && (
            <button
              onClick={() => setEditMode(true)}
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #666",
                background: "#fff",
                color: "#333",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ✏️ {t("result.correctResult")}
            </button>
          )}
        </>
      )}

      {props.isHost && (editMode || !hasResult) && (
        <div style={{ marginTop: hasResult ? 10 : 0, borderTop: hasResult ? "1px solid #eee" : "none", paddingTop: hasResult ? 10 : 0 }}>
          <ResultEditor
            result={props.result}
            requireReason={hasResult}
            onSave={(homeGoals, awayGoals, reason, homePenalties, awayPenalties) => {
              props.onSave(homeGoals, awayGoals, reason, homePenalties, awayPenalties);
              setEditMode(false);
            }}
            onCancel={hasResult ? () => setEditMode(false) : undefined}
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

function ResultDisplay(props: { result: any; homeTeam: any; awayTeam: any; tournamentKey: string }) {
  const t = useTranslations("pool");
  const { result } = props;
  const homeFlag = getTeamFlag(props.homeTeam.id.replace("t_", ""), props.tournamentKey);
  const awayFlag = getTeamFlag(props.awayTeam.id.replace("t_", ""), props.tournamentKey);
  const homeName = getCountryName(props.homeTeam.id, props.tournamentKey);
  const awayName = getCountryName(props.awayTeam.id, props.tournamentKey);

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
              style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #b3d9ff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: 3, border: "1px solid #b3d9ff" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 36, fontWeight: 900, color: "#007bff" }}>{result.homeGoals}</span>
        </div>

        <span style={{ fontSize: 20, fontWeight: 700, color: "#99c2e8", margin: "0 4px" }}>-</span>

        {/* Away team score + flag */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: "#007bff" }}>{result.awayGoals}</span>
          {awayFlag?.flagUrl ? (
            <img
              src={awayFlag.flagUrl}
              alt={awayName}
              title={awayName}
              style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #b3d9ff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: 3, border: "1px solid #b3d9ff" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
        </div>
      </div>

      {/* Penalties display (if any) */}
      {(result.homePenalties !== null && result.homePenalties !== undefined) && (
        <div style={{ marginTop: 12, padding: 10, background: "#fffbf0", border: "1px solid #ffc107", borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#856404", marginBottom: 6, textAlign: "center" }}>
            ⚽ {t("result.penalties")}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: result.homePenalties > (result.awayPenalties || 0) ? "#28a745" : "#666" }}>
              {result.homePenalties}
            </span>
            <span style={{ fontSize: 14, color: "#856404" }}>-</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: (result.awayPenalties || 0) > result.homePenalties ? "#28a745" : "#666" }}>
              {result.awayPenalties || 0}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "#856404", textAlign: "center", marginTop: 4 }}>
            {result.homePenalties > (result.awayPenalties || 0)
              ? `✅ ${t("result.teamWins", { team: homeName })}`
              : `✅ ${t("result.teamWins", { team: awayName })}`}
          </div>
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 10, color: "#999", textAlign: "center" }}>
        {t("result.officialResult")}{result.version > 1 ? ` (v${result.version})` : ""}
      </div>
      {result.reason && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 6,
            fontSize: 12,
            color: "#856404",
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
  onSave: (homeGoals: number, awayGoals: number, reason?: string, homePenalties?: number, awayPenalties?: number) => void;
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
  const [reason, setReason] = useState("");

  // Detectar si es fase eliminatoria (no puede haber empates)
  const isKnockoutPhase = props.phaseId && !props.phaseId.includes("group");
  // Normalizar a números para comparar (fix para '03' vs '3')
  const homeNum = homeGoals.trim() !== "" ? Number(homeGoals) : null;
  const awayNum = awayGoals.trim() !== "" ? Number(awayGoals) : null;
  const isDraw = homeNum !== null && awayNum !== null && homeNum === awayNum;
  const showPenalties = isKnockoutPhase && isDraw;

  const homeFlag = getTeamFlag(props.homeTeam.id.replace("t_", ""), props.tournamentKey);
  const awayFlag = getTeamFlag(props.awayTeam.id.replace("t_", ""), props.tournamentKey);
  const homeName = getCountryName(props.homeTeam.id, props.tournamentKey);
  const awayName = getCountryName(props.awayTeam.id, props.tournamentKey);

  const needReason = props.requireReason && reason.trim().length === 0;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 10 }}>
        {/* Home team: logo + name stacked */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 56 }}>
          {homeFlag?.flagUrl ? (
            <img src={homeFlag.flagUrl} alt={homeName} style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 3, border: "1px solid #ddd" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 10, color: "#666", fontWeight: 500, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{homeName}</span>
        </div>
        {/* Score inputs */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          <input
            type="number" min={0} value={homeGoals} onChange={(e) => setHomeGoals(e.target.value)} placeholder="0"
            style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: isMobile ? 16 : 22, fontWeight: 700, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
          />
          <span style={{ fontWeight: 900, fontSize: 18, color: "#666" }}>-</span>
          <input
            type="number" min={0} value={awayGoals} onChange={(e) => setAwayGoals(e.target.value)} placeholder="0"
            style={{ width: 52, padding: 8, borderRadius: 8, border: "1px solid #ddd", textAlign: "center", fontSize: isMobile ? 16 : 22, fontWeight: 700, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
          />
        </div>
        {/* Away team: logo + name stacked */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 56 }}>
          {awayFlag?.flagUrl ? (
            <img src={awayFlag.flagUrl} alt={awayName} style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 3, border: "1px solid #ddd" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 10, color: "#666", fontWeight: 500, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{awayName}</span>
        </div>
      </div>

      {/* Penalties Section (solo para fases eliminatorias con empate) */}
      {showPenalties && (
        <div style={{ marginTop: 12, padding: 12, background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#856404", marginBottom: 8, textAlign: "center" }}>
            ⚠️ {t("result.penaltiesRequired")}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#666" }}>{t("result.penaltiesLabel", { team: homeName })}</span>
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
            <span style={{ fontWeight: 900, fontSize: 16, color: "#856404", marginTop: 20 }}>-</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#666" }}>{t("result.penaltiesLabel", { team: awayName })}</span>
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
          disabled={props.disabled || needReason}
          onClick={() => {
            const hp = showPenalties && homePenalties ? Number(homePenalties) : undefined;
            const ap = showPenalties && awayPenalties ? Number(awayPenalties) : undefined;
            props.onSave(
              Number(homeGoals),
              Number(awayGoals),
              props.requireReason ? reason.trim() : undefined,
              hp,
              ap
            );
          }}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #111",
            background: needReason ? "#ccc" : "#111",
            color: "#fff",
            cursor: needReason ? "not-allowed" : "pointer",
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
              background: "#fff",
              color: "#666",
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
