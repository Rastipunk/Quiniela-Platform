"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TeamFlag } from "@/components/TeamFlag";
import { getTeamFlag, getCountryName } from "@/data/teamFlags";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";

// ========== PICK SECTION (con modo lectura/edición) ==========
export function PickSection(props: {
  pick: any;
  isLocked: boolean;
  allowScorePick: boolean;
  onSave: (pick: any) => void;
  disabled: boolean;
  homeTeam: any;
  awayTeam: any;
  tournamentKey: string;
}) {
  const t = useTranslations("pool");
  const [editMode, setEditMode] = useState(false);

  const hasPick = !!props.pick;
  const _pickType = props.pick?.type;
  void _pickType; // Reserved for future pick type display

  // Si está locked o no hay pick, no puede editar
  const _canEdit = !props.isLocked;
  void _canEdit; // Used implicitly through !props.isLocked checks

  return (
    <div style={{ border: "1px solid #f2f2f2", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#555" }}>{t("pick.myPick")}</div>

      {props.isLocked && !hasPick && (
        <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>🔒 {t("pick.noPick")}</div>
      )}

      {props.isLocked && hasPick && (
        <PickDisplay
          pick={props.pick}
          homeTeam={props.homeTeam}
          awayTeam={props.awayTeam}
          tournamentKey={props.tournamentKey}
        />
      )}

      {!props.isLocked && !editMode && hasPick && (
        <>
          <PickDisplay
            pick={props.pick}
            homeTeam={props.homeTeam}
            awayTeam={props.awayTeam}
            tournamentKey={props.tournamentKey}
          />
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
            ✏️ {t("pick.modify")}
          </button>
        </>
      )}

      {!props.isLocked && (editMode || !hasPick) && (
        <PickEditor
          pick={props.pick}
          allowScorePick={props.allowScorePick}
          onSave={(pick) => {
            props.onSave(pick);
            setEditMode(false);
          }}
          onCancel={hasPick ? () => setEditMode(false) : undefined}
          disabled={props.disabled}
          homeTeam={props.homeTeam}
          awayTeam={props.awayTeam}
          tournamentKey={props.tournamentKey}
        />
      )}

      {!props.isLocked && !hasPick && !editMode && (
        <div style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>{t("pick.noPickYet")}</div>
      )}
    </div>
  );
}

function PickDisplay(props: { pick: any; homeTeam: any; awayTeam: any; tournamentKey: string }) {
  const t = useTranslations("pool");
  const { pick } = props;
  const homeFlag = getTeamFlag(props.homeTeam.id.replace("t_", ""), props.tournamentKey);
  const awayFlag = getTeamFlag(props.awayTeam.id.replace("t_", ""), props.tournamentKey);
  const homeName = getCountryName(props.homeTeam.id, props.tournamentKey);
  const awayName = getCountryName(props.awayTeam.id, props.tournamentKey);

  if (pick.type === "SCORE") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {/* Home team flag + score */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {homeFlag?.flagUrl ? (
            <img
              src={homeFlag.flagUrl}
              alt={homeName}
              title={homeName}
              style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 3, border: "1px solid #ddd" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
          <span style={{ fontSize: 36, fontWeight: 900, color: "#111" }}>{pick.homeGoals}</span>
        </div>

        <span style={{ fontSize: 20, fontWeight: 700, color: "#999", margin: "0 4px" }}>-</span>

        {/* Away team score + flag */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: "#111" }}>{pick.awayGoals}</span>
          {awayFlag?.flagUrl ? (
            <img
              src={awayFlag.flagUrl}
              alt={awayName}
              title={awayName}
              style={{ width: 48, height: "auto", borderRadius: 3, border: "1px solid #ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            />
          ) : (
            <div style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", borderRadius: 3, border: "1px solid #ddd" }}>
              <span style={{ fontSize: 18 }}>⚽</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (pick.type === "OUTCOME") {
    const labels: Record<string, string> = {
      HOME: `🏠 ${t("pick.homeWin")}`,
      DRAW: `🤝 ${t("pick.draw")}`,
      AWAY: `🚪 ${t("pick.awayWin")}`,
    };
    return (
      <div>
        {/* Team flags header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
          <TeamFlag teamId={props.homeTeam.id} tournamentKey={props.tournamentKey} size="sm" showName={true} layout="horizontal" />
          <TeamFlag teamId={props.awayTeam.id} tournamentKey={props.tournamentKey} size="sm" showName={true} layout="horizontal" />
        </div>
        {/* Outcome display */}
        <div
          style={{
            padding: "12px",
            fontSize: 16,
            fontWeight: 700,
            textAlign: "center",
            color: "#111",
            background: "#f9f9f9",
            borderRadius: 8,
          }}
        >
          {labels[pick.outcome] ?? pick.outcome}
        </div>
      </div>
    );
  }

  return <pre style={{ margin: 0, fontSize: 12, color: "#666" }}>{JSON.stringify(pick, null, 2)}</pre>;
}

function PickEditor(props: {
  pick: any;
  allowScorePick: boolean;
  onSave: (pick: any) => void;
  onCancel?: () => void;
  disabled: boolean;
  homeTeam: any;
  awayTeam: any;
  tournamentKey: string;
}) {
  const t = useTranslations("pool");
  const isMobile = useIsMobile();
  const pickType = props.pick?.type;
  const isScore = pickType === "SCORE";
  const isOutcome = pickType === "OUTCOME";

  const [homeGoals, setHomeGoals] = useState(isScore ? String(props.pick.homeGoals ?? "") : "");
  const [awayGoals, setAwayGoals] = useState(isScore ? String(props.pick.awayGoals ?? "") : "");
  const [outcome, setOutcome] = useState<string>(isOutcome ? (props.pick.outcome ?? "") : "");

  const homeFlag = getTeamFlag(props.homeTeam.id.replace("t_", ""), props.tournamentKey);
  const awayFlag = getTeamFlag(props.awayTeam.id.replace("t_", ""), props.tournamentKey);
  const homeName = getCountryName(props.homeTeam.id, props.tournamentKey);
  const awayName = getCountryName(props.awayTeam.id, props.tournamentKey);

  const handleSave = () => {
    if (props.allowScorePick) {
      props.onSave({ type: "SCORE", homeGoals: Number(homeGoals), awayGoals: Number(awayGoals) });
    } else {
      props.onSave({ type: "OUTCOME", outcome: outcome as "HOME" | "DRAW" | "AWAY" });
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {props.allowScorePick ? (
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
            <span style={{ fontSize: 10, color: "#666", fontWeight: 500, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{homeName}</span>
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
            <span style={{ fontSize: 10, color: "#666", fontWeight: 500, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{awayName}</span>
          </div>
        </div>
      ) : (
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", fontSize: isMobile ? 16 : 14, minHeight: isMobile ? TOUCH_TARGET.minimum : undefined }}
        >
          <option value="">{t("pick.selectPlaceholder")}</option>
          <option value="HOME">🏠 {t("pick.homeWin")}</option>
          <option value="DRAW">🤝 {t("pick.draw")}</option>
          <option value="AWAY">🚪 {t("pick.awayWin")}</option>
        </select>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={props.disabled}
          onClick={handleSave}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
            ...mobileInteractiveStyles.tapHighlight,
          }}
        >
          {props.disabled ? "..." : `💾 ${t("pick.save")}`}
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
            {t("pick.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
