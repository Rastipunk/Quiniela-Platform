"use client";

// Componente unificado para partidos de eliminacion directa
// HOST: Publica resultado (goles + penales si aplica)
// PLAYER: Elige quien avanza
// Sprint 2 - Advanced Pick Types System - Preset SIMPLE

import { useState, useEffect } from "react";
import {
  upsertResult,
  upsertStructuralPick,
} from "../lib/api";

type Team = {
  id: string;
  name: string;
  code?: string;
  flag?: string;
};

type KnockoutMatchCardProps = {
  poolId: string;
  phaseId: string;
  matchId: string;
  homeTeam: Team;
  awayTeam: Team;
  kickoffUtc: string;
  token: string;
  isHost: boolean;
  isLocked: boolean;
  // Resultado existente del partido (si ya fue publicado)
  existingResult?: {
    homeGoals: number;
    awayGoals: number;
    homePenalties?: number | null;
    awayPenalties?: number | null;
  } | null;
  // Pick existente del usuario
  existingPick?: string | null;
  onResultSaved?: () => void;
  onPickSaved?: () => void;
};

export function KnockoutMatchCard({
  poolId,
  phaseId,
  matchId,
  homeTeam,
  awayTeam,
  kickoffUtc: _kickoffUtc,
  token,
  isHost,
  isLocked,
  existingResult,
  existingPick,
  onResultSaved,
  onPickSaved,
}: KnockoutMatchCardProps) {
  void _kickoffUtc; // Reserved for future deadline display
  // Player pick state
  const [selectedWinner, setSelectedWinner] = useState<string | null>(existingPick || null);
  const [pickSaved, setPickSaved] = useState(!!existingPick);
  const [savingPick, setSavingPick] = useState(false);

  // Host result state
  const [homeGoals, setHomeGoals] = useState<string>(existingResult ? String(existingResult.homeGoals) : "");
  const [awayGoals, setAwayGoals] = useState<string>(existingResult ? String(existingResult.awayGoals) : "");
  const [homePenalties, setHomePenalties] = useState<string>(
    existingResult?.homePenalties != null ? String(existingResult.homePenalties) : ""
  );
  const [awayPenalties, setAwayPenalties] = useState<string>(
    existingResult?.awayPenalties != null ? String(existingResult.awayPenalties) : ""
  );
  const [savingResult, setSavingResult] = useState(false);
  const [resultSaved, setResultSaved] = useState(!!existingResult);

  // Errata state
  const [errataReason, setErrataReason] = useState("");

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync with props
  useEffect(() => {
    setSelectedWinner(existingPick || null);
    setPickSaved(!!existingPick);
  }, [existingPick]);

  useEffect(() => {
    if (existingResult) {
      setHomeGoals(String(existingResult.homeGoals));
      setAwayGoals(String(existingResult.awayGoals));
      setHomePenalties(existingResult.homePenalties != null ? String(existingResult.homePenalties) : "");
      setAwayPenalties(existingResult.awayPenalties != null ? String(existingResult.awayPenalties) : "");
      setResultSaved(true);
    }
  }, [existingResult]);

  // Calculate winner from result
  const winnerId = calculateWinner();

  function calculateWinner(): string | null {
    const hg = parseInt(homeGoals);
    const ag = parseInt(awayGoals);
    if (isNaN(hg) || isNaN(ag)) return null;

    if (hg > ag) return homeTeam.id;
    if (ag > hg) return awayTeam.id;

    // Empate en 90 min - necesita penales
    const hp = parseInt(homePenalties);
    const ap = parseInt(awayPenalties);
    if (isNaN(hp) || isNaN(ap)) return null;

    if (hp > ap) return homeTeam.id;
    if (ap > hp) return awayTeam.id;

    return null; // Empate en penales (invalido)
  }

  const needsPenalties = (): boolean => {
    const hg = parseInt(homeGoals);
    const ag = parseInt(awayGoals);
    return !isNaN(hg) && !isNaN(ag) && hg === ag;
  };

  // Save player pick
  async function handleSavePick() {
    if (!selectedWinner) {
      setError("Selecciona un equipo");
      return;
    }

    try {
      setSavingPick(true);
      setError(null);

      // Guardar como structural pick
      const pickData = {
        matches: [{ matchId, winnerId: selectedWinner }]
      };
      await upsertStructuralPick(token, poolId, phaseId, pickData);

      setPickSaved(true);
      setSuccessMessage("Predicción guardada");
      setTimeout(() => setSuccessMessage(null), 2000);
      onPickSaved?.();
    } catch (err: any) {
      setError(err?.message || "Error al guardar predicción");
    } finally {
      setSavingPick(false);
    }
  }

  // Save host result
  async function handleSaveResult() {
    const hg = parseInt(homeGoals);
    const ag = parseInt(awayGoals);

    if (isNaN(hg) || isNaN(ag) || hg < 0 || ag < 0) {
      setError("Marcador inválido");
      return;
    }

    // Si hay empate, validar penales
    if (hg === ag) {
      const hp = parseInt(homePenalties);
      const ap = parseInt(awayPenalties);

      if (isNaN(hp) || isNaN(ap) || hp < 0 || ap < 0) {
        setError("Empate en 90 min - ingresa resultado de penales");
        return;
      }

      if (hp === ap) {
        setError("Los penales no pueden terminar en empate");
        return;
      }
    }

    // Si es errata (resultado ya existia), requiere razon
    if (resultSaved && !errataReason.trim()) {
      setError("Se requiere una razón para corregir el resultado");
      return;
    }

    try {
      setSavingResult(true);
      setError(null);

      await upsertResult(token, poolId, matchId, {
        homeGoals: hg,
        awayGoals: ag,
        homePenalties: hg === ag ? parseInt(homePenalties) : undefined,
        awayPenalties: hg === ag ? parseInt(awayPenalties) : undefined,
        reason: resultSaved ? errataReason : undefined,
      });

      setResultSaved(true);
      setErrataReason("");
      setSuccessMessage("Resultado publicado");
      setTimeout(() => setSuccessMessage(null), 2000);
      onResultSaved?.();
    } catch (err: any) {
      setError(err?.message || "Error al publicar resultado");
    } finally {
      setSavingResult(false);
    }
  }

  const winnerTeam = winnerId === homeTeam.id ? homeTeam : winnerId === awayTeam.id ? awayTeam : null;

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.25rem", background: "#fff" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid #f3f4f6"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>
            {homeTeam.name}
          </span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>vs</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>
            {awayTeam.name}
          </span>
        </div>
        {resultSaved && winnerTeam && (
          <div style={{
            padding: "0.25rem 0.75rem",
            background: "#dcfce7",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            color: "#16a34a"
          }}>
            Avanza: {winnerTeam.name}
          </div>
        )}
      </div>

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* LEFT: Player Pick */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.75rem", color: "#6b7280" }}>
            Tu predicción {pickSaved && <span style={{ color: "#10b981" }}>✓</span>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <TeamPickButton
              team={homeTeam}
              isSelected={selectedWinner === homeTeam.id}
              onClick={() => !isLocked && setSelectedWinner(homeTeam.id)}
              disabled={isLocked}
            />
            <TeamPickButton
              team={awayTeam}
              isSelected={selectedWinner === awayTeam.id}
              onClick={() => !isLocked && setSelectedWinner(awayTeam.id)}
              disabled={isLocked}
            />
          </div>

          {!isLocked && selectedWinner && !pickSaved && (
            <button
              onClick={handleSavePick}
              disabled={savingPick}
              style={{
                width: "100%",
                marginTop: "0.75rem",
                padding: "0.6rem",
                fontSize: 13,
                fontWeight: 600,
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: savingPick ? "not-allowed" : "pointer",
              }}
            >
              {savingPick ? "Guardando..." : "Guardar"}
            </button>
          )}

          {pickSaved && !isLocked && (
            <button
              onClick={() => setPickSaved(false)}
              style={{
                width: "100%",
                marginTop: "0.75rem",
                padding: "0.6rem",
                fontSize: 13,
                fontWeight: 600,
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Editar
            </button>
          )}
        </div>

        {/* RIGHT: Official Result */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.75rem", color: "#6b7280" }}>
            Resultado oficial {resultSaved && <span style={{ color: "#f59e0b" }}>★</span>}
          </div>

          {resultSaved && !isHost ? (
            // PLAYER view: show result
            <div style={{
              padding: "1rem",
              background: "#f9fafb",
              borderRadius: 8,
              textAlign: "center"
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#1f2937" }}>
                {homeGoals} - {awayGoals}
              </div>
              {needsPenalties() && homePenalties && awayPenalties && (
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: "0.25rem" }}>
                  ({homePenalties} - {awayPenalties} pen.)
                </div>
              )}
              {winnerTeam && (
                <div style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem",
                  background: "#dcfce7",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#16a34a"
                }}>
                  🏆 {winnerTeam.name} avanza
                </div>
              )}
            </div>
          ) : isHost ? (
            // HOST view: input result
            <div>
              {/* Marcador 90 min */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem"
              }}>
                <span style={{ fontSize: 12, color: "#6b7280", width: 60 }}>90 min:</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={homeGoals}
                  onChange={(e) => { setHomeGoals(e.target.value); setResultSaved(false); }}
                  placeholder={homeTeam.code || "L"}
                  style={{
                    width: 50,
                    padding: "0.4rem",
                    fontSize: 14,
                    textAlign: "center",
                    border: "1px solid #d1d5db",
                    borderRadius: 4
                  }}
                />
                <span style={{ color: "#9ca3af" }}>-</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={awayGoals}
                  onChange={(e) => { setAwayGoals(e.target.value); setResultSaved(false); }}
                  placeholder={awayTeam.code || "V"}
                  style={{
                    width: 50,
                    padding: "0.4rem",
                    fontSize: 14,
                    textAlign: "center",
                    border: "1px solid #d1d5db",
                    borderRadius: 4
                  }}
                />
              </div>

              {/* Penales (solo si empate) */}
              {needsPenalties() && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  background: "#fef3c7",
                  borderRadius: 6
                }}>
                  <span style={{ fontSize: 12, color: "#92400e", width: 60 }}>Penales:</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={homePenalties}
                    onChange={(e) => { setHomePenalties(e.target.value); setResultSaved(false); }}
                    style={{
                      width: 50,
                      padding: "0.4rem",
                      fontSize: 14,
                      textAlign: "center",
                      border: "1px solid #fcd34d",
                      borderRadius: 4,
                      background: "#fffbeb"
                    }}
                  />
                  <span style={{ color: "#92400e" }}>-</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={awayPenalties}
                    onChange={(e) => { setAwayPenalties(e.target.value); setResultSaved(false); }}
                    style={{
                      width: 50,
                      padding: "0.4rem",
                      fontSize: 14,
                      textAlign: "center",
                      border: "1px solid #fcd34d",
                      borderRadius: 4,
                      background: "#fffbeb"
                    }}
                  />
                </div>
              )}

              {/* Preview del ganador */}
              {winnerId && (
                <div style={{
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  background: "#dcfce7",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#16a34a",
                  textAlign: "center"
                }}>
                  Avanza: <strong>{winnerTeam?.name}</strong>
                  {needsPenalties() && " (por penales)"}
                </div>
              )}

              {/* Razon de errata */}
              {resultSaved && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <input
                    type="text"
                    value={errataReason}
                    onChange={(e) => setErrataReason(e.target.value)}
                    placeholder="Razón de corrección..."
                    style={{
                      width: "100%",
                      padding: "0.4rem",
                      fontSize: 12,
                      border: "1px solid #fcd34d",
                      borderRadius: 4,
                      background: "#fffbeb",
                    }}
                  />
                </div>
              )}

              {/* Boton guardar */}
              <button
                onClick={handleSaveResult}
                disabled={savingResult || !homeGoals || !awayGoals || (needsPenalties() && (!homePenalties || !awayPenalties))}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  fontSize: 13,
                  fontWeight: 600,
                  background: savingResult ? "#d1d5db" : resultSaved ? "#f59e0b" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: savingResult ? "not-allowed" : "pointer",
                }}
              >
                {savingResult ? "Guardando..." : resultSaved ? "Actualizar resultado" : "Publicar resultado"}
              </button>
            </div>
          ) : (
            // PLAYER view: no result yet
            <div style={{
              padding: "2rem 1rem",
              textAlign: "center",
              background: "#f9fafb",
              borderRadius: 8,
              color: "#9ca3af",
              fontSize: 13
            }}>
              Pendiente de resultado
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          marginTop: "1rem",
          padding: "0.6rem",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 6,
          color: "#dc2626",
          fontSize: 12
        }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div style={{
          marginTop: "1rem",
          padding: "0.6rem",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 6,
          color: "#16a34a",
          fontSize: 12
        }}>
          {successMessage}
        </div>
      )}
    </div>
  );
}

// Button for team selection
function TeamPickButton({
  team,
  isSelected,
  onClick,
  disabled
}: {
  team: Team;
  isSelected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.75rem",
        background: isSelected ? "#dcfce7" : "#fff",
        border: isSelected ? "2px solid #10b981" : "1px solid #e5e7eb",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && !isSelected ? 0.5 : 1,
        transition: "all 0.2s",
      }}
    >
      {isSelected && (
        <span style={{ color: "#10b981", fontSize: 16 }}>✓</span>
      )}
      <span style={{
        fontSize: 14,
        fontWeight: isSelected ? 600 : 500,
        color: isSelected ? "#16a34a" : "#1f2937"
      }}>
        {team.name}
      </span>
      {isSelected && (
        <span style={{
          marginLeft: "auto",
          fontSize: 11,
          color: "#10b981",
          background: "#f0fdf4",
          padding: "0.15rem 0.5rem",
          borderRadius: 10
        }}>
          avanza
        </span>
      )}
    </button>
  );
}
