# Auditoría profunda del pipeline de marcadores — 2026-06-11

> **Estado:** EN CURSO. Solicitada por el owner: "que los marcadores
> lleguen correctamente a cada tipo de puntuación, que todo lo que
> funciona a través de los marcadores funcione correctamente, manejo de
> medio tiempo / prórroga / penales / minuto 90-120, y capturar toda la
> información de la forma más correcta posible".
> **Regla:** cero código hasta diagnóstico completo + resumen + aprobación
> del owner. Cada hallazgo con evidencia (archivo:línea o dato de prod).
> Clasificación: 🔴 bug con impacto · 🟡 riesgo/gap · 🔵 mejora · ✅ verificado correcto.

## 0. Alcance y método

Cuatro frentes auditados en paralelo (agentes de solo lectura sobre el
código) + sonda de datos reales de producción + verificación manual de
los hallazgos críticos:

- **F1 Captura y persistencia:** scraper → liveScoresJob → PoolMatchResult/Version.
- **F2 Motor de scoring:** resultado persistido → puntos por cada tipo de pick
  (incl. `includeExtraTime`, minuto 90 vs 120, penales).
- **F3 Derivaciones estructurales:** tablas de grupo, ganadores KO, advancement,
  cierre de pools.
- **F4 Visualización:** qué ve el usuario (HT/ET/penales/en vivo/provisional)
  vs qué se captura.

## 1. Evidencia de producción (datos reales, 15:2xZ)

Sonda read-only sobre `PoolMatchResultVersion` (todas las versiones históricas,
UCL 2025 + previas + hoy):

| Fuente | Versiones | con goals90 | con penales | final≠90' |
|---|---|---|---|---|
| SCRAPER_PROVISIONAL | 398 | 0 | 0 | 0 |
| API_CONFIRMED | 296 | 78 | 0 | 6 |
| HOST_PROVISIONAL | 18 | 0 | 0 | 0 |
| HOST_OVERRIDE | 14 | 0 | 0 | 0 |

**Versiones VIGENTES (currentVersion) con `goals90 = NULL`:** API_CONFIRMED 216 ·
SCRAPER_PROVISIONAL 29 · HOST_OVERRIDE 9 · HOST_PROVISIONAL 8.

Hallazgos directos de los datos:

- **[H-P1] 🟡 `goals90` es NULL en la mayoría del histórico vigente** (datos
  pre-ADR-068 + TODAS las versiones de host). Cualquier consumidor de
  `goals90` depende de su fallback. En particular: **HOST_OVERRIDE nunca
  escribe goals90 (0/14)** — si un host corrige un partido con prórroga,
  el marcador de 90' se pierde para el scoring `includeExtraTime=false`.
  (Confirmación del impacto exacto: F2.)
- **[H-P2] 🟡 La ruta de penales NUNCA se ha ejercido en producción** (0
  capturas). El Mundial será su primer uso real — el código de PEN/P está
  probado solo en tests/diseño, no con tráfico real.
- **[H-P3] 🔵 El schema no persiste medio tiempo** (sin columnas halftime;
  el scraper SÍ lo reporta). Verificar si queda al menos en
  `externalDataJson` (F1) y si el producto lo quiere mostrar (F4).
- ✅ El caso AET real del histórico (UCL `r16_7_leg2`: final 5-0, 90' 3-0)
  capturó goals90 correctamente en las 6 pools.

## 2. F1 — Captura y persistencia (agente + spot-check manual ✓)

### Flujo verificado (sano)

- ✅ Poll 15s → gate `confidence ≥ MEDIUM` → propagación a TODAS las pools
  ACTIVE de la instancia (`liveScoresJob.ts:276-291`) — este es el patrón
  que reutilizaría el panel admin (§6).
- ✅ Jerarquía respetada en el escritor scraper: no pisa `API_CONFIRMED` ni
  `HOST_OVERRIDE` (`liveScoresJob.ts:309-314`, verificado manualmente).
- ✅ Versionado inmutable con lock `FOR UPDATE` + `versionNumber=last+1`.
- ✅ Terminal (FT/AET/PEN/ABD) → gate 3 confirmaciones → grace 5 min →
  `API_CONFIRMED` → dispara estructurales + advancement + cierre de pool.
- ✅ Penales: viven SOLO en `homePenalties/awayPenalties`; jamás suman a
  goals ni goals90 (contrato v2 + `timeline.ts`).
- ✅ AET: `homeGoals/awayGoals` = marcador completo con prórroga;
  `homeGoals90/awayGoals90` = fin de los 90' (milestone `ET` del timeline).
  Confirmado con el único AET real del histórico (§1).

### Hallazgos

- **[F1-1] 🔴 `goals90` puede quedar NULL en una prórroga real** si el
  timeline llega sin el milestone `ET` (`timeline.ts:80-84` devuelve
  `{null,null}`): el partido se finaliza IGUAL (no hay gate sobre goals90)
  y todo el scoring `includeExtraTime=false` cae al fallback
  `goals90 ?? goals` → **puntúa contra el marcador CON prórroga**
  (verificado: patrón en `resultService.ts:305`, `poolOverviewService.ts:457,495`,
  `poolAdminService.ts:941,968,1146,1165`). Silencioso: sin alerta.
- **[F1-2] 🟡 El dedupe de versiones NO compara `goals90`**
  (`liveScoresJob.ts:317-327`, verificado): un AET cuyo marcador/penales no
  vuelven a cambiar tras derivar goals90 tarde queda congelado con
  goals90 null hasta la finalización, que lo COPIA tal cual
  (`liveScoresJob.ts:489-494`). El caso PEN se autocorrige (cada penal
  genera versión); el AET puro no.
- **[F1-3] 🟡 `finalizeResult` copia la última versión provisional, NO el
  payload vivo** (`liveScoresJob.ts:489-494`): una corrección del scraper
  llegada exactamente en el poll de finalización queda solo en
  `externalDataJson`, no en las columnas que puntúan.
- **[F1-4] 🟡 Ventana de polling de 3h post-kickoff** (`liveScoresJob.ts:131-132`):
  una finalización muy tardía (prórroga+penales+retraso) saca el partido del
  mapa y `AWAITING_FINISH` queda eterno → solo lo rescata el stale alert.
  **Mitigación inmediata disponible: A3 del brief (`SCORES_WINDOW_POST_HOURS=4`).**
- **[F1-5] 🟡 Sin guard de monotonicidad backend**: un marcador que
  retroceda crearía versión nueva con el marcador regresado; se confía 100%
  en el contrato v2 del scraper.
- **[F1-6] 🟡 ABD finaliza como si fuera FT**: el marcador parcial queda
  `API_CONFIRMED` y nada distingue "abandonado" a nivel resultado (solo
  `externalDataJson.status`). Corrección = override + `PoolMatchOverride`
  (exclusión de scoring) pool por pool.
- **[F1-7] 🔵 Información del scraper que se pierde** (sin columna):
  halftime (solo en JSON), `timeline[]` (OMITIDO en el `externalDataJson`
  provisional — `liveScoresJob.ts:340-358`, verificado; solo persiste en la
  versión final), `actualKickoffUtc` (solo console.warn — `liveScoresJob.ts:194-205`),
  status terminal (FT vs AET vs ABD), confidence/sources.
- **[F1-8] 🟡 Timers de advancement EN MEMORIA** (`advancementTrigger.ts:26`):
  un restart del backend dentro de los 10 min de delay pierde el avance
  programado (re-verificación existe, pero el timer no se re-arma).
- **[F1-9] 🔵 Texto obsoleto en el email del stale alert**
  (`staleDetector.ts:111-112`): aún dice "el fallback de API-Football
  debería haberlo cerrado" — ese fallback está muerto (brief §0).
- **[F1-10] 🔵 No hay endpoint que escriba un resultado en TODAS las pools
  de una instancia**: el único fan-out instancia-wide es interno
  (`liveScoresJob.ts:276-291`). El override manual hoy es pool por pool
  (`PUT /pools/:poolId/results/:matchId`, que SÍ acepta goals90/penales —
  `routes/results.ts:67-78`) + email a todos los miembros si es
  HOST_OVERRIDE. El "override del 30-may" fue ese camino, sin mecanismo
  reutilizable. → Insumo directo para §6 (panel admin).

## 3. F2 — Motor de scoring por tipo de pick (agente + spot-check manual ✓)

### Verificado correcto

- ✅ El núcleo está **unificado** (ADR-069): leaderboard real
  (`poolOverviewService.ts:449-497`), email de pool completada
  (`poolStateMachine.ts:213` delega en overview), tiebreakers, y
  PlayerSummary admin usan TODOS el selector canónico
  `includeExtraTime ? goals : (goals90 ?? goals)`.
- ✅ Penales: NINGÚN camino de scoring lee `homePenalties/awayPenalties`
  (solo derivan ganador de knockout). Todos los escritores los guardan en
  campos separados.
- ✅ Fórmulas por tipo correctas (EXACT/DIFFERENCE/PARTIAL-XOR/TOTAL/
  OUTCOME/HOME/AWAY; acumulativo suma todo, legacy corta en EXACT).

### Hallazgos

- **[F2-1] 🔴 El modal de desglose por partido contradice al leaderboard
  en AET** (verificado manualmente): `poolAdminService.ts:506-508`
  construye el resultado con `currentVersion.homeGoals/awayGoals` finales
  **sin el selector** `includeExtraTime`/goals90. En una fase 90-min con
  partido AET, el leaderboard paga contra 1-1 (90') pero el modal muestra
  "Resultado 2-1" y calcula ✅/❌/puntos contra 2-1 → soporte/confianza.
- **[F2-2] 🔴 El desglose acumulativo omite EXACT_SCORE y PARTIAL_SCORE**
  que el motor SÍ suma (`scoringAdvanced.ts:130-157` vs
  `scoringBreakdown.ts:237-365`): si un host habilita esos tipos en modo
  acumulativo, los puntos mostrados en el desglose ≠ puntos reales.
- **[F2-3] 🟡 Email de fase completada con scoring HARDCODEADO 3/5 y goles
  finales** (`advancementTrigger.ts:279-305`) — no unificado con ADR-069;
  su ranking puede contradecir al leaderboard. (Viola "zero hardcoded".)
- **[F2-4] 🟡 `scoreLegacy` (email de resultado publicado) usa goles
  finales sin goals90** (`resultService.ts:274-290`): pools legacy y picks
  OUTCOME puntúan distinto en el email que en el leaderboard
  (`poolOverviewService.ts:495-496` usa 90').
- **[F2-5] 🟡 `GET /pools/:poolId/leaderboard` legacy VIVO con puntos
  hardcodeados 3/2** (`resultService.ts:515-694`), ignora todo el config.
  Verificado: **el frontend NO lo llama** (grep sin matches) — endpoint
  muerto-pero-expuesto.
- **[F2-6] 🟡 El writer de resultSync no persiste goals90**
  (`resultSync/service.ts:466-479`). HOY es inerte (API-Football
  apagado), pero es una mina si se reactiva.
- **[F2-7] 🟡 Override de host pierde goals90**: la ruta lo acepta
  opcional (`routes/results.ts:71-72`) pero el formulario del host nunca
  lo envía (F4-7) → override en partido AET borra el 90' de la nueva
  versión → scoring 90-min pasa a usar el marcador con prórroga (con
  [H-P1]: 0/14 HOST_OVERRIDE históricos tienen goals90).
- **[F2-8] 🟡 `MATCH_OUTCOME_90MIN` se evalúa al 120'** cuando
  `includeExtraTime=true` (el invocador pasa el mismo par a todos los
  tipos) — el nombre del tipo miente en esas fases.
- **[F2-9] 🟡 DECISIÓN DE PRODUCTO: por defecto las FINALES se puntúan a
  90 minutos.** Ningún preset (BASIC/CUMULATIVE) setea `includeExtraTime`
  en ninguna fase (`pickPresets.ts`), y `generateDynamicPresetConfig`
  tampoco → una final que vaya a prórroga paga contra el marcador del
  minuto 90 salvo que el host active `extraTimePhases` a mano. Además el
  toggle se salta silenciosamente con <48h al deadline o resultados
  viejos (`poolAdminService.ts:209-269`) — sin error visible al host.
- **[F2-10] 🔵 `includeExtraTime` no está en el schema Zod**
  (`validation/pickConfig.ts:75-81`): un string `"false"` sería truthy.
- **[F2-11] 🔵 `autoScaling` jamás se aplica en runtime** (solo los
  presets horneados lo evitan); config CUSTOM con multiplicadores no
  escala.

## 4. F3 — Derivaciones estructurales (agente + spot-check manual ✓)

### Verificado correcto

- ✅ Ganador de knockout por AET: usa goles totales (que incluyen
  prórroga) → correcto (`structuralAutoPublish.ts:285-288`).
- ✅ Tablas de grupo (autoPublish y stats UI) usan `goals90 ?? goals`.
- ✅ `calculateGroupStandings` implementa FIFA: puntos → DG → GF →
  head-to-head (mini-tabla) → fair play (campo nunca poblado → inerte).
- ✅ Advancement solo cuenta fuentes autoritativas
  (`advancementTrigger.ts:90-95`).

### Hallazgos

- **[F3-1] 🔴🔴 LA FINAL NUNCA SE RESUELVE POR EL CAMINO AUTOMÁTICO —
  `"final"` vs `"finals"`** (CONFIRMADO contra producción: la instancia
  WC2026 tiene phases `[..., "semi_finals", "finals"]` con
  `m_3RD@finals, m_FINAL@finals`). `advancementTrigger.ts:33` mapea
  `semi_finals → "final"` (singular, NO existe): al completarse las
  semifinales, el avance automático filtra 0 partidos de la fase destino,
  escribe el snapshot SIN cambios y **reporta éxito** (audit + emails) —
  la final y el 3er puesto quedarían con placeholders en todas las pools
  AUTO. El camino del host (`resultService.ts:439`) y el de notificaciones
  (`poolAdminService.ts:1477-1485`) usan `"finals"` correcto — hay TRES
  mapas de fases duplicados y uno está roto. Fecha de impacto: semifinales
  (~14-15 jul). Detectado con 5 semanas de margen.
- **[F3-2] 🔴 Carrera con pérdida permanente en
  `StructuralPhaseResult.resultJson.matches[]`**: read→merge→upsert sin
  transacción ni lock (`structuralAutoPublish.ts:325-355`; también
  `routes/structuralResults.ts:181-215`). Dos partidos de la misma fase
  finalizando en el mismo ciclo → el último upsert borra el winner del
  otro, y el skip idempotente impide el auto-reparo. Días de R32 con
  horarios solapados = riesgo real.
- **[F3-3] 🔴 Tablas de grupo publicadas con marcadores EN VIVO**
  (verificado: `structuralAutoPublish.ts:181` acepta cualquier
  `currentVersion`, incl. SCRAPER_PROVISIONAL de un partido en curso).
  Última jornada simultánea del Mundial: partido A confirma mientras B va
  en vivo → tabla publicada con el parcial de B → scoring Estratega paga
  contra tabla incorrecta durante la ventana. Se autocorrige al confirmar
  B, pero es visible y puntúa mal temporalmente.
- **[F3-4] 🔴 Penales EMPATADOS → gana el visitante, silencioso**
  (verificado: `poolOverviewService.ts:247-251` — `homePens > awayPens ?
  home : away` con pens iguales >0 declara away). Es el fallback del
  leaderboard cuando no hay StructuralPhaseResult; autoPublish en cambio
  alerta y no publica. Además `poolAdminService` no tiene este fallback →
  leaderboard ≠ vista admin.
- **[F3-5] 🟡 La recomputación automática PISA overrides del host** sin
  guard ni email (`autoPublishGroupStandings:207-236`,
  `autoPublishKnockoutWinner:333-355`): una tabla fijada manualmente
  (fair play/sorteo) se sobreescribe al llegar cualquier versión nueva de
  un partido del grupo.
- **[F3-6] 🟡 `transitionToCompleted` cuenta provisionales como finales**
  (`poolStateMachine.ts:140-151`: solo `currentVersionId != null`, sin
  filtrar source) + update incondicional (L154-157) → pool puede cerrarse
  (y emailear a TODOS, sin filtrar `emailNotificationsEnabled`) con el
  último partido aún en vivo; dos triggers concurrentes = doble tanda de
  emails.
- **[F3-7] 🟡 Triggers frágiles**: timers de advancement EN MEMORIA sin
  re-arme al boot (restart en la ventana de 10 min = avance perdido sin
  re-trigger); el camino del timer NO respeta `autoAdvanceEnabled` ni el
  bloqueo de erratas <24h (el camino del host sí); doble advancement
  host+timer (benigno pero duplica audit/emails);
  `persistResolvedKnockoutFixtures` escribe `instance.dataJson` con el
  snapshot del último pool (last-writer-wins entre pools).
- **[F3-8] 🔴 Mejores terceros en pools Estratega se rankean SIN
  rendimiento real** (`instanceAdvancement.ts:257-289` sintetiza standings
  con stats en CERO desde `GroupStandingsResult.teamIds`) →
  `rankThirdPlaceTeams` cae al desempate **alfabético por groupId**. En
  WC2026 los 8 mejores terceros definen el bracket de R32: las pools
  SIMPLE resolverían `3rd_POOL_*` con un criterio arbitrario distinto al
  real. Fecha de impacto: fin de fase de grupos (~25-27 jun).
- **[F3-9] 🟡 Inconsistencia de campos de goles**: advancement score-based
  usa goles TOTALES sin fallback a 90' (`instanceAdvancement.ts:307-308`)
  mientras autoPublish/stats usan `goals90 ?? goals`; y
  `generateGroupStandings` (botón del host) usa totales **y sin
  head-to-head** (`groupStandingsService.ts:390-419`) → la tabla "generada"
  puede ordenar empates distinto que la automática.
- **[F3-10] 🟡 Ensamblado de resultados estructurales divergente**:
  overview descarta `GroupStandingsResult` si existe
  `StructuralPhaseResult` de la fase (`poolOverviewService.ts:216-217`);
  admin los mergea (`poolAdminService.ts:1101-1117`) → leaderboard y vista
  admin pueden diferir.

## 5. F4 — Visualización (agente; claves verificadas por cruce con F1/F2)

### Hallazgos

- **[F4-1] 🔴 = F2-1 visto por el usuario**: `ScoringBreakdownModal`
  muestra "Resultado oficial 2-1" y puntos calculados al 120' mientras el
  leaderboard pagó al 90'.
- **[F4-2] 🟡 Un AET es invisible**: `goals90` llega al cliente
  (`lib/poolTypes.ts:128-129`) y **ningún componente lo lee**; un 2-1
  (120') es idéntico a un 2-1 (90') en MatchCard, KnockoutMatchCard,
  breakdowns y PlayerSummary. Existen llaves i18n MUERTAS de un diseño
  previo más rico (`knockoutCard.ninetyMin`, `byPenalties`,
  `result.provisional` — en los 3 locales).
- **[F4-3] 🟡 Sin badge provisional**: `resultSource` viaja y muere como
  prop no usado (`ResultComponents.tsx:14`); TODO resultado se rotula
  "Resultado oficial (vN)" incluso siendo SCRAPER_PROVISIONAL en vivo.
- **[F4-4] 🟡 El jugador nunca sabe si su pick puntúa a 90' o 120'**
  (`PickRulesDisplay.tsx`: cero menciones a prórroga). Solo el host lo ve
  (wizard/admin).
- **[F4-5] 🔵 Estados en vivo colapsados**: 1H/2H/ET/P → badge genérico
  "EN VIVO"; sin label de prórroga ni tanda de penales en curso.
- **[F4-6] 🔵 Medio tiempo capturado pero jamás mostrado** (solo
  `lastLiveDataJson` volátil); la página de marketing /como-se-juega lo
  PROMETE (mock con "Medio tiempo: 1-0").
- **[F4-7] 🟡 El editor de resultados del host no tiene campo goals90**
  (la API sí lo acepta) → origen de F2-7. Además knockout detectado por
  heurística `!phaseId.includes("group")` (`ResultComponents.tsx:318`).
- **[F4-8] 🔵 MatchCard muestra penales sin exigir empate en goles**
  (inconsistente con KnockoutMatchCard; edge de datos corruptos visible).
- ✅ i18n: paridad completa es/en/pt en todas las llaves de resultado.
- ✅ Polling en vivo: 15s vía overview completo cuando hay match live.

## 6. Panel admin de monitoreo + override master — evaluación

**Veredicto: viable y recomendado; es la respuesta natural a la decisión
A2 del brief ("cierre administrativo visible en UI") y NO es un proyecto
grande porque las piezas existen:**

- **Lectura (monitoreo):** todo ya está capturado — scraper
  `GET /scores/live` (status, marcador, confianza, fuentes, elapsed),
  `MatchSyncState` (syncStatus, grace, lastLiveDataJson), `track/status`,
  y el precedente `GET /admin/health/deep`. Falta solo un endpoint
  read-only que los junte por partido + una página admin.
- **Escritura (override master):** el fan-out instancia→todas-las-pools ya
  existe como patrón interno (`liveScoresJob.ts:276-291`); el versionado
  HOST_OVERRIDE con reason + jerarquía que el scraper respeta
  (`liveScoresJob.ts:309-314`) ya blinda el override contra
  sobre-escrituras del scraper. Lo que NO existe es el endpoint
  instancia-wide (hoy el override es pool por pool — F1-10) ni la UI.
- **Diseño clave (de los hallazgos):** el formulario DEBE capturar
  goals90 + penales (cierra F2-7/F4-7), opción de "override silencioso"
  (sin email masivo — precedente 30-may), decisión sobre pools donde el
  host ya hizo su propio override (¿respetar o pisar? propuesta:
  respetar y listar), y razón obligatoria + audit.
- **Estimación honesta:** backend ~1 día (GET monitor + POST master
  override con fan-out reutilizando `publishResult` por pool + tests),
  frontend ~1-1.5 días (página /admin con tabla en vivo + modal de
  override), docs ~½ día. **Total ~2.5-3 días.** Solo-lectura primero
  (½ día) si se quiere partir en dos.

## 7. Resumen ejecutivo y plan propuesto (REQUIERE APROBACIÓN)

**Totales: 8 hallazgos 🔴, 18 🟡, 8 🔵.** El núcleo del scoring está bien
diseñado y unificado (ADR-069 hizo su trabajo); los problemas viven en
(a) los BORDES del flujo (breakdowns, emails secundarios, fallbacks),
(b) las DERIVACIONES estructurales bajo concurrencia/fases tardías, y
(c) la VISIBILIDAD (provisional/AET/penales invisibles para el usuario).
Nada de lo 🔴 afecta la fase de grupos que arranca HOY salvo F3-3
(última jornada, ~24-jun) — hay margen, pero el reloj del Mundial corre.

### P0 — esta semana (antes de que la fase de grupos avance)
1. **F3-1** fix `"final"`→`"finals"` + unificar los 3 mapas de fases
   duplicados en una constante única (cierra la clase entera de bug).
2. **F3-4** penales empatados en el fallback del overview: alertar, no
   inventar ganador.
3. **A3 del brief** (`SCORES_WINDOW_POST_HOURS=4`, env) — sigue pendiente
   del go de ayer.

### P1 — antes de la última jornada de grupos (~24-jun) y de R32 (~28-jun)
4. **F3-3 + F3-5**: gate de fuente autoritativa para publicar tablas +
   no pisar overrides del host.
5. **F3-2**: transacción/lock en el merge de `StructuralPhaseResult`.
6. **F3-8**: terceros Estratega con rendimiento real (derivar stats de los
   marcadores, no ceros).
7. **F3-6**: `transitionToCompleted` exige fuente autoritativa + update
   condicional (y filtrar `emailNotificationsEnabled` en el batch).
8. **F2-1/F4-1**: selector includeExtraTime/goals90 en el breakdown.
9. **F2-7/F4-7**: campo goals90+penales en el editor de override del host
   (o llega vía el panel admin).
10. **F3-7**: re-armar timers de advancement al boot (job de barrido) +
    respetar `autoAdvanceEnabled`/erratas en el camino del timer.

### P2 — calidad (durante el torneo, sin deadline duro)
11. Panel admin de monitoreo + override master (§6, ~2.5-3 días).
12. Badges UI: provisional / AET ("90': 1-1") / penales / prórroga en vivo
    (las llaves i18n muertas ya existen).
13. **F2-9 decisión de producto**: ¿finales a 90' por defecto es lo
    deseado? + informar al jugador (F4-4).
14. Emails secundarios unificados (F2-3, F2-4), desglose acumulativo
    completo (F2-2), endpoint leaderboard legacy (F2-5), validación Zod
    (F2-10), texto stale obsoleto (F1-9), A4 del brief (0-0 NS).

## 7.1 Plan de implementación RECOMENDADO (etapas por calendario del torneo)

> Cada etapa = commits atómicos + tests + deploy + verificación con los
> partidos reales del día. Ninguna etapa arranca sin cerrar la anterior.
> El calendario manda: grupos hasta ~27-jun (última jornada simultánea
> ~24-27), R32 desde ~28-jun (primera prórroga/penales posible),
> semis 14-15 jul, final 19-jul.

### Etapa 0 — HOY (1-2h de trabajo, riesgo ~cero, valor máximo) — ✅ EJECUTADA
| Ítem | Hallazgo | Estado |
|---|---|---|
| `SCORES_WINDOW_POST_HOURS=4` (env, sin código) | F1-4 / A3 brief | ✅ aplicada y verificada en Railway |
| Fix F3-1: **mapas hardcodeados eliminados** — la fase siguiente se deriva del `phases[].order` real del fixture (`lib/fixture.getNextPhaseId`), reemplazando los 3 mapas duplicados (`advancementTrigger`, `resultService.handleAutoAdvance`, `poolAdminService.getPoolNotifications`). Decisión sobre el plan original: un mapa unificado de NOMBRES seguía siendo frágil — verificado contra prod que UCL (ACTIVE) usa `final` singular + fases por leg que ningún mapa cubría; derivar del fixture mata la clase entera | F3-1 🔴🔴 | ✅ + 7 tests (regresión F3-1 incluida, UCL legs, desorden, malformed) |
| Penales empatados en fallback del overview: sin ganador (sin alerta aquí — corre en cada request de overview; el camino autoritativo es dueño de la alerta) | F3-4 🔴 | ✅ |
| Texto obsoleto del stale alert | F1-9 🔵 | ✅ |

Verificación Etapa 0: typecheck limpio; suite 4 archivos fallando = los
pre-existentes conocidos (email/pickPresets/serializers/paymentService),
cero fallas nuevas.

### Etapa 1 — Esta semana, antes del 16-jun (~1 día): derivaciones a prueba de última jornada — ✅ EJECUTADA (mismo día)
| Ítem | Hallazgo | Estado |
|---|---|---|
| Gate de fuentes FINALES (`FINAL_RESULT_SOURCES` en constants — incluye HOST_MANUAL para pools MANUAL; dedupea también los sets inline de advancementTrigger) en tablas Y winners | F3-3 🔴 | ✅ |
| No pisar overrides estructurales del host: tablas detectadas por `reason` (errata obligatoria; el sistema nunca lo escribe), winners por marker `source:"HOST"` en el entry del PUT; skip + audit `*_AUTO_RECOMPUTE_SKIPPED` | F3-5 🟡 | ✅ |
| `transitionToCompleted`: fuente FINAL + `updateMany WHERE status=ACTIVE` (carrera de doble email) + filtro `emailNotificationsEnabled` (solo destinatarios; ranking sigue saliendo de getPoolOverview) | F3-6 🟡 | ✅ + 3 tests de regresión |
| Tx + `pg_advisory_xact_lock(pool:phase)` en el merge de `StructuralPhaseResult.matches[]` (auto-publisher Y PUT del host) | F3-2 🔴 | ✅ |
| Suprimir publicación provisional con status `NS` (0-0 pre-kickoff) | A4 brief | ✅ |

Verificación Etapa 1: typecheck limpio; suite 720 pass / 19 fallas
pre-existentes conocidas (cero nuevas).

### Etapa 2 — Semana 16-22 jun (~1.5 días): listos para eliminatorias (R32 28-jun)
| Ítem | Hallazgo |
|---|---|
| Terceros Estratega con stats reales (derivar de marcadores, no ceros) | F3-8 🔴 |
| goals90 robusto: finalize re-deriva del payload vivo + dedupe incluye goals90 + alerta si AET con goals90 null | F1-1/2/3 🔴 |
| Breakdown: selector includeExtraTime/goals90 + tipos faltantes en acumulativo | F2-1/F2-2 🔴 |
| Editor de override del host: campos goals90 + penales | F2-7/F4-7 🟡 |
| Advancement resiliente: re-arme al boot + respetar autoAdvanceEnabled/erratas en camino del timer | F3-7 🟡 |

### Etapa 3 — Panel admin (semanas 16-29 jun, ~3 días, ideal ANTES de R32)
- **3A (~1 día):** monitoreo read-only — `GET /admin/matches/monitor`
  (partidos del día × {syncStatus, marcador, confianza, fuentes, minuto,
  grace, última actualización}) + página admin con auto-refresh.
- **3B (~1.5 días):** override master instancia-wide — marcador + goals90 +
  penales + razón obligatoria, fan-out a todas las pools ACTIVE
  (reutilizando `publishResult` por pool), opción "silencioso" (sin email
  masivo), **respeta pools donde el host ya hizo override** (los lista),
  audit completo. Cierra la decisión A2 del brief.
- **3C (~½ día):** acciones rápidas — re-track, excluir de scoring (ABD),
  ver fuentes del scraper.

### Etapa 4 — Visibilidad + decisiones de producto (durante grupos, ~1.5 días)
| Ítem | Hallazgo |
|---|---|
| Badge provisional / "90': X-X" en AET / penales / estados ET-P en vivo (las llaves i18n muertas ya existen ×3 locales) | F4-2/3/5 🟡 |
| Informar al jugador 90' vs 120' (PickRulesDisplay + cards) | F4-4 🟡 |
| Emails secundarios unificados con ADR-069 | F2-3/F2-4 🟡 |
| Endpoint leaderboard legacy: deprecar (410) | F2-5 🟡 |
| Zod para includeExtraTime; A4 (suprimir 0-0 NS — recomendado SÍ) | F2-10 🔵 / A4 |

### Fuera de alcance deliberado (post-Mundial)
Halftime end-to-end (columna + UI — F4-6/H-P3), guard de monotonicidad
backend (F1-5), marcado de ABD a nivel resultado (F1-6), persistir
timeline/actualKickoffUtc (F1-7), autoScaling runtime (F2-11),
resultSync goals90 (F2-6, inerte).

### Decisiones del owner requeridas ANTES de su etapa
1. **Go por etapa** (puedo arrancar Etapa 0 ya).
2. **F2-9:** ¿finales a 90' (default actual) o con prórroga? Mi
   recomendación: NO cambiar las pools activas (las reglas son inmutables
   con jugadores dentro y cambiar el criterio a mitad de torneo es
   injusto) — sí informar claramente al jugador (Etapa 4) y dejar la
   decisión de default para presets nuevos post-Mundial.
3. **A4:** suprimir publicación del 0-0 pre-kickoff (recomendado sí, 2
   líneas, entra en Etapa 1).
4. **Panel:** ¿3A+3B+3C completo, o solo 3A primero y decides 3B viendo
   el monitoreo?

## 8. Bitácora

- 15:1xZ — 4 agentes de exploración lanzados (F1-F4).
- 15:2xZ — Sonda de producción ejecutada; hallazgos H-P1..H-P3 registrados.
- 15:3x-16:0xZ — Informes F1-F4 recibidos; spot-check manual de los 7
  hallazgos más críticos (F1-1/2, F2-1, F3-1 [confirmado contra los
  phaseIds reales de producción], F3-3, F3-4, F2-5-frontend). Documento
  completado. **A LA ESPERA DE APROBACIÓN DEL OWNER — cero código tocado.**
