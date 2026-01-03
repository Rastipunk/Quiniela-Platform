# CLAUDE.md — Quiniela Platform (Manual Operativo + Memoria del Repo)

> **Propósito:** Este archivo es la “memoria” y manual operativo que Claude Code debe leer para trabajar de forma consistente y profesional en este repositorio.
>
> **Regla de oro:** Si algo no está explícito aquí o en `/docs`, Claude debe **proponer opciones** y pedir decisión. **No inventar requisitos.**

---

## 0) Visión del producto (North Star)

Construir una plataforma web de **quinielas deportivas multi‑torneo** (por ahora **solo fútbol**) con tres roles:

* **PLAYER**: se une a pools, hace pronósticos (picks), ve reglas, resultados y leaderboard.
* **HOST**: crea/administra una pool, invita jugadores, publica resultados y realiza correcciones oficiales (erratas) con trazabilidad.
* **PLATFORM ADMIN** (dueño de la plataforma): gestiona **templates** (torneos pre‑configurados) y **instances** (ediciones jugables), y controla catálogo/curación de torneos.

Meta final:

* UX y estética **altísimo nivel profesional**.
* Arquitectura robusta y **escalable** (templates/versionado/reglas por fase).
* Preparado para futuro: resultados por API externa, más deportes, más reglas, i18n.

Idioma:

* **MVP: español**.

---

## 1) Fuente de verdad (Source of Truth) + regla de trabajo

### 📚 Documentación SoT (Source of Truth)

**CRÍTICO:** Antes de hacer cualquier cambio al código o tomar decisiones, **SIEMPRE consulta `/docs/sot/`**.

La documentación oficial y completa está en:

1. **[PRD.md](/docs/sot/PRD.md)** - Product Requirements Document
   - Visión del producto (North Star)
   - Roadmap completo: v0.2-beta → v1.0 → v2.0+
   - User stories detalladas (Host, Player, Admin)
   - Features por versión (pick types, co-admins, expulsiones, etc.)
   - KPIs y métricas de éxito
   - Plan de monetización (free/premium tiers)

2. **[DATA_MODEL.md](/docs/sot/DATA_MODEL.md)** - Modelo de Datos Completo
   - Schema completo de todas las entidades
   - Entity Relationship Diagram (ERD)
   - Relaciones, constraints, indexes
   - Estructura del template data (JSON)
   - Invariantes que NUNCA deben romperse
   - Historial de migraciones
   - Políticas de retención de datos

3. **[API_SPEC.md](/docs/sot/API_SPEC.md)** - Especificación de API
   - **TODOS los endpoints documentados**
   - Ejemplos completos de request/response
   - Códigos HTTP y error codes
   - Autenticación (JWT)
   - Validación (Zod schemas)
   - Contratos de Auth, Pools, Picks, Results, Admin

4. **[ARCHITECTURE.md](/docs/sot/ARCHITECTURE.md)** - Arquitectura Técnica
   - Stack completo (Backend: Node/Express/Prisma, Frontend: React/Vite)
   - Estructura del monorepo
   - Flujos de datos (diagramas)
   - Patrones de diseño (middleware, validation, ORM)
   - Deployment (local + producción)
   - Performance y escalabilidad
   - Variables de entorno

5. **[BUSINESS_RULES.md](/docs/sot/BUSINESS_RULES.md)** - Reglas de Negocio
   - **Todas las validaciones** (user, pool, pick, result)
   - Reglas de deadline enforcement
   - Sistema de pick types (4 en v0.2-beta, 7 en v1.0)
   - Leaderboard tiebreakers (points → exact scores → joined date)
   - Permisos de Co-Admin detallados
   - Expulsión de jugadores (permanente y temporal)
   - Matriz de validación completa

6. **[DECISION_LOG.md](/docs/sot/DECISION_LOG.md)** - Log de Decisiones Arquitectónicas
   - **17 ADRs (Architectural Decision Records)** documentados
   - Cada decisión con: Context, Rationale, Consequences, Alternatives
   - Decisiones clave: Monorepo, PostgreSQL, Prisma, JWT, Zod, Template/Version/Instance, Result Versioning, Resend, etc.
   - **TODA nueva decisión debe registrarse aquí**

7. **[GLOSSARY.md](/docs/sot/GLOSSARY.md)** - Glosario de Términos
   - Definiciones de todos los términos del dominio
   - Roles (Host, Player, Co-Admin, Platform Admin)
   - Conceptos (Quiniela, Pool, Pick, Errata, Leaderboard, etc.)
   - Términos técnicos (JWT, Upsert, Immutability, Soft Delete)
   - Acrónimos (ADR, CRUD, ERD, MVP, UUID, etc.)

### 🎯 Regla de Oro para Claude:

- **Si algo está documentado en `/docs/sot/`, ESA es la verdad absoluta.**
- **Si hay contradicción entre código y docs → AVISAR al usuario para decidir.**
- **Toda nueva decisión (arquitectura, producto, contrato) → Registrar en `DECISION_LOG.md`.**
- **Si falta información → Proponer opciones, pedir decisión, documentar la elegida.**

### 📂 Documentación Legacy (anterior a SoT):

Estos documentos aún existen pero están siendo reemplazados por `/docs/sot/`:

* `/docs/SPRINT_1.md` (estado operativo del MVP actual) → Ver PRD.md
* `/docs/BACKLOG.md` (épicas → historias) → Ver PRD.md
* `/docs/DECISION_LOG.md` → **DEPRECADO**, usar `/docs/sot/DECISION_LOG.md`
* `/docs/API.md` → **DEPRECADO**, usar `/docs/sot/API_SPEC.md`
* `/docs/DATA_MODEL.md` → **DEPRECADO**, usar `/docs/sot/DATA_MODEL.md`
* Prisma schema en `backend/prisma/schema.prisma` → Implementación técnica (sigue vigente)

### ✅ Reglas de trabajo (obligatorias):

1. **Consultar SoT primero**: Antes de cualquier cambio, leer los docs relevantes en `/docs/sot/`.
2. **Cada decisión**: Registrar en `DECISION_LOG.md` con formato ADR.
3. **No inventar requisitos**: Si falta info, proponer opciones y pedir decisión.
4. **Diseño extensible**: Mantener templates/versionado/reglas por fase.
5. **Actualización de docs**: Al final del día o tras un hito claro (no en cada micro-paso).
6. **Cuando acordemos cambios**: Entregar texto exacto para actualizar docs (diff: qué se agregó/quitó/modificó).

---

## 2) Alcance por fases

### MVP (Sprint 1) — “Core jugable end‑to‑end”

Debe funcionar siempre:

1. **Register/Login** (email/password)
2. Dashboard: lista “Mis pools” y distingue rol (HOST vs PLAYER)
3. Crear pool o unirse por código
4. Pool page: ver partidos por grupos, reglas, leaderboard
5. Player: guardar pick (y modificar antes de deadline)
6. Host: publicar resultado (y corregir con reason)
7. Leaderboard se actualiza acorde al preset
8. Hardening FE: token inválido/expirado ⇒ logout y redirect a login

### Next

* Forgot password (evaluar costos + proveedor email)
* Google login
* UI Admin para creación de templates sin código
* UX pulido (banderas, layout responsive, componentes)

### Later

* Ingesta resultados por API externa
* Más deportes
* Reglas avanzadas por fase (posiciones en grupos, “quién pasa”, etc.)
* Cambio de reglas post‑creación por votación unánime (nice‑to‑have)
* i18n

---

## 3) Stack y estructura real del repo

Monorepo:

### `/backend`

* Node + Express + TypeScript
* Prisma + Postgres (Docker)

Archivos clave:

* Prisma: `backend/prisma/schema.prisma`
* Server: `backend/src/server.ts`
* DB: `backend/src/db.ts`
* JWT/Auth helpers: `backend/src/lib/jwt.ts`, `backend/src/lib/password.ts`
* Middleware: `backend/src/middleware/requireAuth.ts`, `backend/src/middleware/requireAdmin.ts`
* Auditoría: `backend/src/lib/audit.ts`

Rutas (actuales):

* `backend/src/routes/auth.ts`
* `backend/src/routes/me.ts`
* `backend/src/routes/pools.ts`
* `backend/src/routes/picks.ts`
* `backend/src/routes/results.ts`
* `backend/src/routes/admin.ts`
* `backend/src/routes/adminInstances.ts`
* `backend/src/routes/adminTemplates.ts`

Seeds/Scripts:

* `backend/src/scripts/seedTestAccounts.ts`
* `backend/src/scripts/seedWc2026Sandbox.ts`
* `backend/src/scripts/seedAdmin.ts`

Docker DB:

* `backend/docker-compose.yml`

### `/frontend`

* React + Vite + TypeScript

Archivos clave:

* Routing: `frontend/src/App.tsx`
* API client: `frontend/src/lib/api.ts`
* Auth storage/events: `frontend/src/lib/auth.ts`
* Pages:

  * `frontend/src/pages/LoginPage.tsx`
  * `frontend/src/pages/DashboardPage.tsx`
  * `frontend/src/pages/PoolPage.tsx`
* Styles:

  * `frontend/src/index.css`
  * `frontend/src/App.css`

---

## 4) Dominio (conceptos) y modelo mental

### Entidades de alto nivel

* **TournamentTemplate**: definición del torneo (equipos, estructura, reglas base, fixture base). Puede tener múltiples versiones.
* **TournamentTemplateVersion**: snapshot versionado del template (inmutable una vez publicado).
* **TournamentInstance**: instancia jugable basada en un template/version (ej. “WC 2026”).
* **Pool**: grupo de usuarios que compiten sobre una instancia (configurable: preset scoring, deadline, tz, visibilidad).
* **PoolMember**: membresía usuario↔pool con rol (HOST/COADMIN/PLAYER) y estado.
* **Pick**: pronóstico del usuario por partido.
* **Result**: resultado oficial por partido (publicado por host) con **versionado** y razón para erratas.
* **AuditLog**: eventos relevantes (creación pool, join, publicar resultado, errata, etc.).

### Matches / Fases

MVP: football con soporte de partidos agrupados (WC2026 sandbox: grupos A–L).
Futuro: reglas por fase (grupos vs eliminatorias) y tipos de pick distintos.

---

## 5) Invariantes / reglas de negocio (NO romper)

* Producto: **solo fútbol** (por ahora).
* Pools soportan **scoring presets** (MVP) y a futuro reglas personalizadas.
* `deadlineMinutesBeforeKickoff`:

  * Default: **10 minutos**
  * Configurable por pool
  * El usuario **no puede** editar picks si `isLocked=true` (deadline alcanzado).
* Resultados:

  * Host/Co‑admins pueden publicar
  * Players no
  * Correcciones (errata) requieren `reason` (obligatorio para version > 1)
  * Debe existir trazabilidad (versiones + actor + publishedAt)
* Reglas post‑creación:

  * MVP: **no editable**
  * Nice‑to‑have: votación unánime

---

## 6) Contratos críticos de API (DO NOT BREAK)

> Mantener esto sincronizado con `docs/API.md`. Si cambia aquí, debe actualizarse API.md.

### Auth

* Token JWT en header: `Authorization: Bearer <token>`
* Cualquier `401` debe activar hardening en FE.

### Picks

* `PUT /pools/:poolId/picks/:matchId`
* **Body esperado por backend** (IMPORTANTE):

```json
{ "pick": { "type": "SCORE", "homeGoals": 2, "awayGoals": 1 } }
```

o

```json
{ "pick": { "type": "OUTCOME", "outcome": "HOME" } }
```

Frontend:

* inputs llegan como string → convertir a Number antes de enviar.

### Results (Host)

* `PUT /pools/:poolId/results/:matchId`
* Primera publicación: marcador
* Errata (version > 1): `reason` obligatorio

### Catalog / Instances

* `GET /catalog/instances` devuelve instancias activas para crear pools.

### Me

* `GET /me/pools` lista pools donde el usuario es miembro activo.

### Errores (forma general)

* `401 UNAUTHENTICATED`
* `400 VALIDATION_ERROR`
* `403 FORBIDDEN`
* Otros: mantener consistencia y mensajes claros

---

## 7) Frontend: estándares de UX/UI

### Tema y layout

* Tema **claro por defecto**; no depender de `prefers-color-scheme` del navegador.
* Layout debe ser responsive (mobile y desktop).

### UX de picks (MVP polishing)

* Si el pick está guardado y no está en modo edición: **mostrar pick en modo lectura**.
* Mostrar botón **“Modificar elección”** solo si `!isLocked`.
* Si `isLocked`, mostrar estado “Pick cerrado” y bloquear edición.

### UX de resultados

* Sin resultado:

  * kickoff futuro → “Partido no jugado”
  * kickoff pasado → “Pendiente de resultado”
* Con resultado: “Resultado oficial” + marcador legible
* Mostrar fecha/hora del partido en timezone del pool.

### Manejo de errores

* Nunca renderizar objetos crudos.
* Mostrar errores accionables y consistentes.
* Indicadores de loading por acción (ej. por match).

---

## 8) Backend: estándares

* Validación estricta de input (Zod u equivalente si ya está).
* Auditoría obligatoria para acciones sensibles (results/erratas, cambios de estado).
* Migrations: cada cambio en Prisma debe venir con migración y notas.
* Evitar lógica duplicada: scoring centralizado.

---

## 9) Desarrollo local (Windows) — comandos

### Backend

```bat
cd backend
docker compose up -d
npm install
npx prisma migrate dev
npm run dev
```

Seeds:

```bat
npm run seed:test-accounts
npm run seed:wc2026-sandbox
```

### Frontend

```bat
cd frontend
npm install
npm run dev
```

---

## 10) Cuentas de prueba (NO hardcode)

Las cuentas de prueba se crean por seed y se parametrizan por variables `TEST_*` en `backend/.env`.

* `TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD`
* `TEST_HOST_EMAIL / TEST_HOST_PASSWORD`
* `TEST_PLAYER_EMAIL / TEST_PLAYER_PASSWORD`

Tokens de dev se pueden cargar con scripts en `backend/dev/` (ej. `tokens.cmd`) si existen.

**Regla:** jamás commitear credenciales ni imprimir tokens en logs compartidos.

---

## 11) Claude Code — modo agéntico pero seguro

### Permisos

* Permitir: Read/Edit + npm/node/npx + git status/diff/log.
* Pedir confirmación: docker, git commit/push, deletes.
* Denegar: `.env`, secrets, dumps.

(Se configura en `.claude/settings.json`.)

### Forma de trabajo esperada

Antes de cambiar código:

1. Identificar archivos exactos.
2. Proponer plan corto (3–7 bullets).
3. Implementar diff pequeño.
4. Dar pasos de prueba (curl + UI).

Nunca:

* Inventar requisitos.
* Leer/modificar `.env`.
* Hacer cambios masivos de estilo sin decisión.

---

## 12) Prioridades actuales (cuando el usuario diga "¿qué sigue?")

**Estado:** Documentación SoT completada ✅ (2026-01-02)

### Próximos pasos (Sprint 1 - Cierre):

1. ✅ **Consolidar docs** - COMPLETADO (toda la SoT en `/docs/sot/`)
2. **UX picks** (modo lectura + modificar antes de deadline)
3. **UX resultados** (estado + fecha + resultado oficial bonito)
4. **Mejoras visuales** (banderas, spacing, cards, responsive mobile)

### Preparación para v0.2-beta:

Revisar con el usuario las prioridades de v0.2-beta según [PRD.md](/docs/sot/PRD.md):
- Co-Admin system (nombrar, permisos, auditoría)
- Username único (separado de displayName)
- Multi-type pick system (4 tipos iniciales)
- Join approval workflow
- Player expulsion (permanent/temporary)
- Pool state machine (DRAFT/ACTIVE/COMPLETED/ARCHIVED)
- Timezone por usuario

---

## 13) Definition of Done (Sprint 1)

* ✅ **Documentación SoT completa** - 7 documentos profesionales en `/docs/sot/`
* Smoke test end‑to‑end pasa sin hacks
* Hardening confirmado (token expiry → logout)
* WC2026 sandbox usable (grupos A–L visibles y filtrables)
* Contratos API estables y documentados ✅
* UX picks pulido (modo lectura + edición)
* UX resultados pulido (estado + fecha + resultado oficial)
* Responsive mobile básico
* **Cierre del día:** docs actualizados en `/docs/sot/` si hubo cambios relevantes


