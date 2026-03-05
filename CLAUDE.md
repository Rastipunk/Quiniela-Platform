# CLAUDE.md — Picks4All (Manual Operativo + Memoria del Repo)

> **Propósito:** Este archivo es la "memoria" y manual operativo que Claude Code debe leer para trabajar de forma consistente y profesional en este repositorio.
>
> **Regla de oro:** Si algo no está explícito aquí o en `/docs`, Claude debe **proponer opciones** y pedir decisión. **No inventar requisitos.**

---

## 0) Visión del producto (North Star)

Construir una plataforma web de **quinielas deportivas multi‑torneo** (por ahora **solo fútbol**) con tres roles:

* **PLAYER**: se une a pools, hace pronósticos (picks), ve reglas, resultados y leaderboard.
* **HOST**: crea/administra una pool, invita jugadores, publica resultados y realiza correcciones oficiales (erratas) con trazabilidad.
* **CORPORATE_HOST**: como HOST pero para pools corporativos creados a través del flujo empresarial.
* **PLATFORM ADMIN** (dueño de la plataforma): gestiona **templates** (torneos pre‑configurados) y **instances** (ediciones jugables), y controla catálogo/curación de torneos.

Meta final:

* UX y estética **altísimo nivel profesional**.
* Arquitectura robusta y **escalable** (templates/versionado/reglas por fase).
* Preparado para futuro: resultados por API externa, más deportes, más reglas.

Idioma:

* **Español, Inglés, Portugués** — i18n implementado con next-intl v4.

---

## 1) Fuente de verdad (Source of Truth) + regla de trabajo

### 📚 Documentación SoT (Source of Truth)

**CRÍTICO:** Antes de hacer cualquier cambio al código o tomar decisiones, **SIEMPRE consulta `/docs/sot/`**.

La documentación oficial y completa está en:

1. **[PRD.md](/docs/sot/PRD.md)** - Product Requirements Document
2. **[DATA_MODEL.md](/docs/sot/DATA_MODEL.md)** - Modelo de Datos Completo
3. **[API_SPEC.md](/docs/sot/API_SPEC.md)** - Especificación de API
4. **[ARCHITECTURE.md](/docs/sot/ARCHITECTURE.md)** - Arquitectura Técnica
5. **[BUSINESS_RULES.md](/docs/sot/BUSINESS_RULES.md)** - Reglas de Negocio
6. **[DECISION_LOG.md](/docs/sot/DECISION_LOG.md)** - Log de Decisiones Arquitectónicas (37+ ADRs)
7. **[GLOSSARY.md](/docs/sot/GLOSSARY.md)** - Glosario de Términos
8. **[CURRENT_STATE.md](/docs/sot/CURRENT_STATE.md)** - Estado actual del sistema

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
* Prisma schema en `backend/prisma/schema.prisma` → Implementación técnica

### 🎯 Regla de Oro para Claude:

- **Si algo está documentado en `/docs/sot/`, ESA es la verdad absoluta.**
- **Si hay contradicción entre código y docs → AVISAR al usuario para decidir.**
- **Toda nueva decisión (arquitectura, producto, contrato) → Registrar en `DECISION_LOG.md`.**
- **Si falta información → Proponer opciones, pedir decisión, documentar la elegida.**

### ✅ Reglas de trabajo (obligatorias):

1. **Consultar SoT primero**: Antes de cualquier cambio, leer los docs relevantes en `/docs/sot/`.
2. **Cada decisión**: Registrar en `DECISION_LOG.md` con formato ADR.
3. **No inventar requisitos**: Si falta info, proponer opciones y pedir decisión.
4. **Diseño extensible**: Mantener templates/versionado/reglas por fase.
5. **Actualización de docs**: Al final del día o tras un hito claro (no en cada micro-paso).

---

## 2) Estado de features

### Completado ✅
* Register/Login (email/password + Google OAuth)
* Forgot/Reset password (Resend email)
* Email verification
* Dashboard con pools del usuario (tabs En curso / Finalizadas)
* Crear pool / unirse por código
* Pool page: partidos por fases, reglas, leaderboard
* Picks (SCORE + OUTCOME + structural)
* Resultados (Host publish + errata + Smart Sync automático)
* Co-Admin system, Join approval, Player expulsion
* Leave pool (jugador se retira voluntariamente, conserva puntos, modo read-only)
* Rate limiting, Mobile UX, Notification badges
* Email notifications (transactional via Resend)
* Legal documents (versionado + consent)
* Next.js 16 migration (SSR, App Router)
* SEO profesional (metadata, JSON-LD, sitemap, robots, OG images)
* Páginas regionales (polla, prode, penca, porra, football-pool)
* i18n (ES/EN/PT) con next-intl v4
* Google Analytics + Search Console
* Smart Sync (API-Football, resultados automáticos)
* UCL 2025-26 instance (45 partidos, 9 fases)
* Corporate Self-Service MVP (Organization, inquiry, corporate pools, employee invites, CSV upload, activation flow)
* Pricing section + /precios page

### Pendiente
* UI Admin para creación de templates sin código
* Chat del pool
* PWA completo (offline, push notifications)
* Más deportes
* Payment integration (Lemon Squeezy)

---

## 3) Stack y estructura real del repo

Monorepo:

### `/backend`

* Node + Express 5 + TypeScript
* Prisma + Postgres (Railway production, Docker local)

Archivos clave:

* Prisma: `backend/prisma/schema.prisma`
* Server: `backend/src/server.ts`
* DB: `backend/src/db.ts`
* JWT/Auth helpers: `backend/src/lib/jwt.ts`, `backend/src/lib/password.ts`
* Middleware: `backend/src/middleware/requireAuth.ts`, `backend/src/middleware/requireAdmin.ts`
* Scoring: `backend/src/lib/scoringAdvanced.ts`, `backend/src/lib/pickPresets.ts`
* Smart Sync: `backend/src/services/smartSync/service.ts`
* API-Football: `backend/src/services/apiFootball/client.ts`
* Email: `backend/src/lib/email.ts`, `backend/src/lib/emailTemplates.ts`

Rutas:

* `backend/src/routes/auth.ts` (register, login, Google OAuth, password recovery, email verification, corporate activation)
* `backend/src/routes/me.ts` (profile, pools, email preferences)
* `backend/src/routes/pools.ts` (CRUD, join, leave, overview, members, invites, kick, ban)
* `backend/src/routes/picks.ts` (match picks + structural picks)
* `backend/src/routes/results.ts` (publish + structural results)
* `backend/src/routes/admin.ts` (platform admin)
* `backend/src/routes/adminInstances.ts` (instance management + sync)
* `backend/src/routes/adminTemplates.ts` (template management)
* `backend/src/routes/adminCorporate.ts` (corporate admin)
* `backend/src/routes/corporate.ts` (corporate self-service)
* `backend/src/routes/catalog.ts` (public instance listing)
* `backend/src/routes/feedback.ts` (beta feedback)
* `backend/src/routes/legal.ts` (legal documents)

Seeds/Scripts:

* `backend/src/scripts/seedAdmin.ts`
* `backend/src/scripts/seedTestAccounts.ts`
* `backend/src/scripts/seedWc2026Sandbox.ts`
* `backend/src/scripts/seedUcl2025.ts`
* `backend/src/scripts/seedLegalDocuments.ts`
* `backend/src/scripts/fetchUclData.ts`
* `backend/src/scripts/initSmartSyncStates.ts`
* `backend/src/scripts/updateUclR16Draw.ts`
* `backend/src/scripts/migrateExtraTimeConfig.ts`

### `/frontend-next`

* Next.js 16 (App Router) + React 19 + TypeScript
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
* Corporate: `frontend-next/src/components/CorporatePoolCreation.tsx`, `EnterpriseLandingContent.tsx`
* Auth context: `frontend-next/src/contexts/AuthPanelContext.tsx`

---

## 4) Dominio (conceptos) y modelo mental

### Entidades de alto nivel

* **TournamentTemplate**: definición del torneo (equipos, estructura, reglas base, fixture base). Puede tener múltiples versiones.
* **TournamentTemplateVersion**: snapshot versionado del template (inmutable una vez publicado).
* **TournamentInstance**: instancia jugable basada en un template/version (ej. "WC 2026").
* **Pool**: grupo de usuarios que compiten sobre una instancia (configurable: preset scoring, deadline, tz, visibilidad).
* **PoolMember**: membresía usuario↔pool con rol (HOST/CO_ADMIN/PLAYER/CORPORATE_HOST) y estado (ACTIVE/LEFT/BANNED/PENDING_APPROVAL).
* **Pick**: pronóstico del usuario por partido.
* **Result**: resultado oficial por partido (publicado por host o Smart Sync) con **versionado** y razón para erratas.
* **Organization**: empresa asociada a pools corporativos.
* **AuditEvent**: eventos relevantes (creación pool, join, leave, publicar resultado, errata, etc.).

---

## 5) Invariantes / reglas de negocio (NO romper)

* Producto: **solo fútbol** (por ahora).
* Pools soportan **scoring presets** (CUMULATIVE, BASIC, SIMPLE, CUSTOM).
* `deadlineMinutesBeforeKickoff`:
  * Default: **10 minutos**
  * Configurable por pool
  * El usuario **no puede** editar picks si `isLocked=true` (deadline alcanzado).
* Resultados:
  * Host/Co‑admins pueden publicar
  * Players no
  * Correcciones (errata) requieren `reason` (obligatorio para version > 1)
  * Debe existir trazabilidad (versiones + actor + publishedAt)
* Leave pool:
  * Solo jugadores pueden salirse (HOST y CORPORATE_HOST NO pueden)
  * Status cambia a LEFT, se registra leftAtUtc
  * Conservan puntos en leaderboard, aparecen como "Retirado"
  * No pueden hacer más picks, modo read-only
* Reglas post‑creación:
  * **No editable** después de crear la pool

---

## 6) Contratos críticos de API (DO NOT BREAK)

> Mantener sincronizado con `docs/sot/API_SPEC.md`.

### Auth
* Token JWT en header: `Authorization: Bearer <token>`

### Picks
* `PUT /pools/:poolId/picks/:matchId`
* Body: `{ "pick": { "type": "SCORE", "homeGoals": 2, "awayGoals": 1 } }`

### Results
* `PUT /pools/:poolId/results/:matchId`
* Errata (version > 1): `reason` obligatorio

### Pool Leave
* `POST /pools/:poolId/leave` — jugador se retira voluntariamente

### Me
* `GET /me/pools` — incluye pools con status ACTIVE, PENDING_APPROVAL, y LEFT

---

## 7) Frontend: estándares de UX/UI

* Tema **claro por defecto**.
* Layout responsive (mobile y desktop).
* Pick guardado → modo lectura. Botón "Modificar" solo si `!isLocked`.
* `isLocked` incluye deadline + status LEFT.
* Manejo de errores: nunca renderizar objetos crudos.
* Indicadores de loading por acción.

---

## 8) Backend: estándares

* Validación estricta de input (Zod).
* Auditoría obligatoria para acciones sensibles.
* Migrations: cada cambio en Prisma debe venir con migración.
* Scoring centralizado en `scoringAdvanced.ts`.

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
npm run seed:admin
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

### Forma de trabajo esperada

Antes de cambiar código:

1. Identificar archivos exactos.
2. Proponer plan corto (3–7 bullets).
3. Implementar diff pequeño.
4. Dar pasos de prueba (curl + UI).

---

## 12) Prioridades actuales

**Estado:** v0.6.0 — Corporate Self-Service MVP (2026-03-01)

### Completado recientemente:
- ✅ Corporate Self-Service (Organization, invites, activation, CSV upload)
- ✅ Leave pool feature + dashboard tabs (En curso / Finalizadas)
- ✅ Pricing section + /precios page
- ✅ Locale-aware emails
- ✅ i18n completo (ES/EN/PT)
- ✅ SEO profesional

### Próximos pasos:
- Payment integration (Lemon Squeezy)
- WC 2026 template preparation
- Code quality fixes (error handler, CORS, duplicate routes, scoring consolidation)
- UI Admin para templates sin código
