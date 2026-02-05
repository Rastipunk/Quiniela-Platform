# TODO: Próxima Sesión - Sistema de Resultados Automáticos

**Fecha:** 2026-02-05
**Estado:** En progreso - API requests agotados por hoy

---

## Resumen de lo completado

### 1. Sistema Base de Auto-Results (ADR-031) ✅

- Nuevo enum `ResultSourceMode` (MANUAL | AUTO)
- Nuevo enum `ResultSource` (HOST_MANUAL | HOST_PROVISIONAL | API_CONFIRMED | HOST_OVERRIDE)
- Tabla `MatchExternalMapping` para mapear partidos internos a fixture IDs de API-Football
- Tabla `ResultSyncLog` para auditoría de sincronizaciones
- Cliente `ApiFootballClient` con rate limiting (10 req/min)
- Servicio `ResultSyncService` para sincronización
- Cron job cada 5 minutos
- Endpoints admin para configurar y disparar sync

### 2. Smart Sync (ADR-032) ✅

- Nueva tabla `MatchSyncState` para trackear estado por partido
- Estados: PENDING → IN_PROGRESS → AWAITING_FINISH → COMPLETED
- Primera consulta: kickoff + 5 minutos
- Segunda consulta: kickoff + 110 minutos
- Polling cada 5 min solo si no ha terminado
- Reducción de ~85-90% en requests a API

### 3. Prueba Realizada

- Creada instancia de prueba con World Cup 2022
- 10 usuarios (1 host + 9 players)
- 64 partidos (48 grupos + 16 knockout)
- 640 picks aleatorios
- **50 resultados sincronizados exitosamente**
- Límite diario de 100 requests alcanzado

---

## Pendiente para mañana

### 1. Regenerar Prisma Client

El backend estaba corriendo cuando se aplicó la migración de Smart Sync.

```bash
cd backend
npx prisma generate
```

O simplemente reiniciar el backend:
```bash
npm run dev
```

### 2. Inicializar Smart Sync States

Para la instancia de prueba:

```bash
npm run init:smart-sync wc2022-autotest-instance
```

### 3. Probar Smart Sync con nueva instancia

Opción A: Usar los 14 partidos faltantes de la instancia actual
Opción B: Crear nueva instancia con pocos partidos (5-10) para probar el flujo completo

### 4. Agregar endpoint para mostrar "En Juego"

Necesitamos un endpoint público (o en pool overview) que devuelva:

```typescript
// GET /pools/:poolId/matches-in-progress
{
  matches: [
    { matchId: "m_A_1_1", status: "2H", kickoffUtc: "..." },
    { matchId: "m_B_1_1", status: "HT", kickoffUtc: "..." }
  ]
}
```

Esto permite mostrar en el frontend:
- "En juego" badge en los partidos
- Status actual (1H, HT, 2H, ET, PEN)

### 5. Cambiar el server.ts para usar Smart Sync

Actualmente usa `startResultSyncJob()`. Cambiar a `startSmartSyncJob()`:

```typescript
// En server.ts
import { startSmartSyncJob } from "./jobs/smartSyncJob";

// En app.listen callback:
startSmartSyncJob();
```

### 6. (Opcional) UI para admin de sync

Panel en el frontend para:
- Ver estado de sincronización por instancia
- Ver partidos en cada estado (PENDING, IN_PROGRESS, etc.)
- Disparar sync manual

---

## Archivos importantes

### Servicios creados

| Archivo | Propósito |
|---------|-----------|
| `backend/src/services/apiFootball/client.ts` | Cliente HTTP con rate limiting |
| `backend/src/services/apiFootball/types.ts` | Tipos de API-Football |
| `backend/src/services/resultSync/service.ts` | Sync original (batch) |
| `backend/src/services/smartSync/service.ts` | Smart Sync optimizado |

### Jobs

| Archivo | Propósito |
|---------|-----------|
| `backend/src/jobs/resultSyncJob.ts` | Cron original (cada 5 min, batch) |
| `backend/src/jobs/smartSyncJob.ts` | Cron smart (cada 1 min, selectivo) |

### Scripts

| Comando | Propósito |
|---------|-----------|
| `npm run seed:wc2022-autotest` | Crear instancia de prueba |
| `npm run add:knockout` | Agregar fases knockout |
| `npm run init:smart-sync` | Inicializar estados de Smart Sync |

---

## Variables de entorno necesarias

```env
# API-Football
API_FOOTBALL_KEY=94647b8abe7dfe566724cd98100d7522
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_ENABLED=true

# Sync
RESULT_SYNC_ENABLED=true
# o
SMART_SYNC_ENABLED=true
```

---

## Límites de API-Football (Free Tier)

- **100 requests/día** (se renueva a medianoche UTC)
- 10 requests/minuto
- No soporta parámetro `ids` (bulk query)

Con Smart Sync:
- 64 partidos × 2-4 requests = 128-256 requests por torneo completo
- Funciona con free tier si se distribuye en varios días
- En producción: $19/mes = 10,000 requests/día (más que suficiente)

---

## Usuarios de prueba

| Email | Password | Rol |
|-------|----------|-----|
| autotest_host@quiniela.test | Test1234! | HOST |
| autotest_p1@quiniela.test | Test1234! | PLAYER |
| ... | ... | ... |
| autotest_p9@quiniela.test | Test1234! | PLAYER |

**Pool ID:** `wc2022-autotest-pool`
**Instance ID:** `wc2022-autotest-instance`

---

## Notas técnicas

1. El archivo `.env` tenía un bug: `API_FOOTBALL_ENABLED=trueRESULT_SYNC_ENABLED=true` (sin salto de línea). Ya está corregido.

2. El cliente de API-Football fue modificado para hacer requests de a uno (no bulk) porque el free tier no soporta el parámetro `ids`.

3. La optimización en `resultSync/service.ts` (líneas 225-243) ya excluye partidos con resultado API_CONFIRMED para no re-consultarlos.
