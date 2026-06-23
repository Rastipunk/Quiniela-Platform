# Plan — Cache del leaderboard del Pool Overview (arreglo de lentitud)

> **Estado:** PLAN — pendiente de aprobación. CERO código de producción hasta el OK.
> **Regla rectora:** no romper NADA, no perder NINGUNA información, mejor UX.

---

## 1. Causa raíz (medida, sin suposiciones)

Logs HTTP del proxy de Railway (fuente independiente y confiable):

```
path = GET /pools/:id/overview
totalDuration ≈ upstreamRqDuration  (55194ms ≈ 55193ms, etc.)  → el tiempo es de la APP Node
p50 app = 2386ms · max = 55194ms
/overview = 172 de ~400 requests (≈43% de TODO el tráfico)
```

- El tiempo está **dentro de la app** procesando el overview (no red, no cola).
- Escala con el tamaño del pool.
- El **leaderboard se recomputa entero en CADA request** (sin cache): carga TODAS las predicciones de TODOS los miembros + loop `miembros × partidos` + breakdown estructural.
- Es **idéntico para todos los usuarios del mismo pool**, pero se recomputa una y otra vez.
- Node es single-thread → durante partidos en vivo, cuando todos refrescan, decenas de cómputos de hasta 55s se encolan en el único hilo → **se congela TODO para TODOS**.

**Conclusión:** el cuello es el cómputo redundante del leaderboard en `getPoolOverview` (`backend/src/services/poolOverviewService.ts`).

---

## 2. Tu observación clave (la aprovechamos)

> "La tabla solo cambia si hay cambio en los partidos."

Correcto, y lo verifiqué contra el código:
- El puntaje de un jugador solo cambia cuando aparece/cambia un **resultado** (`PoolMatchResult` / resultados estructurales).
- Las **predicciones se bloquean en el deadline** (antes del kickoff, antes del resultado) → una predicción no cambia el puntaje hasta que hay resultado.
- El leaderboard también cambia si cambia el **conjunto de miembros** (alguien entra/sale/es expulsado) o un **override de scoring** del host.

→ Por eso el cache se invalida **cuando cambian esos inputs**, no por puro tiempo. Cuando no hay partidos cambiando, el cache se mantiene y siempre es correcto.

---

## 3. Diseño del arreglo

### 3.1 Qué se cachea y qué NO

| Parte | ¿Cacheada? | Frescura |
|---|---|---|
| **Leaderboard** (filas, puntos, ranking) — lo PESADO | ✅ por pool | Se recomputa al cambiar inputs (ver 3.2) o tras TTL máx |
| `predictedCount` por partido (badge 📊) | ✅ en el bundle | Refresca cuando alguien predice (cuenta cambia) |
| **`matchCards`** (marcador en vivo, status, elapsed) | ❌ fresco por request | Siempre en vivo, cada request |
| **`myPick`** (predicción propia del usuario) | ❌ fresco por request | Instantáneo tras guardar |
| **`myMembership` / permisos** | ❌ fresco por request | Siempre correcto |
| **emails** en filas (solo admin) | filas se cachean CON email | Se filtra POR request según rol del solicitante |

> El dato en vivo de los partidos y la predicción propia **NUNCA** se cachean. Solo la tabla global pesada.

### 3.2 Invalidación por "cambio en partidos" (fingerprint barato)

Por request se computa un **fingerprint** con agregados baratos (COUNT/MAX sobre columnas indexadas por `poolId`):

- `PoolMatchResult`: count + max(`updatedAtUtc`)  ← resultados publicados/editados
- `StructuralPhaseResult`: count + max(`updatedAtUtc`)
- `GroupStandingsResult`: count + max(`updatedAtUtc`)
- `PoolMember` (status ACTIVE/LEFT): count  ← entradas/salidas/bans
- `Prediction`: count  ← nuevos pronosticadores (frescura del badge)
- `PoolMatchOverride`: count + count(scoringEnabled=false)  ← overrides del host

Si el fingerprint **coincide** con el del bundle cacheado **y** no pasó el TTL máx → se sirve el cache. Si **cambió** → se recomputa. Estos agregados son milisegundos (índices), vs segundos del cómputo pesado.

- **`PoolMatchOverride` no tiene timestamp** → además del count, el endpoint de override llamará a `invalidatePoolLeaderboard(poolId)` (bust explícito). Defensa redundante: el TTL máx (20s) cubre el caso raro de toggle que neutraliza el count.

### 3.3 Parámetros y kill-switch

- `POOL_LEADERBOARD_CACHE_TTL_MS` (default `20000` = 20s, máx safety-net).
  - **`0` ⇒ cache desactivado por completo** = comportamiento idéntico al de hoy. Rollback instantáneo sin deploy.
- Tope de memoria: **LRU** con cap de entradas (`POOL_LEADERBOARD_CACHE_MAX = 1000` pools) + expiración por TTL. (Memoria actual del backend: 1.3 GB / 24 GB = 5% → muchísimo margen.)
- **Coalescing de builds concurrentes:** un `Map<poolId, Promise>` para que, si N requests del mismo pool fallan el cache a la vez (tormenta de refresco en vivo), se compute **UNA sola vez** y todos esperen esa promesa. Esto es lo que mata el meltdown.
- **Verbose** (`?verbose=true`, debug de admin) → **bypassa el cache** (computa fresco, no guarda).

### 3.4 Forma del código (contenida y reversible)

- Nuevo archivo `backend/src/services/poolLeaderboardCache.ts`:
  - `getOrComputeLeaderboard(poolId, computeFn)` con fingerprint + TTL + LRU + coalescing.
  - `invalidatePoolLeaderboard(poolId)`.
- `poolOverviewService.ts`:
  - Extraer el cómputo del leaderboard (miembros + allPredictions + estructural + loop + ranking + predictedCount) a una función pura `computeLeaderboardBundle(...)`.
  - `getPoolOverview` llama al cache para esa parte; arma `matchCards` y per-user **igual que hoy** (fresco); filtra emails por rol.
- Bust explícito en el servicio de publicación de resultados y en el de override (1 línea cada uno).
- Quitar la instrumentación temporal `[perf overview]` (reemplazada por un contador hit/miss de bajo volumen).
- **Sin cambios de schema. Sin migración.** Es 100% en memoria.

---

## 4. "¿Qué podría romperse?" — análisis exhaustivo (tu prioridad #1)

| Riesgo | Mitigación | Resultado |
|---|---|---|
| **Pérdida de información** | El cache es una **vista derivada de solo-lectura**. NUNCA escribe en `Prediction`/`PoolMatchResult`/etc. La fuente de verdad queda intacta. | **Imposible perder datos.** Si el cache se equivoca, se autocorrige al siguiente cambio de fingerprint o TTL. |
| **Tabla desactualizada** | Invalidación por fingerprint (resultados/miembros/picks/overrides) + TTL máx 20s + bust explícito en publish/override. | Fresca cuando importa; ≤20s en el peor caso teórico. |
| **Marcador en vivo viejo** | `matchCards`/`syncStates` NO se cachean — frescos cada request. | Scores en vivo siempre al día. |
| **Mi predicción no aparece tras guardar** | `myPick`/`myMembership` NO se cachean. | Instantáneo, como hoy. |
| **Emails filtrados a no-admin** | Filas cacheadas con email; el email se incluye en la respuesta **solo** si el solicitante es admin (igual lógica que hoy, aplicada por-request). | Sin fuga. |
| **Mezcla de datos entre usuarios** | Solo se comparte la parte **pool-global**; todo lo per-user es fresco. | Sin cross-contamination. |
| **OOM / memoria** | LRU cap + expiración; headroom 95%. | Acotado. |
| **Thundering herd** (todos fallan cache a la vez) | Coalescing: 1 cómputo compartido por pool. | Sin estampida. |
| **Fingerprint que omita un cambio** | TTL máx (autosana) + bust explícito en publish/override. | Self-healing. |
| **Romper otros consumidores** | Solo afecta `getPoolOverview.leaderboard`. El email de pool-completado usa `rankLeaderboardRows` directo (sin tocar). | Aislado. |
| **Riesgo de deploy** | Sin schema/migración; puro código + env. Kill-switch `=0`. | Reversible en segundos. |

---

## 5. Impacto en UX (mejor para todos)

- Overview de pools grandes: de **2–55s → milisegundos** en cache hit.
- Al dejar de bloquear el event loop, **TODO el resto** (login, otras páginas) deja de encolarse → la plataforma entera se siente rápida.
- La tabla se actualiza **al instante cuando se publica un resultado** (bust + fingerprint), no en cada refresco redundante.
- El usuario ve su propia predicción y los scores en vivo sin retraso.

---

## 6. Plan de implementación por fases

1. **Fase 1 — helper de cache** (`poolLeaderboardCache.ts`) + tests unitarios (hit/miss, cambio de fingerprint, TTL, LRU, coalescing, bypass verbose). Sin tocar el overview aún.
2. **Fase 2 — refactor `poolOverviewService`**: extraer `computeLeaderboardBundle`, enchufar el cache, filtrar emails por rol. Quitar instrumentación temporal; agregar contador hit/miss.
3. **Fase 3 — bust explícito** en publish de resultados + override (1 línea c/u).
4. **Fase 4 — docs**: ADR-079 + env var en DEPLOYMENT.md.
5. **Deploy con `POOL_LEADERBOARD_CACHE_TTL_MS=20000`.**

Cada fase typechecks y no rompe nada por sí sola (con TTL=0 todo se comporta como hoy).

---

## 7. Verificación (varias veces, antes de cantar victoria)

- ✅ `tsc --noEmit` backend + frontend limpios.
- ✅ `prisma generate` (sin cambios de schema — solo regenera).
- ✅ Tests unitarios del cache verdes; suite completa sin regresiones nuevas (comparar contra los 19 fallos preexistentes).
- ✅ Post-deploy: latencia de `/overview` en logs HTTP del proxy debe caer de 2–55s a ms (primer miss por pool computa una vez).
- ✅ Funcional en producción:
  - Cargar overview de un pool real → leaderboard correcto.
  - Publicar/editar un resultado → la tabla cambia en la siguiente carga.
  - No-admin no recibe emails; admin sí.
  - Guardar una predicción → `myPick` aparece al instante.
  - Marcador en vivo se mueve sin retraso.
- ✅ Log de hit/miss confirma alta tasa de hits.
- ✅ Sin 5xx ni errores nuevos en logs.

---

## 8. Rollback

- `POOL_LEADERBOARD_CACHE_TTL_MS=0` en Railway → **comportamiento idéntico al actual**, al instante, sin deploy.
- Revertir el PR si se quisiera quitar el código (no urgente: el kill-switch ya lo neutraliza).

---

## 9. Archivos a tocar

**Backend**
- `backend/src/services/poolLeaderboardCache.ts` *(nuevo)* + su test
- `backend/src/services/poolOverviewService.ts` *(extraer bundle + enchufar cache + quitar instrumentación)*
- `backend/src/services/resultService.ts` (o donde se publique el resultado) *(1 línea: invalidate)*
- el endpoint/servicio de `setScoringOverride` *(1 línea: invalidate)*
- `docs/DECISION_LOG.md` *(ADR-079)*, `docs/guides/DEPLOYMENT.md` *(env var)*

**Sin cambios de schema. Sin migración. Sin frontend.**

---

## 10. Punto abierto para tu confirmación

- TTL elegido: **20s** (tu opción recomendada). ¿OK, o lo quieres en otro valor (p. ej. 10s)?
- ¿Apruebas proceder con este plan tal cual?
