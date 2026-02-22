# Current State - Quiniela Platform

> **Ultima actualizacion:** 2026-02-22 | **Version:** v0.5.0 (i18n + SEO + Repo Cleanup)

---

## Estado General

**Resumen ejecutivo:** La plataforma está en estado v0.5.0. Frontend en **Next.js App Router** con SSR, **i18n completo (ES/EN/PT)** via next-intl v4, SEO profesional con hreflang/sitemap multi-locale, páginas regionales para todo el mercado hispanohablante + EN/PT, y repo limpio listo para open source. PageSpeed Insights: Performance 93, Accessibility 95, Best Practices 96, **SEO 100**.

### Cambios Recientes (v0.5.0 - 2026-02-22)

1. **i18n (ES/EN/PT)** — next-intl v4
   - `localePrefix: 'as-needed'` (Spanish no prefix, EN/PT with prefix)
   - Translation JSONs in `messages/{es,en,pt}/`
   - Heavy SEO content as JSX in `content/{es,en,pt}/`
   - LanguageSelector component, cookie persistence
   - Regional pages: `/en/football-pool`, `/pt/penca-futbol`
   - Legal pages translated to EN/PT
   - hreflang alternates, localized sitemap (36 entries)
   - generateMetadata on all pages including auth pages

2. **Repo Cleanup** (pre-open-source)
   - Removed `frontend/` (old Vite SPA, 64 files)
   - Removed `backend/dev/` (31 dump files), `backend/tmp/` (3 files)
   - Removed 39 one-time scripts from `backend/src/scripts/`
   - Removed `docs/TODO_NEXT_SESSION.md` (contained exposed API key)
   - Removed `docs/sprints/` (3 historical reports)
   - Removed 14 root-level artifacts (empty files, Windows path dumps)
   - Updated all SoT documentation to reflect current state
   - Added README.md with project description and backlinks

### Cambios v0.4.0 (2026-02-13)

1. **Next.js Migration (ADR-033)**
   - Frontend completamente migrado a Next.js App Router (`/frontend-next`)
   - SSR para todas las páginas públicas (landing, FAQ, cómo funciona, legal, regionales)
   - Páginas autenticadas migradas: login, dashboard, pool, profile, admin
   - Blue-green deployment: nuevo servicio Railway "Frontend-Next"
   - Dominio picks4all.com apuntando al nuevo frontend

2. **SEO Profesional**
   - Metadata API con títulos, descripciones y OG tags por página
   - JSON-LD: Organization, FAQPage, DefinedTermSet, WebApplication
   - Sitemap dinámico con 10 páginas públicas
   - robots.txt (bloquea /dashboard, /pools, /admin, /profile)
   - Favicon dinámico con branding (P morada)
   - OG image 1200x630 para social sharing
   - URLs en español: /como-funciona, /terminos, /privacidad
   - www → non-www redirect 301 via middleware

3. **Páginas Regionales SEO**
   - `/que-es-una-quiniela` — Glosario con todos los términos regionales
   - `/polla-futbolera` — Colombia, Chile, Venezuela
   - `/prode-deportivo` — Argentina
   - `/penca-futbol` — Uruguay
   - `/porra-deportiva` — España
   - Internal linking entre todas las páginas regionales

4. **Google Analytics + Search Console**
   - GA4 integrado (G-8JG2YTDLPH)
   - GSC verificado, sitemap submitted, páginas indexándose
   - Core Web Vitals optimizados (browserslist moderno)

5. **Safari Google Login Fix**
   - Deshabilitado FedCM (`use_fedcm_for_prompt: false`)
   - Script GIS cargado con `beforeInteractive`
   - Timeout de retry aumentado de 5s a 10s
   - Mensaje de error visible si Google no carga

### Cambios v0.3.5 (2026-02-10)

1. **Revisión Profunda de Código**
   - 24 hallazgos en Backend (4 CRITICAL, 6 HIGH, 8 MEDIUM, 6 LOW)
   - 30 hallazgos en Frontend (7 CRITICAL, 7 HIGH, 8 MEDIUM, 8 LOW)
   - Ver sección "Code Review Findings" abajo para detalle completo

2. **Railway Deployment Fixes**
   - Corregidos errores TypeScript en pickPresets.ts (union type) y pools.ts (optional chaining)
   - Node.js bumped a v22 (backend)
   - Added `NPM_CONFIG_PRODUCTION=false` para instalar devDependencies en build

### Cambios v0.3.4 (2026-02-04 a 2026-02-09)

1. **Smart Sync - Resultados Automáticos (ADR-031, ADR-032)**
   - Sistema híbrido: modo MANUAL (Host ingresa) y AUTO (API-Football)
   - Smart Sync optimizado: 2-4 llamadas API por partido (vs 20-30 con polling)
   - MatchSyncState machine: PENDING → IN_PROGRESS → AWAITING_FINISH → COMPLETED
   - ResultSource tracking: HOST_MANUAL, HOST_PROVISIONAL, API_CONFIRMED, HOST_OVERRIDE
   - Cron job cada minuto evalúa qué partidos necesitan consulta
   - Kill switch (`syncEnabled`) para emergencias

2. **UCL 2025-26 Instance**
   - Template `ucl-2025` con 9 fases (Dieciseisavos ×2, R16 ×2, QF ×2, SF ×2, Final)
   - 45 partidos totales: 16 programados (Dieciseisavos) + 29 placeholder
   - 16 mapeos de fixture a API-Football
   - Instance ID: `ucl-2025-instance`
   - Seeded en producción con sync states inicializados

3. **Producción Configurada**
   - API-Football key y variables configuradas en Railway
   - Smart Sync habilitado en producción
   - Backend corriendo en commit `ac348ed`

### Cambios v0.3.3 (2026-02-01)

1. **Rebranding a Picks4All**
   - Landing page pública con hero, features, how-it-works
   - Páginas públicas: `/how-it-works`, `/faq`
   - Slide-in Auth Panel (ADR-030)
   - Dominio: picks4all.com / api.picks4all.com

---

## Funcionalidades Completadas

### Core (Sprint 1)
| Feature | Estado | Notas |
|---------|--------|-------|
| Register/Login email | ✅ COMPLETO | JWT 4h expiry |
| Google OAuth | ✅ COMPLETO | Via google-auth-library |
| Password Recovery | ✅ COMPLETO | Via Resend email |
| Username unico | ✅ COMPLETO | 3-20 chars, immutable |
| Dashboard | ✅ COMPLETO | Lista pools del usuario |
| Crear/Unirse a Pool | ✅ COMPLETO | Por codigo de invitacion |
| Picks por partido | ✅ COMPLETO | SCORE type con deadline |
| Resultados (Host) | ✅ COMPLETO | Versioning + erratas |
| Leaderboard | ✅ COMPLETO | Scoring presets |

### Sprint 2 - Advanced Features
| Feature | Estado | Notas |
|---------|--------|-------|
| Pool State Machine | ✅ COMPLETO | DRAFT → ACTIVE → COMPLETED → ARCHIVED |
| Co-Admin System | ✅ COMPLETO | Rol CO_ADMIN con permisos delegados |
| Join Approval | ✅ COMPLETO | Pool puede requerir aprobación |
| Player Expulsion | ✅ COMPLETO | Ban temporal/permanente |
| User Profile | ✅ COMPLETO | Estadísticas, timezone, displayName |
| Advanced Pick Types | ✅ COMPLETO | Ver sección detallada abajo |
| Fixture Snapshot | ✅ COMPLETO | Copia independiente por pool |
| **Cumulative Scoring** | ✅ COMPLETO | Puntos acumulan por criterio |
| **Player Summary** | ✅ COMPLETO | Resumen personal de puntos por partido |
| **Pick Visibility** | ✅ COMPLETO | Picks visibles post-deadline |

### Sprint 3 - Notificaciones + Mobile UX + Rate Limiting + Email
| Feature | Estado | Notas |
|---------|--------|-------|
| **Notification Badges** | ✅ COMPLETO | Badges en tabs con polling 60s |
| **Rate Limiting** | ✅ COMPLETO | 100 req/min API, 10/15min auth |
| **Mobile UX (Tabs)** | ✅ COMPLETO | Tabs scrollables, touch 44px |
| **Mobile UX (Wizard)** | ✅ COMPLETO | Bottom sheet, layouts compactos |
| **Light Theme Enforcement** | ✅ COMPLETO | Forzado independiente del SO |
| **Email Notifications** | ✅ COMPLETO | Resend transactional emails |
| **Email Verification** | ✅ COMPLETO | Token-based, 24h expiry |
| **Admin Email Settings** | ✅ COMPLETO | Toggle por tipo de email |
| **User Email Preferences** | ✅ COMPLETO | Master toggle + granular |
| **Legal Documents** | ✅ COMPLETO | Versionado + consent tracking |

### Sprint 4 - Auto Results + Public Website
| Feature | Estado | Notas |
|---------|--------|-------|
| **Rebranding Picks4All** | ✅ COMPLETO | Landing, FAQ, How-it-Works |
| **Slide-in Auth Panel** | ✅ COMPLETO | ADR-030, login sin navegación |
| **Auto Results (API-Football)** | ✅ COMPLETO | ADR-031, modo AUTO/MANUAL |
| **Smart Sync** | ✅ COMPLETO | ADR-032, 85-90% menos requests |
| **UCL 2025-26** | ✅ COMPLETO | 45 partidos, 9 fases, seeded |
| **Custom Domain** | ✅ COMPLETO | picks4all.com via Cloudflare |

### Sprint 5 - Next.js Migration + SEO
| Feature | Estado | Notas |
|---------|--------|-------|
| **Next.js Migration** | ✅ COMPLETO | ADR-033, App Router, SSR |
| **SEO Profesional** | ✅ COMPLETO | Metadata, JSON-LD, sitemap, robots |
| **Páginas Regionales** | ✅ COMPLETO | 5 páginas ES + 1 EN + 1 PT |
| **Google Analytics** | ✅ COMPLETO | GA4 G-8JG2YTDLPH |
| **Google Search Console** | ✅ COMPLETO | Verificado, sitemap submitted |
| **Core Web Vitals** | ✅ COMPLETO | 93/95/96/100 PageSpeed |
| **Safari Google Fix** | ✅ COMPLETO | FedCM disabled, beforeInteractive |
| **www Redirect** | ✅ COMPLETO | 301 via middleware |
| **Branded Favicon** | ✅ COMPLETO | Dynamic icon.tsx (P morada) |

### Sprint 6 - i18n + Repo Cleanup
| Feature | Estado | Notas |
|---------|--------|-------|
| **i18n (ES/EN/PT)** | ✅ COMPLETO | next-intl v4, localePrefix as-needed |
| **Translation System** | ✅ COMPLETO | JSONs + JSX content per locale |
| **LanguageSelector** | ✅ COMPLETO | Dropdown con banderas |
| **Localized SEO** | ✅ COMPLETO | hreflang, sitemap multi-locale |
| **Auth Pages Metadata** | ✅ COMPLETO | generateMetadata en login, forgot-pw, etc |
| **Footer Redesign** | ✅ COMPLETO | Sección "Explore" unificada |
| **Regional EN/PT** | ✅ COMPLETO | football-pool (EN), penca (PT) |
| **Legal EN/PT** | ✅ COMPLETO | Términos y privacidad traducidos |
| **Repo Cleanup** | ✅ COMPLETO | Eliminados 120+ archivos obsoletos |
| **README.md** | ✅ COMPLETO | Para GitHub público |

### Advanced Pick Types System

El sistema soporta dos modos de picks:

**1. Match-based Picks (con marcador)**
- EXACT_SCORE: Marcador exacto (10 pts en cumulative)
- MATCH_OUTCOME_90MIN: Resultado del partido (5 pts grupos / 10 pts knockouts)
- HOME_GOALS: Acierto goles local (2 pts grupos / 4 pts knockouts)
- AWAY_GOALS: Acierto goles visitante (2 pts grupos / 4 pts knockouts)
- GOAL_DIFFERENCE: Diferencia de goles (1 pt grupos / 2 pts knockouts)
- PARTIAL_SCORE: Marcador parcial
- TOTAL_GOALS: Total de goles

**2. Structural Picks (sin marcador)**
- GROUP_STANDINGS: Ordenar posiciones de cada grupo (1-4)
- KNOCKOUT_WINNER: Seleccionar quien avanza

**4 Presets disponibles:**
- **CUMULATIVE (Recomendado)**: Puntos acumulan por cada criterio acertado
  - Grupos: max 10 pts (resultado 5 + local 2 + visitante 2 + diferencia 1)
  - Knockouts: max 20 pts (resultado 10 + local 4 + visitante 4 + diferencia 2)
- **BASIC**: Puntos solo por marcador exacto o resultado
- **ADVANCED**: Todos los criterios con puntos altos
- **SIMPLE**: Configuración automática sin marcador en grupos

### Sistema de Scoring

**Dos modos de evaluación:**

1. **Cumulative Scoring** (detectado por HOME_GOALS o AWAY_GOALS activos):
   - Evalúa TODOS los criterios configurados
   - Suma puntos por cada acierto independiente
   - Ejemplo: Pick 2-1 vs Resultado 2-1 = 10+5+2+2+1 = 20 pts

2. **Legacy Scoring** (sin HOME_GOALS/AWAY_GOALS):
   - EXACT_SCORE termina evaluación si acierta (no acumula)
   - Otorga el mayor puntaje único posible

### Smart Sync System

**Arquitectura:**
```
Cron (cada min) → SmartSyncJob → SmartSyncService → API-Football Client
                       │                                     │
                       ▼                                     ▼
              MatchSyncState (DB)                    API-Football API
              PENDING → IN_PROGRESS →               v3.football.api-sports.io
              AWAITING_FINISH → COMPLETED
```

**Flujo por partido:**
1. `PENDING`: Espera kickoff + 5 min
2. `IN_PROGRESS`: Primera consulta confirma que inició
3. `AWAITING_FINISH`: Espera kickoff + 110 min, luego poll cada 5 min
4. `COMPLETED`: Resultado obtenido, nunca más consultar

**Eficiencia:** 2-4 requests por partido (vs 20-30 con polling cada 5 min)

**Fuentes de resultado:**
| Source | Significado | Override por API? |
|--------|-------------|-------------------|
| HOST_MANUAL | Host en instancia MANUAL | N/A |
| HOST_PROVISIONAL | Host en AUTO, espera API | Sí |
| API_CONFIRMED | Resultado oficial de API | N/A |
| HOST_OVERRIDE | Host corrigió API (reason) | No |

---

## Arquitectura Actual

### Backend
```
backend/
  src/
    routes/          # Endpoints Express
    lib/             # Utilities (jwt, password, scoring, email, etc.)
    services/        # Business logic
    │ ├── smartSync/      # Smart Sync service
    │ ├── apiFootball/    # API-Football client + types
    │ ├── resultSync/     # Result sync logic
    │ └── ...
    middleware/      # Auth, admin, rate limit
    validation/      # Zod schemas
    types/           # TypeScript types
    jobs/            # Cron jobs (smartSyncJob, resultSyncJob)
    scripts/         # Seeds, migrations, diagnostics
  prisma/
    schema.prisma    # 30+ modelos
    migrations/      # 30+ migraciones
```

### Frontend (Next.js — `/frontend-next`)
```
frontend-next/
  src/
    app/             # Next.js App Router pages
    │ ├── layout.tsx           # Root layout (metadata, GA4, Google Identity)
    │ ├── page.tsx             # Landing page (SSR)
    │ ├── login/page.tsx       # Login/Register
    │ ├── (authenticated)/     # Route group with AuthGuard
    │ │ ├── dashboard/page.tsx
    │ │ ├── pools/[poolId]/page.tsx
    │ │ ├── profile/page.tsx
    │ │ └── admin/...
    │ ├── como-funciona/       # Public SSR pages
    │ ├── faq/
    │ ├── que-es-una-quiniela/
    │ ├── polla-futbolera/     # Regional SEO pages
    │ ├── prode-deportivo/
    │ ├── penca-futbol/
    │ ├── porra-deportiva/
    │ ├── sitemap.ts           # Dynamic sitemap
    │ ├── robots.ts            # Dynamic robots.txt
    │ ├── icon.tsx             # Dynamic favicon
    │ └── opengraph-image.tsx  # Dynamic OG image
    components/      # UI components (NavBar, PoolConfigWizard, etc.)
    lib/             # api.ts, auth.ts, timezone.ts
    hooks/           # useIsMobile, useAuth, usePoolNotifications
    data/            # Static data (teamFlags)
    middleware.ts    # www → non-www redirect
```

> **Nota:** El frontend antiguo (`/frontend` — Vite SPA) fue eliminado en v0.5.0. El servicio "Frontend" antiguo en Railway debería eliminarse.

### Base de Datos (PostgreSQL)
- 30+ modelos Prisma
- Nuevos modelos Sprint 4:
  - MatchExternalMapping (mapeo interno ↔ API-Football)
  - ResultSyncLog (logs de sincronización)
  - MatchSyncState (estado de sync por partido)
- Nuevos enums:
  - ResultSourceMode (MANUAL | AUTO)
  - ResultSource (HOST_MANUAL | HOST_PROVISIONAL | API_CONFIRMED | HOST_OVERRIDE)
  - MatchSyncStatus (PENDING | IN_PROGRESS | AWAITING_FINISH | COMPLETED | SKIPPED)
  - SyncStatus (RUNNING | COMPLETED | FAILED | PARTIAL)

---

## Endpoints Principales

### Auth
- `POST /auth/register` - Registro con email/username (requiere consents)
- `POST /auth/login` - Login email/password
- `POST /auth/google` - Login con Google (consent flow para nuevos)
- `POST /auth/forgot-password` - Enviar email reset
- `POST /auth/reset-password` - Resetear password
- `POST /auth/verify-email` - Verificar email con token
- `POST /auth/resend-verification` - Reenviar email de verificación

### Pools
- `POST /pools` - Crear pool
- `GET /pools/:id` - Pool overview con leaderboard
- `POST /pools/:id/invites` - Crear codigo invitacion
- `POST /pools/join` - Unirse con codigo
- `POST /pools/:id/members/:mid/promote` - Promover a CO_ADMIN
- `POST /pools/:id/members/:mid/demote` - Degradar a PLAYER
- `POST /pools/:id/members/:mid/ban` - Banear miembro
- `POST /pools/:id/approve-member/:mid` - Aprobar solicitud

### Picks
- `PUT /pools/:id/picks/:matchId` - Guardar pick por partido
- `GET /pools/:id/structural-picks/:phaseId` - Ver picks estructurales
- `PUT /pools/:id/structural-picks` - Guardar picks estructurales

### Results
- `PUT /pools/:id/results/:matchId` - Publicar resultado
- `PUT /pools/:id/structural-results/:phaseId` - Publicar resultado estructural

### User
- `GET /me/pools` - Mis pools
- `GET /me/profile` - Mi perfil
- `PATCH /me/profile` - Actualizar perfil
- `GET /me/email-preferences` - Preferencias de email
- `PUT /me/email-preferences` - Actualizar preferencias de email

### Admin (Platform Admin only)
- `GET /admin/settings/email` - Obtener configuración de emails
- `PUT /admin/settings/email` - Actualizar toggles de emails
- `POST /admin/instances/:id/enable-auto-results` - Habilitar modo AUTO
- `POST /admin/instances/:id/trigger-sync` - Disparar sync manual
- `GET /admin/instances/:id/sync-status` - Estado del sync job

---

## Scripts Disponibles

### Seeds (desarrollo)
```bash
npm run seed:admin              # Crear admin
npm run seed:test-accounts      # Cuentas de prueba
npm run seed:wc2026-sandbox     # Torneo WC2026
npm run seed:ucl2025            # UCL 2025-26
npm run seed:legal-documents    # Términos y privacidad
npm run init:smart-sync         # Inicializar estados de Smart Sync
```

> **Nota:** En v0.5.0 se eliminaron ~39 scripts de un solo uso (check*, fix*, migrate*, test*). Solo quedan los seeds activos y `fetchUclData.ts`.

---

## Variables de Entorno

### Backend (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...
FRONTEND_URL=http://localhost:5173
NODE_ENV=development|production

# API-Football (Smart Sync)
API_FOOTBALL_KEY=...
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_ENABLED=true
API_FOOTBALL_RATE_LIMIT=10
SMART_SYNC_ENABLED=true
```

### Frontend (Next.js)
- `NEXT_PUBLIC_API_URL` — API base URL
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google OAuth client ID

### Railway (Production)
- `releaseCommand` en railway.toml ejecuta `npx prisma migrate deploy` automáticamente
- `trust proxy` habilitado para rate limiting correcto
- Backend: `NPM_CONFIG_PRODUCTION=false` + NIXPACKS_NODE_VERSION=22
- Frontend-Next: `output: 'standalone'`, start command `node .next/standalone/server.js`

---

## Configuración de Producción

### Dominio: picks4all.com

**Registrador:** Cloudflare

**DNS Records (Cloudflare → Railway):**

| Subdominio | Tipo | Name | Target (Railway CNAME) |
|------------|------|------|------------------------|
| Root | CNAME | `@` | `gxpatrmu.up.railway.app` |
| www | CNAME | `www` | `y1jrmv7q.up.railway.app` |
| API | CNAME | `api` | `a1q8fzl4.up.railway.app` |

**URLs de Producción:**
- Frontend (Next.js): `https://picks4all.com` (www redirige a non-www)
- Backend API: `https://api.picks4all.com`

**Railway Project:** poetic-success (ID: 40a0c639-e009-4245-aa0a-65e8fc313625)
- Backend service: daa3af02-3f89-443b-bb2e-0e028f86146a
- Frontend-Next service: ad6cc321-0e26-454b-8253-a2b67f49a050
- Postgres service: f2551801-2c01-41e8-81d3-b7d44105b631
- Frontend (Vite - LEGACY, pendiente de eliminar): 6fc1cfb2-178c-4e2b-a13c-8f9d77aefb0b

### Instances en Producción
| Instance | Template Key | Status | Modo | Partidos |
|----------|-------------|--------|------|----------|
| UCL 2025-26 | ucl-2025 | ACTIVE | AUTO | 45 (16 mapped) |

---

## Code Review Findings (2026-02-10)

### Backend - 24 Hallazgos

#### CRITICAL (4)
| # | Issue | Archivo(s) | Impacto |
|---|-------|-----------|---------|
| B1 | Email fire-and-forget sin tracking | auth.ts, results.ts, poolStateMachine.ts | Emails perdidos silenciosamente |
| B2 | Race condition en invite counter | pools.ts:1375-1421 | Más joins que maxUses |
| B3 | Placeholder validation hardcodeada | picks.ts:145-149 | Prefijos "W_" podrían bloquear equipos reales |
| B4 | Password verification faltante | pools.ts (delete pool, ban, etc.) | Operaciones destructivas sin re-auth |

#### HIGH (6)
| # | Issue | Archivo(s) |
|---|-------|-----------|
| B5 | Body size sin validación por campo | server.ts (1mb global) |
| B6 | `as any` excesivo (40+ instancias) | picks.ts, results.ts, pools.ts |
| B7 | Scoring duplicado en 3 lugares | pools.ts, scoringAdvanced.ts, poolStateMachine.ts |
| B8 | Transaction error handling incompleto | pools.ts:1375-1430 |
| B9 | OAuth username collision race | auth.ts:465-488 |
| B10 | Bootstrap admin sin audit log | admin.ts:14-56 |

#### MEDIUM (8)
| # | Issue |
|---|-------|
| B11 | Error responses inconsistentes (5+ formatos) |
| B12 | JSON extraction sin validación de estructura |
| B13 | Operaciones destructivas sin confirmación |
| B14 | Rate limiting no aplicado a pool creation |
| B15 | Cascade deletes faltantes en Pool |
| B16 | Emails en logs sin enmascarar (GDPR) |
| B17 | Max length faltante en algunos text fields |
| B18 | JWT error handling limitado a TokenExpired |

#### LOW (6)
| # | Issue |
|---|-------|
| B19 | Console.log de debug en producción (groupStandings.ts) |
| B20 | Validación de penalties (correcta, solo nota) |
| B21 | Código comentado en server.ts |
| B22 | Falta JSDoc en endpoints |
| B23 | Email config hardcodeada |
| B24 | Sin request tracing (X-Request-ID) |

### Frontend - 30 Hallazgos

#### CRITICAL (7)
| # | Issue | Archivo(s) |
|---|-------|-----------|
| F1 | setTimeout memory leak | EmailPreferencesSection.tsx:116 |
| F2 | setTimeout memory leak (×4) | GroupStandingsCard.tsx:188, 235, 255, 952 |
| F3 | setTimeout memory leak (×2) | KnockoutMatchCard.tsx:145, 201 |
| F4 | setTimeout memory leak | AdminEmailSettingsPage.tsx:117 |
| F5 | setTimeout memory leak | ProfilePage.tsx:124 |
| F6 | setTimeout memory leak | VerifyEmailPage.tsx:47 |
| F7 | setTimeout memory leak | StructuralPicksManager.tsx:219 |

**Patrón común:** `setTimeout(() => setState(null), 2000)` sin cleanup en useEffect. Si el componente se desmonta antes del timeout, se llama setState en componente desmontado.

**Fix recomendado:**
```typescript
useEffect(() => {
  if (success) {
    const timer = setTimeout(() => setSuccess(null), 2000);
    return () => clearTimeout(timer);
  }
}, [success]);
```

#### HIGH (7)
| # | Issue | Archivo(s) |
|---|-------|-----------|
| F8 | console.log debug '[TOGGLE]' (×5) | PoolPage.tsx:631-642 |
| F9 | console.error en producción | PoolPage.tsx:187 |
| F10 | console.log emoji en NavBar | NavBar.tsx:53 |
| F11 | console.log en StructuralPicksManager | StructuralPicksManager.tsx:206, 221 |
| F12 | `[key: string]: any` en tipos API | api.ts:216, 231, 237, 239 |
| F13 | `user?: any` en LoginResponse | api.ts:76-79 |
| F14 | setTimeout sin mount check | PoolPage.tsx:952 |

#### MEDIUM (8)
| # | Issue |
|---|-------|
| F15 | `const verbose = false` muerto |
| F16 | `void _var` dead code en StructuralPicksManager |
| F17 | 17+ useState en PoolPage.tsx (considerar useReducer) |
| F18 | Inline styles recreados en cada render (100s) |
| F19 | Google Sign-In failure silencioso |
| F20 | URL de producción hardcodeada en api.ts |
| F21 | useCallback dependencies posiblemente stale |
| F22 | Async onClick handlers podrían extraerse |

#### LOW (8)
| # | Issue |
|---|-------|
| F23 | console.warn para Google (acceptable) |
| F24 | alert() para feedback de usuario |
| F25 | Magic numbers en styles (borderRadius, gap) |
| F26 | Falta JSDoc en componentes |
| F27 | Accesibilidad: toggles son divs, faltan ARIA labels |
| F28 | Sin React.memo en componentes pesados |
| F29 | Sin Error Boundary |
| F30 | Import posiblemente innecesario |

### Schema/Docs - Hallazgos

#### Documentación Faltante
1. Smart Sync system → No documentado en DATA_MODEL.md ni API_SPEC.md (ahora resuelto en CURRENT_STATE.md)
2. UCL 2025-26 instance → No documentado (ahora resuelto)
3. Admin sync endpoints → Faltaban en API_SPEC.md
4. MatchSyncState model → Faltaba en DATA_MODEL.md

#### Documentación Desactualizada
1. CURRENT_STATE.md decía v0.3.2 → Ahora actualizado a v0.3.5
2. CHANGELOG.md sin entradas post v0.3.3 → Ahora actualizado
3. "Ingesta de resultados por API externa" marcado como pendiente → Ya está implementado
4. Legal Documents marcados como "v1.1 future" en DATA_MODEL.md → Ya implementados

#### Schema Issues Pendientes
1. Cascade deletes faltantes en Pool → PoolMember, Prediction, PoolMatchResult
2. Indexes faltantes → PoolMatchResultVersion.source, Prediction.updatedAtUtc, AuditEvent.(entityType, entityId)
3. DeadlineReminderLog → Modelo definido pero sin uso en código
4. PoolMemberStatus.PENDING_APPROVAL → No documentado en docs

### Prioridad de Fixes Recomendada

**Semana 1 (Critical):**
1. Fix setTimeout memory leaks (F1-F7) - patrón repetitivo, fix mecánico
2. Fix race condition invite counter (B2) - agregar check atómico
3. Consolidar scoring logic (B7) - single source of truth
4. Remover console.log debug (F8-F11) - cleanup inmediato

**Semana 2 (High):**
5. Eliminar `as any` (B6) - crear tipos estrictos para dataJson
6. Tighten API types (F12-F13) - reemplazar `[key: string]: any`
7. Agregar password verification para ops destructivas (B4)
8. Estandarizar error responses (B11)

**Semana 3+ (Medium/Low):**
- Remaining items según capacidad

---

## Funcionalidades Pendientes (v1.0)

- [x] ~~Rate Limiting / proteccion brute-force~~ (v0.3.0)
- [x] ~~Mobile UX improvements~~ (v0.3.0/v0.3.1)
- [x] ~~Email confirmation en registro~~ (v0.3.2)
- [x] ~~Email notifications transaccionales~~ (v0.3.2)
- [x] ~~Dominio personalizado~~ (picks4all.com - 2026-01-31)
- [x] ~~Ingesta de resultados por API externa~~ (v0.3.4 - Smart Sync)
- [ ] Chat del pool
- [ ] Session Management (Remember Me)
- [ ] PWA completo (offline mode, push notifications)

---

## Testing

### Cuentas de Prueba
Las cuentas se crean con `npm run seed:test-accounts`:
- admin@quiniela.com (PLATFORM_ADMIN)
- host@test.com (HOST)
- player@test.com (PLAYER)

### Flujo de Testing
1. Login como host
2. Crear pool (preset SIMPLE o CUSTOM)
3. Invitar jugadores
4. Hacer picks (estructurales y/o por partido)
5. Publicar resultados
6. Verificar leaderboard

### Testing de Smart Sync
1. Usar WC2022 instance (`wc2022-autotest-instance`) para testing local
2. Correr `npm run init:smart-sync wc2022-autotest-instance`
3. Verificar sync con `npm run check:instance-state wc2022-autotest-instance`

---

## Documentacion Relacionada

- [PRD.md](PRD.md) - Product Requirements
- [DATA_MODEL.md](DATA_MODEL.md) - Schema completo
- [API_SPEC.md](API_SPEC.md) - Contratos de API
- [BUSINESS_RULES.md](BUSINESS_RULES.md) - Reglas de negocio
- [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitectura tecnica
- [DECISION_LOG.md](DECISION_LOG.md) - ADRs (33 documentados)

---

## Archivos Clave (Sprint 4 - Auto Results)

### Backend - Smart Sync
- `backend/src/services/smartSync/service.ts` - Lógica principal de Smart Sync
- `backend/src/services/apiFootball/client.ts` - Cliente HTTP con rate limiting
- `backend/src/services/apiFootball/types.ts` - Tipos de API-Football
- `backend/src/services/resultSync/service.ts` - Publicación de resultados
- `backend/src/jobs/smartSyncJob.ts` - Cron job (cada minuto)
- `backend/src/jobs/resultSyncJob.ts` - Job de sincronización legacy
- `backend/src/scripts/initSmartSyncStates.ts` - Inicialización de estados
- `backend/src/scripts/seedUcl2025.ts` - Seed de UCL 2025-26

### Backend - Scoring System
- `backend/src/types/pickConfig.ts` - Tipos de MatchPickTypeKey, PhasePickConfig
- `backend/src/lib/pickPresets.ts` - 4 presets (CUMULATIVE, BASIC, ADVANCED, SIMPLE)
- `backend/src/lib/scoringAdvanced.ts` - Lógica de scoring + `isCumulativeScoring()`
- `backend/src/lib/scoringBreakdown.ts` - Generación de breakdown por partido
- `backend/src/validation/pickConfig.ts` - Zod schemas de configuración

### Frontend (Next.js) - Key Files
- `frontend-next/src/app/[locale]/layout.tsx` - Locale layout (NextIntlClientProvider, html lang)
- `frontend-next/src/app/[locale]/page.tsx` - Landing page (SSR, SEO, JSON-LD)
- `frontend-next/src/app/[locale]/login/page.tsx` - Login/Register with Google OAuth
- `frontend-next/src/app/[locale]/(authenticated)/layout.tsx` - Auth layout (AuthGuard + NavBar)
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx` - Pool page
- `frontend-next/src/i18n/routing.ts` - Locale config, localized pathnames
- `frontend-next/src/i18n/navigation.ts` - Locale-aware Link, useRouter, usePathname
- `frontend-next/src/i18n/request.ts` - Message loading config
- `frontend-next/src/proxy.ts` - Middleware (www redirect + next-intl locale routing)
- `frontend-next/src/messages/{es,en,pt}/` - Translation JSONs
- `frontend-next/src/content/{es,en,pt}/` - Heavy SEO content as JSX
- `frontend-next/src/components/LanguageSelector.tsx` - Language dropdown
- `frontend-next/src/lib/api.ts` - API client (55 funciones)
- `frontend-next/src/hooks/useAuth.ts` - Client-side auth hook

---

**Última actualización:** 2026-02-22 | Sprint 6 v0.5.0
