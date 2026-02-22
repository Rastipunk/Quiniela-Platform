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

* **Español, Inglés, Portugués** — i18n implementado con next-intl v4.

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
   - Stack completo (Backend: Node/Express/Prisma, Frontend: Next.js/App Router)
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

### 📂 Estructura de Documentación:

```
docs/
├── sot/                    # Source of Truth (documentación oficial)
│   ├── PRD.md              # Product Requirements
│   ├── DATA_MODEL.md       # Schema completo
│   ├── API_SPEC.md         # Contratos de API
│   ├── ARCHITECTURE.md     # Arquitectura técnica
│   ├── BUSINESS_RULES.md   # Reglas de negocio
│   ├── DECISION_LOG.md     # ADRs
│   ├── GLOSSARY.md         # Glosario
│   └── CURRENT_STATE.md    # Estado actual del sistema
├── guides/                 # Guías operativas
│   ├── GOOGLE_OAUTH_SETUP.md
│   ├── EMAIL_SYSTEM.md
│   ├── TOURNAMENT_ADVANCEMENT_GUIDE.md
│   └── WC2026_TOURNAMENT_STRUCTURE.md
```

* **CHANGELOG.md** en la raíz del proyecto contiene el historial de cambios
* Prisma schema en `backend/prisma/schema.prisma` → Implementación técnica (sigue vigente)

### ✅ Reglas de trabajo (obligatorias):

1. **Consultar SoT primero**: Antes de cualquier cambio, leer los docs relevantes en `/docs/sot/`.
2. **Cada decisión**: Registrar en `DECISION_LOG.md` con formato ADR.
3. **No inventar requisitos**: Si falta info, proponer opciones y pedir decisión.
4. **Diseño extensible**: Mantener templates/versionado/reglas por fase.
5. **Actualización de docs**: Al final del día o tras un hito claro (no en cada micro-paso).
6. **Cuando acordemos cambios**: Entregar texto exacto para actualizar docs (diff: qué se agregó/quitó/modificó).

---

## 2) Estado de features

### Completado ✅
* Register/Login (email/password + Google OAuth)
* Forgot/Reset password (Resend email)
* Email verification
* Dashboard con pools del usuario
* Crear pool / unirse por código
* Pool page: partidos por fases, reglas, leaderboard
* Picks (SCORE + OUTCOME + structural)
* Resultados (Host publish + errata + Smart Sync automático)
* Co-Admin system, Join approval, Player expulsion
* Rate limiting, Mobile UX, Notification badges
* Email notifications (transactional via Resend)
* Legal documents (versionado + consent)
* Next.js migration (SSR, App Router)
* SEO profesional (metadata, JSON-LD, sitemap, robots, OG images)
* Páginas regionales (polla, prode, penca, porra, football-pool)
* i18n (ES/EN/PT) con next-intl v4
* Google Analytics + Search Console
* Smart Sync (API-Football, resultados automáticos)
* UCL 2025-26 instance (45 partidos, 9 fases)

### Pendiente
* UI Admin para creación de templates sin código
* Chat del pool
* PWA completo (offline, push notifications)
* Más deportes

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
* Scoring: `backend/src/lib/scoringAdvanced.ts`, `backend/src/lib/pickPresets.ts`
* Smart Sync: `backend/src/services/smartSync/service.ts`
* API-Football: `backend/src/services/apiFootball/client.ts`

Rutas:

* `backend/src/routes/auth.ts` (register, login, Google OAuth, password recovery, email verification)
* `backend/src/routes/me.ts` (profile, pools, email preferences)
* `backend/src/routes/pools.ts` (CRUD, join, overview, members, invites)
* `backend/src/routes/picks.ts` (match picks + structural picks)
* `backend/src/routes/results.ts` (publish + structural results)
* `backend/src/routes/admin.ts` (platform admin)
* `backend/src/routes/adminInstances.ts` (instance management + sync)
* `backend/src/routes/adminTemplates.ts` (template management)
* `backend/src/routes/catalog.ts` (public instance listing)

Seeds/Scripts:

* `backend/src/scripts/seedAdmin.ts`
* `backend/src/scripts/seedTestAccounts.ts`
* `backend/src/scripts/seedWc2026Sandbox.ts`
* `backend/src/scripts/seedUcl2025.ts`
* `backend/src/scripts/seedLegalDocuments.ts`
* `backend/src/scripts/fetchUclData.ts`
* `backend/src/scripts/initSmartSyncStates.ts`

### `/frontend-next`

* Next.js 16 (App Router) + TypeScript
* next-intl v4 (i18n: ES/EN/PT)
* SSR para páginas públicas, CSR para autenticadas

Archivos clave:

* Layout: `frontend-next/src/app/[locale]/layout.tsx`
* i18n: `frontend-next/src/i18n/routing.ts`, `navigation.ts`, `request.ts`
* Messages: `frontend-next/src/messages/{es,en,pt}/*.json`
* Content (SEO): `frontend-next/src/content/{es,en,pt}/*.tsx`
* API client: `frontend-next/src/lib/api.ts`
* Auth: `frontend-next/src/hooks/useAuth.ts`
* Middleware: `frontend-next/src/proxy.ts` (www redirect + locale routing)
* Pool page: `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx`

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
cd frontend-next
npm install
npm run dev
```

---

## 10) Cuentas de prueba (NO hardcode)

Las cuentas de prueba se crean por seed y se parametrizan por variables `TEST_*` en `backend/.env`.

* `TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD`
* `TEST_HOST_EMAIL / TEST_HOST_PASSWORD`
* `TEST_PLAYER_EMAIL / TEST_PLAYER_PASSWORD`

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

**Estado:** v0.5.0 — i18n + SEO completados (2026-02-22)

### Completado recientemente:
- ✅ i18n completo (ES/EN/PT) con next-intl v4
- ✅ SEO profesional (metadata, JSON-LD, sitemap, hreflang)
- ✅ Páginas regionales (polla, prode, penca, porra, football-pool)
- ✅ Auth pages con generateMetadata
- ✅ Footer rediseñado con sección "Explore"
- ✅ Limpieza del repositorio para publicación

### Próximos pasos:
- Marketing: Product Hunt launch, AlternativeTo, SaaSHub, BetaList
- WC 2026 template preparation
- Code review fixes (setTimeout leaks, scoring consolidation)
- UI Admin para templates sin código


