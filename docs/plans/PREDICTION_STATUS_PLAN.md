# Plan de implementación — Estado de predicciones por partido ("¿Quién ya pickeó?")

> **Estado:** PLANEACIÓN — pendiente de aprobación final del usuario.
> **Origen:** Feedback BUG de Felipe Hincapié (ffelipehincapiem@gmail.com), 2026-06-17.
> Hosts no tienen forma de saber qué jugadores ya guardaron su predicción; varios
> usuarios digitan el marcador pero olvidan darle "Guardar" y pierden puntos.
> **ADR asociado (a crear en implementación):** ADR-077.
> **Branch de trabajo:** `claude/update-search-description-D45aj`.

---

## 1. Qué construimos (alcance v1)

Un indicador `📊 25/45` en cada card de partido que, al hacer click, abre un modal
con la **lista completa de miembros** y un **✓ / ✗** según hayan o no guardado su
predicción para ese partido. Con:

- **Filtros:** Todos · Pendientes · Listos.
- **Búsqueda** por nombre.
- **Exportar PDF** de la lista según el filtro activo (Opción A confirmada).

### Garantía de privacidad (NO negociable)
El sistema **NUNCA expone el contenido del marcador** en esta feature. Solo el
hecho booleano "predijo / no predijo". El backend ni siquiera hace `SELECT` del
campo `pickJson` en el endpoint nuevo — solo `SELECT userId`. Esto es lo que
permite mostrarlo **antes del deadline** sin romper la regla de marcador oculto
(el otro botón, "Ver predicciones de otros", sigue siendo post-deadline y es quien
muestra los marcadores).

---

## 2. Decisiones de producto (confirmadas por el usuario)

| # | Decisión | Resolución |
|---|----------|------------|
| 1 | ¿Quién ve el contador y cuándo? | **Todos los miembros, siempre (pre y post-deadline).** No rompe la lógica de marcador oculto porque nunca se muestra la predicción, solo el booleano. |
| 2 | ¿HOST/CO_ADMIN cuentan como predictores? | **Sí.** Aparecen en el listado y en el denominador. |
| 3 | ¿`PENDING_APPROVAL` cuenta? | **No.** Solo miembros `ACTIVE`. |
| 4 | Granularidad del PDF | **Por partido**, exporta la lista completa de lo que esté en el filtro activo (Todos / Pendientes / Listos). |
| 5 | Escala (cientos de jugadores) | **CERRADA.** El modal scrollea normal desde el primer jugador (con search + filtros). Virtualización por debajo (invisible al usuario) para no trabar con cientos. Sin paginación cursor en v1. |

### Rollout gradual (requisito confirmado)
La feature arranca **activa SOLO en las pools donde `juan.k.chacon9729@gmail.com`
es host**. Cuando el usuario la revise y apruebe, se abre a todos cambiando una
env var (sin redeploy de código). Implementado como feature flag — §6.

---

## 3. Hechos del código verificados (cero supuestos)

| Hecho | Ubicación | Implicación |
|-------|-----------|-------------|
| `Prediction` tiene unique `(poolId, userId, matchId)`; una fila = predicción guardada; **no hay drafts** | `backend/prisma/schema.prisma` (model Prediction) | "Existe fila" ≡ "ya pickeó". Lógica binaria limpia. |
| `Prediction @@index([poolId, matchId])` | idem | El endpoint de detalle (`WHERE poolId AND matchId`) está indexado. |
| `PoolMember @@index([poolId, status])` | idem | Query de miembros activos indexada. |
| Denominador actual del sistema = `count(PoolMember WHERE status='ACTIVE')` | `poolOverviewService.ts:66` (`membersActive`) | Reutilizamos exactamente este criterio (excluye PENDING/LEFT/BANNED, incluye todos los roles). |
| **El overview YA carga `allPredictions` de TODOS los miembros** | `poolOverviewService.ts:165-168` | El contador `25/45` se computa **en memoria**, sin queries nuevas. |
| `allPredictions` incluye predicciones de miembros `LEFT` (porque `members` = ACTIVE+LEFT) | `poolOverviewService.ts:159-168` | Al contar hay que **intersectar con el set de userIds ACTIVE** para no inflar el numerador con ex-miembros. |
| El botón "Ver predicciones de otros" usa `GET /pools/:poolId/matches/:matchId/picks` | `backend/src/routes/picks.ts`, `services/pickService.ts:285-372` | Patrón de autorización a imitar: `requirePoolMemberReadAccess`. |
| Card de partido = `MatchCard.tsx` (~400 líneas); zona de action buttons solo aparece post-lock | `app/[locale]/(authenticated)/pools/[poolId]/components/MatchCard.tsx` | El badge va en el **header del card** (visible siempre), NO en la zona post-lock. |
| PDF cliente con `jspdf` + `jspdf-autotable` vía `generateBrandedTablePdf()` | `frontend-next/src/lib/exportPdf.ts`; ejemplo en `MatchPicksModal.tsx` | Replicamos el patrón existente (branding, logo, paginación auto). |
| Tipo del card en frontend | `frontend-next/src/lib/poolTypes.ts` (`PoolMatchCard`) | Extendemos con `predictedCount` y `predictionStatusEnabled`. |

---

## 4. Diseño — Backend

### 4.1 Aumentar el overview (badge sin queries nuevas)
En `poolOverviewService.ts`:

1. Construir un `Set<string>` de `userId` de miembros **ACTIVE** (derivado de
   `members`, que ya está cargado, filtrando `status === "ACTIVE"`).
2. Construir `predictedCountByMatch: Map<matchId, number>` recorriendo el
   `allPredictions` ya cargado, contando solo cuando `activeUserIds.has(p.userId)`.
3. En cada `matchCard`, añadir:
   - `predictedCount: predictedCountByMatch.get(m.id) ?? 0`
   - `predictionStatusEnabled: <boolean del feature flag>` (§6)
4. El denominador `membersActive` ya viaja en `counts.membersActive` — el front lo usa.

> **Costo: O(n) en memoria, cero DB extra.** No se toca ninguna query existente.

### 4.2 Endpoint de detalle (lista con nombres)
Nuevo: `GET /pools/:poolId/matches/:matchId/prediction-status`

- **Auth:** `requireAuth` + `requirePoolMemberReadAccess` (mismo que el endpoint hermano; permite ACTIVE y LEFT leer).
- **Feature flag:** si la pool no está habilitada (§6) → `404 NOT_FOUND` (no filtrar existencia).
- **Servicio nuevo:** `predictionStatusService.getPredictionStatus(userId, poolId, matchId)`:
  ```ts
  const members = await prisma.poolMember.findMany({
    where: { poolId, status: "ACTIVE" },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { joinedAtUtc: "asc" },
  });
  const predicted = await prisma.prediction.findMany({
    where: { poolId, matchId },
    select: { userId: true },          // ← NUNCA pickJson (garantía de privacidad)
  });
  const predictedSet = new Set(predicted.map(p => p.userId));
  ```
- **Respuesta:**
  ```jsonc
  {
    "matchId": "…",
    "deadlineUtc": "…",
    "isLocked": true,
    "predictedCount": 25,
    "totalMembers": 45,
    "members": [
      { "userId": "…", "displayName": "Juan", "role": "PLAYER",
        "hasPredicted": true, "isCurrentUser": false }
    ]
  }
  ```
- **Orden por defecto:** pendientes primero (los accionables), luego alfabético.
  *(Detalle menor, ajustable en review.)*
- **Validación Zod** de params (`poolId`, `matchId`).

### 4.3 No se toca nada del scoring, results ni del endpoint `picks` existente.

---

## 5. Diseño — Frontend

### 5.1 Badge en `MatchCard.tsx`
- En el **header del card**, un botón-chip `📊 {predictedCount}/{membersActive}`.
- Visible solo si `match.predictionStatusEnabled === true` (gate de rollout).
- Estilo: chip pequeño, `minHeight 44px` en mobile (TOUCH_TARGET.minimum), sin romper el `flexWrap` existente del header.
- `onClick` → `onViewPredictionStatus(matchId, matchTitle)` (nuevo prop, mismo patrón que `onViewMatchPicks`).

### 5.2 Modal nuevo `PredictionStatusModal.tsx`
- Estructura igual a `MatchPicksModal` (overlay fijo, header sticky, max-width 500px, max-height 80vh).
- Al abrir: fetch a `GET …/prediction-status` (hook nuevo en `lib/api/`).
- **Header:** título + resumen `25 / 45 listos`.
- **Filtros (chips):** Todos · Pendientes · Listos.
- **Búsqueda** por nombre (input controlado).
- **Lista:** cada fila = nombre + ✓ (verde) / ✗ (gris/rojo). Badge "Tú" para el usuario actual.
- **Botón "Exportar PDF":** usa `generateBrandedTablePdf()` con las filas del filtro activo. Nombre de archivo siguiendo el patrón existente: `{sanitized-poolName}_predicciones_{matchTitle}_{YYYY-MM-DD}.pdf`.
- **Escala:** ver §8.

### 5.3 Tipos e i18n
- Extender `PoolMatchCard` en `poolTypes.ts`: `predictedCount: number`, `predictionStatusEnabled: boolean`.
- Nuevo tipo `PredictionStatusResponse` en `lib/api/predictionStatus.ts`.
- Claves i18n nuevas bajo `predictionStatus.*` en **ES/EN/PT** (`messages/{es,en,pt}/pool.json`): `badgeLabel`, `modalTitle`, `summary`, `filterAll`, `filterPending`, `filterReady`, `searchPlaceholder`, `hasPredicted`, `notPredicted`, `you`, `empty`, `exportPdf`, y claves `pdf.*` del documento.

---

## 6. Feature flag (rollout gradual)

Nuevo helper `backend/src/lib/featureFlags.ts`:

```ts
// Lista de emails de hosts habilitados para la feature en beta.
// "*" = habilitado para todos. Vacío/undefined = deshabilitado.
const raw = process.env.PREDICTION_STATUS_HOST_ALLOWLIST ?? "";

export function isPredictionStatusEnabled(
  pool: { creatorEmail: string | null },   // email de pool.createdByUserId
): boolean {
  if (raw.trim() === "*") return true;                 // rollout total
  const allow = new Set(raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
  if (allow.size === 0) return false;                  // default seguro: off
  return pool.creatorEmail != null && allow.has(pool.creatorEmail.toLowerCase());
}
```

- **Env var nueva:** `PREDICTION_STATUS_HOST_ALLOWLIST`.
  - Lanzamiento: `juan.k.chacon9729@gmail.com`.
  - Apertura total: `*`.
- El gate se evalúa **en backend** (overview + endpoint detalle). El front solo
  reacciona al booleano `predictionStatusEnabled` — nunca decide por su cuenta
  (defensa en profundidad).
- **Semántica (confirmada):** "host" = **solo el creador de la pool**
  (`pool.createdByUserId`). El flag compara el email de ese usuario contra la
  allowlist. No basta con ser co-admin de la pool de otro.

---

## 7. Plan por fases (commits atómicos, cada uno deploya sin romper nada)

> La feature **no es visible para nadie** hasta la Fase 4, y aún ahí solo para los
> hosts en la allowlist (que arranca vacía si no seteamos la env var).

| Fase | Contenido | Deploy seguro porque… |
|------|-----------|------------------------|
| **1 — Backend datos** | `featureFlags.ts`; aumentar overview con `predictedCount` + `predictionStatusEnabled`; endpoint `prediction-status` + servicio + validación Zod; tests unitarios del servicio y del flag. ADR-077. | Campos nuevos aditivos; endpoint nuevo; flag default OFF. Front aún no los usa. |
| **2 — Frontend modal (oculto)** | `PredictionStatusModal.tsx`, hook de fetch, tipo de respuesta, claves i18n ES/EN/PT. Sin botón visible. | Componente no montado en ninguna parte todavía. |
| **3 — Badge + wiring + PDF** | Badge en `MatchCard`, prop `onViewPredictionStatus`, wiring en `PoolMatchesTab`, export PDF. Gateado por `predictionStatusEnabled`. | Con allowlist vacía, `predictionStatusEnabled=false` ⇒ badge nunca aparece. |
| **4 — Activación beta** | Setear `PREDICTION_STATUS_HOST_ALLOWLIST=juan.k.chacon9729@gmail.com` en Railway. | Solo aparece en pools de Juan. |
| **5 — Apertura total** | Tras tu OK, `PREDICTION_STATUS_HOST_ALLOWLIST=*`. | Cambio de env var, sin redeploy de código. |

---

## 8. Escala (cientos de jugadores) — CERRADA

- El endpoint devuelve **todos** los miembros activos en una sola respuesta (un
  pool real hoy no pasa de ~cientos; las dos queries están indexadas).
- El modal **scrollea de forma normal desde el primer jugador** (altura máxima
  80vh, `overflow-y: auto`) con **search + filtros** para acotar la lista.
- **Virtualización por debajo** (lista virtualizada, p. ej. solo renderiza las
  filas visibles): es una optimización **invisible al usuario** — scrollea igual,
  solo evita lag con cientos de filas en el DOM en mobile.
- **Sin paginación cursor** en v1. Si Picks4All llega a pools de 1000+, se añade
  en una v2 sin cambiar el contrato (se versiona el endpoint).

---

## 9. Plan de pruebas

- **Backend (Jest):** flag ON/OFF; `*`; allowlist con/sin match; numerador excluye
  LEFT con predicción vieja; denominador = ACTIVE; endpoint nunca devuelve `pickJson`
  (assert sobre el shape); 404 cuando el flag está OFF; auth de no-miembro → 403.
- **Frontend:** modal con 0 / pocos / muchos miembros (mock); filtros; búsqueda;
  PDF genera filas del filtro activo; badge oculto cuando `predictionStatusEnabled=false`.
- **Mobile 360px:** badge no desborda el header; modal sin scroll horizontal; targets 44px.
- **Producción:** verificar en una pool real de Juan tras Fase 4 (no "debería funcionar").

---

## 10. Lista de archivos a tocar

**Backend**
- `backend/src/lib/featureFlags.ts` *(nuevo)*
- `backend/src/services/poolOverviewService.ts` *(aumentar matchCards)*
- `backend/src/services/predictionStatusService.ts` *(nuevo)*
- `backend/src/routes/picks.ts` o ruta dedicada *(nuevo endpoint)*
- `backend/src/__tests__/predictionStatus.*.test.ts` *(nuevo)*
- `docs/DECISION_LOG.md` *(ADR-077)*
- `docs/guides/DEPLOYMENT.md` *(env var nueva)*

**Frontend**
- `frontend-next/src/lib/poolTypes.ts` *(extender `PoolMatchCard`)*
- `frontend-next/src/lib/api/predictionStatus.ts` *(nuevo)*
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PredictionStatusModal.tsx` *(nuevo)*
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/MatchCard.tsx` *(badge)*
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolMatchesTab.tsx` *(wiring)*
- `frontend-next/src/messages/{es,en,pt}/pool.json` *(claves i18n)*

---

## 11. Lo que NO hacemos en v1 (anti scope-creep)
- PDF consolidado del pool entero (Opción B de la decisión 4) — futuro si lo piden.
- Notificación/recordatorio automático a los pendientes — futuro.
- Paginación cursor — solo si escalamos a miles.
