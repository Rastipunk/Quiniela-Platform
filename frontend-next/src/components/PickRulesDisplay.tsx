"use client";

// Componente para mostrar las reglas de picks en PoolPage
// Sprint 2 - Advanced Pick Types System

import type { PoolPickTypesConfig, MatchPickTypeKey } from "../types/pickConfig";

type PickRulesDisplayProps = {
  pickTypesConfig: PoolPickTypesConfig;
  poolDeadlineMinutes: number;
  poolTimeZone: string;
};

export function PickRulesDisplay({
  pickTypesConfig,
  poolDeadlineMinutes,
  poolTimeZone,
}: PickRulesDisplayProps) {
  // Guard: verificar que pickTypesConfig es un array válido
  if (!pickTypesConfig || !Array.isArray(pickTypesConfig)) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        No hay configuración de reglas disponible para este pool.
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem 0" }}>
      <div style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "1.5rem",
        borderRadius: 12,
        marginBottom: "2rem",
        color: "white"
      }}>
        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: 24, fontWeight: 900 }}>
          📜 Reglas de Puntuación
        </h3>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "white" }}>
          Este pool tiene configuración personalizada por fase. Lee atentamente cada fase para entender cómo ganar puntos.
        </p>
      </div>

      {pickTypesConfig.map((phase, index) => (
        <div
          key={phase.phaseId}
          style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            background: "white",
            borderRadius: 12,
            border: "2px solid #e9ecef",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: "1rem",
            paddingBottom: "0.75rem",
            borderBottom: "2px solid #007bff"
          }}>
            <span style={{
              fontSize: 28,
              background: "#007bff",
              color: "white",
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900
            }}>
              {index + 1}
            </span>
            <h4 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#007bff" }}>
              {(phase.phaseName || formatPhaseId(phase.phaseId) || `Fase ${index + 1}`).toUpperCase()}
            </h4>
          </div>

          {phase.requiresScore && phase.matchPicks ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Tipo de predicción:</span>{" "}
                <span
                  style={{
                    background: "#d4edda",
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "1px solid #c3e6cb",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  📝 Marcadores de partidos
                </span>
              </div>

              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>Cómo ganar puntos:</strong>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {phase.matchPicks.types
                  .filter((t) => t.enabled)
                  .map((type) => (
                    <div
                      key={type.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        background: "white",
                        borderRadius: 8,
                        border: "1px solid #dee2e6",
                      }}
                    >
                      <span style={{ fontSize: 20, fontWeight: 900, color: "#28a745", minWidth: 50, textAlign: "right" }}>
                        {type.points}
                      </span>
                      <span style={{ fontSize: 14 }}>
                        pts - <strong>{getPickTypeName(type.key)}</strong>{" "}
                        <span style={{ color: "#666", fontSize: 13 }}>{getPickTypeExample(type.key)}</span>
                      </span>
                    </div>
                  ))}
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "#fff3cd",
                  borderRadius: 8,
                  border: "1px solid #ffeeba",
                }}
              >
                <div style={{ fontSize: 13, color: "#856404" }}>
                  ⏰ <b>Deadline:</b> {poolDeadlineMinutes} minutos antes del inicio de cada partido (timezone: {poolTimeZone})
                </div>
              </div>
            </>
          ) : phase.structuralPicks ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Tipo de predicción:</span>{" "}
                <span
                  style={{
                    background: "#fff3cd",
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "1px solid #ffeeba",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  📊 Sin marcadores
                </span>
              </div>

              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>Cómo ganar puntos:</strong>
              </div>

              {phase.structuralPicks.type === "GROUP_STANDINGS" && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "white",
                    borderRadius: 8,
                    border: "1px solid #dee2e6",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    📋 <strong>Ordenar posiciones de cada grupo</strong>
                  </div>
                  {/* Soportar nuevo formato (pointsPosition1-4) y legacy (pointsPerExactPosition) */}
                  {(phase.structuralPicks.config as any).pointsPosition1 !== undefined ? (
                    <>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        • 🥇 {(phase.structuralPicks.config as any).pointsPosition1} pts por acertar el 1° lugar
                      </div>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        • 🥈 {(phase.structuralPicks.config as any).pointsPosition2} pts por acertar el 2° lugar
                      </div>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        • 🥉 {(phase.structuralPicks.config as any).pointsPosition3} pts por acertar el 3° lugar
                      </div>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        • 4️⃣ {(phase.structuralPicks.config as any).pointsPosition4} pts por acertar el 4° lugar
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#666", fontSize: 13 }}>
                      • {(phase.structuralPicks.config as any).pointsPerExactPosition} pts por cada equipo en su posición exacta
                    </div>
                  )}
                  {/* Bonus por grupo perfecto - soporta nuevo formato (bonusPerfectGroupEnabled) y legacy */}
                  {((phase.structuralPicks.config as any).bonusPerfectGroupEnabled ?? (phase.structuralPicks.config as any).bonusPerfectGroup) && (phase.structuralPicks.config as any).bonusPerfectGroup && (
                    <div style={{ color: "#666", fontSize: 13 }}>
                      • 🎯 +{(phase.structuralPicks.config as any).bonusPerfectGroup} pts de bonus por acertar un grupo completo
                    </div>
                  )}
                  {(phase.structuralPicks.config as any).includeGlobalQualifiers && (
                    <div style={{ color: "#666", fontSize: 13 }}>
                      • Predicción adicional de clasificados globales ({(phase.structuralPicks.config as any).globalQualifiersPoints} pts/posición)
                    </div>
                  )}
                </div>
              )}

              {phase.structuralPicks.type === "GLOBAL_QUALIFIERS" && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "white",
                    borderRadius: 8,
                    border: "1px solid #dee2e6",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    🌍 <strong>Ordenar clasificados globales</strong>
                  </div>
                  <div style={{ color: "#666", fontSize: 13 }}>
                    • Predice el orden de los {(phase.structuralPicks.config as any).totalQualifiers} equipos clasificados
                  </div>
                  <div style={{ color: "#666", fontSize: 13 }}>
                    • {(phase.structuralPicks.config as any).pointsPerExactPosition} pts por cada equipo en su posición exacta
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#856404" }}>
                    ⚠️ Esta predicción se bloqueará el: {new Date((phase.structuralPicks.config as any).lockDateTime).toLocaleString()}
                  </div>
                </div>
              )}

              {phase.structuralPicks.type === "KNOCKOUT_WINNER" && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "white",
                    borderRadius: 8,
                    border: "1px solid #dee2e6",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    🎯 <strong>Predecir quién avanza</strong>
                  </div>
                  <div style={{ color: "#666", fontSize: 13 }}>
                    • {(phase.structuralPicks.config as any).pointsPerCorrectAdvance} pts por cada equipo que aciertes que avanza a la siguiente ronda
                  </div>
                  <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                    (No importa el marcador ni cómo avancen, solo quién pasa)
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      ))}

      {/* General Notes */}
      <div
        style={{
          marginTop: 24,
          padding: "1.5rem",
          background: "#f8f9fa",
          borderRadius: 12,
          border: "2px solid #dee2e6",
        }}
      >
        <div style={{ fontSize: 15, color: "#333", lineHeight: 1.8, fontWeight: 500 }}>
          <div style={{ marginBottom: 12, color: "#1a1a2e" }}>
            💡 <strong>Notas importantes:</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 24, color: "#444" }}>
            <li>Cada fase del torneo puede tener diferentes tipos de picks y puntuaciones.</li>
            <li>Lee atentamente las reglas de CADA FASE antes de hacer tus predicciones.</li>
            <li>Los puntos suelen aumentar en fases más avanzadas del torneo (octavos, cuartos, semifinales, final).</li>
            {isCumulativeScoringFromConfig(pickTypesConfig) ? (
              <li style={{ color: "#155724", background: "#d4edda", padding: "8px 12px", borderRadius: 6, marginTop: 8, marginBottom: 8, listStyle: "none", marginLeft: -24 }}>
                <strong>🎯 Sistema acumulativo:</strong> Los puntos se SUMAN por cada criterio que aciertes. Si aciertas el marcador exacto, ganas la suma de todos los criterios (máx 10 pts en grupos, 20 pts en eliminatorias).
              </li>
            ) : (
              <li>Si aciertas el marcador exacto, también aciertas automáticamente otros tipos (pero solo ganas los puntos del exacto).</li>
            )}
            <li>Los picks se cierran según el deadline configurado para este pool: <strong style={{ color: "#c92a2a" }}>{poolDeadlineMinutes} minutos antes del inicio de cada partido</strong>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ==================== HELPER FUNCTIONS ====================

function formatPhaseId(phaseId: string): string {
  const phaseNames: Record<string, string> = {
    group_stage: "Fase de Grupos",
    round_of_32: "Dieciseisavos de Final",
    round_of_16: "Octavos de Final",
    quarterfinals: "Cuartos de Final",
    semifinals: "Semifinales",
    third_place: "Tercer Lugar",
    final: "Final",
  };
  return phaseNames[phaseId] || phaseId.replace(/_/g, " ");
}

function getPickTypeName(key: MatchPickTypeKey): string {
  const names: Record<MatchPickTypeKey, string> = {
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

function getPickTypeExample(key: MatchPickTypeKey): string {
  const examples: Record<MatchPickTypeKey, string> = {
    EXACT_SCORE: "Predices 2-1, sale 2-1 → GANAS LOS PUNTOS | Sale 3-1 → 0 pts",
    GOAL_DIFFERENCE: "Predices 2-0 (+2), sale 3-1 (+2) → GANAS LOS PUNTOS | Sale 2-1 (+1) → 0 pts",
    PARTIAL_SCORE: "Predices 2-1, sale 2-3 → GANAS LOS PUNTOS (los 2 del local) | Sale 3-3 → 0 pts",
    TOTAL_GOALS: "Predices 2-1 (3 goles), sale 3-0 (3 goles) → GANAS LOS PUNTOS | Sale 2-0 → 0 pts",
    MATCH_OUTCOME_90MIN: "Predices victoria local (2-1), sale 3-0 (victoria local) → GANAS LOS PUNTOS",
    HOME_GOALS: "Predices 2-1, sale 2-3 → GANAS LOS PUNTOS (acertaste los 2 del local)",
    AWAY_GOALS: "Predices 2-1, sale 3-1 → GANAS LOS PUNTOS (acertaste el 1 del visitante)",
  };
  return examples[key] || "";
}

/**
 * Detecta si la configuración usa el sistema acumulativo
 */
function isCumulativeScoring(types: { key: string; enabled: boolean }[]): boolean {
  return types.some((t) => t.enabled && (t.key === "HOME_GOALS" || t.key === "AWAY_GOALS"));
}

/**
 * Detecta si el pool completo usa el sistema acumulativo (revisa todas las fases)
 */
function isCumulativeScoringFromConfig(config: PoolPickTypesConfig): boolean {
  return config.some((phase) =>
    phase.requiresScore &&
    phase.matchPicks?.types &&
    isCumulativeScoring(phase.matchPicks.types)
  );
}
