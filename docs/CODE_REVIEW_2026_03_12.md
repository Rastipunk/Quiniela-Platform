# Code Review — Picks4All v0.6.0

> **Fecha:** 2026-03-12
> **Scope:** Revision completa del codebase (security, DB, backend, frontend, API/business logic)
> **Estado:** En progreso — se corrigen uno por uno

---

## Leyenda de estados

- `[ ]` Pendiente
- `[x]` Corregido
- `[~]` No aplica / Aceptado como riesgo conocido
- `[!]` En progreso

---

## CRITICAL

### CR-01: Race Condition en Pool Join — Exceder maxParticipants
- **Estado:** `[x]`
- **Archivos:** `backend/src/routes/pools.ts:1476-1493`, `backend/src/routes/auth.ts:720-728`
- **Descripcion:** El `count()` + `create()` dentro del transaction NO previene que 2 requests simultaneos pasen el check de capacidad. Dos usuarios ven `count=19` (max=20), ambos pasan, pool queda con 21.
- **Fix propuesto:** `INSERT ... WHERE (SELECT count) < max` atomico, o unique constraint + retry, o SERIALIZABLE isolation.
- **Notas:** Mismo patron duplicado en corporate activation (auth.ts:720-728).

### CR-02: Race Condition en Result Versioning — Sobrescritura silenciosa
- **Estado:** `[x]`
- **Archivos:** `backend/src/routes/results.ts:79-150`
- **Descripcion:** Dos requests concurrentes leen el mismo `lastVersion`, ambos computan el mismo `nextVersion`. Depende del isolation level de PostgreSQL (READ COMMITTED por defecto puede permitir race en edge cases).
- **Fix propuesto:** `SELECT ... FOR UPDATE` o unique constraint en (poolMatchResultId, versionNumber).
- **Notas:** El agente de API opina que el tx de Prisma puede ser suficiente en la mayoria de casos. Severidad real: MEDIUM-HIGH.

### CR-03: Race Condition en Corporate Invite — Doble activacion
- **Estado:** `[x]`
- **Archivos:** `backend/src/routes/auth.ts:705-706`
- **Descripcion:** Dos requests simultaneos leen status=PENDING, ambos activan exitosamente.
- **Fix propuesto:** `UPDATE ... WHERE status = 'PENDING'` con check de rows affected en vez de read-then-write.

### CR-04: Missing Compound Indexes en DB
- **Estado:** `[x]`
- **Archivos:** `backend/prisma/schema.prisma`
- **Descripcion:** Faltan indexes compuestos que impactan performance:
  - `Prediction(poolId, matchId)` — usado en leaderboard queries
  - `PoolMatchResult(poolId, matchId)` — usado en overview
  - `PoolMember(poolId, status)` — usado en conteos y listados
- **Fix propuesto:** Agregar `@@index` en schema.prisma + migration.

### CR-05: Backend God-File — pools.ts 3000+ lineas
- **Estado:** `[x]`
- **Archivos:** `backend/src/routes/pools.ts`
- **Descripcion:** 25+ endpoints en un solo archivo. Imposible de mantener/testear. `requireActivePoolMember()` duplicado en 4 archivos.
- **Fix propuesto:** Dividir en sub-routers: `poolMembers.ts`, `poolInvites.ts`, `poolAdmin.ts`, `poolOverview.ts`. Extraer middleware compartido.

### CR-06: Frontend — Componentes Gigantes sin Splitting
- **Estado:** `[!]`
- **Archivos:**
  - `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolMatchesTab.tsx` (1,594 lineas)
  - `frontend-next/src/app/[locale]/(authenticated)/dashboard/page.tsx` (1,046 lineas)
  - `frontend-next/src/components/GroupStandingsCard.tsx` (1,041 lineas)
  - `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolAdminTab.tsx` (982 lineas)
  - `frontend-next/src/components/CorporatePoolCreation.tsx` (925 lineas)
- **Descripcion:** Componentes monoliticos que mezclan data fetching, business logic y rendering. Dificiles de testear y mantener.
- **Fix propuesto:** Extraer sub-componentes y custom hooks por cada componente.

### CR-07: Corporate Pool queda en DRAFT
- **Estado:** `[ ]`
- **Archivos:** `backend/src/routes/corporate.ts:200`
- **Descripcion:** La creacion de pool corporativo nunca llama `transitionToActive()`. El pool queda en DRAFT y no se pueden publicar resultados ni hacer picks.
- **Fix propuesto:** Llamar `transitionToActive()` despues del transaction, o crear el pool directamente en ACTIVE.
- **Notas:** Documentado en MEMORY.md como known issue desde v0.6.0.

---

## HIGH

### HI-01: Token Storage en localStorage — Vulnerable a XSS
- **Estado:** `[ ]`
- **Archivos:** `frontend-next/src/lib/auth.ts:18-21`
- **Descripcion:** JWT almacenado sin encriptar en localStorage, accesible a cualquier script en el dominio.
- **Fix propuesto:** Ideal: httpOnly cookie set por backend. Minimo: Content-Security-Policy estricto.

### HI-02: Tokens en URL (query params)
- **Estado:** `[ ]`
- **Archivos:** `frontend-next/src/lib/api.ts:1160` (verify-email), `frontend-next/src/lib/api.ts:1305` (corporate-invite)
- **Descripcion:** Tokens en URL se logean en historial del browser, server logs, proxy logs, Referrer headers.
- **Fix propuesto:** Cambiar a POST con body.

### HI-03: Type Safety — ~32 `as any` restantes
- **Estado:** `[ ]`
- **Archivos:** Backend (~19 casts), Frontend (~13 casts) — distribuidos en pools.ts, picks.ts, results.ts, api.ts, PoolConfigWizard.tsx, PoolMatchesTab.tsx
- **Descripcion:** Incluye `Promise<any>` en return types, `body: any` en params, `let data: any`, `e: any` en catches.
- **Fix propuesto:** Reemplazar con tipos especificos. Crear ApiError class para catches.

### HI-04: API Response Shapes Inconsistentes
- **Estado:** `[ ]`
- **Archivos:** Todos los routes del backend
- **Descripcion:** Mezcla de `{ ok: true }`, `{ success: true }`, objetos directos. Errores: `{ error }` vs `{ error, message }` vs `{ error, reason }`.
- **Fix propuesto:** Estandarizar a `{ data?, error?, message? }` con helper functions.

### HI-05: State en React que deberia estar en URL
- **Estado:** `[ ]`
- **Archivos:** Pool page (activeTab, activePhase, selectedGroup), Dashboard (activeTab)
- **Descripcion:** Tab activo, fase, grupo se pierden al refrescar. No se puede hacer bookmark ni compartir link con estado.
- **Fix propuesto:** `useSearchParams()` en vez de `useState()`.

### HI-06: No hay Dynamic Imports para Componentes Pesados
- **Estado:** `[ ]`
- **Archivos:** Dashboard (importa PoolConfigWizard), Pool page (importa todas las tabs)
- **Descripcion:** Componentes de 700-1600 lineas se cargan upfront aunque el usuario no los necesite.
- **Fix propuesto:** `next/dynamic` con loading skeleton.

### HI-07: Missing Error Handling Estandarizado en Frontend
- **Estado:** `[ ]`
- **Archivos:** `frontend-next/src/lib/api.ts`, multiples componentes
- **Descripcion:** No hay clase ApiError. Errors se capturan como `catch(e: any)`. No hay retry logic ni boton de reintentar. No hay diferenciacion entre error de red, validacion, o auth.
- **Fix propuesto:** Crear `ApiError` class, estandarizar catches, agregar retry para network errors.

### HI-08: No Validation de Env Variables al Startup
- **Estado:** `[ ]`
- **Archivos:** `backend/src/server.ts`
- **Descripcion:** Si falta `JWT_SECRET` o `DATABASE_URL`, el error aparece en runtime (no al arrancar).
- **Fix propuesto:** Validar con Zod al arrancar el server y fallar fast.

---

## MEDIUM

### MD-01: Inline Styles Excesivos
- **Estado:** `[ ]`
- **Archivos:** Todos los componentes grandes del frontend
- **Descripcion:** Magic numbers repetidos (borderRadius: 12, zIndex: 1000, rgba(0,0,0,0.5)). Colores hardcoded sin CSS variables. ~400+ lineas de estilos inline por componente.
- **Fix propuesto:** Crear theme.ts con constantes de estilo, migrar gradualmente.

### MD-02: Accesibilidad — Missing ARIA + Keyboard Support
- **Estado:** `[ ]`
- **Archivos:** PoolConfigWizard.tsx:263, TeamFlag.tsx:34-46, GroupStandingsCard.tsx, AuthSlidePanel.tsx
- **Descripcion:** Click handlers en `<div>` sin role/tabIndex. Emojis sin role="img". Drag-and-drop sin roles ARIA. Modals sin focus trap.
- **Fix propuesto:** Agregar aria-labels, usar `<button>`, focus trap en modals.

### MD-03: Hydration Mismatch con sessionStorage
- **Estado:** `[ ]`
- **Archivos:** Pool page.tsx:96-98
- **Descripcion:** sessionStorage accedido fuera de useState initializer. Server render difiere del client.
- **Fix propuesto:** Mover logica a useState initializer o useEffect.

### MD-04: Leaderboard sin Paginacion
- **Estado:** `[ ]`
- **Archivos:** `backend/src/routes/pools.ts` (overview endpoint), frontend leaderboard components
- **Descripcion:** Pools grandes devuelven cientos de rows sin paginacion.
- **Fix propuesto:** Agregar paginacion al endpoint y al componente.

### MD-05: Email System sin Queue/Retry
- **Estado:** `[ ]`
- **Archivos:** `backend/src/lib/email.ts`
- **Descripcion:** Emails fire-and-forget sin reintentos. Si Resend falla, email se pierde.
- **Fix propuesto:** Agregar retry con backoff exponencial, o usar queue (BullMQ).

### MD-06: Scoring Logic Duplicada
- **Estado:** `[ ]`
- **Archivos:** `backend/src/routes/results.ts:220-233`, `backend/src/routes/pools.ts:461-512`
- **Descripcion:** Calculo de outcome aparece en notificaciones y en leaderboard independientemente.
- **Fix propuesto:** Usar `outcomeFromScore()` compartido.

### MD-07: Advanced Scoring Swallows Errors Silently
- **Estado:** `[ ]`
- **Archivos:** `backend/src/routes/pools.ts:607-611`
- **Descripcion:** Fallback a legacy scoring sin notificar al usuario. Puntos podrian ser incorrectos.
- **Fix propuesto:** Agregar flag `scoringError` al breakdown para verbose mode.

### MD-08: Cascade Delete Peligroso en MatchSyncState
- **Estado:** `[ ]`
- **Archivos:** `backend/prisma/schema.prisma` (MatchSyncState relation)
- **Descripcion:** Si se borra un TournamentInstance, cascadea a todos los sync states.
- **Fix propuesto:** Cambiar a SET NULL o RESTRICT.

### MD-09: Missing useCallback/useMemo en Componentes Criticos
- **Estado:** `[ ]`
- **Archivos:** `frontend-next/src/components/PublicPageWrapper.tsx:23`, PoolConfigWizard.tsx
- **Descripcion:** `openAuthPanel` se recrea cada render, causando re-renders en todos los consumers del context.
- **Fix propuesto:** Envolver en useCallback.

### MD-10: Google OAuth — Account Linking sin Verificacion
- **Estado:** `[ ]`
- **Archivos:** `backend/src/routes/auth.ts:388-391`
- **Descripcion:** Vincula Google ID a email existente sin confirmar que el usuario es dueno del email.
- **Fix propuesto:** Verificar que email de Google coincida con email registrado antes de vincular.

### MD-11: requireAuth hace DB Query en Cada Request
- **Estado:** `[ ]`
- **Archivos:** `backend/src/middleware/requireAuth.ts:33-42`
- **Descripcion:** `findUnique` por cada request autenticado. A 1000+ usuarios concurrentes sera bottleneck.
- **Fix propuesto:** Cache user status en JWT payload o cache en memoria (Redis/LRU).

### MD-12: Smart Sync sin Validacion de Schema
- **Estado:** `[ ]`
- **Archivos:** `backend/src/services/apiFootball/client.ts:131`
- **Descripcion:** Respuesta de API-Football se castea `as ApiFootballResponse<T>` sin validacion Zod.
- **Fix propuesto:** Agregar schema Zod para validar respuesta antes de procesar.

### MD-13: Invite Codes sin Expiracion por Defecto
- **Estado:** `[ ]`
- **Archivos:** `backend/src/routes/pools.ts:1332`
- **Descripcion:** `expiresAtUtc` es opcional. Se pueden crear invites permanentes.
- **Fix propuesto:** Default 30 dias de expiracion.

### MD-14: Soft Deletes y Config Changes no Auditados
- **Estado:** `[ ]`
- **Archivos:** `backend/src/routes/pools.ts` (member reject, settings patch)
- **Descripcion:** `poolMember.delete()` en reject y `PATCH /settings` no generan audit events.
- **Fix propuesto:** Agregar writeAuditEvent para estas operaciones.

---

## LOW

### LO-01: Magic Strings/Numbers en Backend
- **Estado:** `[ ]`
- **Archivos:** `backend/src/routes/picks.ts:127`, `backend/src/routes/pools.ts:69`, `backend/src/routes/auth.ts:95`
- **Descripcion:** Placeholder prefixes hardcoded, `randomBytes(6)` sin constante, `24*60*60*1000` sin nombre.
- **Fix propuesto:** Extraer a constantes nombradas.

### LO-02: Imagenes sin next/image
- **Estado:** `[ ]`
- **Archivos:** `frontend-next/src/components/TeamFlag.tsx:59`, `frontend-next/src/components/FeedbackModal.tsx`
- **Descripcion:** Usan `<img>` directamente en vez de `next/image` para optimizacion.
- **Fix propuesto:** Migrar a `Image` de Next.js.

### LO-03: Console.error en Produccion
- **Estado:** `[ ]`
- **Archivos:** Multiples archivos frontend y backend
- **Descripcion:** `console.error(err)` logea objetos completos que podrian exponer datos sensibles.
- **Fix propuesto:** Logear solo message/code, nunca full objects en produccion.

### LO-04: FAQAccordion usa Index como Key
- **Estado:** `[ ]`
- **Archivos:** `frontend-next/src/components/FAQAccordion.tsx:89`
- **Descripcion:** `key={globalIndex}` en lista filtrable. Puede causar bugs de reconciliacion.
- **Fix propuesto:** Usar ID unico por item FAQ.

### LO-05: i18n — Dynamic Keys con `as any`
- **Estado:** `[ ]`
- **Archivos:** `frontend-next/src/components/CorporatePoolCreation.tsx:289`
- **Descripcion:** `t(`step${step}Desc` as any)` — si falta key en un locale, muestra el nombre de la key.
- **Fix propuesto:** Usar lookup object con keys explicitas.

---

## Registro de correcciones

| Fecha | ID | Descripcion del fix | Commit |
|---|---|---|---|
| 2026-03-12 | CR-01 | `ensurePoolCapacity()` helper con `SELECT FOR UPDATE` en Pool row. Aplicado en pools.ts (join + rejoin LEFT) y auth.ts (corporate activation x2). Tambien agrego capacity check al rejoin de usuarios LEFT que no lo tenia. | pendiente |
| 2026-03-12 | CR-02 | `SELECT FOR UPDATE` en PoolMatchResult header antes de leer lastVersion. Aplicado en results.ts (host publish) y smartSync/service.ts (API publish). Unique constraint `@@unique([resultId, versionNumber])` como safety net. | pendiente |
| 2026-03-12 | CR-03 | `updateMany WHERE status='PENDING'` con check de `count=0` para evitar doble activacion. Aplicado en ambos flujos de auth.ts (existing user + new user). El claim atomico se hace ANTES de crear usuario/miembro. | pendiente |
| 2026-03-12 | CR-04 | Agregados `@@index([poolId, status])` en PoolMember y `@@index([poolId, matchId])` en Prediction. Migration manual creada. Se aplica al deploy en Railway. | pendiente |
| 2026-03-12 | CR-05 | pools.ts (3208 lineas) dividido en 5 archivos: pools.ts (243), poolOverview.ts (569), poolMembers.ts (573), poolInvites.ts (312), poolAdmin.ts (1535). Helpers extraidos a lib/poolHelpers.ts. Zero cambios en server.ts ni URLs. | pendiente |
| 2026-03-12 | CR-06 | PoolMatchesTab.tsx (1594 lineas) dividido en 6 archivos: PoolMatchesTab.tsx (460), MatchCard.tsx (305), PickComponents.tsx (305), ResultComponents.tsx (351), MatchPicksModal.tsx (156), ScoringOverrideModal.tsx (116). Zero cambios funcionales, build OK. Pendiente: 4 componentes restantes. | pendiente |
