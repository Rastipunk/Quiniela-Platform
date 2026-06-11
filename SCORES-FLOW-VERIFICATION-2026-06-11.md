# Verificación 200% del flujo de resultados en vivo — Brief para la sesión del backend

> **Fecha:** 2026-06-11 (día 1 del Mundial 2026; México–Sudáfrica 19:00 UTC, Corea del Sur–República Checa 02:00 UTC del 12-jun)
> **Audiencia:** la sesión de Claude que trabaja en ESTE repo (Quiniela-Platform).
> **Autor:** sesión de Claude del repo `picks4all-scores`, tras auditar AMBOS lados de la integración.
> **Método:** cada afirmación sobre el backend cita archivo y línea de ESTE repo, verificada hoy. Cada afirmación sobre el scraper está verificada contra producción real (curl con timestamps). **Nada está asumido.**
>
> **Cómo usar este documento:** ejecuta §2 (verificación de runtime) HOY antes de las 18:30 UTC. Implementa §3 (acciones) en orden de prioridad. §4 es el runbook de esta noche. §5 explica qué cambió hoy del lado scraper y por qué puedes confiar en él.

---

## 0. TL;DR

> # ⚠️ NO EXISTE NINGÚN FALLBACK AUTOMÁTICO
> API-Football ya no se usa. `smartSync` está **inerte** (`isAvailable() === false`,
> `smartSync/service.ts:94-96`). El scraping en vivo (`picks4all-scores`) es la
> **ÚNICA** fuente de resultados. Si el scraper no finaliza un partido, la cadena
> de recuperación completa es: **alerta del stale detector (email, 210 min) →
> override manual del host**. No hay nada más. Cualquier comentario, doc o
> intuición que diga "el fallback de API-Football lo recoge" está DESACTUALIZADA
> y es exactamente el tipo de creencia falsa que causó el limbo del 30-may.

1. **El lado scraper (`picks4all-scores`) ya está arreglado, desplegado y verificado E2E** — hoy a las 14:06 UTC. Los dos partidos de hoy se publican con `VERY_HIGH` (6/6 y 5/5 fuentes). No tienes que tocar nada ahí.
2. **A1 (pérdida de fixtures a mitad de partido) YA ESTÁ IMPLEMENTADO en este repo** (2026-06-11, misma sesión que escribió este doc): `trackStatusCheckerJob` ahora cubre todo el partido (ventana ampliada de −5 min a −240 min, default de `TRACK_STATUS_CHECK_WINDOW_BEFORE_MIN`) e incluye `AWAITING_FINISH`. **Falta: revisar el diff, deployar y verificar** (ver §3-A1).
3. **Comentarios engañosos del "fallback" corregidos en el código** (constants.ts, liveScoresJob.ts, staleDetector.ts, smartSyncJob.ts, smartSync/service.ts) — ahora declaran explícitamente que no hay fallback.
4. Antes del kickoff de hoy: corre el checklist §2 (settings, env vars, sync states). Son 10 minutos.

---

## 1. Mapa VERIFICADO de tu integración (lo que tu código hace HOY)

| Job | Archivo | Cadencia | Qué hace (verificado) |
|---|---|---|---|
| `FixtureTrackingJob` | `backend/src/jobs/fixtureTrackingJob.ts` | cada hora + al boot | Envía a `POST /api/v1/track` los fixtures con kickoff en las próximas 24h (y hasta 3h pasadas), CON NOMBRES EN ESPAÑOL del `dataJson`. **Fix 2026-06-11:** re-envía SIEMPRE (idempotente) — el dedup permanente por `trackedAtUtc` fue eliminado porque convertía cualquier restart del scraper en pérdida permanente |
| `LiveScoresJob` | `backend/src/jobs/liveScoresJob.ts` | cada 15s (`SCORES_POLL_INTERVAL_MS`) | Consume `GET /api/v1/scores/live`; procesa matches con confianza ≥ `MEDIUM` cuyo kickoff esté en ventana `[now − 3h, now + 5min]` (líneas 127-132). Publica `SCRAPER_PROVISIONAL`; al detectar status terminal con ≥3 confirmaciones (`terminalConfirmationCount`, timeline-based) arma grace period de 5 min y luego finaliza a `API_CONFIRMED` (líneas 213-249, 455-556) |
| `TrackStatusCheckerJob` | `backend/src/jobs/trackStatusCheckerJob.ts` | cada minuto | Para partidos con kickoff en `[now − 5min, now + 10min]` y syncStatus PENDING/IN_PROGRESS: consulta `/api/v1/track/status`; si UNTRACKED → **re-trackea automáticamente** y alerta admin (líneas 47-166) |
| `staleDetector` | `backend/src/services/scoresService/staleDetector.ts` | cada 5 min (dentro del poll) | Alerta (SOLO email, una vez por partido) si un match AUTO sigue sin COMPLETED 210 min después del kickoff |
| `smartSyncJob` | `backend/src/jobs/smartSyncJob.ts` | — | Gateado por `isApiFootballEnabled()` (`smartSync/service.ts:94-96`) → **inoperante sin API-Football** (ver A2) |

Constantes relevantes (`backend/src/lib/constants.ts:41-61`): `GRACE_PERIOD_MS` 5 min, `MIN_CONFIRMATIONS_TO_FINALIZE` 3, `STALE_THRESHOLD_MS` 210 min, `FALLBACK_DELAY_MS` 30 min (sin efecto — ver A2).

Flujo completo verificado:

```
fixtureTrackingJob → POST /track (nombres en ESPAÑOL, UTF-8 ✅)
  → picks4all-scores scrapea 6 fuentes cada ~30s, consenso ≥3 coinciden
    → liveScoresJob (cada 15s) lee /scores/live desde kickoff−5min
      → SCRAPER_PROVISIONAL en cada poll con cambio de marcador
        → status terminal (FT/AET/PEN/ABD) + ≥3 confirmaciones en timeline
          → grace 5 min → API_CONFIRMED → advancement/structural/pool-completed
```

---

## 2. CHECKLIST DE RUNTIME — ejecutar HOY antes de las 18:30 UTC

El código está bien; lo que nadie ha verificado HOY es la configuración de runtime. Verifica cada punto y reporta el resultado:

### 2.1. Plataforma y client

- [ ] `PlatformSettings.scoresServiceEnabled = true` (singleton). Si es false, **ningún** job corre — `liveScoresJob.ts:583`, `fixtureTrackingJob.ts:62`, `trackStatusCheckerJob.ts:41`.
- [ ] Env del backend en producción: `SCORES_SERVICE_URL=https://picks4all-scores-production.up.railway.app` y `SCORES_SERVICE_API_KEY` seteadas (`scoresService/client.ts:18-19`). Sin ambas, `client.isAvailable()` es false y todo se salta silenciosamente.
- [ ] Smoke test de auth desde el backend (o curl con la key del backend):
  `GET {SCORES_SERVICE_URL}/api/v1/scores/live` con `Authorization: Bearer {key}` → HTTP 200. Un 401/403 = key equivocada; un 503 = el scraper no tiene key configurada.

### 2.2. Estado de los dos partidos de hoy

- [ ] Existe `MatchExternalMapping` con `apiFootballFixtureId` **1489369** (México–Sudáfrica) y **1538999** (Corea–República Checa) apuntando a los matches internos correctos.
- [ ] Existe `MatchSyncState` para ambos con `kickoffUtc` correcto (19:00Z / 02:00Z+1) y `syncStatus` PENDING o IN_PROGRESS. **Sin esa fila con kickoffUtc, ni `trackStatusCheckerJob` ni `staleDetector` los ven** (queries en `trackStatusCheckerJob.ts:51-54` y `staleDetector.ts:61-78`).
- [ ] La instancia del Mundial: `resultSourceMode=AUTO`, `syncEnabled=true`, `status=ACTIVE`, y al menos un pool `ACTIVE` (sin pools activos, `buildFixtureMap` descarta el match — `liveScoresJob.ts:135-136`).
- [ ] `GET /api/v1/track/status?fixtureIds=1489369,1538999` → ambos `TRACKING` con `sources` no vacío. (A las 14:10 UTC de hoy: ambos tracked, 6 y 5 fuentes respectivamente.)

### 2.3. Confirmación en vivo (después de las 18:55 UTC)

- [ ] Logs del backend: `[LiveScoresJob] Published SCRAPER_PROVISIONAL for <matchId> ... [NS, confidence=VERY_HIGH]` apenas el match entra a la ventana (kickoff−5min).
- [ ] `PoolMatchResult` del partido de México con versión `SCRAPER_PROVISIONAL` y `externalDataJson.sourcesAgreeing ≥ 3`.

---

## 3. ACCIONES REQUERIDAS (prioridad descendente)

### A1 — ✅ IMPLEMENTADO (2026-06-11): cobertura de pérdida de fixtures a MITAD de partido

**Hecho verificado (ambos lados):** el tracking del scraper vive en memoria; un restart/redeploy lo borra. Hoy ocurrió 3 veces (deploys 13:42, 14:06 UTC) y hubo que re-registrar manualmente. Antes del fix de hoy, los jobs NO lo cubrían:

- `fixtureTrackingJob.ts:171-186`: filtra los fixtures con `trackedAtUtc != null` → un fixture ya trackeado **jamás se reenvía**, aunque el scraper lo haya perdido.
- `trackStatusCheckerJob.ts` (versión anterior): solo miraba partidos con `kickoffUtc` en `[now − 5min, now + 10min]`. Un restart del scraper en el minuto 30 → fixture perdido → el partido dejaba de actualizarse hasta la alerta stale (3.5 horas) **y sin fallback, sin alguien actuando el email, para siempre**.

**Lo implementado (ya en el working tree de este repo, mismo commit que este doc):**

1. `TRACK_STATUS_CHECK_WINDOW_BEFORE_MIN` default `5` → `240` min: el checker ahora verifica el tracking de TODO partido desde 10 min antes del kickoff hasta 4h después (alineado con la expiración kickoff+4h del scraper).
2. `syncStatus` incluye `AWAITING_FINISH`: un partido en grace period también necesita seguir trackeado (la finalización la dispara la data de `/scores/live` — un fixture perdido en grace nunca finalizaría).
3. El resto del job ya hacía lo correcto y no se tocó: detecta UNTRACKED vía `/track/status` cada minuto, re-trackea con los nombres del `dataJson` (idempotente — `ALREADY_TRACKING`) y alerta admin con dedup.

**Resultado:** un restart del scraper en cualquier momento del partido se auto-recupera en ≤60s (checker) + ~30s (primer ciclo de scraping) ≈ **pérdida máxima real de ~2 minutos**.

**Lo que TE falta hacer:**
- [ ] Revisar el diff (`git diff` de `trackStatusCheckerJob.ts`) y correr los checks del repo.
- [ ] Deployar el backend y verificar en logs que el job corre con la ventana nueva.
- [ ] Probar el ciclo completo si hay oportunidad: redeploy del scraper en momento sin partido → confirmar `[TrackStatusCheck] Re-tracked N fixtures` ≤60s después (con un partido dentro de la ventana −240 min).
- [x] ~~Opcional (cinturón y tirantes)~~ **TAMBIÉN IMPLEMENTADO (2026-06-11):** `fixtureTrackingJob` ahora reenvía SIEMPRE (dedup permanente eliminado). Cobertura combinada: pérdida pre-kickoff sanada ≤1h (job horario) y pérdida desde kickoff−10min hasta kickoff+4h sanada ≤60s (checker).

### A2 — ✅ DOCUMENTADO EN CÓDIGO / queda DECISIÓN de producto: no existe fallback automático

`smartSync.isAvailable()` (`smartSync/service.ts:94-96`) exige `isApiFootballEnabled()` y API-Football ya no se usa → **inerte**. Los comentarios que afirmaban lo contrario ya fueron corregidos hoy en: `constants.ts` (banner en el bloque SCORES), `liveScoresJob.ts` (gate de confirmaciones), `staleDetector.ts` (header), `smartSyncJob.ts` y `smartSync/service.ts` (headers marcados INERT).

- La cadena real de recuperación hoy es: **alerta stale a los 210 min (solo email) → override manual del host**. Nada más.
- [ ] **Verifica** que el email de alerta stale llega a un buzón que alguien mira EN día de partido (`staleDetector` usa `sendAdminNotification`; revisa `NOTIFICATION_INBOX_ENV`).
- [ ] **Decisión a tomar (con el owner):** o se formaliza el cierre manual como política operativa, o se implementa un cierre administrativo por antigüedad visible en la UI del host (no solo email). Lo que NO puede pasar es que alguien crea que "hay un fallback automático" — exactamente el patrón del incidente del 30-may.

### A3 — RECOMENDADO: ampliar `SCORES_WINDOW_POST_HOURS` de 3 a 4

`liveScoresJob.ts:57,131`: dejas de poll-ear un match 3h después del kickoff. Riesgo real: eliminatorias con prórroga + penales (~2h50min de partido) + retraso de kickoff (ceremonias — hoy mismo es la inauguración) + grace period de 5 min. Si el poll se corta antes de finalizar, el resultado queda `SCRAPER_PROVISIONAL` para siempre (hasta la alerta stale). El scraper mantiene el fixture vivo hasta kickoff+4h — **alinéate a 4h**. Es solo la env var `SCORES_WINDOW_POST_HOURS=4`, sin deploy de código.

### A4 — MENOR: resultado provisional 0-0 publicado ANTES del kickoff

Desde kickoff−5min el scraper ya publica `NS 0-0` (verificado hoy: ambos partidos en `/scores/live` con status `NS`), y `processLiveScore` lo publica como `SCRAPER_PROVISIONAL 0-0` (`liveScoresJob.ts:242-249, 292+`) — crea una versión de resultado 0-0 para un partido que no empezó. No rompe nada (no es terminal, no dispara cierre), pero si la UI muestra "resultado provisional 0-0" pre-kickoff, considera saltar la publicación cuando `score.status === "NS"` (2 líneas). Decide según producto.

### A5 — INFORMATIVO: nombres en español y encoding

- Tus nombres en español **ya funcionan** del lado scraper (fix de hoy, commit `80dc106` en picks4all-scores: aliases para las 48 selecciones, validados contra `seedWc2026Sandbox.ts` y `es/teams.json` de ESTE repo). No cambies el idioma de los nombres — el contrato ahora soporta ambos.
- Tu client envía UTF-8 correctamente (`fetch` + `JSON.stringify`, `client.ts:288-291`) — verificado en producción con los registros reales de hoy. Sin acción.
- ⚠️ Si alguien re-trackea A MANO con curl en Windows: el JSON inline corrompe los acentos (pasó hoy). Usar `--data-binary @archivo.json` con archivo UTF-8.

### A6 — INFORMATIVO: garantías del scraper que puedes explotar

- `status` nunca retrocede; un terminal (`FT`/`AET`/`PEN`/`ABD`) es definitivo. Tu `terminalConfirmationCount` + grace period ya lo aprovecha bien.
- "Ausencia en `matches[]`" ≠ "NS". Un partido puede desaparecer si las fuentes lo pierden o expiró (kickoff+4h). Tu código no reinterpreta ausencia — correcto; mantenlo así.
- `UNKNOWN` interno mapea a `"NS"` en el API (contrato §3.3) — otra razón para nunca inferir nada de un `NS` tardío.
- Penales: SIEMPRE en `penaltyHome/penaltyAway` con status `PEN` (tanda terminada) o `P` (en curso). 4 de las 6 fuentes activas los reportan (ESPN, LiveScore, BBC, 365Scores).

---

## 4. RUNBOOK de esta noche (México–Sudáfrica 19:00 UTC / Corea–Chequia 02:00 UTC)

**T−30 min:** checklist §2 completo. Logs de backend sin errores `[ScoresService]`.

**T−5 min:** debe aparecer `[LiveScoresJob] Published SCRAPER_PROVISIONAL ... [NS, ...]`. Si no: revisar `buildFixtureMap` (¿pool ACTIVE? ¿mapping correcto?) y `GET /api/v1/track/status`.

**Durante el partido:** cada gol debe reflejarse en ≤60s (consenso necesita ≥3 fuentes; las fuentes tardan 10-60s + ciclo 30s + poll 15s). En el scraper puedes mirar sin auth: `GET /fixtures/tracked` (fuentes reportando) y el dashboard.

**Al final (FT):** secuencia esperada en tus logs: `AWAITING_FINISH` (FT detectado + ≥3 confirmaciones) → 5 min de grace → `[LiveScoresJob] Finalized ... → API_CONFIRMED`. Verifica que `PoolMatchResult.currentVersion.source = API_CONFIRMED` y que el pool/advancement reaccionó.

**Si un partido deja de actualizarse >5 min en vivo:**
1. `GET {scraper}/fixtures/tracked` → ¿siguen los 2 fixtures? Si NO → restart del scraper. **Con A1 deployado, `trackStatusCheckerJob` lo re-registra solo en ≤60s** (verás `[TrackStatusCheck] Re-tracked N fixtures` en logs). Si A1 aún NO está deployado: re-trackear a mano YA (`triggerFixtureTracking()` NO sirve por el dedup — usar `client.trackFixtures(...)` directo o el curl §A5).
2. ¿Fixtures presentes pero `sources` vacío o status congelado? → mirar `GET {scraper}/scrapers/status` y `/audit/recent` (fuentes caídas / contradicción retenida — el scraper retiene si no hay ≥3 coincidiendo: comportamiento correcto, esperar).
3. Escalar: dashboard del scraper + Railway logs (servicio `picks4all-scores`, proyecto `vigilant-essence`).

**Corea–Chequia (02:00 UTC):** LiveScore no verá el partido hasta las 00:00 UTC (cambio de fecha UTC — comportamiento esperado y verificado, las otras 5 fuentes ya lo reportan). A las 00:05 UTC debería estar 6/6.

---

## 5. Qué cambió HOY del lado scraper (contexto, ya desplegado y verificado)

| Cambio | Commit (repo picks4all-scores) |
|---|---|
| Aliases español→inglés para las 48 selecciones del Mundial (causa raíz: tus nombres en español no matcheaban con las fuentes en inglés → **0 fuentes matcheaban, 0 resultados**) | `80dc106` |
| 365Scores: partidos programados llegan con `statusGroup: 2` ("live") + `statusText: "Scheduled"` + `gameTime/score: -1` → ya no se interpretan como "1er tiempo" ni el `-1` vota como marcador | `80dc106`, `15c4198` |
| Build de Railway documentado (no setear `NODE_ENV` como variable del servicio: rompe el build) | `359d89f` |

**Evidencia de producción (2026-06-11 ~14:10 UTC):**

```
GET /api/v1/scores/live →
  1489369 México–Sudáfrica:   0-0 NS VERY_HIGH 6/6 fuentes
  1538999 Corea–Rep. Checa:   0-0 NS VERY_HIGH 5/5 fuentes
GET /fixtures/tracked →
  1489369: espn, 365scores, bbc, livescore, besoccer, onefootball
  1538999: espn, 365scores, bbc, besoccer, onefootball  (livescore entra 00:00 UTC)
```

Umbrales del scraper (defaults en producción): consenso mínimo 3 fuentes, `VERY_HIGH` ≥5, `HIGH` ≥4, `MEDIUM` ≥3; reportes >150s no votan; fixture expira kickoff+4h. Flota: 7 registradas / 6 activas (SofaScore requiere proxy residencial — decisión de costo pendiente).

---

## 6. Resumen de acciones en una línea cada una

1. **A1 — YA IMPLEMENTADO en este repo:** revisar diff de `trackStatusCheckerJob.ts`, deployar y verificar (§3-A1).
2. **A2 (decisión + verificación):** NO HAY FALLBACK — confirmar que el email de alerta stale llega a alguien que actúe; formalizar la política de cierre manual (o construir cierre administrativo en UI).
3. **A3 (env var, 1 min):** `SCORES_WINDOW_POST_HOURS=4`.
4. **§2 (hoy, 10 min):** checklist de runtime antes de las 18:30 UTC.
5. **A4 (decisión de producto):** ¿publicar o no el 0-0 provisional pre-kickoff?
6. No tocar: idioma de nombres, encoding del client, lógica de grace/confirmaciones (está bien diseñada).
