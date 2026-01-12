# Preset SIMPLE - Implementación Completa

**Sprint 2 - Advanced Pick Types System**
**Fecha:** 2026-01-11
**Estado:** Backend + Componentes UI completos ✅ | Integración en PoolPage: Pendiente ⏳

---

## 🎯 Visión General

El preset **SIMPLE** permite a los usuarios hacer predicciones **sin marcadores**, enfocándose en:

- **Fases de Grupos (GROUP_STANDINGS):** Ordenar equipos del 1° al 4° lugar en cada grupo
- **Fases Eliminatorias (KNOCKOUT_WINNER):** Seleccionar qué equipo avanza en cada partido

Este preset es ideal para usuarios casuales que no quieren predecir marcadores exactos.

---

## ✅ Componentes Implementados

### 1. Frontend - Componentes UI

#### `GroupStandingsPicker.tsx`
- **Funcionalidad:** Drag-and-drop profesional para ordenar 4 equipos de un grupo
- **Librería:** `@dnd-kit` (instalada)
- **Features:**
  - Drag & drop táctil y mouse
  - Visual feedback (posiciones con colores: oro, plata, bronce)
  - Estado disabled cuando pick está bloqueado
  - Banderas de equipos (opcional)
  - Tooltip de instrucciones

#### `KnockoutWinnerPicker.tsx`
- **Funcionalidad:** Seleccionar ganador de partido eliminatorio
- **Features:**
  - Botones grandes con banderas
  - Visual feedback al seleccionar
  - Confirmación clara del equipo elegido
  - Estado disabled cuando pick está bloqueado
  - Animaciones suaves (scale, shadow)

### 2. Backend - Base de Datos

#### Nueva tabla: `StructuralPrediction`
```prisma
model StructuralPrediction {
  id       String @id @default(uuid())
  poolId   String
  userId   String
  phaseId  String  // ID de la fase del torneo
  pickJson Json    // Datos del pick estructural

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  @@unique([poolId, userId, phaseId])
}
```

**Formato de pickJson:**
- GROUP_STANDINGS: `{ groups: [{ groupId, teamIds: ["team1", "team2", "team3", "team4"] }] }`
- KNOCKOUT_WINNER: `{ matches: [{ matchId, winnerId }] }`

#### Nueva tabla: `StructuralPhaseResult`
```prisma
model StructuralPhaseResult {
  id              String @id @default(uuid())
  poolId          String
  phaseId         String
  resultJson      Json      // Mismo formato que pickJson
  createdByUserId String
  publishedAtUtc  DateTime

  @@unique([poolId, phaseId])
}
```

**Migración aplicada:** `20260111060549_add_structural_predictions_and_results`

### 3. Backend - Endpoints API

#### Picks Estructurales (`/pools/:poolId/structural-picks`)

**PUT /:phaseId** - Guardar/actualizar pick estructural completo de una fase
- Auth: Required (miembro activo)
- Validación: Zod schemas
- Auditoría: `STRUCTURAL_PREDICTION_UPSERTED`

**GET /:phaseId** - Obtener pick del usuario para una fase
- Retorna: `{ pick: {...} | null }`

**GET /** - Listar todos los picks estructurales del usuario en la pool

#### Resultados Estructurales (`/pools/:poolId/structural-results`)

**PUT /:phaseId** - Publicar resultado oficial (HOST/CO-ADMIN only)
- Auth: HOST o CO_ADMIN
- Pool status validation
- Auditoría: `STRUCTURAL_RESULT_PUBLISHED`

**GET /:phaseId** - Obtener resultado oficial de una fase

**GET /** - Listar todos los resultados estructurales de la pool

### 4. Frontend - API Client

Funciones agregadas a `frontend/src/lib/api.ts`:

```typescript
// Picks
- upsertStructuralPick(token, poolId, phaseId, pickData)
- getStructuralPick(token, poolId, phaseId)
- listStructuralPicks(token, poolId)

// Results
- publishStructuralResult(token, poolId, phaseId, resultData)
- getStructuralResult(token, poolId, phaseId)
- listStructuralResults(token, poolId)
```

### 5. TypeScript Types

Tipos agregados a `frontend/src/types/pickConfig.ts`:

```typescript
// Pick Data
- GroupStandingsPickData
- KnockoutWinnerPickData
- GroupStandingsPhasePickData
- KnockoutPhasePickData
- StructuralPickData (union type)

// Result Data
- GroupStandingsResultData
- KnockoutWinnerResultData
```

---

## ⏳ Pendiente de Implementación

### 1. Integración en PoolPage (PLAYER View)

Necesita:
- Detectar si pool tiene configuración SIMPLE
- Renderizar `GroupStandingsPicker` o `KnockoutWinnerPicker` según tipo de fase
- Cargar datos de grupos/equipos desde tournament instance
- Guardar picks usando `upsertStructuralPick()`
- Manejar estados: loading, guardado, bloqueado

### 2. Integración en PoolPage (HOST View)

Necesita:
- Componente similar a pickers pero para HOST
- Publicar resultados oficiales usando `publishStructuralResult()`
- Mostrar picks de jugadores (opcional, para comparar)

### 3. Algoritmo de Scoring

**Para GROUP_STANDINGS:**
```typescript
function scoreGroupStandings(
  pick: { teamIds: string[] },
  result: { teamIds: string[] },
  config: { pointsPerExactPosition: number; bonusPerfectGroup?: number }
): number {
  let points = 0;

  // Por cada equipo en su posición exacta
  for (let i = 0; i < 4; i++) {
    if (pick.teamIds[i] === result.teamIds[i]) {
      points += config.pointsPerExactPosition;
    }
  }

  // Bonus si acertó el grupo completo
  if (config.bonusPerfectGroup &&
      JSON.stringify(pick.teamIds) === JSON.stringify(result.teamIds)) {
    points += config.bonusPerfectGroup;
  }

  return points;
}
```

**Para KNOCKOUT_WINNER:**
```typescript
function scoreKnockoutWinner(
  pick: { winnerId: string },
  result: { winnerId: string },
  config: { pointsPerCorrectAdvance: number }
): number {
  return pick.winnerId === result.winnerId
    ? config.pointsPerCorrectAdvance
    : 0;
}
```

Estos algoritmos deben integrarse en el sistema de scoring existente.

### 4. Actualizar Leaderboard

El leaderboard actual calcula puntos solo para picks de marcadores. Necesita:
- Sumar puntos de picks estructurales
- Actualizar cuando se publican resultados estructurales
- Mostrar desglose de puntos por tipo (match picks vs structural picks)

---

## 🚀 Cómo Continuar

### Próximo Paso Inmediato

**Crear un componente wrapper que integre todo en PoolPage:**

```typescript
// frontend/src/components/StructuralPicksManager.tsx

export function StructuralPicksManager({
  poolId,
  phaseId,
  phaseType,
  phaseConfig,
  isHost
}) {
  // Lógica para:
  // 1. Cargar datos de grupos/matches desde instance
  // 2. Cargar picks guardados del usuario
  // 3. Detectar si está bloqueado (deadline)
  // 4. Renderizar GroupStandingsPicker o KnockoutWinnerPicker
  // 5. Guardar cambios automáticamente
}
```

### Testing End-to-End

1. Crear pool con preset SIMPLE
2. Ver reglas en PoolPage
3. Hacer picks para fase de grupos (drag & drop)
4. Hacer picks para fase eliminatoria (seleccionar ganadores)
5. HOST publica resultados estructurales
6. Verificar scoring y leaderboard

---

## 📊 Arquitectura de Datos

### Flujo de Picks Estructurales

```
USER (PLAYER)
  ↓
GroupStandingsPicker / KnockoutWinnerPicker
  ↓
upsertStructuralPick(poolId, phaseId, pickData)
  ↓
PUT /pools/:poolId/structural-picks/:phaseId
  ↓
StructuralPrediction table
```

### Flujo de Resultados

```
USER (HOST/CO-ADMIN)
  ↓
ResultPublisher Component (similar a pickers)
  ↓
publishStructuralResult(poolId, phaseId, resultData)
  ↓
PUT /pools/:poolId/structural-results/:phaseId
  ↓
StructuralPhaseResult table
  ↓
Trigger scoring calculation
  ↓
Update Leaderboard
```

---

## 🎨 UX Considerations

### Mobile-First
- Drag & drop funciona en touch screens
- Botones grandes para selección de ganadores
- Visual feedback claro

### Accesibilidad
- Keyboard support (via @dnd-kit)
- Clear labels and instructions
- Color contrast (gold/silver/bronze vs backgrounds)

### Performance
- Optimistic UI updates
- Debounce saves (opcional)
- Loading states

---

## 🔍 Edge Cases a Considerar

1. **¿Qué pasa si un equipo se retira?**
   - Validación en backend debe verificar que teamIds existan

2. **¿Deadline para picks estructurales?**
   - Actualmente no implementado
   - Podría ser: antes del primer partido de la fase

3. **¿Ediciones permitidas?**
   - Actualmente sí, hasta que HOST publique resultado
   - Alternativa: bloquear tras deadline específico

4. **¿Versioning de resultados (erratas)?**
   - Actualmente NO (a diferencia de match results)
   - Suficiente para MVP: un solo resultado oficial por fase

---

## ✨ Mejoras Futuras

1. **Drag & Drop Avanzado**
   - Animaciones más fluidas
   - Preview mientras arrastras
   - Undo/Redo

2. **Comparación con otros jugadores**
   - Ver picks de otros usuarios (tras deadline)
   - Heatmap de predicciones populares

3. **Insights y Analytics**
   - "80% de usuarios puso a Brasil 1°"
   - Difficulty score por fase

4. **Predicciones parciales**
   - Permitir guardar solo algunos grupos
   - Mostrar progreso (3/12 grupos completados)

---

## 📝 Notas Técnicas

### Por qué @dnd-kit?
- Mejor que react-beautiful-dnd (mantenimiento activo)
- Soporte táctil excelente
- Muy customizable
- Tree-shakeable (bundle pequeño)

### Por qué tabla separada vs JSON en Pool?
- Escalabilidad: queries eficientes por usuario/fase
- Indexes nativos
- Auditoría granular
- Permite features futuras (picks públicos, comparaciones)

### Por qué sin versioning de resultados estructurales?
- Simplicidad MVP
- Resultados estructurales son menos propensos a errores
- Se puede agregar después si es necesario

---

## 🎓 Para el equipo

**Este documento debe actualizarse** conforme se complete la integración y testing.

**Responsable de continuación:** Próximo desarrollador que tome este feature.

**Prioridad:** Alta - completa el preset SIMPLE para Sprint 2.

---

**Estado actual:** ✅ Infraestructura completa | ⏳ Falta integración UI en PoolPage
