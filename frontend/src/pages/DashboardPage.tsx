import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createPool,
  getMePools,
  joinPool,
  listCatalogInstances,
  type CatalogInstance,
  type MePoolRow,
  type ScoringPresetKey,
} from "../lib/api";
import { clearToken, getToken } from "../lib/auth";

const PRESETS: Array<{ key: ScoringPresetKey; label: string; help: string }> = [
  { key: "CLASSIC", label: "Clásico (3 + 2)", help: "3 por outcome + 2 por exacto" },
  { key: "OUTCOME_ONLY", label: "Solo outcome (3 + 0)", help: "Solo ganador/empate" },
  { key: "EXACT_HEAVY", label: "Exacto pesado (2 + 3)", help: "Outcome vale menos, exacto vale más" },
];

function detectTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Bogota";
  } catch {
    return "America/Bogota";
  }
}

export function DashboardPage() {
  const navigate = useNavigate();

  const token = useMemo(() => getToken(), []);

  const [rows, setRows] = useState<MePoolRow[] | null>(null);
  const [instances, setInstances] = useState<CatalogInstance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [panel, setPanel] = useState<"NONE" | "CREATE" | "JOIN">("NONE");

  // Create form
  const [instanceId, setInstanceId] = useState<string>("");
  const [poolName, setPoolName] = useState("");
  const [poolDesc, setPoolDesc] = useState("");
  const [preset, setPreset] = useState<ScoringPresetKey>("CLASSIC");
  const [deadline, setDeadline] = useState<number>(10);
  const [timeZone, setTimeZone] = useState<string>(detectTz());

  // Join form
  const [inviteCode, setInviteCode] = useState("");

  const [busy, setBusy] = useState(false);

  async function loadAll() {
    if (!token) return;
    setError(null);
    try {
      const [pools, inst] = await Promise.all([getMePools(token), listCatalogInstances(token)]);
      setRows(pools);
      setInstances(inst);

      // default instance selection
      if (!instanceId && inst.length) setInstanceId(inst[0].id);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    if (!token) return;
    if (!instanceId) return setError("Selecciona un torneo/instancia.");
    if (poolName.trim().length < 3) return setError("Nombre de pool: mínimo 3 caracteres.");

    setBusy(true);
    setError(null);

    try {
      const created = await createPool(token, {
        tournamentInstanceId: instanceId,
        name: poolName.trim(),
        description: poolDesc.trim() ? poolDesc.trim() : undefined,
        timeZone,
        deadlineMinutesBeforeKickoff: deadline,
        scoringPresetKey: preset,
      });

      setPanel("NONE");
      await loadAll();
      navigate(`/pools/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    if (!token) return;
    if (!inviteCode.trim()) return setError("Escribe un código de invitación.");

    setBusy(true);
    setError(null);

    try {
      const res = await joinPool(token, inviteCode.trim());
      setPanel("NONE");
      await loadAll();
      navigate(`/pools/${res.poolId}`);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Mis Pools</h2>
          <div style={{ color: "#666", fontSize: 12 }}>Crear / Unirse / Entrar a una pool</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPanel("CREATE")} style={{ padding: "10px 12px", borderRadius: 10 }}>
            + Crear pool
          </button>
          <button onClick={() => setPanel("JOIN")} style={{ padding: "10px 12px", borderRadius: 10 }}>
            Unirme con código
          </button>
          <button
            onClick={() => {
              clearToken();
              window.location.href = "/";
            }}
            style={{ padding: "10px 12px", borderRadius: 10 }}
          >
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fee", border: "1px solid #fbb" }}>
          {error}
        </div>
      )}

      {!rows && !error && <p style={{ marginTop: 18 }}>Cargando...</p>}

      {rows && (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.poolId} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ fontWeight: 800 }}>{r.pool.name}</div>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: "1px solid #ddd",
                        background: r.role === "HOST" ? "#111" : "#fff",
                        color: r.role === "HOST" ? "#fff" : "#111",
                      }}
                    >
                      {r.role}
                    </span>
                  </div>

                  <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                    TZ: {r.pool.timeZone} • Deadline: {r.pool.deadlineMinutesBeforeKickoff}m • Preset:{" "}
                    {r.pool.scoringPresetKey ?? "CLASSIC"}
                  </div>

                  {r.tournamentInstance && (
                    <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>
                      Torneo: {r.tournamentInstance.name} ({r.tournamentInstance.status})
                    </div>
                  )}
                </div>

                <Link to={`/pools/${r.poolId}`} style={{ textDecoration: "none" }}>
                  Abrir →
                </Link>
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div style={{ padding: 14, border: "1px dashed #ccc", borderRadius: 14, color: "#666" }}>
              Aún no estás en ninguna pool. Crea una o únete con un código.
            </div>
          )}
        </div>
      )}

      {/* Panel */}
      {panel !== "NONE" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPanel("NONE")}
        >
          <div
            style={{ width: "min(720px, 100%)", background: "#fff", borderRadius: 16, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 900 }}>{panel === "CREATE" ? "Crear pool" : "Unirme a una pool"}</div>
              <button onClick={() => setPanel("NONE")} style={{ borderRadius: 10 }}>
                Cerrar
              </button>
            </div>

            {panel === "CREATE" && (
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#444" }}>Torneo / Instancia</span>
                  <select
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    {(instances ?? []).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.status})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#444" }}>Nombre de la pool</span>
                  <input
                    value={poolName}
                    onChange={(e) => setPoolName(e.target.value)}
                    placeholder="Ej: Quiniela con amigos"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#444" }}>Descripción (opcional)</span>
                  <input
                    value={poolDesc}
                    onChange={(e) => setPoolDesc(e.target.value)}
                    placeholder="Reglas rápidas o contexto"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#444" }}>Preset de puntuación</span>
                    <select
                      value={preset}
                      onChange={(e) => setPreset(e.target.value as any)}
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      {PRESETS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: 12, color: "#666" }}>
                      {PRESETS.find((p) => p.key === preset)?.help}
                    </span>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#444" }}>Deadline (min antes del kickoff)</span>
                    <input
                      type="number"
                      value={deadline}
                      min={0}
                      max={1440}
                      onChange={(e) => setDeadline(Number(e.target.value))}
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                  </label>
                </div>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#444" }}>Time Zone</span>
                  <input
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                    placeholder="America/Bogota"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>

                <button
                  onClick={onCreate}
                  disabled={busy}
                  style={{
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {busy ? "Creando..." : "Crear pool"}
                </button>
              </div>
            )}

            {panel === "JOIN" && (
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#444" }}>Código de invitación</span>
                  <input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Ej: ABC123"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>

                <button
                  onClick={onJoin}
                  disabled={busy}
                  style={{
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {busy ? "Uniéndome..." : "Unirme"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
