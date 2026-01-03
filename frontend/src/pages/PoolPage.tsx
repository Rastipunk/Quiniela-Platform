import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createInvite, getPoolOverview, upsertPick, upsertResult, type PoolOverview } from "../lib/api";
import { getToken } from "../lib/auth";

function fmtUtc(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").replace("Z", " UTC");
}

function norm(s: string) {
  return (s ?? "").toLowerCase().trim();
}

function outcomeLabel(o: "HOME" | "DRAW" | "AWAY") {
  if (o === "HOME") return "Gana Local";
  if (o === "DRAW") return "Empate";
  return "Gana Visitante";
}

export function PoolPage() {
  const { poolId } = useParams();
  const token = useMemo(() => getToken(), []);

  const [overview, setOverview] = useState<PoolOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verbose, setVerbose] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // UX filtros (volumen)
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyNoPick, setOnlyNoPick] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyNoResult, setOnlyNoResult] = useState(false);


  // Invite
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  async function load(v: boolean) {
    if (!token || !poolId) return;
    setError(null);
    try {
      const data = await getPoolOverview(token, poolId, v);
      setOverview(data);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    }
  }

  useEffect(() => {
    load(verbose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, verbose]);

  const allowScorePick = useMemo(() => {
    if (!overview) return true;
    // Si backend envía scoringPreset.allowScorePick, lo usamos; si no, fallback por presetKey
    const allow = (overview as any)?.leaderboard?.scoringPreset?.allowScorePick;
    if (typeof allow === "boolean") return allow;
    return overview.pool.scoringPresetKey !== "OUTCOME_ONLY";
  }, [overview]);

  const nextOpenGroup = useMemo(() => {
    if (!overview) return "A";
    const next = overview.matches
      .filter((m) => !m.isLocked)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())[0];
    return next?.groupId ?? "A";
  }, [overview]);

  const filteredMatches = useMemo(() => {
    if (!overview) return [];

    const q = norm(search);

    return overview.matches.filter((m) => {
      if (onlyOpen && m.isLocked) return false;
      if (onlyNoPick && m.myPick) return false;
      if (onlyNoResult && m.result) return false;

      if (q) {
        const ht = norm(m.homeTeam?.name ?? m.homeTeam?.code ?? m.homeTeam?.id ?? "");
        const at = norm(m.awayTeam?.name ?? m.awayTeam?.code ?? m.awayTeam?.id ?? "");
        const round = norm(m.roundLabel ?? "");
        const group = norm(m.groupId ?? "");
        const venue = norm(m.venue ?? "");
        if (![ht, at, round, group, venue].some((x) => x.includes(q))) return false;
      }
      return true;
    });
  }, [overview, onlyOpen, onlyNoPick, search]);

  const matchesByGroup = useMemo(() => {
    const by: Record<string, typeof filteredMatches> = {};
    for (const m of filteredMatches) {
      const g = m.groupId ?? "SIN_GRUPO";
      (by[g] ??= []).push(m);
    }

    // Orden dentro del grupo: por kickoff, luego id
    for (const g of Object.keys(by)) {
      by[g].sort((a, b) => {
        const ta = new Date(a.kickoffUtc).getTime();
        const tb = new Date(b.kickoffUtc).getTime();
        if (ta !== tb) return ta - tb;
        return a.id.localeCompare(b.id);
      });
    }

    return by;
  }, [filteredMatches]);

  const groupOrder = useMemo(() => {
    const keys = Object.keys(matchesByGroup);

    // Orden A-L primero si existen, luego SIN_GRUPO al final
    const priority = "ABCDEFGHIJKL".split("");
    const set = new Set(keys);

    const ordered: string[] = [];
    for (const g of priority) if (set.has(g)) ordered.push(g);

    // agrega los que no estén (por si hay fases sin groupId)
    const rest = keys.filter((k) => !priority.includes(k) && k !== "SIN_GRUPO").sort((a, b) => a.localeCompare(b));
    ordered.push(...rest);

    if (set.has("SIN_GRUPO")) ordered.push("SIN_GRUPO");
    return ordered;
  }, [matchesByGroup]);

  async function onCreateInvite() {
    if (!token || !poolId) return;
    setBusyKey("invite");
    setError(null);
    try {
      const inv = await createInvite(token, poolId);
      setInviteCode(inv.code);
      try {
        await navigator.clipboard.writeText(inv.code);
      } catch {}
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setBusyKey(null);
    }
  }

  async function savePick(matchId: string, pick: any) {
    if (!token || !poolId) return;
    setBusyKey(`pick:${matchId}`);
    setError(null);

      try {
        // ✅ Convertir marcador a números si viene de inputs (suelen llegar como strings)
        let normalizedPick = pick;

        if (pick?.type === "SCORE") {
          const hg = Number(pick.homeGoals);
          const ag = Number(pick.awayGoals);

          if (!Number.isFinite(hg) || !Number.isFinite(ag)) {
            throw new Error("Marcador inválido");
          }

          normalizedPick = { ...pick, homeGoals: hg, awayGoals: ag };
        }

        // ✅ El backend espera { pick: ... }
        await upsertPick(token, poolId, matchId, { pick: normalizedPick });

        await load(verbose);
      } catch (e: any) {
        setError(e?.message ?? "Error");
      } finally {
        setBusyKey(null);
      }
  }


  async function saveResult(matchId: string, input: { homeGoals: number; awayGoals: number; reason?: string }) {
    if (!token || !poolId) return;
    setBusyKey(`res:${matchId}`);
    setError(null);
    try {
      await upsertResult(token, poolId, matchId, input);
      await load(verbose);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setBusyKey(null);
    }
  }

  if (!poolId) return <div style={{ padding: 16 }}>PoolId missing</div>;

  return (
    <div style={{ maxWidth: 1180, margin: "18px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Link to="/">&larr; Dashboard</Link>

        <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#666", fontSize: 12 }}>
          <input type="checkbox" checked={verbose} onChange={(e) => setVerbose(e.target.checked)} />
          Leaderboard verbose
        </label>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fee", border: "1px solid #fbb", color: "#700" }}>
          {error}
        </div>
      )}

      {!overview && !error && <p style={{ marginTop: 16 }}>Cargando overview...</p>}

      {overview && (
        <>
          <h2 style={{ marginTop: 12, marginBottom: 6 }}>{overview.pool.name}</h2>

          <div style={{ color: "#666", fontSize: 12 }}>
            nowUtc: {fmtUtc(overview.nowUtc)} • members: {overview.counts.membersActive} • mi rol:{" "}
            <b>{overview.myMembership.role}</b>
          </div>

          {/* Rules */}
          <div style={{ marginTop: 14, padding: 14, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Reglas</div>
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              <div>
                <b>Preset:</b>{" "}
                {(overview as any)?.leaderboard?.scoringPreset?.name ?? overview.pool.scoringPresetKey ?? "CLASSIC"}
              </div>
              <div style={{ color: "#666" }}>
                {(overview as any)?.leaderboard?.scoringPreset?.description ?? ""}
              </div>
              <div>
                <b>Puntuación:</b> outcome {overview.leaderboard.scoring.outcomePoints} + exact{" "}
                {overview.leaderboard.scoring.exactScoreBonus}
              </div>
              <div>
                <b>Pick permitido:</b> {allowScorePick ? "Marcador (SCORE)" : "Solo outcome (HOME/DRAW/AWAY)"}
              </div>
              <div>
                <b>Deadline:</b> {overview.pool.deadlineMinutesBeforeKickoff} min antes del kickoff • <b>TZ:</b>{" "}
                {overview.pool.timeZone}
              </div>
            </div>
          </div>

          {/* Invite (Host) */}
          {overview.permissions.canInvite && (
            <div style={{ marginTop: 14, padding: 14, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontWeight: 900 }}>Invitaciones</div>
                <button
                  onClick={onCreateInvite}
                  disabled={busyKey === "invite"}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {busyKey === "invite" ? "..." : "Crear código"}
                </button>
              </div>

              {inviteCode && (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <div style={{ color: "#666" }}>Código (copiado si el navegador lo permitió):</div>
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1 }}>{inviteCode}</div>
                </div>
              )}
            </div>
          )}

          {/* UX toolbar */}
          <div style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por equipo / grupo / roundLabel..."
                style={{ flex: "1 1 280px", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
              />
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#444" }}>
                <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
                Solo OPEN
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#444" }}>
                <input type="checkbox" checked={onlyNoPick} onChange={(e) => setOnlyNoPick(e.target.checked)} />
                Sin pick
              </label>
              {overview?.permissions?.canManageResults && (
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#444" }}>
                  <input type="checkbox" checked={onlyNoResult} onChange={(e) => setOnlyNoResult(e.target.checked)} />
                  Solo sin resultado
                </label>
              )}
              <div style={{ fontSize: 12, color: "#666" }}>
                Total: <b>{filteredMatches.length}</b> partidos • Grupo sugerido: <b>{nextOpenGroup}</b>
              </div>
            </div>
          </div>

          {/* Matches by group */}
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {groupOrder.map((g) => (
              <details
                key={g}
                open={g === nextOpenGroup}
                style={{ border: "1px solid #ddd", borderRadius: 14, background: "#fff", padding: 12 }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                  {g === "SIN_GRUPO" ? "Otros" : `Grupo ${g}`} ({matchesByGroup[g]?.length ?? 0})
                </summary>

                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  {matchesByGroup[g].map((m) => {
                    const busyPick = busyKey === `pick:${m.id}`;
                    const busyRes = busyKey === `res:${m.id}`;
                    const isHost = overview.permissions.canManageResults;

                    const pick = m.myPick;
                    const pickIsScore = pick?.type === "SCORE";
                    const pickIsOutcome = pick?.type === "OUTCOME";

                    const defaultHome = pickIsScore ? String(pick.homeGoals ?? "") : "";
                    const defaultAway = pickIsScore ? String(pick.awayGoals ?? "") : "";
                    const defaultOutcome = pickIsOutcome ? (pick.outcome ?? "") : "";

                    const resHome = m.result ? String(m.result.homeGoals) : "";
                    const resAway = m.result ? String(m.result.awayGoals) : "";

                    return (
                      <div key={m.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 15 }}>
                              {m.homeTeam.code ?? m.homeTeam.id} vs {m.awayTeam.code ?? m.awayTeam.id}
                            </div>
                            <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                              {m.roundLabel ?? m.id} • kickoff: {fmtUtc(m.kickoffUtc)} • deadline: {fmtUtc(m.deadlineUtc)}
                            </div>
                          </div>

                          <div style={{ fontSize: 12 }}>
                            {m.isLocked ? (
                              <span style={{ padding: "4px 10px", border: "1px solid #f99", borderRadius: 999 }}>LOCKED</span>
                            ) : (
                              <span style={{ padding: "4px 10px", border: "1px solid #9f9", borderRadius: 999 }}>OPEN</span>
                            )}
                          </div>
                        </div>

                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          {/* Pick */}
                          <div style={{ border: "1px solid #f2f2f2", borderRadius: 12, padding: 12 }}>
                            <div style={{ fontWeight: 800, marginBottom: 8 }}>Mi pick</div>

                            {m.isLocked ? (
                              <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(m.myPick, null, 2)}</pre>
                            ) : allowScorePick ? (
                              <PickScore
                                defaultHome={defaultHome}
                                defaultAway={defaultAway}
                                onSave={(homeGoals, awayGoals) => savePick(m.id, { type: "SCORE", homeGoals, awayGoals })}
                                disabled={busyPick}
                              />
                            ) : (
                              <PickOutcome
                                defaultOutcome={defaultOutcome}
                                onSave={(outcome) => savePick(m.id, { type: "OUTCOME", outcome })}
                                disabled={busyPick}
                              />
                            )}
                          </div>

                          {/* Result + Host */}
                          <div style={{ border: "1px solid #f2f2f2", borderRadius: 12, padding: 12 }}>
                            <div style={{ fontWeight: 800, marginBottom: 8 }}>Resultado</div>
                            <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(m.result, null, 2)}</pre>

                            {isHost && (
                              <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
                                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                                  {m.result ? "Corregir / Actualizar" : "Publicar"} resultado
                                </div>

                                <HostResultEditor
                                  defaultHome={resHome}
                                  defaultAway={resAway}
                                  requireReason={!!m.result}
                                  onSave={(homeGoals, awayGoals, reason) =>
                                    saveResult(m.id, {
                                      homeGoals,
                                      awayGoals,
                                      ...(reason ? { reason } : {}),
                                    })
                                  }
                                  disabled={busyRes}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {verbose && (
                          <details style={{ marginTop: 10 }}>
                            <summary>Debug JSON</summary>
                            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(m, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>

          {/* Leaderboard */}
          <div style={{ marginTop: 14, padding: 14, border: "1px solid #ddd", borderRadius: 14, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div style={{ fontWeight: 900 }}>Leaderboard</div>
              <div style={{ color: "#666", fontSize: 12 }}>
                scoring: {overview.leaderboard.scoring.outcomePoints} + {overview.leaderboard.scoring.exactScoreBonus}
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {overview.leaderboard.rows.map((r) => (
                <div key={r.userId} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        #{r.rank} {r.displayName} ({r.role})
                      </div>
                      <div style={{ color: "#666", fontSize: 12 }}>
                        points: {r.points} • scoredMatches: {r.scoredMatches}
                      </div>
                    </div>
                    <div style={{ color: "#666", fontSize: 12 }}>{fmtUtc(r.joinedAtUtc)}</div>
                  </div>

                  {verbose && (r as any).breakdown && (
                    <details style={{ marginTop: 10 }}>
                      <summary>Breakdown</summary>
                      <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify((r as any).breakdown, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PickScore(props: {
  defaultHome: string;
  defaultAway: string;
  disabled: boolean;
  onSave: (homeGoals: number, awayGoals: number) => void;
}) {
  const [home, setHome] = useState(props.defaultHome);
  const [away, setAway] = useState(props.defaultAway);

  useEffect(() => setHome(props.defaultHome), [props.defaultHome]);
  useEffect(() => setAway(props.defaultAway), [props.defaultAway]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="number"
          min={0}
          value={home}
          onChange={(e) => setHome(e.target.value)}
          style={{ width: 90, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <span style={{ fontWeight: 900 }}>-</span>
        <input
          type="number"
          min={0}
          value={away}
          onChange={(e) => setAway(e.target.value)}
          style={{ width: 90, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
      </div>

      <button
        disabled={props.disabled}
        onClick={() => props.onSave(Number(home), Number(away))}
        style={{
          padding: 10,
          borderRadius: 12,
          border: "1px solid #111",
          background: "#111",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        {props.disabled ? "..." : "Guardar pick"}
      </button>
    </div>
  );
}

function PickOutcome(props: {
  defaultOutcome: string;
  disabled: boolean;
  onSave: (outcome: "HOME" | "DRAW" | "AWAY") => void;
}) {
  const [outcome, setOutcome] = useState<string>(props.defaultOutcome);

  useEffect(() => setOutcome(props.defaultOutcome), [props.defaultOutcome]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
      >
        <option value="">Selecciona...</option>
        <option value="HOME">{outcomeLabel("HOME")}</option>
        <option value="DRAW">{outcomeLabel("DRAW")}</option>
        <option value="AWAY">{outcomeLabel("AWAY")}</option>
      </select>

      <button
        disabled={props.disabled || !outcome}
        onClick={() => props.onSave(outcome as any)}
        style={{
          padding: 10,
          borderRadius: 12,
          border: "1px solid #111",
          background: "#111",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        {props.disabled ? "..." : "Guardar pick"}
      </button>
    </div>
  );
}

function HostResultEditor(props: {
  defaultHome: string;
  defaultAway: string;
  requireReason: boolean;
  disabled: boolean;
  onSave: (homeGoals: number, awayGoals: number, reason?: string) => void;
}) {
  const [home, setHome] = useState(props.defaultHome);
  const [away, setAway] = useState(props.defaultAway);
  const [reason, setReason] = useState("");

  useEffect(() => setHome(props.defaultHome), [props.defaultHome]);
  useEffect(() => setAway(props.defaultAway), [props.defaultAway]);

  const needReason = props.requireReason && reason.trim().length === 0;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="number"
          min={0}
          value={home}
          onChange={(e) => setHome(e.target.value)}
          style={{ width: 90, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <span style={{ fontWeight: 900 }}>-</span>
        <input
          type="number"
          min={0}
          value={away}
          onChange={(e) => setAway(e.target.value)}
          style={{ width: 90, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
      </div>

      {props.requireReason && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (obligatorio para errata)"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
      )}

      <button
        disabled={props.disabled || (props.requireReason && needReason)}
        onClick={() => props.onSave(Number(home), Number(away), props.requireReason ? reason.trim() : undefined)}
        style={{
          padding: 10,
          borderRadius: 12,
          border: "1px solid #111",
          background: "#111",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        {props.disabled ? "..." : props.requireReason ? "Guardar corrección" : "Publicar resultado"}
      </button>

      {props.requireReason && needReason && (
        <div style={{ fontSize: 12, color: "#b00" }}>Para corregir un resultado, el reason es obligatorio.</div>
      )}
    </div>
  );
}
