# Brief para la sesión de Picks4All — blindaje post-incidente Inglaterra–Congo (2026-07-02)

> **Audiencia:** la sesión de Claude que trabaja en ESTE repo (Quiniela-Platform).
> **Autor:** la sesión del repo `picks4all-scores`, tras el post-mortem del segundo incidente de
> falso FINISHED (Inglaterra–Congo, 2026-07-01; el primero fue Argentina–Argelia, 2026-06-17).
> **Regla:** todo lo afirmado aquí está verificado contra la DB de producción (read-only) o contra
> `archivo:línea` de TU repo al 2026-07-02. Cero suposiciones. Verifica tú mismo antes de actuar.
> **Cómo usarlo:** lee entero. §1 te dice qué pasó. §2 qué ya está corregido del lado scraper (no
> lo dupliques). §3 son TUS acciones, en orden. §4 es el checklist de verificación final.

---

## 1. Qué pasó (resumen con evidencia)

**Inglaterra vs R.D. del Congo** (`m_R32_8`, fixture 958431, kickoff 2026-07-01 16:00 UTC):

1. A las **17:09:48** (minuto 47, en el descanso, marcador real 0-1) la fuente `365scores` emitió un
   **FT espurio**. El consenso del scraper NO protegía el status terminal: el FT de **1 sola fuente**
   ganó el desempate y el store monotónico lo congeló irreversible. Evidencia:
   `MatchSyncState.lastLiveDataJson.timeline` → hito `FT` con `confirmedBy: ["365scores"]`, min 47.
2. Durante **~52 minutos** (17:09→18:01) la plataforma mostró "FINISHED 0-1" mientras se jugaba el
   segundo tiempo real (Inglaterra remontó 2-1), y el congelamiento cegó TODAS las actualizaciones.
3. **Tu guard SÍ funcionó:** `MIN_ELAPSED_FOR_TERMINAL=80` (`liveScoresJob.ts:225-240`) bloqueó la
   auto-finalización todo el partido — `elapsed 47 < 80` → cero `API_CONFIRMED` del sistema, cero
   eventos `RESULT_FINALIZED_BY_SCRAPER` en el audit.
4. El cierre fue **manual**: master override 2-1 a las 18:01:13 (465 pools, v3 `HOST_OVERRIDE`); el
   `MatchSyncState.COMPLETED` de las 18:01:19 lo escribió el propio override
   (`matchMonitorService.ts:392-399`), no el gate.

**Es el MISMO bug raíz de Argentina–Argelia (17-jun).** La diferencia: en Argentina tu backend aún
no tenía el guard de minuto y auto-finalizó (`API_CONFIRMED` falso en 409 pools); en Inglaterra el
guard aguantó y el daño quedó en display congelado + cierre manual.

**Lección de proceso que nos aplica a ambos:** del plan acordado el 17-jun, lo único que llegó a
producción fue tu guard de emergencia. El gate del scraper y tu rediseño R1–R14 quedaron SOLO como
documento — por eso reincidió. **Nada se considera corregido sin commit + test + deploy verificado.**

---

## 2. Qué YA se corrigió del lado scraper (2026-07-02 — NO lo dupliques, cuenta con ello)

Desplegado y verificado en producción a las 13:16 UTC (commit `a9c85d2` de picks4all-scores):

**Gate de status terminal** (`src/consensus/terminal-gate.ts` + integración en el scheduler): un
status TERMINAL (FT/ABD) ya no se publica ni congela salvo que cumpla LAS TRES:

1. **Mínimo de fuentes relativo a la flota:** respaldo ≥ `clamp(ceil(agreeing/2), 2, agreeing)`.
   **Una sola fuente jamás vuelve a declarar un terminal** (aplica a FINISHED y CANCELLED).
2. **Minuto plausible (solo FINISHED):** minuto consensuado ≥ 80 (`MIN_MINUTE_FOR_TERMINAL`,
   alineado con tu `MIN_ELAPSED_FOR_TERMINAL`). ABD exento (abandono temprano legítimo).
3. **Histéresis:** sin mayoría amplia (≥ ⅔ del grupo), el terminal debe persistir 2 ciclos
   consecutivos (~30-60s) — un glitch de un ciclo desaparece solo.

Cuando el gate bloquea, el resultado se **degrada al último status en vivo y el marcador sigue
fluyendo** (muere también el síntoma "partido congelado sin updates"), y queda `log.warn
"TERMINAL GATE: ... blocked"` en los logs del scraper. 13 tests reproducen ambos incidentes.

**Qué significa para ti (contrato, sin cambios de forma):**
- Un `status` terminal que te llegue por `/scores/live` ahora **se ganó el congelamiento**: ≥2
  fuentes (mínimo relativo), minuto plausible y persistencia. El `confirmedBy` del hito terminal del
  `timeline[]` ya no puede ser 1.
- Las garantías previas se mantienen: el status nunca retrocede; un terminal sigue siendo definitivo.
- Costo: un cierre legítimo con mayoría estrecha puede tardar ~30-60s más. Nada que debas cambiar.
- Ambos incidentes habrían sido bloqueados por 2 de las 3 reglas cada uno.

---

## 3. TUS ACCIONES (analiza, decide con el owner donde se indique, implementa)

### A1 — P0 · Tu rediseño R1–R14 sigue sin existir (verificado por grep el 2026-07-02)

El plan que tu owner aprobó el 17-jun ("el backend nunca juzga el marcador ni cuenta fuentes;
confía en `confidence` + plausibilidad") **no está en el código**: no hay rastro de R9/R11/camino
lento en `backend/src`; lo único que existe es el guard `MIN_ELAPSED_FOR_TERMINAL` y el conteo
viejo. Audita tú mismo y ejecuta tu plan:

- **Gate de finalización según tu diseño:** rápido = terminal + minuto plausible (R1) + confidence
  HIGH/VERY_HIGH → finaliza; lento (anti-atasco) = terminal + plausible + mucho tiempo transcurrido
  + confidence ≥ MEDIUM → finaliza + alerta R9. Si no → espera; stale detector (R12) de respaldo.
- **Elimina `Math.max(entry.confirmedBy.length, sourcesAgreeing)` en
  `services/scoresService/timeline.ts:55`** — verificado HOY que sigue vivo. Fue la causa de la
  auto-finalización falsa de Argentina (contaba acuerdo de MARCADOR como confirmación de
  finalización). Tu rediseño lo reemplaza por confidence; hazlo según tu plan, no lo parches.
- **R11 — "finalizado pero el feed lo da en vivo":** el escaneo + alerta (con reversión opcional
  tras interruptor). Es tu detector para la clase de incidente que ya ocurrió dos veces.
- Resto de reglas de alerta de tu lista: R2-R6 (incoherencias/regresiones — solo alerta),
  R13 (drift de horario → convertir el log de `liveScoresJob.ts:199-205` en alerta),
  R14 (partido en ventana atascado en LOW/NONE → alerta).
- **El canal de correo (tu Step 1)** si aún no existe.

### A2 — P1 · Higiene de mappings de eliminatorias (bug verificado, dato corrupto real)

`MatchExternalMapping` de `m_R32_8` (Inglaterra–Congo) tiene `apiFootballAwayTeamId: 1504`
(**Ghana**) cuando el rival real fue **Congo (1508)** — los mappings de knockout creados el
2026-06-28 02:43 se generaron con el bracket PREVISTO, no el real. Hoy es benigno (el scraper
matchea por NOMBRE, y los nombres del dataJson eran correctos), pero es dato corrupto esperando
morder a cualquier código futuro que confíe en esos IDs.
- Audita TODOS los mappings de R32/R16+ contra el dataJson real.
- Corrige el generador para regenerar/validar teamIds cuando cada llave se resuelve.

### A3 — P1 · Inicialización inconsistente de MatchSyncState en eliminatorias (verificado)

Dos observaciones de producción que se contradicen entre sí:
- 2026-06-28: `m_R32_1` (Sudáfrica–Canadá) NO tenía fila `MatchSyncState` (0 rows).
- 2026-07-01: `m_R32_8` (Inglaterra–Congo) SÍ la tenía.

Sin esa fila, `trackStatusCheckerJob` y `staleDetector` **no ven el partido** (sus queries parten de
`matchSyncState`). Averigua qué crea las filas para partidos de eliminatoria, por qué es
inconsistente, y garantiza que TODA llave resuelta tenga su fila antes del kickoff.

### A4 — P2 · Escenario E2 a vigilar (no cubierto al 100% por nadie)

FT espurio a minuto ≥ 80: p. ej. el minuto 90 de una eliminatoria empatada que va a prórroga (los
feeds a veces muestran "FT" transitorio antes del ET). Tu guard de minuto lo deja pasar (90 ≥ 80);
del lado scraper lo frenan el mínimo de fuentes y la histéresis (un blip de transición no persiste),
pero es la ranura residual más probable. Mitigación tuya: R11 + mantener tu guard como defensa en
profundidad. En los logs del scraper, cada bloqueo deja `TERMINAL GATE: ... blocked` — si el owner
reporta algo raro en un partido con prórroga, ahí está la primera pista.

---

## 4. Checklist de verificación final (cuando termines A1)

- [ ] Un FT legítimo (confidence HIGH+, minuto ≥ 80) finaliza solo por el camino rápido.
- [ ] Un FT con confidence MEDIUM finaliza solo por el camino lento + alerta R9.
- [ ] `timeline.ts` ya no contiene `Math.max(` sobre `confirmedBy`/`sourcesAgreeing`.
- [ ] R11 detecta un "finalizado pero feed en vivo" simulado y alerta.
- [ ] Todos los mappings de knockout tienen teamIds correctos vs dataJson.
- [ ] Toda llave de knockout resuelta tiene `MatchSyncState` con `kickoffUtc` antes del kickoff.
- [ ] Los umbrales quedan documentados y alineados: tu `MIN_ELAPSED_FOR_TERMINAL` (80) y el
      `MIN_MINUTE_FOR_TERMINAL` (80) del scraper.
- [ ] Nada de lo anterior se marca hecho sin commit + test + deploy verificado en producción.

## 5. Referencias

- Post-mortem completo de ambos incidentes (con timestamps, evidencia y matriz de escenarios
  E1–E7): `picks4all-scores/docs/INCIDENT-2026-06-17-false-FT-argentina-argelia.md` (§11 =
  Inglaterra–Congo). Está pusheado en el repo del scraper.
- Contrato del scraper: `picks4all-scores/docs/FOR-PICKS4ALL-INTEGRATION.md` (sin cambios de forma;
  recuerda: NO existe ningún fallback automático — API-Football está muerto).
- Scraper desplegado con el gate: commit `a9c85d2`, live desde 2026-07-02 13:16 UTC, verificado con
  los 3 partidos de hoy re-registrados (6/6 fuentes).
