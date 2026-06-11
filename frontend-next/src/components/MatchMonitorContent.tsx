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
    width: 56, padding: 8, borderRadius: 8, border: "1px solid #d1d5db",
    textAlign: "center", fontSize: 18, fontWeight: 700,
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "white", borderRadius: 14, padding: 20, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>⚡ Override master</h2>
        <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "6px 0 14px" }}>
          {row.homeTeamName} vs {row.awayTeamName} — se aplica como <b>HOST_OVERRIDE</b> a las{" "}
          <b>{row.activePools} pools activas</b> de {row.instanceName}. El scraper no podrá
          sobreescribirlo. Sin emails a miembros.
        </p>

        {summary ? (
          <div style={{ fontSize: "0.85rem" }}>
            <div style={{ padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, marginBottom: 12 }}>
              ✅ <b>{summary.updated}</b> pools actualizadas · {summary.unchanged} sin cambios ·{" "}
              {summary.skippedHostOverride.length} respetadas (override de host) ·{" "}
              {summary.failed.length} fallidas
            </div>
            {summary.failed.length > 0 && (
              <div style={{ padding: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, marginBottom: 12, color: "#991b1b" }}>
                Fallidas: {summary.failed.map((f) => f.poolId.slice(0, 8)).join(", ")}
              </div>
            )}
            <button onClick={onApplied} style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: "#111", color: "white", fontWeight: 700, cursor: "pointer" }}>
              Cerrar y refrescar
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{row.homeTeamName}</span>
              <input type="number" min={0} value={homeGoals} onChange={(e) => setHomeGoals(e.target.value)} style={inputStyle} />
              <span style={{ fontWeight: 900 }}>-</span>
              <input type="number" min={0} value={awayGoals} onChange={(e) => setAwayGoals(e.target.value)} style={inputStyle} />
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{row.awayTeamName}</span>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", marginBottom: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={wentToExtraTime} onChange={(e) => setWentToExtraTime(e.target.checked)} />
              El partido tuvo prórroga (capturar marcador al 90&apos;)
            </label>
            {wentToExtraTime && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8, padding: 10, background: "#f9fafb", borderRadius: 8 }}>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>90&apos;:</span>
                <input type="number" min={0} value={homeGoals90} onChange={(e) => setHomeGoals90(e.target.value)} style={inputStyle} />
                <span style={{ fontWeight: 900 }}>-</span>
                <input type="number" min={0} value={awayGoals90} onChange={(e) => setAwayGoals90(e.target.value)} style={inputStyle} />
              </div>
            )}
            {et90Invalid && (
              <div style={{ fontSize: "0.75rem", color: "#dc2626", marginBottom: 8 }}>
                Con prórroga, ambos marcadores del 90&apos; son obligatorios y no pueden superar al final.
              </div>
            )}

            {isDraw && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8, padding: 10, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8 }}>
                <span style={{ fontSize: "0.75rem", color: "#92400e" }}>Penales:</span>
                <input type="number" min={0} value={homePens} onChange={(e) => setHomePens(e.target.value)} style={inputStyle} />
                <span style={{ fontWeight: 900 }}>-</span>
                <input type="number" min={0} value={awayPens} onChange={(e) => setAwayPens(e.target.value)} style={inputStyle} />
              </div>
            )}

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Razón del override (obligatoria, mín. 5 caracteres) — queda en la auditoría"
              rows={2}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.85rem", boxSizing: "border-box", marginBottom: 8 }}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", color: "#9a3412", marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={overwriteHosts} onChange={(e) => setOverwriteHosts(e.target.checked)} />
              Sobrescribir también pools donde el HOST ya hizo su propio override
            </label>

            {error && (
              <div style={{ padding: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: "0.78rem", marginBottom: 10 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                disabled={!canSubmit}
                onClick={submit}
                style={{
                  flex: 2, padding: 10, borderRadius: 8, border: "none", fontWeight: 800,
                  background: canSubmit ? "#9a3412" : "#e5e7eb",
                  color: canSubmit ? "white" : "#9ca3af",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}
              >
                {busy ? "Aplicando…" : `Aplicar a ${row.activePools} pools`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
