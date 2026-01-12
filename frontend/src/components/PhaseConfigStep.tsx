// Paso 2: Configuración por Fase
// Sprint 2 - Advanced Pick Types System

import { useState } from "react";
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
};

export function PhaseConfigStep({
  phases,
  phaseTypes,
  onPhasesChange,
  onNext,
}: PhaseConfigStepProps) {
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
            pointsPerExactPosition: 10,
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
    <div style={{ display: "grid", gap: "2rem" }}>
      {/* Phase Progress */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <span style={{ fontWeight: "bold", fontSize: "1.125rem" }}>
            {currentPhase.phaseName}
          </span>
          <span style={{ color: "#666", fontSize: "0.875rem" }}>
            Fase {currentPhaseIndex + 1} de {phases.length}
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
        <h3 style={{ margin: "0 0 1rem 0" }}>Decisión Fundamental</h3>
        <p style={{ color: "#666", fontSize: "0.875rem", margin: "0 0 1rem 0" }}>
          ¿Los jugadores deben predecir marcadores de partidos?
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <DecisionCard
            title="⚽ SÍ, CON MARCADORES"
            selected={currentPhase.requiresScore === true}
            onClick={() => handleRequiresScoreChange(true)}
          >
            <p>Los jugadores predicen el resultado exacto de cada partido.</p>
            <ul style={{ paddingLeft: "1.25rem", margin: "0.5rem 0 0 0" }}>
              <li>Más detalle</li>
              <li>Múltiples tipos</li>
              <li>Más trabajo para HOST</li>
            </ul>
          </DecisionCard>

          <DecisionCard
            title="📊 NO, SIN MARCADORES"
            selected={currentPhase.requiresScore === false}
            onClick={() => handleRequiresScoreChange(false)}
          >
            <p>Los jugadores predicen posiciones finales o quién avanza.</p>
            <ul style={{ paddingLeft: "1.25rem", margin: "0.5rem 0 0 0" }}>
              <li>Más estratégico</li>
              <li>Menos mantenimiento</li>
              <li>Menos variedad</li>
            </ul>
          </DecisionCard>
        </div>
      </div>

      {/* Configuration based on requiresScore */}
      {currentPhase.requiresScore && currentPhase.matchPicks && (
        <MatchPicksConfiguration
          matchPicks={currentPhase.matchPicks}
          onTypeChange={handleMatchPickTypeChange}
        />
      )}

      {!currentPhase.requiresScore && currentPhase.structuralPicks && (
        <StructuralPicksConfiguration
          structuralPicks={currentPhase.structuralPicks}
          phaseType={currentPhaseType}
        />
      )}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "1rem" }}>
        <button
          onClick={handlePrevious}
          disabled={currentPhaseIndex === 0}
          style={{
            padding: "0.75rem 1.5rem",
            background: currentPhaseIndex === 0 ? "#eee" : "white",
            border: "1px solid #ccc",
            borderRadius: "6px",
            cursor: currentPhaseIndex === 0 ? "not-allowed" : "pointer",
          }}
        >
          ← Fase Anterior
        </button>

        <button
          onClick={handleNext}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#007bff",
            border: "none",
            borderRadius: "6px",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {currentPhaseIndex < phases.length - 1
            ? "Siguiente Fase →"
            : "Ver Resumen →"}
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
};

function DecisionCard({ title, selected, onClick, children }: DecisionCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        border: selected ? "2px solid #007bff" : "1px solid #ddd",
        borderRadius: "8px",
        padding: "1.5rem",
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
      <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem" }}>{title}</h4>
      <div style={{ fontSize: "0.875rem", color: "#666" }}>{children}</div>
    </div>
  );
}

type MatchPicksConfigurationProps = {
  matchPicks: { types: MatchPickType[] };
  onTypeChange: (typeKey: MatchPickTypeKey, enabled: boolean, points?: number) => void;
};

function MatchPicksConfiguration({
  matchPicks,
  onTypeChange,
}: MatchPicksConfigurationProps) {
  const pickTypeDescriptions: Record<MatchPickTypeKey, { title: string; description: string; example: string }> = {
    EXACT_SCORE: {
      title: "Marcador Exacto",
      description: "El jugador debe acertar el marcador completo. Es el pick más difícil y el más valioso. Si aciertas el marcador exacto, también aciertas automáticamente la diferencia de goles, marcador parcial y goles totales (pero solo ganas los puntos del marcador exacto, que es el más alto).",
      example: "Ejemplo con 20 pts: Predices 2-1, sale 2-1 → GANAS 20 PTS | Sale 3-1 → 0 pts | Sale 2-0 → 0 pts",
    },
    GOAL_DIFFERENCE: {
      title: "Diferencia de Goles",
      description: "Acierta la diferencia exacta entre los goles del local y visitante, aunque el marcador no sea exacto. Solo ganas estos puntos si NO acertaste el marcador exacto.",
      example: "Ejemplo con 10 pts: Predices 2-0 (+2), sale 3-1 (+2) → GANAS 10 PTS | Sale 2-1 (+1) → 0 pts | Sale 2-0 → GANAS 20 PTS del exacto",
    },
    PARTIAL_SCORE: {
      title: "Marcador Parcial",
      description: "Acierta SOLO los goles de UN equipo (local O visitante), pero NO ambos a la vez. Si aciertas ambos, eso cuenta como marcador exacto (que vale más puntos). Este tipo es útil cuando aciertas parcialmente.",
      example: "Ejemplo con 8 pts: Predices 2-1, sale 2-3 → GANAS 8 PTS (los 2 del local) | Sale 3-3 → 0 pts | Sale 2-1 → GANAS 20 PTS del exacto",
    },
    TOTAL_GOALS: {
      title: "Goles Totales",
      description: "Acierta el número total de goles del partido (local + visitante), sin importar quién los marcó ni el resultado final. Solo ganas estos puntos si NO acertaste marcador exacto, diferencia de goles, ni marcador parcial.",
      example: "Ejemplo con 5 pts: Predices 2-1 (3 goles), sale 3-0 (3 goles) → GANAS 5 PTS | Sale 2-0 (2 goles) → 0 pts | Sale 2-1 → GANAS 20 PTS del exacto",
    },
    MATCH_OUTCOME_90MIN: {
      title: "Resultado en 90min",
      description: "Predice solo el ganador o empate en tiempo reglamentario (Victoria Local, Empate, Victoria Visitante). No disponible cuando se requieren marcadores.",
      example: "Solo para picks sin marcador. No combinable con predicciones de goles.",
    },
  };

  return (
    <div>
      <h3 style={{ margin: "0 0 1rem 0" }}>Tipos de Picks Activos</h3>
      <p style={{ color: "#666", fontSize: "0.875rem", margin: "0 0 1.5rem 0" }}>
        Activa los tipos de picks que quieres permitir. Puedes tener varios activos simultáneamente.
      </p>

      <div style={{ display: "grid", gap: "1rem" }}>
        {matchPicks.types
          .filter((t) => t.key !== "MATCH_OUTCOME_90MIN") // No mostrar en modo con marcadores
          .map((type) => {
            const info = pickTypeDescriptions[type.key];
            return (
              <PickTypeCard
                key={type.key}
                type={type}
                title={info.title}
                description={info.description}
                example={info.example}
                onToggle={(enabled) => onTypeChange(type.key, enabled)}
                onPointsChange={(points) => onTypeChange(type.key, type.enabled, points)}
              />
            );
          })}
      </div>
    </div>
  );
}

type StructuralPicksConfigurationProps = {
  structuralPicks: any;
  phaseType: string;
};

function StructuralPicksConfiguration({ structuralPicks, phaseType }: StructuralPicksConfigurationProps) {
  const isGroupPhase = phaseType === "GROUP";

  return (
    <div>
      <h3 style={{ margin: "0 0 1rem 0" }}>Configuración Sin Marcadores</h3>

      <div
        style={{
          border: "2px solid #007bff",
          borderRadius: "8px",
          padding: "1.5rem",
          background: "#f0f8ff",
        }}
      >
        {isGroupPhase ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>📊</span>
              <strong style={{ fontSize: "1.125rem" }}>Ordenar Posiciones de Grupo</strong>
            </div>
            <p style={{ margin: "0 0 1rem 0", color: "#666", fontSize: "0.875rem" }}>
              Los jugadores ordenan los equipos del 1° al 4° lugar en cada grupo.
              No predicen marcadores de partidos individuales.
            </p>
            <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.875rem" }}>
              <div>
                ✅ <strong>{structuralPicks?.config?.pointsPerExactPosition || 10} pts</strong> por cada equipo en su posición exacta
              </div>
              {structuralPicks?.config?.bonusPerfectGroup && (
                <div>
                  🎯 <strong>+{structuralPicks.config.bonusPerfectGroup} pts</strong> de bonus por acertar un grupo completo
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🏆</span>
              <strong style={{ fontSize: "1.125rem" }}>Predecir Quién Avanza</strong>
            </div>
            <p style={{ margin: "0 0 1rem 0", color: "#666", fontSize: "0.875rem" }}>
              Los jugadores seleccionan qué equipo avanza a la siguiente ronda en cada partido.
              No importa el marcador ni cómo avancen (tiempo regular, prórroga o penales).
            </p>
            <div style={{ fontSize: "0.875rem" }}>
              ✅ <strong>{structuralPicks?.config?.pointsPerCorrectAdvance || 15} pts</strong> por cada equipo que aciertes que avanza
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
};

function PickTypeCard({
  type,
  title,
  description,
  example,
  onToggle,
  onPointsChange,
}: PickTypeCardProps) {
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
            <strong>Ejemplo:</strong> {example}
          </div>
        </div>

        <div style={{ marginLeft: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.75rem", color: "#666" }}>
            Puntos
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
