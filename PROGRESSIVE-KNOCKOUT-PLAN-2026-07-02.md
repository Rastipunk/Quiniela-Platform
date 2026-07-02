# Plan quirúrgico: apertura progresiva de fases knockout + 3er/4to puesto

> **Fecha:** 2026-07-02 · **Estado:** ✅ EJECUTADO (ADR-087). Commits `2edafca` (backend) + `6b8a934` (frontend) + `7360649` (fix mappings), deploy verificado. round_of_16 liberado progresivamente el mismo día (5/8 cruces resueltos, 465/465 pools verificadas, mappings+sync creados). Ver ADR-087 en DECISION_LOG.md para el registro canónico.
> **Regla:** cero suposiciones. Cada afirmación de §1 está verificada contra la DB de producción,
> `archivo:línea` del repo, o ≥2 fuentes externas. Nada se implementa sin aprobación; nada se marca
> hecho sin commit + test + deploy verificado (lección ADR-086).

---

## §1 Diagnóstico (todo verificado)

### 1.1 Fechas y horas de las fases restantes — CORRECTAS, nada que corregir
Verificado contra Yahoo Sports, CBS Sports, NBC Sports, SI, worldcupwiki y FIFA.com (2026-07-02):

| Partido | dataJson | Fuentes externas | ✓ |
|---|---|---|---|
| m_R16_1 Paraguay–Francia | 04-jul 21:00Z | Filadelfia 5pm ET | ✓ |
| m_R16_2 Canadá–Marruecos | 04-jul 17:00Z | Houston 1pm ET | ✓ |
| m_R16_3 Brasil–Noruega | 05-jul 20:00Z | E. Rutherford 4pm ET | ✓ |
| m_R16_4 México–Inglaterra | 06-jul 00:00Z | CDMX 8pm ET | ✓ |
| m_R16_5 (POR/CRO–ESP/AUT) | 06-jul 19:00Z | Arlington 3pm ET | ✓ |
| m_R16_6 USA–Bélgica | 06-jul 21:00Z | Seattle 5pm ET | ✓ |
| m_R16_7 (ARG/CPV–AUS/EGY) | 07-jul 16:00Z | Atlanta 12pm ET (match 95) | ✓ |
| m_R16_8 (SUI/ALG–COL/GHA) | 07-jul 20:00Z | Vancouver 4pm ET (match 96) | ✓ |
| m_QF_1..4 | 09-jul 20:00Z · 10-jul 19:00Z · 11-jul 21:00Z · 12-jul 01:00Z | Boston 4pm · LA 3pm · Miami 5pm · KC 9pm ET | ✓ |
| m_SF_1/2 | 14/15-jul 19:00Z | Dallas/Atlanta 3pm ET | ✓ |
| m_3RD | 18-jul 21:00Z | Miami 5pm ET (match 103) | ✓ |
| m_FINAL | 19-jul 19:00Z | MetLife 3pm ET | ✓ |

### 1.2 "Tercero y cuarto" — YA EXISTE y está cubierto end-to-end
- `m_3RD "Tercer Lugar" (L_SF_1 vs L_SF_2)` vive DENTRO de la fase `finals` (2 partidos: bronce + final).
- **465/465 pools** tienen config de `finals` que puntúa ambos partidos (verificado en DB): score pools gradúan marcador de m_3RD y m_FINAL; estratega da `pointsPerCorrectAdvance` por acertar el ganador de CADA uno.
- `resolveKnockoutPlaceholders` soporta `L_` (tournamentAdvancement.ts:454-457,465-468); la constante canónica `PLACEHOLDER_TEAM_PREFIXES` incluye `L_` (constants.ts:250-256, con test).
- Regla FIFA 2026 verificada (Al Jazeera/SI/FOX): el bronce SÍ tiene tiempo extra + penales, igual que todo knockout → la config compartida de extra-time de `finals` es semánticamente correcta para ambos.

**Decisión requerida (recomendación: NO separar en fase propia).** Separarlo implicaría: mutar `pickTypesConfig` de 465 pools ACTIVAS (choca con el invariante 3 de inmutabilidad de reglas), re-escribir 465 `fixtureSnapshot`, y tocar el inventario completo de listas hardcoded (§1.5). Riesgo alto a mitad de torneo, valor de jugador nulo: los jugadores YA van a poder predecir el 3er puesto. Lo que sí haremos: presentación digna (placeholder "Perdedor de Semifinal 1/2", ver §2.B).

### 1.3 Motor de advancement — capaz de per-match; el barrier son 3 puntos
- `resolveKnockoutPlaceholders` resuelve por-partido y tolera parciales ✓.
- **Barrier 1:** `checkAndTriggerAdvancement` (advancementTrigger.ts:73-98) exige fase COMPLETA para agendar.
- **Barrier 2:** `advanceKnockoutPhase` lanza error si falta un resultado (instanceAdvancement.ts:650-654 estructural, :684-688 score).
- **Barrier 3 (reconciliación):** el guard ADR-084 (`isKnockoutPhaseReleased`) bloquea el path per-pool en fases liberadas — diseñado para proteger el bracket revisado; en modo progresivo se vuelve el mecanismo que apaga el path legacy automáticamente (§2.A.5).
- Estado actual: 10/16 R32 finalizados → m_R16_1/2/3/4/6 ya son 100% decidibles.
- Los resultados existen en TODAS las pools (incl. estratega) vía `publishScraperResult` → un resolver a nivel instancia puede derivar winner/loser de una pool de referencia con fuente FINAL.

### 1.4 Gating de predicciones — asimetría score vs estratega (hueco real)
- **Score picks:** `pickService.ts:218-223` bloquea placeholder (`MATCH_PENDING` 409) ANTES e independiente del gate ADR-084 → per-match gating YA existe ✓.
- **Estratega:** `structuralPicks.ts` NO valida placeholders (el merge :204-227 guarda lo que llegue) y el UI (`KnockoutMatchCard` vía `StructuralPicksManager.tsx:513-519`) muestra fallback **"TBD" hardcoded** y **permite pickear a TBD** (TeamPickButton solo se deshabilita por lock/deadline). Hoy lo tapa el `PHASE_NOT_RELEASED`; al abrir progresivamente quedaría expuesto → **hay que cerrarlo**.
- Front: `derivePhaseState` (poolHelpers.ts:191-213) marca la fase PENDING si CUALQUIER partido tiene placeholder → con apertura progresiva debe pasar a OPEN cuando la fase esté released, gobernando cada partido por su propio estado.
- El front no maneja los errores `PHASE_NOT_RELEASED`/`MATCH_PENDING` (0 ocurrencias) — confía en el estado derivado.

### 1.5 Inventario de riesgo (por qué NO agregar un phaseId nuevo)
Listas/switches hardcoded que se romperían con un phaseId nuevo: `poolOverviewService.ts:301` (lista knockout completa), `resultService.ts:423,444` (patrones que disparan advance), `poolAdminService.ts:116-126,155-160`, `pickPresets.ts:7-26` + presets, `PHASE_DISPLAY_NAMES` (constants.ts:236-247), front `ScoringEditor.tsx:103-106,1495-1509`, `exportLeaderboard.ts:39-57`, i18n `phases.*`/`phasesLong.*` es/en/pt. — Con la recomendación §1.2 este inventario NO se toca.

### 1.6 Divergencias de placeholder detectadas (bugs latentes a unificar)
- `fixtureTrackingJob.ts:34-36`: reimplementa el check SIN `L_` ni `t_TBD` → un `m_3RD` no resuelto que entre en la ventana de tracking se enviaría al scraper con "L_SF_1" como nombre de equipo.
- Otras reimplementaciones locales con divergencias menores: `advancementTrigger.ts:390-393` (`3rd_POOL_` estrecho), `deadlineReminderService.ts:144-152`, `poolAdminService.ts:1739-41`, `schemas/templateData.ts:86-90`. → unificar a `isPlaceholderTeamId`/`PLACEHOLDER_TEAM_PREFIXES` canónicos.

---

## §2 Plan de acción (3 PRs + catch-up, en orden)

### PR-1 · Backend: resolver progresivo por partido (corazón)
1. **`progressiveKnockoutResolver.ts` (nuevo, instance-level):** al finalizar un partido knockout (hook junto a `checkAndTriggerAdvancement` en liveScoresJob:729, y también invocable tras HOST_OVERRIDE masivo), con dedupe idempotente:
   a. Deriva winner/loser del partido recién finalizado (pool de referencia, fuente ∈ FINAL_RESULT_SOURCES; empate→penales; empate en penales → NO resuelve, alerta existente).
   b. Sustituye `W_<matchId>`/`L_<matchId>` en `instance.dataJson` (puede alimentar 2 slots: p.ej. m_SF_x alimenta m_FINAL y m_3RD).
   c. Propaga a los `fixtureSnapshot` de todas las pools (reutiliza el patrón `propagateBracketToPools`, respeta `knockoutBracketOverrides` del admin).
   d. `ensureKnockoutSyncPlumbing` para el/los partidos que quedaron completos (mapping + MatchSyncState) — sync con scores garantizado por partido (ADR-086).
   e. **Auto-release:** si es el PRIMER partido resuelto de su fase → agrega el phaseId a `releasedKnockoutPhases` + dispara `sendPhaseSummaryBroadcast` (revisar copy para estado parcial: "los cruces se irán habilitando a medida que se definan").
2. **El gate ADR-084 se conserva** como mecanismo (sigue gobernando `PHASE_NOT_RELEASED`); solo cambia QUIÉN lo setea para R16+ (el resolver, no el admin). El panel admin de fases + overrides quedan como válvula manual de emergencia.
3. **Path legacy per-pool queda auto-apagado** para la WC: al liberar la fase en el primer partido, el guard existente (`isKnockoutPhaseReleased`) bloquea `advanceKnockoutPhase`/trigger viejo. Instancias sin gate (UCL) siguen con el flujo actual intacto.
4. **Cerrar hueco estratega:** validación `MATCH_PENDING` en `structuralPicks.ts` para picks sobre partidos con placeholder (espejo de pickService:218-223).
5. **Unificar checks de placeholder** divergentes (§1.6) a la constante canónica — fija de paso el bug latente del 3er puesto en fixtureTracking.
6. Tests vitest: resolver (parciales, W_/L_, doble slot de semis, idempotencia, empate-en-penales), validación estructural, unificación.

### PR-2 · Frontend: placeholders legibles + apertura por partido
1. **"Ganador del partido X vs Y":** enriquecer `getPlaceholderName` (poolHelpers.ts:215-236): `W_R32_11` → busca m_R32_11 en el snapshot → "Ganador de España vs Austria" (equipos ya resueltos); si el feeder aún tiene placeholders → fallback al label del partido ("Ganador de Octavos · Partido 5"). `L_SF_1` → "Perdedor de Semifinal 1". Keys nuevas es/en/pt.
2. **Estratega:** `StructuralPicksManager`/`KnockoutMatchCard`: eliminar "TBD" hardcoded → usar el mismo placeholder enriquecido; **deshabilitar** `TeamPickButton` cuando el equipo sea placeholder (con hint "se habilita cuando se defina el cruce").
3. **`derivePhaseState`:** fase released → OPEN aunque haya placeholders (cada MatchCard ya gobierna su propio estado); banner nuevo "Los cruces se van habilitando a medida que se definen" para fases parcialmente resueltas.
4. Score pools ya están cubiertos (MatchCard placeholder-aware, banner "Partido Pendiente") — solo se benefician del nombre enriquecido.

### PR-3 · Catch-up + verificación en producción (con tu regla de oro)
1. Ejecutar el resolver para los R32 ya finalizados → resuelve m_R16_1/2/3/4/6 (+los que caigan hoy/mañana), crea mappings/sync rows, libera `round_of_16`.
2. **Probar primero con juan.k** (email de fase + UI con cruces parciales) → luego autorizar el broadcast.
3. Checklist prod: instance.dataJson + 465 snapshots con octavos resueltos; mappings/sync rows de los 5+; picks score/estratega habilitados SOLO en resueltos; placeholder legible en pendientes; `MATCH_PENDING` en estructural.
4. Docs: ADR-087 + TOURNAMENT_SYSTEM.md + CHANGELOG.

### Fuera de alcance (decidido en §1.2)
Separar 3er/4to como fase propia. El bronce ya fluye por `finals` con todo el pipeline (predicciones, scoring ambas modalidades, ET correcto, sync, emails).

## §3 Riesgos y mitigaciones
- **Resolver escribe mal un cruce** → deriva SOLO de fuentes FINAL + respeta overrides admin + válvula manual del panel de fases + los 13 tests del gate del scraper aguas arriba.
- **Estampida de emails** (fase liberada con 1 solo cruce) → un solo broadcast por fase (idempotente `phaseSummaryEmailedPhases` ya existente), copy adaptado a estado parcial.
- **Doble escritura legacy/progresivo** → imposible por el guard ADR-084 (release al primer partido apaga el path viejo).
- **Deadline "born-closed"** → no aplica: los cruces se resuelven días antes del kickoff; ADR-085 permite al host ajustar si acaso.
