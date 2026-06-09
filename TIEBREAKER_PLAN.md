# Plan — Desempates del leaderboard + posición compartida (seguimiento)

> **Estado:** PLANEACIÓN / SEGUIMIENTO. **No se escribe código** hasta que
> las decisiones `POR CONFIRMAR` (§3) estén cerradas y des el "go".
> Todo verificado contra el código real (`main`) con `archivo:línea`.
> Sin suposiciones: lo no confirmado está marcado, no asumido.
>
> Leyenda de seguimiento: `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

---

## 1. Objetivo

Cuando varios jugadores empatan en puntos, decidir la posición de forma
**justa y config-agnóstica**, y cuando el empate persiste, **compartir la
posición** dejando el desempate final a la organización. Mostrarlo de forma
**transparente** en la tabla y en las **Reglas** (ES/EN/PT).

---

## 2. Regla de desempate (DECISIÓN CERRADA del owner)

Orden de criterios:
1. **Puntos totales** (desc).
2. **Cantidad de partidos con acierto PERFECTO** (desc).
3. **Cantidad de partidos con algún acierto PARCIAL** (desc).
4. Si persiste → **comparten la posición**; el desempate final lo decide la
   **organización** (fuera del sistema).

Restricción cerrada: **no se modifica** la lógica del Marcador parcial ni la
del scoring por tipo. Esto es solo orden + posición + transparencia.

---

## 3. Decisiones (CERRADAS por el owner, 2026-06-08)

- **D1 — "Acierto perfecto" `[x]`:** el jugador obtuvo el **MÁXIMO
  ALCANZABLE** de ese partido = puntos de una predicción **igual al
  resultado real** evaluada con `scoreMatchPick` (config-agnóstico, correcto
  en acumulativo y legacy, respeta el XOR del parcial). **NO** se usa
  `calculateMaxPointsForPhase` (sobreestima — ver §4.1).
- **D2 — "Acierto parcial" `[x]`:** `0 < puntos < máximo_alcanzable`. En
  modos "todo o nada" (solo marcador exacto) parcial es imposible → no aplica.
- **D3 — Estructural INCLUIDO, por unidades acertadas `[x]`:** las fases
  estructurales SÍ aportan a perfecto/parcial, contando **unidades**
  (decisión + ejemplo del owner: "el que acertó 5 [en 16avos] debe estar
  arriba"). Definición precisa (datos ya existen en `StructuralBreakdown`):
  - **Perfecto** += `perfectGroups` (grupos perfectos) + `Σ
    winnersByPhase[].correct` (ganadores de eliminatoria acertados).
  - **Parcial** += grupos con `0 < positionsCorrect < positionsTotal` y no
    perfectos. (Eliminatorias son binarias → solo perfecto o nada.)
  - Sin doble conteo: una fase es por-marcador **o** estructural, nunca
    ambas (`scoringAdvanced` vs `structuralScoring`).
- **D4 — Columnas de desempate `[x]`:** mostrar **Perfectos** siempre que
  exista alguna unidad perfecta posible; mostrar **Parciales** **solo** si el
  modo puede producir parcial (oculta en solo-exacto / solo-eliminatoria).
- **D5 — Posición compartida `[x]`:** convención **"1-2-2-4"** (dos
  empatados en 1º, el siguiente 3º).
- **D6 — Unificar ranking del email de cierre `[x]`:** una **única función
  de ranking** usada por leaderboard Y email (`poolStateMachine.ts:218-236`
  hoy diverge — se reemplaza su scoring inline).
- **D7 — Blindaje del catálogo `[x]`:** agregar
  `TournamentInstance.isTest Boolean @default(false)` (migración aditiva) y
  filtrar el catálogo por `isTest:false`. Una instancia de prueba **nunca**
  aparece, aunque quede ACTIVE.

---

## 4. Diseño técnico (verificado)

### 4.1 Cálculo de perfecto/parcial (backend)
En el loop existente de `poolOverviewService.ts` (que ya evalúa cada partido
por jugador), por cada **partido con resultado** de una fase **por marcador**:
- `maxForMatch = scoreMatchPick({homeGoals,awayGoals}=resultado, resultado, faseConfig).totalPoints` (una vez por partido, cacheado).
- `earned` = puntos del jugador en ese partido (ya se calcula).
- `perfect` si `maxForMatch > 0 && earned === maxForMatch`.
- `partial` si `0 < earned < maxForMatch`.
- Acumular `perfectCount` / `partialCount` por jugador.
- Marca por pool `partialApplicable` = ∃ fase donde `maxForMatch` se puede
  alcanzar en >1 escalón (si no, ocultar columna parcial — D4).

**Estructural (D3)** — usando `computeStructuralBreakdown` (datos ya
existentes), sumar a los mismos contadores:
- `perfectCount += breakdown.perfectGroups + Σ breakdown.winnersByPhase[*].correct`.
- `partialCount += nº de grupos con 0 < positionsCorrect < positionsTotal y no perfectos`.
- `perfectApplicable` true si hay grupos o eliminatorias; `partialApplicable`
  true solo si hay GROUP_STANDINGS (las eliminatorias no generan parcial).
- Total final por jugador: `perfectCount` y `partialCount` = suma de
  marcador + estructural. Sin doble conteo (fase es de un solo tipo).

> Nota (verificada): NO usar `calculateMaxPointsForPhase`
> (`scoringAdvanced.ts:409`) como "máximo": en acumulativo suma **todos** los
> tipos (incl. parcial) y **sobreestima** el máximo real (el parcial es XOR,
> no convive con el acierto pleno). Además esa función hoy **no se usa en
> ningún lado** (confirmado por búsqueda). Por eso D1 usa la simulación.

### 4.2 Fuente única de ranking (backend)
Nuevo módulo `lib/leaderboardRanking.ts` con `rankLeaderboardRows(rows)`:
- Ordena por: **points desc → perfectCount desc → partialCount desc →
  joinedAtUtc asc** (último solo para orden estable, no es criterio
  "visible").
- Asigna `rank` con **posición compartida** (D5, "1-2-2-4"): filas con la
  misma tripleta `(points, perfectCount, partialCount)` reciben el **mismo
  `rank`**; el siguiente grupo salta a `índiceGlobal + 1`.
- Devuelve además `tiedGroupSize` por fila (para marcar empates en la UI).
- Usada por `poolOverviewService` **y** `poolStateMachine` (email) — elimina
  la divergencia (D6).

### 4.3 Respuesta de API (backend)
`leaderboard.rows[]` añade: `perfectCount`, `partialCount`, `isTied`
(o `tiedGroupSize`). `leaderboard` añade meta: `tiebreakers: { perfect:
true, partial: <partialApplicable> }`.

### 4.4 Frontend (`PoolLeaderboardTab.tsx`)
- Render de columnas/sub-línea de desempate **condicional** (D4).
- Posiciones compartidas: mismo número de rango para el grupo empatado;
  nota "Empate — lo define la organización" cuando el grupo comparte un
  puesto con relevancia (mínimo el 1º).
- **Responsive primero** (360–430px), sin `100vw`; en móvil los desempates
  como sub-línea bajo el nombre.

### 4.5 Reglas (i18n ES/EN/PT)
Nota al final de Reglas (`messages/{es,en,pt}/pool.json`, render en
`PickRulesDisplay`):
> En caso de empate de puntos, la posición se decide por (1) más partidos
> con predicción **perfecta**, luego (2) más partidos con **acierto
> parcial**. Si el empate continúa, los jugadores **comparten la posición**
> y el desempate final lo define la organización.

---

## 5. Implementación — paso a paso (commits) `[ ]`

> Cada commit: `tsc` + tests verdes; build donde toque frontend. Atómico.

- **C1 — Núcleo de ranking + métricas (backend)** `[ ]`
  - `lib/leaderboardRanking.ts` (`rankLeaderboardRows`, posición compartida).
  - `poolOverviewService`: calcular `perfectCount`/`partialCount`/
    `partialApplicable`; usar `rankLeaderboardRows`; exponer en la respuesta.
  - Tests unitarios de `leaderboardRanking` (ver §7) + de perfecto/parcial
    (acumulativo, solo-exacto, XOR del parcial, empate total).
  - Criterio de aceptación: ranking y conteos correctos en los 6 escenarios
    de §7; sin cambios de puntaje.
- **C2 — Unificar ranking del email de cierre (backend)** `[ ]` *(si D6=SÍ)*
  - `poolStateMachine`: reemplazar el scoring inline por la fuente única;
    usar `rankLeaderboardRows`. Test de paridad leaderboard↔email.
- **C3 — Frontend tabla de posiciones** `[ ]`
  - Columnas/sub-línea condicionales (D4) + posiciones compartidas + nota de
    empate + responsive. Sin hardcodes.
- **C4 — Reglas i18n (ES/EN/PT)** `[ ]`
  - Nota de desempate en las 3 locales (regla i18n: las 3 en el mismo commit).
- **C5 — Blindaje catálogo (schema)** `[ ]` *(si D7=SÍ)*
  - `TournamentInstance.isTest Boolean @default(false)` (migración aditiva).
  - `catalog.ts`: filtrar `where: { status: "ACTIVE", isTest: false }`.
  - Test: instancia `isTest=true` NO aparece en `/catalog/instances`.
- **C6 — Docs** `[ ]`
  - ADR nuevo (criterios de desempate + posición compartida + fuente única
    de ranking + blindaje catálogo). `BUSINESS_RULES` (sección leaderboard).
    `CHANGELOG`. Cerrar este plan.

---

## 6. Protocolo de prueba SEGURO (anti-incidente) `[ ]`

### 6.1 Causa raíz verificada del incidente anterior
- `catalog.ts:14-16`: el catálogo expone **toda** instancia `status:
  "ACTIVE"`, orden `createdAtUtc desc` → una instancia de prueba en ACTIVE
  aparece **de primera** para todos. (Sin separación test/prod.)
- `pools.ts:92-98`: crear pool acepta instancia por **ID** salvo `ARCHIVED`
  → una instancia en **`DRAFT`** sirve para probar SIN salir en el catálogo.

### 6.2 Pasos seguros (cada uno con verificación)
- `[ ]` **P0 — Pre-flight:** `GET /catalog/instances` y guardar la lista
  actual (para comparar al final). Confirmar cuántas ACTIVE hay.
- `[ ]` **P1 — Crear instancia de prueba con `isTest:true`** (D7, mecanismo
  definitivo → el catálogo la filtra siempre). Nombre inequívoco:
  `TEST — Desempates (NO USAR)`. *Interino antes del push:* como la columna
  `isTest` no existe en prod hasta desplegar C5, se crea en `DRAFT` y se
  marca `isTest:true` apenas C5 esté desplegado — sin ventana de exposición.
- `[ ]` **P2 — Verificar invisibilidad:** `GET /catalog/instances` **no**
  debe listar la instancia de prueba.
- `[ ]` **P3 — Crear pool(s) de prueba por API directa** con el `id` de la
  instancia (script/usuario de prueba), **sin** el wizard y **sin** flipear
  a ACTIVE.
- `[ ]` **P4 — Inscribir 3–4 usuarios de prueba** y cargar **predicciones**.
- `[ ]` **P5 — Cargar resultados manualmente** (HOST/admin) para forzar los
  escenarios de §7 (no se necesita scraper ni instancia ACTIVE).
- `[ ]` **P6 — Validar** leaderboard, conteos, posiciones compartidas, email
  de cierre y Reglas en los 3 idiomas, en móvil 360–430px.
- `[ ]` **P7 — Limpieza:** `ARCHIVED` o borrar instancia + pools de prueba.
- `[ ]` **P8 — Post-flight:** `GET /catalog/instances` debe ser **idéntico**
  a P0 (la de prueba no quedó). Confirmar.

> D7 = SÍ (confirmado): `isTest` es el blindaje a nivel de código — una
> instancia de prueba nunca aparece en el catálogo, aunque quede ACTIVE.

---

## 7. Escenarios de testing (esperado) `[ ]`

> Cada escenario = una pool de prueba con config y resultados fijos.

- `[ ]` **E1 — Acumulativo, sin empate:** 3 jugadores con puntos distintos →
  rangos 1,2,3; sin columna especial necesaria.
- `[ ]` **E2 — Empate de puntos, distinto nº de perfectos:** A y B con mismos
  puntos, A con más partidos perfectos → A 1º, B 2º (rompe por perfecto).
- `[ ]` **E3 — Empate en puntos y perfectos, distinto parcial:** rompe por
  parcial.
- `[ ]` **E4 — Empate total (puntos+perfecto+parcial):** A y B **comparten**
  1º (ambos "1º"), el siguiente es **3º** (D5). UI muestra nota de empate.
- `[ ]` **E5 — Modo solo marcador exacto:** "parcial" imposible → columna
  parcial **oculta** (D4); desempate solo por perfectos.
- `[ ]` **E6 — Paridad email↔leaderboard:** el ranking del email de cierre
  coincide exactamente con el de la tabla (D6).
- `[ ]` **E7 — XOR del parcial:** jugador que predice el marcador exacto NO
  suma "parcial"; jugador que acierta solo un lado SÍ. Conteos correctos.
- `[ ]` **E8 — Estructural (Estratega):** dos jugadores empatados en puntos;
  A con más **grupos perfectos**, B con menos → A arriba. Verificar que
  `perfectCount` suma grupos perfectos + ganadores de eliminatoria acertados.
- `[ ]` **E9 — Volumen entre fases (ejemplo del owner):** A acertó 5
  ganadores en 16avos, B acertó 1 en la final, mismos puntos → A arriba (más
  unidades perfectas). Confirma que el conteo es por unidades, no por fase.
- `[ ]` **E10 — Parcial estructural:** grupo con algunas posiciones correctas
  (no perfecto) cuenta como parcial; eliminatoria fallada no cuenta.

---

## 8. Fuera de alcance
- Cambiar la fórmula de puntos por tipo de pick (incl. Marcador parcial).
- Reescribir scraper / flujo de resultados.

## 9. Archivos que se tocarán (referencia)
- Backend: `lib/leaderboardRanking.ts` (nuevo), `services/poolOverviewService.ts`,
  `services/poolStateMachine.ts`, (`prisma/schema.prisma` + migración si D7),
  `routes/catalog.ts` (si D7), tests.
- Frontend: `PoolLeaderboardTab.tsx`, `PickRulesDisplay.tsx`/Reglas,
  `messages/{es,en,pt}/pool.json`.
- Docs: `DECISION_LOG.md` (ADR), `BUSINESS_RULES.md`, `CHANGELOG.md`.

## Versión
- v1 — 2026-06-08 — borrador.
- v2 — 2026-06-08 — plan de seguimiento paso a paso; pendiente cerrar D1–D7.
- v3 — 2026-06-08 — **D1–D7 CERRADAS** (incl. D3 estructural por unidades).
  Plan listo para implementar al recibir el "go".
