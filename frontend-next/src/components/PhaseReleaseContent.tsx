"use client";

/**
 * Admin "Desbloqueo de fases" panel (ADR-084).
 *
 * Per knockout phase, shows the FIFA-computed bracket (teams + date/time),
 * editable per match (team / date / time), and lets the admin RELEASE the phase
 * (opens predictions). Edits persist as instance overrides and win at publish.
 * Admin-only (the API requires ADMIN). First version — cross-pool propagation +
 * player email ship next.
 */

import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { colors, radii } from "@/lib/theme";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Team { id: string; name: string; groupId?: string }
interface BMatch {
  matchId: string; phaseId: string; kickoffUtc: string | null;
  homeId: string; awayId: string; homeName: string; awayName: string;
  homePending: boolean; awayPending: boolean;
}
interface BPhase {
  phaseId: string; name: string; order: number;
  groupStageFinalized: boolean; released: boolean; matches: BMatch[];
}
interface Preview {
  instanceId: string; instanceName: string; gateEnabled: boolean;
  phases: BPhase[]; teams: Team[]; groupProgress: { finalized: number; total: number };
}
interface InstanceRow { id: string; name: string; status: string; isTest?: boolean }
type Edit = { homeId?: string; awayId?: string; kickoffUtc?: string };

async function adminFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}`, ...(opts.headers ?? {}) },
    credentials: "include",
  });
}

// Split/join an ISO timestamp into UTC date + time inputs.
function isoToParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}
function partsToIso(date: string, time: string): string | undefined {
  if (!date || !time) return undefined;
  const iso = new Date(`${date}T${time}:00.000Z`);
  return Number.isNaN(iso.getTime()) ? undefined : iso.toISOString();
}
function fmtCol(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota", weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(d);
}

export default function PhaseReleaseContent() {
  const [instances, setInstances] = useState<InstanceRow[] | null>(null);
  const [instanceId, setInstanceId] = useState<string>("");
  const [data, setData] = useState<Preview | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load instances + default-select the first ACTIVE non-test one (the WC).
  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch("/admin/instances");
        if (!res.ok) { setError(`No se pudo cargar instancias (HTTP ${res.status}${res.status === 403 ? " — se requiere ADMIN" : ""})`); return; }
        const list: InstanceRow[] = (await res.json()).instances ?? [];
        setInstances(list);
        const def = list.find((i) => i.status === "ACTIVE" && !i.isTest) ?? list[0];
        if (def) setInstanceId(def.id);
      } catch (e) { setError(e instanceof Error ? e.message : "Error de red"); }
    })();
  }, []);

  const loadBrackets = useCallback(async (id: string) => {
    setError(null); setMsg(null);
    try {
      const res = await adminFetch(`/admin/instances/${id}/knockout-brackets`);
      if (!res.ok) { setError(`No se pudo cargar el bracket (HTTP ${res.status})`); return; }
      setData(await res.json());
      setEdits({});
    } catch (e) { setError(e instanceof Error ? e.message : "Error de red"); }
  }, []);

  useEffect(() => { if (instanceId) loadBrackets(instanceId); }, [instanceId, loadBrackets]);

  const setEdit = (matchId: string, patch: Edit) =>
    setEdits((prev) => ({ ...prev, [matchId]: { ...prev[matchId], ...patch } }));

  const homeOf = (m: BMatch) => edits[m.matchId]?.homeId ?? m.homeId;
  const awayOf = (m: BMatch) => edits[m.matchId]?.awayId ?? m.awayId;
  const kickoffOf = (m: BMatch) => edits[m.matchId]?.kickoffUtc ?? m.kickoffUtc;

  const savePhase = async (phase: BPhase) => {
    if (!data) return;
    const overrides: Record<string, Edit> = {};
    for (const m of phase.matches) {
      const e = edits[m.matchId];
      if (!e) continue;
      // map UI keys → API keys (homeId/awayId → homeTeamId/awayTeamId)
      const api: Record<string, string> = {};
      if (e.homeId !== undefined) api.homeTeamId = e.homeId;
      if (e.awayId !== undefined) api.awayTeamId = e.awayId;
      if (e.kickoffUtc !== undefined) api.kickoffUtc = e.kickoffUtc;
      if (Object.keys(api).length) overrides[m.matchId] = api as Edit;
    }
    if (!Object.keys(overrides).length) { setMsg("No hay cambios en esta fase."); return; }
    setBusy(`save-${phase.phaseId}`); setMsg(null); setError(null);
    try {
      const res = await adminFetch(`/admin/instances/${data.instanceId}/knockout-brackets/overrides`, {
        method: "POST", body: JSON.stringify({ overrides }),
      });
      if (!res.ok) { setError(`Guardado falló (HTTP ${res.status})`); return; }
      setMsg(`✅ Cambios guardados en ${phase.name}.`);
      await loadBrackets(data.instanceId);
    } finally { setBusy(null); }
  };

  const toggleRelease = async (phase: BPhase) => {
    if (!data) return;
    setBusy(`rel-${phase.phaseId}`); setMsg(null); setError(null);
    try {
      const res = await adminFetch(`/admin/instances/${data.instanceId}/knockout-phases/${encodeURIComponent(phase.phaseId)}/release`, {
        method: "POST", body: JSON.stringify({ released: !phase.released }),
      });
      if (!res.ok) { setError(`Acción falló (HTTP ${res.status})`); return; }
      setMsg(phase.released ? `🔒 ${phase.name} re-bloqueada.` : `🟢 ${phase.name} liberada — los jugadores ya pueden predecir.`);
      await loadBrackets(data.instanceId);
    } finally { setBusy(null); }
  };

  const toggleGate = async () => {
    if (!data) return;
    setBusy("gate"); setMsg(null); setError(null);
    try {
      const res = await adminFetch(`/admin/instances/${data.instanceId}/knockout-gate`, {
        method: "POST", body: JSON.stringify({ enabled: !data.gateEnabled }),
      });
      if (!res.ok) { setError(`Acción falló (HTTP ${res.status})`); return; }
      await loadBrackets(data.instanceId);
    } finally { setBusy(null); }
  };

  const sendSummaryTest = async () => {
    setBusy("summary"); setMsg(null); setError(null);
    try {
      const res = await adminFetch(`/admin/phase-summary-test`, { method: "POST", body: "{}" });
      if (!res.ok) { setError(`Envío falló (HTTP ${res.status})`); return; }
      const r = await res.json();
      setMsg(r.sent ? `📧 Correo de resumen enviado a tu correo (pool: ${r.poolName}).` : `❌ No se envió: ${r.error ?? "error"}`);
    } catch {
      setError("Error de red al enviar el correo de prueba.");
    } finally { setBusy(null); }
  };

  const teams = (data?.teams ?? []).slice().sort((a, b) =>
    (a.groupId ?? "").localeCompare(b.groupId ?? "") || a.name.localeCompare(b.name));

  const teamSelect = (m: BMatch, side: "home" | "away") => {
    const value = side === "home" ? homeOf(m) : awayOf(m);
    const pending = side === "home" ? m.homePending : m.awayPending;
    const known = teams.some((t) => t.id === value);
    return (
      <select
        value={known ? value : ""}
        onChange={(e) => setEdit(m.matchId, side === "home" ? { homeId: e.target.value } : { awayId: e.target.value })}
        style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${colors.borderMedium}`, fontSize: 13, maxWidth: 180, color: pending && !known ? colors.textMuted : colors.textDark }}
      >
        {!known && <option value="">{pending ? "Por definir…" : value}</option>}
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.groupId ? `${t.groupId} · ` : ""}{t.name}</option>
        ))}
      </select>
    );
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.brand, marginBottom: 4 }}>🗂️ Desbloqueo de fases</h1>
      <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 12 }}>
        Revisa los brackets calculados (reglas FIFA), edítalos si hace falta y libera cada ronda cuando estés conforme.
      </p>

      <button onClick={sendSummaryTest} disabled={busy === "summary"}
        style={{ marginBottom: 16, padding: "8px 14px", borderRadius: 8, border: `1px solid ${colors.brand}`, background: "#fff", color: colors.brand, fontWeight: 700, cursor: busy === "summary" ? "wait" : "pointer", fontSize: 13 }}>
        {busy === "summary" ? "Enviando…" : "📧 Enviarme un correo de resumen de prueba"}
      </button>

      {instances && instances.length > 1 && (
        <select value={instanceId} onChange={(e) => setInstanceId(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${colors.borderMedium}`, marginBottom: 16, fontSize: 14 }}>
          {instances.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.status})</option>)}
        </select>
      )}

      {error && <div style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#991b1b", marginBottom: 12 }}>{error}</div>}
      {msg && <div style={{ padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, color: "#166534", marginBottom: 12 }}>{msg}</div>}

      {!data && !error && <div style={{ color: colors.textMuted }}>Cargando…</div>}

      {data && (
        <>
          {/* Master gate toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", background: colors.bgLighter, border: `1px solid ${colors.borderLight}`, borderRadius: radii.lg, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, color: colors.textDark }}>Control de fases {data.gateEnabled ? "ACTIVO" : "inactivo"}</div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                {data.gateEnabled
                  ? "Las fases de eliminación están cerradas a predicciones hasta que las liberes."
                  : "Inactivo: las predicciones de eliminación funcionan como siempre (sin control)."}
              </div>
            </div>
            <button onClick={toggleGate} disabled={busy === "gate"}
              style={{ padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 700, color: "#fff", background: data.gateEnabled ? colors.textMuted : colors.brand }}>
              {data.gateEnabled ? "Desactivar control" : "Activar control"}
            </button>
          </div>

          {data.groupProgress.finalized < data.groupProgress.total && (
            <div style={{ padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, color: "#92400e", fontSize: 13, marginBottom: 16 }}>
              ⏳ Fase de grupos: {data.groupProgress.finalized}/{data.groupProgress.total} finalizados. Los equipos de 32avos son <strong>provisionales</strong> hasta que terminen todos.
            </div>
          )}

          {data.phases.map((phase) => (
            <div key={phase.phaseId} style={{ border: `1px solid ${colors.borderLight}`, borderRadius: radii.lg, marginBottom: 16, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 14px", background: phase.released ? "#f0fdf4" : colors.bgLighter, borderBottom: `1px solid ${colors.borderLight}` }}>
                <div style={{ fontWeight: 800, color: colors.textDark }}>
                  {phase.name}{" "}
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: phase.released ? "#86efac" : "#fcd34d", color: phase.released ? "#14532d" : "#78350f" }}>
                    {phase.released ? "LIBERADA" : "BLOQUEADA"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => savePhase(phase)} disabled={busy === `save-${phase.phaseId}`}
                    style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${colors.brand}`, background: "#fff", color: colors.brand, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    {busy === `save-${phase.phaseId}` ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button onClick={() => toggleRelease(phase)} disabled={busy === `rel-${phase.phaseId}`}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: phase.released ? colors.textMuted : colors.brand, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    {phase.released ? "Re-bloquear" : "Liberar ronda"}
                  </button>
                </div>
              </div>
              <div style={{ padding: 6 }}>
                {phase.matches.map((m) => {
                  const { date, time } = isoToParts(kickoffOf(m));
                  return (
                    <div key={m.matchId} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 10px", borderBottom: `1px solid ${colors.borderLighter}` }}>
                      {teamSelect(m, "home")}
                      <span style={{ color: colors.textMuted, fontWeight: 700, fontSize: 12 }}>vs</span>
                      {teamSelect(m, "away")}
                      <span style={{ flex: 1 }} />
                      <input type="date" value={date} onChange={(e) => setEdit(m.matchId, { kickoffUtc: partsToIso(e.target.value, time) })}
                        style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${colors.borderMedium}`, fontSize: 13 }} />
                      <input type="time" value={time} onChange={(e) => setEdit(m.matchId, { kickoffUtc: partsToIso(date, e.target.value) })}
                        style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${colors.borderMedium}`, fontSize: 13 }} />
                      <span style={{ fontSize: 11, color: colors.textMuted }}>UTC</span>
                      {kickoffOf(m) && (
                        <span style={{ fontSize: 12, color: colors.brand, fontWeight: 600, whiteSpace: "nowrap" }}>
                          🇨🇴 {fmtCol(kickoffOf(m))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
