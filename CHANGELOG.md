# Changelog

Todos los cambios importantes de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

---

## [Unreleased]

### Pendiente
- PWA completo (offline mode, push notifications)
- Chat del pool
- Session Management (Remember Me)

---

## [0.3.5] - 2026-02-10

### Code Review + Documentation Update + Deployment Fixes

#### Added
- **Comprehensive Code Review**
  - 24 hallazgos backend (4 CRITICAL, 6 HIGH, 8 MEDIUM, 6 LOW)
  - 30 hallazgos frontend (7 CRITICAL, 7 HIGH, 8 MEDIUM, 8 LOW)
  - Auditoría de docs vs código con gaps identificados
  - Prioridad de fixes documentada en CURRENT_STATE.md

#### Fixed
- **Railway Backend Build Errors**
  - TypeScript union type error in `pickPresets.ts` (PhasePickConfig annotation)
  - Optional chaining for `sorted[idx + 1]?.id` in `pools.ts`
  - NIXPACKS_NODE_VERSION bumped to 22 in `backend/railway.toml`

- **Railway Frontend Build Errors**
  - Unused `setVerbose` variable in `PoolPage.tsx` (replaced with constant)
  - NIXPACKS_NODE_VERSION bumped to 22.13 in `frontend/railway.toml` (vite 7 requires >=22.12)

- **Pool Creation Validation**
  - Added `HOME_GOALS` and `AWAY_GOALS` to `MatchPickTypeKeySchema` Zod enum
  - Fixes VALIDATION_ERROR when creating pools with CUMULATIVE preset

#### Changed
- **Documentation Updated**
  - CURRENT_STATE.md fully rewritten to v0.3.5 (was stuck at v0.3.2)
  - CHANGELOG.md updated with v0.3.4 and v0.3.5 entries
  - Smart Sync system documented in CURRENT_STATE.md
  - UCL 2025-26 instance documented
  - Code review findings documented with severity, file references, and fix priorities

#### Technical
- Commits: `0dbffe7`, `9df2a68`, `ac348ed`
- Railway CLI installed and project linked
- All env vars configured on Railway production

---

## [0.3.4] - 2026-02-04

### Automatic Results System (Smart Sync) + UCL 2025-26

#### Added
- **Automatic Results via API-Football (ADR-031)**
  - Hybrid result system: MANUAL mode (Host enters) and AUTO mode (API-Football)
  - `ResultSourceMode` enum: MANUAL | AUTO (per TournamentInstance)
  - `ResultSource` tracking: HOST_MANUAL, HOST_PROVISIONAL, API_CONFIRMED, HOST_OVERRIDE
  - Decision matrix for result priority and overrides
  - Host can enter PROVISIONAL results while waiting for API
  - HOST_OVERRIDE (with mandatory reason) takes final precedence over API

- **Smart Sync - Optimized API Polling (ADR-032)**
  - Per-match state machine: PENDING → IN_PROGRESS → AWAITING_FINISH → COMPLETED
  - 85-90% reduction in API calls vs naive polling (2-4 per match vs 20-30)
  - First check: kickoff + 5 min (confirm match started)
  - Finish check: kickoff + 110 min (covers 95% without extra time)
  - Awaiting finish poll: every 5 min until FT/AET/PEN status
  - Cron job runs every minute, evaluates which matches need checking
  - Kill switch (`syncEnabled`) for emergencies

- **UCL 2025-26 Tournament Instance**
  - Template `ucl-2025` with 9 phases
  - 45 matches: Dieciseisavos (×2 legs), R16 (×2), QF (×2), SF (×2), Final
  - 16 matches scheduled (Dieciseisavos de Final)
  - 29 placeholder matches for later rounds
  - 16 API-Football fixture mappings
  - Seeded in production with sync states initialized

- **API-Football Integration**
  - HTTP client with rate limiting (10 req/min)
  - Fixture status handling: FT, AET, PEN
  - Match external mapping (internal ID ↔ API-Football fixture ID)
  - Result sync logs for audit trail

- **Admin Sync Endpoints**
  - `POST /admin/instances/:id/enable-auto-results` - Enable AUTO mode
  - `POST /admin/instances/:id/trigger-sync` - Manual sync trigger
  - `GET /admin/instances/:id/sync-status` - Sync job status

- **Production Configuration**
  - API-Football environment variables set on Railway
  - Smart Sync enabled in production
  - UCL 2025-26 instance seeded in production DB

#### Technical
- New models: MatchExternalMapping, ResultSyncLog, MatchSyncState
- New enums: ResultSourceMode, ResultSource, MatchSyncStatus, SyncStatus
- New services: smartSync/, apiFootball/, resultSync/
- New jobs: smartSyncJob.ts, resultSyncJob.ts
- New scripts: initSmartSyncStates.ts, seedUcl2025.ts
- ADR-031 and ADR-032 documented in DECISION_LOG.md

---

## [0.3.3] - 2026-02-01

### Rebranding to Picks4All + Public Website + Slide-in Auth Panel

#### Added
- **Rebranding to Picks4All**
  - Updated Footer component with new branding
  - Updated NavBar component logo to "🏆 Picks4All"
  - Updated contact email to soporte@picks4all.com
  - Updated copyright notice

- **Public Website Pages**
  - **LandingPage** (`/`) - Hero section, features grid (4 cards), how-it-works preview, tournament showcase (World Cup 2026), final CTA
  - **HowItWorksPage** (`/how-it-works`) - Detailed 5-step guides for both Hosts and Players, scoring system table example, CTAs
  - **FAQPage** (`/faq`) - 17 FAQ items with accordion UI, category filtering (General, Para Hosts, Para Jugadores, Cuenta), contact section

- **Public Navigation System**
  - **PublicNavbar** - Navigation for non-authenticated users with links: Inicio, Cómo Funciona, FAQ
  - **PublicLayout** - Wrapper component using PublicNavbar + Footer
  - Mobile-responsive hamburger menu with slide-in animation
  - Separate navigation experience for public vs authenticated users

- **Slide-in Auth Panel** (ADR-030)
  - **AuthSlidePanel** - Elegant slide-in panel from right side
  - Full login/register functionality without page navigation
  - Google Sign-in integration with consent flow for new users
  - Desktop: 420px wide panel, Mobile: full-screen
  - Features: tabs (Entrar/Crear cuenta), form validation, consent checkboxes, error handling
  - Accessibility: Escape key closes, backdrop click closes, focus management
  - "Abrir en página completa" link for password manager compatibility
  - Smooth CSS animations (slideInRight, fadeIn)

#### Changed
- **Routing Architecture**
  - Landing page shown at `/` for non-authenticated users
  - Authenticated users go directly to Dashboard
  - Public pages (`/how-it-works`, `/faq`) accessible regardless of auth state
  - `/login` page still available for full-page login experience

- **Legal Documents**
  - Rebranded Terms of Service from "Quiniela Platform" to "Picks4All"
  - Rebranded Privacy Policy from "Quiniela Platform" to "Picks4All"
  - Fixed database migration for legal document seeding

#### Technical
- New components: `AuthSlidePanel.tsx`, `PublicNavbar.tsx`, `PublicLayout.tsx`
- New pages: `LandingPage.tsx`, `HowItWorksPage.tsx`, `FAQPage.tsx`
- App.tsx routing refactored for public/private page separation
- `AUTH_INDEPENDENT_ROUTES` expanded to include `/how-it-works`, `/faq`, `/login`
- All public pages use `useIsMobile()` hook for responsive design

#### Git Tags
- `v0.3.3-pre-landing` - Before public pages implementation
- `v0.3.4-public-pages` - After public pages, before slide-in panel

---

## [0.3.2] - 2026-01-26

### Sistema de Notificaciones por Email + Railway Production Fix

#### Added
- **Email Notification System (ADR-029)**
  - Emails transaccionales via Resend
  - Welcome email para nuevos usuarios
  - Email verification flow con token seguro
  - Pool invitation emails
  - Deadline reminder service (configurable por admin)
  - Result published notifications
  - Pool completed notifications

- **Admin Email Settings Panel**
  - Toggle por tipo de email en `/admin/settings/email`
  - Solo accesible para ADMIN
  - Audit log de cambios

- **User Email Preferences**
  - Master toggle para desactivar todos los emails
  - Preferencias granulares por tipo de notificación
  - Sección en perfil de usuario

- **Email Verification**
  - Verificación de email para cuentas email/password
  - Token con expiración de 24 horas
  - Reenvío de email de verificación
  - Cuentas Google marcadas como verificadas automáticamente

- **Legal Documents Infrastructure**
  - Modelo `LegalDocument` para términos y privacidad
  - Versionado de documentos legales
  - Consent tracking con timestamps

#### Fixed
- **Railway Production Deployment**
  - Agregado `trust proxy` para rate limiting detrás de reverse proxy
  - Configurado `releaseCommand` para migraciones automáticas
  - Solucionado schema drift con migración de email verification fields
  - Health endpoint con información de versión y commit

#### Changed
- Registro ahora requiere aceptar términos, privacidad y confirmación de edad
- Google OAuth incluye consent flow para usuarios nuevos
- 401 responses incluyen `reason` field para mejor debugging

#### Technical
- 27 migraciones de base de datos (3 nuevas)
- `backend/railway.toml` configurado para deployments automáticos
- Nuevo servicio: `deadlineReminderService.ts`
- 44 tests para sistema de email
- Rate limiting específico para auth endpoints

---

## [0.3.1] - 2026-01-18

### Sprint 3 (Continued) - Mobile UX Optimizations + Light Theme Enforcement

#### Added
- **Pool Config Wizard Mobile Optimizations**
  - Hook `useIsMobile()` para detección responsive (breakpoint 640px)
  - Prop `isMobile` propagado a todos los componentes hijos
  - `PoolConfigWizard`: Bottom sheet modal en móvil, padding compacto
  - `PresetSelectionStep`: Cards horizontales compactas, descripciones cortas
  - `PhaseConfigStep`: Navegación con botones flex, textos abreviados
  - `DecisionCard`: Layout horizontal, padding reducido
  - `PickTypeCard`: Ejemplos colapsables, descripciones resumidas
  - `StructuralPicksConfiguration`: Inputs más pequeños, spacing reducido
  - `SummaryStep`: Tipografía escalada, padding adaptativo

- **Light Theme Enforcement (sistema operativo independiente)**
  - Meta tags HTML: `color-scheme`, `theme-color`, `supported-color-schemes`
  - Meta tag iOS: `apple-mobile-web-app-status-bar-style`
  - CSS override agresivo en `@media (prefers-color-scheme: dark)`
  - Selector `*` forzando `color-scheme: light only !important`
  - Override explícito para inputs, buttons, links, cards
  - Inline styles en `<html>` y `<body>` como fallback

#### Fixed
- **CUMULATIVE preset key mismatch** - Cambiado de `key: "CUSTOM"` a `key: "CUMULATIVE"` en pickPresets.ts
- Botones del wizard ocupaban espacio excesivo en móvil

#### Technical
- Nuevo hook: `frontend/src/hooks/useIsMobile.ts`
- Export adicional: `mobileInteractiveStyles` para estilos interactivos
- CSS mobile-first con breakpoint 640px
- Patrón de bottom sheet modal para diálogos móviles

---

## [0.3.0] - 2026-01-18

### Sprint 3 - Notificaciones Internas + Mobile UX + Rate Limiting

#### Added
- **Sistema de Notificaciones Internas (Badges)**
  - Endpoint `GET /pools/:poolId/notifications` para contadores
  - Componente `NotificationBadge` con colores y animación pulse
  - Hook `usePoolNotifications` con polling cada 60s
  - Badges en tabs de PoolPage:
    - 🔴 Rojo en Partidos: picks pendientes + deadlines urgentes
    - 🟠 Naranja en Admin: solicitudes pendientes + fases listas

- **Rate Limiting (ADR-028)**
  - Middleware `express-rate-limit` configurado
  - API general: 100 req/min por IP
  - Auth (login/register): 10 intentos/15min
  - Password reset: 5 solicitudes/hora
  - Headers estándar `RateLimit-*`

- **Mobile UX Improvements**
  - Tabs scrollables horizontalmente
  - Touch targets mínimo 44px
  - Scroll suave en iOS (WebkitOverflowScrolling)
  - Scrollbar oculto en tabs

#### Fixed
- Contraste de color mejorado en sección "Notas importantes" de PickRulesDisplay

#### Technical
- Nuevo directorio `frontend/src/hooks/`
- Animación CSS `@keyframes pulse` para badges urgentes
- Refetch de notificaciones tras acciones (pick, resultado, aprobación)

---

## [0.2.1] - 2026-01-18

### Sprint 2 (Completion) - Cumulative Scoring System

#### Added
- **Cumulative Scoring System** (ADR-027)
  - Nuevo modo de puntuación donde los puntos ACUMULAN por cada criterio
  - 4 criterios evaluados: Resultado, Goles Local, Goles Visitante, Diferencia
  - Grupos: máx 10 pts (5+2+2+1 por partido)
  - Knockouts: máx 20 pts (10+4+4+2 por partido)
  - Detección automática via `isCumulativeScoring()`

- **4 Presets de Scoring**
  - CUMULATIVE (Recomendado): Puntos acumulativos por criterio
  - BASIC: Solo marcador exacto o resultado
  - ADVANCED: Todos los criterios con puntos altos
  - SIMPLE: Configuración automática por fase

- **Player Summary Component**
  - Nueva pestaña "Mi Resumen" en PoolPage
  - Breakdown de puntos por partido y fase
  - Visualización de cada criterio acertado

- **Pick Visibility Post-Deadline**
  - Picks de otros jugadores visibles después del deadline
  - Leaderboard con detalle de picks por jugador

#### Changed
- PoolConfigWizard muestra ACUMULATIVO como preset recomendado
- PickRulesDisplay detecta modo cumulative vs legacy automáticamente
- scoringAdvanced.ts refactorizado para soportar ambos modos

#### Technical
- Nuevos tipos: HOME_GOALS, AWAY_GOALS en MatchPickTypeKey
- pickPresets.ts con configuración completa de 4 presets
- scoringBreakdown.ts genera maxPoints correcto por modo

---

## [0.2.0] - 2026-01-12

### Sprint 2 - Advanced Features

#### Added
- **Advanced Pick Types System**
  - GROUP_STANDINGS: Predecir posiciones de grupos
  - KNOCKOUT_WINNER: Predecir quién avanza en eliminatorias
  - SIMPLE preset con configuración automática por fase
  - Configuración personalizada (CUSTOM preset) con wizard
  - Scoring diferenciado por tipo de pick

- **Pool State Machine**
  - Estados: DRAFT → ACTIVE → COMPLETED → ARCHIVED
  - Transiciones automáticas basadas en eventos
  - Validaciones por estado (joins, picks, results)

- **Co-Admin System**
  - Rol CO_ADMIN con permisos delegados
  - Endpoints: promote, demote
  - Auditoría completa de acciones

- **Join Approval Workflow**
  - Pool puede requerir aprobación para unirse
  - Endpoints: approve, reject pending members
  - Estado PENDING para solicitudes

- **User Profile**
  - Página de perfil con estadísticas
  - Configuración de timezone por usuario
  - Edición de displayName

- **Fixture Snapshot System**
  - Pool mantiene copia independiente del fixture
  - Equipos resueltos tras avance de fase
  - Integridad de datos por pool

#### Changed
- Login soporta Google OAuth
- Registro incluye username único
- Password recovery via email (Resend)

#### Technical
- 13 migraciones de base de datos
- Nuevo sistema de scoring estructural
- Validación de picks por fase y tipo

---

## [0.1.0] - 2026-01-04

### Sprint 1 - MVP Core

#### Added
- **Sistema de Username** (ADR-024)
  - Campo único e inmutable
  - Validación: 3-20 chars, alphanumeric
  - Reserved words bloqueadas

- **Google OAuth** (ADR-026)
  - Login/Register con Google
  - Integración con google-auth-library

- **Password Recovery** (ADR-025)
  - Forgot password flow
  - Email con Resend
  - Tokens de reset seguros

- **Tournament Advancement System** (ADR-019 a 023)
  - Auto-avance de grupos a eliminatorias
  - Validación de fase completa
  - Resolución de equipos por posición

#### Core Features
- Registro/Login (email/password)
- Dashboard con pools del usuario
- Crear pool con código de invitación
- Unirse a pool por código
- Ver partidos por grupo/fase
- Guardar/modificar picks antes de deadline
- Publicar resultados (HOST)
- Leaderboard con scoring configurable
- Hardening: token expirado → logout

---

## [0.0.1] - 2026-01-02

### Initial Setup
- Monorepo structure (backend + frontend)
- PostgreSQL + Prisma ORM
- Express + TypeScript backend
- React + Vite frontend
- JWT authentication
- Source of Truth documentation in /docs/sot/
