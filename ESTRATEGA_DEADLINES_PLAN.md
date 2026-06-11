# Plan — Deadlines Estratega: avisos de grupos, UX de cierre e integridad (seguimiento)

> **Estado:** PLANEACIÓN / SEGUIMIENTO. **No se escribe código** hasta que
> las decisiones `POR CONFIRMAR` (§3) estén cerradas y des el "go".
> Todo verificado contra el código real (`main` @ `bc85a22`) con `archivo:línea`.
> Sin suposiciones: lo no confirmado está marcado, no asumido.
>
> Leyenda de seguimiento: `[ ]` pendiente · `[~]` en curso · `[x]` hecho.
>
> **Contexto:** la Entrega 1 (no contar fases estructurales como picks de
> partido faltantes) ya se desplegó en `9481d63` (2026-06-10). Este plan
> cubre las Entregas 2, 3 y 4.

---

## 1. Objetivo

Para pools Estratega (preset SIMPLE / fases estructurales):

- **E2 — Avisar GRUPOS, no partidos:** el banner y los emails de
  recordatorio deben avisar "N grupos sin guardar" (y ganadores de
  eliminatoria pendientes), con su deadline real. Hoy, tras `9481d63`, el
  backend ya no miente — pero tampoco avisa nada: banner en blanco y cero
  recordatorios para Estratega.
- **E3 — Que el jugador SEPA el deadline:** mostrar fecha/hora de cierre
  por grupo y por partido de eliminatoria ANTES de fallar el save, bloquear
  la UI al pasar el lock, y mapear `DEADLINE_PASSED` a un mensaje amigable.
- **E4 — Cerrar el hueco de integridad:** `PUT /structural-picks/:phaseId`
  con payload `{groups}` NO valida deadline (sí lo hace para knockouts) —
  un usuario puede mandar picks de grupo por API directa después del
  kickoff **y le puntúan** (verificado en §2.2). Espejo del lock knockout
  + docs (BUSINESS_RULES, API_SPEC, ADR-070, CHANGELOG).

---

## 2. Estado actual (anatomía verificada)

### 2.1 Dos tablas guardan picks de grupo — y AMBAS puntúan

| Tabla | Escrita por | Lock de deadline |
|---|---|---|
| `GroupStandingsPrediction` (fila por grupo) | `groupStandingsService.upsertGroupStandingsPick` — `PUT /pools/:poolId/group-standings/:phaseId/:groupId` | **SÍ** — `groupStandingsService.ts:67-93`: lock = min kickoff del grupo − `deadlineMinutesBeforeKickoff`; 409 `DEADLINE_PASSED` con `lockTimeUtc` |
| `StructuralPrediction.pickJson.groups` (JSON por fase) | `routes/structuralPicks.ts:54-214` — `PUT /pools/:poolId/structural-picks/:phaseId` | **NO** para `{groups}` (el payload se guarda tal cual, sin filtro). **SÍ** para `{matches}` (knockout, líneas 106-143) |

El scoring del leaderboard **fusiona ambas** fuentes en un solo índice por
usuario: `poolAdminService.ts:1072-1098` (y el mismo patrón en
`poolOverviewService.ts:178-179`). → El hueco de E4 es real y puntuable.

**Mitigante actual:** la UI nunca envía `{groups}` por la ruta sin lock —
`GroupStandingsCard` usa la ruta protegida (`lib/api/groupStandings.ts:4-6`)
y `KnockoutMatchCard` solo envía `{matches}` con un partido
(`KnockoutMatchCard.tsx:142`). El único caller potencial de `{groups}` es
código muerto: `StructuralPicksManager._handleSave` (líneas 193-249,
`void _handleSave`). El hueco es solo por API directa.

### 2.2 Lock de grupo (lógica existente a reutilizar)

`groupStandingsService.ts:72-93`:
- `groupMatches = extractMatches(fixtureSnapshot ?? dataJson).filter(m => m.groupId === groupId)`
- `lockTime = min(kickoffUtc) − deadlineMinutesBeforeKickoff * 60_000`
- `Date.now() >= lockTime` → 409 `DEADLINE_PASSED` + `lockTimeUtc`.

También respeta `pool.lockedPhases` (freeze manual del host, líneas 59-65)
y `canMakePicks(pool.status)`.

### 2.3 Notificaciones (banner)

- Backend: `getPoolNotifications` — `poolAdminService.ts:1378-1515`.
  Filtra fases estructurales vía `buildPhaseTakesMatchPicks`
  (`poolHelpers.ts:27-41`) y devuelve `pendingPicks` +
  `urgentDeadlines[]` (ventana <24h, líneas 1438-1450), salta
  placeholders (`isPlaceholder`, líneas 1413-1415, prefijos
  `W_/RU_/L_/3rd_`).
- Universo de grupos por fase estructural ya se construye en otro punto
  con el patrón a copiar: `poolAdminService.ts:1050-1058`
  (`sp.type === "GROUP_STANDINGS"` → groupIds únicos desde
  `matches[].groupId`; `KNOCKOUT_WINNER` → matchIds, líneas 1059-1065).
- Frontend: `hooks/usePoolNotifications.ts` (polling 60 s; badge
  "partidos" = `pendingPicks + pendingResults`, línea 117);
  render en `PoolMatchesTab.tsx:203-239` (agrupa `urgentDeadlines` por
  fase) → `components/NotificationBanner.tsx` (presentacional,
  `items: {icon, message}[]`). Tipo `PoolNotifications` en
  `lib/api/pools.ts:60-75`.
- Keys i18n actuales: `pool.notifications.urgentPicks`,
  `urgentPicksPlural`, `countInPhase` — `messages/{es,en,pt}/pool.json:560-566`.

### 2.4 Recordatorios por email

- `deadlineReminderService.ts:142-392` — solo cuenta `Prediction` rows
  por partido; fases estructurales excluidas desde `9481d63`
  (líneas 225-229). Ventana por defecto **48h**
  (`DEADLINE_REMINDER_HOURS_BEFORE`, línea 64).
- Dedupe: `DeadlineReminderLog`, `@@unique([poolId, userId, matchId])`
  (`schema.prisma:864-884`). **No tiene columna para grupos.**
- Email: `sendDeadlineReminderEmail` (`email.ts:564-573`, params con
  `matchesCount`) → `getDeadlineReminderTemplate`
  (`emailTemplates.ts:508-556`) — copy "N partidos sin pronóstico" en
  ES/EN/PT, sin variante estructural.

### 2.5 Frontend — gaps de UX (Entrega 3)

- `GroupStandingsCard.tsx`: el prop `matches` llega **pero se ignora**
  (tipado en 42-52, no se destructura en 54-63). No muestra deadline.
  `isLocked` ≠ deadline: viene de `PoolMatchesTab.tsx:312` =
  fase `COMPLETED` o miembro `LEFT`. Error crudo: línea 138 muestra
  `err?.message` → el usuario ve literalmente `DEADLINE_PASSED`.
- `KnockoutMatchCard.tsx`: recibe `kickoffUtc` y lo descarta
  (`void _kickoffUtc`, línea 89). Mismo error crudo (línea 150).
- Ni `timeZone` ni `deadlineMinutesBeforeKickoff` llegan a los
  componentes de picks: `overview.pool` los tiene (`lib/poolTypes.ts:29-30`)
  pero `PoolMatchesTab.tsx:303-319` no los propaga a
  `StructuralPicksManager`.
- `PickRulesDisplay.tsx`: el cuadro "⏰ deadline" (líneas 156-168) está
  **solo** en la rama de marcadores; las ramas estructurales
  (GROUP_STANDINGS 192-242, KNOCKOUT_WINNER 273-294) no muestran deadline.
  Bug menor adyacente: `rulesDisplay.lockDateWarning` (línea 267) formatea
  con el TZ del navegador, no el de la pool.
- Formatter reutilizable: `lib/timezone.ts:12-27` —
  `formatMatchDateTime(utcDate, timezone, locale)` acepta cualquier IANA
  TZ. Precedente de copy: `MatchCard.tsx:219-220`
  (`matchCard.deadline` = "Cierre de predicciones").

---

## 3. Decisiones POR CONFIRMAR (cerrar antes del go)

- **D1 — Clave de dedupe para recordatorios de grupo `[ ]`:**
  `DeadlineReminderLog.matchId` es string libre. **Recomendación:** clave
  sintética `group:{phaseId}:{groupId}` en la columna `matchId` existente
  — cero migración, el unique `(poolId,userId,matchId)` sigue funcionando.
  Alternativa: columnas nuevas + migración (más limpio, más costo).
  Los knockouts estructurales usan el `matchId` real (sin colisión: una
  fase es por-marcador O estructural, nunca ambas).
- **D2 — Semántica de `pendingPicks` `[ ]`:** **Recomendación:** pasa a
  ser el total de unidades pendientes (partidos + grupos + ganadores de
  eliminatoria). El badge del tab (`usePoolNotifications.ts:117`) se
  corrige solo, sin tocar su fórmula. Los detalles van en arrays
  separados: `urgentDeadlines[]` (existente) + `urgentGroups[]` +
  `urgentKnockouts[]` (nuevos, opcionales → backward-compatible si el
  frontend viejo sigue desplegado).
- **D3 — TZ para mostrar el cierre de grupo `[ ]`:** pediste "TZ de la
  pool". Ojo con el precedente: `MatchCard` muestra deadlines en el **TZ
  del usuario** (`page.tsx:210-211` → `userTimezone`). Mostrar grupo en TZ
  de pool y partidos en TZ de usuario sería inconsistente en la misma
  pantalla. **Recomendación:** TZ del usuario en las cards (consistencia)
  y TZ de la pool en emails (ya es así: `deadlineReminderService.ts:298`).
  Confirma cuál quieres.
- **D4 — ¿La ruta `{groups}` sobrevive? `[ ]`:** la UI no la usa (solo el
  código muerto `_handleSave`). Opción A (recomendada): aplicarle el lock
  espejo (E4) y mantenerla documentada. Opción B: rechazar `{groups}` en
  esa ruta (410/400) y eliminar `_handleSave` — menos superficie, pero
  rompe cualquier consumidor externo no conocido.
- **D5 — Orden de entregas `[ ]`:** **Recomendación: E4 → E2 → E3.**
  E4 es ~30 líneas + tests y cierra el hueco explotable antes del
  arranque del Mundial; E2 es la utilidad core; E3 es UX no bloqueante.

---

## 4. Diseño técnico (verificado)

### 4.0 Helper compartido (pre-requisito de E2 y E4 — evita triplicar lógica)

Nuevo en `lib/poolHelpers.ts` (junto a `buildPhaseTakesMatchPicks`):

- `buildGroupLockTimes(fixtureData, deadlineMinutes): Map<groupId, {lockTime, firstKickoffUtc}>`
  — réplica exacta del cálculo de `groupStandingsService.ts:72-86`
  (min kickoff por `m.groupId` − buffer).
- Consumidores: E4 (`structuralPicks.ts`), E2 backend
  (`getPoolNotifications` + `deadlineReminderService`), y **refactor
  opcional** de `groupStandingsService.upsertGroupStandingsPick` para que
  use el mismo helper (CLAUDE.md: cero lógica duplicada).
- Unit tests del helper en `poolHelpers.test.ts` (ya existe el archivo).

### 4.1 Entrega 4 — lock de grupos en `PUT /structural-picks/:phaseId`

En `routes/structuralPicks.ts`, rama `"groups" in parsed.data` (hoy
inexistente — el payload pasa directo en líneas 157-160):

1. `groupLocks = buildGroupLockTimes(fixtureData, pool.deadlineMinutesBeforeKickoff)`.
2. Filtrar grupos entrantes: groupId desconocido → drop (espejo del
   matchId desconocido, líneas 120-125); `now >= lockTime` → drop y
   acumular `lockedGroupIds`.
3. Si el payload traía ≥1 grupo y TODOS quedaron bloqueados → 409
   `DEADLINE_PASSED` + `lockedGroupIds` (espejo de líneas 137-142).
4. **Merge por grupo** con `existingPick.pickJson.groups` (hoy `{groups}`
   REEMPLAZA el JSON completo — eso también permite borrar picks de grupos
   ya bloqueados; el merge espejo del knockout (líneas 161-181) lo
   impide).
5. Mantener intactos: `lockedPhases` (98-104), `canMakePicks` (77-79),
   audit (203-211).

Tests (nuevos, archivo de test de la ruta o del helper):
- pick de grupo después del lock → 409 + no escribe.
- mezcla bloqueado/abierto → guarda solo abiertos, preserva el bloqueado
  existente verbatim.
- groupId desconocido → drop sin 500.
- knockout: regresión de que nada cambió.

### 4.2 Entrega 2 — backend de avisos

**`getPoolNotifications` (`poolAdminService.ts:1378-1515`):**
1. Construir universo estructural desde `pool.pickTypesConfig` con el
   patrón de 1043-1066: fases `GROUP_STANDINGS` → groupIds; fases
   `KNOCKOUT_WINNER` → matchIds (saltando placeholders, reutilizar
   `isPlaceholder`).
2. Picks del usuario: `groupStandingsPrediction.findMany({poolId, userId})`
   **+** `structuralPrediction.findMany({poolId, userId})` → un grupo está
   "guardado" si aparece en cualquiera de las dos fuentes (las dos
   puntúan, §2.1). Knockout: `winnerId` presente en `pickJson.matches`.
3. `urgentGroups[]`: grupos sin guardar cuyo lock (helper §4.0) cae en
   `now < lock ≤ now+24h` → `{phaseId, groupId, deadlineUtc, firstKickoffUtc}`.
4. `urgentKnockouts[]`: partidos KO sin winnerId, deadline <24h, sin
   placeholders → misma forma que `urgentDeadlines`.
5. `pendingPicks += urgentGroups.length + urgentKnockouts.length` (D2).

**`deadlineReminderService.ts`:**
1. Cargar además `groupStandingsPrediction` + `structuralPrediction` del
   pool (hoy solo `predictions`, líneas 195-200).
2. Por pool con fases estructurales: grupos cuyo lock cae en la ventana
   48h y el usuario no guardó (ambas fuentes) + knockouts ídem.
3. Dedupe con clave D1 en `DeadlineReminderLog` (mismo flujo de logs,
   líneas 341-371).
4. Email: contenido distinto para Estratega (§4.3). El deadline mostrado:
   el más próximo entre las unidades recordadas (espejo de 287-295), en
   TZ de la pool (existente, línea 298).

**Email (`emailTemplates.ts` + `email.ts`):**
- Extender params con `groupsCount?: number` y `knockoutsCount?: number`
  (manteniendo `matchesCount` para pools de marcadores — un pool MIXED
  puede tener ambos).
- Copy ES/EN/PT: "Tienes **N grupos sin guardar** en {pool} — cierran el
  {fecha} {hora}" / variante knockout / variante combinada. Escapado con
  el patrón existente (`safePoolName`).

**Frontend banner:**
- `lib/api/pools.ts:60-75`: añadir `urgentGroups`, `urgentKnockouts` al
  tipo (opcionales).
- `PoolMatchesTab.tsx:203-239`: nuevos `bannerItems` — "X grupos sin
  guardar (Grupo A, B…)" y knockouts.
- Keys nuevas `pool.notifications.urgentGroups`, `urgentGroupsPlural`,
  `urgentKnockouts`, `urgentKnockoutsPlural` en **los tres**
  `messages/{es,en,pt}/pool.json` (regla: nunca un locale sin los otros).

Tests: regresiones en `deadlineReminderService.test.ts` (ya existe):
grupo sin pick dentro de ventana → recordado; grupo guardado en
CUALQUIERA de las dos tablas → no recordado; dedupe de clave sintética;
pool MIXED cuenta ambas clases sin doble conteo.

### 4.3 Entrega 3 — UX de deadline

1. **Plumbing:** `PoolMatchesTab` → `StructuralPicksManager` →
   `GroupStandingsCard` / `KnockoutMatchCard`: pasar
   `deadlineMinutesBeforeKickoff` + TZ elegido en D3 (todo ya está en
   `overview.pool`, solo falta propagar — §2.5).
2. **GroupStandingsCard:** destructurar `matches` (ya llega), calcular
   `lockTime` client-side (mismo cálculo del helper backend), mostrar
   "Cierre de predicciones: {fecha}" con `formatMatchDateTime`
   (`lib/timezone.ts:12-27`); si `now >= lockTime` → estado bloqueado
   (ocultar Guardar/Editar como hace `isLocked` hoy en 243/284) + texto
   "Grupo cerrado". Mapear `DEADLINE_PASSED` del catch (línea 138) a
   mensaje amigable i18n (vía `isApiError` de `lib/apiError.ts`, patrón de
   `KnockoutMatchCard.tsx:71`).
3. **KnockoutMatchCard:** usar `kickoffUtc` (quitar `void _kickoffUtc`),
   mismo render de cierre + lock client-side + mapeo de error.
4. **PickRulesDisplay:** añadir cuadro deadline a las ramas estructurales:
   - GROUP_STANDINGS: "Debes guardar el orden completo de cada grupo hasta
     {X} min antes del primer partido de ese grupo."
   - KNOCKOUT_WINNER: "Eliges ganador hasta {X} min antes de cada partido."
   - Keys nuevas en los 3 locales; de paso (opcional, D3) corregir
     `lockDateWarning` (línea 267) para usar TZ de pool.
5. **Responsive:** verificar 360-430px ANTES que desktop (regla del
   proyecto) — la fecha de cierre no debe desbordar la card.

Nota: el lock client-side es UX, no seguridad — la fuente de verdad sigue
siendo el 409 del backend (E4 + ruta protegida existente).

---

## 5. Riesgos y salvaguardas

- **Invariante 6 (CLAUDE.md):** todo cálculo usa
  `fixtureSnapshot ?? dataJson` — el helper §4.0 recibe el fixture ya
  resuelto, nunca lee la instancia directo.
- **Pools MIXED:** una pool puede tener fase A por marcador + fase B
  estructural (test de `9481d63` lo cubre). E2 debe sumar ambas clases sin
  doble conteo (una fase nunca es ambas).
- **Backward-compat API:** los campos nuevos de notifications son
  opcionales; deploy backend-primero no rompe el frontend viejo.
- **Volumen de emails:** el Mundial arranca en horas — el primer tick del
  reminder con grupos va a encontrar MUCHOS usuarios sin picks. La ventana
  48h + dedupe por (user, group) limita a 1 email por usuario/grupo, y
  `muteReminders`/preferencias se respetan (flujo existente). Considerar
  `dryRun` en producción antes del primer envío real (el servicio ya lo
  soporta, línea 144).
- **No tocar:** scoring, advancement, `transitionToCompleted` (gotcha
  conocido: emailea a todos), ruta protegida de group-standings (solo
  refactor opcional al helper).

---

## 6. Checklist de seguimiento

### Entrega 4 — Integridad (primera, recomendada)
- [x] 4.0 Helper `buildGroupLockTimes` en `lib/poolHelpers.ts` + unit tests (13 nuevos)
- [x] 4.1 Lock + merge de `{groups}` en `routes/structuralPicks.ts`
- [x] 4.2 Refactor: `upsertGroupStandingsPick` usa el helper (+ fix del quirk NaN)
- [x] 4.3 Tests: 409 post-lock, merge parcial, groupId desconocido, regresión knockout — suite sin fallas nuevas (19 pre-existentes, eran 22: se repararon 3 tests stale de groupStandingsService)
- [x] 4.4 Docs: BUSINESS_RULES.md + API_SPEC.md + ADR-070 + CHANGELOG
- [ ] 4.5 Verificación en producción: PUT directo con grupo bloqueado → 409 (tras deploy)

### Entrega 2 — Avisos de grupos
- [x] 2.1 `getPoolNotifications`: `urgentGroups` + `urgentKnockouts` + `pendingPicks` total + conteos por tipo (`pendingMatchPicks`/`pendingGroupPicks`/`pendingKnockoutPicks`)
- [x] 2.2 `deadlineReminderService`: unidades estructurales en ventana + dedupe sintético `group:{phaseId}:{groupId}` (D1)
- [x] 2.3 Email: `buildPendingUnitsList` compartido (subject+body+preheader) + copy ES/EN/PT
- [x] 2.4 Frontend: tipo `PoolNotifications` (prop dejó de ser `any`) + bannerItems grupos/KO + keys i18n ×3
- [x] 2.5 Tests: 6 regresiones nuevas (pendiente/guardado en cada tabla/dedupe/placeholder/MIXED) — suite 702 pass, 19 pre-existentes
- [x] 2.6 API_SPEC.md: response completo de notifications
- [ ] 2.7 Verificación: dry-run del reminder en producción + banner en pool Estratega real (tras deploy)

### Entrega 3 — UX de deadline
- [ ] 3.1 Plumbing de `deadlineMinutesBeforeKickoff` + TZ (D3) hasta las cards
- [ ] 3.2 `GroupStandingsCard`: fecha de cierre + lock client-side + mapeo `DEADLINE_PASSED`
- [ ] 3.3 `KnockoutMatchCard`: ídem con `kickoffUtc`
- [ ] 3.4 `PickRulesDisplay`: textos Estratega ×3 locales (+ fix opcional `lockDateWarning`)
- [ ] 3.5 Responsive 360-430px verificado
- [ ] 3.6 Verificación manual en pool Estratega real (grupo abierto, grupo cerrado)

---

## 7. Decisiones cerradas (se llenan con el "go")

| # | Decisión | Resolución | Fecha |
|---|---|---|---|
| D1 | Clave dedupe grupos | Sintética `group:{phaseId}:{groupId}` en `matchId` — sin migración | 2026-06-10 |
| D2 | Semántica `pendingPicks` | Total de unidades pendientes (partidos + grupos + KO); arrays de detalle separados | 2026-06-10 |
| D3 | TZ de display en cards | TZ del usuario en cards (consistencia con MatchCard); TZ de pool en emails | 2026-06-10 |
| D4 | Destino ruta `{groups}` | Opción A: lock espejo + merge por grupo; la ruta se mantiene | 2026-06-10 |
| D5 | Orden de entregas | E4 → E2 → E3 | 2026-06-10 |

> **GO del owner: 2026-06-10** — "lo que tú recomiendes, buscando el
> resultado más profesional y sin fallos posible."
