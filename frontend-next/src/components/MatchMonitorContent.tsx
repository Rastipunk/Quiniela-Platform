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

export default function MatchMonitorContent() {
  const [rows, setRows] = useState<MonitorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string>("");

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
