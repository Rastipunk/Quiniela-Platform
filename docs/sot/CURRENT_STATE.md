# Current State - Quiniela Platform

> **Ultima actualizacion:** 2026-01-26 | **Version:** v0.3.2 (Sprint 3 Continued)

---

## Estado General

**Resumen ejecutivo:** La plataforma está en estado v0.3.2 con el **sistema de notificaciones por email** completamente implementado. Esta versión añade emails transaccionales via Resend, verificación de email, preferencias de usuario, panel de configuración admin, y correcciones críticas para deployment en Railway.

### Cambios Recientes (v0.3.2)

1. **Email Notification System (ADR-029)**
   - Emails transaccionales via Resend
   - Welcome email para nuevos usuarios
   - Email verification flow con token seguro (24h expiry)
   - Pool invitation emails
   - Deadline reminder service (configurable por admin)
   - Result published notifications
   - Pool completed notifications

2. **Admin Email Settings Panel**
   - Toggle por tipo de email en `/admin/settings/email`
   - Solo accesible para ADMIN (platformRole)
   - Audit log de cambios

3. **User Email Preferences**
   - Master toggle para desactivar todos los emails
   - Preferencias granulares por tipo de notificación
   - Sección en perfil de usuario

4. **Email Verification**
   - Verificación de email para cuentas email/password
   - Token con expiración de 24 horas
   - Reenvío de email de verificación
   - Cuentas Google marcadas como verificadas automáticamente

5. **Legal Documents Infrastructure**
   - Modelo `LegalDocument` para términos y privacidad
   - Versionado de documentos legales
   - Consent tracking con timestamps

6. **Railway Production Fixes**
   - Agregado `trust proxy` para rate limiting detrás de reverse proxy
   - Configurado `releaseCommand` para migraciones automáticas
   - Solucionado schema drift con migración de email verification fields
   - Health endpoint con información de versión

7. **Auth Improvements**
   - 401 responses incluyen `reason` field para mejor debugging
   - Rate limiting específico para auth endpoints
   - Registro requiere aceptar términos, privacidad y confirmación de edad

### Cambios v0.3.1 (anteriores)

1. **Pool Config Wizard Mobile Optimizations**
   - Hook `useIsMobile()` detecta pantallas < 640px
   - Modal tipo bottom sheet en móvil
   - Cards de presets horizontales y compactas

2. **Light Theme Enforcement**
   - Meta tags: `color-scheme: light only`, `theme-color`
   - CSS agresivo que sobreescribe preferencias del sistema

3. **Bug Fix: CUMULATIVE preset**
   - Corregido key mismatch que causaba error "Invalid preset key: CUMULATIVE"

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

**Detección automática:**
```typescript
function isCumulativeScoring(config: PhasePickConfig): boolean {
  return config.matchPickTypes.HOME_GOALS?.enabled ||
         config.matchPickTypes.AWAY_GOALS?.enabled;
}
```

---

## Arquitectura Actual

### Backend
```
backend/
  src/
    routes/          # Endpoints Express
    lib/             # Utilities (jwt, password, scoring, etc.)
    services/        # Business logic (stateMachine, structuralScoring)
    middleware/      # Auth middleware
    validation/      # Zod schemas
    types/           # TypeScript types
    scripts/         # Seeds, migrations, diagnostics
  prisma/
    schema.prisma    # 20+ modelos
    migrations/      # 13 migraciones Sprint 2
```

### Frontend
```
frontend/
  src/
    pages/           # LoginPage, DashboardPage, PoolPage, ProfilePage
    components/      # UI components (wizard, pickers, cards)
    lib/             # api.ts, auth.ts, timezone.ts
    types/           # Shared types
    data/            # Static data (teamFlags)
```

### Base de Datos (PostgreSQL)
- 25+ modelos Prisma
- Migraciones:
  - Sprint 1: 7 migraciones base
  - Sprint 2: 13 migraciones adicionales
  - Sprint 3: 3 migraciones (email settings, verification, admin promotion)
- Nuevos modelos Sprint 2:
  - StructuralPrediction
  - StructuralPhaseResult
  - GroupStandingsResult
- Nuevos modelos Sprint 3:
  - PlatformSettings (singleton para config global)
  - LegalDocument (términos/privacidad versionados)
- Campos nuevos en User:
  - emailVerified, emailVerificationToken, emailVerificationTokenExpiresAt
  - emailNotificationsEnabled, emailPoolInvitations, emailDeadlineReminders
  - emailResultNotifications, emailPoolCompletions

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

---

## Scripts Disponibles

### Seeds (desarrollo)
```bash
npm run seed:admin              # Crear admin
npm run seed:test-accounts      # Cuentas de prueba
npm run seed:wc2026-sandbox     # Torneo WC2026
```

### Diagnostico
```bash
npm run check:instance-state    # Estado de instance
npm run script:list-pools       # Listar pools
npm run script:force-completed  # Forzar completar pool
```

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
```

### Frontend
- Vite env via `import.meta.env`
- `VITE_API_URL` - API base URL

### Railway (Production)
- `releaseCommand` en railway.toml ejecuta `npx prisma migrate deploy` automáticamente
- `trust proxy` habilitado para rate limiting correcto

---

## Funcionalidades Pendientes (v1.0)

- [x] ~~Rate Limiting / proteccion brute-force~~ (v0.3.0)
- [x] ~~Mobile UX improvements~~ (v0.3.0/v0.3.1)
- [x] ~~Email confirmation en registro~~ (v0.3.2)
- [x] ~~Email notifications transaccionales~~ (v0.3.2)
- [ ] Chat del pool
- [ ] Session Management (Remember Me)
- [ ] Ingesta de resultados por API externa
- [ ] PWA completo (offline mode, push notifications)
- [x] ~~Dominio personalizado~~ (picks4all.com - 2026-01-31)

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
- Frontend: `https://picks4all.com` / `https://www.picks4all.com`
- Backend API: `https://api.picks4all.com`

**Configuración Cloudflare:**
- Proxy: **Desactivado** (DNS only / nube gris)
- SSL/TLS: **Full**

**Variables de Entorno (Railway):**
- Backend: `FRONTEND_URL=https://picks4all.com`
- Frontend: `VITE_API_URL=https://api.picks4all.com`

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

---

## Documentacion Relacionada

- [PRD.md](PRD.md) - Product Requirements
- [DATA_MODEL.md](DATA_MODEL.md) - Schema completo
- [API_SPEC.md](API_SPEC.md) - Contratos de API
- [BUSINESS_RULES.md](BUSINESS_RULES.md) - Reglas de negocio
- [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitectura tecnica
- [DECISION_LOG.md](DECISION_LOG.md) - ADRs

---

## Archivos Clave (Sprint 2)

### Backend - Scoring System
- `backend/src/types/pickConfig.ts` - Tipos de MatchPickTypeKey, PhasePickConfig
- `backend/src/lib/pickPresets.ts` - 4 presets (CUMULATIVE, BASIC, ADVANCED, SIMPLE)
- `backend/src/lib/scoringAdvanced.ts` - Lógica de scoring + `isCumulativeScoring()`
- `backend/src/lib/scoringBreakdown.ts` - Generación de breakdown por partido

### Frontend - UI Components
- `frontend/src/components/PoolConfigWizard.tsx` - Wizard de configuración con presets
- `frontend/src/components/PickRulesDisplay.tsx` - Muestra reglas según modo
- `frontend/src/components/PlayerSummary.tsx` - Resumen personal de puntos

---

## Archivos Clave (Sprint 3 - Mobile UX)

### Frontend - Mobile Optimizations
- `frontend/src/hooks/useIsMobile.ts` - Hook de detección responsive + estilos interactivos
- `frontend/src/components/PoolConfigWizard.tsx` - Modal bottom sheet, presets compactos
- `frontend/src/components/PhaseConfigStep.tsx` - DecisionCard, PickTypeCard, navegación adaptativa
- `frontend/src/components/MobileMatchCard.tsx` - Card de partido optimizada para móvil
- `frontend/src/components/MobileLeaderboard.tsx` - Leaderboard compacto

### Frontend - Theme Enforcement
- `frontend/index.html` - Meta tags para color-scheme, inline styles fallback
- `frontend/src/index.css` - CSS agresivo con `@media (prefers-color-scheme: dark)` override

---

## Archivos Clave (Sprint 3 - Email System)

### Backend - Email Service
- `backend/src/lib/email.ts` - Servicio de email via Resend, todas las funciones de envío
- `backend/src/lib/emailTemplates.ts` - Templates HTML profesionales para emails
- `backend/src/services/deadlineReminderService.ts` - Servicio de recordatorios de deadline
- `backend/src/routes/adminSettings.ts` - Endpoints admin para configuración de emails

### Backend - Configuration
- `backend/railway.toml` - Configuración de deploy (releaseCommand, healthcheck)

### Database Migrations (v0.3.2)
- `20260126013030_add_email_settings` - PlatformSettings + preferencias usuario
- `20260126040000_add_email_verification_fields` - Campos de verificación de email
- `20260126050000_promote_juan_to_admin` - Promoción a ADMIN de plataforma

---

**Última actualización:** 2026-01-26 | Sprint 3 v0.3.2
