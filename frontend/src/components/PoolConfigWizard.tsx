// Wizard para configuración de tipos de picks
// Sprint 2 - Advanced Pick Types System

import { useState, useEffect } from "react";
import { PhaseConfigStep } from "./PhaseConfigStep";
import { getInstancePhases, type InstancePhase } from "../lib/api";
import type {
  WizardState,
  WizardStep,
  PoolPickTypesConfig,
  PickConfigPresetKey,
  PhasePickConfig,
} from "../types/pickConfig";

type PoolConfigWizardProps = {
  instanceId: string;
  token: string;
  onComplete: (config: PoolPickTypesConfig | PickConfigPresetKey) => void;
  onCancel: () => void;
};

export function PoolConfigWizard({ instanceId, token, onComplete, onCancel }: PoolConfigWizardProps) {
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: "PRESET_SELECTION",
    selectedPreset: null,
    configuration: [],
    currentPhaseIndex: 0,
  });
  const [instancePhases, setInstancePhases] = useState<InstancePhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar fases de la instancia al montar el componente
  useEffect(() => {
    async function loadPhases() {
      try {
        setLoading(true);
        const data = await getInstancePhases(token, instanceId);
        setInstancePhases(data.phases);
      } catch (err: any) {
        setError(err?.message || "Error al cargar fases del torneo");
      } finally {
        setLoading(false);
      }
    }
    loadPhases();
  }, [instanceId, token]);

  function handlePresetSelected(preset: PickConfigPresetKey) {
    if (preset === "CUSTOM") {
      // Si elige personalizado, ir a configuración por fase
      // Generar configuración default basada en las fases dinámicas de la instancia
      const defaultPhases: PhasePickConfig[] = instancePhases.map((phase) => ({
        phaseId: phase.id,
        phaseName: phase.name,
        requiresScore: true,
        matchPicks: {
          types: [
            { key: "EXACT_SCORE", enabled: true, points: 20 },
            { key: "GOAL_DIFFERENCE", enabled: false, points: 10 },
            { key: "PARTIAL_SCORE", enabled: false, points: 8 },
            { key: "TOTAL_GOALS", enabled: false, points: 5 },
            { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
          ],
        },
      }));

      setWizardState({
        ...wizardState,
        currentStep: "PHASE_CONFIG",
        selectedPreset: preset,
        configuration: defaultPhases,
      });
    } else {
      // Si elige preset, ir directamente a resumen
      setWizardState({
        ...wizardState,
        currentStep: "SUMMARY",
        selectedPreset: preset,
      });
    }
  }

  function handleBack() {
    if (wizardState.currentStep === "PHASE_CONFIG") {
      setWizardState({
        ...wizardState,
        currentStep: "PRESET_SELECTION",
      });
    } else if (wizardState.currentStep === "SUMMARY") {
      if (wizardState.selectedPreset === "CUSTOM") {
        setWizardState({
          ...wizardState,
          currentStep: "PHASE_CONFIG",
        });
      } else {
        setWizardState({
          ...wizardState,
          currentStep: "PRESET_SELECTION",
        });
      }
    }
  }

  function handleComplete() {
    if (wizardState.selectedPreset === "CUSTOM") {
      onComplete(wizardState.configuration);
    } else {
      onComplete(wizardState.selectedPreset!);
    }
  }

  // Generar configuración de preset basada en las fases dinámicas
  function getPresetConfig(presetKey: PickConfigPresetKey): PhasePickConfig[] {
    // Configuraciones básicas usando las fases reales de la instancia
    if (presetKey === "BASIC") {
      // Solo marcador exacto, puntos crecientes por fase
      return instancePhases.map((phase, index) => ({
        phaseId: phase.id,
        phaseName: phase.name,
        requiresScore: true,
        matchPicks: {
          types: [{ key: "EXACT_SCORE", enabled: true, points: 20 + index * 10 }],
        },
      }));
    } else if (presetKey === "ADVANCED") {
      // Múltiples tipos de pick en fase de grupos, menos en eliminatorias
      return instancePhases.map((phase, index) => {
        const basePoints = 20 + index * 10;
        const types: any[] = [
          { key: "EXACT_SCORE", enabled: true, points: basePoints },
          { key: "GOAL_DIFFERENCE", enabled: true, points: Math.floor(basePoints * 0.5) },
        ];

        // En fase de grupos: 4 tipos de pick (más opciones para acertar)
        // En eliminatorias: solo 2 tipos (más difícil)
        if (phase.type === "GROUP") {
          types.push(
            { key: "PARTIAL_SCORE", enabled: true, points: Math.floor(basePoints * 0.4) },
            { key: "TOTAL_GOALS", enabled: true, points: Math.floor(basePoints * 0.25) }
          );
        }

        return {
          phaseId: phase.id,
          phaseName: phase.name,
          requiresScore: true,
          matchPicks: { types },
        };
      });
    } else if (presetKey === "SIMPLE") {
      // Sin marcadores, picks estructurales
      return instancePhases.map((phase) => ({
        phaseId: phase.id,
        phaseName: phase.name,
        requiresScore: false,
        structuralPicks: {
          type: phase.type === "GROUP" ? "GROUP_STANDINGS" : "KNOCKOUT_WINNER",
          config:
            phase.type === "GROUP"
              ? {
                  // Nuevo formato: puntos por posición
                  pointsPosition1: 10,
                  pointsPosition2: 10,
                  pointsPosition3: 10,
                  pointsPosition4: 10,
                  bonusPerfectGroupEnabled: true,
                  bonusPerfectGroup: 20,
                }
              : {
                  pointsPerCorrectAdvance: 15,
                },
        },
      }));
    }

    return [];
  }

  // Mostrar loading mientras se cargan las fases
  if (loading) {
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
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 8 }}>⏳ Cargando configuración...</div>
          <div style={{ fontSize: 14, color: "#666" }}>Obteniendo fases del torneo</div>
        </div>
      </div>
    );
  }

  // Mostrar error si hubo un problema al cargar
  if (error) {
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
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
            maxWidth: "400px",
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 8, color: "#dc3545" }}>❌ Error</div>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>{error}</div>
          <button
            onClick={onCancel}
            style={{
              padding: "0.5rem 1rem",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
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
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          maxWidth: "800px",
          width: "90%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header - Fixed at top */}
        <div
          style={{
            padding: "1.5rem 2rem",
            borderBottom: "1px solid #eee",
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.5rem" }}>
            Configura las Reglas de Puntuación
          </h2>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666", fontSize: "0.875rem" }}>
            {wizardState.currentStep === "PRESET_SELECTION" && "Paso 1 de 2: Elige un preset"}
            {wizardState.currentStep === "PHASE_CONFIG" && "Paso 2 de 2: Configura cada fase"}
            {wizardState.currentStep === "SUMMARY" && "Resumen de configuración"}
          </p>
        </div>

        {/* Body - Scrollable */}
        <div style={{ padding: wizardState.currentStep === "PHASE_CONFIG" ? "0 2rem 2rem 2rem" : "2rem", overflow: "auto", flex: 1 }}>
          {wizardState.currentStep === "PRESET_SELECTION" && (
            <PresetSelectionStep onSelect={handlePresetSelected} />
          )}

          {wizardState.currentStep === "PHASE_CONFIG" && (
            <PhaseConfigStep
              phases={wizardState.configuration}
              phaseTypes={new Map(instancePhases.map((p) => [p.id, p.type]))}
              onPhasesChange={(phases) =>
                setWizardState({ ...wizardState, configuration: phases })
              }
              onNext={() =>
                setWizardState({ ...wizardState, currentStep: "SUMMARY" })
              }
            />
          )}

          {wizardState.currentStep === "SUMMARY" && (
            <SummaryStep
              wizardState={wizardState}
              onComplete={handleComplete}
              getPresetConfig={getPresetConfig}
            />
          )}
        </div>

        {/* Footer - Fixed at bottom */}
        <div
          style={{
            padding: "1.5rem 2rem",
            borderTop: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "0.75rem 1.5rem",
              background: "white",
              border: "1px solid #ccc",
              borderRadius: "6px",
              cursor: "pointer",
              color: "#333",
            }}
          >
            Cancelar
          </button>

          <div style={{ display: "flex", gap: "1rem" }}>
            {wizardState.currentStep !== "PRESET_SELECTION" && (
              <button
                onClick={handleBack}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "white",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "#333",
                }}
              >
                Atrás
              </button>
            )}

            {wizardState.currentStep === "SUMMARY" && (
              <button
                onClick={handleComplete}
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
                Confirmar y Crear Pool
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== STEP COMPONENTS ====================

type PresetSelectionStepProps = {
  onSelect: (preset: PickConfigPresetKey) => void;
};

function PresetSelectionStep({ onSelect }: PresetSelectionStepProps) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <p style={{ fontSize: "1rem", color: "#333", margin: 0 }}>
        Para empezar más rápido, elige un preset o personaliza completamente:
      </p>

      {/* Preset Cards */}
      <div style={{ display: "grid", gap: "1rem" }}>
        <PresetCard
          title="🎯 BÁSICO"
          description="Solo marcador exacto en todos los partidos. Los puntos aumentan automáticamente en rondas eliminatorias (grupos: 20 pts, octavos: 30 pts, final: 60 pts)."
          recommended
          onSelect={() => onSelect("BASIC")}
        />

        <PresetCard
          title="⚡ AVANZADO"
          description="Múltiples formas de ganar puntos: marcador exacto (20 pts), diferencia de goles (10 pts), marcador parcial (8 pts) y goles totales (5 pts) en fase de grupos. En eliminatorias solo exacto y diferencia con auto-scaling."
          onSelect={() => onSelect("ADVANCED")}
        />

        <PresetCard
          title="🎲 SIMPLE"
          description="Sin marcadores de partidos. En fase de grupos ordenas los equipos de cada grupo (10 pts por posición correcta, +20 pts si el grupo completo es perfecto). En eliminatorias solo eliges quién avanza."
          onSelect={() => onSelect("SIMPLE")}
        />

        <PresetCard
          title="🛠️ PERSONALIZADO"
          description="Configura cada fase manualmente según tus necesidades específicas. Elige si quieres marcadores o no, qué tipos de picks activar y cuántos puntos asignar a cada uno."
          onSelect={() => onSelect("CUSTOM")}
        />
      </div>
    </div>
  );
}

type PresetCardProps = {
  title: string;
  description: string;
  recommended?: boolean;
  onSelect: () => void;
};

function PresetCard({ title, description, recommended, onSelect }: PresetCardProps) {
  return (
    <div
      style={{
        border: recommended ? "2px solid #007bff" : "1px solid #ddd",
        borderRadius: "8px",
        padding: "1.5rem",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#007bff";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,123,255,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = recommended ? "#007bff" : "#ddd";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {recommended && (
        <div
          style={{
            position: "absolute",
            top: "-10px",
            right: "1rem",
            background: "#007bff",
            color: "white",
            padding: "0.25rem 0.75rem",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "bold",
          }}
        >
          Recomendado
        </div>
      )}

      <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1.25rem" }}>{title}</h3>
      <p style={{ margin: 0, color: "#666", fontSize: "0.875rem", lineHeight: "1.5" }}>
        {description}
      </p>
    </div>
  );
}


type SummaryStepProps = {
  wizardState: WizardState;
  onComplete: () => void;
  getPresetConfig: (presetKey: PickConfigPresetKey) => PhasePickConfig[];
};

function SummaryStep({ wizardState, onComplete, getPresetConfig }: SummaryStepProps) {
  const presetNames: Record<PickConfigPresetKey, string> = {
    BASIC: "Básico",
    ADVANCED: "Avanzado",
    SIMPLE: "Simple",
    CUSTOM: "Personalizado",
  };

  const isPreset = wizardState.selectedPreset && wizardState.selectedPreset !== "CUSTOM";

  return (
    <div style={{ display: "grid", gap: "2rem" }}>
      {/* Header */}
      <div>
        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem" }}>
          ✅ Resumen de Configuración
        </h3>
        <p style={{ margin: 0, color: "#666", fontSize: "0.875rem" }}>
          {isPreset
            ? `Usarás el preset "${presetNames[wizardState.selectedPreset!]}" con configuración predefinida.`
            : "Revisa tu configuración personalizada antes de crear la pool."}
        </p>
      </div>

      {/* Configuración */}
      {isPreset ? (
        <PresetSummary presetKey={wizardState.selectedPreset!} />
      ) : (
        <CustomConfigSummary configuration={wizardState.configuration} />
      )}

      {/* Vista Previa para Jugadores */}
      <div>
        <h4 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem" }}>
          📋 Cómo se verá en "Reglas de la Pool"
        </h4>
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "1.5rem",
            background: "#f9f9f9",
          }}
        >
          <RulesPreview
            configuration={
              isPreset ? getPresetConfig(wizardState.selectedPreset!) : wizardState.configuration
            }
          />
        </div>
      </div>

      {/* Confirmación */}
      <div
        style={{
          background: "#f0f8ff",
          border: "1px solid #b3d9ff",
          borderRadius: "8px",
          padding: "1.5rem",
        }}
      >
        <p style={{ margin: "0 0 0.5rem 0", fontWeight: "bold", color: "#0066cc" }}>
          ℹ️ Importante
        </p>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#333" }}>
          Esta configuración se aplicará a toda la pool. Los jugadores verán estas reglas
          antes de unirse y podrán decidir si participar.
        </p>
      </div>
    </div>
  );
}

// ==================== SUMMARY COMPONENTS ====================

type PresetSummaryProps = {
  presetKey: PickConfigPresetKey;
};

function PresetSummary({ presetKey }: PresetSummaryProps) {
  const presetDescriptions: Record<string, string> = {
    BASIC:
      "Solo marcador exacto en todos los partidos con auto-scaling (20 pts en grupos → 60 pts en final).",
    ADVANCED:
      "Múltiples tipos de picks: marcador exacto (20 pts), diferencia (10 pts), parcial (8 pts) y totales (5 pts) en grupos. En eliminatorias: exacto y diferencia con auto-scaling.",
    SIMPLE:
      "Sin marcadores. En grupos: ordena equipos (10 pts por posición + 20 pts bonus grupo perfecto). En eliminatorias: elige quién avanza.",
  };

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "1.5rem",
        background: "white",
      }}
    >
      <div style={{ marginBottom: "1rem" }}>
        <span
          style={{
            display: "inline-block",
            background: "#007bff",
            color: "white",
            padding: "0.25rem 0.75rem",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "bold",
          }}
        >
          PRESET {presetKey}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>
        {presetDescriptions[presetKey]}
      </p>
    </div>
  );
}

type CustomConfigSummaryProps = {
  configuration: PhasePickConfig[];
};

function CustomConfigSummary({ configuration }: CustomConfigSummaryProps) {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {configuration.map((phase, index) => (
        <div
          key={phase.phaseId}
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "1.5rem",
            background: "white",
          }}
        >
          <h4 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>
            {index + 1}. {phase.phaseName}
          </h4>

          {phase.requiresScore && phase.matchPicks ? (
            <div>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", color: "#666" }}>
                <strong>Tipo:</strong> Con marcadores
              </p>
              <div style={{ display: "grid", gap: "0.25rem", fontSize: "0.875rem" }}>
                {phase.matchPicks.types
                  .filter((t) => t.enabled)
                  .map((type) => (
                    <div key={type.key} style={{ color: "#333" }}>
                      • {getPickTypeName(type.key)}: <strong>{type.points} pts</strong>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>
              <strong>Tipo:</strong> Sin marcadores (estructural)
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

type RulesPreviewProps = {
  configuration: PhasePickConfig[];
};

function RulesPreview({ configuration }: RulesPreviewProps) {
  return (
    <div>
      <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem" }}>
        📜 REGLAS DE PUNTUACIÓN
      </h3>

      {configuration.map((phase) => (
        <div
          key={phase.phaseId}
          style={{
            marginBottom: "1.5rem",
            paddingBottom: "1.5rem",
            borderBottom: "1px solid #ddd",
          }}
        >
          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem" }}>
            🏆 {phase.phaseName.toUpperCase()}
          </h4>

          {phase.requiresScore && phase.matchPicks ? (
            <>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", color: "#666" }}>
                <strong>Tipo de predicción:</strong> Marcadores de partidos
              </p>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem" }}>
                <strong>Cómo ganar puntos:</strong>
              </p>
              <ul style={{ margin: "0 0 0.5rem 0", paddingLeft: "1.5rem", fontSize: "0.875rem" }}>
                {phase.matchPicks.types
                  .filter((t) => t.enabled)
                  .map((type) => (
                    <li key={type.key}>
                      {type.points} pts - {getPickTypeName(type.key)} {getPickTypeExample(type.key)}
                    </li>
                  ))}
              </ul>
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.75rem", color: "#999" }}>
                ⏰ Deadline: 10 minutos antes del inicio de cada partido
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>
              Predicción de posiciones finales o avances (sin marcadores)
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ==================== HELPER FUNCTIONS ====================

function getPickTypeName(key: string): string {
  const names: Record<string, string> = {
    EXACT_SCORE: "Marcador exacto",
    GOAL_DIFFERENCE: "Diferencia de goles",
    PARTIAL_SCORE: "Marcador parcial",
    TOTAL_GOALS: "Goles totales",
    MATCH_OUTCOME_90MIN: "Resultado en 90min",
  };
  return names[key] || key;
}

function getPickTypeExample(key: string): string {
  const examples: Record<string, string> = {
    EXACT_SCORE: "Si vale 20 pts: Predices 2-1, sale 2-1 → GANAS 20 PTS | Sale 3-1 → 0 pts (no acertaste exacto)",
    GOAL_DIFFERENCE: "Si vale 10 pts: Predices 2-0 (+2), sale 3-1 (+2) → GANAS 10 PTS | Sale 2-1 (+1) → 0 pts",
    PARTIAL_SCORE: "Si vale 8 pts: Predices 2-1, sale 2-3 → GANAS 8 PTS (acertaste los 2 del local) | Sale 3-3 → 0 pts",
    TOTAL_GOALS: "Si vale 5 pts: Predices 2-1 (3 goles), sale 3-0 (3 goles) → GANAS 5 PTS | Sale 2-0 (2 goles) → 0 pts",
    MATCH_OUTCOME_90MIN: "Solo sin marcadores: Victoria Local, Empate, o Victoria Visitante",
  };
  return examples[key] || "";
}
