# Guía de Avance Automático de Torneos - FIFA World Cup 2026

Esta guía documenta cómo funciona el sistema de avance automático para torneos con fases de grupos y eliminatorias, específicamente implementado para la FIFA World Cup 2026 con 48 equipos.

## Arquitectura

### Componentes Principales

1. **`tournamentAdvancement.ts`** - Algoritmos puros de cálculo:
   - `calculateGroupStandings()` - Calcula tabla de posiciones con criterios FIFA
   - `rankThirdPlaceTeams()` - Rankea terceros lugares entre todos los grupos
   - `determineQualifiers()` - Determina los 32 clasificados (12 ganadores + 12 segundos + 8 mejores terceros)
   - `resolvePlaceholders()` - Resuelve placeholders del R32 con equipos reales
   - `resolveKnockoutPlaceholders()` - Resuelve placeholders de rondas eliminatorias

2. **`instanceAdvancement.ts`** - Integración con base de datos:
   - `validateGroupStageComplete()` - Verifica que todos los partidos de grupos tengan resultados
   - `calculateAllGroupStandings()` - Calcula standings de todos los grupos desde DB
   - `advanceToRoundOf32()` - Ejecuta avance completo de grupos a R32
   - `advanceKnockoutPhase()` - Avanza una fase eliminatoria a la siguiente

3. **API Endpoints** (`adminInstances.ts`):
   - `POST /admin/instances/:instanceId/advance-to-r32` - Avanza de grupos a R32
   - `POST /admin/instances/:instanceId/advance-knockout` - Avanza entre fases eliminatorias
   - `GET /admin/instances/:instanceId/group-stage-status` - Verifica completitud de grupos

## Sistema de Placeholders

### Formato de Placeholders

Los placeholders permiten definir partidos antes de conocer los equipos participantes:

#### Fase de Grupos → Round of 32:
- **Ganadores de grupo**: `W_A`, `W_B`, ..., `W_L` (12 equipos)
- **Segundos de grupo**: `RU_A`, `RU_B`, ..., `RU_L` (12 equipos)
- **Mejores terceros**: `3rd_POOL_1`, `3rd_POOL_2`, ..., `3rd_POOL_8` (8 equipos)

#### Rondas Eliminatorias:
- **Ganadores**: `W_R32_1`, `W_R16_1`, `W_QF_1`, `W_SF_1`
- **Perdedores** (para tercer lugar): `L_SF_1`, `L_SF_2`

### Ejemplo de Definición de Partidos

```typescript
// Round of 32 - Partido 1
{
  id: "m_R32_1",
  phaseId: "round_of_32",
  homeTeamId: "W_A",          // Ganador del Grupo A
  awayTeamId: "3rd_POOL_1",   // Mejor tercer lugar
  // ...
}

// Round of 16 - Partido 1
{
  id: "m_R16_1",
  phaseId: "round_of_16",
  homeTeamId: "W_R32_1",      // Ganador del partido 1 de R32
  awayTeamId: "W_R32_2",      // Ganador del partido 2 de R32
  // ...
}
```

## Criterios de Clasificación FIFA

### Posiciones en Grupos

1. **Puntos** (3 por victoria, 1 por empate, 0 por derrota)
2. **Diferencia de goles** (goles a favor - goles en contra)
3. **Goles a favor**
4. **Fair play points** (opcional, basado en tarjetas)
5. **Sorteo** (requiere intervención manual)

### Ranking de Terceros Lugares

Los mismos criterios se aplican para rankear los 12 terceros lugares y determinar los mejores 8.

## Flujo de Uso

### 1. Fase de Grupos (72 partidos)

Los hosts publican resultados partido por partido:

```http
PUT /pools/:poolId/results/:matchId
Authorization: Bearer <host-token>

{
  "homeGoals": 2,
  "awayGoals": 1
}
```

### 2. Verificar Completitud

El admin verifica que todos los partidos de grupos tengan resultados:

```http
GET /admin/instances/:instanceId/group-stage-status
Authorization: Bearer <admin-token>

Response:
{
  "isComplete": true,
  "missingMatches": [],
  "missingCount": 0
}
```

### 3. Avanzar a Round of 32

Cuando todos los partidos de grupos están completos:

```http
POST /admin/instances/:instanceId/advance-to-r32
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "message": "Avance a Round of 32 completado",
  "data": {
    "standings": {
      "A": [...],  // Tabla del Grupo A
      "B": [...],  // Tabla del Grupo B
      // ...
    },
    "winners": {
      "A": "t_A1",  // México (ejemplo)
      "B": "t_B2",  // Suiza (ejemplo)
      // ...
    },
    "runnersUp": {
      "A": "t_A2",  // Corea del Sur (ejemplo)
      // ...
    },
    "bestThirds": [
      { teamId: "t_C3", groupId: "C", rankAcrossGroups: 1, points: 6, ... },
      { teamId: "t_D3", groupId: "D", rankAcrossGroups: 2, points: 6, ... },
      // ... (8 equipos)
    ],
    "resolvedMatches": [
      { matchId: "m_R32_1", homeTeamId: "t_A1", awayTeamId: "t_C3" },
      // ... (16 partidos)
    ]
  }
}
```

### 4. Avanzar Rondas Eliminatorias

Después de completar cada fase eliminatoria:

```http
POST /admin/instances/:instanceId/advance-knockout
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "currentPhaseId": "round_of_32",
  "nextPhaseId": "round_of_16"
}

Response:
{
  "success": true,
  "message": "Avance de round_of_32 a round_of_16 completado",
  "data": {
    "resolvedMatches": [
      { matchId: "m_R16_1", homeTeamId: "t_A1", awayTeamId: "t_B2" },
      // ... (8 partidos)
    ]
  }
}
```

### 5. Secuencia Completa

1. **Fase de Grupos** → Publicar 72 resultados
2. **Verificar** → `GET .../group-stage-status`
3. **Avanzar a R32** → `POST .../advance-to-r32`
4. **Round of 32** → Publicar 16 resultados
5. **Avanzar a R16** → `POST .../advance-knockout` (R32 → R16)
6. **Round of 16** → Publicar 8 resultados
7. **Avanzar a QF** → `POST .../advance-knockout` (R16 → QF)
8. **Quarter-finals** → Publicar 4 resultados
9. **Avanzar a SF** → `POST .../advance-knockout` (QF → SF)
10. **Semi-finals** → Publicar 2 resultados
11. **Avanzar a Finals** → `POST .../advance-knockout` (SF → Finals)
12. **Finals** → Publicar 2 resultados (3rd place + Final)

## Validaciones y Errores

### Error: Fase de Grupos Incompleta

```json
{
  "error": "ADVANCEMENT_FAILED",
  "message": "Fase de grupos incompleta. Faltan resultados: m_A_1_1, m_B_2_2, ..."
}
```

### Error: Fase Eliminatoria Incompleta

```json
{
  "error": "ADVANCEMENT_FAILED",
  "message": "Fase round_of_32 incompleta. 14/16 partidos con resultado"
}
```

### Error: Empate en Eliminatorias

```json
{
  "error": "ADVANCEMENT_FAILED",
  "message": "Partido m_R32_1 terminó en empate. Se requiere definición por penales."
}
```

**Nota**: Para MVP, las eliminatorias requieren que el resultado tenga un ganador claro. En el futuro se implementará soporte para penales.

## Auditoría

Todos los avances de torneo se registran en `AuditLog`:

```typescript
{
  action: "TOURNAMENT_ADVANCED_TO_R32",
  entityType: "TournamentInstance",
  entityId: "<instanceId>",
  dataJson: {
    winnersCount: 12,
    runnersUpCount: 12,
    bestThirdsCount: 8,
    resolvedMatchesCount: 16
  }
}
```

## Notas de Implementación

### MVP Simplificaciones

1. **Una Pool por Instancia**: El sistema busca resultados de la primera pool asociada a la instancia
2. **Sin Penales**: Las eliminatorias requieren ganador en tiempo reglamentario/extra
3. **Sin Fair Play Automático**: `fairPlayPoints` es opcional y debe calcularse manualmente
4. **Sin Sorteo**: En caso de empate total, el orden se mantiene (requiere intervención manual)

### Futuras Mejoras

1. **Multi-Pool Support**: Especificar poolId para resultados "oficiales"
2. **Penalty Shootouts**: Soporte para definición por penales
3. **Fair Play Calculation**: Cálculo automático basado en tarjetas
4. **Tie-Breaking UI**: Interface para resolver empates manualmente
5. **Real-time Updates**: WebSocket para notificar avances a usuarios conectados

## Testing

Ver [backend/src/scripts/testTournamentAdvancement.ts](../backend/src/scripts/testTournamentAdvancement.ts) para script de prueba end-to-end.

## Referencias

- [FIFA World Cup 2026 Tournament Structure](./WC2026_TOURNAMENT_STRUCTURE.md)
- [PRD - Tournament Progression](./sot/PRD.md#tournament-progression)
- [API Spec - Admin Endpoints](./sot/API_SPEC.md#admin-endpoints)
