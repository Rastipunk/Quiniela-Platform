# Current State - Quiniela Platform

> **Ultima actualizacion:** 2026-01-18 | **Version:** v0.2-beta (Sprint 2 Complete)

---

## Estado General

**Resumen ejecutivo:** La plataforma está en estado v0.2-beta con todas las funcionalidades del Sprint 2 completas. Sprint 2 implementó el **Sistema de Scoring Acumulativo** que permite puntos por múltiples criterios (resultado, goles local, goles visitante, diferencia). También incluye visibilidad de picks post-deadline, resumen personal de puntos, y leaderboard mejorado.

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
- 20+ modelos Prisma
- Migraciones:
  - Sprint 1: 7 migraciones base
  - Sprint 2: 13 migraciones adicionales
- Nuevos modelos Sprint 2:
  - StructuralPrediction
  - StructuralPhaseResult
  - GroupStandingsResult

---

## Endpoints Principales

### Auth
- `POST /auth/register` - Registro con email/username
- `POST /auth/login` - Login email/password
- `POST /auth/google` - Login con Google
- `POST /auth/forgot-password` - Enviar email reset
- `POST /auth/reset-password` - Resetear password

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
```

### Frontend
- Vite env via `import.meta.env`
- API base URL configurable

---

## Funcionalidades Pendientes (v1.0)

- [ ] Rate Limiting / proteccion brute-force
- [ ] Email confirmation en registro
- [ ] Chat del pool
- [ ] Mobile UX improvements
- [ ] Session Management (Remember Me)
- [ ] Ingesta de resultados por API externa

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

**Última actualización:** 2026-01-18 | Sprint 2 Complete
