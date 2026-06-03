# Plan — Integrar el nuevo contrato de `picks4all-scores` + cerrar el bug de finalización

> Unifica: (a) el brief `picks4all-scores/docs/FOR-PICKS4ALL-INTEGRATION.md`
> (cambios reales del scraper) y (b) `SCORING_RESULTS_AUDIT.md` §8-§9 (causa
> raíz de la final del 30-may).
>
> Todo lo de abajo está **verificado contra el código real** del backend
> (branch `feat/sales-cc-apply`, = main + features). Cada gap cita
> `archivo:línea`. **Es plan — no se toca código sin tu aprobación.**

---

## 1. Qué cambió en el scraper (resumen del brief, verificado en su doc)

1. **Máquina de estados monotónica:** un partido nunca retrocede de estado; un terminal (`FT`/`AET`/`PEN`/`ABD`) es definitivo. → El `NS` regresivo que causó el limbo del 30-may **ya no ocurrirá**.
2. **Nuevo `timeline[]`** por partido: hitos confirmados (1H/HT/2H/ET/PEN/FT) con `confirmedBy[]`.
3. **El scraper NO cierra por tiempo** (por diseño) → el fallback por antigüedad es responsabilidad nuestra.
4. **`fulltime*`/`halftime*`/`extratime*` son SIEMPRE `null`** → el marcador al minuto 90 / fin de ET hay que derivarlo del `timeline`.
5. **Penales** separados en `penaltyHome`/`penaltyAway`; estado terminal `"PEN"` (en vivo `"P"`).
6. **Auth fail-closed:** 503 si el scraper no tiene key; 401 sin header; 403 token inválido; 429 con `Retry-After`.
7. **`totalSources`/`activeSources` dinámicos** (hoy 6) — no hardcodear.

---

## 2. Gaps confirmados (contrato nuevo vs código actual)

| # | Gap | Evidencia (código actual) | Severidad |
|---|---|---|---|
| **G1** | `LiveScore` no tiene `timeline[]`; el cliente no lo parsea | `scoresService/client.ts:26-50` (interface termina en `actualKickoffUtc`) | Alta — sin timeline no podemos derivar goals90 ni cerrar por evento |
| **G2** | `homeGoals90/awayGoals90` se derivan de `score.fulltimeHome`, que **ahora es siempre `null`** | `liveScoresJob.ts:300-302` (`homeGoals90 = wentToExtraTime ? score.fulltimeHome : null`) + brief §5 | **Crítica** — para partidos con ET (la final, partidos únicos) goals90 quedará null y el scoring de fases `includeExtraTime=false` usará el marcador post-ET en vez del de 90' |
| **G3** | `FINISHED_STATUSES` no incluye `"ABD"` | `apiFootball/types.ts:158` = `['FT','AET','PEN']`; brief §3.3 marca `ABD` terminal | Media — un partido abandonado nunca finaliza |
| **G4** | El cliente lanza `Error` genérico; no maneja `429`/`Retry-After` ni distingue `503` (fail-closed) | `scoresService/client.ts` `request()` (~línea 250: `throw new Error(... res.status ...)`) | Media — robustez/rate-limit |
| **G5** | El fallback de API-Football ya dispara por antigüedad ✅ pero conviene endurecer | `smartSync/service.ts:272` (`kickoffUtc + FINISH_CHECK_MS`) — **ya correcto** | Baja — confirmar, no reescribir |
| **G6** | No hay detección de "partido que debió terminar pero sigue sin finalizar" → sin alerta | `SCORING_RESULTS_AUDIT.md §8`; no existe en `liveScoresJob`/jobs | Alta — es lo que dejó la final en limbo silencioso |
| **G7** | `homeGoals90` ya no se puede poblar al escribir el resultado; hay que tomarlo del `timeline` (hito 2H/FT-regular) | `liveScoresJob.ts:346-362` (escribe `homeGoals90` desde el campo null) | Crítica — par de G2 |
| **G8** | Posible reinterpretación de "ausencia de datos"; verificar que un fixture que deja de venir no se trate como NS | `liveScoresJob.ts` (procesa solo `matches[]` recibidos) — **verificar** | Media |
| **G9** | `/fixtures/verify` devuelve enum interno, no código API-Football; no mezclar con `/scores/live` | `fixtureVerificationJob.ts` — **verificar** que no asuma códigos AF del verify | Baja |

> **Nota sobre G2/G7 y el alcance real:** las fases de ida/vuelta (r32–sf)
> se juegan a 90' sin ET, así que `homeGoals90=null → homeGoals` es
> inofensivo ahí. El impacto real es en **partidos únicos con tiempo extra**
> (la final, y cualquier formato a un partido): ahí el marcador al minuto 90
> debe salir del `timeline`, no de un `fulltimeHome` que ya no existe.

---

## 3. Plan paso a paso (commits, en orden de dependencia)

Priorizado por: funcionamiento correcto → robustez → arquitectura. Cada
commit con su gate (`tsc` + tests; build donde toque frontend).

### Commit 1 — Cliente: contrato nuevo + manejo de errores
- `scoresService/client.ts`:
  - Extender `LiveScore` con `timeline: TimelineEvent[]` (tipo nuevo: `status, at, homeGoals, awayGoals, penaltyHome, penaltyAway, minute, confirmedBy[]`). Mantener `fulltime*`/`extratime*` como opcionales `null` (compat).
  - `request()`: distinguir `429` (leer `Retry-After`, backoff/registrar), `503` (servicio no configurado → fail-closed, log claro), `401`/`403` (auth — alertar). No solo `Error` genérico.
- Tests del parser (timeline presente / vacío / nulos en ISO).

### Commit 2 — Derivar el marcador de 90' y de ET desde el `timeline`
- Helper `deriveRegulationAndEtScores(timeline, status)`:
  - `goals90` = marcador en el último hito antes de ET (hito `2H`/`FT`), o el `homeGoals/awayGoals` si nunca hubo ET.
  - resultado fin-de-ET = marcador del hito `AET`/al entrar a `PEN`.
- `liveScoresJob.ts:300-362`: poblar `homeGoals90/awayGoals90` desde el helper (no desde `fulltimeHome`). Penales siguen de `penaltyHome/Away`.
- Tests: 1-1 que va a penales (90'=1-1, ET=1-1, PEN 4-3) → goals90=1-1, penalties=4-3.

### Commit 3 — Estados terminales completos + cierre por evento confirmado
- `apiFootball/types.ts`: añadir `"ABD"` a `FINISHED_STATUSES`.
- `liveScoresJob.ts`: opción de exigir `confirmedBy.length ≥ N` (config, default p.ej. 2) antes de finalizar, usando la entrada terminal del `timeline`. Confiar en el primer terminal recibido (el scraper garantiza no-retroceso).
- Tests de cada terminal (FT/AET/PEN/ABD) + umbral confirmedBy.

### Commit 4 — Detección de partido atascado + alerta (cierra G6 / §9-B del audit)
- Nuevo chequeo (en `liveScoresJob` o un job liviano): si `now > kickoff + STALE_THRESHOLD` (p.ej. 180 min, cubre ET+penales+descuentos) y el resultado no está finalizado (`source != API_CONFIRMED` y no hay terminal), entonces:
  - asegurar que el fallback de API-Football ya se disparó (no depender de status),
  - emitir `sendAdminNotification` "partido X debió terminar y sigue sin resultado final",
  - (opcional) marcar `syncStatus` a un estado `STALE` para visibilidad.
- Salvaguarda extra: empate de eliminatoria **finalizado sin penales registrados** → alerta (par de `structuralAutoPublish.ts:247`).
- Tests del umbral + que la alerta se dispara una sola vez.

### Commit 5 — Robustez de "ausencia de datos" + sources dinámicos (G8/G5)
- Confirmar/ajustar que un fixture que deja de aparecer en `matches[]` **no** se reinterprete como `NS` ni borre el último estado conocido.
- Auditar usos de número de fuentes; si hay algún literal, leer `totalSources/activeSources` de la respuesta.

### Commit 6 — Docs
- ADR nuevo (contrato scores v2 + finalización por timeline + fallback por antigüedad + detección de atasco).
- Actualizar `docs/guides/SCORES_INTEGRATION.md` y `BUSINESS_RULES` (results system).
- Cerrar `SCORING_RESULTS_AUDIT.md` (causa resuelta).

---

## 4. Acción única — desatascar la final del 30-may (independiente del deploy)

Por el **override del host** (HOST_OVERRIDE) en "Champions Tamayo" y demás
pools de `ucl-2025-instance`: publicar el `1-1` (+ penales/campeón si se
quiere registrar el estructural). Eso escribe la versión autoritativa y
cierra el partido. El scraper no reabrirá ese partido (brief §6.7).
→ Te lo dejo en **dry-run** como hicimos con la CC, antes de ejecutar.

---

## 5. Decisiones que necesito confirmar contigo

1. **Umbral de atasco (`STALE_THRESHOLD`):** Decidido: 210 min.
2. **`confirmedBy` mínimo para cerrar:** Decidido: confirmedBy ≥3.
3. **La final atascada:** ¿la desatascamos ya por override (commit aparte/acción única) o esperamos a tener el fix desplegado?
4. **Alcance:** ¿hacemos los 6 commits ahora, o priorizamos los críticos (G2/G7 + G6) primero y el resto después?

---

## 6. Fuera de alcance (explícito)
- Cambios en el repo `picks4all-scores` (ya los hizo la otra sesión; este plan es solo el lado Picks4All).
- Reescribir el fallback de API-Football (ya dispara por antigüedad — solo se endurece en commit 4).

---

## Versión
- v1 — 2026-06-02 — plan unificado brief-scraper + audit-scoring, pendiente "Go".
