"use client";

// Paso 2: Configuración por Fase
// Sprint 2 - Advanced Pick Types System

import { useState } from "react";
import { useTranslations } from "next-intl";
import type {
  PhasePickConfig,
  MatchPickType,
  MatchPickTypeKey,
} from "../types/pickConfig";

type PhaseType = "GROUP" | "KNOCKOUT" | string;

type PhaseConfigStepProps = {
  phases: PhasePickConfig[];
  phaseTypes: Map<string, PhaseType>; // Map de phaseId -> tipo (GROUP/KNOCKOUT)
  onPhasesChange: (phases: PhasePickConfig[]) => void;
  onNext: () => void;
  isMobile?: boolean;
};

export function PhaseConfigStep({
  phases,
  phaseTypes,
  onPhasesChange,
  onNext,
  isMobile = false,
}: PhaseConfigStepProps) {
  const tp = useTranslations("pool");
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const currentPhase = phases[currentPhaseIndex];

  // Determinar el tipo de fase actual (GROUP o KNOCKOUT)
  const currentPhaseType = phaseTypes.get(currentPhase.phaseId) || "KNOCKOUT";

  function handleRequiresScoreChange(requiresScore: boolean) {
    const updated = [...phases];

    // Determinar el tipo de structural pick basado en el tipo de fase
    const isGroupPhase = currentPhaseType === "GROUP";
    const structuralPickConfig = isGroupPhase
      ? {
          type: "GROUP_STANDINGS" as const,
          config: {
            // Puntos por posición (por defecto todos iguales a 10)
            pointsPosition1: 10,
            pointsPosition2: 10,
            pointsPosition3: 10,
            pointsPosition4: 10,
            // Bonus por grupo perfecto (opcional)
            bonusPerfectGroupEnabled: true,
            bonusPerfectGroup: 20,
          },
        }
      : {
          type: "KNOCKOUT_WINNER" as const,
          config: {
            pointsPerCorrectAdvance: 15,
          },
        };

    updated[currentPhaseIndex] = {
      ...currentPhase,
      requiresScore,
      matchPicks: requiresScore
        ? {
            types: getDefaultMatchPickTypes(),
          }
        : undefined,
      structuralPicks: !requiresScore ? structuralPickConfig : undefined,
    };
    onPhasesChange(updated);
  }

  function handleMatchPickTypeChange(
    typeKey: MatchPickTypeKey,
    enabled: boolean,
    points?: number
  ) {
    if (!currentPhase.matchPicks) return;

    const updated = [...phases];
    const typeIndex = currentPhase.matchPicks.types.findIndex(
      (t) => t.key === typeKey
    );

    if (typeIndex >= 0) {
      updated[currentPhaseIndex] = {
        ...currentPhase,
        matchPicks: {
          ...currentPhase.matchPicks,
          types: currentPhase.matchPicks.types.map((t, i) =>
            i === typeIndex
              ? {
                  ...t,
                  enabled,
                  points: points !== undefined ? points : t.points,
                }
              : t
          ),
        },
      };
      onPhasesChange(updated);
    }
  }

  function handleStructuralConfigChange(newConfig: Record<string, number | boolean>) {
    if (!currentPhase.structuralPicks) return;

    const updated = [...phases];
    updated[currentPhaseIndex] = {
      ...currentPhase,
      structuralPicks: {
        ...currentPhase.structuralPicks,
        config: {
          ...currentPhase.structuralPicks.config,
          ...newConfig,
        },
      },
    };
    onPhasesChange(updated);
  }

  function handleNext() {
    if (currentPhaseIndex < phases.length - 1) {
      setCurrentPhaseIndex(currentPhaseIndex + 1);
    } else {
      onNext();
    }
  }

  function handlePrevious() {
    if (currentPhaseIndex > 0) {
      setCurrentPhaseIndex(currentPhaseIndex - 1);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "1rem" : "1.5rem" }}>
      {/* Phase Progress - Sticky Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "white",
          padding: isMobile ? "0.75rem 0" : "1rem 0",
          marginLeft: isMobile ? "-1rem" : "-2rem",
          marginRight: isMobile ? "-1rem" : "-2rem",
          paddingLeft: isMobile ? "1rem" : "2rem",
          paddingRight: isMobile ? "1rem" : "2rem",
          borderBottom: "1px solid #eee",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <span style={{ fontWeight: "bold", fontSize: isMobile ? "1rem" : "1.125rem" }}>
            {currentPhase.phaseName}
          </span>
          <span style={{ color: "#666", fontSize: isMobile ? "0.75rem" : "0.875rem" }}>
            {currentPhaseIndex + 1}/{phases.length}
          </span>
        </div>
        <div
          style={{
            height: "4px",
            background: "#eee",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "#007bff",
              width: `${((currentPhaseIndex + 1) / phases.length) * 100}%`,
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {/* Fundamental Decision */}
      <div>
        <h3 style={{ margin: "0 0 0.75rem 0", fontSize: isMobile ? "1rem" : "1.17rem" }}>
          {tp("phaseConfig.fundamentalDecision")}
        </h3>
        <p style={{ color: "#666", fontSize: isMobile ? "0.8rem" : "0.875rem", margin: "0 0 0.75rem 0" }}>
          {tp("phaseConfig.predictScores")}
        </p>

        <div style={{
          display: "flex",
          flexDirection: isMobile ? "row" : "row",
          gap: isMobile ? "0.5rem" : "1rem"
        }}>
          <DecisionCard
            title={isMobile ? `⚽ ${tp("phaseConfig.withScoresMobile")}` : `⚽ ${tp("phaseConfig.withScores")}`}
            selected={currentPhase.requiresScore === true}
            onClick={() => handleRequiresScoreChange(true)}
            isMobile={isMobile}
          >
            {!isMobile && <p>{tp("phaseConfig.withScoresDesc")}</p>}
            <ul style={{ paddingLeft: isMobile ? "1rem" : "1.25rem", margin: isMobile ? 0 : "0.5rem 0 0 0", fontSize: isMobile ? "0.75rem" : "inherit" }}>
              <li>{tp("phaseConfig.withScoresMore")}</li>
              {!isMobile && <li>{tp("phaseConfig.withScoresMultiple")}</li>}
            </ul>
          </DecisionCard>

          <DecisionCard
            title={isMobile ? `📊 ${tp("phaseConfig.withoutScoresMobile")}` : `📊 ${tp("phaseConfig.withoutScores")}`}
            selected={currentPhase.requiresScore === false}
            onClick={() => handleRequiresScoreChange(false)}
            isMobile={isMobile}
          >
            {!isMobile && <p>{tp("phaseConfig.withoutScoresDesc")}</p>}
            <ul style={{ paddingLeft: isMobile ? "1rem" : "1.25rem", margin: isMobile ? 0 : "0.5rem 0 0 0", fontSize: isMobile ? "0.75rem" : "inherit" }}>
              <li>{tp("phaseConfig.withoutScoresMore")}</li>
              {!isMobile && <li>{tp("phaseConfig.withoutScoresLess")}</li>}
            </ul>
          </DecisionCard>
        </div>
      </div>

      {/* Configuration based on requiresScore */}
      {currentPhase.requiresScore && currentPhase.matchPicks && (
        <MatchPicksConfiguration
          matchPicks={currentPhase.matchPicks}
          onTypeChange={handleMatchPickTypeChange}
          isMobile={isMobile}
        />
      )}

      {!currentPhase.requiresScore && currentPhase.structuralPicks && (
        <StructuralPicksConfiguration
          structuralPicks={currentPhase.structuralPicks}
          phaseType={currentPhaseType}
          onConfigChange={handleStructuralConfigChange}
          isMobile={isMobile}
        />
      )}

      {/* Navigation */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        gap: isMobile ? "0.5rem" : "1rem",
        paddingTop: isMobile ? "0.75rem" : "1rem"
      }}>
        <button
          onClick={handlePrevious}
          disabled={currentPhaseIndex === 0}
          style={{
            flex: isMobile ? 1 : "none",
            padding: isMobile ? "0.6rem 0.75rem" : "0.75rem 1.5rem",
            fontSize: isMobile ? "0.85rem" : "1rem",
            background: currentPhaseIndex === 0 ? "#f5f5f5" : "white",
            border: currentPhaseIndex === 0 ? "1px solid #ddd" : "1px solid #007bff",
            borderRadius: "6px",
            cursor: currentPhaseIndex === 0 ? "not-allowed" : "pointer",
            color: currentPhaseIndex === 0 ? "#999" : "#007bff",
            fontWeight: currentPhaseIndex === 0 ? "normal" : "500",
            minHeight: isMobile ? "40px" : "auto",
          }}
        >
          {isMobile ? `← ${tp("phaseConfig.previousPhaseMobile")}` : `← ${tp("phaseConfig.previousPhase")}`}
        </button>

        <button
          onClick={handleNext}
          style={{
            flex: isMobile ? 1 : "none",
            padding: isMobile ? "0.6rem 0.75rem" : "0.75rem 1.5rem",
            fontSize: isMobile ? "0.85rem" : "1rem",
            background: "#007bff",
            border: "none",
            borderRadius: "6px",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold",
            minHeight: isMobile ? "40px" : "auto",
          }}
        >
          {currentPhaseIndex < phases.length - 1
            ? (isMobile ? `${tp("phaseConfig.nextPhaseMobile")} →` : `${tp("phaseConfig.nextPhase")} →`)
            : (isMobile ? `${tp("phaseConfig.viewSummaryMobile")} →` : `${tp("phaseConfig.viewSummary")} →`)}
        </button>
      </div>
    </div>
  );
}

// ==================== HELPER COMPONENTS ====================

type DecisionCardProps = {
  title: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  isMobile?: boolean;
};

function DecisionCard({ title, selected, onClick, children, isMobile = false }: DecisionCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        border: selected ? "2px solid #007bff" : "1px solid #ddd",
        borderRadius: isMobile ? "6px" : "8px",
        padding: isMobile ? "0.75rem" : "1.5rem",
        cursor: "pointer",
        background: selected ? "#f0f8ff" : "white",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = "#007bff";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = "#ddd";
        }
      }}
    >
      <h4 style={{
        margin: isMobile ? "0 0 0.5rem 0" : "0 0 0.75rem 0",
        fontSize: isMobile ? "0.85rem" : "1rem"
      }}>{title}</h4>
      <div style={{ fontSize: isMobile ? "0.75rem" : "0.875rem", color: "#666" }}>{children}</div>
    </div>
  );
}

type MatchPicksConfigurationProps = {
  matchPicks: { types: MatchPickType[] };
  onTypeChange: (typeKey: MatchPickTypeKey, enabled: boolean, points?: number) => void;
  isMobile?: boolean;
};

function MatchPicksConfiguration({
  matchPicks,
  onTypeChange,
  isMobile = false,
}: MatchPicksConfigurationProps) {
  const tp = useTranslations("pool");

  return (
    <div>
      <h3 style={{ margin: "0 0 0.75rem 0", fontSize: isMobile ? "1rem" : "1.17rem" }}>
        {tp("phaseConfig.pickTypes")}
      </h3>
      <p style={{ color: "#666", fontSize: isMobile ? "0.8rem" : "0.875rem", margin: "0 0 1rem 0" }}>
        {isMobile ? tp("phaseConfig.pickTypesDesc") : tp("phaseConfig.pickTypesDescFull")}
      </p>

      <div style={{ display: "grid", gap: isMobile ? "0.5rem" : "1rem" }}>
        {matchPicks.types
          .filter((t) => t.key !== "MATCH_OUTCOME_90MIN")
          .map((type) => (
            <PickTypeCard
              key={type.key}
              type={type}
              title={tp(`pickTypeExtended.${type.key}.title` as any)}
              description={isMobile
                ? tp(`pickTypeExtended.${type.key}.shortDesc` as any)
                : tp(`pickTypeExtended.${type.key}.description` as any)}
              example={tp(`pickTypeExtended.${type.key}.example` as any)}
              onToggle={(enabled) => onTypeChange(type.key, enabled)}
              onPointsChange={(points) => onTypeChange(type.key, type.enabled, points)}
              isMobile={isMobile}
            />
          ))}
      </div>
    </div>
  );
}

type StructuralPicksConfigurationProps = {
  structuralPicks: any;
  phaseType: string;
  onConfigChange: (config: Record<string, number | boolean>) => void;
  isMobile?: boolean;
};

function StructuralPicksConfiguration({ structuralPicks, phaseType, onConfigChange, isMobile = false }: StructuralPicksConfigurationProps) {
  const tp = useTranslations("pool");
  const isGroupPhase = phaseType === "GROUP";
  const config = structuralPicks?.config || {};

  // Valores por defecto para GROUP_STANDINGS
  const pointsPosition1 = config.pointsPosition1 ?? 10;
  const pointsPosition2 = config.pointsPosition2 ?? 10;
  const pointsPosition3 = config.pointsPosition3 ?? 10;
  const pointsPosition4 = config.pointsPosition4 ?? 10;
  const bonusPerfectGroupEnabled = config.bonusPerfectGroupEnabled ?? true;
  const bonusPerfectGroup = config.bonusPerfectGroup ?? 20;

  // Calcular ejemplo dinámico
  const examplePerfect = pointsPosition1 + pointsPosition2 + pointsPosition3 + pointsPosition4 + (bonusPerfectGroupEnabled ? bonusPerfectGroup : 0);

  const inputStyle = {
    width: isMobile ? "50px" : "60px",
    padding: isMobile ? "0.3rem" : "0.4rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: isMobile ? "0.85rem" : "0.95rem",
    textAlign: "center" as const,
    background: "white",
  };

  const positionRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: isMobile ? "0.25rem" : "0.5rem",
    padding: isMobile ? "0.4rem 0.5rem" : "0.5rem 0.75rem",
    background: "white",
    borderRadius: "6px",
    border: "1px solid #e0e0e0",
  };

  const labelStyle = {
    display: "flex",
    alignItems: "center",
    gap: isMobile ? "0.5rem" : "0.75rem",
    padding: isMobile ? "0.5rem" : "0.75rem",
    background: "white",
    borderRadius: "6px",
    border: "1px solid #e0e0e0",
  };

  return (
    <div>
      <h3 style={{ margin: "0 0 0.75rem 0", fontSize: isMobile ? "1rem" : "1.17rem" }}>
        {tp("phaseConfig.noScoresConfig")}
      </h3>

      <div
        style={{
          border: "2px solid #007bff",
          borderRadius: isMobile ? "6px" : "8px",
          padding: isMobile ? "1rem" : "1.5rem",
          background: "#f0f8ff",
        }}
      >
        {isGroupPhase ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: isMobile ? "0.5rem" : "0.75rem" }}>
              <span style={{ fontSize: isMobile ? "1.25rem" : "1.5rem" }}>📊</span>
              <strong style={{ fontSize: isMobile ? "1rem" : "1.125rem" }}>{tp("phaseConfig.orderPositions")}</strong>
            </div>
            <p style={{ margin: "0 0 1rem 0", color: "#666", fontSize: isMobile ? "0.8rem" : "0.875rem" }}>
              {isMobile
                ? tp("phaseConfig.orderPositionsDesc")
                : tp("phaseConfig.orderPositionsDescFull")}
            </p>

            {/* Puntos por posición */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.75rem", color: "#333" }}>
                {tp("phaseConfig.pointsPerPosition")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
                <div style={positionRowStyle}>
                  <span style={{ fontSize: "1rem" }}>🥇</span>
                  <span style={{ fontSize: "0.8rem", color: "#666" }}>1°</span>
                  <input
                    type="number"
                    value={pointsPosition1}
                    onChange={(e) => onConfigChange({ pointsPosition1: Number(e.target.value) })}
                    min={0}
                    max={100}
                    style={inputStyle}
                  />
                </div>
                <div style={positionRowStyle}>
                  <span style={{ fontSize: "1rem" }}>🥈</span>
                  <span style={{ fontSize: "0.8rem", color: "#666" }}>2°</span>
                  <input
                    type="number"
                    value={pointsPosition2}
                    onChange={(e) => onConfigChange({ pointsPosition2: Number(e.target.value) })}
                    min={0}
                    max={100}
                    style={inputStyle}
                  />
                </div>
                <div style={positionRowStyle}>
                  <span style={{ fontSize: "1rem" }}>🥉</span>
                  <span style={{ fontSize: "0.8rem", color: "#666" }}>3°</span>
                  <input
                    type="number"
                    value={pointsPosition3}
                    onChange={(e) => onConfigChange({ pointsPosition3: Number(e.target.value) })}
                    min={0}
                    max={100}
                    style={inputStyle}
                  />
                </div>
                <div style={positionRowStyle}>
                  <span style={{ fontSize: "1rem" }}>4️⃣</span>
                  <span style={{ fontSize: "0.8rem", color: "#666" }}>4°</span>
                  <input
                    type="number"
                    value={pointsPosition4}
                    onChange={(e) => onConfigChange({ pointsPosition4: Number(e.target.value) })}
                    min={0}
                    max={100}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Toggle bonus grupo perfecto */}
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  ...labelStyle,
                  background: bonusPerfectGroupEnabled ? "#fff" : "#f5f5f5",
                  border: bonusPerfectGroupEnabled ? "1px solid #007bff" : "1px solid #e0e0e0",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={bonusPerfectGroupEnabled}
                    onChange={(e) => onConfigChange({ bonusPerfectGroupEnabled: e.target.checked })}
                    style={{ width: "18px", height: "18px" }}
                  />
                  <span style={{ fontSize: "1.25rem" }}>🎯</span>
                  <span style={{ fontSize: "0.9rem", color: "#333" }}>
                    {tp("phaseConfig.bonusPerfectGroup")}
                  </span>
                </label>
                {bonusPerfectGroupEnabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="number"
                      value={bonusPerfectGroup}
                      onChange={(e) => onConfigChange({ bonusPerfectGroup: Number(e.target.value) })}
                      min={0}
                      max={100}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: "0.85rem", color: "#666" }}>{tp("points")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ejemplo dinámico */}
            <div style={{ padding: "0.75rem", background: "#e8f4ff", borderRadius: "6px", fontSize: "0.8rem", color: "#555" }}>
              <strong>{tp("phaseConfig.exampleLabel")}</strong> {tp("phaseConfig.exampleGroup", {
                p1: pointsPosition1,
                p2: pointsPosition2,
                p3: pointsPosition3,
                p4: pointsPosition4,
                total: pointsPosition1 + pointsPosition2 + pointsPosition3 + pointsPosition4,
              })}
              {bonusPerfectGroupEnabled && (
                <>{tp.rich("phaseConfig.exampleGroupBonus", {
                  bonus: bonusPerfectGroup,
                  grandTotal: examplePerfect,
                  b: (chunks) => <b>{chunks}</b>,
                })}</>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🏆</span>
              <strong style={{ fontSize: "1.125rem" }}>{tp("phaseConfig.predictWhoAdvances")}</strong>
            </div>
            <p style={{ margin: "0 0 1.25rem 0", color: "#666", fontSize: "0.875rem" }}>
              {tp("phaseConfig.predictWhoAdvancesDesc")}
            </p>
            <div style={labelStyle}>
              <span style={{ fontSize: "1.25rem" }}>✅</span>
              <input
                type="number"
                value={config.pointsPerCorrectAdvance ?? 15}
                onChange={(e) => onConfigChange({ pointsPerCorrectAdvance: Number(e.target.value) })}
                min={0}
                max={100}
                style={{ ...inputStyle, width: "70px" }}
              />
              <span style={{ fontSize: "0.9rem", color: "#333" }}>
                <strong>{tp("points")}</strong> {tp("phaseConfig.ptsPerCorrectAdvance")}
              </span>
            </div>
            <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#e8f4ff", borderRadius: "6px", fontSize: "0.8rem", color: "#555" }}>
              <strong>{tp("phaseConfig.exampleLabel")}</strong> {tp("phaseConfig.exampleAdvance", { points: (config.pointsPerCorrectAdvance ?? 15) * 10 })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type PickTypeCardProps = {
  type: MatchPickType;
  title: string;
  description: string;
  example: string;
  onToggle: (enabled: boolean) => void;
  onPointsChange: (points: number) => void;
  isMobile?: boolean;
};

function PickTypeCard({
  type,
  title,
  description,
  example,
  onToggle,
  onPointsChange,
  isMobile = false,
}: PickTypeCardProps) {
  const tp = useTranslations("pool");
  const [showExample, setShowExample] = useState(false);

  if (isMobile) {
    // Compact mobile layout - horizontal with minimal height
    return (
      <div
        style={{
          border: type.enabled ? "2px solid #007bff" : "1px solid #ddd",
          borderRadius: "6px",
          padding: "0.75rem",
          background: type.enabled ? "#f0f8ff" : "white",
        }}
      >
        {/* Main row: checkbox + title + points */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={type.enabled}
              onChange={(e) => onToggle(e.target.checked)}
              style={{ width: "16px", height: "16px", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: "0.9rem", display: "block" }}>{title}</strong>
              <span style={{ fontSize: "0.75rem", color: "#666" }}>{description}</span>
            </div>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
            <input
              type="number"
              value={type.points}
              onChange={(e) => onPointsChange(Number(e.target.value))}
              disabled={!type.enabled}
              min={0}
              max={1000}
              style={{
                width: "50px",
                padding: "0.35rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "0.85rem",
                textAlign: "center",
                background: type.enabled ? "white" : "#f5f5f5",
              }}
            />
            <span style={{ fontSize: "0.7rem", color: "#666" }}>{tp("points")}</span>
          </div>
        </div>

        {/* Expandable example (optional) */}
        {type.enabled && (
          <button
            type="button"
            onClick={() => setShowExample(!showExample)}
            style={{
              marginTop: "0.5rem",
              background: "none",
              border: "none",
              color: "#007bff",
              fontSize: "0.7rem",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {showExample ? `▲ ${tp("phaseConfig.hideExample")}` : `▼ ${tp("phaseConfig.showExample")}`}
          </button>
        )}
        {type.enabled && showExample && (
          <div
            style={{
              marginTop: "0.5rem",
              background: "#f9f9f9",
              border: "1px solid #eee",
              borderRadius: "4px",
              padding: "0.5rem",
              fontSize: "0.7rem",
              color: "#666",
            }}
          >
            {example}
          </div>
        )}
      </div>
    );
  }

  // Desktop layout (original)
  return (
    <div
      style={{
        border: type.enabled ? "2px solid #007bff" : "1px solid #ddd",
        borderRadius: "8px",
        padding: "1.5rem",
        background: type.enabled ? "#f0f8ff" : "white",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={type.enabled}
                onChange={(e) => onToggle(e.target.checked)}
                style={{ width: "18px", height: "18px" }}
              />
              <strong style={{ fontSize: "1.125rem" }}>{title}</strong>
            </label>
          </div>

          <p style={{ margin: "0 0 0.75rem 0", color: "#666", fontSize: "0.875rem" }}>
            💡 {description}
          </p>

          <div
            style={{
              background: "#f9f9f9",
              border: "1px solid #eee",
              borderRadius: "4px",
              padding: "0.75rem",
              fontSize: "0.75rem",
              color: "#666",
            }}
          >
            <strong>{tp("phaseConfig.exampleLabel")}</strong> {example}
          </div>
        </div>

        <div style={{ marginLeft: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.75rem", color: "#666" }}>
            {tp("phaseConfig.pointsLabel")}
          </label>
          <input
            type="number"
            value={type.points}
            onChange={(e) => onPointsChange(Number(e.target.value))}
            disabled={!type.enabled}
            min={0}
            max={1000}
            style={{
              width: "80px",
              padding: "0.5rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "1rem",
              textAlign: "center",
              background: type.enabled ? "white" : "#f5f5f5",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ==================== HELPERS ====================

function getDefaultMatchPickTypes(): MatchPickType[] {
  return [
    { key: "EXACT_SCORE", enabled: true, points: 20 },
    { key: "GOAL_DIFFERENCE", enabled: false, points: 10 },
    { key: "PARTIAL_SCORE", enabled: false, points: 8 },
    { key: "TOTAL_GOALS", enabled: false, points: 5 },
    { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
  ];
}
