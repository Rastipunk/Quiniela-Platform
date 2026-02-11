// Wizard para configuración de tipos de picks
// Sprint 2 - Advanced Pick Types System
// Sprint 3 - Mobile UX Improvements

import { useState, useEffect } from "react";
import { PhaseConfigStep } from "./PhaseConfigStep";
import { getInstancePhases, type InstancePhase } from "../lib/api";
import { useIsMobile } from "../hooks/useIsMobile";
import type {
  WizardState,
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
  const isMobile = useIsMobile();
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
      // Always send the full config with real instance phaseIds
      // (not just the preset key, which would resolve to hardcoded phaseIds on the backend)
      onComplete(getPresetConfig(wizardState.selectedPreset!));
    }
  }

  // Generar configuración de preset basada en las fases dinámicas
  function getPresetConfig(presetKey: PickConfigPresetKey): PhasePickConfig[] {
    // Configuraciones básicas usando las fases reales de la instancia
    if (presetKey === "CUMULATIVE") {
      // Sistema acumulativo: los puntos se suman por cada criterio
      return instancePhases.map((phase) => {
        const isKnockout = phase.type !== "GROUP";
        return {
          phaseId: phase.id,
          phaseName: phase.name,
          requiresScore: true,
          matchPicks: {
            types: [
              { key: "EXACT_SCORE", enabled: false, points: 0 },
              { key: "GOAL_DIFFERENCE", enabled: true, points: isKnockout ? 2 : 1 },
              { key: "PARTIAL_SCORE", enabled: false, points: 0 },
              { key: "TOTAL_GOALS", enabled: false, points: 0 },
              { key: "MATCH_OUTCOME_90MIN", enabled: true, points: isKnockout ? 10 : 5 },
              { key: "HOME_GOALS", enabled: true, points: isKnockout ? 4 : 2 },
              { key: "AWAY_GOALS", enabled: true, points: isKnockout ? 4 : 2 },
            ],
          },
        };
      });
    } else if (presetKey === "BASIC") {
      // Solo marcador exacto, puntos crecientes por fase
      return instancePhases.map((phase, index) => ({
        phaseId: phase.id,
        phaseName: phase.name,
        requiresScore: true,
        matchPicks: {
          types: [{ key: "EXACT_SCORE", enabled: true, points: 20 + index * 10 }],
        },
      }));
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
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: isMobile ? "16px 16px 0 0" : "12px",
          maxWidth: isMobile ? "100%" : "800px",
          width: isMobile ? "100%" : "90%",
          maxHeight: isMobile ? "95vh" : "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header - Fixed at top */}
        <div
          style={{
            padding: isMobile ? "1rem 1rem" : "1.5rem 2rem",
            borderBottom: "1px solid #eee",
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: isMobile ? "1.2rem" : "1.5rem" }}>
            Configura las Reglas de Puntuación
          </h2>
          <p style={{ margin: "0.25rem 0 0 0", color: "#666", fontSize: isMobile ? "0.8rem" : "0.875rem" }}>
            {wizardState.currentStep === "PRESET_SELECTION" && "Paso 1 de 2: Elige un preset"}
            {wizardState.currentStep === "PHASE_CONFIG" && "Paso 2 de 2: Configura cada fase"}
            {wizardState.currentStep === "SUMMARY" && "Resumen de configuración"}
          </p>
        </div>

        {/* Body - Scrollable */}
        <div style={{
          padding: wizardState.currentStep === "PHASE_CONFIG"
            ? (isMobile ? "0 1rem 1rem 1rem" : "0 2rem 2rem 2rem")
            : (isMobile ? "1rem" : "2rem"),
          overflow: "auto",
          flex: 1
        }}>
          {wizardState.currentStep === "PRESET_SELECTION" && (
            <PresetSelectionStep onSelect={handlePresetSelected} isMobile={isMobile} />
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
              isMobile={isMobile}
            />
          )}

          {wizardState.currentStep === "SUMMARY" && (
            <SummaryStep
              wizardState={wizardState}
              onComplete={handleComplete}
              getPresetConfig={getPresetConfig}
              isMobile={isMobile}
            />
          )}
        </div>

        {/* Footer - Fixed at bottom */}
        <div
          style={{
            padding: isMobile ? "0.75rem 1rem" : "1.5rem 2rem",
            borderTop: "1px solid #eee",
            display: "flex",
            gap: isMobile ? "0.5rem" : "1rem",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              flex: isMobile ? 1 : "none",
              padding: isMobile ? "0.6rem 0.75rem" : "0.75rem 1.5rem",
              background: "white",
              border: "1px solid #ccc",
              borderRadius: "6px",
              cursor: "pointer",
              color: "#333",
              fontSize: isMobile ? "0.85rem" : "1rem",
              minHeight: isMobile ? "40px" : "auto",
            }}
          >
            Cancelar
          </button>

          {wizardState.currentStep !== "PRESET_SELECTION" && (
            <button
              onClick={handleBack}
              style={{
                flex: isMobile ? 1 : "none",
                padding: isMobile ? "0.6rem 0.75rem" : "0.75rem 1.5rem",
                background: "white",
                border: "1px solid #ccc",
                borderRadius: "6px",
                cursor: "pointer",
                color: "#333",
                fontSize: isMobile ? "0.85rem" : "1rem",
                minHeight: isMobile ? "40px" : "auto",
              }}
            >
              Atrás
            </button>
          )}

          {wizardState.currentStep === "SUMMARY" && (
            <button
              onClick={handleComplete}
              style={{
                flex: isMobile ? 1.5 : "none",
                padding: isMobile ? "0.6rem 0.75rem" : "0.75rem 1.5rem",
                background: "#007bff",
                border: "none",
                borderRadius: "6px",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: isMobile ? "0.85rem" : "1rem",
                minHeight: isMobile ? "40px" : "auto",
              }}
            >
              {isMobile ? "Crear Pool" : "Confirmar y Crear Pool"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== STEP COMPONENTS ====================

type PresetSelectionStepProps = {
  onSelect: (preset: PickConfigPresetKey) => void;
  isMobile?: boolean;
};

function PresetSelectionStep({ onSelect, isMobile }: PresetSelectionStepProps) {
  // Descripciones cortas para móvil
  const presets = [
    {
      key: "CUMULATIVE" as PickConfigPresetKey,
      title: "🏆 ACUMULATIVO",
      description: "Los puntos se SUMAN: Resultado (5/10 pts) + Goles local (2/4 pts) + Goles visitante (2/4 pts) + Diferencia (1/2 pts). Marcador exacto = 10 pts en grupos, 20 pts en eliminatorias.",
      shortDesc: "Puntos acumulables: resultado + goles + diferencia",
      recommended: true,
    },
    {
      key: "BASIC" as PickConfigPresetKey,
      title: "🎯 BÁSICO",
      description: "Solo marcador exacto en todos los partidos. Los puntos aumentan automáticamente en rondas eliminatorias (grupos: 20 pts, octavos: 30 pts, final: 60 pts).",
      shortDesc: "Solo marcador exacto con puntos crecientes",
    },
    {
      key: "SIMPLE" as PickConfigPresetKey,
      title: "🎲 SIMPLE",
      description: "Sin marcadores de partidos. En fase de grupos ordenas los equipos de cada grupo (10 pts por posición correcta, +20 pts si el grupo completo es perfecto). En eliminatorias solo eliges quién avanza.",
      shortDesc: "Sin marcadores: ordena grupos, elige quién avanza",
    },
    {
      key: "CUSTOM" as PickConfigPresetKey,
      title: "🛠️ PERSONALIZADO",
      description: "Configura cada fase manualmente según tus necesidades específicas. Elige si quieres marcadores o no, qué tipos de picks activar y cuántos puntos asignar a cada uno.",
      shortDesc: "Configura todo manualmente",
    },
  ];

  return (
    <div style={{ display: "grid", gap: isMobile ? "0.75rem" : "1.5rem" }}>
      <p style={{ fontSize: isMobile ? "0.85rem" : "1rem", color: "#333", margin: 0 }}>
        {isMobile ? "Elige un preset:" : "Para empezar más rápido, elige un preset o personaliza completamente:"}
      </p>

      {/* Preset Cards */}
      <div style={{ display: "grid", gap: isMobile ? "0.5rem" : "1rem" }}>
        {presets.map((preset) => (
          <PresetCard
            key={preset.key}
            title={preset.title}
            description={isMobile ? preset.shortDesc : preset.description}
            recommended={preset.recommended}
            onSelect={() => onSelect(preset.key)}
            isMobile={isMobile}
          />
        ))}
      </div>
    </div>
  );
}

type PresetCardProps = {
  title: string;
  description: string;
  recommended?: boolean;
  onSelect: () => void;
  isMobile?: boolean;
};

function PresetCard({ title, description, recommended, onSelect, isMobile }: PresetCardProps) {
  return (
    <div
      style={{
        border: recommended ? "2px solid #007bff" : "1px solid #ddd",
        borderRadius: "8px",
        padding: isMobile ? "0.75rem" : "1.5rem",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
        display: isMobile ? "flex" : "block",
        alignItems: isMobile ? "center" : undefined,
        gap: isMobile ? "0.75rem" : undefined,
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
            top: isMobile ? "-8px" : "-10px",
            right: isMobile ? "0.5rem" : "1rem",
            background: "#007bff",
            color: "white",
            padding: isMobile ? "0.15rem 0.5rem" : "0.25rem 0.75rem",
            borderRadius: "12px",
            fontSize: isMobile ? "0.65rem" : "0.75rem",
            fontWeight: "bold",
          }}
        >
          Recomendado
        </div>
      )}

      {isMobile ? (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: "bold", fontSize: "0.9rem", marginBottom: "0.15rem" }}>{title}</div>
            <div style={{ color: "#666", fontSize: "0.75rem", lineHeight: "1.3" }}>{description}</div>
          </div>
          <div style={{ color: "#007bff", fontSize: "1.2rem" }}>›</div>
        </>
      ) : (
        <>
          <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1.25rem" }}>{title}</h3>
          <p style={{ margin: 0, color: "#666", fontSize: "0.875rem", lineHeight: "1.5" }}>
            {description}
          </p>
        </>
      )}
    </div>
  );
}


type SummaryStepProps = {
  wizardState: WizardState;
  onComplete: () => void;
  getPresetConfig: (presetKey: PickConfigPresetKey) => PhasePickConfig[];
  isMobile?: boolean;
};

function SummaryStep({ wizardState, onComplete: _onComplete, getPresetConfig, isMobile }: SummaryStepProps) {
  void _onComplete; // Used by parent component
  const presetNames: Record<PickConfigPresetKey, string> = {
    CUMULATIVE: "Acumulativo",
    BASIC: "Básico",
    SIMPLE: "Simple",
    CUSTOM: "Personalizado",
  };

  const isPreset = wizardState.selectedPreset && wizardState.selectedPreset !== "CUSTOM";

  return (
    <div style={{ display: "grid", gap: isMobile ? "1rem" : "2rem" }}>
      {/* Header */}
      <div>
        <h3 style={{ margin: "0 0 0.25rem 0", fontSize: isMobile ? "1.1rem" : "1.5rem" }}>
          ✅ Resumen de Configuración
        </h3>
        <p style={{ margin: 0, color: "#666", fontSize: isMobile ? "0.8rem" : "0.875rem" }}>
          {isPreset
            ? `Usarás el preset "${presetNames[wizardState.selectedPreset!]}" con configuración predefinida.`
            : "Revisa tu configuración personalizada antes de crear la pool."}
        </p>
      </div>

      {/* Configuración */}
      {isPreset ? (
        <PresetSummary presetKey={wizardState.selectedPreset!} isMobile={isMobile} />
      ) : (
        <CustomConfigSummary configuration={wizardState.configuration} isMobile={isMobile} />
      )}

      {/* Vista Previa para Jugadores */}
      <div>
        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: isMobile ? "0.95rem" : "1.125rem" }}>
          📋 Cómo se verá en "Reglas de la Pool"
        </h4>
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: isMobile ? "0.75rem" : "1.5rem",
            background: "#f9f9f9",
          }}
        >
          <RulesPreview
            configuration={
              isPreset ? getPresetConfig(wizardState.selectedPreset!) : wizardState.configuration
            }
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* Confirmación */}
      <div
        style={{
          background: "#f0f8ff",
          border: "1px solid #b3d9ff",
          borderRadius: "8px",
          padding: isMobile ? "0.75rem" : "1.5rem",
        }}
      >
        <p style={{ margin: "0 0 0.25rem 0", fontWeight: "bold", color: "#0066cc", fontSize: isMobile ? "0.85rem" : "1rem" }}>
          ℹ️ Importante
        </p>
        <p style={{ margin: 0, fontSize: isMobile ? "0.75rem" : "0.875rem", color: "#333" }}>
          Esta configuración se aplicará a toda la pool.
        </p>
      </div>
    </div>
  );
}

// ==================== SUMMARY COMPONENTS ====================

type PresetSummaryProps = {
  presetKey: PickConfigPresetKey;
  isMobile?: boolean;
};

function PresetSummary({ presetKey, isMobile }: PresetSummaryProps) {
  const presetDescriptions: Record<string, string> = {
    CUMULATIVE:
      "Los puntos se SUMAN por cada criterio: Resultado (5/10 pts) + Goles local (2/4 pts) + Goles visitante (2/4 pts) + Diferencia (1/2 pts). Marcador exacto = 10 pts en grupos, 20 pts en eliminatorias.",
    BASIC:
      "Solo marcador exacto en todos los partidos con auto-scaling (20 pts en grupos → 60 pts en final).",
    SIMPLE:
      "Sin marcadores. En grupos: ordena equipos (10 pts por posición + 20 pts bonus grupo perfecto). En eliminatorias: elige quién avanza.",
  };

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: isMobile ? "0.75rem" : "1.5rem",
        background: "white",
      }}
    >
      <div style={{ marginBottom: isMobile ? "0.5rem" : "1rem" }}>
        <span
          style={{
            display: "inline-block",
            background: "#007bff",
            color: "white",
            padding: isMobile ? "0.15rem 0.5rem" : "0.25rem 0.75rem",
            borderRadius: "12px",
            fontSize: isMobile ? "0.65rem" : "0.75rem",
            fontWeight: "bold",
          }}
        >
          PRESET {presetKey}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: isMobile ? "0.75rem" : "0.875rem", color: "#666" }}>
        {presetDescriptions[presetKey]}
      </p>
    </div>
  );
}

type CustomConfigSummaryProps = {
  configuration: PhasePickConfig[];
  isMobile?: boolean;
};

function CustomConfigSummary({ configuration, isMobile }: CustomConfigSummaryProps) {
  return (
    <div style={{ display: "grid", gap: isMobile ? "0.5rem" : "1rem" }}>
      {configuration.map((phase, index) => (
        <div
          key={phase.phaseId}
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: isMobile ? "0.75rem" : "1.5rem",
            background: "white",
          }}
        >
          <h4 style={{ margin: "0 0 0.5rem 0", fontSize: isMobile ? "0.85rem" : "1rem" }}>
            {index + 1}. {phase.phaseName}
          </h4>

          {phase.requiresScore && phase.matchPicks ? (
            <div>
              <p style={{ margin: "0 0 0.25rem 0", fontSize: isMobile ? "0.75rem" : "0.875rem", color: "#666" }}>
                <strong>Tipo:</strong> Con marcadores
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? "0.25rem 0.5rem" : "0.25rem", fontSize: isMobile ? "0.7rem" : "0.875rem" }}>
                {phase.matchPicks.types
                  .filter((t) => t.enabled)
                  .map((type) => (
                    <span key={type.key} style={{ color: "#333" }}>
                      {getPickTypeName(type.key)}: <strong>{type.points}pts</strong>
                      {isMobile ? "" : " •"}
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: isMobile ? "0.75rem" : "0.875rem", color: "#666" }}>
              <strong>Tipo:</strong> Sin marcadores
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

type RulesPreviewProps = {
  configuration: PhasePickConfig[];
  isMobile?: boolean;
};

function RulesPreview({ configuration, isMobile }: RulesPreviewProps) {
  return (
    <div>
      <h3 style={{ margin: "0 0 0.5rem 0", fontSize: isMobile ? "0.9rem" : "1.125rem" }}>
        📜 REGLAS DE PUNTUACIÓN
      </h3>

      {configuration.map((phase) => (
        <div
          key={phase.phaseId}
          style={{
            marginBottom: isMobile ? "0.75rem" : "1.5rem",
            paddingBottom: isMobile ? "0.75rem" : "1.5rem",
            borderBottom: "1px solid #ddd",
          }}
        >
          <h4 style={{ margin: "0 0 0.25rem 0", fontSize: isMobile ? "0.85rem" : "1rem" }}>
            🏆 {phase.phaseName.toUpperCase()}
          </h4>

          {phase.requiresScore && phase.matchPicks ? (
            <>
              <p style={{ margin: "0 0 0.25rem 0", fontSize: isMobile ? "0.7rem" : "0.875rem", color: "#666" }}>
                Marcadores de partidos
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem 0.5rem", fontSize: isMobile ? "0.7rem" : "0.875rem" }}>
                {phase.matchPicks.types
                  .filter((t) => t.enabled)
                  .map((type) => (
                    <span key={type.key} style={{ background: "#e8f4ff", padding: "0.1rem 0.3rem", borderRadius: "3px" }}>
                      {type.points}pts {getPickTypeName(type.key)}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: isMobile ? "0.7rem" : "0.875rem", color: "#666" }}>
              Posiciones finales o avances
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
    MATCH_OUTCOME_90MIN: "Resultado (ganador/empate)",
    HOME_GOALS: "Goles del local",
    AWAY_GOALS: "Goles del visitante",
  };
  return names[key] || key;
}

