# Cuentas de Prueba - Escenario Completo WC2026

Este documento describe las cuentas de prueba creadas por el script `seed:full-test` para testing de la plataforma.

## Ejecución del Script

```bash
cd backend
npm run seed:full-test
```

**Requisitos previos:**
- Base de datos PostgreSQL corriendo (Docker)
- Haber ejecutado `npm run seed:wc2026-sandbox` primero

## Credenciales de Acceso

**Contraseña común para todos los usuarios:** `Test1234!`

### Usuario Host

| Campo | Valor |
|-------|-------|
| Email | `host@quiniela.test` |
| Username | `host_carlos` |
| Nombre | Carlos (Host) |
| Rol en Pool | HOST |

### Jugadores

| # | Email | Username | Nombre |
|---|-------|----------|--------|
| 1 | `player1@quiniela.test` | `player_maria` | María García |
| 2 | `player2@quiniela.test` | `player_juan` | Juan Pérez |
| 3 | `player3@quiniela.test` | `player_ana` | Ana Rodríguez |
| 4 | `player4@quiniela.test` | `player_luis` | Luis Martínez |
| 5 | `player5@quiniela.test` | `player_sofia` | Sofía López |
| 6 | `player6@quiniela.test` | `player_diego` | Diego Hernández |
| 7 | `player7@quiniela.test` | `player_laura` | Laura Sánchez |
| 8 | `player8@quiniela.test` | `player_pablo` | Pablo Torres |
| 9 | `player9@quiniela.test` | `player_carmen` | Carmen Ruiz |

## Pool de Prueba

| Campo | Valor |
|-------|-------|
| Nombre | Pool de Prueba WC2026 |
| Estado | ACTIVE |
| Timezone | America/Mexico_City |
| Deadline | 10 minutos antes del kickoff |

## Estado de la Data

### Partidos con Deadline Pasado (100 partidos)
- **Fase de Grupos**: 72 partidos (12 grupos × 6 partidos)
- **Dieciseisavos (R32)**: 16 partidos
- **Octavos (R16)**: 8 partidos
- **Cuartos (QF)**: 4 partidos

### Partidos con Deadline Futuro (4 partidos)
- **Semifinales**: 2 partidos
- **Tercer Lugar**: 1 partido
- **Final**: 1 partido

### Picks
- Cada usuario tiene picks para todos los partidos
- Los estilos de predicción varían por usuario:
  - Host: tiende a acertar exactos
  - Player 1: favorece al local
  - Player 2: favorece empates
  - Player 3: favorece al visitante
  - Player 4: marcadores altos
  - Player 5: marcadores bajos
  - Player 6: siempre 2-1
  - Player 7: siempre 1-0
  - Player 8: aleatorio
  - Player 9: copia resultado con variación

### Resultados
- Todos los partidos hasta cuartos de final tienen resultado publicado
- Semifinales y final **no** tienen resultado (para probar flujo de publicación)

## Configuración de Puntos por Fase

| Fase | Exacto | Diferencia | Parcial | Total Goles |
|------|--------|------------|---------|-------------|
| Grupos | 20 | 10 | 8 | 5 |
| R32 | 25 | 12 | 10 | 6 |
| R16 | 30 | 15 | 12 | 7 |
| Cuartos | 40 | 20 | 15 | 10 |
| Semis | 50 | 25 | 20 | 12 |
| Final | 60 | 30 | 25 | 15 |

## Casos de Prueba Sugeridos

### 1. Visibilidad de Picks Post-Deadline
- Login con cualquier jugador
- Ir a la Pool → Partidos
- Verificar que se puede ver "Ver picks de otros jugadores" en partidos pasados
- Verificar que NO aparece en semifinales/final

### 2. Pestaña "Mi Resumen"
- Login con cualquier usuario
- Ir a Pool → Mi Resumen
- Verificar estadísticas: posición, puntos, partidos puntuados
- Expandir fases para ver desglose por partido

### 3. Leaderboard Clickeable
- Ir a Pool → Leaderboard
- Click en cualquier jugador
- Verificar que abre modal con su resumen
- Verificar que solo muestra picks de partidos con deadline pasado

### 4. Publicar Resultado (Solo Host)
- Login como `host@quiniela.test`
- Ir a Pool → Partidos → Semifinales
- Publicar resultado de una semifinal
- Verificar que se calcula scoring y actualiza leaderboard

### 5. Comparar Resúmenes
- Login con diferentes usuarios
- Comparar puntos y aciertos en "Mi Resumen"
- Verificar consistencia del ranking

## Limpieza / Reset

Para recrear los datos de prueba:
```bash
npm run seed:full-test
```

El script elimina automáticamente la pool anterior y recrea todo.

## Notas Técnicas

- El script es idempotente: puede ejecutarse múltiples veces
- Los usernames son únicos y persistentes
- Los picks son generados de forma pseudo-aleatoria pero reproducible (seed = 42)
- La pool usa `fixtureSnapshot` modificado para controlar los deadlines
