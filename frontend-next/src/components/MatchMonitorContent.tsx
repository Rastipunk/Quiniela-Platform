"use client";

/**
 * Admin-only live match monitor (SCORE_PIPELINE_AUDIT §6, Etapa 3A).
 * Polls GET /admin/matches/monitor every 15s and renders one card per
 * match in the operational window: scraper state, score, confidence,
 * tracking freshness, grace countdown and result propagation across
 * ACTIVE pools. Read-only — the master override ships as Etapa 3B.
 */

import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const POLL_MS = 15_000;

interface MonitorRow {
  instanceId: string;
  instanceName: string;
  matchId: string;
  fixtureId: number | null;
  phaseId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffUtc: string;
  syncStatus: string | null;
  lastApiStatus: string | null;
  elapsed: number | null;
  extra: number | null;
  graceEndUtc: string | null;
  trackedAtUtc: string | null;
  lastCheckedAtUtc: string | null;
  live: {
    homeGoals: number;
    awayGoals: number;
    penaltyHome: number | null;
    penaltyAway: number | null;
    status: string;
    confidence: string;
    sourcesAgreeing: number;
    sourcesTotal: number;
    lastUpdated: string | null;
  } | null;
  activePools: number;
  resultsBySource: Record<string, number>;
}

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
const TERMINAL_STATUSES = new Set(["FT", "AET", "PEN", "ABD"]);

function statusBadge(row: MonitorRow): { label: string; bg: string; fg: string } {
  const s = row.live?.status ?? row.lastApiStatus ?? "—";
  if (s === "NS") return { label: "Programado", bg: "#e5e7eb", fg: "#374151" };
  if (s === "HT") return { label: "Descanso", bg: "#fef3c7", fg: "#92400e" };
  if (s === "ET" || s === "BT") return { label: `Prórroga ${row.elapsed ?? ""}'`, bg: "#fde68a", fg: "#92400e" };
  if (s === "P") return { label: "Penales", bg: "#fecaca", fg: "#7f1d1d" };
  if (LIVE_STATUSES.has(s)) return { label: `En vivo ${row.elapsed ?? ""}'${row.extra ? `+${row.extra}` : ""}`, bg: "#dcfce7", fg: "#166534" };
  if (TERMINAL_STATUSES.has(s)) {
    const suffix = s === "AET" ? " (prórroga)" : s === "PEN" ? " (penales)" : s === "ABD" ? " (ABANDONADO)" : "";
    return { label: `Final${suffix}`, bg: "#e0e7ff", fg: "#3730a3" };
  }
  return { label: s, bg: "#e5e7eb", fg: "#374151" };
}

function freshness(iso: string | null): { label: string; ok: boolean } {
  if (!iso) return { label: "nunca", ok: false };
  const ageSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (ageSec < 90) return { label: `hace ${ageSec}s`, ok: true };
  if (ageSec < 3600) return { label: `hace ${Math.round(ageSec / 60)}min`, ok: ageSec < 600 };
  return { label: `hace ${Math.round(ageSec / 3600)}h`, ok: false };
}

interface OverrideSummary {
  totalPools: number;
  updated: number;
  unchanged: number;
  skippedHostOverride: string[];
  failed: Array<{ poolId: string; error: string }>;
}

export default function MatchMonitorContent() {
  const [rows, setRows] = useState<MonitorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string>("");
  const [overrideTarget, setOverrideTarget] = useState<MonitorRow | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError("Sin sesión");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/admin/matches/monitor`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}${res.status === 403 ? " — se requiere ADMIN" : ""}`);
        return;
      }
      const data = await res.json();
      setRows(data.matches ?? []);
      setError(null);
      setLastFetch(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: 4 }}>
        ⚽ Monitor de Partidos
      </h1>
      <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: 16 }}>
        Ventana operativa (−12h / +36h) · auto-refresh 15s
        {lastFetch && ` · actualizado ${lastFetch}`}
      </p>

      {error && (
        <div style={{ padding: 12, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {rows === null && !error && <div style={{ color: "#6b7280" }}>Cargando…</div>}
      {rows !== null && rows.length === 0 && (
        <div style={{ color: "#6b7280" }}>Sin partidos en la ventana operativa.</div>
      )}

      {overrideTarget && (
        <MasterOverrideModal
          row={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onApplied={() => {
            setOverrideTarget(null);
            load();
          }}
        />
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {(rows ?? []).map((row) => {
          const badge = statusBadge(row);
          const tracked = freshness(row.trackedAtUtc);
          const checked = freshness(row.lastCheckedAtUtc);
          const graceLeftSec = row.graceEndUtc
            ? Math.max(0, Math.round((new Date(row.graceEndUtc).getTime() - Date.now()) / 1000))
            : null;
          const confirmedCount = row.resultsBySource["API_CONFIRMED"] ?? 0;
          const overrideCount = row.resultsBySource["HOST_OVERRIDE"] ?? 0;
          const provisionalCount = row.resultsBySource["SCRAPER_PROVISIONAL"] ?? 0;

          return (
            <div
              key={`${row.instanceId}:${row.matchId}`}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white" }}
            >
              {/* Header: teams + score + status */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                  {row.homeTeamName}{" "}
                  <span style={{ fontWeight: 900, fontSize: "1.1rem" }}>
                    {row.live ? `${row.live.homeGoals} - ${row.live.awayGoals}` : "vs"}
                  </span>{" "}
                  {row.awayTeamName}
                  {row.live?.penaltyHome != null && row.live?.penaltyAway != null && (
                    <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                      {" "}({row.live.penaltyHome}-{row.live.penaltyAway} pen)
                    </span>
                  )}
                </div>
                <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 700, background: badge.bg, color: badge.fg }}>
                  {badge.label}
                </span>
              </div>

              {/* Meta line */}
              <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#6b7280" }}>
                {row.instanceName} · {row.phaseId} · fixture {row.fixtureId ?? "—"} · kickoff{" "}
                {new Date(row.kickoffUtc).toLocaleString()} · sync {row.syncStatus ?? "—"}
              </div>

              {/* Actions */}
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setOverrideTarget(row)}
                  style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 700,
                    background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", cursor: "pointer",
                  }}
                >
                  ⚡ Override master
                </button>
              </div>

              {/* Signals */}
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, fontSize: "0.78rem" }}>
                <Chip ok={!!row.live && row.live.sourcesAgreeing >= 3} label={
                  row.live
                    ? `Consenso ${row.live.sourcesAgreeing}/${row.live.sourcesTotal} (${row.live.confidence})`
                    : "Sin datos del scraper"
                } />
                <Chip ok={tracked.ok || row.trackedAtUtc != null} label={`Track ${tracked.label}`} />
                <Chip ok={checked.ok} label={`Poll ${checked.label}`} />
                {graceLeftSec !== null && graceLeftSec > 0 && (
                  <Chip ok={true} label={`Grace: ${graceLeftSec}s para confirmar`} />
                )}
                <Chip
                  ok={provisionalCount === 0 || confirmedCount + overrideCount === 0}
                  label={
                    confirmedCount + overrideCount + provisionalCount === 0
                      ? `Sin resultado en pools (${row.activePools} activas)`
                      : `Pools: ${confirmedCount} confirmadas${overrideCount ? `, ${overrideCount} override` : ""}${provisionalCount ? `, ${provisionalCount} provisionales` : ""} de ${row.activePools}`
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Master override modal (Etapa 3B): applies a result to EVERY ACTIVE
 * pool of the instance as HOST_OVERRIDE (the scraper can never undo
 * it). Silent — no member emails. Pools whose host already overrode
 * are respected unless the checkbox says otherwise.
 */
function MasterOverrideModal({
  row,
  onClose,
  onApplied,
}: {
  row: MonitorRow;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [homeGoals, setHomeGoals] = useState(row.live ? String(row.live.homeGoals) : "");
  const [awayGoals, setAwayGoals] = useState(row.live ? String(row.live.awayGoals) : "");
  const [wentToExtraTime, setWentToExtraTime] = useState(false);
  const [homeGoals90, setHomeGoals90] = useState("");
  const [awayGoals90, setAwayGoals90] = useState("");
  const [homePens, setHomePens] = useState(row.live?.penaltyHome != null ? String(row.live.penaltyHome) : "");
  const [awayPens, setAwayPens] = useState(row.live?.penaltyAway != null ? String(row.live.penaltyAway) : "");
  const [reason, setReason] = useState("");
  const [overwriteHosts, setOverwriteHosts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<OverrideSummary | null>(null);

  const hNum = homeGoals.trim() !== "" ? Number(homeGoals) : null;
  const aNum = awayGoals.trim() !== "" ? Number(awayGoals) : null;
  const isDraw = hNum !== null && aNum !== null && hNum === aNum;
  const h90 = homeGoals90.trim() !== "" ? Number(homeGoals90) : null;
  const a90 = awayGoals90.trim() !== "" ? Number(awayGoals90) : null;
  const et90Invalid =
    wentToExtraTime &&
    (h90 === null || a90 === null || (hNum !== null && h90 > hNum) || (aNum !== null && a90 > aNum));
  const canSubmit =
    hNum !== null && aNum !== null && reason.trim().length >= 5 && !et90Invalid && !busy;

  async function submit() {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/matches/master-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          instanceId: row.instanceId,
          matchId: row.matchId,
          homeGoals: hNum,
          awayGoals: aNum,
          ...(wentToExtraTime && h90 !== null && a90 !== null
            ? { homeGoals90: h90, awayGoals90: a90 }
            : {}),
          ...(isDraw && homePens.trim() !== "" && awayPens.trim() !== ""
            ? { homePenalties: Number(homePens), awayPenalties: Number(awayPens) }
            : {}),
          reason: reason.trim(),
          overwriteHostOverrides: overwriteHosts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ? JSON.stringify(data.details ?? data.error) : `HTTP ${res.status}`);
        return;
      }
      setSummary(data as OverrideSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: 60, padding: 10, borderRadius: 10, border: "2px solid #d1d5db",
    textAlign: "center", fontSize: 20, fontWeight: 800, background: "white",
  };

  // Hint for the disabled submit button — the admin should never have
  // to guess why the action isn't available.
  const submitHint =
    hNum === null || aNum === null
      ? "Falta el marcador final"
      : et90Invalid
        ? "Completa el marcador al 90' (no puede superar al final)"
        : reason.trim().length < 5
          ? "Escribe la razón (mínimo 5 caracteres)"
          : null;

  const previewParts = [
    hNum !== null && aNum !== null ? `Final ${hNum}-${aNum}` : null,
    wentToExtraTime && h90 !== null && a90 !== null ? `90': ${h90}-${a90}` : null,
    isDraw && homePens.trim() !== "" && awayPens.trim() !== ""
      ? `Penales ${homePens}-${awayPens}`
      : null,
  ].filter(Boolean);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#f9fafb", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px", background: "#1f2937", borderRadius: "16px 16px 0 0", color: "white" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>
            ⚡ Override master — {row.homeTeamName} vs {row.awayTeamName}
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <HeaderChip>📦 {row.activePools} pools activas</HeaderChip>
            <HeaderChip>🔒 El scraper no podrá sobreescribirlo</HeaderChip>
            <HeaderChip>🔕 Sin emails a miembros</HeaderChip>
            <HeaderChip>📝 Queda auditado</HeaderChip>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {summary ? (
            <div style={{ fontSize: "0.9rem" }}>
              <div style={{ padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, marginBottom: 12, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>✅ Override aplicado</div>
                <div><b>{summary.updated}</b> pools actualizadas</div>
                {summary.unchanged > 0 && <div>{summary.unchanged} ya tenían este resultado (sin cambios)</div>}
                {summary.skippedHostOverride.length > 0 && (
                  <div>{summary.skippedHostOverride.length} respetadas — su host ya había corregido manualmente</div>
                )}
                {summary.failed.length > 0 && <div style={{ color: "#dc2626" }}>{summary.failed.length} fallidas</div>}
              </div>
              {summary.failed.length > 0 && (
                <div style={{ padding: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, marginBottom: 12, color: "#991b1b", fontSize: "0.78rem" }}>
                  Pools fallidas: {summary.failed.map((f) => f.poolId.slice(0, 8)).join(", ")} — revisa logs del backend.
                </div>
              )}
              <button onClick={onApplied} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}>
                Cerrar y refrescar el monitor
              </button>
            </div>
          ) : (
            <>
              {/* Paso 1 — Marcador final */}
              <Section
                number={1}
                title="Marcador FINAL del partido"
                help="Goles totales al terminar el partido — incluyendo prórroga si la hubo, SIN contar la tanda de penales. Este marcador puntúa en las pools configuradas para incluir prórroga y define quién avanza de ronda."
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, width: 90, textAlign: "right" }}>{row.homeTeamName}</span>
                  <input type="number" min={0} value={homeGoals} onChange={(e) => setHomeGoals(e.target.value)} style={inputStyle} placeholder="0" />
                  <span style={{ fontWeight: 900, fontSize: 20, color: "#9ca3af" }}>–</span>
                  <input type="number" min={0} value={awayGoals} onChange={(e) => setAwayGoals(e.target.value)} style={inputStyle} placeholder="0" />
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, width: 90 }}>{row.awayTeamName}</span>
                </div>
              </Section>

              {/* Paso 2 — Prórroga / minuto 90 */}
              <Section
                number={2}
                title="¿Hubo prórroga (tiempo extra)?"
                help="La mayoría de las pools puntúan con el marcador de los 90 minutos reglamentarios. Si el partido se definió en prórroga, necesitamos AMBOS marcadores: el final (arriba) para las pools que incluyen prórroga, y el del minuto 90 para las demás. Si NO hubo prórroga, deja esto apagado — ambos marcadores son el mismo."
              >
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>
                  <input type="checkbox" checked={wentToExtraTime} onChange={(e) => setWentToExtraTime(e.target.checked)} style={{ width: 18, height: 18 }} />
                  Sí, el partido se fue a prórroga
                </label>
                {wentToExtraTime && (
                  <div style={{ marginTop: 12, padding: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e40af", marginBottom: 8, textAlign: "center" }}>
                      ¿Cómo iba el partido al MINUTO 90 (antes de la prórroga)?
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                      <input type="number" min={0} value={homeGoals90} onChange={(e) => setHomeGoals90(e.target.value)} style={inputStyle} placeholder="0" />
                      <span style={{ fontWeight: 900, fontSize: 20, color: "#9ca3af" }}>–</span>
                      <input type="number" min={0} value={awayGoals90} onChange={(e) => setAwayGoals90(e.target.value)} style={inputStyle} placeholder="0" />
                    </div>
                    {et90Invalid && (
                      <div style={{ marginTop: 8, fontSize: "0.75rem", color: "#dc2626", textAlign: "center", fontWeight: 600 }}>
                        Ambos marcadores del 90&apos; son obligatorios y no pueden superar al marcador final.
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* Paso 3 — Penales (solo con empate) */}
              {isDraw && (
                <Section
                  number={3}
                  title="Tanda de penales"
                  help="Los penales NUNCA suman goles ni puntos de marcador. Solo definen quién avanza de ronda (y los puntos de 'acertar quién pasa' en pools Estratega). Déjalos vacíos solo si el partido permite empate."
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, width: 90, textAlign: "right" }}>{row.homeTeamName}</span>
                    <input type="number" min={0} value={homePens} onChange={(e) => setHomePens(e.target.value)} style={{ ...inputStyle, borderColor: "#fcd34d", background: "#fffbeb" }} placeholder="0" />
                    <span style={{ fontWeight: 900, fontSize: 20, color: "#9ca3af" }}>–</span>
                    <input type="number" min={0} value={awayPens} onChange={(e) => setAwayPens(e.target.value)} style={{ ...inputStyle, borderColor: "#fcd34d", background: "#fffbeb" }} placeholder="0" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, width: 90 }}>{row.awayTeamName}</span>
                  </div>
                </Section>
              )}

              {/* Paso 4 — Razón */}
              <Section
                number={isDraw ? 4 : 3}
                title="Razón de la corrección"
                help="Obligatoria. Queda registrada en la auditoría junto con tu usuario y el resumen de pools afectadas."
              >
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: El scraper congeló el marcador en 1-0; resultado oficial FIFA 2-1."
                  rows={2}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "2px solid #d1d5db", fontSize: "0.85rem", boxSizing: "border-box", fontFamily: "inherit" }}
                />
              </Section>

              {/* Opción avanzada */}
              <div style={{ padding: "10px 12px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, marginBottom: 14 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.78rem", color: "#9a3412", cursor: "pointer", lineHeight: 1.5 }}>
                  <input type="checkbox" checked={overwriteHosts} onChange={(e) => setOverwriteHosts(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>
                    <b>Sobrescribir también las pools donde el HOST ya corrigió manualmente.</b>{" "}
                    Por defecto se respeta el criterio del host de cada pool (se te informa cuántas se respetaron).
                  </span>
                </label>
              </div>

              {error && (
                <div style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#991b1b", fontSize: "0.8rem", marginBottom: 12 }}>
                  ❌ {error}
                </div>
              )}

              {/* Resumen en vivo de lo que se va a aplicar */}
              <div style={{ padding: "10px 12px", background: "#f3f4f6", borderRadius: 10, marginBottom: 14, fontSize: "0.85rem", textAlign: "center" }}>
                {previewParts.length > 0 ? (
                  <>Se aplicará: <b>{previewParts.join(" · ")}</b> a <b>{row.activePools} pools</b></>
                ) : (
                  <span style={{ color: "#9ca3af" }}>Ingresa el marcador final para ver el resumen</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={onClose}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: "2px solid #d1d5db", background: "white", color: "#374151", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}
                >
                  ✕ Cancelar
                </button>
                <button
                  disabled={!canSubmit}
                  onClick={submit}
                  title={submitHint ?? undefined}
                  style={{
                    flex: 2, padding: 12, borderRadius: 10, border: "none", fontWeight: 800, fontSize: "0.85rem",
                    background: canSubmit ? "#9a3412" : "#e5e7eb",
                    color: canSubmit ? "white" : "#9ca3af",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                  }}
                >
                  {busy ? "Aplicando…" : `⚡ Aplicar a ${row.activePools} pools`}
                </button>
              </div>
              {submitHint && (
                <div style={{ marginTop: 8, fontSize: "0.75rem", color: "#9ca3af", textAlign: "center" }}>
                  {submitHint}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  help,
  children,
}: {
  number: number;
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{
          width: 22, height: 22, borderRadius: "50%", background: "#111827", color: "white",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.72rem", fontWeight: 800, flexShrink: 0,
        }}>
          {number}
        </span>
        <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>{title}</span>
      </div>
      <p style={{ fontSize: "0.76rem", color: "#6b7280", margin: "4px 0 12px", lineHeight: 1.55 }}>{help}</p>
      {children}
    </div>
  );
}

function HeaderChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 12, background: "rgba(255,255,255,0.12)",
      fontSize: "0.7rem", fontWeight: 600, color: "#e5e7eb",
    }}>
      {children}
    </span>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 12,
        background: ok ? "#f0fdf4" : "#fef2f2",
        border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
        color: ok ? "#166534" : "#991b1b",
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}
