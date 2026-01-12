# Advanced Pick Types System - Design Document

## 📋 Overview

Este documento define el diseño completo del sistema de tipos de picks avanzados, el mayor diferenciador de la plataforma Quiniela.

**Fecha:** 2026-01-10
**Estado:** Design Phase → Implementation
**Sprint:** Sprint 2 - Phase 5

---

## 🎯 Objetivos

1. **Flexibilidad por fase**: Cada fase del torneo tiene configuración independiente
2. **Adaptabilidad**: Soportar torneos con diferentes estructuras de fases
3. **Múltiples tipos de picks**: Permitir varios tipos activos simultáneamente
4. **Configuración granular**: HOST controla puntos de cada tipo
5. **Experiencia clara**: Explicaciones contundentes y ejemplos para todos

---

## 🏗️ Arquitectura de Decisión Fundamental

Cada fase del torneo tiene una **decisión fundamental**:

```
┌─────────────────────────────────┐
│  ¿Se requieren marcadores?      │
│  (requiresScore)                │
└────────────┬────────────────────┘
             │
      ┌──────┴──────┐
      │             │
     NO            SÍ
      │             │
      v             v
┌─────────────┐  ┌──────────────┐
│ STRUCTURAL  │  │ MATCH-BASED  │
│ PICKS       │  │ PICKS        │
│             │  │              │
│ Estático    │  │ Por partido  │
│ Lock: Start │  │ Lock: Match  │
└─────────────┘  └──────────────┘
```

### Reglas de Exclusividad

**CRÍTICO**: En una fase, `requiresScore` define dos ramas **MUTUAMENTE EXCLUYENTES**:

- **Si `requiresScore = false`**: Solo structural picks (ordenar grupos/clasificados/avances)
- **Si `requiresScore = true`**: Solo match-based picks (marcadores de partidos)

**NO se pueden mezclar** en la misma fase.

---

## 📊 Modelo de Datos: PhasePickConfig

### Tipo Base

```typescript
type PhasePickConfig = {
  phaseId: string; // "group_stage", "round_of_16", "quarterfinals", etc.
  phaseName: string; // "Fase de Grupos", "Octavos de Final", etc.

  // DECISIÓN FUNDAMENTAL
  requiresScore: boolean;

  // RAMA A: Structural Picks (requiresScore = false)
  structuralPicks?: StructuralPicksConfig;

  // RAMA B: Match-Based Picks (requiresScore = true)
  matchPicks?: MatchPicksConfig;
};
```

---

## 🌳 RAMA A: Structural Picks (Sin Marcadores)

Usado cuando `requiresScore = false`.

```typescript
type StructuralPicksConfig = {
  // TIPO DE PREDICCIÓN ESTRUCTURAL
  type: "GROUP_STANDINGS" | "GLOBAL_QUALIFIERS" | "KNOCKOUT_WINNER";

  // Configuración según tipo
  config: GroupStandingsConfig | GlobalQualifiersConfig | KnockoutWinnerConfig;
};

// Para Fase de Grupos: Ordenar equipos dentro de cada grupo
type GroupStandingsConfig = {
  pointsPerExactPosition: number; // ej: 10 pts por equipo en posición correcta
  bonusPerfectGroup?: number;     // ej: +20 pts si todo el grupo es perfecto

  // OPCIONAL: Además de ordenar grupos, ordenar los 32 clasificados
  includeGlobalQualifiers?: boolean;
  globalQualifiersPoints?: number; // ej: 5 pts por equipo en posición exacta
};

// Para predicción global de clasificados (puede ser adicional a grupos)
type GlobalQualifiersConfig = {
  totalQualifiers: number;        // ej: 32 para WC2026
  pointsPerExactPosition: number; // ej: 5 pts
  lockDateTime: string;           // ISO 8601 - se congela al inicio del torneo
};

// Para Eliminatorias: Solo elegir quién avanza
type KnockoutWinnerConfig = {
  pointsPerCorrectAdvance: number; // ej: 15 pts por acertar quién pasa
  // No importa si fue en 90min, extra time, o penales
};
```

### Características de Structural Picks

- **Estático**: Una vez que el torneo inicia (o la fase), la predicción se **congela** (`isLocked = true`)
- **No modificable**: No se puede cambiar después del lock
- **Lock global**: Todas las predicciones estructurales se bloquean juntas

---

## ⚽ RAMA B: Match-Based Picks (Con Marcadores)

Usado cuando `requiresScore = true`.

```typescript
type MatchPicksConfig = {
  // MÚLTIPLES TIPOS PUEDEN ESTAR ACTIVOS SIMULTÁNEAMENTE
  types: MatchPickType[];

  // AUTO-SCALING (solo para eliminatorias)
  autoScaling?: AutoScalingConfig;
};

type MatchPickType = {
  key: MatchPickTypeKey;
  enabled: boolean;
  points: number;

  // Configuración específica del tipo (si aplica)
  config?: any;
};

type MatchPickTypeKey =
  | "EXACT_SCORE"           // Marcador exacto (ej: 2-1)
  | "GOAL_DIFFERENCE"       // Diferencia exacta (ej: +2, pero no marcador)
  | "PARTIAL_SCORE"         // Acierta local O visitante (no ambos)
  | "TOTAL_GOALS"           // Total exacto de goles (ej: 3)
  | "MATCH_OUTCOME_90MIN";  // Ganador/Empate en 90min (solo si NO hay scores)

type AutoScalingConfig = {
  enabled: boolean;
  basePhase: string;        // ej: "group_stage"
  multipliers: {
    [phaseId: string]: number; // ej: { "round_of_16": 1.5, "quarterfinals": 2.0 }
  };
};
```

### Lógica de Scoring (Match-Based)

**Orden de evaluación** (de más específico a menos):

1. **EXACT_SCORE**: Si acierta marcador exacto → suma puntos, **termina evaluación**
2. **GOAL_DIFFERENCE**: Si NO acertó exacto, pero sí diferencia → suma puntos
3. **PARTIAL_SCORE**: Si acertó goles de local O visitante (no ambos) → suma puntos
4. **TOTAL_GOALS**: Si acertó total de goles → suma puntos

**Ejemplos:**

```
Predicción: Brasil 2-1 Argentina
Resultado: Brasil 2-1 Argentina

✓ EXACT_SCORE (20 pts) → TERMINA
✗ No evalúa GOAL_DIFFERENCE, PARTIAL_SCORE, TOTAL_GOALS
Total: 20 pts
```

```
Predicción: Brasil 2-0 Argentina
Resultado: Brasil 3-1 Argentina

✗ EXACT_SCORE (no acertó)
✓ GOAL_DIFFERENCE (20 pts) - ambos +2
✗ PARTIAL_SCORE (no aplica, acertó diferencia)
✓ TOTAL_GOALS (5 pts) - ambos 3 goles
Total: 25 pts
```

```
Predicción: Brasil 2-1 Argentina
Resultado: Brasil 2-3 Argentina

✗ EXACT_SCORE (no acertó)
✗ GOAL_DIFFERENCE (no acertó, +1 vs -1)
✓ PARTIAL_SCORE (8 pts) - acertó 2 goles del local
✓ TOTAL_GOALS (5 pts) - ambos 3 goles
Total: 13 pts
```

### Reglas Especiales: Knockout con Score

**CRÍTICO**: En fases eliminatorias con `requiresScore = true`:

- **NO se premia "ganador" por separado**
- El jugador puede predecir empate (ej: 1-1) y si acierta, gana puntos normales
- Los puntos se calculan **solo sobre el marcador en 90 minutos**
- No importa si el equipo avanzó en extra time o penales para el scoring

**Por qué**: Si estamos usando marcadores, el enfoque es acertar el score, no quién avanza.

---

## 🎮 Ejemplos de Configuración Completa

### Ejemplo 1: Preset "BÁSICO"

```json
{
  "preset": "BASIC",
  "phases": [
    {
      "phaseId": "group_stage",
      "phaseName": "Fase de Grupos",
      "requiresScore": true,
      "matchPicks": {
        "types": [
          {
            "key": "EXACT_SCORE",
            "enabled": true,
            "points": 20
          }
        ]
      }
    },
    {
      "phaseId": "round_of_16",
      "phaseName": "Octavos de Final",
      "requiresScore": true,
      "matchPicks": {
        "types": [
          {
            "key": "EXACT_SCORE",
            "enabled": true,
            "points": 20
          }
        ],
        "autoScaling": {
          "enabled": true,
          "basePhase": "group_stage",
          "multipliers": {
            "round_of_16": 1.5,
            "quarterfinals": 2.0,
            "semifinals": 2.5,
            "final": 3.0
          }
        }
      }
    }
  ]
}
```

### Ejemplo 2: Preset "AVANZADO"

```json
{
  "preset": "ADVANCED",
  "phases": [
    {
      "phaseId": "group_stage",
      "phaseName": "Fase de Grupos",
      "requiresScore": true,
      "matchPicks": {
        "types": [
          {
            "key": "EXACT_SCORE",
            "enabled": true,
            "points": 20
          },
          {
            "key": "GOAL_DIFFERENCE",
            "enabled": true,
            "points": 10
          },
          {
            "key": "PARTIAL_SCORE",
            "enabled": true,
            "points": 8
          },
          {
            "key": "TOTAL_GOALS",
            "enabled": true,
            "points": 5
          }
        ]
      }
    },
    {
      "phaseId": "round_of_16",
      "phaseName": "Octavos de Final",
      "requiresScore": true,
      "matchPicks": {
        "types": [
          {
            "key": "EXACT_SCORE",
            "enabled": true,
            "points": 30
          },
          {
            "key": "GOAL_DIFFERENCE",
            "enabled": true,
            "points": 15
          }
        ],
        "autoScaling": {
          "enabled": true,
          "basePhase": "group_stage",
          "multipliers": {
            "round_of_16": 1.5,
            "quarterfinals": 2.0,
            "semifinals": 2.5,
            "final": 3.0
          }
        }
      }
    }
  ]
}
```

### Ejemplo 3: Preset "SIMPLE"

```json
{
  "preset": "SIMPLE",
  "phases": [
    {
      "phaseId": "group_stage",
      "phaseName": "Fase de Grupos",
      "requiresScore": false,
      "structuralPicks": {
        "type": "GROUP_STANDINGS",
        "config": {
          "pointsPerExactPosition": 10,
          "bonusPerfectGroup": 20,
          "includeGlobalQualifiers": false
        }
      }
    },
    {
      "phaseId": "round_of_16",
      "phaseName": "Octavos de Final",
      "requiresScore": false,
      "structuralPicks": {
        "type": "KNOCKOUT_WINNER",
        "config": {
          "pointsPerCorrectAdvance": 15
        }
      }
    }
  ]
}
```

### Ejemplo 4: Grupos + 32 Clasificados

```json
{
  "preset": "CUSTOM",
  "phases": [
    {
      "phaseId": "group_stage",
      "phaseName": "Fase de Grupos",
      "requiresScore": false,
      "structuralPicks": {
        "type": "GROUP_STANDINGS",
        "config": {
          "pointsPerExactPosition": 10,
          "bonusPerfectGroup": 20,
          "includeGlobalQualifiers": true,
          "globalQualifiersPoints": 5
        }
      }
    }
  ]
}
```

---

## ⚠️ Validación (Soft Validation)

El sistema usa **validación suave** con warnings educativos, NO bloqueos.

### Reglas de Validación

1. **Al menos un tipo de pick por fase**: Debe haber al menos un pick type enabled
2. **Puntos deben reflejar dificultad**: Warning si no siguen patrón lógico
   - Sugerido: `EXACT_SCORE > GOAL_DIFFERENCE > PARTIAL_SCORE > TOTAL_GOALS`
3. **Auto-scaling coherente**: Multipliers deben ser crecientes por ronda
4. **Lock times válidos**: Deadlines deben ser antes del kickoff

### Ejemplo de Warning

```
⚠️ SUGERENCIA: Los puntos no reflejan la dificultad típica.

Tu configuración:
• Marcador exacto: 10 pts
• Diferencia de goles: 15 pts

Recomendación: Marcador exacto suele valer más que diferencia,
ya que es más difícil de acertar. Considera 20 pts para exacto
y 10 pts para diferencia.

¿Continuar de todas formas? [Sí] [Editar]
```

---

## 🔄 Flujo de Configuración (Wizard)

Ver documento de interfaz para detalles completos del wizard.

**Pasos:**
1. Selector de Preset (Básico/Avanzado/Simple/Personalizado)
2. Configuración por Fase (requiresScore → tipos específicos)
3. Resumen y Confirmación

---

## 💾 Almacenamiento en Base de Datos

### Opción Elegida: JSON Column en Pool

```prisma
model Pool {
  id                String   @id @default(uuid())
  // ... campos existentes ...

  // NUEVO: Configuración de tipos de picks
  pickTypesConfig   Json?    // PhasePickConfig[]

  // ... resto de campos ...
}
```

**Ventajas:**
- Flexible para cambios futuros
- No requiere muchas tablas adicionales
- Fácil de versionar
- Soporta configuraciones personalizadas

**Desventajas:**
- No queryable directamente (aceptable, no necesitamos buscar por config)
- Validación se hace en código, no en DB

---

## 🎯 Puntos Máximos Calculables

El sistema debe poder calcular **puntos máximos teóricos** por fase y totales:

```typescript
function calculateMaxPoints(config: PhasePickConfig[], matches: Match[]): number {
  let total = 0;

  for (const phase of config) {
    const phaseMatches = matches.filter(m => m.phaseId === phase.phaseId);

    if (phase.requiresScore && phase.matchPicks) {
      // Máximo por partido = tipo con más puntos
      const maxPerMatch = Math.max(...phase.matchPicks.types.map(t => t.points));
      total += phaseMatches.length * maxPerMatch;
    } else if (phase.structuralPicks) {
      // Depende del tipo estructural
      if (phase.structuralPicks.type === "GROUP_STANDINGS") {
        const cfg = phase.structuralPicks.config as GroupStandingsConfig;
        // Asumiendo 12 grupos de 4 equipos
        total += 12 * (4 * cfg.pointsPerExactPosition + (cfg.bonusPerfectGroup || 0));

        if (cfg.includeGlobalQualifiers && cfg.globalQualifiersPoints) {
          total += 32 * cfg.globalQualifiersPoints;
        }
      }
      // ... otros tipos
    }
  }

  return total;
}
```

---

## 📝 Decisiones Clave (ADR References)

1. **Exclusividad score/no-score por fase**: `requiresScore` define rama única
2. **Múltiples tipos activos simultáneamente**: Solo en match-based picks
3. **Partial score unificado**: Un solo tipo que premia acertar local O visitante
4. **Knockout scoring**: Con score = sin premio separado a "ganador"
5. **Total goals exacto**: No rangos (Over/Under es futuro)
6. **Soft validation**: Warnings educativos, no bloqueos
7. **JSON storage**: Flexibilidad sobre queries complejas
8. **Auto-scaling**: Solo para knockout con score

---

## 🚀 Next Steps

1. ✅ Documento de diseño completado
2. ⏭️ Migración Prisma (agregar `pickTypesConfig Json?` a Pool)
3. ⏭️ Tipos TypeScript (`backend/src/types/pickConfig.ts`)
4. ⏭️ Validadores Zod (`backend/src/validation/pickConfig.ts`)
5. ⏭️ Lógica de scoring (`backend/src/lib/scoring.ts`)
6. ⏭️ Presets (`backend/src/lib/pickPresets.ts`)
7. ⏭️ Endpoints API (actualizar POST /pools)
8. ⏭️ Wizard Frontend (`frontend/src/components/PoolConfigWizard.tsx`)

---

**Documento creado:** 2026-01-10
**Autor:** Design session con usuario
**Estado:** Listo para implementación
